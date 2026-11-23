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
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import AuroraText from "@/components/ui/effects/AuroraText.vue";
import { provideFocusReveal } from "@/components/ui/scroll-area/focus-reveal";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import ContextUsageBadge from "@/components/workspace/ContextUsageBadge.vue";
import ThreadArchiveStatus from "@/components/workspace/ThreadArchiveStatus.vue";
import ProjectAffiliationBadge from "@/components/workspace/ProjectAffiliationBadge.vue";
import ThreadBackgroundTasks from "@/components/workspace/ThreadBackgroundTasks.vue";
import ThreadSubagentBatches from "@/components/workspace/ThreadSubagentBatches.vue";
import GoalStatus from "@/components/workspace/GoalStatus.vue";
import { Suggestion, Suggestions } from "@/components/ui/suggestion";
import TodoList from "@/components/workspace/TodoList.vue";
import TokenUsageIndicator from "@/components/chat/TokenUsageIndicator.vue";
import WorkspacePanels from "@/components/workspace/WorkspacePanels.vue";
import ArtifactOverview from "@/components/workspace/artifacts/ArtifactOverview.vue";
import ArtifactTrigger from "@/components/workspace/artifacts/ArtifactTrigger.vue";

import BrowserTrigger from "@/components/workspace/browser-view/BrowserTrigger.vue";
import ExportTrigger from "@/components/workspace/ExportTrigger.vue";
import ConversationExtensionActions from "@/components/workspace/extensions/ConversationExtensionActions.vue";
import ThreadScheduledTasksButton from "@/components/workspace/ThreadScheduledTasksButton.vue";
import {
  useScheduleToolResultRefresh,
  useThreadScheduledTaskEvents,
} from "@/composables/useThreadScheduledTasks";
import MessageDetailsPanel from "@/components/workspace/message-details/MessageDetailsPanel.vue";

import SidecarTrigger from "@/components/workspace/sidecar/SidecarTrigger.vue";
import { useChatPanels } from "@/composables/useChatPanels";
import { useChatConversationActions } from "@/composables/useChatConversationActions";
import { useAgentCreationSession } from "@/composables/useAgentCreationSession";
import { useChatAgent } from "@/composables/useChatAgent";
import { useThreadStream } from "@/composables/useThreadStream";
import { useShowcaseThreadState } from "@/composables/useShowcaseThreadState";
import { useThreadMetadata } from "@/composables/useThreadMetadata";
import { useMarkOpenThreadRead } from "@/composables/useThreadActivity";
import { useActiveThreadRun } from "@/composables/useActiveThreadRun";
import {
  useChatThreadOwner,
  type ChatSubmissionOwner,
} from "@/composables/useChatThreadOwner";
import KnowledgeScopeSelector from "@/components/workspace/KnowledgeScopeSelector.vue";
import { provideKnowledgeSources } from "./knowledge-sources-context";
import {
  useBrowserControlEnabled,
  useKnowledgeBaseEnabled,
} from "@/composables/useWorkspaceFeatures";
import { useConversationKnowledgeScope } from "@/composables/useConversationKnowledgeScope";
import {
  buildComposerUploadMessages,
  type ComposerUploadSnapshot,
} from "@/core/threads/composer-submit";
import { useThreads } from "@/composables/useThreads";
import { useNotifications } from "@/composables/useNotifications";
import { useSuggestionsConfig } from "@/composables/useSuggestionsConfig";
import { hasPermission, PERMISSIONS } from "@/core/auth/permissions";
import { useAuthSession } from "@/composables/useAuthSession";
import { useWorkspaceSidebar } from "@/composables/useWorkspaceSidebar";
import { useModels } from "@/composables/useModels";
import { useThreadSettings } from "@/composables/useThreadSettings";
import { useThreadTokenUsage } from "@/composables/useThreadTokenUsage";
import { documentTitleOfThread, projectIdOfThread } from "@/core/threads/utils";
import { threadMetadataQueryKey } from "@/core/threads/metadata";
import { INFINITE_THREADS_QUERY_KEY_PREFIX } from "@/core/threads/infinite";
import { isHiddenFromUIMessage, textOfMessage } from "@/core/messages/utils";
import { notificationBody } from "@/core/notification/body";
import {
  AUTH_DISABLED_USER,
  isAuthDisabledMode,
} from "@/core/auth/auth-disabled-user";
import { safeLocalStorage } from "@/core/settings/local";
import { useWorkspaceToast } from "@/core/workspace-shell/toast";
import type { Message } from "@/core/types/message";
import {
  selectContextUsage,
  threadTokenUsageToTokenUsage,
} from "@/core/threads/token-usage";
import {
  shouldLeaveMissingThread,
  type ThreadPresence,
} from "@/core/threads/thread-presence";
import type { AgentThread, GoalState } from "@/core/threads/types";
import type { Todo } from "@/core/todos";
import { getAgent } from "@/core/agents/api";
import { buildAgentSaveSubmission } from "@/core/agents/creation-session";
import { displayNameOfAgent } from "@/core/agents/presentation";
import { agentKeys } from "@/core/agents/query-keys";
import type { Agent } from "@/core/agents/types";
import { resolveComposerModel } from "@/core/models/capabilities";
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

