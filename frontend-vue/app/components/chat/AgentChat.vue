<script setup lang="ts">
/*
  【文件职责】     编排 DeerFlow 主会话、消息、composer 与右侧业务面板。
  【架构位置】     L3
  【主要导出】     默认 AgentChat 组件
  【依赖关系】     useThreadStream · MessageList · ChatComposer · workspace panels
  【边界与注意】   集成根而非 L2 组件；artifact/sidecar/browser 接线不得反向进入通用层。
*/
import {
  computed,
  defineAsyncComponent,
  defineComponent,
  h,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from "vue";
import { useQueryClient } from "@tanstack/vue-query";
import {
  Bot,
  CalendarClock,
  Check,
  CircleCheckBig,
  Info,
  MoreHorizontal,
  PlusSquare,
  Save,
  X,
} from "lucide-vue-next";

import AgentBootstrapComposer from "@/components/chat/AgentBootstrapComposer.vue";
import AgentWelcome from "@/components/chat/AgentWelcome.vue";
import ChatComposer from "@/components/chat/ChatComposer.vue";
import MessageList from "@/components/chat/MessageList.vue";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import AuroraText from "@/components/ui/effects/AuroraText.vue";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import ContextUsageBadge from "@/components/workspace/ContextUsageBadge.vue";
import ThreadArchiveStatus from "@/components/workspace/ThreadArchiveStatus.vue";
import ThreadBackgroundTasks from "@/components/workspace/ThreadBackgroundTasks.vue";
import ThreadSubagentBatches from "@/components/workspace/ThreadSubagentBatches.vue";
import TodoList from "@/components/workspace/TodoList.vue";
import TokenUsageIndicator from "@/components/chat/TokenUsageIndicator.vue";
import WorkspacePanels from "@/components/workspace/WorkspacePanels.vue";
import ArtifactOverview from "@/components/workspace/artifacts/ArtifactOverview.vue";
import ArtifactTrigger from "@/components/workspace/artifacts/ArtifactTrigger.vue";
import BrowserPanel from "@/components/workspace/browser-view/BrowserPanel.vue";
import BrowserTrigger from "@/components/workspace/browser-view/BrowserTrigger.vue";
import ExportTrigger from "@/components/workspace/ExportTrigger.vue";
import SidecarPanel from "@/components/workspace/sidecar/SidecarPanel.vue";
import SidecarTrigger from "@/components/workspace/sidecar/SidecarTrigger.vue";
import { useArtifactsPanel } from "@/composables/useArtifactsPanel";
import { useAgentCreationSession } from "@/composables/useAgentCreationSession";
import { useSidecar } from "@/composables/useSidecar";
import { useSidecarSession } from "@/composables/useSidecarSession";
import { useThreadStream } from "@/composables/useThreadStream";
import { useThreads } from "@/composables/useThreads";
import { useNotifications } from "@/composables/useNotifications";
import { useSuggestionsConfig } from "@/composables/useSuggestionsConfig";
import { useBrowserControlEnabled } from "@/composables/useWorkspaceFeatures";
import { useAuthSession } from "@/composables/useAuthSession";
import { useWorkspaceSidebar } from "@/composables/useWorkspaceSidebar";
import { useModels } from "@/composables/useModels";
import { useThreadSettings } from "@/composables/useThreadSettings";
import { useThreadTokenUsage } from "@/composables/useThreadTokenUsage";
import { branchThreadFromTurn, createThread } from "@/core/threads/api";
import { INFINITE_THREADS_QUERY_KEY_PREFIX } from "@/core/threads/infinite";
import { getAPIClient } from "@/core/api/api-client";
import { fetch as fetchWithAuth } from "@/core/api/fetcher";
import { getBackendBaseURL } from "@/core/config";
import { isHiddenFromUIMessage, textOfMessage } from "@/core/messages/utils";
import { notificationBody } from "@/core/notification/body";
import type { FileInMessage } from "@/core/messages/utils";
import {
  buildHumanInputResponseText,
  type HumanInputRequest,
  type HumanInputResponse,
} from "@/core/messages/human-input";
import {
  AUTH_DISABLED_USER,
  isAuthDisabledMode,
} from "@/core/auth/auth-disabled-user";
import { safeLocalStorage } from "@/core/settings/local";
import { useWorkspaceToast } from "@/core/workspace-shell/toast";
import { DEFAULT_MAX_SUGGESTIONS } from "@/core/suggestions/api";
import type { Message, ToolCall } from "@/core/types/message";
import {
  selectContextUsage,
  threadTokenUsageToTokenUsage,
} from "@/core/threads/token-usage";
import {
  isThreadMissingError,
  shouldLeaveMissingThread,
  type ThreadPresence,
} from "@/core/threads/thread-presence";
import type { AgentThread, GoalState } from "@/core/threads/types";
import { documentTitleOfThread } from "@/core/threads/utils";
import type { Todo } from "@/core/todos";
import {
  buildReferenceMessageMetadata,
  type SidecarContext,
} from "@/core/sidecar";
import { buildWriteFileArtifactURL } from "@/core/artifacts/utils";
import { getAgent } from "@/core/agents/api";
import { buildAgentSaveSubmission } from "@/core/agents/creation-session";
import { agentKeys } from "@/core/agents/query-keys";
import type { Agent } from "@/core/agents/types";
import { resolveComposerModel } from "@/core/models/capabilities";
import { createAsyncGeneration } from "@/core/async/generation";
import {
  latestBrowserViewFrame,
  reconcileBrowserMessageFrame,
  type BrowserViewFrame,
} from "@/core/browser/frame";
import FlipDisplay from "@/components/ui/effects/FlipDisplay.vue";
import { cn } from "@/lib/utils";

/*
  Artifacts 面板按需加载。它已经在 `v-if` 后面——面板关着时一个 DOM 都不渲染，
  但静态 import 让它的整棵依赖树进了聊天首屏，其中最重的是 `ArtifactPreview`
  经 `rawHtmlRehypePlugins` 拉来的 `rehype-raw` → **parse5**：一个完整的 HTML
  解析器，实测占 `vendor-markdown` chunk 源码体积的 24.8%（276,427 B），加上它
  的 `entities`（70,037 B）与 hast 转换层接近三分之一。而消息渲染路径**从不
  使用 raw HTML**——`plugins.ts` 的文件头就写着这件事：DeerFlow 消息路径整条
  替换了 Streamdown 默认链，raw HTML 走 `remarkHtmlToText` 变成转义文本。
  换句话说，每个只是来聊天的用户都在为产物预览的 HTML 解析器付费。

  面板由用户点击打开，这时再取 chunk 与 CodeBlock/Mermaid/KaTeX 是同一套做法。
*/
/*
  懒加载期间要有话说。React 的 dynamic() 给这三个面板都配了 `loading:`，渲染的是
  `<p role="status">Loading panel…</p>`（chats/chat-box.tsx 的 RightPanelLoading）。
  没有它，chunk 还在路上的那段时间读屏器听到的是一个空面板——用户点了没反应。
  文案是 React 写死的英文，与 primitives 段同一类，放词典里两份同值。
*/
const RightPanelLoading = defineComponent({
  name: "RightPanelLoading",
  setup() {
    const { $i18n } = useNuxtApp();
    return () =>
      h("div", { class: "grid size-full place-items-center" }, [
        h(
          "p",
          { role: "status", class: "text-muted-foreground text-sm" },
          $i18n.t.value.primitives.loadingPanel,
        ),
      ]);
  },
});

const ArtifactPanel = defineAsyncComponent({
  loader: () => import("@/components/workspace/artifacts/ArtifactPanel.vue"),
  loadingComponent: RightPanelLoading,
  delay: 0,
});

const props = defineProps<{
  agentName?: string | null;
  bootstrap?: boolean;
  demo?: boolean;
}>();
const { $i18n } = useNuxtApp();
const route = useRoute();
const router = useRouter();
/* 只读缓存：与侧栏共用同一个 query key，不自己发请求（见 useThreads 的 enabled）。 */
const threads = useThreads({ enabled: false });
/*
  workspace 与 showcase 两个 layout 都 provide 了这个 owner，所以这里可以直接 inject。
  上游同一批提示走 sonner 的全局 toast，本仓走这一份；两边都是「一个应用一个 viewport」。
*/
const toast = useWorkspaceToast();
const queryClient = useQueryClient();
const isDemo = computed(
  () => props.demo === true || route.query.mock === "true",
);
const features = useBrowserControlEnabled({ enabled: !isDemo.value });
const notifications = useNotifications();
const authDisabled = isAuthDisabledMode();
const auth = useAuthSession({
  enabled: computed(() => !authDisabled && !isDemo.value),
});
const currentUserId = computed(() => {
  if (authDisabled) return AUTH_DISABLED_USER.id;
  const session = auth.session.value;
  return session?.tag === "authenticated" ? session.user.id : null;
});
const isAdmin = computed(() => {
  if (authDisabled) return AUTH_DISABLED_USER.system_role === "admin";
  const session = auth.session.value;
  return (
    session?.tag === "authenticated" && session.user.system_role === "admin"
  );
});

const routeThreadId = computed(() => {
  const raw = route.params.thread_id;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === "new" || !value ? null : value;
});
const initialRouteThreadId = routeThreadId.value;
const streamThreadId = computed(() =>
  isDemo.value ? null : routeThreadId.value,
);
const draftThreadId = ref(globalThis.crypto.randomUUID());
watch(routeThreadId, (id) => {
  if (id === null) draftThreadId.value = globalThis.crypto.randomUUID();
});
const settingsScope = computed(() =>
  [
    props.agentName ? `agent:${props.agentName}` : "lead-agent",
    routeThreadId.value ?? draftThreadId.value,
  ].join(":"),
);
const { settings, update: updateThreadSettings } =
  useThreadSettings(settingsScope);
const context = computed(() => ({
  ...settings.value.context,
  ...(props.agentName ? { agent_name: props.agentName } : {}),
  ...(props.bootstrap ? { is_bootstrap: true } : {}),
}));
/*
  与上游 `welcome.tsx` 的模块级 `let waved = false` 同一套语义：整个页面生命周期里
  只有第一次挂载会挥手，之后换会话再回到欢迎页不再重复。放在模块作用域而不是组件
  状态里，正是因为它要跨组件实例存活。
*/
let hasWavedOnce = false;
const hasWaved = ref(hasWavedOnce);
onMounted(() => {
  hasWavedOnce = true;
});

const isUltraWelcome = computed(() => context.value.mode === "ultra");
const welcomeColors = computed(() =>
  isUltraWelcome.value
    ? ["#efefbb", "#e9c665", "#e3a812"]
    : ["var(--color-foreground)"],
);
/** 欢迎区的技能创建分支。判据与 skillModePrompt 的 query 部分是同一个。 */
const skillWelcome = computed(() => route.query.mode === "skill");
const localUploading = ref(false);
const demoMessages = ref<Message[] | null>(null);
const demoArtifacts = ref<string[]>([]);
const demoTitle = ref<string>();
const agent = ref<Agent | null>(null);
const agentResolved = ref(!props.agentName || isDemo.value);
let agentRequest = 0;
const followups = ref<string[]>([]);
const followupsLoading = ref(false);
/* composer 里正开着斜杠目录、或挂着一个技能 chip。见 ChatComposer 的同名 emit。 */
const followupsSuppressed = ref(false);
const suggestionsConfigQuery = useSuggestionsConfig({
  enabled: computed(() => !isDemo.value),
});
const maxSuggestions = computed(
  () =>
    suggestionsConfigQuery.data.value?.max_suggestions ??
    DEFAULT_MAX_SUGGESTIONS,
);
const composer = ref<InstanceType<typeof ChatComposer> | null>(null);
/*
  技能创建入口（设置页的「创建技能」→ /workspace/chats/new?mode=skill）要把一段
  引导 prompt 预填进输入框。上游 chat-page.tsx:90 调 useSpecificChatMode()，条件是
  `thread_id === "new" && mode === "skill"`（chats/use-chat-mode.ts:16）。本仓一直
  只用这个 query 关掉欢迎建议行，从没预填过，`inputBox.createSkillPrompt` 因此
  躺在未引用词条里。

  预填走 composer 的 replaceDraft，而不是自己写 input：草稿层要看见这次写入
  （否则 skill catalog ready 之后的 restore() 会把它按"没人动过"覆盖回空串）。
  上游用 setTimeout(100) 绕开同一件事。
*/
const skillModePrompt = computed(() =>
  routeThreadId.value === null && route.query.mode === "skill"
    ? $i18n.t.value.inputBox.createSkillPrompt
    : null,
);
let appliedSkillModePrompt: string | null = null;
watch(
  [skillModePrompt, composer],
  ([prompt, target]) => {
    if (!prompt || !target || prompt === appliedSkillModePrompt) return;
    appliedSkillModePrompt = prompt;
    target.replaceDraft(prompt);
  },
  { immediate: true },
);
/*
  发失败之后留在屏幕上的那条：文案 + 重试所需的原始内容。

  ——————————————————————————————————————————————————————————————————————
  **聊天面上「谁管谁」的判据（wave 31 定下，与 BrowserPanel 文件头第 3 条同源）：**

  **在某一刻发生的事 → workspace toaster；在一段时间里为真的事 → 页面里的状态。**

  toaster：replay gap、流错误、分支成功/失败、human input 提交失败、选区跨轮次，
  以及 ChatComposer 那 16 条（语音、compact、goal、上传、润色、提交失败）。
  这一档全部**一次性**，说完就该走，上游用的也都是 sonner 的 toast。

  页面里的状态，共三处，都不是「说一句」而是「现在是这个样子」：
  ① 这一条——消息**还没发出去**，重试要用到原始 text/files；
  ② `stream.llmRetry` 的横幅——**正在重试**，流恢复或出错时自己消失
     （`clearThreadRetryNotice`）。上游那边是每个 llm_retry 事件一条 toast，
     一次重试风暴会堆出一摞；
  ③ MessageList 里历史加载失败那条 `role="alert"` + 「再试一次」。

  「带着一个按钮」是这一档的**后果**不是判据：一段持续为真的状态才需要提供出路，
  而 toast 五秒后自己走掉，按钮会跟着一起消失。
  ——————————————————————————————————————————————————————————————————————

  上游这一处只有 `toast.error(getStreamErrorMessage(error))`
  （`core/threads/hooks.ts:2390`），没有任何重试入口，所以保留本仓这一侧。
*/
const failedSend = ref<{
  text: string;
  files: FileInMessage[];
  message: string;
} | null>(null);
const mainTailRequest = ref(0);
const threadTokenUsageQuery = useThreadTokenUsage(routeThreadId, {
  enabled: computed(() => !isDemo.value),
});
const threadTokenUsage = threadTokenUsageQuery.usage;
const contextUsage = computed(() => selectContextUsage(threadTokenUsage.value));
/*
  **不按 isDemo 关掉。** 上游 chat-page.tsx:77 是裸的 `useModels()`——只读案例页
  照样取模型目录，因为头部的 token 用量指示器、输入框的模式与模型触发器都要靠它
  才有名字。本仓此前把它关掉，于是案例页上那两颗触发器**一个可访问名都没有**
  （读屏器念出来是两颗空按钮），头部的用量指示器整个消失。

  代价是公开案例页会多发一次 /api/models。这是上游选的代价，两边一致比省一个
  只读请求重要：一颗念不出名字的按钮对读屏器用户是死路。
*/
const modelCatalog = useModels();
const selectedModel = computed(() => {
  if (!agentResolved.value) return undefined;
  return resolveComposerModel(
    modelCatalog.models.value,
    typeof context.value.model_name === "string"
      ? context.value.model_name
      : undefined,
    agent.value?.model,
  );
});
const persistedTokenUsage = computed(() =>
  threadTokenUsageToTokenUsage(threadTokenUsage.value),
);
const suggestionGeneration = createAsyncGeneration();
let suggestionController: AbortController | null = null;
const preparedThreadId = ref<string | null>(null);
/**
 * `GET /threads/{id}` 的探测结果，和它属于哪个 thread 绑在一起。
 * 只带一个裸 presence 会在切换 thread 后把上一条线程的结论用在新线程上。
 */
const threadPresence = ref<{ threadId: string; presence: ThreadPresence }>({
  threadId: initialRouteThreadId ?? "",
  presence: "unknown",
});
const editState = ref<{
  messageId: string;
  text: string;
  original: string;
  messageIds: string[];
} | null>(null);
/*
  上游 `message-list-item.tsx:176` 的 `editSubmitDisabled` 是四条或：正在提交、
  草稿去空白后为空、**草稿与原文逐字相同**。本仓此前一条都没有，于是可以把一条
  human 消息改成空串再重跑，也可以一个字不改就重跑——两种都会**丢掉这一轮之后
  的全部消息**（editRerunWarning 说的就是这件事），换来一次没有意义的运行。
*/
const editSubmitDisabled = computed(() => {
  const state = editState.value;
  if (!state) return true;
  const draft = state.text.trim();
  return draft.length === 0 || draft === state.original.trim();
});
const bootstrapConversationReady = ref(!props.bootstrap);
const bootstrapConversationFinished = ref(!props.bootstrap);
let finishAgentCreationRun: (messages: readonly Message[]) => void = () => {};
let lastStartedThreadId: string | null = null;

const stream = useThreadStream({
  threadId: streamThreadId,
  // Bootstrap creation intentionally stays on /workspace/agents/new until
  // setup_agent succeeds. Keep the prepared real thread visible without
  // enabling route-owned history queries for it.
  displayThreadId: computed(
    () => streamThreadId.value ?? preparedThreadId.value,
  ),
  context,
  model: selectedModel,
  /*
    流的两条播报都进 workspace toaster，与上游同一条（`core/threads/hooks.ts:1805`
    的 `toast.warning` 与 `:1846` 的 `toast.error`）。此前它们 push 进一个
    **只增不减**的数组，渲染成 `absolute right-4 bottom-36` 的 `<p role="status">`：
    ① 一条一次性的警告会永远挂在屏幕上；② 错误只播成 polite，而 toaster 会把
    error 播成 assertive。**wave 73 起 warn 走 toaster 的 warning 档**——
    补上图标之后 warning 与 info 有了可观察差别（见 workspace-shell/toast.ts 的文件头）。
  */
  notify: {
    warn: (message) =>
      toast.warning(
        message === "conversation.streamReplayGap"
          ? $i18n.t.value.conversation.streamReplayGap
          : message,
      ),
    error: (message) => toast.error(message),
  },
  onStart(startedThreadId) {
    lastStartedThreadId = startedThreadId;
    threads.upsertCreated(
      startedThreadId,
      $i18n.t.value.pages.newChat,
      props.agentName,
    );
    if (routeThreadId.value === null && !props.bootstrap) {
      const path = props.agentName
        ? `/workspace/agents/${encodeURIComponent(props.agentName)}/chats/${startedThreadId}`
        : `/workspace/chats/${startedThreadId}`;
      void router.replace(path);
    }
  },
  onFinish(state, completedMessages) {
    finishAgentCreationRun(completedMessages);
    if (props.bootstrap && !bootstrapConversationReady.value) {
      bootstrapConversationFinished.value = true;
    }
    const id = routeThreadId.value ?? lastStartedThreadId;
    const title = Reflect.get(state, "title");
    const stateTitle = typeof title === "string" && title.trim() ? title : null;
    if (id && typeof title === "string" && title.trim()) {
      const existing = threads.threads.find((item) => item.thread_id === id);
      if (existing) {
        threads.upsert({
          ...existing,
          values: { ...existing.values, title },
        });
      }
    }
    queueMicrotask(() => void refreshPostRun(id, completedMessages));
    // A new chat adopts its real route id asynchronously in onStart. The final
    // wire message can therefore become visible shortly after `onFinish`.
    // Bound the wait instead of emitting an irreversibly body-less notification.
    const notifyWhenFinalMessageIsVisible = (remainingAttempts: number) => {
      if (document.hasFocus()) return;
      const completedMessages = Reflect.get(state, "messages");
      const stateMessages = Array.isArray(completedMessages)
        ? completedMessages.filter(
            (message): message is Message =>
              typeof message === "object" &&
              message !== null &&
              Reflect.get(message, "type") === "ai",
          )
        : [];
      const lastAssistant = [...stateMessages, ...visibleMessages.value]
        .reverse()
        .find((message) => message.type === "ai");
      const listedTitle = id
        ? threads.threads.find((thread) => thread.thread_id === id)?.values
            .title
        : null;
      const refreshedTitle =
        typeof listedTitle === "string" &&
        listedTitle.trim() &&
        listedTitle !== $i18n.t.value.pages.newChat
          ? listedTitle
          : null;
      const notificationTitle =
        stateTitle ??
        refreshedTitle ??
        $i18n.t.value.conversation.newChatNotificationTitle;
      const titleReady = stateTitle !== null || refreshedTitle !== null;
      if ((!lastAssistant || !titleReady) && remainingAttempts > 0) {
        completionNotificationTimer = setTimeout(
          () => notifyWhenFinalMessageIsVisible(remainingAttempts - 1),
          25,
        );
        return;
      }
      notifications.showNotification(notificationTitle, {
        body: notificationBody(
          lastAssistant ? textOfMessage(lastAssistant) : "",
          $i18n.t.value.conversation.finishedNotificationBody,
        ),
      });
    };
    completionNotificationTimer = setTimeout(
      () => notifyWhenFinalMessageIsVisible(8),
      0,
    );
  },
});
const creation = useAgentCreationSession({
  agentName: () => props.agentName ?? "",
  submitSave: (signal) => {
    const submission = buildAgentSaveSubmission(
      $i18n.t.value.agents.saveCommandMessage,
    );
    return send(submission.text, submission.files, {
      additionalKwargs: submission.additionalKwargs,
      signal,
      reportFailure: false,
    });
  },
  loadAgent: (name, signal) => getAgent(name, { signal }),
  async onCreated(created) {
    agent.value = created;
    agentResolved.value = true;
    queryClient.setQueryData(agentKeys.detail(created.name), created);
    queryClient.setQueryData<Agent[]>(agentKeys.list(), (rows) => {
      const current = rows ?? [];
      return current.some((row) => row.name === created.name)
        ? current.map((row) => (row.name === created.name ? created : row))
        : [...current, created];
    });
    await queryClient.invalidateQueries({
      queryKey: agentKeys.list(),
      exact: true,
    });
  },
  copy: {
    saveNotAccepted: $i18n.t.value.agents.saveNotAccepted,
    loadFailed: $i18n.t.value.agents.creationLoadFailed,
    visibilityUnavailable: $i18n.t.value.agents.creationVisibilityUnavailable,
    requestFailed: $i18n.t.value.agents.creationRequestFailed,
    missingToolResult: $i18n.t.value.agents.creationMissingToolResult,
    runFailed: $i18n.t.value.agents.creationRunFailed,
  },
});
finishAgentCreationRun = (messages) => {
  if (props.bootstrap) void creation.onRunFinished(messages);
};
watch(stream.error, (error) => {
  if (props.bootstrap && error) creation.onRunError(error);
});
const creationBusy = computed(
  () =>
    creation.status.value === "saving" || creation.status.value === "verifying",
);

/*
  「记得点保存」的一次性提示，与上游 new/page.tsx 的 showSaveHint 同构：
  bootstrap 会话第一次进入时出现一次，读过就不再出现（同一个 localStorage 键名，
  两个应用共用一份记忆），点了保存也立刻收起。

  上游把它画在自己那张 create 页上；本仓的 bootstrap 走 AgentChat，所以它挂在这里，
  **只在 bootstrap 时渲染**——非 bootstrap 的会话（含被对照台账覆盖的 agent-chat
  场景）一个字节都不受影响。

  agents 下的 saveRequested 与 agentCreatedPendingRefresh **有意不补**（不写成
  带点的完整 key：unused 扫描器扫全文，注释里写一次就把它算成"有人用"，坑 10）：
  上游靠这两条 toast 报告保存进度，本仓的 useAgentCreationSession 用
  saving/verifying/created/error 四态 + 行内错误区表达同一件事，再加两条 toast
  等于同一件事说两遍。它们仍留在已审阅 unused 集里。
*/
const SAVE_HINT_STORAGE_KEY = "deerflow.agent-create.save-hint-seen";
const showSaveHint = ref(false);
onMounted(() => {
  if (!props.bootstrap) return;
  if (safeLocalStorage.getItem(SAVE_HINT_STORAGE_KEY) === "1") return;
  showSaveHint.value = true;
  safeLocalStorage.setItem(SAVE_HINT_STORAGE_KEY, "1");
});
function saveAgent() {
  showSaveHint.value = false;
  void creation.save();
}
const authoritativeArtifacts = computed(() => {
  if (isDemo.value) return demoArtifacts.value;
  const state = stream.state.value;
  const value = Object.prototype.hasOwnProperty.call(state, "artifacts")
    ? Reflect.get(state, "artifacts")
    : threads.threads.find((thread) => thread.thread_id === routeThreadId.value)
        ?.values.artifacts;
  if (value === undefined) return undefined;
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
});
const authoritativeGoal = computed<GoalState | null>(() => {
  const state = stream.state.value;
  if (Object.prototype.hasOwnProperty.call(state, "goal")) {
    return (Reflect.get(state, "goal") as GoalState | null | undefined) ?? null;
  }
  return (
    threads.threads.find((thread) => thread.thread_id === routeThreadId.value)
      ?.values.goal ?? null
  );
});
const localGoal = ref<GoalState | null | undefined>(undefined);
const activeGoal = computed(() =>
  localGoal.value !== undefined ? localGoal.value : authoritativeGoal.value,
);
const authoritativeTodos = computed<Todo[]>(() => {
  const state = stream.state.value;
  const value = Object.prototype.hasOwnProperty.call(state, "todos")
    ? Reflect.get(state, "todos")
    : threads.threads.find((thread) => thread.thread_id === routeThreadId.value)
        ?.values.todos;
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is Todo =>
      typeof item === "object" &&
      item !== null &&
      typeof Reflect.get(item, "content") === "string" &&
      ["pending", "in_progress", "completed"].includes(
        String(Reflect.get(item, "status")),
      ),
  );
});
watch(authoritativeGoal, () => {
  localGoal.value = undefined;
});
watch(routeThreadId, () => {
  localGoal.value = undefined;
});
const artifactPanel = useArtifactsPanel({
  threadId: routeThreadId,
  authoritativeArtifacts,
  historyLoading: stream.isHistoryLoading,
});
/*
  Sidecar 的父 thread 用**草稿 id**，不是 streamThreadId。

  streamThreadId 在 /chats/new 上刻意是 null——后端还没有这条 thread，拉历史会 404
  （React 用 `threadId: isNewThread ? undefined : threadId` 表达同一件事）。但 sidecar
  的父级不是「要拉历史的那条 thread」，而是「这一页代表的那次会话」，React 传的正是
  同一个客户端生成的 id（frontend/src/components/workspace/chats/chat-page.tsx 的
  `<SidecarProvider parentThreadId={threadId}>`），上传限额两边也已经用的是它。

  用 null 的代价不是少发一个请求，而是 sidecar 生命周期在新会话页上根本没装上：
  父级一旦从 null 变成真 id，恢复流程才第一次跑起来，中间这段时间侧边会话的状态是
  未定义的。
*/
const sidecarParentThreadId = computed(() =>
  isDemo.value ? null : (routeThreadId.value ?? draftThreadId.value),
);
const sidecar = useSidecar({
  parentThreadId: sidecarParentThreadId,
  context,
});
const sidecarReady = ref(false);
const sidecarSession = useSidecarSession({
  parentThreadId: sidecarParentThreadId,
  parentMessages: () => demoMessages.value ?? stream.messages.value,
  sidecarThreadId: sidecar.sidecarThreadId,
  references: sidecar.activeReferences,
  context: sidecar.context,
  onReferencesAccepted: sidecar.clearActiveReferences,
});
const browserOpen = ref(false);
const browserFrame = ref<BrowserViewFrame | null>(null);
const observedBrowserMessageFrame = ref<BrowserViewFrame | null>(null);
const lastAutoOpenedBrowserScreenshot = ref<string | null>(null);
const agentBrowserEnabled = computed(
  () =>
    !props.agentName ||
    (agent.value !== null &&
      (agent.value.tool_groups == null ||
        agent.value.tool_groups.includes("browser"))),
);
const browserEnabled = computed(
  () =>
    Boolean(routeThreadId.value) &&
    !isDemo.value &&
    features.browserControlEnabled.value &&
    agentBrowserEnabled.value,
);
const latestBrowserFrame = computed(() =>
  latestBrowserViewFrame(demoMessages.value ?? stream.messages.value),
);
watch(routeThreadId, () => {
  browserOpen.value = false;
  browserFrame.value = null;
  observedBrowserMessageFrame.value = null;
  lastAutoOpenedBrowserScreenshot.value = null;
});
watch(
  [latestBrowserFrame, browserEnabled],
  ([nextFrame, enabled]) => {
    if (!nextFrame) return;
    const reconciliation = reconcileBrowserMessageFrame(
      browserFrame.value,
      observedBrowserMessageFrame.value,
      nextFrame,
    );
    observedBrowserMessageFrame.value = reconciliation.observed;
    if (reconciliation.changed) {
      browserFrame.value = reconciliation.display;
    }
    if (
      enabled &&
      nextFrame.screenshot !== lastAutoOpenedBrowserScreenshot.value
    ) {
      lastAutoOpenedBrowserScreenshot.value = nextFrame.screenshot;
      browserOpen.value = true;
    }
  },
  { immediate: true },
);
watch(browserEnabled, (enabled) => {
  if (!enabled) browserOpen.value = false;
});
watch(
  sidecarSession.ready,
  (ready) => {
    sidecarReady.value = ready;
  },
  { immediate: true },
);
/*
  artifacts 面板开着就是开着，与「有没有选中文件」无关。

  React 的 activeRightPanel 只看 artifactsOpen（frontend/src/components/workspace/chats/chat-box.tsx），
  没选中文件时面板落在文件清单上，而不是不开。原来这里多要一个 selectedArtifact，
  于是头部入口必须先替用户选一个文件，面板才肯出现——那正是下面 showArtifacts()
  里那段自动选中的由来。
*/
const activePanel = computed<"artifacts" | "sidecar" | "browser" | null>(() => {
  // 优先级照 React：sidecar > browser > artifacts
  // （frontend/src/components/workspace/chats/chat-box.tsx 的 activeRightPanel）。
  // 原来是 browser 排在 sidecar 前面：两个都开着时两个应用显示的不是同一个面板。
  if (sidecar.open.value) return "sidecar";
  if (browserOpen.value && browserEnabled.value) return "browser";
  if (artifactPanel.open.value) return "artifacts";
  return null;
});
const panelOpen = computed(() => activePanel.value !== null);

