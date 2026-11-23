<script setup lang="ts">
/*
  【文件职责】     DeerFlow 输入区，接线技能、上传、模型、模式、目标、语音和发送状态。
  【架构位置】     L3
  【主要导出】     默认 ChatComposer 组件
  【依赖关系】     skills/uploads/models/goal APIs · composer draft · AgentChat
  【边界与注意】   props/events 是当前宿主接线面；通用 composer 行为由 E 组合同约束。
*/
import {
  getCommandPopupPlacement,
  getMentionPopupPlacement,
  mentionPopupAncestors,
} from "@/core/mentions/popup-placement";
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  useId,
  watch,
} from "vue";
import {
  ArrowUp,
  AtSign,
  GraduationCap,
  Lightbulb,
  Loader2,
  Mic,
  Paperclip,
  Rocket,
  Sparkles,
  Square,
  Target,
  Undo2,
  X,
  Zap,
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ComposerAttachmentChip from "@/components/chat/ComposerAttachmentChip.vue";
import ComposerModelSelector from "@/components/chat/ComposerModelSelector.vue";
import ModeHoverGuide from "@/components/chat/ModeHoverGuide.vue";
import ComposerSurface from "@/components/chat/ComposerSurface.vue";
import WelcomeSuggestionList from "@/components/chat/WelcomeSuggestionList.vue";
import MentionPicker from "@/components/chat/MentionPicker.vue";
import ReferenceAttachment from "@/components/workspace/sidecar/ReferenceAttachment.vue";
import type { SidecarReference } from "@/composables/useSidecar";
import { useComposerDraft } from "@/composables/useComposerDraft";
import { useComposerSubmission } from "@/composables/useComposerSubmission";
import { useComposerReferences } from "@/composables/useComposerReferences";
import { useComposerPolish } from "@/composables/useComposerPolish";
import { useComposerVoice } from "@/composables/useComposerVoice";
import { useModels } from "@/composables/useModels";
import { useSkillsCatalog } from "@/composables/useSkillsCatalog";
import { findSuggestionTemplatePlaceholder } from "@/core/suggestions/placeholders";

import {
  getLeadingSlashQuery,
  getMatchingSlashSuggestions,
  type SlashSuggestion,
} from "@/core/skills/slash-suggestions";
import { isCompositionConfirmEnter, isImeComposing } from "@/core/input/ime";
import type { ThreadConsumptionObservation } from "@/core/diagnostics/parity-observation";
import { useUploadLimits } from "@/composables/useUploads";
import {
  formatUploadSize,
  splitUnsupportedUploadFiles,
  validateUploadLimits,
} from "@/core/uploads/file-validation";
import type { FileInMessage } from "@/core/messages/utils";
import type { Model } from "@/core/models/types";
import {
  supportsThinking,
  isThinkingRequired,
  getReasoningEffortOptions,
  resolveReasoningEffort,
  reasoningEffortForMode,
  type InputMode,
} from "@/core/models/reasoning";
import {
  normalizeComposerContext,
  resolveComposerModel,
} from "@/core/models/capabilities";
import type { ThreadRunContextInput } from "@/core/threads/submit";
import type { LocalSettings } from "@/core/settings/local";
import type {
  ComposerSubmitOptions,
  ComposerUploadSnapshot,
  ComposerHostSnapshot,
} from "@/core/threads/composer-submit";
import type { ConversationReference } from "@/core/conversation-references";
import {
  focusReferenceAt,
  readReferenceEditor,
  referenceCaret,
  referenceToken,
  renderReferenceEditor,
  selectReferenceForDeletion,
} from "@/core/mentions/inline-references";
import { parseSlashSkillReference } from "@/core/skills/slash";
import { getGoalObjectiveCounter } from "@/core/threads/goal";
import { isCompleteBuiltinCommand } from "@/core/threads/builtin-command";
import type { GoalState } from "@/core/threads/types";
import { useWorkspaceToast } from "@/core/workspace-shell/toast";

const props = withDefaults(
  defineProps<{
    threadKey: string;
    targetThreadId: string;
    consumptionObservation?: ThreadConsumptionObservation | null;
    userId?: string | null;
    agentName?: string | null;
    projectId?: string | null;
    agentSkillNames?: string[] | null;
    agentSkillsLoading?: boolean;
    defaultModelName?: string | null;
    modelSelectionReady?: boolean;
    streaming: boolean;
    /**
     * 上一次 run 有没有出错。**只驱动提交键的第三个图标**，不改任何行为。
     *
     * 上游 `input-box.tsx` 收的是 `status: ChatStatus`，由 `chat-page.tsx` 算成
     * `thread.error ? "error" : thread.isLoading ? "streaming" : "ready"`，
     * 再传给 `PromptInputSubmit`：submitted → Loader2、streaming → Square、
     * **error → XIcon**（`prompt-input.tsx:1093`）。本仓原来只有前两态里的两个，
     * 出错之后那颗键照样画箭头。
     *
     * **为什么补**：本仓把流错误只送进 workspace toaster，toast 一过期界面上就
     * 不再有任何痕迹了。按 wave 31 自己定的判据——**一刻发生的事走 toaster，
     * 一段时间里为真的事留在页面里**——「上一次 run 失败了」属于后者，
     * 上游那颗 X 正是它的页面出口。
     *
     * **不传 `submitted`**：上游 `chat-page.tsx` 只会算出 error/streaming/ready
     * 三种，`PromptInputSubmit` 里那条 `submitted → Loader2` 分支在这个应用里是死的。
     * 可访问名也照上游：只有 streaming 变 "Stop"，出错态仍然叫 "Submit"。
     */
    errored?: boolean;
    uploading: boolean;
    promptHistory: string[];
    ensureThread?: () => Promise<string>;
    captureSubmission?: () => ComposerHostSnapshot;
    submitMessage?: (
      text: string,
      files: FileInMessage[],
      options: ComposerSubmitOptions,
    ) => Promise<boolean | undefined>;
    isWelcome?: boolean;
    /*
      挂载时把光标放进文本框，对应上游 `<InputBox autoFocus={isWelcomeMode}>`
      （chat-page.tsx:413、agents/[agent_name]/chats/[thread_id]/page.tsx:404）一路
      传到 `<PromptInputTextarea autoFocus>`（input-box.tsx:2313）。

      **必须是一个独立的 prop，不能直接读 `isWelcome`。** React 的 autoFocus 只在
      DOM 节点**首次挂载**那一刻起作用，之后 `isWelcomeMode` 翻成 false 不会再动焦点；
      而本仓的 `isWelcome` 是 `visibleMessages.length === 0 && !isHistoryLoading` 这个
      computed，打开一条已有线程时它会先真后假地抖一下，跟着它走会在上游根本不聚焦的
      屏上抢走焦点。调用方传的是**挂载那一刻**「这是不是一条新线程」（AgentChat 里
      现成的 `initialRouteThreadId === null`），与上游 `useState(isNewThread)` 的初值同源。

      同样**不能写成 `autofocus` 属性**：HTML 的 autofocus 只在首次解析文档时的
      autofocus candidates 里被处理，客户端路由进来时浏览器不理它（与
      AgentBootstrapComposer 和 chats/index.vue 里那两处同一条机制）。
    */
    autoFocus?: boolean;
    showWelcomeSuggestions?: boolean;
    references?: SidecarReference[];
    context?: ThreadRunContextInput;
    disabled?: boolean;
    canCreateRuns?: boolean;
    canStopStreaming?: boolean;
    /*
      只加在输入框外框上的 class。欢迎态的 -translate-y 属于**输入框本身**，不属于
      整个 composer——React 把它拼进 PromptInput 的 className（见 chat-page.tsx 传给
      InputBox 的 className 与 input-box.tsx 里 PromptInput 的 cn(...)），于是输入框往上
      挪、下面的建议行与免责声明留在原地。挂到根节点上会把整叠一起搬走，间距就不对了。
    */
    surfaceClass?: string;
  }>(),
  {
    canCreateRuns: true,
    canStopStreaming: true,
    userId: undefined,
    consumptionObservation: undefined,
    agentName: undefined,
    projectId: undefined,
    agentSkillNames: undefined,
    defaultModelName: undefined,
    ensureThread: undefined,
    captureSubmission: undefined,
    submitMessage: undefined,
    references: undefined,
    context: undefined,
    showWelcomeSuggestions: true,
    surfaceClass: "",
  },
);
const { $i18n } = useNuxtApp();
const emit = defineEmits<{
  send: [text: string, files: FileInMessage[], options: ComposerSubmitOptions];
  stop: [];
  uploadingChange: [value: boolean, snapshot?: ComposerUploadSnapshot];
  clearReferences: [];
  contextChange: [value: ThreadRunContextInput];
  resolveContext: [value: Partial<LocalSettings["context"]>];
  referenceFileAttached: [];
  goalChange: [value: GoalState | null];
  // AgentChat owns follow-ups and needs the composer's active suggestion/reference state.
  followupsSuppressedChange: [value: boolean];
}>();

const input = ref("");
const selectedFiles = ref<File[]>([]);
const conversationReferences = ref<ConversationReference[]>([]);
/*
  限额走 Vue Query，不再在 onMounted 里裸调一次 getUploadLimits。

  React 用的就是 useUploadLimits（frontend/src/core/uploads/hooks.ts），键是
  ["uploads","limits",threadId]。本仓这一处原来绕开了缓存，于是同一条 thread 的限额
  会被问两遍——输入框一次、sidecar 会话一次，两次问的是同一个 id、拿到的是同一份答案。
  换成同一个 owner 之后它们共享一次请求，也共享 60s 的 staleTime。
*/
const limitsQuery = useUploadLimits(
  () => (props.disabled ? "" : props.targetThreadId),
  { observation: () => props.consumptionObservation },
);
const limits = computed(() => limitsQuery.data.value);
const suggestionIndex = ref(0);
const composerScope = computed(
  () =>
    `${props.userId ?? "anonymous"}\u0000${props.threadKey}\u0000${props.targetThreadId}\u0000${props.agentName ?? "lead-agent"}`,
);
const inputPolish = useComposerPolish({
  text: input,
  scope: composerScope,
  threadId: () => props.targetThreadId,
  disabled: () => props.disabled === true || referenceState.busy.value,
  streaming: () => props.streaming,
  slashQuery: () => getLeadingSlashQuery(input.value),
});
const {
  polishing,
  undoAvailable: polishUndoAvailable,
  disabled: polishDisabled,
  polish,
  cancel: cancelPolish,
} = inputPolish;
/*
  播报走 workspace toaster，与上游 input-box.tsx 的 sonner 一一对应
  （kind 逐条对着上游那一处：error / info / success；上游的 warning 映到 info，
  理由在 workspace-shell/toast.ts 的文件头）。

  此前这里是一个本地 `ref("")`，渲染成 `fixed right-5 bottom-5` 带 `data-sonner-toast`
  的 div。它有三处实打实的落差：① **没有 role、没有 aria-live**，读屏器一条都念不到；
  ② **从来不清空**（全文没有一处 `toast.value = ""`），一条一次性的提示会永远挂在
  屏幕右下角；③ 位置也不对——上游 `<Toaster position="top-center" />`
  （workspace-content.tsx:44 / showcase 的 layout.tsx:29），本仓的 toaster 同样是
  top-center，只有这一份手搓副本在右下角。
*/
const toast = useWorkspaceToast();
const skillCatalog = useSkillsCatalog({
  enabled: computed(() => !props.disabled),
});
/*
  **不按 disabled 关掉。** 上游 input-box.tsx:356 是裸的 `useModels()`。关掉它的后果
  不是少发一个请求，而是模式与模型这两颗触发器的**文字来源没了**：模式触发器只在
  `context.mode` 是四个合法值之一时才写字，而 context.mode 是模型目录到位后由
  「自动选模型」那一步写进去的（上游 getResolvedMode(undefined, supportsThinking)
  给出 "pro"）；模型触发器写的是 selectedModel.display_name。目录不来，两颗按钮
  就都是空的——可访问性树上是两颗**没有名字**的按钮。
*/
const modelCatalog = useModels();
const skills = computed(() =>
  props.agentSkillsLoading
    ? []
    : skillCatalog.skills.value.filter(
        (skill) =>
          (props.agentSkillNames == null ||
            props.agentSkillNames.includes(skill.name)) &&
          parseSlashSkillReference(`/${skill.name}`)?.name === skill.name,
      ),
);
const models = modelCatalog.models;
const disclaimer = computed(() => $i18n.t.value.inputBox.disclaimer);
const selectedModel = computed(() => {
  if (props.modelSelectionReady === false) return undefined;
  return resolveComposerModel(
    models.value,
    typeof props.context?.model_name === "string"
      ? props.context.model_name
      : undefined,
    props.defaultModelName,
  );
});
/*
  「用户真的选过的模式」与「兜底展示用的模式」是两件事，React 也把它们分开
  （frontend/src/components/workspace/input-box.tsx）：触发器上的文字与菜单里的勾
  都直接读 context.mode，没选过就**什么都不显示**；只有 hover 说明用 flash 兜底。

  Vue 原来只有一个带兜底的 selectedMode，于是一个从没被选中、也从没发给后端的
  「Flash」被同时写在按钮上和菜单里——界面在替用户回答一个他没回答过的问题。
*/
const MODE_IDS = ["flash", "thinking", "pro", "ultra"] as const;
const explicitMode = computed(() => {
  const mode = props.context?.mode;
  return typeof mode === "string" &&
    (MODE_IDS as readonly string[]).includes(mode)
    ? mode
    : "";
});
const selectedMode = computed(() => explicitMode.value || "flash");
/*
  每个档位带自己的图标，与上游 input-box.tsx:2393 的四条 `mode === …` 一一对应
  （Zap / Lightbulb / GraduationCap / Rocket）。ultra 另外两处上色：图标是
  `text-[#dabb5e]`，文字走 `.golden-text`（main.css 里那条照抄的规则）。

  **这一整簇台账天生看不见**：lucide 的 svg 不进可访问性树，模式菜单也不是几何
  锚点，颜色只在 settle 的 visible 锚点上取样。所以它靠的是「上游画了什么」，
  不是「门禁有没有变红」。
*/
const modes = computed(() => [
  {
    id: "flash",
    label: $i18n.t.value.inputBox.flashMode,
    description: $i18n.t.value.inputBox.flashModeDescription,
    effort: "minimal" as const,
    icon: Zap,
    golden: false,
  },
  {
    id: "thinking",
    label: $i18n.t.value.inputBox.reasoningMode,
    description: $i18n.t.value.inputBox.reasoningModeDescription,
    effort: "low" as const,
    icon: Lightbulb,
    golden: false,
  },
  {
    id: "pro",
    label: $i18n.t.value.inputBox.proMode,
    description: $i18n.t.value.inputBox.proModeDescription,
    effort: "medium" as const,
    icon: GraduationCap,
    golden: false,
  },
  {
    id: "ultra",
    label: $i18n.t.value.inputBox.ultraMode,
    description: $i18n.t.value.inputBox.ultraModeDescription,
    effort: "high" as const,
    icon: Rocket,
    golden: true,
  },
]);
const availableModes = computed(() =>
  supportsThinking(selectedModel.value)
    ? modes.value.filter(
        (mode) =>
          !isThinkingRequired(selectedModel.value) || mode.id !== "flash",
      )
    : modes.value.filter((mode) => mode.id === "flash"),
);
/*
  触发器的文案和 hover 说明必须来自同一条记录。原来模板里对同一个 find 调用了
  三次（标签一次、native title 的两段各一次），改一处漏两处是迟早的事。
  没有匹配项时回落到第一个可用模式，这样触发器永远有名字。
*/
const activeMode = computed(
  () =>
    availableModes.value.find((mode) => mode.id === selectedMode.value) ??
    availableModes.value[0] ??
    modes.value[0]!,
);
const textarea = ref<HTMLTextAreaElement | null>(null);
const referenceEditor = ref<HTMLElement | null>(null);
const inlineEditorActive = ref(false);
const composerRoot = ref<HTMLElement | null>(null);
const skillSuggestionsMaxHeight = ref("18rem");
const skillSuggestionsInline = ref(false);
function syncSkillSuggestionsMaxHeight() {
  const root = composerRoot.value;
  if (!root) return;
  const placement = getCommandPopupPlacement(root);
  skillSuggestionsInline.value = placement.inline;
  skillSuggestionsMaxHeight.value = `${placement.maxHeight}px`;
}
const fileInput = ref<HTMLInputElement | null>(null);
let historyIndex = -1;
const enabledSkillNames = computed(
  () =>
    new Set(
      skills.value.filter((skill) => skill.enabled).map((skill) => skill.name),
    ),
);
const draft = useComposerDraft({
  userId: computed(() => props.userId),
  agentName: computed(() => props.agentName),
  threadId: computed(() => props.threadKey),
  ready: skillCatalog.ready,
  enabledSkillNames,
  text: input,
  conversationReferences,
});
const draftKey = draft.key;
const submission = useComposerSubmission({
  props,
  // `new` adopts this same run target on its first onStart. Draft storage keys
  // change then; submission ownership changes only for another target/identity.
  scope: () =>
    `${props.userId ?? "anonymous"}\u0000${props.targetThreadId}\u0000${props.agentName ?? "lead-agent"}`,
  locked: () => composerLocked.value,
  model: () => selectedModel.value,
  text: input,
  files: selectedFiles,
  conversationReferences,
  draft,
  references: () => referenceState,
  send: (text, files, options) => emit("send", text, files, options),
  uploadingChange: (value, snapshot) => {
    if (snapshot) emit("uploadingChange", value, snapshot);
    else emit("uploadingChange", value);
  },
  goalChange: (goal) => emit("goalChange", goal),
  onAccepted: () => {
    historyIndex = -1;
  },
});
const { compactPending, submissionPending, attachmentKey } = submission;

const referenceState = useComposerReferences({
  text: input,
  references: conversationReferences,
  threadId: () => props.targetThreadId,
  projectId: () => props.projectId,
  scopeKey: draftKey,
  ready: skillCatalog.ready,
  disabled: () =>
    props.disabled === true || polishing.value || compactPending.value,
  limits,
  localFiles: selectedFiles,
  ensureThread: () =>
    props.ensureThread
      ? props.ensureThread()
      : Promise.resolve(props.targetThreadId),
  focusAt: focusComposerAt,
  openUpload: openFileDialog,
  onFileAttached: (threadId) => {
    draft.adoptThread(threadId);
    emit("referenceFileAttached");
  },
});
const mentionListId = `composer-mentions-${useId()}`;
const commandListId = `composer-commands-${useId()}`;
const mentionPicker = ref<InstanceType<typeof MentionPicker> | null>(null);
const activeMentionOption = ref<string | undefined>();
const mentionPlacement = ref({ above: true, inline: false, maxHeight: 288 });
const mentionPopup = ref<HTMLElement | null>(null);
function focusComposerAt(offset: number) {
  void nextTick(() => {
    if (referenceEditor.value) {
      renderReferenceEditor(referenceEditor.value, input.value);
      focusReferenceAt(referenceEditor.value, offset);
    } else if (textarea.value) {
      textarea.value.focus();
      textarea.value.setSelectionRange(offset, offset);
    }
  });
}
function updateMentionCaret() {
  const element = referenceEditor.value;
  const value = element ? readReferenceEditor(element) : input.value;
  const caret = element
    ? referenceCaret(element)
    : textarea.value &&
        textarea.value.selectionStart === textarea.value.selectionEnd
      ? textarea.value.selectionStart
      : null;
  referenceState.updateQuery(value, caret);
}
function onReferenceCaretKeyup(event: KeyboardEvent) {
  if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
    updateMentionCaret();
}
function onTextareaSelect() {
  if (!referenceState.buttonOpen.value && !referenceState.busy.value)
    updateMentionCaret();
}
function onMentionOutsidePointer(event: PointerEvent) {
  if (
    event.target instanceof Node &&
    !composerRoot.value?.contains(event.target)
  )
    referenceState.close();
}
function openMentions() {
  referenceState.open(
    referenceEditor.value
      ? referenceCaret(referenceEditor.value)
      : textarea.value?.selectionStart,
  );
}
function placeMentions() {
  if (!composerRoot.value || !mentionPopup.value) return;
  mentionPlacement.value = getMentionPopupPlacement(
    composerRoot.value,
    mentionPopup.value,
  );
}
watch(
  [input, () => referenceState.inline.value.length],
  async () => {
    if (referenceState.inline.value.length) inlineEditorActive.value = true;
    await nextTick();
    if (referenceEditor.value && !compositionActive.value)
      renderReferenceEditor(referenceEditor.value, input.value);
  },
  { flush: "post" },
);
watch(referenceState.show, async (show, _previous, onCleanup) => {
  if (!show) return;
  let stopped = false;
  let observer: ResizeObserver | undefined;
  onCleanup(() => {
    stopped = true;
    observer?.disconnect();
    window.removeEventListener("resize", placeMentions);
    window.removeEventListener("scroll", placeMentions, true);
    window.visualViewport?.removeEventListener("resize", placeMentions);
    window.visualViewport?.removeEventListener("scroll", placeMentions);
    document.removeEventListener("pointerdown", onMentionOutsidePointer);
  });
  await nextTick();
  if (stopped || !composerRoot.value) return;
  placeMentions();
  if (typeof ResizeObserver !== "undefined") {
    observer = new ResizeObserver(placeMentions);
    observer.observe(composerRoot.value);
    if (mentionPopup.value?.firstElementChild)
      observer.observe(mentionPopup.value.firstElementChild);
    for (const ancestor of mentionPopupAncestors(composerRoot.value))
      observer.observe(ancestor);
  }
  window.addEventListener("resize", placeMentions);
  window.addEventListener("scroll", placeMentions, true);
  window.visualViewport?.addEventListener("resize", placeMentions);
  window.visualViewport?.addEventListener("scroll", placeMentions);
  document.addEventListener("pointerdown", onMentionOutsidePointer);
});
const pendingFollowup = ref<string | null>(null);
const builtinSlashCommands = computed<SlashSuggestion[]>(() => [
  {
    name: "goal",
    description: $i18n.t.value.inputBox.goalCommandDescription,
    kind: "builtin",
  },
  {
    name: "compact",
    description: $i18n.t.value.inputBox.compactCommandDescription,
    kind: "builtin",
  },
]);
const slashQuery = computed(() => getLeadingSlashQuery(input.value));
const suggestions = computed<SlashSuggestion[]>(() => {
  if (slashQuery.value === null || referenceState.inline.value.length)
    return [];
  const matches = getMatchingSlashSuggestions(
    [],
    slashQuery.value,
    builtinSlashCommands.value,
  );
  /*
    内建命令拥有**整行**，所以不能跟技能激活叠在一起：选中技能之后再选 `/goal`，
    提交出去的是一句聊天文本而不是命令。所以这里把它们从结果里去掉，而不是不喂给
    helper——helper 需要这份清单去预留它们的名字（叫这个名字的技能同样够不着，
    理由镜像：它提交出去运行的是命令而不是那个技能）。
  */
  return matches;
});
/*
  焦点态与「关掉过」是显示条件的一部分，不是可有可无的装饰（上游
  input-box.tsx:1322 的 showSkillSuggestions）。本仓原来只看 `suggestions.length`，
  于是这个浮层**关不掉**：Escape 没有分支，点走焦点也不消失，它就一直盖在会话流上。

  记的是**当时那行文本**而不是一个裸布尔。记布尔的话，Escape 之后再敲一个字符
  列表也回不来了——而用户按 Escape 想说的是「这一行我不需要提示」，不是
  「这个会话里别再提示我」。文本一变（继续打字、退格），条件自然不再成立。
*/
const textareaFocused = ref(false);
/*
  上游 input-box.tsx 的 `composerLocked`。此前这三项各自散在模板里
  （textarea 的 `:disabled`、按钮的 `disabled || polishing`……），
  而**输入框那一处一定要收成一把锁**：改成 readonly 之后，「锁上时不许做什么」
  不再由 disabled 属性顺带吞掉事件，必须每一处自己说。
*/
const composerLocked = computed(
  () =>
    props.disabled === true ||
    polishing.value ||
    compactPending.value ||
    referenceState.busy.value,
);
const voice = useComposerVoice({
  text: input,
  scope: composerScope,
  locked: composerLocked,
});
const {
  listening: voiceListening,
  supported: voiceSupported,
  toggle: toggleVoiceInput,
} = voice;
const dismissedSuggestionValue = ref<string | null>(null);
const showSuggestions = computed(
  () =>
    !composerLocked.value &&
    !referenceState.show.value &&
    textareaFocused.value &&
    slashQuery.value !== null &&
    suggestions.value.length > 0 &&
    dismissedSuggestionValue.value !== input.value,
);

/*
  润色按钮的可用性判据，与 React 的 inputPolishDisabled 一一对应
  （frontend/src/components/workspace/input-box.tsx）。撤销态是唯一的例外：
  已经润色过之后，即使正在流式输出、即使草稿被清空，「撤销」也必须还能按，
  否则用户没有回到原文的路。
*/
/*
  上游 input-box.tsx:1339 的判据是三条与：**没在润色中**、有过一次成功的改写、
  **而且输入框里现在的文本仍然逐字等于那一版改写**。第三条本仓原来没有，
  后果不是样式：润色完之后用户接着往下打字，这颗键仍然显示「撤销优化」，
  按下去 `input.value = polishOriginal.value` 会把**改写之后新输入的内容一起**
  换回润色前那一版，且没有二次撤销。按上游的判据，用户一动键盘撤销就收回去
  （改回一模一样的文本时又出现，因为它是无状态比较，不是一次性开关）。
*/
/*
  `/goal <objective>` 写到接近上限时，工具条右侧出现一个 length/max 计数器
  （上游 input-box.tsx:2649）。可访问名走词典，数字本身是可见文本。
*/
const goalObjectiveCounter = computed(() =>
  getGoalObjectiveCounter(input.value),
);

watch(
  [
    () => props.targetThreadId,
    () => props.threadKey,
    () => props.agentName,
    () => props.userId,
  ],
  () => {
    inlineEditorActive.value = false;
    cancelPolish();
    pendingFollowup.value = null;
  },
);
/*
  重置活动项的依赖跟上游一致（input-box.tsx:1538 的 [slashSkillQuery,
  skillSuggestions.length]），不是整个数组。数组身份每次重算都变，而 hover 会改
  suggestionIndex——盯着数组身份重置，等于把鼠标刚移上去的那一项又弹回第一项。
*/
watch([slashQuery, () => suggestions.value.length], () => {
  suggestionIndex.value = 0;
});
watch(showSuggestions, async (visible, _previous, onCleanup) => {
  if (!visible) return;
  let stopped = false;
  let observer: ResizeObserver | undefined;
  onCleanup(() => {
    stopped = true;
    observer?.disconnect();
    window.removeEventListener("resize", syncSkillSuggestionsMaxHeight);
    window.removeEventListener("scroll", syncSkillSuggestionsMaxHeight, true);
    window.visualViewport?.removeEventListener(
      "resize",
      syncSkillSuggestionsMaxHeight,
    );
    window.visualViewport?.removeEventListener(
      "scroll",
      syncSkillSuggestionsMaxHeight,
    );
  });
  await nextTick();
  if (stopped || !composerRoot.value) return;
  syncSkillSuggestionsMaxHeight();
  if (typeof ResizeObserver !== "undefined") {
    observer = new ResizeObserver(syncSkillSuggestionsMaxHeight);
    observer.observe(composerRoot.value);
    for (const ancestor of mentionPopupAncestors(composerRoot.value))
      observer.observe(ancestor);
  }
  window.addEventListener("resize", syncSkillSuggestionsMaxHeight);
  window.addEventListener("scroll", syncSkillSuggestionsMaxHeight, true);
  window.visualViewport?.addEventListener(
    "resize",
    syncSkillSuggestionsMaxHeight,
  );
  window.visualViewport?.addEventListener(
    "scroll",
    syncSkillSuggestionsMaxHeight,
  );
});

watch(
  [
    models,
    () => props.context,
    () => props.defaultModelName,
    () => props.modelSelectionReady,
  ],
  () => {
    const model = selectedModel.value;
    if (!model) return;
    const normalized = normalizeComposerContext(
      { ...(props.context ?? {}) },
      model,
    );
    if (
      normalized.model_name !== props.context?.model_name ||
      normalized.mode !== props.context?.mode ||
      normalized.reasoning_effort !== props.context?.reasoning_effort
    ) {
      emit("resolveContext", {
        model_name: normalized.model_name,
        mode: normalized.mode,
        reasoning_effort: normalized.reasoning_effort,
      });
    }
  },
  { immediate: true },
);

function emitExplicitContext(
  next: ThreadRunContextInput,
  keys: ("model_name" | "mode" | "reasoning_effort")[],
) {
  const changes: ThreadRunContextInput = {};
  for (const key of keys)
    if (next[key] !== props.context?.[key])
      Object.assign(changes, { [key]: next[key] });
  if (Object.keys(changes).length) emit("contextChange", changes);
}
function selectModel(model: Model) {
  emitExplicitContext(
    normalizeComposerContext(
      { ...props.context, model_name: model.name },
      model,
    ),
    ["model_name", "mode", "reasoning_effort"],
  );
}
/* 推理强度是 mode 之外的**第二个**选择器，不是 mode 的显示名。
   mode 只给出一个起点（flash→minimal、thinking→low、pro→medium、ultra→high），
   用户可以脱离它单独覆盖；覆盖值由 normalizeComposerContext 原样提交。
   与 React 一致：只有模型声明 supports_reasoning_effort 且当前不是 flash 时出现——
   flash 的语义就是不推理，给它一个强度选择器没有意义。 */
const supportsReasoningEffort = computed(
  () => getReasoningEffortOptions(selectedModel.value).length > 0,
);
const reasoningMenuOpen = ref(false);
const effortLabels = computed(() => {
  const t = $i18n.t.value.inputBox;
  return {
    minimal: [t.reasoningEffortMinimal, t.reasoningEffortMinimalDescription],
    low: [t.reasoningEffortLow, t.reasoningEffortLowDescription],
    medium: [t.reasoningEffortMedium, t.reasoningEffortMediumDescription],
    high: [t.reasoningEffortHigh, t.reasoningEffortHighDescription],
    xhigh: [t.reasoningEffortXhigh, t.reasoningEffortXhighDescription],
    max: [t.reasoningEffortMax, t.reasoningEffortMaxDescription],
  } as Record<string, [string, string]>;
});
const reasoningEfforts = computed(() =>
  getReasoningEffortOptions(selectedModel.value).map((id) => ({
    id,
    label: effortLabels.value[id]?.[0] ?? id,
    description: effortLabels.value[id]?.[1] ?? null,
  })),
);
const selectedReasoningEffort = computed(() =>
  resolveReasoningEffort(
    selectedModel.value,
    props.context?.reasoning_effort ??
      reasoningEffortForMode(
        (props.context?.mode ?? "pro") as InputMode,
        selectedModel.value,
      ),
  ),
);
const activeReasoningEffort = computed(
  () =>
    reasoningEfforts.value.find(
      (item) => item.id === selectedReasoningEffort.value,
    ) ?? { id: "", label: "", description: null },
);

function selectReasoningEffort(id: string) {
  const effort = reasoningEfforts.value.find(
    (candidate) => candidate.id === id,
  );
  if (!effort) return;
  emitExplicitContext(
    normalizeComposerContext(
      { ...props.context, reasoning_effort: effort.id },
      selectedModel.value,
    ),
    ["reasoning_effort"],
  );
}

function selectModeById(id: string) {
  const mode = availableModes.value.find((candidate) => candidate.id === id);
  if (!mode) return;
  const next = normalizeComposerContext(
    {
      ...props.context,
      mode: mode.id,
      reasoning_effort: reasoningEffortForMode(
        mode.id as InputMode,
        selectedModel.value,
      ),
    },
    selectedModel.value,
  );
  emitExplicitContext(next, ["mode", "reasoning_effort"]);
}
onMounted(() => {
  // 见 autoFocus prop 的注释：这里是上游 autoFocus 的等价实现。
  if (props.autoFocus) textarea.value?.focus();
});
// 见 followupsSuppressedChange 的注释。上游那两条判据在 input-box.tsx:1984-1985。
watch(
  () => showSuggestions.value || referenceState.show.value,
  (value) => emit("followupsSuppressedChange", value),
  { immediate: true },
);
onBeforeUnmount(() => {
  // 上游 input-box.tsx:1997 的清理 effect：卸载时把这个事实收回去。
  emit("followupsSuppressedChange", false);
  cancelPolish();
});

/* Skills enter the inline reference editor; built-in commands retain their
   trailing separator so the command catalog closes before entering arguments. */
function applySuggestion(item: SlashSuggestion | undefined) {
  if (!item) return false;
  if (item.kind === "skill") {
    input.value = `${referenceToken("skill", item.name, item.name)} `;
    dismissedSuggestionValue.value = null;
    focusComposerAt(input.value.length);
  } else {
    const next = `/${item.name} `;
    input.value = next;
    dismissedSuggestionValue.value = next;
    void nextTick(() => {
      const element = textarea.value;
      if (!element) return;
      element.focus();
      element.setSelectionRange(next.length, next.length);
    });
  }
  return true;
}

async function submit() {
  const placeholder = await submission.submit();
  if (!placeholder) return;
  await nextTick();
  const element = textarea.value;
  element?.focus();
  element?.setSelectionRange(placeholder.start, placeholder.end);
}

const compositionActive = ref(false);
let compositionEndedAt = -Infinity;
function endComposition() {
  compositionActive.value = false;
  compositionEndedAt = Date.now();
}

/*
  斜杠目录的键盘导航，对应上游的 handleSkillSuggestionKeyDown（input-box.tsx:1569）。
  它在上游是**独立于提交路径**的一段：Enter/Tab 在 keydown 阶段就把建议接受掉并
  preventDefault，于是表单提交那条路根本看不见目录。本仓原来把「接受建议」塞在
  `submit()` 里，两条路混在一起，才需要 `!compactCommand` 那个硬编码去绕开自己。

  Enter 与 Tab 的分工不同（2026-09-02 用户拍板，两边同改）：**输入行正好是一条
  打全了的内建命令时，Enter 直接执行**，不再先接受一次它自己的建议——打全
  `/compact` 还要按两下回车是一记空keystroke。Tab 仍然只做补全。
  这条只在没有技能 chip 时成立：chip 态里目录只列技能，`/compact` 这行文本
  提交出去也不是命令，此时 Enter 该接受的就是那条技能建议。
*/
function onSuggestionKeydown(event: KeyboardEvent) {
  if (!showSuggestions.value) return;
  if (event.key === "ArrowDown") {
    event.preventDefault();
    suggestionIndex.value =
      (suggestionIndex.value + 1) % suggestions.value.length;
    return;
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    suggestionIndex.value =
      (suggestionIndex.value - 1 + suggestions.value.length) %
      suggestions.value.length;
    return;
  }
  if (event.key === "Enter" || event.key === "Tab") {
    if (event.shiftKey) return;
    if (event.key === "Enter" && isCompleteBuiltinCommand(input.value)) {
      return;
    }
    event.preventDefault();
    applySuggestion(suggestions.value[suggestionIndex.value]);
    return;
  }
  if (event.key === "Escape") {
    event.preventDefault();
    dismissedSuggestionValue.value = input.value;
  }
}

function onKeydown(event: KeyboardEvent) {
  /*
    disabled 的 textarea 收不到任何按键，readonly 的收得到，所以锁上时要在这里
    挡掉——回车那条路也一样，`submit()` 自己也再判一次（两处都判是有意的：
    这里挡的是历史翻页与斜杠面板，那里挡的是任何别的调用点）。
  */
  if (composerLocked.value) return;
  if (isCompositionConfirmEnter(event, compositionEndedAt)) {
    event.preventDefault();
    return;
  }
  if (isImeComposing(event, compositionActive.value)) return;
  if (referenceState.show.value) mentionPicker.value?.onKeyDown(event);
  if (event.defaultPrevented) return;
  if (
    referenceEditor.value &&
    (event.key === "Backspace" || event.key === "Delete")
  )
    selectReferenceForDeletion(referenceEditor.value, event.key);
  onSuggestionKeydown(event);
  if (event.defaultPrevented) return;
  if (event.key === "Enter" && event.shiftKey) return;
  if (event.key === "Enter") {
    event.preventDefault();
    void submit();
    return;
  }
  if (
    !showSuggestions.value &&
    event.key === "ArrowUp" &&
    (!input.value || historyIndex >= 0)
  ) {
    event.preventDefault();
    historyIndex = Math.min(historyIndex + 1, props.promptHistory.length - 1);
    input.value =
      props.promptHistory[props.promptHistory.length - 1 - historyIndex] ?? "";
  } else if (
    !showSuggestions.value &&
    event.key === "ArrowDown" &&
    historyIndex >= 0
  ) {
    event.preventDefault();
    historyIndex -= 1;
    input.value =
      historyIndex < 0
        ? ""
        : (props.promptHistory[props.promptHistory.length - 1 - historyIndex] ??
          "");
  }
}

function onReferenceInput(event: Event) {
  const element = event.target as HTMLElement;
  input.value = readReferenceEditor(element);
  referenceState.updateQuery(input.value, referenceCaret(element));
  stopVoiceForEdit();
}
function stopVoiceForEdit() {
  if (!voiceListening.value) return;
  voice.stop();
}
function onTextareaInput() {
  updateMentionCaret();
  stopVoiceForEdit();
}
function onReferencePaste(event: ClipboardEvent) {
  if (composerLocked.value) return;
  event.preventDefault();
  document.execCommand(
    "insertText",
    false,
    event.clipboardData?.getData("text/plain") ?? "",
  );
}
function openFileDialog() {
  fileInput.value?.click();
}
function chooseFiles(event: Event) {
  const files = (event.target as HTMLInputElement).files;
  if (!files) return;
  const supported = splitUnsupportedUploadFiles(files);
  const result = validateUploadLimits(
    selectedFiles.value,
    supported.accepted,
    limits.value,
  );
  selectedFiles.value = [...selectedFiles.value, ...result.accepted];
  if (supported.message) toast.error(supported.message);
  if (result.violations.length > 0) {
    const violation = result.violations[0]!;
    const names = violation.files.map((file) => file.name).join(", ");
    // 上游三支都是 toast.error（input-box.tsx:504 / 511 / 515）。
    toast.error(
      violation.code === "max_files"
        ? $i18n.t.value.uploads.tooManyFiles(
            violation.files.length,
            violation.limit,
          )
        : violation.code === "max_total_size"
          ? $i18n.t.value.uploads.totalSizeTooLarge(
              violation.files.length,
              formatUploadSize(violation.limit),
            )
          : $i18n.t.value.uploads.filesTooLarge(
              names,
              formatUploadSize(violation.limit),
            ),
    );
  }
  (event.target as HTMLInputElement).value = "";
}

function replaceDraft(value: string) {
  input.value = value;
  /*
    光标落到末尾，和上游 setPromptHistoryValue 一样（input-box.tsx:1609：
    focus() 之后 setSelectionRange(len, len)）。只 focus 的话浏览器把光标放在
    第 0 位，用户接着打字会写到预填文本的**前面**。
  */
  void nextTick(() => {
    const element = textarea.value;
    if (!element) return;
    element.focus();
    element.setSelectionRange(value.length, value.length);
  });
}
function selectWelcomeSuggestion(value: string) {
  input.value = value;
  const placeholder = findSuggestionTemplatePlaceholder(value);
  void nextTick(() => {
    requestAnimationFrame(() => {
      if (!textarea.value) return;
      textarea.value.focus();
      if (placeholder) {
        textarea.value.setSelectionRange(placeholder.start, placeholder.end);
      }
    });
  });
}
function offerFollowup(value: string) {
  if (!input.value.trim() && selectedFiles.value.length === 0) {
    replaceDraft(value);
    void nextTick(() => submit());
    return;
  }
  pendingFollowup.value = value;
}
function resolveFollowup(action: "append" | "replace" | "cancel") {
  const value = pendingFollowup.value;
  pendingFollowup.value = null;
  if (!value || action === "cancel") return;
  if (action === "replace") {
    replaceDraft(value);
    void nextTick(() => submit());
    return;
  }
  input.value = input.value.trimEnd()
    ? `${input.value.trimEnd()}\n${value}`
    : value;
  void nextTick(() => submit());
}
/*
  流式输出期间这个按钮仍然是 type="submit"（与 React 一致），所以停止分支必须自己
  拦下表单提交，否则「停止」会顺手再发一条空消息。
*/
/*
  上游听写中是 `text-primary bg-primary/10 hover:bg-primary/15`
  （input-box.tsx:2818）。手写那版少了 hover 那一档：正在听写时鼠标
  停上去毫无反应。Button 的 `class` prop 只收字符串，所以在这里拼好。
*/
const voiceButtonClass = computed(() =>
  voiceListening.value
    ? "px-2! text-primary bg-primary/10 hover:bg-primary/15"
    : "px-2!",
);

function onSubmitButtonClick(event: MouseEvent) {
  if (!props.streaming) return;
  event.preventDefault();
  stopRun();
}
function stopRun() {
  if (!props.canStopStreaming) return;
  // The stream owner sends the server cancel. Aborting the submission here
  // would detach that owner before it receives this explicit stop request.
  cancelPolish();
  emit("stop");
}
function focus() {
  const editor = referenceEditor.value ?? textarea.value;
  if (!composerLocked.value && editor?.isConnected)
    editor.focus({ preventScroll: true });
}
function resetDraft() {
  submission.cancel();
  cancelPolish();
  draft.clearIfUnchanged({
    key: draftKey.value,
    text: input.value,
    skillName: null,
    conversationReferences: [...conversationReferences.value],
  });
  selectedFiles.value = [];
  referenceState.close();
  inlineEditorActive.value = false;
  pendingFollowup.value = null;
}
defineExpose({ replaceDraft, offerFollowup, focus, resetDraft });
</script>

<template>
  <div
    ref="composerRoot"
    class="relative flex min-w-0 flex-col"
    :class="isWelcome ? 'gap-4' : 'gap-2'"
  >
    <!--
      上游 input-box.tsx:2765 是一个**真的** `<Dialog>`：portal 出去、遮罩、焦点陷阱、
      Escape 关闭、`DialogTitle` + `DialogDescription` 提供可访问名与描述，
      页脚三颗 `<Button>`（outline / secondary / default）。

      本仓原来是 `absolute bottom-full` 的手搓副本：一个带 `role="dialog"`
      `aria-modal="true"` 的 div，靠 `aria-label` 顶替标题、没有遮罩、没有焦点陷阱、
      Escape 关不掉、Tab 会走到底下的输入框里去——`aria-modal` 只是在**说**自己是模态，
      浏览器不会因此拦住焦点。

      同时去掉了本仓多渲染的那一段 `pendingFollowup` 正文：上游只有标题和描述两行，
      不把待发的建议再念一遍。
    -->
    <Dialog
      :open="pendingFollowup !== null"
      @update:open="(open: boolean) => !open && resolveFollowup('cancel')"
    >
      <DialogContent :close-label="$i18n.t.value.primitives.close">
        <DialogHeader>
          <DialogTitle>
            {{ $i18n.t.value.inputBox.followupConfirmTitle }}
          </DialogTitle>
          <DialogDescription>
            {{ $i18n.t.value.inputBox.followupConfirmDescription }}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="resolveFollowup('cancel')">
            {{ $i18n.t.value.common.cancel }}
          </Button>
          <Button variant="secondary" @click="resolveFollowup('append')">
            {{ $i18n.t.value.inputBox.followupConfirmAppend }}
          </Button>
          <Button @click="resolveFollowup('replace')">
            {{ $i18n.t.value.inputBox.followupConfirmReplace }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <div
      v-if="referenceState.show.value"
      ref="mentionPopup"
      class="right-0 left-0 z-50 overflow-y-auto px-1"
      :class="
        mentionPlacement.inline
          ? 'relative mb-2'
          : mentionPlacement.above
            ? 'absolute bottom-full mb-2'
            : 'absolute top-full mt-2'
      "
      :style="{ maxHeight: `${mentionPlacement.maxHeight}px` }"
    >
      <MentionPicker
        ref="mentionPicker"
        :list-id="mentionListId"
        :query="referenceState.query.value?.query ?? ''"
        :search-input="referenceState.buttonOpen.value"
        :skills="skills"
        :skills-loading="skillCatalog.loading.value"
        :skills-error="skillCatalog.error.value"
        :selected-skills="referenceState.selectedSkills.value"
        :selected-extensions="referenceState.selectedExtensions.value"
        :references="conversationReferences"
        :capability="referenceState.capabilityState.value"
        :thread-id="targetThreadId"
        :project-id="projectId"
        :busy="referenceState.busy.value"
        :error="referenceState.error.value"
        @select="referenceState.select"
        @close="
          referenceState.close();
          focusComposerAt(input.length);
        "
        @active-option-change="activeMentionOption = $event"
        @retry-skills="skillCatalog.refetch()"
        @retry-capability="referenceState.capability.refetch()"
      />
    </div>
    <!--
      斜杠目录挂在**整叠 composer 的定位父**上，不在输入框边框里面——上游
      input-box.tsx:2139 就是这个位置（`{showSkillSuggestions && ...}` 排在
      `<PromptInput>` 之前），于是它 `bottom-full` 贴的是整个 composer 的上沿、
      宽度跟着 composer 走。本仓原来把它塞在 ComposerSurface 内部，于是量到的是
      边框内沿、宽度写死 320px。几何面只取 settle 锚点（浮层不在里面），所以这一处
      台账测不到，得照着上游的 DOM 位置摆。
    -->
    <div
      v-if="suggestions.length > 0"
      v-show="showSuggestions"
      class="z-50 mb-2 px-1"
      :class="
        skillSuggestionsInline
          ? 'relative'
          : 'absolute right-0 bottom-full left-0'
      "
    >
      <div
        :id="commandListId"
        role="listbox"
        :aria-label="$i18n.t.value.primitives.skillSuggestions"
        class="bg-popover/95 text-popover-foreground border-border overflow-y-auto rounded-xl border p-1 shadow-lg backdrop-blur-sm"
        :style="{ maxHeight: skillSuggestionsMaxHeight }"
      >
        <!--
          `mouseenter` 把活动项挪到指针下那一项，与上游 input-box.tsx:2160 一致。
          少了它，`aria-selected` 说的是第一项、`mousedown` 生效的却是指针下那一项,
          读屏器听到的和点下去发生的是两回事。
        -->
        <button
          v-for="(suggestion, index) in suggestions"
          :id="`${commandListId}-${suggestion.kind}-${suggestion.name}`"
          :key="`${suggestion.kind}:${suggestion.name}`"
          tabindex="-1"
          role="option"
          type="button"
          :aria-selected="index === suggestionIndex"
          class="aria-selected:bg-accent aria-selected:text-accent-foreground text-popover-foreground hover:bg-accent/70 hover:text-accent-foreground flex min-h-12 w-full min-w-0 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors"
          @mouseenter="suggestionIndex = index"
          @mousedown.prevent="
            suggestionIndex = index;
            applySuggestion(suggestion);
          "
        >
          <Target
            v-if="suggestion.kind === 'builtin'"
            class="text-muted-foreground size-4 shrink-0"
            aria-hidden="true"
          />
          <Sparkles
            v-else
            class="text-muted-foreground size-4 shrink-0"
            aria-hidden="true"
          />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-medium"
              >/{{ suggestion.name }}</span
            >
            <span
              v-if="suggestion.description"
              class="text-muted-foreground block truncate text-xs"
              >{{ suggestion.description }}</span
            >
          </span>
        </button>
      </div>
    </div>
    <!--
      **表单上不写 aria-disabled。** 上游 input-box.tsx 一处都没有，它把
      `disabled` 逐个发给真正的控件（composerLocked）。`aria-disabled` 是**向下继承**的：
      挂在这一层，可访问性树里连里面那两个 `role="group"` 的 addon 都会被标成
      disabled，而 group 根本不是可禁用的角色；更糟的是它会替那些**并没有被禁用**的
      控件宣布「不可用」——本仓的语音按钮就是这样：DOM 上是可用的，只是被
      `pointer-events-none` 盖住，读屏器却听到 disabled。
      要说「不可用」，就把 disabled 发给控件本身。

      **输入框是这里唯一的例外，而且例外的理由正好也是「发给控件本身」**：
      它用 `readonly` + 自己身上的 `aria-disabled`，不用 `disabled`。
      给一个**正被聚焦**的控件置 `disabled`，浏览器会当场把它失焦
      （`focusout`，`relatedTarget` 为 null），而摘掉 `disabled` **不会把焦点还回来**
      ——键盘用户发完一条消息就落在 `<body>` 上，得重新 Tab 回来。
      `readonly` 挡住编辑、保住焦点、留在 Tab 序里，`aria-disabled` 照样播报不可用。
      wave 178 在上游实测到这件事：锁只闪了 12ms，焦点却永久丢了。
    -->
    <form
      class="mx-auto w-full"
      :class="disabled ? 'pointer-events-none opacity-60' : ''"
      :aria-busy="compactPending || submissionPending"
      @submit.prevent="submit"
    >
      <ComposerSurface
        :class="
          [surfaceClass, polishing ? 'ring-primary/25 shadow-lg ring-1' : '']
            .filter(Boolean)
            .join(' ')
        "
      >
        <!-- 欢迎区透传给 ComposerSurface，理由见那份文件里的注释。 -->
        <template v-if="$slots.extraHeader" #extraHeader>
          <slot name="extraHeader" />
        </template>
        <!-- header / footer 都是 React 的 InputGroupAddon，role="group"。 -->
        <div
          v-if="
            selectedFiles.length ||
            referenceState.attachments.value.length ||
            polishing ||
            (references?.length ?? 0) ||
            (referenceState.capability.error.value &&
              referenceState.inline.value.some(
                (ref) => ref.kind === 'conversation',
              ))
          "
          role="group"
          data-slot="input-group-header"
          :data-testid="
            selectedFiles.length ? 'composer-attachments' : undefined
          "
        >
          <div
            v-if="
              referenceState.capability.error.value &&
              referenceState.inline.value.some(
                (ref) => ref.kind === 'conversation',
              )
            "
            role="alert"
            class="w-full text-xs"
          >
            {{ $i18n.t.value.inputBox.mentionFailed }}
            <button
              type="button"
              class="underline"
              data-testid="retry-conversation-capability"
              @click="referenceState.capability.refetch()"
            >
              {{ $i18n.t.value.inputBox.mentionRetry }}
            </button>
          </div>
          <ComposerAttachmentChip
            v-for="file in selectedFiles"
            :key="attachmentKey(file)"
            :file="file"
            @remove="
              selectedFiles = selectedFiles.filter((item) => item !== file)
            "
          />
          <div
            v-for="attachment in referenceState.attachments.value.filter(
              (file) => !file.source_document_id,
            )"
            :key="attachment.virtual_path"
            class="bg-muted text-muted-foreground flex h-7 items-center gap-1.5 rounded-full border py-0 pr-1 pl-2.5 text-xs font-medium"
            data-testid="project-attachment-chip"
          >
            <Paperclip class="size-3" />
            <span class="max-w-40 truncate">{{ attachment.filename }}</span>
            <button
              :aria-label="$i18n.t.value.inputBox.removeProjectAttachment"
              class="hover:bg-primary/20 focus-visible:ring-primary/40 -mr-0.5 ml-0.5 flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none"
              type="button"
              @click="referenceState.removeAttachment(attachment)"
            >
              <X class="size-3" />
            </button>
          </div>
          <!--
            润色中的胶囊，逐条对着上游 input-box.tsx:2235。三处此前对不上：

            ① **没有 role / 没有 aria-live**。上游写的是 `role="status"` +
               `aria-live="polite"`：润色是个几秒钟、没有其它可见反馈的异步动作，
               读屏器用户此前听不到它开始、也听不到它结束。
            ② 指示器是一颗 8px 的脉冲圆点，上游是 12px 的 `Loader2` 转圈。
               脉冲不表达进度，动效停下来跟做完了长得一样。
            ③ **取消键此前在页脚**，把优化键整个换掉（还带一段可见文字"取消"）。
               上游的取消键在这颗胶囊里——就在"正在优化"这句话旁边，
               而页脚那颗优化键**原地不动**，只把图标换成转圈。
          -->
          <div
            v-if="polishing"
            role="status"
            aria-live="polite"
            class="text-primary bg-primary/10 border-primary/20 relative z-30 flex h-7 items-center gap-1.5 rounded-full border py-0 pr-1 pl-2.5 text-xs font-medium"
          >
            <Loader2 class="size-3 animate-spin" />
            {{ $i18n.t.value.inputBox.inputPolishing }}
            <button
              data-testid="cancel-polish-input-button"
              type="button"
              class="hover:bg-primary/20 focus-visible:ring-primary/40 -mr-0.5 ml-0.5 flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none"
              :aria-label="$i18n.t.value.inputBox.inputPolishCancel"
              @click="cancelPolish"
            >
              <X class="size-3" />
            </button>
          </div>
          <!--
            引文块也在 header 里，排在附件与润色指示之后——上游 input-box.tsx:2229
            就是这个次序，而那个 header 正是 PromptInputHeader / InputGroupAddon。
            本仓原来把它放在 ComposerSurface **外面**、靠 `mb-2` 拉开距离。
            两个 composer 当时都这么写，所以「sidecar 与主输入框等高」这条不变量
            照样成立；把 sidecar 那份搬进 header 之后它就塌了（sidecar 高 4px：
            `mb-2` 的 8px 换成了 header 的 `pt-3` 12px）。真正的修法是两处一起搬，
            而不是把 sidecar 搬回去——上游两处都在 header 里。
          -->
          <ReferenceAttachment
            :references="references ?? []"
            test-id="conversation-quote-attachment"
            clearable
            @clear="emit('clearReferences')"
          />
        </div>
        <div data-slot="input-group-body">
          <div
            v-if="referenceState.inline.value.length || inlineEditorActive"
            class="max-h-48 min-h-6 w-full min-w-0 cursor-text overflow-y-auto text-base leading-7 break-words whitespace-pre-wrap md:text-sm"
            @click.self="focusComposerAt(input.length)"
          >
            <span
              ref="referenceEditor"
              role="textbox"
              data-slot="input-group-control"
              aria-multiline="true"
              :aria-label="$i18n.t.value.inputBox.placeholder"
              :aria-placeholder="$i18n.t.value.inputBox.placeholder"
              :data-empty="input.length === 0"
              :data-placeholder="$i18n.t.value.inputBox.placeholder"
              :contenteditable="!composerLocked"
              :tabindex="composerLocked ? -1 : 0"
              :aria-disabled="composerLocked || undefined"
              :aria-controls="
                referenceState.show.value
                  ? mentionListId
                  : showSuggestions
                    ? commandListId
                    : undefined
              "
              :aria-activedescendant="
                referenceState.show.value
                  ? activeMentionOption
                  : showSuggestions && suggestions[suggestionIndex]
                    ? `${commandListId}-${suggestions[suggestionIndex]!.kind}-${suggestions[suggestionIndex]!.name}`
                    : undefined
              "
              class="before:text-muted-foreground block min-h-6 outline-none before:pointer-events-none data-[empty=true]:before:content-[attr(data-placeholder)]"
              :class="composerLocked ? 'cursor-not-allowed opacity-50' : ''"
              @input="onReferenceInput"
              @keydown="onKeydown"
              @keyup="onReferenceCaretKeyup"
              @click="updateMentionCaret"
              @paste="onReferencePaste"
              @focus="textareaFocused = true"
              @blur="textareaFocused = false"
              @compositionstart="compositionActive = true"
              @compositionend="endComposition"
            />
          </div>
          <textarea
            v-else
            ref="textarea"
            v-model="input"
            name="message"
            data-slot="input-group-control"
            :aria-label="$i18n.t.value.inputBox.placeholder"
            :placeholder="$i18n.t.value.inputBox.placeholder"
            rows="1"
            class="placeholder:text-muted-foreground/60 flex field-sizing-content max-h-48 min-h-6! w-full min-w-0 resize-none bg-transparent p-0! text-base leading-6! outline-none focus-visible:ring-0 focus-visible:outline-none md:text-sm"
            :readonly="composerLocked"
            :aria-disabled="composerLocked || undefined"
            :aria-controls="
              referenceState.show.value
                ? mentionListId
                : showSuggestions
                  ? commandListId
                  : undefined
            "
            :aria-activedescendant="
              referenceState.show.value
                ? activeMentionOption
                : showSuggestions && suggestions[suggestionIndex]
                  ? `${commandListId}-${suggestions[suggestionIndex]!.kind}-${suggestions[suggestionIndex]!.name}`
                  : undefined
            "
            @input="onTextareaInput"
            @select="onTextareaSelect"
            @selectionchange="onTextareaSelect"
            @keydown="onKeydown"
            @focus="textareaFocused = true"
            @blur="textareaFocused = false"
            @compositionstart="compositionActive = true"
            @compositionend="endComposition"
          />
        </div>
        <!--
          页脚是**两组**控件，不是一排加一根撑杆。上游
          `input-box.tsx:2323` 是 `PromptInputFooter`（= `InputGroupAddon
          align="block-end"`，带 `justify-between`）里放两个 `PromptInputTools`
          （= `flex items-center gap-1`）：左边 `min-w-0 flex-1 flex-wrap`
          装附件/语音/优化/模式/推理档，右边 `min-w-0 justify-end` 装字数、
          模型选择器与提交。

          本仓原来是一排平铺 + 一颗 `<span class="flex-1" />` 当撑杆，位置**看着**
          一样，实际把左半边整体推到了右边：实测模式键 React x=468.5 / 本仓 805.2，
          推理档 React 523.6 / 本仓 860.3（窄屏同理，121 vs 160.1）。台账上
          `menuitemradio` 那几条 x 差（Δ-55 / Δ67 / Δ218）全是从这里来的——
          弹层贴着触发器走，触发器错了多少，菜单就错多少。

          `flex-wrap sm:flex-nowrap` 也照抄：窄屏放不下时上游是换行，
          本仓原来只会把这一排压扁。
        -->
        <!-- gap-2! preserves footer row spacing over ComposerSurface scoped styles. -->
        <div
          role="group"
          data-slot="input-group-footer"
          class="flex-wrap justify-between gap-2! sm:flex-nowrap"
        >
          <div class="flex min-w-0 flex-1 flex-wrap items-center gap-1">
            <Tooltip>
              <TooltipTrigger>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  data-testid="mention-button"
                  :aria-label="$i18n.t.value.inputBox.mentionPicker"
                  :disabled="composerLocked"
                  @click="openMentions"
                  ><AtSign class="size-4"
                /></Button>
              </TooltipTrigger>
              <TooltipContent side="top">{{
                $i18n.t.value.inputBox.mentionPicker
              }}</TooltipContent>
            </Tooltip>
            <div class="relative">
              <Tooltip>
                <TooltipTrigger>
                  <!--
                  上游这三颗（附件 / 语音 / 优化）都是 `PromptInputButton`
                  = `InputGroupButton size="sm"` = `<Button variant="ghost">`
                  再叠 `h-8 px-2.5 gap-1.5 rounded-md`，调用点加 `px-2!`。
                  手写那版尺寸抄对了，但少了 ghost 变体的
                  `hover:text-accent-foreground` 与 `dark:hover:bg-accent/50`
                  （深色主题下 hover 底色不一样）、少了 `transition-all`，
                  而且禁用时用的是 `cursor-not-allowed` 而不是
                  `pointer-events-none`——后者会连 tooltip 一起挡住，
                  上游禁用的按钮是**不弹提示**的。
                  颜色不用各自写：`input-group-footer` 容器本身就是
                  `text-muted-foreground`（上游 input-group.tsx:40 同样）。
                -->
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    class="px-2!"
                    data-testid="add-attachments-button"
                    :aria-label="$i18n.t.value.inputBox.addAttachments"
                    :disabled="composerLocked"
                    @click="openMentions"
                  >
                    <Paperclip class="size-3" aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" align="start" class="w-56">
                  {{
                    $i18n.t.value.uploads.limitsHint(
                      limits?.max_files ?? 10,
                      formatUploadSize(
                        limits?.max_file_size ?? 50 * 1024 * 1024,
                      ),
                      formatUploadSize(
                        limits?.max_total_size ?? 100 * 1024 * 1024,
                      ),
                    )
                  }}
                </TooltipContent>
              </Tooltip>
              <!--
              hidden 而不是 sr-only。React 的同一个 input 也带 aria-label，但它是
              display:none（frontend/src/components/ai-elements/prompt-input.tsx 的
              className="hidden"），因此**不进**可访问性树。sr-only 会让读屏器在纸夹
              按钮旁边再念出一个同义的「上传文件」按钮，多出一个并不存在的入口。
            -->
              <input
                ref="fileInput"
                type="file"
                multiple
                :aria-label="$i18n.t.value.inputBox.uploadFiles"
                class="hidden"
                @change="chooseFiles"
              />
            </div>
            <!--
            提示走 Tooltip 组件，**不是 `title`**。上游 VoiceInputButton 外面包的是
            `<Tooltip>`（input-box.tsx:2339）；原生 `title` 是浏览器自己的气泡：
            延迟、位置、配色都不受控，深色主题下尤其突兀，而且触屏上根本不出现。
            两边都用同一个 Tooltip 才是同一个可感知行为。
          -->
            <Tooltip>
              <TooltipTrigger>
                <Button
                  data-testid="voice-input-button"
                  type="button"
                  variant="ghost"
                  size="sm"
                  :class="voiceButtonClass"
                  :aria-label="
                    voiceListening
                      ? $i18n.t.value.inputBox.voiceInputStopLabel
                      : $i18n.t.value.inputBox.voiceInputStartLabel
                  "
                  :aria-pressed="voiceListening"
                  :disabled="composerLocked || !voiceSupported"
                  @click="toggleVoiceInput"
                >
                  <Square v-if="voiceListening" class="size-3 fill-current" />
                  <Mic v-else class="size-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {{
                  voiceSupported
                    ? voiceListening
                      ? $i18n.t.value.inputBox.voiceInputListening
                      : $i18n.t.value.inputBox.voiceInputStart
                    : $i18n.t.value.inputBox.voiceInputUnsupported
                }}
              </TooltipContent>
            </Tooltip>
            <!--
            **只有图标，没有可见文字**，提示走 Tooltip——与上游逐条一致
            （input-box.tsx:2345 的 `<Tooltip>` 包着一颗只放 `SparklesIcon` 的
            PromptInputButton）。本仓原来多渲染了一段 `优化输入` 文字且没有
            Tooltip，实测这一颗从 28px 宽变成 82px，把左侧控件簇整体推宽 54px。

            图标用 `Sparkles` 而不是 `WandSparkles`：上游是 `SparklesIcon`，
            两个是不同的字形。

            **润色中这颗键不消失**（上游 2354 的三目在同一颗 PromptInputButton
            里换图标）：位置固定的一颗键换图标，和"这颗键被另一颗顶掉了"，
            对键盘 tab 序与读屏器是两回事。
          -->
            <Tooltip>
              <TooltipTrigger>
                <Button
                  data-testid="polish-input-button"
                  type="button"
                  variant="ghost"
                  size="sm"
                  class="px-2!"
                  :aria-label="
                    polishUndoAvailable
                      ? $i18n.t.value.inputBox.inputPolishUndo
                      : $i18n.t.value.inputBox.inputPolish
                  "
                  :disabled="polishDisabled"
                  @click="polish"
                >
                  <Loader2 v-if="polishing" class="size-3 animate-spin" />
                  <Undo2 v-else-if="polishUndoAvailable" class="size-3" />
                  <Sparkles v-else class="size-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {{
                  polishing
                    ? $i18n.t.value.inputBox.inputPolishing
                    : polishUndoAvailable
                      ? $i18n.t.value.inputBox.inputPolishUndo
                      : $i18n.t.value.inputBox.inputPolish
                }}
              </TooltipContent>
            </Tooltip>
            <DropdownMenu>
              <DropdownMenuTrigger>
                <ModeHoverGuide
                  :label="activeMode.label"
                  :description="activeMode.description"
                >
                  <!--
                  触发器要接 disabled，与上游同一个 `composerLocked`
                  （input-box.tsx:2391 的 `disabled={composerLocked}`）。
                  只读会话里它此前仍然是可聚焦、可展开的：菜单打得开、
                  选中一项还会写回 context，而这条会话根本发不出消息。
                -->
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    data-testid="composer-mode-trigger"
                    class="max-w-28 gap-1! px-2! sm:max-w-none"
                    :disabled="composerLocked"
                  >
                    <!--
                    图标与文字各占一层，与上游同构（input-box.tsx:2393 的两个 div）。
                    没有显式 mode 时上游四条判断全不成立、什么也不画，所以这里同样
                    挂在 explicitMode 上——按钮此时是一颗无名的空按钮，两边一致。
                  -->
                    <div>
                      <component
                        :is="activeMode.icon"
                        v-if="explicitMode"
                        class="size-3"
                        :class="activeMode.golden ? 'text-[#dabb5e]' : ''"
                      />
                    </div>
                    <div
                      class="truncate text-xs font-normal"
                      :class="
                        explicitMode && activeMode.golden ? 'golden-text' : ''
                      "
                    >
                      {{ explicitMode ? activeMode.label : "" }}
                    </div>
                  </Button>
                </ModeHoverGuide>
              </DropdownMenuTrigger>
              <!--
              `align="start"`、**不传 `side`**——上游
              `PromptInputActionMenuContent`（ai-elements/prompt-input.tsx:1066）
              就是 `<DropdownMenuContent align="start" />`，也就是 side 走
              primitive 的默认 `bottom` 再交给碰撞检测。本仓原来写死
              `align="end" side="top"`：桌面上因为触发器贴着视口底、两边都翻到
              top，看着一样；**窄屏上就露馅**——上游的菜单在触发器下方
              （实测 y=305），本仓恒在上方（y=151），台账那条 `y Δ-154` 就是它。
            -->
              <DropdownMenuContent align="start" class="w-80">
                <!--
                分组标题在 radio group **里面**，与上游同构（上游原来把它放在外面
                一层 DropdownMenuGroup 里，两层 role="group" 中有一层什么都不命名，
                已两边同改成这一种）。`inputBox.mode` 此前在本仓零消费，而未引用扫描
                器按叶子名匹配看不见它——缺的就是这一行。
              -->
                <DropdownMenuRadioGroup
                  :model-value="explicitMode"
                  @update:model-value="selectModeById(String($event))"
                >
                  <DropdownMenuLabel class="text-muted-foreground text-xs">
                    {{ $i18n.t.value.inputBox.mode }}
                  </DropdownMenuLabel>
                  <!--
                  条目的排版照上游（input-box.tsx:2450）：选中的一条整条是
                  `text-accent-foreground`，其余是 `text-muted-foreground/65`；
                  标题行 `font-bold` 带图标，说明行 `pl-7 text-xs` 缩进到标题文字
                  的起点下面。本仓原来是 `font-medium` + 说明行自己写死
                  `text-muted-foreground`，于是选中态在说明行上看不出来。
                -->
                  <!--
                  **不传 `py-2`**：上游这个调用点只传颜色，纵向内边距归
                  primitive（`py-1.5`）。多出来的 2px×2 就是台账上
                  `menuitemradio` 那两条 `height Δ4`。推理档那个菜单 wave 76
                  已经拆过同一条，模式菜单漏了。
                -->
                  <DropdownMenuRadioItem
                    v-for="mode in availableModes"
                    :key="mode.id"
                    :value="mode.id"
                    :class="
                      explicitMode === mode.id
                        ? 'text-accent-foreground'
                        : 'text-muted-foreground/65'
                    "
                  >
                    <span class="flex flex-col gap-2">
                      <span class="flex items-center gap-1 font-bold">
                        <component
                          :is="mode.icon"
                          class="mr-2 size-4"
                          :class="
                            explicitMode === mode.id
                              ? mode.golden
                                ? 'text-[#dabb5e]'
                                : 'text-accent-foreground'
                              : ''
                          "
                        />
                        <span
                          :class="
                            explicitMode === mode.id && mode.golden
                              ? 'golden-text'
                              : ''
                          "
                          >{{ mode.label }}</span
                        >
                      </span>
                      <span class="pl-7 text-xs">{{ mode.description }}</span>
                    </span>
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <slot name="knowledgeScopeControl" :disabled="composerLocked" />
            <DropdownMenu
              v-if="supportsReasoningEffort && explicitMode !== 'flash'"
              v-model:open="reasoningMenuOpen"
            >
              <DropdownMenuTrigger>
                <!--
                上游是 `PromptInputActionMenuTrigger className="gap-1! px-2!"`，
                也就是一颗 ghost Button，文字包在
                `<div className="text-xs font-normal">` 里（input-box.tsx:2561）。
                可见字号两边都是 12px/400；差的是**按钮自己**：手写那版没有
                `cursor-pointer`（实测 React 是 pointer、本仓是 default——
                鼠标停上去一个变小手一个不变）、没有焦点环、没有
                `hover:text-accent-foreground` 与 `dark:hover:bg-accent/50`。
              -->
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  data-testid="composer-reasoning-effort-trigger"
                  class="gap-1! px-2!"
                  :disabled="composerLocked"
                >
                  <div class="text-xs font-normal">
                    {{ $i18n.t.value.inputBox.reasoningEffort }}:
                    {{ activeReasoningEffort.label }}
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <!-- 同上：align/side 都归 PromptInputActionMenuContent 的默认值。 -->
              <DropdownMenuContent align="start" class="w-70">
                <DropdownMenuRadioGroup
                  :model-value="selectedReasoningEffort"
                  @update:model-value="selectReasoningEffort(String($event))"
                >
                  <DropdownMenuLabel class="text-muted-foreground text-xs">
                    {{ $i18n.t.value.inputBox.reasoningEffort }}
                  </DropdownMenuLabel>
                  <!--
                  **每一项按选中态染色。** 上游 input-box.tsx:2597 给每个
                  `DropdownMenuRadioItem` 传的是
                  `context.reasoning_effort === id ? "text-accent-foreground"
                   : "text-muted-foreground/65"`——**没选中的四档是暗的**，
                  选中那一档才是正常前景色。本仓原来一项都不染，四档看起来一模一样，
                  只有那颗单选圆点在区分。wave 76 把几何档接到交互后的锚点上之后
                  当场量出来：React `rgba(115,115,115,166)`、本仓 `rgba(10,10,10,255)`。

                  内层两层也照抄（`flex flex-col gap-2` + `font-bold` 标题 +
                  `pl-2 text-xs` 说明）：本仓原来是 `block` + `text-sm font-medium`
                  + `text-muted-foreground text-xs`，量出来整项比上游矮 4px，
                  而且说明那一行自己写死了 muted——上游那一行跟着整项的颜色走。

                  也**不再传 `py-2`**：上游这个调用点只传颜色，纵向内边距归
                  primitive（`py-1.5`）。多出来的那 2px×2 就是量到的 Δ4。
                -->
                  <DropdownMenuRadioItem
                    v-for="effort in reasoningEfforts"
                    :key="effort.id"
                    :value="effort.id"
                    :class="
                      selectedReasoningEffort === effort.id
                        ? 'text-accent-foreground'
                        : 'text-muted-foreground/65'
                    "
                  >
                    <span class="flex flex-col gap-2">
                      <span class="flex items-center gap-1 font-bold">{{
                        effort.label
                      }}</span>
                      <span class="block pl-2 text-xs">{{
                        effort.description
                      }}</span>
                    </span>
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div class="flex min-w-0 items-center justify-end gap-1">
            <span
              v-if="goalObjectiveCounter"
              data-testid="goal-length-counter"
              :aria-label="
                $i18n.t.value.inputBox.goalLengthCounter
                  .replace('{length}', String(goalObjectiveCounter.length))
                  .replace('{max}', String(goalObjectiveCounter.max))
              "
              class="shrink-0 text-xs tabular-nums"
              :class="
                goalObjectiveCounter.overLimit
                  ? 'text-destructive font-medium'
                  : 'text-muted-foreground'
              "
              >{{ goalObjectiveCounter.length }}/{{
                goalObjectiveCounter.max
              }}</span
            >
            <!--
            disabled 跟着 React 的 composerLocked 走（input-box.tsx:1328 =
            `isComposerDisabled || polishingInput`，2673 行把它交给
            ModelSelectorTrigger 的按钮）：润色期间草稿正被改写，这时换模型
            会让请求打到一个用户还没看见的文本上。
          -->
            <ComposerModelSelector
              :models="models"
              :selected-model="selectedModel"
              :disabled="composerLocked"
              @select="selectModel"
            />
            <!--
            发送与停止是**同一个**按钮，和 React 的 PromptInputSubmit 一样：
            换的是可访问名和图标，不是元素。拆成两个 v-if 分支的话，开始流式输出的
            那一刻焦点所在的按钮被卸载，键盘用户会被丢回 body——而「按回车发出去、
            再按空格停下」正是最常见的一条键盘路径。

            空草稿**不**禁用：React 只在 composerLocked（外部 disabled / 正在润色）
            时禁用。禁用一个看得见的提交按钮会让读屏器连它为什么不能按都说不出来，
            而空提交本来就被 submit() 挡住了。
          -->
            <!--
            上游是 `<PromptInputSubmit className="rounded-full" variant="outline"
            status={status} />`（input-box.tsx:2729），也就是
            `<Button variant="outline" size="icon-sm">`——**描边**的圆钮，
            不是实心的。手写那版画的是 `bg-primary text-primary-foreground`，
            于是这颗键在两个应用里一个是空心一个是实心蓝。
            停止态的方块也差一档：上游 `SquareIcon className="size-4"`（16px），
            手写那版是 12px。

            `shadow-none` 不是多余的：上游这颗走 `InputGroupButton`，
            它的 base 里写着 `shadow-none`，把 outline 变体的 `shadow-xs`
            盖掉了。少这一条，本仓这颗圆钮底下会多出一层 1px 投影
            （实测 R 无 box-shadow，V 是 `rgba(0,0,0,0.05) 0 1px 2px`）。

            上游的 `submitted`（转圈）分支**够不着**：调用点只传
            error / streaming / ready 三种（chat-page.tsx:414），
            所以这里三个分支就是全集，不是少了一支。
          -->
            <Button
              type="submit"
              variant="outline"
              size="icon-sm"
              class="rounded-full shadow-none"
              :aria-label="
                streaming
                  ? !canStopStreaming
                    ? $i18n.t.value.inputBox.stopStreamingUnavailable
                    : $i18n.t.value.primitives.stop
                  : !canCreateRuns
                    ? $i18n.t.value.inputBox.startTurnUnavailable
                    : $i18n.t.value.primitives.submit
              "
              :title="
                streaming && !canStopStreaming
                  ? $i18n.t.value.inputBox.stopStreamingUnavailable
                  : !streaming && !canCreateRuns
                    ? $i18n.t.value.inputBox.startTurnUnavailable
                    : undefined
              "
              :disabled="
                composerLocked ||
                (streaming
                  ? !canStopStreaming
                  : !canCreateRuns || referenceState.unavailable.value)
              "
              @click="onSubmitButtonClick"
            >
              <Square v-if="streaming" class="size-4 fill-current" />
              <X v-else-if="errored" class="size-4" />
              <ArrowUp v-else class="size-4" />
            </Button>
          </div>
        </div>
      </ComposerSurface>
    </form>
    <!--
      建议行外面这层 `pt-2` 是 React 的（input-box.tsx 里
      `<div className="flex items-center justify-center pt-2">`）。它不是装饰：
      欢迎态的整叠是**贴着底边**排的，少这 8px，上面的输入框就整体下移 8px。
    -->
    <div
      v-if="isWelcome && showWelcomeSuggestions !== false"
      v-show="!showSuggestions && !referenceState.show.value"
      class="flex items-center justify-center pt-2"
    >
      <WelcomeSuggestionList
        :disabled="disabled"
        @select="selectWelcomeSuggestion"
      />
    </div>
    <div
      v-if="!isWelcome"
      data-testid="composer-bottom-background"
      aria-hidden="true"
      class="bg-background absolute right-0 -bottom-4 left-0 z-0 h-4"
    />
    <!-- Keep the same muted alpha as the React composer hint. -->
    <p
      data-testid="composer-disclaimer"
      class="text-muted-foreground/67 px-4 text-center text-xs leading-4"
      :class="!isWelcome && 'absolute top-full right-0 left-0'"
    >
      {{ disclaimer }}
    </p>
  </div>
</template>