const BrowserPanel = defineAsyncComponent({
  loader: () => import("@/components/workspace/browser-view/BrowserPanel.vue"),
  loadingComponent: RightPanelLoading,
  delay: 0,
});
const SidecarPanel = defineAsyncComponent({
  loader: () => import("@/components/workspace/sidecar/SidecarPanel.vue"),
  loadingComponent: RightPanelLoading,
  delay: 0,
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
const { $i18n, $routeAnnouncements } = useNuxtApp();
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
const permissionUser = computed(() =>
  auth.session.value?.tag === "authenticated" ? auth.session.value.user : null,
);
const canCreateRuns = computed(() =>
  hasPermission(permissionUser.value, PERMISSIONS.RUNS_CREATE),
);
const canStopStreaming = computed(() =>
  hasPermission(permissionUser.value, PERMISSIONS.RUNS_CANCEL),
);
const currentUserId = computed(() => {
  const session = auth.session.value;
  return session?.tag === "authenticated"
    ? session.user.id
    : authDisabled
      ? AUTH_DISABLED_USER.id
      : null;
});
const isAdmin = computed(() => {
  const session = auth.session.value;
  return session?.tag === "authenticated"
    ? session.user.system_role === "admin"
    : authDisabled && AUTH_DISABLED_USER.system_role === "admin";
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
const projectParam = computed(() => {
  const raw = route.query.project;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" && value.trim() ? value : null;
});
const submissionOwner = useChatThreadOwner({
  observation: {
    surface: props.agentName ? "agent" : "main",
    path: () => route.path,
    mock: isDemo,
  },
  threadId: routeThreadId,
  projectId: projectParam,
  userId: currentUserId,
  agentName: () => props.agentName,
  onCreated: (created) => {
    queryClient.setQueryData(
      threadMetadataQueryKey(created.thread_id),
      created,
    );
    threads.upsert(created);
    void queryClient.invalidateQueries({
      queryKey: INFINITE_THREADS_QUERY_KEY_PREFIX,
    });
  },
  onProjectUnavailable: () =>
    toast.error($i18n.t.value.projects.projectUnavailable),
});
const { draftThreadId, preparedThreadId, consumptionObservation } =
  submissionOwner;
const { agent, resolved: agentResolved } = useChatAgent({
  agentName: () => props.agentName,
  bootstrap: () => props.bootstrap,
  demo: isDemo,
  userId: currentUserId,
  queryClient,
});
const knowledgeFeature = useKnowledgeBaseEnabled();
const knowledgeSelectorVisible = computed(
  () => knowledgeFeature.scopeSelectionEnabled.value && !isDemo.value,
);
const {
  selection: knowledgeScope,
  snapshot: currentKnowledgeScopeSnapshot,
  agentKnowledgeEnabled,
} = useConversationKnowledgeScope({
  userId: currentUserId,
  agentName: () => props.agentName,
  conversationId: () => routeThreadId.value ?? draftThreadId.value,
  isNewConversation: () => routeThreadId.value === null,
  visible: knowledgeSelectorVisible,
  agent,
});
// The pre-created UUID already isolates account/agent/new-session owners.
// Keep the real thread ID as React's persisted model-override identity.
const settingsScope = computed(
  () => routeThreadId.value ?? draftThreadId.value,
);
const {
  settings,
  update: updateThreadSettings,
  resolve: resolveThreadSettings,
} = useThreadSettings(settingsScope);
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
const uploadPreview = ref<{
  owner: ChatSubmissionOwner;
  snapshot: ComposerUploadSnapshot;
} | null>(null);
function onComposerUploading(
  value: boolean,
  snapshot?: ComposerUploadSnapshot,
) {
  localUploading.value = value;
  stream.isUploading.value = value;
  uploadPreview.value =
    value && snapshot ? { owner: submissionOwner.capture(), snapshot } : null;
}
watch(
  [currentUserId, () => props.agentName, routeThreadId],
  () => {
    if (
      uploadPreview.value &&
      !submissionOwner.owns(uploadPreview.value.owner)
    ) {
      onComposerUploading(false);
    }
  },
  { flush: "sync" },
);
const showcaseState = useShowcaseThreadState(isDemo, routeThreadId);
const demoMessages = computed(() =>
  isDemo.value ? (showcaseState.value.messages ?? []) : null,
);
const demoArtifacts = computed(() => showcaseState.value.artifacts ?? []);
const demoTitle = computed(() => showcaseState.value.title);
const demoTodos = computed(() => showcaseState.value.todos ?? []);
const authoritativeToolArtifacts = computed(() =>
  isDemo.value
    ? showcaseState.value.tool_artifacts
    : stream.state.value.tool_artifacts,
);
/* composer 里正开着斜杠目录、或挂着一个技能 chip。见 ChatComposer 的同名 emit。 */
const followupsSuppressed = ref(false);
const suggestionsConfigQuery = useSuggestionsConfig({
  enabled: computed(() => !isDemo.value && !props.bootstrap),
});
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
const threadTokenUsageQuery = useThreadTokenUsage(routeThreadId, {
  enabled: computed(() => !isDemo.value),
});
const threadTokenUsage = threadTokenUsageQuery.usage;
const contextUsage = computed(() => selectContextUsage(threadTokenUsage.value));
/*
  Model catalog remains readable in showcase mode, matching React chat-page.tsx useModels.
  Token indicators and composer model/mode controls need names even when runs are disabled.
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
/**
 * `GET /threads/{id}` 的探测结果，和它属于哪个 thread 绑在一起。
 * 只带一个裸 presence 会在切换 thread 后把上一条线程的结论用在新线程上。
 */
const threadPresence = ref<{ threadId: string; presence: ThreadPresence }>({
  threadId: initialRouteThreadId ?? "",
  presence: "unknown",
});
const bootstrapConversationReady = ref(!props.bootstrap);
const bootstrapConversationFinished = ref(!props.bootstrap);
let finishAgentCreationRun: (messages: readonly Message[]) => void = () => {};
let lastStartedThreadId: string | null = null;
let completionNotificationTimer: ReturnType<typeof setTimeout> | undefined;

const stream = useThreadStream({
  assistantId: () => props.agentName ?? "lead_agent",
  threadId: streamThreadId,
  // Bootstrap creation intentionally stays on /workspace/agents/new until
  // setup_agent succeeds. Keep the prepared real thread visible without
  // enabling route-owned history queries for it.
  displayThreadId: computed(
    () => streamThreadId.value ?? preparedThreadId.value,
  ),
  context,
  model: selectedModel,
  // Replay gaps, stream errors and plain LLM retry notices share the workspace toast owner.
  notify: {
    warn: (message) =>
      toast.warning(
        message === "conversation.streamReplayGap"
          ? $i18n.t.value.conversation.streamReplayGap
          : message,
      ),
    error: (message) => toast.error(message),
    message: (message) => toast.message(message),
  },
  onStart(startedThreadId) {
    lastStartedThreadId = startedThreadId;
    threads.upsertCreated(
      startedThreadId,
      $i18n.t.value.pages.newChat,
      props.agentName,
    );
    // Nuxt can keep this page displayed while the router has already committed
    // its successor. A late run may update the thread cache, but cannot take
    // navigation back from the new page (including another project query).
    if (
      routeThreadId.value === null &&
      !props.bootstrap &&
      route.fullPath === router.currentRoute.value.fullPath
    ) {
      const path = props.agentName
        ? `/workspace/agents/${encodeURIComponent(props.agentName)}/chats/${startedThreadId}`
        : `/workspace/chats/${startedThreadId}`;
      const owner = submissionOwner.capture();
      // Only the accepted run's exact prepared draft continues this page.
      // Attachment-driven navigation and opening another thread still announce.
      const continuation =
        startedThreadId === preparedThreadId.value &&
        startedThreadId === owner.threadId &&
        submissionOwner.owns(owner)
          ? $routeAnnouncements.preservePage({
              from: router.currentRoute.value,
              target: router.resolve(path).fullPath,
              owns: () => submissionOwner.owns(owner),
            })
          : null;
      const replacement = router.replace(
        continuation ? { path, state: continuation.state } : path,
      );
      if (continuation) void replacement.finally(continuation.cancel);
      else void replacement;
    }
  },
  onFinish(state, completedMessages) {
    const owner = submissionOwner.capture();
    finishAgentCreationRun(completedMessages);
    if (props.bootstrap && !bootstrapConversationReady.value) {
      bootstrapConversationFinished.value = true;
    }
    const id = routeThreadId.value ?? lastStartedThreadId;
    if (id === routeThreadId.value) markThreadRead();
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
    queueMicrotask(() => {
      if (!props.bootstrap && submissionOwner.owns(owner))
        void refreshPostRun(id, completedMessages);
    });
    // A new chat adopts its real route id asynchronously in onStart. The final
    // wire message can therefore become visible shortly after `onFinish`.
    // Bound the wait instead of emitting an irreversibly body-less notification.
    const notifyWhenFinalMessageIsVisible = (remainingAttempts: number) => {
      if (!submissionOwner.owns(owner)) return;
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
        ? queryClient.getQueryData<AgentThread>(threadMetadataQueryKey(id))
            ?.values.title
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
provideKnowledgeSources(() => demoMessages.value ?? stream.messages.value);
useActiveThreadRun({
  threadId: streamThreadId,
  enabled: computed(
    () => !isDemo.value && !localUploading.value && !stream.isUploading.value,
  ),
  streaming: stream.isStreaming,
  currentRunId: stream.activeRunId,
  streamError: stream.error,
  join: stream.joinRun,
});
const creation = useAgentCreationSession({
  agentName: () => props.agentName ?? "",
  ownerId: currentUserId,
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
  onSaveRequested: () => toast.success($i18n.t.value.agents.saveRequested),
  onSaveError: (message) => toast.error(message),
  onVerificationUnavailable: () =>
    toast.error($i18n.t.value.agents.agentCreatedPendingRefresh),
  async onCreated(created) {
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
    requestFailed: $i18n.t.value.agents.creationRequestFailed,
    runFailed: $i18n.t.value.agents.creationRunFailed,
  },
});
finishAgentCreationRun = (messages) => {
  if (props.bootstrap) void creation.onRunFinished(messages);
};
watch(stream.error, (error) => {
  if (props.bootstrap && error) creation.onRunError(error);
});
/*
  「记得点保存」的一次性提示，与上游 new/page.tsx 的 showSaveHint 同构：
  bootstrap 会话第一次进入时出现一次，读过就不再出现（同一个 localStorage 键名，
  两个应用共用一份记忆），点了保存也立刻收起。

  上游把它画在自己那张 create 页上；本仓的 bootstrap 走 AgentChat，所以它挂在这里，
  **只在 bootstrap 时渲染**——非 bootstrap 的会话（含被对照台账覆盖的 agent-chat
  场景）一个字节都不受影响。

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
/*
  The reactive metadata query owns existence probing and the latest checkpoint values.
  GET /threads/{id} already includes that snapshot; a second /state request would duplicate it.
  The shared query key lets rename/archive/project/run invalidations refresh the active route.
*/
const threadMetadata = useThreadMetadata(routeThreadId, {
  /*
  Match React chat-page.tsx metadata admission: no query during a run.
  Adopting the new thread URL must not read the pre-run snapshot over live state.
*/
  enabled: computed(() => !isDemo.value && !stream.isStreaming.value),
});
const authoritativeArtifacts = computed(() => {
  if (isDemo.value) return demoArtifacts.value;
  const state = stream.state.value;
  const value = Object.prototype.hasOwnProperty.call(state, "artifacts")
    ? Reflect.get(state, "artifacts")
    : threadMetadata.data.value?.values.artifacts;
  if (value === undefined) return undefined;
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
});
const authoritativeGoal = computed<GoalState | null>(() => {
  if (isDemo.value) return showcaseState.value.goal ?? null;
  const state = stream.state.value;
  if (Object.prototype.hasOwnProperty.call(state, "goal")) {
    return (Reflect.get(state, "goal") as GoalState | null | undefined) ?? null;
  }
  return threadMetadata.data.value?.values.goal ?? null;
});
const localGoal = ref<GoalState | null | undefined>(undefined);
const activeGoal = computed(() =>
  isDemo.value
    ? authoritativeGoal.value
    : localGoal.value !== undefined
      ? localGoal.value
      : authoritativeGoal.value,
);
const authoritativeTodos = computed<Todo[]>(() => {
  const state = stream.state.value;
  const value = isDemo.value
    ? demoTodos.value
    : Object.prototype.hasOwnProperty.call(state, "todos")
      ? Reflect.get(state, "todos")
      : threadMetadata.data.value?.values.todos;
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
const {
  artifactPanel,
  sidecar,
  sidecarSession,
  browserOpen,
  browserFrame,
  sidecarReconciling,
  messageDetails,
  activePanel,
  panelOpen,
  openArtifact,
  toggleSidecar,
  toggleBrowser,
  acceptBrowserFrame,
  openBrowserFrame,
  askInSidecar,
  showArtifacts,
  addToConversation,
} = useChatPanels({
  consumptionObservation,
  threadId: routeThreadId,
  ownerKey: () =>
    JSON.stringify([currentUserId.value, props.agentName ?? null]),
  draftThreadId,
  readonly: isDemo,
  context,
  messages: () => demoMessages.value ?? stream.messages.value,
  authoritativeArtifacts,
  browserEnabled,
  stream,
});

const visibleMessages = computed(() =>
  [
    ...(demoMessages.value ?? stream.messages.value),
    ...(uploadPreview.value && submissionOwner.owns(uploadPreview.value.owner)
      ? buildComposerUploadMessages(
          uploadPreview.value.snapshot,
          $i18n.t.value.uploads.uploadingFiles,
        )
      : []),
  ].filter((message: Message) => !isHiddenFromUIMessage(message)),
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
  if (isDemo.value) return demoTitle.value ?? "";
  if (!routeThreadId.value) return "";
  const canonicalTitle = threadMetadata.data.value?.values.title;
  return canonicalTitle?.length
    ? canonicalTitle
    : (stream.state.value.title ?? "");
});
/*
  Thread title controls the browser tab through documentTitleOfThread;
  that helper owns the new/untitled/loading fallbacks, matching React ThreadTitle.
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
// Export consumes the active stream, matching React ExportTrigger. Sidebar
// search rows can be absent, stale or archived; they do not own this transcript.
const currentThread = computed(() => {
  const threadId = routeThreadId.value;
  if (!threadId) return null;
  return {
    thread_id: threadId,
    updated_at: new Date().toISOString(),
    values: {
      ...(isDemo.value ? showcaseState.value : stream.state.value),
      messages: visibleMessages.value,
    },
  } as AgentThread;
});
const isWelcomeMode = computed(
  () =>
    !routeThreadId.value &&
    visibleMessages.value.length === 0 &&
    !stream.isHistoryLoading.value,
);
/*
  头部的两态。上游 chat-page.tsx 把这两支写在同一个 cn() 里，欢迎态换掉的是
  背景与模糊那三条；写成 `class` + `:class` 两个属性的话，`bg-background/80` 与
  `bg-background/0` 会同时留在 class 上，赢家由样式表顺序决定而不是模板顺序。
*/
const headerClass = computed(() =>
  cn(
    "absolute top-0 right-0 left-0 z-30 flex h-12 shrink-0 items-center gap-2 px-2 sm:px-4 @max-3xl/chat-pane:relative @max-3xl/chat-pane:h-auto @max-3xl/chat-pane:min-h-12 @max-3xl/chat-pane:flex-wrap @max-3xl/chat-pane:py-2",
    isWelcomeMode.value
      ? "bg-background/0 backdrop-blur-none"
      : "bg-background/80 shadow-xs backdrop-blur",
  ),
);

/*
  The page trigger consumes the shared sidebar owner. Cross-surface command-palette
  and artifact-collapse callers retain their workspace events.
*/
const { mobileOpen: sidebarMobileOpen, toggleSidebar } = useWorkspaceSidebar();

function startAgentChat() {
  if (!props.agentName) return;
  void router.push(
    `/workspace/agents/${encodeURIComponent(props.agentName)}/chats/new`,
  );
}
const {
  followups,
  followupsLoading,
  mainTailRequest,
  branchPending,
  refreshPostRun,
  ensureThread,
  captureComposerSubmission,
  send,
  respondHumanInput,
  stopRun,
  branch,
  regenerate,
  editAndRegenerateMessage,
} = useChatConversationActions({
  threadId: routeThreadId,
  threadTitle: headerTitle,
  agentName: () => props.agentName,
  userId: currentUserId,
  readonly: isDemo,
  bootstrap: () => props.bootstrap,
  startedThreadId: () => lastStartedThreadId,
  context,
  messages: visibleMessages,
  knowledgeScope: currentKnowledgeScopeSnapshot,
  copy: $i18n.t,
  submissionOwner,
  stream,
  sidecar,
  threads,
  suggestions: suggestionsConfigQuery,
  usage: threadTokenUsageQuery,
  toast,
  navigate: (path) => router.push(path),
  focusComposer: () => composer.value?.focus(),
  resetComposer: () => composer.value?.resetDraft(),
});

async function adoptPreparedThread() {
  const id = preparedThreadId.value;
  if (!id || routeThreadId.value !== null || props.bootstrap) return;
  lastStartedThreadId = id;
  const path = props.agentName
    ? `/workspace/agents/${encodeURIComponent(props.agentName)}/chats/${id}`
    : `/workspace/chats/${id}`;
  await router.replace(path);
}

function updateContext(value: Record<string, unknown>) {
  updateThreadSettings("context", value);
}

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
const affiliatedProjectId = computed(() =>
  routeThreadId.value &&
  !isDemo.value &&
  !props.agentName &&
  threadMetadata.data.value
    ? projectIdOfThread(threadMetadata.data.value)
    : null,
);
const composerProjectId = computed(
  () =>
    projectParam.value ??
    (threadMetadata.data.value
      ? projectIdOfThread(threadMetadata.data.value)
      : null),
);
const scheduledEvents = useThreadScheduledTaskEvents(routeThreadId, {
  enabled: computed(() => !isDemo.value),
});
useScheduleToolResultRefresh(routeThreadId, () => stream.messages.value);
const extensionThread = computed(() =>
  routeThreadId.value
    ? ({
        thread_id: routeThreadId.value,
        updated_at:
          threadMetadata.data.value?.updated_at ?? new Date().toISOString(),
        values: { ...stream.state.value, messages: stream.messages.value },
      } as AgentThread)
    : null,
);
const markThreadRead = useMarkOpenThreadRead(routeThreadId, {
  enabled: computed(() => !isDemo.value && threadMetadata.data.value != null),
});
watch(
  () => threadMetadata.data.value,
  (metadata) => {
    if (metadata) threads.upsert(metadata);
  },
  { immediate: true },
);
watch(
  [
    routeThreadId,
    () => threadMetadata.data.value,
    () => threadMetadata.error.value,
    () => threadMetadata.isFetching.value,
  ],
  ([threadId, metadata, error, fetching]) => {
    if (!threadId) return;
    /*
      取数还在飞的时候保持 `unknown`——`shouldLeaveMissingThread` 要求
      presence 确认 missing 才放弃 URL，中途读到一个过期的 present/missing
      会让判据基于上一条线程的答案。
    */
    if (fetching && metadata === undefined && !error) {
      threadPresence.value = { threadId, presence: "unknown" };
      return;
    }
    // 403/404 在 queryFn 里已经归一成 null；其余错误留在 unknown，
    // 于是一次瞬时 5xx 不会把用户连人带对话踢回新会话。
    const presence: ThreadPresence = error
      ? "unknown"
      : metadata === null
        ? "missing"
        : metadata
          ? "present"
          : "unknown";
    threadPresence.value = { threadId, presence };
  },
  { immediate: true },
);
onUnmounted(() => clearTimeout(completionNotificationTimer));

const focusViewport = ref<HTMLElement | null>(null);
const focusReveal = provideFocusReveal(focusViewport);
</script>

<template>
  <WorkspacePanels
    :open="panelOpen"
    :panel-key="activePanel"
    :owner-key="draftThreadId"
    :panel-size="artifactPanel.panelSize.value"
    :panel-padded="activePanel === 'artifacts'"
    :panel-description="$i18n.t.value.primitives.panelDescription"
    :panel-label="
      activePanel === 'artifacts'
        ? $i18n.t.value.primitives.panelArtifacts
        : activePanel === 'sidecar'
          ? $i18n.t.value.primitives.panelSidecar
          : activePanel === 'details'
            ? (messageDetails.selectedDetail.value?.title ??
              $i18n.t.value.common.more)
            : $i18n.t.value.primitives.panelBrowser
    "
    @update:panel-size="artifactPanel.panelSize.value = $event"
    @collapse="
      activePanel === 'sidecar'
        ? sidecar.close()
        : activePanel === 'browser'
          ? (browserOpen = false)
          : activePanel === 'details'
            ? messageDetails.close()
            : artifactPanel.close()
    "
  >
    <template #main>
      <section
        id="chat"
        class="@container/chat-pane relative flex h-full min-h-0 min-w-0 flex-col"
      >
        <!--
  Merge conditional Tailwind overrides through headerClass/cn, because stylesheet order
  determines conflicting utilities. Keep the header at z-30, matching the panel stack.
-->
        <main
          ref="focusViewport"
          class="flex min-h-0 max-w-full min-w-0 grow flex-col @max-3xl/chat-pane:overflow-y-auto"
          @focusin="focusReveal.reveal"
          @focusout="focusReveal.retire"
        >
          <header :class="headerClass">
            <!--
            名字与状态都照 React 的 SidebarTrigger（frontend/src/components/ui/sidebar.tsx）：
            一个 sr-only 的 "Toggle Sidebar"，**没有** aria-expanded / aria-controls。
            侧栏在移动端是一个会被卸载的抽屉，触发器指着一个此刻并不存在的 id，
            aria-controls 是断的；expanded 也只能描述抽屉，描述不了桌面端的收起态。
          -->
            <!--
  This md:hidden trigger operates the mobile drawer, so its state is mobileOpen.
  React SidebarTrigger likewise chooses openMobile on mobile (sidebar.tsx).
-->
            <SidebarTrigger
              v-if="!isDemo"
              :open="sidebarMobileOpen"
              :aria-label="$i18n.t.value.primitives.toggleSidebar"
              class="max-[361px]:size-[36px] max-[361px]:p-0 md:hidden max-[361px]:[&_svg]:size-[16px]"
              @click="toggleSidebar"
            />
            <div
              v-if="agentName"
              class="flex min-w-0 shrink-0 items-center gap-1.5 rounded-md border px-2 py-1"
            >
              <Bot class="text-primary h-3.5 w-3.5" />
              <span
                class="hidden max-w-24 truncate text-xs font-medium sm:inline sm:max-w-none"
              >
                {{ displayNameOfAgent(agent, agentName) }}
              </span>
            </div>
            <!--
            没有真实标题就**不渲染**任何文字，与 React 的 ThreadTitle 一致
            （frontend/src/components/workspace/thread-title.tsx 的
            `if (!thread.values?.title) return null`）。「新对话」只是标签页标题的
            兜底，不是这条会话的名字——把它画在头部，读屏器会把每一个空会话都念成
            一条叫「新对话」的记录。容器保留，占位由它负责。
          -->
            <div
              class="flex min-w-0 flex-1 items-center text-sm font-medium"
              :class="agentName ? undefined : 'gap-2'"
            >
              <!-- The caller allows title shrinkage and truncates the FlipDisplay inner item. -->
              <FlipDisplay
                v-if="headerTitle"
                class="min-w-0 [&>div]:truncate"
                :unique-key="routeThreadId ?? ''"
              >
                {{ headerTitle }}
              </FlipDisplay>
              <ThreadArchiveStatus
                v-if="routeThreadId && !isDemo"
                :thread-id="routeThreadId"
                :metadata="threadMetadata.data.value?.metadata"
              />
              <ProjectAffiliationBadge
                v-if="affiliatedProjectId"
                :project-id="affiliatedProjectId"
              />
            </div>
            <!--
            右侧控件有一层分组容器，但两个上游页面并不共用同一串类：普通聊天页
            `chat-page.tsx` 是 `gap-2`，agent 页是无 gap 的 `sm:mr-4`。本组件同时服务
            两条路由，必须按 `agentName` 选择；把普通聊天的 gap 套到 agent 页，
            200% 文本下会把这排控件多撑 24px 并由主 pane 静默裁掉。

            两支都保留 `shrink-0`：标题是唯一的 flex-1，标题变长时缩的是标题，
            不是这排按钮。
          -->
            <div
              class="flex shrink-0 items-center max-[361px]:gap-[8px] @max-3xl/chat-pane:min-w-0 @max-3xl/chat-pane:shrink @max-3xl/chat-pane:grow-0 @max-3xl/chat-pane:basis-full @max-3xl/chat-pane:flex-wrap @max-3xl/chat-pane:justify-end max-[361px]:[&_[data-slot=button]]:size-[36px]! max-[361px]:[&_[data-slot=button]]:p-0! max-[361px]:[&_[data-slot=button]_svg]:size-[16px]!"
              :class="agentName ? 'sm:mr-4' : 'gap-2'"
            >
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
  Match agents/[agent_name]/chats/[thread_id]/page.tsx: the new-chat action uses
  the shared small secondary Button and Tooltip; the tooltip also names its narrow icon-only state.
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
                <TooltipContent>{{
                  $i18n.t.value.agents.newChat
                }}</TooltipContent>
              </Tooltip>

              <!--
              outline / sm 的按钮外观加一段 `hidden sm:inline` 的文字，不是一颗纯图标的
              方按钮：React 的 ThreadScheduledTasksLink 就是
              `<Button variant="outline" size="sm" asChild>` 包一个带同名 span 的链接
              （frontend/src/components/workspace/thread-scheduled-tasks-button.tsx）。
              两边的可访问名都来自 aria-label，所以这处差异在可访问性树上看不见——
              看得见的是宽屏上一个念得出名字的按钮 vs 一个只有图标的方块。
            -->
              <ThreadScheduledTasksButton
                v-if="routeThreadId && !isDemo && !agentName"
                :thread-id="routeThreadId"
              />
              <!--
  React chat-page.tsx shows token/context usage in showcase mode too.
  The backend usage query is disabled there; the visible indicator retains its empty value.
-->
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
  Agent creation saves through the top-right ghost More menu, matching agents/new/page.tsx.
  The one-time saveHint points to this menu; once saved, Save keeps its label and becomes disabled.
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
                      creation.status.value !== 'idle'
                    "
                    @select="saveAgent"
                  >
                    <Save class="h-4 w-4" />
                    {{
                      creation.status.value === "saving"
                        ? $i18n.t.value.agents.saving
                        : $i18n.t.value.agents.save
                    }}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <SidecarTrigger
                v-if="
                  !isDemo &&
                  sidecar.sidecarThreadId.value &&
                  sidecarSession.ready.value
                "
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
  ExportTrigger is read-only and remains available in showcase, matching React chat-page.tsx.
  Both workspace and showcase layouts provide its workspace toast owner.
-->
              <ExportTrigger
                v-if="routeThreadId && currentThread && !isWelcomeMode"
                :thread-id="routeThreadId"
                :thread="currentThread"
                :messages="visibleMessages"
              />
              <ConversationExtensionActions
                v-if="extensionThread && !isDemo"
                :context="{
                  thread: extensionThread,
                  messages: visibleMessages,
                }"
              />
              <ArtifactTrigger
                :count="artifactPanel.artifacts.value.length"
                @open="showArtifacts"
              />
            </div>
          </header>
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
            :class="
              isWelcomeMode
                ? ''
                : showSaveHint
                  ? 'pt-4 @max-3xl/chat-pane:max-h-dvh @max-3xl/chat-pane:min-h-auto'
                  : 'pt-10 @max-3xl/chat-pane:max-h-dvh @max-3xl/chat-pane:min-h-auto @max-3xl/chat-pane:pt-0'
            "
            :messages="visibleMessages"
            :raw-messages="demoMessages ?? stream.messages.value"
            :scheduled-events="scheduledEvents.data.value ?? []"
            :streaming="stream.isStreaming.value"
            :loading="stream.isHistoryLoading.value"
            :thread-id="routeThreadId"
            :scroll-owner-key="draftThreadId"
            :artifact-paths="artifactPanel.artifacts.value"
            :tool-artifacts="authoritativeToolArtifacts"
            :is-mock="isDemo"
            :has-goal="Boolean(activeGoal)"
            :uploading="localUploading"
            :branch-pending="branchPending"
            :can-branch="!agentName"
            :is-admin="isAdmin"
            :subtasks="stream.subtasks.value"
            :active-run-id="stream.activeRunId.value"
            :streaming-message-ids="stream.streamingMessageIds.value"
            :has-more-history="stream.hasMoreHistory.value"
            :history-loading-more="stream.isHistoryLoadingMore.value"
            :history-error="stream.historyError.value"
            :thread-error="stream.error.value"
            :submit-human-input="respondHumanInput"
            :edit-owner-key="JSON.stringify([currentUserId, agentName])"
            :edit-and-regenerate-message="editAndRegenerateMessage"
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
            @human-input="respondHumanInput"
            @load-more-history="stream.loadMoreHistory()"
          />
          <div
            class="right-0 bottom-0 left-0 z-30 flex justify-center px-3 has-[[contenteditable][aria-controls]]:z-50 has-[textarea[aria-controls]]:z-50 sm:px-4"
            :class="
              isWelcomeMode
                ? 'absolute max-[361px]:relative max-[361px]:shrink-0 max-[361px]:pb-4'
                : 'relative shrink-0 pb-4'
            "
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
                  ? 'max-w-[var(--container-width-sm)] -translate-y-[calc(50vh-48px)] max-[361px]:translate-y-0 sm:-translate-y-[calc(50vh-96px)]'
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
                class="flex flex-col items-center gap-4 rounded-2xl border py-8 text-center"
              >
                <!--
  React agents/new/page.tsx CheckCircleIcon resolves to CircleCheckBig.
  Use the same primary 40px vector and decorative aria-hidden semantics.
-->
                <CircleCheckBig
                  class="text-primary h-10 w-10"
                  aria-hidden="true"
                />
                <p class="font-semibold">
                  {{ $i18n.t.value.agents.agentCreated }}
                </p>
                <div class="flex gap-2">
                  <Button
                    @click="
                      navigateTo(
                        `/workspace/agents/${encodeURIComponent(creation.agent.value.name)}/chats/new`,
                      )
                    "
                  >
                    {{ $i18n.t.value.agents.startChatting }}
                  </Button>
                  <Button
                    variant="outline"
                    @click="navigateTo('/workspace/agents')"
                  >
                    {{ $i18n.t.value.agents.backToGallery }}
                  </Button>
                </div>
              </section>
              <!--
  Agent creation never shows follow-up suggestions, matching agents/new/page.tsx.
  Its text-only bootstrap composer has no offerFollowup ref; normal chat owns that action.
-->
              <!--
  Match React input-box.tsx showFollowups: hide suggestions in readonly/welcome/streaming
  states and while the composer displays skills or a selected slash skill. Closing clears
  the current suggestions; the command owner retires pending work before another send.
-->
              <!--
  React input-box.tsx gives suggestions two unwrapped flex containers; Suggestions
  owns the scrollable list. Loading and completed suggestions are mutually exclusive.
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
                class="flex items-center justify-center pb-1"
              >
                <div class="flex items-center gap-2">
                  <div
                    v-if="followupsLoading"
                    class="text-muted-foreground bg-background/80 rounded-full border px-4 py-1.5 text-xs backdrop-blur-sm"
                  >
                    {{ $i18n.t.value.inputBox.followupLoading }}
                  </div>
                  <!--
  Keep the close action inside Suggestions so it scrolls with the list, as in React
  input-box.tsx. Use the shared 16px X icon and the common close accessible label.
-->
                  <Suggestions v-else class="w-fit items-center">
                    <Suggestion
                      v-for="suggestion in followups"
                      :key="suggestion"
                      class="py-1.5"
                      @click="composer?.offerFollowup(suggestion)"
                    >
                      {{ suggestion }}
                    </Suggestion>
                    <Button
                      :aria-label="$i18n.t.value.common.close"
                      class="text-muted-foreground h-auto cursor-pointer rounded-full px-2.5 py-1.5 text-xs font-normal"
                      size="sm"
                      type="button"
                      variant="outline"
                      @click="followups = []"
                    >
                      <X class="size-4" />
                    </Button>
                  </Suggestions>
                </div>
              </div>
              <!-- Goal and todos share the welcome/ordinary positioning shell; either can render it. -->
              <div
                v-if="
                  (activeGoal || authoritativeTodos.length) &&
                  !(bootstrap && creation.status.value === 'created')
                "
                class="right-0 left-0 z-0"
                :class="isWelcomeMode ? 'absolute -top-4' : 'relative'"
              >
                <div
                  class="right-0 bottom-0 left-0 flex flex-col"
                  :class="isWelcomeMode ? 'absolute' : 'relative'"
                >
                  <GoalStatus v-if="activeGoal" :goal="activeGoal" />
                  <TodoList
                    v-if="authoritativeTodos.length"
                    :todos="authoritativeTodos"
                    class="bg-background/5"
                  />
                </div>
              </div>
              <!--
  React agents/new/page.tsx uses a text-only PromptInput for bootstrap: no attachments,
  voice, polishing or model controls. AgentBootstrapComposer delegates to the same send command.
-->
              <AgentBootstrapComposer
                v-if="bootstrap && creation.status.value !== 'created'"
                :disabled="stream.isStreaming.value"
                @send="(text) => void send(text, [])"
              />
              <ChatComposer
                v-else-if="!bootstrap"
                ref="composer"
                :consumption-observation="consumptionObservation"
                :surface-class="
                  isWelcomeMode
                    ? '-translate-y-2 sm:-translate-y-4 max-[361px]:translate-y-0'
                    : ''
                "
                :thread-key="routeThreadId ?? 'new'"
                :target-thread-id="routeThreadId ?? draftThreadId"
                :project-id="composerProjectId"
                :user-id="currentUserId"
                :agent-name="agentName"
                :default-model-name="agent?.model"
                :agent-skill-names="agent?.skills"
                :agent-skills-loading="!agentResolved"
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
                :capture-submission="captureComposerSubmission"
                :references="sidecar.conversationQuotes.value"
                :context="context"
                :can-create-runs="canCreateRuns"
                :can-stop-streaming="canStopStreaming"
                :disabled="
                  isDemo ||
                  localUploading ||
                  (knowledgeSelectorVisible &&
                    Boolean(agentName) &&
                    agent === null)
                "
                @send="send"
                @stop="stopRun"
                @uploading-change="onComposerUploading"
                @followups-suppressed-change="followupsSuppressed = $event"
                @clear-references="sidecar.clearConversationQuotes()"
                @context-change="updateContext"
                @resolve-context="resolveThreadSettings"
                @reference-file-attached="adoptPreparedThread"
                @goal-change="localGoal = $event"
              >
                <template #knowledgeScopeControl="{ disabled }">
                  <KnowledgeScopeSelector
                    v-if="knowledgeSelectorVisible && knowledgeScope"
                    :agent-name="agentName ?? 'lead_agent'"
                    :selection="knowledgeScope"
                    :disabled="disabled"
                    :unavailable-reason="
                      agentName && !agentKnowledgeEnabled
                        ? $i18n.t.value.knowledge.scope.agentUnavailable
                        : undefined
                    "
                    @change="knowledgeScope = $event"
                  />
                </template>
                <!--
  Welcome content belongs inside the composer extraHeader slot, matching React
  input-box.tsx. ComposerSurface owns the absolute anchor above the input surface.
-->
                <!--
  Welcome yields to goal/todo content: both occupy the composer extraHeader region.
  Match the isWelcomeMode && !hasGoal && !hasTodos guards in React chat and agent pages.
-->
                <template
                  v-if="
                    isWelcomeMode &&
                    !activeGoal &&
                    !authoritativeTodos.length &&
                    !(bootstrap && creation.status.value === 'created')
                  "
                  #extraHeader
                >
                  <!--
  Agent and ordinary chat use different welcome content, matching React AgentWelcome/Welcome.
  Pass AgentWelcome through extraHeader without duplicating the ComposerSurface positioning.
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
  The skill query selects both the welcome title and description, matching React welcome.tsx.
  The outer isWelcomeMode guard already limits this content to an empty conversation.
-->
                    <div class="max-w-full text-2xl font-bold">
                      <template v-if="skillWelcome">
                        ✨ {{ $i18n.t.value.welcome.createYourOwnSkill }} ✨
                      </template>
                      <!--
  The emoji is readable greeting content, matching React welcome.tsx.
  Ultra mode selects the rocket and gold colors together; ordinary mode uses the waving hand.
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
  Match React welcome.tsx paragraph structure: outer color/size and inner
  max-width, word wrapping and preserved line breaks.
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
    <template #panel="{ renderedPanel }">
      <MessageDetailsPanel v-if="renderedPanel === 'details'" />
      <ArtifactOverview
        v-if="
          renderedPanel === 'artifacts' &&
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
          renderedPanel === 'artifacts' &&
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
        v-if="routeThreadId && renderedPanel === 'sidecar'"
        :session="sidecarSession"
        :readonly="isDemo"
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
        v-if="routeThreadId && renderedPanel === 'browser'"
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