function openArtifact(path: string, automatic = false) {
  if (!artifactPanel.select(path, automatic)) return;
  browserOpen.value = false;
  sidecar.close();
}
/*
  上游 `sidecar-trigger.tsx` 在这次带 force 的重查期间把触发器置灰
  （`isReconciling`）。缓存里的 sidecar id 可能指向别处删掉的线程（#3555），
  重查要走一次网络；不锁按钮的话连点两下就发两次 restore。
*/
const sidecarReconciling = ref(false);
async function toggleSidecar() {
  if (sidecar.open.value) {
    sidecar.close();
    return;
  }
  sidecarReconciling.value = true;
  try {
    const restored = await sidecarSession.restore({ force: true });
    if (restored && artifactPanel.close()) {
      browserOpen.value = false;
      sidecar.open.value = true;
    }
  } finally {
    sidecarReconciling.value = false;
  }
}
function openBrowser() {
  if (!artifactPanel.close()) return;
  sidecar.close();
  browserOpen.value = true;
}
function toggleBrowser() {
  if (browserOpen.value) {
    browserOpen.value = false;
    return;
  }
  openBrowser();
}
function acceptBrowserFrame(frame: BrowserViewFrame) {
  browserFrame.value = frame;
}
function openBrowserFrame(frame: BrowserViewFrame) {
  acceptBrowserFrame(frame);
  openBrowser();
}
function askInSidecar(payload: {
  message: Message;
  selectedText: string;
  displayIndex: number;
}) {
  const next = sidecar.fromSelection(
    payload.message,
    payload.selectedText,
    payload.displayIndex,
  );
  if (!next) return;
  if (!artifactPanel.close()) return;
  sidecar.openContext(next);
}

/*
  只开面板，不替用户选文件——React 的 ArtifactTrigger 就只有
  `sidecar?.close(); setArtifactsOpen(true);`
  （frontend/src/components/workspace/artifacts/artifact-trigger.tsx）。
  自动选中看起来省一步，代价是面板会去拉那个文件的内容，用户并没有要求它这么做。
*/
function showArtifacts() {
  // React 的 ArtifactTrigger 只做这两件事：关掉 sidecar、打开 artifacts
  // （artifacts/artifact-trigger.tsx）。**不**关浏览器面板——浏览器排在 artifacts
  // 前面，所以它开着的时候这颗按钮只是把 artifacts 标成待展开，等浏览器关掉才生效。
  if (!artifactPanel.setOpen(true)) return;
  sidecar.close();
}
function addToConversation(payload: {
  message: Message;
  selectedText: string;
  displayIndex: number;
}) {
  const next = sidecar.fromSelection(
    payload.message,
    payload.selectedText,
    payload.displayIndex,
  );
  if (next) sidecar.addContextToConversation(next);
}

function quotePrompt(contexts: SidecarContext[]): Message {
  const blocks = contexts.flatMap((item, index) => [
    `<referenced_message index="${index + 1}" label="${item.label.replaceAll('"', "&quot;")}">`,
    `Role: ${item.role === "user" ? "User" : "Assistant"}`,
    item.messageId ? `Message ID: ${item.messageId}` : "",
    "",
    item.content,
    "</referenced_message>",
    "",
  ]);
  return {
    type: "human",
    content: [
      {
        type: "text",
        text: [
          contexts.length === 1
            ? "The user added the following quoted context to this conversation."
            : `The user added the following ${contexts.length} quoted contexts to this conversation.`,
          "Use the referenced_message blocks as reference material for the user's next message.",
          "",
          ...blocks,
        ].join("\n"),
      },
    ],
    additional_kwargs: {
      hide_from_ui: true,
      conversation_quote_context: true,
      referenced_message_ids: contexts.map((item) => item.messageId ?? ""),
      referenced_message_roles: contexts.map((item) => item.role),
      quote_context_count: contexts.length,
    },
  } as Message;
}

let completionNotificationTimer: ReturnType<typeof setTimeout> | undefined;
const lastAutoOpenedArtifact = ref<string | null>(null);
/*
  自动打开只发生在两种情况，与 React 的 ToolCall 一一对应
  （frontend/src/components/workspace/messages/message-group.tsx 的
  `autoOpenArtifactUrl`）：

    - 这一轮**正在流式**、最后一个工具调用是 write_file / str_replace、而且它还没
      返回——用户在看模型现场写这个文件；
    - 最后一个工具调用是 finalize_artifact_write 且结果成功——产物已经落地。

  两条判据都少不得。原来这里扫全部消息、只要见到 write_file 就设 target，于是
  **打开任何一条带 write_file 的历史线程都会自动展开面板并收起侧栏**，而 React 那边
  `isLoading` 为假、`finalizedArtifactPath` 为空，什么都不会发生。

  取的是最后一个**写产物**的调用，不是最后一个工具调用。React 的判据是 `isLast`
  （每个 group 只有最后一个工具步骤带它），它靠的是「流式过程中 write_file 曾经是最后
  一步」这一瞬间：那一刻 effect 触发、面板打开，之后再来别的工具调用也不会关掉它。
  Vue 的渲染消息流是降频过的（useCoalescedStreamMessages，每 80ms 至多一帧），
  那一瞬间不保证会成为独立的一帧——实测真 Gateway 回放里 write_file 与随后的 read_file
  落在同一帧，按「最后一个工具调用」判，面板一次都不会开
  （tests/e2e-real/artifact-write.spec.ts 当场变红）。
*/
const ARTIFACT_WRITE_TOOLS = new Set([
  "write_file",
  "str_replace",
  "finalize_artifact_write",
]);

function artifactWriteCallIds(messages: Message[]) {
  const ids: string[] = [];
  for (const message of messages) {
    if (message.type !== "ai") continue;
    for (const call of message.tool_calls ?? []) {
      if (ARTIFACT_WRITE_TOOLS.has(call.name) && call.id) ids.push(call.id);
    }
  }
  return ids;
}

/*
  进入这条线程时**已经在历史里**的写产物调用。

  React 用 `isLoading`（这一轮还在流式）区分「模型正在写」与「翻旧账」。Vue 抄不了
  这个信号：渲染用的消息流被降频成每 80ms 至多一帧（useCoalescedStreamMessages），
  写文件那一帧落在流式结束之前还是之后并不确定——实测两条真 Gateway 用例一条落在
  之前、一条落在之后，用 isStreaming 判会一条绿一条红。

  换成按**来源**判：历史里就有的不开，本次运行新出现的才开。这与 React 想表达的是
  同一件事，而且不依赖任何时序。
*/
const historyArtifactCallIds = ref<Set<string> | null>(null);
/*
  快照只在**换一条线程**时作废，不能绑在 isHistoryLoading 上。

  绑在加载状态上时有这么一条路径：`/chats/new` 上发出第一条消息 → 路由拿到真 id →
  页面为这个新 id 拉一次历史 → isHistoryLoading 变 true → 快照被清成 null →
  加载结束时用**当时**的 messages 重新取快照，而本次流式产生的 write_file 早就在
  里面了。于是「模型此刻正在写的这个文件」被判成「历史里本来就有」，面板永远不开。
  开不开取决于 tool call 与历史加载谁先到——e2e-real 实测约 1/3 的运行里不开，
  同时打挂 real-backend-render 的截图与 artifact-write 的行为断言。

  `/chats/new` 拿到自己的 id **不是**换线程，是同一段对话拿到了 id，所以那一次不作废。
*/
watch(routeThreadId, (threadId, previousThreadId) => {
  if (previousThreadId == null && threadId) return;
  historyArtifactCallIds.value = null;
});
watch(
  () => stream.isHistoryLoading.value,
  (loading) => {
    if (loading) return;
    historyArtifactCallIds.value ??= new Set(
      artifactWriteCallIds(stream.messages.value),
    );
  },
  { immediate: true },
);

const autoOpenArtifact = computed(() => {
  const messages = stream.messages.value;
  let lastCall: ToolCall | undefined;
  let lastCallMessageId: string | undefined;
  for (const message of messages) {
    if (message.type !== "ai") continue;
    for (const call of message.tool_calls ?? []) {
      if (!ARTIFACT_WRITE_TOOLS.has(call.name)) continue;
      lastCall = call;
      lastCallMessageId = message.id;
    }
  }
  const path = lastCall?.args?.path;
  if (!lastCall || typeof path !== "string") return null;

  const result = messages.find(
    (candidate) =>
      candidate.type === "tool" && candidate.tool_call_id === lastCall.id,
  );
  if (lastCall.name === "finalize_artifact_write") {
    // React 的 isSuccessfulToolResult：trimStart().startsWith("OK")。
    return result && textOfMessage(result).trimStart().startsWith("OK")
      ? path
      : null;
  }
  if (lastCall.name !== "write_file" && lastCall.name !== "str_replace") {
    return null;
  }
  /*
    React 在这里还要求「工具**还没返回**」（`isLoading && url && !result`）。两条判据
    合起来说的是「这是模型此刻正在写的那个文件」；Vue 用「它不在进入线程时的历史里」
    表达同一件事，理由见 historyArtifactCallIds 上面那段。
  */
  const history = historyArtifactCallIds.value;
  if (!history || (lastCall.id && history.has(lastCall.id))) return null;
  return buildWriteFileArtifactURL({
    filepath: path,
    messageId: lastCallMessageId,
    toolCallId: lastCall.id,
  });
});
watch(
  autoOpenArtifact,
  (target) => {
    if (!target) return;
    const key = `${routeThreadId.value ?? "new"}\u0000${target}`;
    if (key === lastAutoOpenedArtifact.value) return;
    lastAutoOpenedArtifact.value = key;
    openArtifact(target, true);
  },
  { immediate: true },
);

const visibleMessages = computed(() =>
  (demoMessages.value ?? stream.messages.value).filter(
    (message: Message) => !isHiddenFromUIMessage(message),
  ),
);

/**
 * 只有「元数据确认缺失 + 历史已问出结论 + 确实一条消息都没有」才放弃这个 URL。
 *
 * 之前这里是 `onMounted` 的 catch 直接 `router.replace`：checkpoint 一 404 就跳。
 * 而上下文压缩之后 checkpoint 本来就不再持有旧消息，`/threads/{id}` 与 `/state`
 * 双双 404，`/threads/{id}/messages/page` 却仍然能完整返回这段会话——用户于是被
 * 静默送回新会话，对话看起来凭空消失。判据必须是「后端还能不能给出这段会话」。
 */
watch(
  () =>
    shouldLeaveMissingThread({
      presence:
        threadPresence.value.threadId === routeThreadId.value
          ? threadPresence.value.presence
          : "unknown",
      historySettled: stream.isHistorySettled.value,
      hasMessages: visibleMessages.value.length > 0,
    }),
  (leave) => {
    if (leave) void router.replace("/workspace/chats/new");
  },
);
const pendingUsageMessages = computed(() => {
  if (!stream.isStreaming.value || !stream.activeRunId.value) return [];
  const runId = stream.activeRunId.value;
  return visibleMessages.value.filter(
    (message) => Reflect.get(message, "run_id") === runId,
  );
});
const promptHistory = computed(() =>
  visibleMessages.value
    .filter((message) => message.type === "human")
    .map((message) => {
      if (typeof message.content === "string") return message.content;
      return Array.isArray(message.content)
        ? message.content
            .map((part) =>
              typeof part === "object" && part !== null && "text" in part
                ? String(part.text ?? "")
                : "",
            )
            .join("")
        : "";
    })
    .filter(Boolean),
);
/*
  头部上真正显示出来的标题：会话真的有的标题，没有就是空串
  （React 的 ThreadTitle 在 `!thread.values?.title` 时直接 return null）。
*/
const headerTitle = computed(() => {
  if (isDemo.value && demoTitle.value) return demoTitle.value;
  if (!routeThreadId.value) return "";
  return (
    threads.threads.find((thread) => thread.thread_id === routeThreadId.value)
      ?.values.title ?? ""
  );
});
/*
  浏览器标签标题。上游是 ThreadTitle 里那个 useEffect 在写 document.title；
  本仓此前会话页一个 useHead 都不设，标签页永远停在 nuxt.config 的根标题
  "DeerFlow"——开着几个会话时分不出哪个是哪个，读屏器打开页面也念不出这条
  会话的名字。判据在 core/threads/utils.ts 的 documentTitleOfThread。

  喂给它的是 headerTitle（这条会话**真的**有的标题，没有就是空串），兜底由
  documentTitleOfThread 按新/旧会话去挑，与上游同一条链。
*/
useHead(() => ({
  title: documentTitleOfThread({
    title: headerTitle.value,
    isNewThread: routeThreadId.value === null,
    isLoading: stream.isHistoryLoading.value,
    appName: $i18n.t.value.pages.appName,
    newChatLabel: $i18n.t.value.pages.newChat,
    untitledLabel: $i18n.t.value.pages.untitled,
  }),
}));
const currentThread = computed(() => {
  const threadId = routeThreadId.value;
  if (!threadId) return null;
  const existing = threads.threads.find(
    (thread) => thread.thread_id === threadId,
  );
  if (existing) return existing;
  /*
    列表里还没有这条会话时才自己拼一个。**不给 title 兜底**：这个对象只喂
    ExportTrigger，而导出用的 `titleOfThread` 自己带 "Untitled" 兜底，与上游
    `core/threads/export.ts` 是同一条链。此前这里填的是 currentTitle，而
    currentTitle 在这一支里恒等于 `pages.newChat`——于是同一条无标题会话，
    React 导出 `Untitled.md`、本仓导出 `New Chat.md`（中文界面下还会变成
    `新对话.md`，导出文件名跟着界面语言走）。台账取不到它：导出要点开菜单，
    文件名根本不在 DOM 里。
  */
  return {
    thread_id: threadId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    metadata: {},
    status: "idle",
    values: { messages: visibleMessages.value },
    interrupts: {},
  } as unknown as AgentThread;
});
const isWelcomeMode = computed(
  () => visibleMessages.value.length === 0 && !stream.isHistoryLoading.value,
);
/*
  头部的两态。上游 chat-page.tsx 把这两支写在同一个 cn() 里，欢迎态换掉的是
  背景与模糊那三条；写成 `class` + `:class` 两个属性的话，`bg-background/80` 与
  `bg-background/0` 会同时留在 class 上，赢家由样式表顺序决定而不是模板顺序。
*/
const headerClass = computed(() =>
  cn(
    "absolute top-0 right-0 left-0 z-30 flex h-12 shrink-0 items-center gap-2 px-2 sm:px-4",
    isWelcomeMode.value
      ? "bg-background/0 backdrop-blur-none"
      : "bg-background/80 shadow-xs backdrop-blur",
  ),
);

/*
  触发器现在直接读写共享状态，不再往 window 上发事件：此前这里发出去就不管了，
  组件**拿不到开合态**，图标只能写死一个 Menu。全局事件仍然保留给真正跨切面的
  两个调用方（命令面板的 Cmd+B、artifact 面板的收起）。
*/
const { mobileOpen: sidebarMobileOpen, toggleSidebar } = useWorkspaceSidebar();

function startAgentChat() {
  if (!props.agentName) return;
  void router.push(
    `/workspace/agents/${encodeURIComponent(props.agentName)}/chats/new`,
  );
}
function recentConversation(
  messages: readonly Message[] = visibleMessages.value,
) {
  return messages
    .filter((message) => message.type === "human" || message.type === "ai")
    .map((message) => ({
      role: message.type === "human" ? "user" : "assistant",
      content: textOfMessage(message),
    }))
    .filter((message) => message.content.trim())
    .slice(-6);
}

async function refreshPostRun(
  targetThreadId: string | null,
  completedMessages: readonly Message[],
) {
  if (!targetThreadId) return;
  // The just-completed run is the authoritative suggestion input. Capture it
  // before metadata/token refreshes can re-read an eventually-consistent
  // thread snapshot and temporarily replace the visible history.
  const messages = recentConversation(completedMessages);
  const scope = `${targetThreadId}\u0000${props.agentName ?? "lead-agent"}`;
  const token = suggestionGeneration.begin(scope);
  suggestionController?.abort();
  const controller = new AbortController();
  suggestionController = controller;
  try {
    const refreshed = await getAPIClient().threads.get(targetThreadId);
    if (
      controller.signal.aborted ||
      (routeThreadId.value ?? lastStartedThreadId) !== targetThreadId ||
      !suggestionGeneration.isCurrent(token, scope)
    ) {
      return;
    }
    threads.upsert(refreshed);
  } catch {
    // The stream state remains authoritative while metadata persistence catches up.
  }
  if (
    controller.signal.aborted ||
    (routeThreadId.value ?? lastStartedThreadId) !== targetThreadId ||
    !suggestionGeneration.isCurrent(token, scope)
  ) {
    return;
  }
  await threadTokenUsageQuery.refetch();
  const config =
    suggestionsConfigQuery.data.value ??
    (await suggestionsConfigQuery.refetch({ cancelRefetch: false })).data;
  if (
    controller.signal.aborted ||
    !suggestionGeneration.isCurrent(token, scope) ||
    !config?.enabled
  ) {
    return;
  }
  if (messages.length === 0) return;
  followupsLoading.value = true;
  followups.value = [];
  try {
    const response = await fetchWithAuth(
      `${getBackendBaseURL()}/api/threads/${encodeURIComponent(targetThreadId)}/suggestions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages,
          n: maxSuggestions.value,
          model_name: context.value.model_name,
        }),
        signal: controller.signal,
      },
    );
    if (!response.ok) return;
    const body = (await response.json()) as { suggestions?: unknown[] };
    if (
      controller.signal.aborted ||
      (routeThreadId.value ?? lastStartedThreadId) !== targetThreadId ||
      !suggestionGeneration.isCurrent(token, scope)
    ) {
      return;
    }
    followups.value = (body.suggestions ?? [])
      .flatMap((value) =>
        typeof value === "string" && value.trim() ? [value.trim()] : [],
      )
      .slice(0, maxSuggestions.value);
  } catch {
    if (
      !controller.signal.aborted &&
      suggestionGeneration.isCurrent(token, scope)
    ) {
      followups.value = [];
    }
  } finally {
    if (suggestionGeneration.isCurrent(token, scope)) {
      followupsLoading.value = false;
    }
    if (suggestionController === controller) suggestionController = null;
  }
}

watch(
  [routeThreadId, () => props.agentName],
  ([nextThreadId, nextAgentName], [previousThreadId, previousAgentName]) => {
    // `new` adopts the same thread id produced by onStart. That URL update is
    // not a conversation switch and must not abort the post-run suggestion
    // request already owned by that thread.
    const adoptingStartedThread =
      previousThreadId === null &&
      nextThreadId === lastStartedThreadId &&
      nextAgentName === previousAgentName;
    if (adoptingStartedThread) return;

    suggestionGeneration.invalidate();
    suggestionController?.abort();
    suggestionController = null;
    followupsLoading.value = false;
    followups.value = [];
  },
);

/*
  从项目里开的新会话，要在**第一条消息发出去之前**归属到那个项目。

  这是新会话进项目的唯一通道——run 请求本身不带项目字段。顺序反了或者这一步
  失败了还照发，会话就落在项目外面，而用户是从项目里点进来的，看到的结果和
  他做的事对不上。所以失败时抛出：这条消息不发，让用户重试。

  后端按 thread_id 幂等，重试同一条消息不会建出第二行。与上游同形
  （chat-page.tsx 的 ensureProjectThread）。
*/
const projectParam = computed(() => {
  const raw = route.query.project;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" && value.trim() ? value : null;
});

async function ensureProjectMembership(threadId: string) {
  const projectId = projectParam.value;
  if (!projectId) return;
  try {
    await createThread(threadId, projectId);
    void queryClient.invalidateQueries({
      queryKey: INFINITE_THREADS_QUERY_KEY_PREFIX,
    });
  } catch (error) {
    // 项目在页面打开之后被删/归档了也走这里。
    toast.error($i18n.t.value.projects.projectUnavailable);
    throw error;
  }
}

async function ensureThread() {
  if (isDemo.value)
    throw new Error($i18n.t.value.common.notAvailableInDemoMode);
  if (routeThreadId.value) return routeThreadId.value;
  if (preparedThreadId.value) return preparedThreadId.value;
  const created = await getAPIClient().threads.create({
    threadId: draftThreadId.value,
    assistantId: "lead_agent",
    metadata: props.agentName ? { agent_name: props.agentName } : {},
  });
  preparedThreadId.value = created.thread_id;
  threads.upsert(created);
  return created.thread_id;
}

async function send(
  text: string,
  files: FileInMessage[],
  options?: {
    onAccepted?: () => void;
    additionalKwargs?: Record<string, unknown>;
    signal?: AbortSignal;
    reportFailure?: boolean;
  },
) {
  if (isDemo.value) return false;
  /*
    上游三条提交路径都是 `setFollowups([]); setFollowupsHidden(false);
    setFollowupsLoading(false);`（input-box.tsx:1024 / 1091 / 1202）三件一起做。
    本仓原来只清数组：上一轮建议还在取的时候再发一条，「正在生成建议」那颗 chip
    会跟着新的流一路挂着。
  */
  followups.value = [];
  followupsLoading.value = false;
  mainTailRequest.value += 1;
  try {
    const targetThreadId = await ensureThread();
    await ensureProjectMembership(targetThreadId);
    const quotes = [...sidecar.conversationQuotes.value];
    const contexts = quotes.map((quote) => quote.context);
    const accepted = await stream.sendMessage(
      targetThreadId,
      { text, files },
      undefined,
      {
        ...(contexts.length || options?.additionalKwargs
          ? {
              ...(contexts.length
                ? { additionalInputMessages: [quotePrompt(contexts)] }
                : {}),
              additionalKwargs: {
                ...options?.additionalKwargs,
                ...(contexts.length
                  ? buildReferenceMessageMetadata(contexts)
                  : {}),
              },
            }
          : {}),
        signal: options?.signal,
        onAccepted: () => {
          if (quotes.length) sidecar.clearConversationQuotes();
          options?.onAccepted?.();
        },
      },
    );
    if (!accepted) return false;
    failedSend.value = null;
    return true;
  } catch (error) {
    if (options?.reportFailure !== false) {
      failedSend.value = {
        text,
        files,
        message:
          error instanceof Error
            ? error.message
            : $i18n.t.value.common.requestFailed,
      };
    }
    if (options) throw error;
    return false;
  }
}
async function retrySend() {
  const failed = failedSend.value;
  if (failed) await send(failed.text, failed.files);
}
async function respondHumanInput(
  request: HumanInputRequest,
  response: HumanInputResponse,
) {
  if (isDemo.value) return false;
  const targetThreadId = routeThreadId.value;
  if (!targetThreadId) return false;
  let accepted = false;
  const dispatched = await stream.sendMessage(
    targetThreadId,
    { text: buildHumanInputResponseText(request, response) },
    undefined,
    {
      additionalKwargs: {
        hide_from_ui: true,
        human_input_response: response,
      },
      onAccepted: () => {
        accepted = true;
      },
    },
  );
  return dispatched && accepted;
}

function updateContext(value: Record<string, unknown>) {
  updateThreadSettings("context", value);
}

async function stopRun() {
  suggestionGeneration.invalidate();
  suggestionController?.abort();
  suggestionController = null;
  followupsLoading.value = false;
  await stream.stop();
}
/*
  分支。上游 `chat-page.tsx:225` 把整段包在 try/catch 里，成功 `toast.success(
  branchCreated)`、失败 `toast.error(error.message ?? branchFailed)`。

  本仓此前**一个 catch 都没有**：`branchThreadFromTurn` 一抛，这个 async 函数就变成
  一条未处理的 rejection——没有跳转、没有任何提示，用户点了「分支」之后屏幕纹丝不动。
  两条词条 `conversation.branchCreated` / `branchFailed` 也因此一直躺在 unused 里。
*/
async function branch(messageId: string, messageIds: string[]) {
  if (isDemo.value) return;
  if (!routeThreadId.value) return;
  const original = threads.threads.find(
    (thread) => thread.thread_id === routeThreadId.value,
  );
  let result: Awaited<ReturnType<typeof branchThreadFromTurn>>;
  try {
    result = await branchThreadFromTurn(routeThreadId.value, {
      messageId,
      messageIds,
      title: original?.values.title,
    });
  } catch (error) {
    toast.error(
      error instanceof Error
        ? error.message
        : $i18n.t.value.conversation.branchFailed,
    );
    return;
  }
  const now = new Date().toISOString();
  threads.upsert({
    thread_id: result.thread_id,
    created_at: now,
    updated_at: now,
    metadata: props.agentName ? { agent_name: props.agentName } : {},
    status: "idle",
    values: {
      title: original?.values.title ?? $i18n.t.value.pages.untitled,
      messages: visibleMessages.value,
    },
    interrupts: {},
  });
  toast.success($i18n.t.value.conversation.branchCreated);
  const path = props.agentName
    ? `/workspace/agents/${encodeURIComponent(props.agentName)}/chats/${result.thread_id}`
    : `/workspace/chats/${result.thread_id}`;
  await router.push(path);
}
async function regenerate(messageId: string, messageIds: string[]) {
  if (isDemo.value) return;
  if (routeThreadId.value) {
    await stream.regenerateMessage(routeThreadId.value, messageId, messageIds);
  }
}
function beginEdit(messageId: string, text: string, messageIds: string[]) {
  if (isDemo.value) return;
  editState.value = { messageId, text, original: text, messageIds };
}
async function updateAndRerun() {
  if (isDemo.value) return;
  if (!routeThreadId.value || !editState.value) return;
  if (editSubmitDisabled.value) return;
  const pending = editState.value;
  editState.value = null;
  await stream.editAndRegenerateMessage(
    routeThreadId.value,
    pending.messageId,
    pending.text,
    pending.messageIds,
  );
}
function resetNewChat() {
  suggestionGeneration.invalidate();
  suggestionController?.abort();
  suggestionController = null;
  followupsLoading.value = false;
  followups.value = [];
  stream.resetView();
  preparedThreadId.value = null;
  draftThreadId.value = globalThis.crypto.randomUUID();
}
onMounted(() => globalThis.addEventListener("deerflow:new-chat", resetNewChat));
let bootstrapAgentName: string | null = null;
watch(
  [
    () => props.bootstrap,
    () => props.agentName,
    agentResolved,
    modelCatalog.loading,
    selectedModel,
  ],
  ([bootstrap, agentName, resolved, modelsLoading]) => {
    if (
      !bootstrap ||
      !agentName ||
      isDemo.value ||
      !resolved ||
      modelsLoading ||
      bootstrapAgentName === agentName
    ) {
      return;
    }
    bootstrapAgentName = agentName;
    bootstrapConversationReady.value = false;
    bootstrapConversationFinished.value = false;
    void send(
      $i18n.t.value.agents.nameStepBootstrapMessage.replace(
        "{name}",
        agentName,
      ),
      [],
    ).then((accepted) => {
      // Save may start only after the design conversation has fully released
      // the stream owner. Enabling it from onFinish is too early because
      // sendMessage still owns its single-flight guard until submit resolves.
      if (
        accepted &&
        bootstrapConversationFinished.value &&
        props.bootstrap &&
        props.agentName === agentName &&
        bootstrapAgentName === agentName
      ) {
        bootstrapConversationReady.value = true;
      }
    });
  },
  { immediate: true },
);
onMounted(async () => {
  if (!isDemo.value || !routeThreadId.value) return;
  try {
    const response = await globalThis.fetch(
      `/demo/threads/${encodeURIComponent(routeThreadId.value)}/thread.json`,
    );
    if (!response.ok) return;
    const fixture = (await response.json()) as {
      values?: { messages?: Message[]; artifacts?: string[]; title?: string };
    };
    demoMessages.value = fixture.values?.messages ?? [];
    demoArtifacts.value = fixture.values?.artifacts ?? [];
    demoTitle.value = fixture.values?.title;
  } catch {
    demoMessages.value = null;
  }
});
onMounted(async () => {
  if (!initialRouteThreadId || isDemo.value) return;
  /*
    只探 `GET /threads/{id}`：**它自己就带着 checkpoint 的 values**，再取一次
    `/state` 拿到的是同一份东西。

    这不是推断，是读后端加实测的结论。两个路由都走 `accessor.aget(config)` 取
    同一个最新快照，再用同一个 `serialize_channel_values_for_api` 序列化：
    `GET /{id}` 里的 `values=serialize_channel_values_for_api(snapshot.values)`
    与 `GET /{id}/state` 里的那一行逐字相同，连 accessor 都是同一个——
    `build_thread_checkpoint_state_accessor` 就是把 assistant_id 查出来再调
    `build_checkpoint_state_accessor`，而 `GET /{id}` 是把这两步内联了。
    实测（replay Gateway，写过一次 state 因而有 checkpoint 的线程）：两边的
    `values` 键集与 JSON 都完全相等。

    于是原先那句 `{ ...metadata.values, ...state.values }` 是拿一份值盖它自己，
    两条分支都是 no-op：
    - 有 checkpoint：两边同值，合并结果不变；
    - 没有 checkpoint（上下文压缩之后）：`/state` 404，`GET /{id}` 仍然 200
      并返回空快照的 values，合并结果同样不变。
    删掉之后每次打开线程少一次完全重复的往返。

    另外，`/state` 从来就没参与过「线程是否存在」的判断——那条判据在
    core/threads/thread-presence.ts 里，读的只有这一次元数据探测的错误码。
  */
  try {
    const metadata = await getAPIClient().threads.get(initialRouteThreadId);
    threads.upsert(metadata);
    threadPresence.value = {
      threadId: initialRouteThreadId,
      presence: "present",
    };
  } catch (error) {
    // 探测失败本身不构成「不存在」：只有 403/404 才是。其余错误留在 unknown，
    // 于是一次瞬时 5xx 不会把用户连人带对话踢回新会话。
    threadPresence.value = {
      threadId: initialRouteThreadId,
      presence: isThreadMissingError(error) ? "missing" : "unknown",
    };
  }
});
watch(
  [() => props.agentName, isDemo],
  async ([agentName, demo]) => {
    const request = ++agentRequest;
    agent.value = null;
    if (!agentName || demo) {
      agentResolved.value = true;
      return;
    }
    agentResolved.value = false;
    try {
      const resolvedAgent = await getAgent(agentName);
      if (request === agentRequest) agent.value = resolvedAgent;
    } catch {
      if (request === agentRequest) agent.value = null;
    } finally {
      if (request === agentRequest) agentResolved.value = true;
    }
  },
  { immediate: true },
);
onUnmounted(() =>
  globalThis.removeEventListener("deerflow:new-chat", resetNewChat),
);
onUnmounted(() => {
  agentRequest += 1;
  clearTimeout(completionNotificationTimer);
  suggestionGeneration.invalidate();
  suggestionController?.abort();
  suggestionController = null;
});
</script>

<template>
  <WorkspacePanels
    :open="panelOpen"
    :panel-size="artifactPanel.panelSize.value"
    :panel-padded="activePanel === 'artifacts'"
    :panel-description="$i18n.t.value.workspace.sidePanelDescription"
    :panel-label="
      activePanel === 'artifacts'
        ? $i18n.t.value.common.artifacts
        : activePanel === 'sidecar'
          ? $i18n.t.value.sidecar.title
          : $i18n.t.value.common.browser
    "
    @update:panel-size="artifactPanel.panelSize.value = $event"
    @collapse="
      activePanel === 'sidecar'
        ? sidecar.close()
        : activePanel === 'browser'
          ? (browserOpen = false)
          : artifactPanel.close()
    "
  >
    <template #main>
      <section id="chat" class="relative flex h-full min-h-0 flex-col">
        <!--
          `class` + `:class` 拼出来的冲突 Tailwind 类，赢家由样式表顺序决定而不是
          模板顺序，所以欢迎态那三条覆盖走 cn() 的 computed（headerClass），
          不写成第二个属性。z-index 与上游一致是 z-30：Vue 此前写的 z-40 会让头部
          压到 artifact/sidecar 面板那一档之上。
        -->
        <header :class="headerClass">
          <!--
            名字与状态都照 React 的 SidebarTrigger（frontend/src/components/ui/sidebar.tsx）：
            一个 sr-only 的 "Toggle Sidebar"，**没有** aria-expanded / aria-controls。
            侧栏在移动端是一个会被卸载的抽屉，触发器指着一个此刻并不存在的 id，
            aria-controls 是断的；expanded 也只能描述抽屉，描述不了桌面端的收起态。
          -->
          <!--
            这颗触发器带着 `md:hidden`——它**只在窄屏出现**，而窄屏抽屉的开合是
            `mobileOpen` 不是桌面的 `open`。此前传的是 `sidebarOpen`，于是图标恒定
            且指反：抽屉关着，按钮却画着「收起」。上游同一处是在组件里
            `isMobile ? openMobile : open`（已两边同改，sidebar.tsx:261）；本仓把这个
            选择留在调用点，因为 class 已经写死了这是哪个语境，不必再问一次视口。
          -->
          <SidebarTrigger
            v-if="!isDemo"
            :open="sidebarMobileOpen"
            :aria-label="$i18n.t.value.primitives.toggleSidebar"
            class="md:hidden"
            @click="toggleSidebar"
          />
          <div
            v-if="agentName"
            class="flex min-w-0 shrink-0 items-center gap-1.5 rounded-md border px-2 py-1"
          >
            <Bot :size="14" class="text-primary" />
            <span
              class="hidden max-w-24 truncate text-xs font-medium sm:inline sm:max-w-none"
            >
              {{ agent?.name ?? agentName }}
            </span>
          </div>
          <!--
            没有真实标题就**不渲染**任何文字，与 React 的 ThreadTitle 一致
            （frontend/src/components/workspace/thread-title.tsx 的
            `if (!thread.values?.title) return null`）。「新对话」只是标签页标题的
            兜底，不是这条会话的名字——把它画在头部，读屏器会把每一个空会话都念成
            一条叫「新对话」的记录。容器保留，占位由它负责。
          -->
          <div class="flex min-w-0 flex-1 items-center text-sm font-medium">
            <!--
              标题走 FlipDisplay，与上游 ThreadTitle 同构
              （frontend/src/components/workspace/thread-title.tsx 就是
              `<FlipDisplay uniqueKey={threadId}>`）。换线程时标题翻页式切换，
              而不是原地跳变。

              这一层因此**不再** `truncate`：上游的裁剪来自 FlipDisplay 自己的
              `relative overflow-hidden`，是直接切掉而不是省略号。省略号看着更好，
              但它会让两边在同一条长标题上画出不同的东西，而这一处并不是 React
              坏了——是它选的裁剪方式。
            -->
            <FlipDisplay v-if="headerTitle" :unique-key="routeThreadId ?? ''">
              {{ headerTitle }}
            </FlipDisplay>
          </div>
          <!--
            上游 `agents/[agent_name]/chats/[thread_id]/page.tsx:279` 是
            `<Tooltip content={t.agents.newChat}><Button className="px-2 sm:px-3"
            size="sm" variant="secondary">`。手写那版少的不只是焦点环：
            字号 `text-xs`（12px）而 Button base 是 `text-sm`（14px）、
            `gap-2`（8px）而 size-sm 是 `gap-1.5`（6px）、没有 `font-medium`、
            没有 Tooltip——窄屏下文字被 `hidden sm:inline` 收起来，
            那时它是一颗纯图标键，没有 Tooltip 就没有任何说明（同 wave 69 的
            ArtifactTrigger）。图标不传 `:size`，交给 buttonVariants 里的
            `[&_svg:not([class*='size-'])]:size-4`。
          -->
          <Tooltip v-if="agentName && !bootstrap" :delay-duration="500">
            <TooltipTrigger>
              <Button
                :aria-label="$i18n.t.value.agents.newChat"
                class="px-2 sm:px-3"
                size="sm"
                type="button"
                variant="secondary"
                @click="startAgentChat"
              >
                <PlusSquare />
                <span class="hidden sm:inline">{{
                  $i18n.t.value.agents.newChat
                }}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>{{ $i18n.t.value.agents.newChat }}</TooltipContent>
          </Tooltip>
          <!--
            右侧控件有一层分组容器，与上游 chat-page.tsx 同构：
            `<div class="flex shrink-0 items-center gap-2">`。它不改变横向节奏
            （标题是唯一的 flex-1，容器内外都是同样多个 gap-2），改变的是收缩行为——
            标题变长时缩的是标题，不是这排按钮。
          -->
          <div class="flex shrink-0 items-center gap-2">
            <!--
              后台任务排在这一组的最前，与上游 chat-page.tsx 的顺序一致
              （ThreadBackgroundTasks 在 ThreadScheduledTasksLink 上面）。

              条件是「已有会话、且不是只读案例」：新会话还没有 thread 可查，
              案例页那边没有 Gateway。能力开关由组件自己看（mcp_tasks 没开就整块
              不渲染），不在这里重复判一次——判两处迟早会分叉。
            -->
            <ThreadBackgroundTasks
              v-if="routeThreadId && !isDemo"
              :thread-id="routeThreadId"
            />
            <!-- 批次紧跟后台任务，与上游 chat-page.tsx 的顺序一致。 -->
            <ThreadSubagentBatches
              v-if="routeThreadId && !isDemo"
              :thread-id="routeThreadId"
            />
            <!--
              outline / sm 的按钮外观加一段 `hidden sm:inline` 的文字，不是一颗纯图标的
              方按钮：React 的 ThreadScheduledTasksLink 就是
              `<Button variant="outline" size="sm" asChild>` 包一个带同名 span 的链接
              （frontend/src/components/workspace/thread-scheduled-tasks-link.tsx）。
              两边的可访问名都来自 aria-label，所以这处差异在可访问性树上看不见——
              看得见的是宽屏上一个念得出名字的按钮 vs 一个只有图标的方块。
            -->
            <NuxtLink
              v-if="routeThreadId && !agentName && !isDemo"
              :to="`/workspace/scheduled-tasks?thread_id=${encodeURIComponent(routeThreadId)}`"
              :aria-label="$i18n.t.value.sidebar.scheduledTasks"
              :class="buttonVariants({ variant: 'outline', size: 'sm' })"
            >
              <CalendarClock :size="16" />
              <span class="hidden sm:inline">{{
                $i18n.t.value.sidebar.scheduledTasks
              }}</span>
            </NuxtLink>
            <!--
              上游这一对是 `tokenUsageEnabled ? <TokenUsageIndicator/> : <ContextUsageBadge/>`
              （chat-page.tsx:295），**没有** isMock 判据：只读案例页仍然把用量画出来，
              只是背后的 useThreadTokenUsage 被关掉，数字落在 "-" 上。本仓此前两支都挂
              `!isDemo`，于是案例页头部整块消失。
            -->
            <!--
              归档状态条排在用量指示之前——与上游 chat-page.tsx 的顺序一致
              （ThreadArchiveStatus 在 TokenUsageIndicator 上面）。
              未归档时它整块不渲染，所以这里不需要 v-if。
            -->
            <ThreadArchiveStatus
              v-if="routeThreadId"
              :thread-id="routeThreadId"
              :metadata="currentThread?.metadata"
            />
            <TokenUsageIndicator
              v-if="modelCatalog.tokenUsageEnabled.value"
              :thread-id="routeThreadId"
              :messages="visibleMessages"
              :pending-messages="pendingUsageMessages"
              :backend-usage="persistedTokenUsage"
              :context-usage="contextUsage"
              :enabled="modelCatalog.tokenUsageEnabled.value"
              :preferences="settings.tokenUsage"
              @preferences-change="updateThreadSettings('tokenUsage', $event)"
            />
            <ContextUsageBadge v-else :context-usage="contextUsage" />
            <!--
              保存 agent 走**页头右上角的 ⋯ 菜单**，不是工具条上一颗可见按钮。

              上游 `agents/new/page.tsx:309` 就是这个形状：header 右端一颗
              `variant="ghost" size="icon-sm"` 的 More 触发器（`aria-label`
              取 agents 那条 more），菜单里一个 `DropdownMenuItem` + `SaveIcon`。
              本仓原来是工具条上一颗手写 `<button>`（`rounded-md border px-3
              py-1.5 text-xs`）：既不是同一个位置，也不是同一个形状，还少了
              Button/DropdownMenuItem 那一整套焦点环、hover 与禁用表现。

              **决定性的证据是文案自己**：`agents.saveHint` 这句一次性提示
              （两个应用共用同一条上游文案）写的是「You can save this agent at
              any time from the top-right menu」——本仓照着它去找，右上角根本
              没有菜单。这不是「本仓更好」的取舍，是界面和它自己的说明打架。

              这一条同时把 agents 那条 more 词条接上：wave 28 记的「它在本仓
              永远没有消费点」到此结束。（未引用扫描器按叶子名匹配，`more`
              在 common 下有人用，所以它从来没进过 unused 集——数字不会变。）

              禁用判据不动，仍是本仓这四条。上游只用
              `[Boolean(agent), thread.isLoading, setupAgentStatus !== "idle"]`，
              少了「bootstrap 会话还没就绪」这一条；本仓的 useAgentCreationSession
              比上游多一个 verifying 态，多出来的判据是为了它。
            -->
            <DropdownMenu v-if="bootstrap">
              <DropdownMenuTrigger>
                <!--
                  `data-testid` 只给 e2e 定位用，不进 aria 快照：这一屏的侧栏里
                  有一排会话行的 More 键（common 那条 more，念作 "More"），
                  裸 `getByRole("button", { name: ... })` 在这种页面上是
                  strict-mode 的定时炸弹。
                -->
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  data-testid="agent-more"
                  :aria-label="$i18n.t.value.agents.more"
                >
                  <MoreHorizontal class="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  data-testid="agent-save"
                  :disabled="
                    !bootstrapConversationReady ||
                    stream.isStreaming.value ||
                    creationBusy ||
                    creation.status.value === 'created'
                  "
                  @select="saveAgent"
                >
                  <Save class="h-4 w-4" />
                  {{
                    creation.status.value === "verifying"
                      ? $i18n.t.value.agents.verifying
                      : creation.status.value === "created"
                        ? $i18n.t.value.agents.agentCreated
                        : creation.status.value === "saving" ||
                            stream.isStreaming.value
                          ? $i18n.t.value.agents.saving
                          : $i18n.t.value.agents.save
                  }}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <SidecarTrigger
              v-if="!isDemo && sidecar.sidecarThreadId.value && sidecarReady"
              :open="sidecar.open.value"
              :pending="sidecarReconciling"
              @toggle="toggleSidecar"
            />
            <BrowserTrigger
              v-if="browserEnabled"
              :open="activePanel === 'browser'"
              @toggle="toggleBrowser"
            />
            <!--
              导出**不按 isDemo 关掉**：上游是裸的 `<ExportTrigger threadId={threadId} />`
              （chat-page.tsx:312），只读案例页照样能把这条会话导出成 Markdown/JSON——
              导出是纯读，不写后端。本仓此前把它删掉，案例页因此少一颗按钮。
              （它要用 workspace toast，所以 showcase layout 也得挂上 toast owner，
              否则 useWorkspaceToast 直接抛错——这就是当初顺手删掉它的原因。）
            -->
            <ExportTrigger
              v-if="routeThreadId && currentThread && !isWelcomeMode"
              :thread-id="routeThreadId"
              :thread="currentThread"
              :messages="visibleMessages"
            />
            <ArtifactTrigger
              :count="artifactPanel.artifacts.value.length"
              @open="showArtifacts"
            />
          </div>
        </header>
        <!--
          内层还有一个 main：React 的 SidebarInset 是外层 main，ChatPage 自己再开一个
          （frontend/src/components/workspace/chats/chat-page.tsx）。头部浮在上面、
          不属于对话本身，所以 main 从消息流开始——读屏器的「跳到主内容」应当落在对话，
          而不是落在标题栏。
        -->
        <main class="flex min-h-0 max-w-full grow flex-col">
          <div v-if="showSaveHint" class="px-4 pt-4">
            <div class="mx-auto w-full max-w-[var(--container-width-md)]">
              <Alert>
                <Info class="h-4 w-4" />
                <AlertDescription>{{
                  $i18n.t.value.agents.saveHint
                }}</AlertDescription>
              </Alert>
            </div>
          </div>
          <MessageList
            :class="isWelcomeMode ? '' : showSaveHint ? 'pt-4' : 'pt-10'"
            :messages="visibleMessages"
            :raw-messages="demoMessages ?? stream.messages.value"
            :streaming="stream.isStreaming.value"
            :loading="stream.isHistoryLoading.value"
            :thread-id="routeThreadId"
            :artifact-paths="artifactPanel.artifacts.value"
            :is-mock="isDemo"
            :is-admin="isAdmin"
            :subtasks="stream.subtasks.value"
            :active-run-id="stream.activeRunId.value"
            :has-more-history="stream.hasMoreHistory.value"
            :history-loading-more="stream.isHistoryLoadingMore.value"
            :history-error="stream.historyError.value"
            :thread-error="stream.error.value"
            :submit-human-input="respondHumanInput"
            :token-usage-inline-mode="
              modelCatalog.tokenUsageEnabled.value
                ? settings.tokenUsage.inlineMode
                : 'off'
            "
            :tail-request="mainTailRequest"
            :interactive="!isDemo"
            selection-mode="main"
            test-id="main-message-list"
            enable-conversation-outline
            @artifact="openArtifact"
            @browser="openBrowserFrame"
            @selection-ask="askInSidecar"
            @selection-add="addToConversation"
            @branch="branch"
            @regenerate="regenerate"
            @edit="beginEdit"
            @human-input="respondHumanInput"
            @load-more-history="stream.loadMoreHistory()"
          />
          <div
            v-if="editState"
            class="border-border bg-background absolute right-0 bottom-36 left-0 z-40 mx-auto w-full max-w-xl rounded-xl border p-3 shadow-lg"
          >
            <!--
              走 `ui/textarea`，不要手写。上游这一处是
              `message-list-item.tsx:525` 的 `<Textarea autoFocus className="min-h-24 resize-y">`。
              手写那版丢掉的是焦点环（`focus-visible:ring-[3px]`）、无效态
              （`aria-invalid:`）、禁用态样式与深色主题 token，而且**打开就自动聚焦**
              这一条也没有：用户点「编辑」之后还得再点一次输入框才能改。
            -->
            <Textarea
              v-model="editState.text"
              autofocus
              class="min-h-24 resize-y"
            />
            <!--
              「改完重跑会丢掉这一轮之后的消息」这句提醒，上游写在输入框与两颗按钮
              之间（message-list-item.tsx:530）。本仓此前没有——用户按下
              「Update and rerun」之前看不到任何关于后果的说明，而这是一个**会丢内容**
              的操作。`common.editRerunWarning` 也因此一直躺在 unused 里。
            -->
            <p class="text-muted-foreground mt-2 text-xs">
              {{ $i18n.t.value.common.editRerunWarning }}
            </p>
            <!--
              上游 `message-list-item.tsx:532` 两颗都是 `<Button size="sm">`，
              各带一颗 12px 图标（`XIcon` / `CheckIcon`），间距 `gap-1`。
              手写那版没有图标、圆角是 `rounded`（4px）而不是 size-sm 的
              `rounded-md`（6px）、没有 hover 也没有禁用态。
            -->
            <div class="mt-2 flex justify-end gap-1">
              <Button
                size="sm"
                type="button"
                variant="ghost"
                @click="editState = null"
              >
                <X class="size-3" />
                {{ $i18n.t.value.common.cancel }}
              </Button>
              <Button
                size="sm"
                type="button"
                :disabled="editSubmitDisabled"
                @click="updateAndRerun"
              >
                <Check class="size-3" />
                {{ $i18n.t.value.common.updateAndRerun }}
              </Button>
            </div>
          </div>
          <!--
            **正在重试**是一段持续为真的状态，不是一次播报，所以它留在页面里而不是
            走 toaster（判据写在 failedSend 的声明上）。上游是每个 llm_retry 事件
            一条 toast（`core/threads/hooks.ts:1835`），一次重试风暴会堆出一摞，
            而且「已经不在重试了」这件事那边没有出口。
          -->
          <p
            v-if="stream.llmRetry.value"
            data-testid="llm-retry-status"
            role="status"
            class="absolute right-4 bottom-48 z-40 max-w-md rounded-lg bg-blue-50 px-4 py-2 text-sm text-blue-700 shadow"
          >
            {{ stream.llmRetry.value.message }}
          </p>
          <!--
            **这条只剩「发失败了，可以再试一次」一种情况**（判据写在 failedSend 的
            声明上）。此前它还兼着 replay gap 与流错误的播报，那两条现在走 toaster。

            带 data-testid 是因为它**不是** aria 上唯一的 role="status"：
            工具条里的 ContextUsageBadge 永远在（占位态也带 role="status"），
            流式输出期间 MessageList 还会再挂一条 RunActivity。裸
            `getByRole("status")` 会先命中徽标、再撞上 strict mode。
          -->
          <p
            v-if="failedSend"
            data-testid="send-failure"
            role="status"
            class="absolute right-4 bottom-36 z-40 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-700 shadow"
          >
            {{ failedSend.message }}
            <button type="button" class="ml-2 underline" @click="retrySend">
              {{ $i18n.t.value.navigation.tryAgain }}
            </button>
          </p>
          <div
            v-if="bootstrap && creation.status.value === 'error'"
            data-testid="agent-creation-error"
            role="alert"
            class="absolute right-4 bottom-36 left-4 z-40 mx-auto max-w-xl rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 shadow"
          >
            <strong>{{ $i18n.t.value.agents.creationError }}:</strong>
            {{ creation.error.value }}
            <button
              type="button"
              class="ml-2 underline"
              @click="creation.retry"
            >
              {{ $i18n.t.value.agents.retry }}
            </button>
          </div>
          <div
            class="right-0 bottom-0 left-0 z-30 flex justify-center px-3 sm:px-4"
            :class="isWelcomeMode ? 'absolute' : 'relative shrink-0 pb-4'"
          >
            <!--
            欢迎态把输入框抬到视口中线：窄屏减 48px、sm 以上减 96px，与 React 的
            `-translate-y-[calc(50vh-48px)] sm:-translate-y-[calc(50vh-96px)]` 同一组
            数字。只写 96px 的话，窄屏上输入框会比 React 低 48px——两边看起来是同一个
            布局，量出来不是。
          -->
            <div
              class="relative w-full"
              :class="[
                isWelcomeMode
                  ? 'max-w-[var(--container-width-sm)] -translate-y-[calc(50vh-48px)] sm:-translate-y-[calc(50vh-96px)]'
                  : 'max-w-[var(--container-width-md)]',
              ]"
            >
              <section
                v-if="
                  bootstrap &&
                  creation.status.value === 'created' &&
                  creation.agent.value
                "
                data-testid="agent-created"
                class="bg-background mx-auto w-full max-w-lg rounded-xl border p-6 text-center shadow-sm"
              >
                <!--
                  上游 `agents/new/page.tsx:424` 画的是
                  `<CheckCircleIcon className="text-primary h-10 w-10" />`
                  ——lucide 里 `CheckCircleIcon` 解析到 **`CircleCheckBig`**
                  （wave 69 在 SubtaskCard 上踩过同一对别名）。
                  此前这里是文字字符 `✓`（U+2713）撑成 `text-3xl`：
                  尺寸 30px 对 40px，颜色继承正文而不是 `text-primary`，
                  字形还随系统字体变。`aria-hidden` 两边一致，所以
                  aria 快照与对照台账都看不见这一处。
                -->
                <CircleCheckBig
                  class="text-primary mx-auto h-10 w-10"
                  aria-hidden="true"
                />
                <h2 class="mt-2 text-xl font-semibold">
                  {{ $i18n.t.value.agents.agentCreated }}
                </h2>
                <p class="text-muted-foreground mt-2 text-sm">
                  {{ creation.agent.value.name }} ·
                  {{ creation.agent.value.description }}
                </p>
                <div class="mt-5 flex flex-wrap justify-center gap-2">
                  <NuxtLink
                    :to="`/workspace/agents/${encodeURIComponent(creation.agent.value.name)}/chats/new`"
                    class="bg-primary text-primary-foreground rounded-md px-3 py-2 text-sm"
                  >
                    {{ $i18n.t.value.agents.startChatting }}
                  </NuxtLink>
                  <NuxtLink
                    to="/workspace/agents"
                    class="rounded-md border px-3 py-2 text-sm"
                  >
                    {{ $i18n.t.value.agents.backToGallery }}
                  </NuxtLink>
                </div>
              </section>
              <!--
                上游 agents/new/page.tsx 整个创建流程都没有 follow-up 建议这一层
                （见它的完整 return，没有 Suggestions 组件），不分「还没建出来」还是
                「已建成」。原来这里只在已建成时隐藏，于是引导对话期间也会冒出建议
                chip，而它是个死按钮：`ref="composer"` 只挂在下面的 ChatComposer 上，
                bootstrap 时那一支不渲染，于是 `composer` 是 **null**，
                `composer?.offerFollowup(...)` 被可选链吞掉——不是「ref 指向了没有这个
                方法的组件」，AgentBootstrapComposer 根本没有接这个 ref。
                bootstrap 是每个实例上的常量，所以直接并进 v-if，不留隐藏 DOM。
              -->
              <!--
                显示判据逐条对着上游 `showFollowups`（input-box.tsx:1981）：
                `!disabled && !isWelcomeMode && !showSkillSuggestions &&
                 !selectedSlashSkill && !followupsHidden && status !== "streaming" &&
                 (followupsLoading || followups.length > 0)`。

                逐条对应关系：
                - `!disabled` → `!isDemo`（composer 拿到的 `disabled` 就是它）。
                  本仓这一条目前**够不着**——followup 只在 refreshPostRun 里取，而
                  它挂在 onFinish 上，只读线程从来不跑 run。留着是为了两边的判据同形，
                  也为了以后真出现「可读不可写」的态时不会漏。
                - `!showSkillSuggestions && !selectedSlashSkill` → `!followupsSuppressed`，
                  由 composer 发上来（chip 画在 composer **外面**，看不见这两样）。
                - `!followupsHidden` → 本仓的关闭键直接 `followups = []`，等价：
                  上游留着数组只是为了下一批到达时用 `setFollowupsHidden(false)` 复位，
                  而本仓下一批到达时本来就会重新赋值。
                - `status !== "streaming"` → `!stream.isStreaming.value`。**这一条此前
                  真的缺**：`send()` 只清 `followups`、不清 `followupsLoading`，所以在
                  上一轮建议还没取回来时再发一条，「正在生成建议」那颗 chip 会一直挂在
                  新的流上面（上游用这一条与提交时的 `setFollowupsLoading(false)` 挡了两道）。
                - `!bootstrap` 是本仓独有的一条，理由见下面那段注释。
              -->
              <div
                v-if="
                  !bootstrap &&
                  !isDemo &&
                  !isWelcomeMode &&
                  !followupsSuppressed &&
                  !stream.isStreaming.value &&
                  (followupsLoading || followups.length > 0)
                "
                data-slot="suggestions-list"
                class="mb-2 flex w-full flex-wrap justify-center gap-2"
              >
                <span
                  v-if="followupsLoading"
                  class="text-muted-foreground bg-background/80 rounded-full border px-4 py-1.5 text-xs backdrop-blur-sm"
                >
                  {{ $i18n.t.value.inputBox.followupLoading }}
                </span>
                <!--
                  上游 `input-box.tsx:2131` 两颗都走 Button：建议 chip 是
                  `<Suggestion>`（= `variant="outline" size="sm"` 加
                  `h-auto rounded-full px-4 py-2 text-xs font-normal
                  whitespace-normal dark:bg-background`），关闭键是
                  `<Button variant="outline" size="sm" class="h-auto rounded-full
                  px-2.5 py-1.5 text-xs font-normal"><XIcon class="size-4" /></Button>`。

                  **关闭键此前画的是文字 `×`**（U+00D7 乘号），不是 lucide `X`——
                  跟着正文字体渲染，字形、字重、光学重心都和 16px 的图标不是一回事。
                  这条 aria 看不见（两边可访问名都是 `common.close`）。
                  chip 的内边距也差一档：`px-3 py-1.5` 对上游 `px-4 py-2`。
                -->
                <Button
                  v-for="suggestion in followups"
                  :key="suggestion"
                  class="text-muted-foreground dark:bg-background h-auto max-w-full rounded-full px-4 py-2 text-center text-xs font-normal whitespace-normal"
                  size="sm"
                  type="button"
                  variant="outline"
                  @click="composer?.offerFollowup(suggestion)"
                >
                  {{ suggestion }}
                </Button>
                <Button
                  v-if="followups.length"
                  :aria-label="$i18n.t.value.common.close"
                  class="text-muted-foreground h-auto rounded-full px-2.5 py-1.5 text-xs font-normal"
                  size="sm"
                  type="button"
                  variant="outline"
                  @click="followups = []"
                >
                  <X class="size-4" />
                </Button>
              </div>
              <TodoList
                v-if="
                  authoritativeTodos.length &&
                  !(bootstrap && creation.status.value === 'created')
                "
                :todos="authoritativeTodos"
                class="mb-2"
              />
              <!--
                创建 agent 还没建出来的这一步，上游用的是裸的
                `PromptInput` + `PromptInputTextarea` + `PromptInputSubmit`
                （frontend/src/app/workspace/agents/new/page.tsx:434），没有附件、
                语音、润色、模式/模型选择器——`onSubmit` 也只读文本，`files` 恒为
                空数组。本仓原来这段期间用的是完整 ChatComposer，于是创建 agent 时
                比上游多出一整排控件。AgentBootstrapComposer 补的就是这一段最简界面，
                发送仍然经同一个 `send()`。
              -->
              <AgentBootstrapComposer
                v-if="bootstrap && creation.status.value !== 'created'"
                :disabled="stream.isStreaming.value"
                @send="(text) => void send(text, [])"
              />
              <ChatComposer
                v-else-if="!bootstrap"
                ref="composer"
                :surface-class="
                  isWelcomeMode ? '-translate-y-2 sm:-translate-y-4' : ''
                "
                :thread-key="routeThreadId ?? 'new'"
                :target-thread-id="routeThreadId ?? draftThreadId"
                :user-id="currentUserId"
                :agent-name="agentName"
                :default-model-name="agent?.model"
                :model-selection-ready="agentResolved"
                :streaming="stream.isStreaming.value"
                :errored="stream.error.value !== null"
                :uploading="localUploading"
                :is-welcome="isWelcomeMode"
                :auto-focus="initialRouteThreadId === null"
                :show-welcome-suggestions="route.query.mode !== 'skill'"
                :prompt-history="promptHistory"
                :ensure-thread="ensureThread"
                :submit-message="send"
                :references="sidecar.conversationQuotes.value"
                :context="context"
                :goal="activeGoal"
                :disabled="isDemo"
                @send="send"
                @stop="stopRun"
                @uploading-change="
                  localUploading = $event;
                  stream.isUploading.value = $event;
                "
                @followups-suppressed-change="followupsSuppressed = $event"
                @clear-references="sidecar.clearConversationQuotes()"
                @context-change="updateContext"
                @goal-change="localGoal = $event"
              >
                <!--
                  欢迎语浮在输入框上方、不占布局。**它必须挂在输入框内部**，
                  上游正是这么做的（`extraHeader` 传进 PromptInput，
                  frontend/src/components/workspace/input-box.tsx:2220）：
                  那对 absolute 容器由 ComposerSurface 提供，外层零高度锚贴住
                  surface 上边线、内层 bottom-0 把内容底边顶到那条线上。

                  **wave 67 之前这一块是输入框的兄弟节点**，于是零高度锚贴的是外层
                  布局容器而不是输入框，实测整块低 15px 并压进输入框（React 段落底
                  到输入框顶 28px，本仓只有 13px），宽度也差 2px 导致段落少折一行。
                  判据与实测都记在 ComposerSurface.vue 的注释里。
                -->
                <template
                  v-if="
                    isWelcomeMode &&
                    !(bootstrap && creation.status.value === 'created')
                  "
                  #extraHeader
                >
                  <!--
                    agent 会话页与普通聊天页的欢迎区是**两个不同的东西**，上游也是
                    两个组件（`AgentWelcome` vs `Welcome`）。同一个 AgentChat 服务两条
                    路由，所以这一支要显式分开；此前只有通用那一支，打开自定义 agent
                    的新会话时读到的是「👋 Hello, again!」而不是 agent 自己的名字。

                    **不带定位 class**：上游把 AgentWelcome 原样交给 extraHeader
                    （agents/[agent_name]/chats/[thread_id]/page.tsx:417），
                    定位由那对容器负责。
                  -->
                  <AgentWelcome
                    v-if="agentName"
                    :agent="agent"
                    :agent-name="agentName"
                  />
                  <!--
                    根类逐字对上游 Welcome 的根（welcome.tsx:42）。
                  -->
                  <div
                    v-else
                    class="mx-auto flex w-full max-w-full flex-col items-center justify-center gap-2 px-4 py-4 text-center sm:px-8"
                  >
                    <!--
                      技能创建入口（?mode=skill）整段换掉标题与说明，上游
                      welcome.tsx:48 与 :59 是两处独立的三元。本仓原来只有通用那一支，
                      于是从设置页点「创建技能」跳过来，屏幕上仍然写着
                      「👋 Hello, again!」——`welcome.createYourOwnSkill` 与
                      `welcome.createYourOwnSkillDescription` 两条词条一直零消费，
                      缺的就是这里。

                      判据只看 query，与上游一致（它读 searchParams，不看 thread_id）；
                      欢迎区本身已经被 isWelcomeMode 那一层挡住了。
                    -->
                    <div class="max-w-full text-2xl font-bold">
                      <template v-if="skillWelcome">
                        ✨ {{ $i18n.t.value.welcome.createYourOwnSkill }} ✨
                      </template>
                      <!--
                        这个 👋 **不能** aria-hidden：React 的 Welcome 把它当成正文
                        （welcome.tsx 里它只是一个普通 div），于是读屏器读到的是
                        「👋 Hello, again!」。藏掉它，两边听到的欢迎语就不是同一句。

                        ultra 档换成 🚀，与金色 welcomeColors 是同一个判据（上游
                        welcome.tsx:53 的 `isUltra ? "🚀" : "👋"`）。本仓原来只换了
                        颜色，于是 ultra 会话的欢迎语颜色变了、表情没变。
                      -->
                      <div
                        v-else
                        class="flex max-w-full flex-wrap items-center justify-center gap-2"
                      >
                        <!--
                          挥手一次。上游 `welcome.tsx` 用一个**模块级**的 `waved`
                          标志（`useEffect` 里置 true），所以整个页面生命周期里只有
                          第一次挂载会挥；本仓照同一套语义。
                          动效走 `motion-safe:`——0.6s×2 的纯装饰，减动偏好下不播；
                          表情本身照常渲染，收住的只是动作。
                          （这个 👋 不能 aria-hidden，理由见上面那段。）
                        -->
                        <span
                          class="inline-block"
                          :class="hasWaved ? '' : 'wave-once'"
                          >{{ isUltraWelcome ? "🚀" : "👋" }}</span
                        >
                        <AuroraText :colors="welcomeColors">
                          {{ $i18n.t.value.welcome.greeting }}
                        </AuroraText>
                      </div>
                    </div>
                    <!--
                      说明段落也照上游分两层：外层给颜色与字号，内层 `<p>` 给折行
                      规则（welcome.tsx:14 的 `max-w-full text-wrap break-words
                      whitespace-pre-line`）。本仓原来把两层并成一个 `<p>` 并且漏了
                      `text-wrap break-words`。
                    -->
                    <div class="text-muted-foreground max-w-full text-sm">
                      <p
                        class="max-w-full text-wrap break-words whitespace-pre-line"
                      >
                        {{
                          skillWelcome
                            ? $i18n.t.value.welcome
                                .createYourOwnSkillDescription
                            : $i18n.t.value.welcome.description
                        }}
                      </p>
                    </div>
                  </div>
                </template>
              </ChatComposer>
            </div>
          </div>
        </main>
      </section>
    </template>
    <template #panel>
      <ArtifactOverview
        v-if="
          activePanel === 'artifacts' &&
          routeThreadId &&
          !artifactPanel.selectedArtifact.value
        "
        :thread-id="routeThreadId"
        :artifacts="artifactPanel.artifacts.value"
        :is-mock="isDemo"
        :is-admin="isAdmin"
        @close="artifactPanel.close()"
        @select="openArtifact($event)"
      />
      <ArtifactPanel
        v-if="
          activePanel === 'artifacts' &&
          routeThreadId &&
          artifactPanel.selectedArtifact.value
        "
        :thread-id="routeThreadId"
        :selected="artifactPanel.selectedArtifact.value"
        :artifacts="artifactPanel.artifacts.value"
        :opened-presented-artifacts="
          artifactPanel.openedPresentedArtifacts.value
        "
        :messages="demoMessages ?? stream.messages.value"
        :streaming="stream.isStreaming.value"
        :is-mock="isDemo"
        :is-admin="isAdmin"
        :draft-owner="artifactPanel.draftOwner"
        @close="artifactPanel.close()"
        @select="artifactPanel.select($event)"
      />
      <SidecarPanel
        v-if="routeThreadId && activePanel === 'sidecar'"
        :session="sidecarSession"
        :references="sidecar.activeReferences.value"
        :context="sidecar.context"
        :active="activePanel === 'sidecar'"
        @update:context="sidecar.setContext($event)"
        @clear-references="sidecar.clearActiveReferences()"
        @add-reference="sidecar.openContext($event)"
        @close="sidecar.close()"
        @discard="sidecar.clearThreadAndClose()"
        @deleted="sidecar.clearThreadAndClose()"
      />
      <BrowserPanel
        v-if="routeThreadId && activePanel === 'browser'"
        :key="routeThreadId"
        :thread-id="routeThreadId"
        :active="activePanel === 'browser'"
        :frame="browserFrame"
        @frame="acceptBrowserFrame"
        @close="browserOpen = false"
      />
    </template>
  </WorkspacePanels>
</template>

<style scoped>
@media (prefers-reduced-motion: no-preference) {
  .wave-once {
    animation: wave 0.6s ease-in-out 2;
  }
}

@keyframes wave {
  0%,
  100% {
    transform: rotate(0deg);
  }
  25% {
    transform: rotate(20deg);
  }
  50% {
    transform: rotate(0deg);
  }
  75% {
    transform: rotate(20deg);
  }
}
</style>
