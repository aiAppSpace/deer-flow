<script setup lang="ts">
/*
  【文件职责】     DeerFlow 消息分组、reasoning/tool/human-input 渲染与消息操作编排。
  【架构位置】     L3 UI adapter
  【主要导出】     默认 MessageList 组件
  【依赖关系】     core/messages · markdown L2 · artifacts/changes/sidecar 扩展消费者
  【边界与注意】   依赖宿主 Message 与业务卡片；动作/选区归属 composable，虚拟化归属 VirtualMessageList。
*/
import {
  computed,
  defineComponent,
  h,
  markRaw,
  nextTick,
  onUnmounted,
  provide,
  ref,
  watch,
} from "vue";
import {
  Check,
  ChevronUp,
  Loader,
  Loader2,
  MessageCircle,
  MessageSquarePlus,
  X,
} from "lucide-vue-next";

import ScheduledRunPrompt from "@/components/workspace/messages/ScheduledRunPrompt.vue";
import ScheduledTaskCard from "@/components/workspace/messages/ScheduledTaskCard.vue";
import ScheduledTaskEventLine from "@/components/workspace/messages/ScheduledTaskEventLine.vue";
import {
  placeTaskEvents,
  type ScheduledTaskEvent,
} from "@/core/scheduled-tasks/events";
import SkillUsageMenu from "@/components/workspace/skill-usage/SkillUsageMenu.vue";
import { getSkillUsageByGroupIndex } from "@/core/skills/usage";
import AssistantTurnActions from "@/components/chat/AssistantTurnActions.vue";
import HumanTurnActions from "@/components/chat/HumanTurnActions.vue";
import HumanInputCard from "@/components/chat/HumanInputCard.vue";
import CitationSourcesPanel from "@/components/chat/CitationSourcesPanel.vue";
import KnowledgeScopeSummary from "@/components/chat/KnowledgeScopeSummary.vue";
import KnowledgeSourcesPanel from "@/components/chat/KnowledgeSourcesPanel.vue";
import { provideKnowledgeSources } from "./knowledge-sources-context";
import MessageAttachments from "@/components/chat/MessageAttachments.vue";
import HumanMessageText from "@/components/chat/HumanMessageText.vue";
import ConversationReferenceChip from "@/components/chat/ConversationReferenceChip.vue";
import MessageListSkeleton from "@/components/chat/MessageListSkeleton.vue";
import VirtualMessageList from "@/components/chat/VirtualMessageList.vue";
import ConversationOutline from "@/components/chat/ConversationOutline.vue";
import MessageMarkdown from "@/components/chat/MessageMarkdown.vue";
import MessageTokenUsage from "@/components/chat/MessageTokenUsage.vue";
import MarkdownLink from "@/components/chat/MarkdownLink.vue";
import ProcessingMessageGroup from "@/components/chat/ProcessingMessageGroup.vue";
import ReasoningDisclosure from "@/components/chat/ReasoningDisclosure.vue";
import RunActivity from "@/components/chat/RunActivity.vue";
import RunDurationLabel from "@/components/chat/RunDurationLabel.vue";
import SubtaskCard from "@/components/chat/SubtaskCard.vue";
import { resolveSubtaskDescription } from "@/core/tasks/presentation";
import { MARKDOWN_LINK_CONTEXT } from "@/components/chat/markdown-link-context";
import ArtifactFileCards from "@/components/workspace/artifacts/ArtifactFileCards.vue";
import WorkspaceChangesBadge from "@/components/workspace/changes/WorkspaceChangesBadge.vue";
import ReferenceAttachment from "@/components/workspace/sidecar/ReferenceAttachment.vue";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleTrigger } from "@/components/ui/collapsible";
import { isSyntheticValuesMessageId } from "@/core/agent-deerflow/reducer";
import { resolveMessageImageURL } from "@/core/artifacts/utils";
import { extractCitationSources } from "@/core/citations/sources";
import {
  deriveHumanInputThreadState,
  extractHumanInputRequest,
  type HumanInputRequest,
  type HumanInputResponse,
} from "@/core/messages/human-input";
import { getWorkspaceChangeAnchorGroupIndices } from "@/core/messages/workspace-change-anchor";
import { getArtifactArchiveCandidatesByGroupIndex } from "@/core/messages/artifact-archive";
import {
  buildConversationChapters,
  CONVERSATION_OUTLINE_MIN_TURNS,
} from "@/core/messages/conversation-outline";
import { getAssistantTurnUsageMessages } from "@/core/messages/derived-state";
import {
  buildTokenDebugSteps,
  type TokenDebugStep,
} from "@/core/messages/usage-model";
import {
  deriveProcessingMessageView,
  type BrowserViewMeta,
} from "@/core/messages/processing";
import {
  extractContentFromMessage,
  extractPresentFilesFromMessage,
  extractReasoningContentFromMessage,
  getBranchableAssistantGroupIds,
  getLatestEditableTurn,
  getAssistantTurnCopyData,
  getMessageCopyData,
  getMessageGroups,
  isHiddenFromUIMessage,
  isAssistantMessageGroupStreaming,
  stripUploadedFilesTag,
  type MessageGroup,
} from "@/core/messages/utils";
import {
  getMessageRunId,
  getRunDurationDisplaysByGroupIndex,
} from "@/core/messages/run-duration";
import {
  derivePendingSubtaskStatus,
  parseSubtaskResult,
  type SubtaskResultUpdate,
} from "@/core/tasks/subtask-result";
import type { Subtask } from "@/core/tasks/types";
import type { ArtifactEntry } from "@/core/threads/types";
import type { Message } from "@/core/types/message";
import { readReferenceMessageContexts } from "@/core/sidecar";
import { readConversationReferences } from "@/core/conversation-references";
import { pathOfThread } from "@/core/threads/utils";
import { useMessageTurnActions } from "@/composables/useMessageTurnActions";
import { useMessageHumanInput } from "@/composables/useMessageHumanInput";
import {
  useMessageSelection,
  type SelectionPayload,
} from "@/composables/useMessageSelection";
import { useWorkspaceToast } from "@/core/workspace-shell/toast";

/*
  多根模板显式把 attrs 交给日志根；fixed 选区工具条不继承日志布局 class。
*/
defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    messages: Message[];
    rawMessages?: Message[];
    streaming: boolean;
    loading: boolean;
    threadId?: string | null;
    selectionMode?: "main" | "sidecar";
    testId?: string;
    active?: boolean;
    tailRequest?: number;
    /** Fixed tail height after the shared gap-8 and pb-4 spacing. */
    paddingBottom?: number;
    initialScroll?: "smooth" | "instant";
    resizeScroll?: "smooth" | "instant";
    /** Stable submission owner survives exact prepared-thread URL adoption. */
    scrollOwnerKey?: string;
    interactive?: boolean;
    /* An active goal or open human-input card prevents editing and rerunning a human turn. */
    hasGoal?: boolean;
    /*
  与 React chats/chat-page.tsx 的可用性合同一致：uploading 禁止三类操作；
      branchPending 仅禁止分支与编辑，重跑仍可用。线程加载由各动作目标的派生状态限制。
*/
    uploading?: boolean;
    branchPending?: boolean;
    /* Agent chats hide branching; the shared list uses an explicit presentation prop. */
    canBranch?: boolean;
    artifactPaths?: readonly string[];
    toolArtifacts?: readonly ArtifactEntry[];
    isMock?: boolean;
    /** `.skill` 的 Install 只对管理员出现；判据在 ArtifactFileCards 的文件头。 */
    isAdmin?: boolean;
    subtasks?: Record<string, Subtask>;
    activeRunId?: string | null;
    streamingMessageIds?: ReadonlySet<string>;
    hasMoreHistory?: boolean;
    scheduledEvents?: readonly ScheduledTaskEvent[];
    historyLoadingMore?: boolean;
    historyError?: unknown;
    threadError?: unknown;
    /** Session/agent identity supplements the thread id when retiring an editor. */
    editOwnerKey?: string;
    editAndRegenerateMessage?: (
      messageId: string,
      replacementText: string,
      messageIds: string[],
    ) => boolean | undefined | Promise<boolean | undefined>;
    submitHumanInput?: (
      request: HumanInputRequest,
      response: HumanInputResponse,
    ) => boolean | undefined | Promise<boolean | undefined>;
    tokenUsageInlineMode?: "off" | "per_turn" | "step_debug";
    /** 长会话的章节跳转目录。只有主会话开，sidecar 不开。 */
    enableConversationOutline?: boolean;
  }>(),
  {
    rawMessages: undefined,
    threadId: undefined,
    selectionMode: undefined,
    testId: undefined,
    tailRequest: undefined,
    paddingBottom: 24,
    artifactPaths: undefined,
    toolArtifacts: undefined,
    subtasks: undefined,
    activeRunId: undefined,
    streamingMessageIds: undefined,
    scheduledEvents: undefined,
    historyError: undefined,
    threadError: undefined,
    editOwnerKey: undefined,
    editAndRegenerateMessage: undefined,
    submitHumanInput: undefined,
    tokenUsageInlineMode: undefined,
    active: true,
    initialScroll: "smooth",
    resizeScroll: "smooth",
    scrollOwnerKey: undefined,
    /*
  Vue Boolean prop 缺省为 false；显式 true 保留普通会话、sidecar 与 showcase 的分支入口。
*/
    canBranch: true,
  },
);
provideKnowledgeSources(() => props.rawMessages ?? props.messages);
const emit = defineEmits<{
  branch: [messageId: string, messageIds: string[]];
  regenerate: [messageId: string, messageIds: string[]];
  edit: [messageId: string, text: string, messageIds: string[]];
  humanInput: [request: HumanInputRequest, response: HumanInputResponse];
  artifact: [path: string];
  browser: [frame: BrowserViewMeta];
  selectionAsk: [payload: SelectionPayload];
  selectionAdd: [payload: SelectionPayload];
  loadMoreHistory: [];
}>();
const { $i18n } = useNuxtApp();
/*
  提交失败与跨消息选区的通知交给 workspace/showcase layout 提供的 toast owner。
*/
const toast = useWorkspaceToast();
const {
  editState,
  editSubmitDisabled,
  setEditTextarea,
  beginEdit,
  cancelEdit,
  updateAndRerun,
  onEditKeydown,
  copiedMessage,
  actionError,
  copyMessage,
} = useMessageTurnActions({
  owner: () => [props.threadId, props.editOwnerKey],
  submit: () => props.editAndRegenerateMessage,
  groupIds,
  onBeginEdit: (message, ids) => emit("edit", message.id!, text(message), ids),
  notifyError: (message) => toast.error(message),
  copyFailed: () => $i18n.t.value.messages.copyFailed,
});
provide(MARKDOWN_LINK_CONTEXT, {
  threadId: computed(() => props.threadId),
  isMock: computed(() => props.isMock),
});

const MarkdownMessageImage = defineComponent({
  name: "MarkdownMessageImage",
  inheritAttrs: false,
  props: {
    src: { type: String, default: "" },
    alt: { type: String, default: "" },
    node: { type: Object, default: undefined },
  },
  setup(imageProps, { attrs }) {
    return () => {
      if (!imageProps.src) return null;
      const src = props.threadId
        ? resolveMessageImageURL(
            imageProps.src,
            props.threadId,
            props.artifactPaths ?? [],
            { fallbackToOutputs: true, isMock: props.isMock },
          )
        : imageProps.src;
      return h(
        MarkdownLink,
        {
          href: src,
          threadId: props.threadId,
          isMock: props.isMock,
          target: "_blank",
          rel: "noopener noreferrer",
        },
        {
          default: () =>
            h("img", {
              ...attrs,
              src,
              alt: imageProps.alt,
              loading: "lazy",
              decoding: "async",
              class: ["max-w-[90%] overflow-hidden rounded-lg", attrs.class],
            }),
        },
      );
    };
  },
});
const messageMarkdownComponents = markRaw({
  a: MarkdownLink,
  img: MarkdownMessageImage,
});

const groups = computed(() =>
  getMessageGroups(props.messages, {
    isCurrentTurnLoading: props.streaming,
  }),
);
const EMPTY_STREAMING_MESSAGE_IDS: ReadonlySet<string> = new Set();
const streamingAssistantGroups = computed(() =>
  groups.value.map(
    (group) =>
      props.streaming &&
      isAssistantMessageGroupStreaming(
        group.messages,
        props.streamingMessageIds ?? EMPTY_STREAMING_MESSAGE_IDS,
      ),
  ),
);
const assistantCopyData = computed(() =>
  groups.value.map((group, index) =>
    group.type === "assistant"
      ? getAssistantTurnCopyData(group.messages, {
          isStreaming: streamingAssistantGroups.value[index],
        })
      : null,
  ),
);
const placedTaskEvents = computed(() =>
  placeTaskEvents(groups.value, props.scheduledEvents ?? [], {
    hasMoreHistory: props.hasMoreHistory,
  }),
);
// A welcome layout can give an empty timeline zero height. Decorative gutters
// must not turn it into a native, keyboard-focusable empty scroll container.
const hasTimelineContent = computed(
  () =>
    groups.value.length > 0 ||
    props.loading ||
    props.streaming ||
    props.hasMoreHistory ||
    props.historyLoadingMore ||
    placedTaskEvents.value.tail.length > 0,
);
const skillUsageByGroupIndex = computed(() =>
  getSkillUsageByGroupIndex(groups.value),
);
const turnUsageMessagesByGroupIndex = computed(() =>
  getAssistantTurnUsageMessages(groups.value),
);
// Attribution is message-owned. Compute once over the full wire order, then
// project each group; per-turn accumulation remains a separate contract.
const tokenDebugSteps = computed(() =>
  props.tokenUsageInlineMode === "step_debug"
    ? buildTokenDebugSteps(props.messages, $i18n.t.value)
    : [],
);
function tokenDebugStepsForMessages(
  messages: readonly Message[],
): TokenDebugStep[] {
  const ids = new Set(
    messages
      .filter(
        (message) => message.type === "ai" && typeof message.id === "string",
      )
      .map((message) => message.id),
  );
  return tokenDebugSteps.value.filter((step) => ids.has(step.messageId));
}
function inlineTokenDebugSteps(group: MessageGroup): TokenDebugStep[] {
  if (group.type === "assistant:processing") return [];
  return tokenDebugStepsForMessages(
    group.type === "assistant:subagent"
      ? group.messages.filter((message) => !reasoning(message))
      : group.messages,
  );
}
/*
  归档下载键挂在**这次运行最后一组** present-files 上，判据在
  core/messages/artifact-archive.ts。不是「组里最后一条消息的 run_id」
  （那是 runIdOfGroup 干的，用途不同）——同一次运行分几次呈递时，
  每组都拿得到 run_id，但键只该出现一次。
*/
const archiveCandidates = computed(() =>
  getArtifactArchiveCandidatesByGroupIndex(groups.value),
);

/*
  会话目录：够长才出现（少于 5 轮滚一下就到了）。

  「当前是哪一章」**记着 threadId 一起**：切走再切回来时，上一条会话的章节 id
  在这一条里不存在，高亮要落空而不是错误地标在同位置的另一章上。
*/
const chapters = computed(() =>
  buildConversationChapters(
    groups.value,
    $i18n.t.value.conversation.outlineAttachmentFallback,
  ),
);
const outlineEnabled = computed(
  () =>
    props.enableConversationOutline === true &&
    chapters.value.length >= CONVERSATION_OUTLINE_MIN_TURNS,
);
const activeChapter = ref<{
  threadId: string | null;
  chapterId: string;
} | null>(null);
const activeChapterId = computed(() => {
  const current = activeChapter.value;
  if (!current || current.threadId !== (props.threadId ?? null)) return null;
  return chapters.value.some((chapter) => chapter.id === current.chapterId)
    ? current.chapterId
    : null;
});

/*
  跳到某一组。虚拟窗口是自己滚出来的，所以要**两步**：先把窗口挪到能包含
  目标那一组，等它渲染出来，再滚到那个元素。少了第一步，目标还在窗口外面，
  `querySelector` 什么都找不到，点了没反应。
*/
async function scrollToGroup(groupIndex: number) {
  stopFollowingTail();
  await virtualList.value?.scrollToGroup(groupIndex);
}
function activeGroupChanged(groupIndex: number) {
  const chapter = [...chapters.value]
    .reverse()
    .find((chapter) => chapter.groupIndex <= groupIndex);
  if (chapter)
    activeChapter.value = {
      threadId: props.threadId ?? null,
      chapterId: chapter.id,
    };
}

async function selectChapter(chapterId: string) {
  const chapter = chapters.value.find(
    (candidate) => candidate.id === chapterId,
  );
  if (!chapter) return;
  activeChapter.value = { threadId: props.threadId ?? null, chapterId };
  await scrollToGroup(chapter.groupIndex);
}
const branchable = computed(() =>
  getBranchableAssistantGroupIds(groups.value, props.streaming),
);
/*
  编辑 API 需要真实服务端消息 id。values 快照 reducer 生成的位置键仅供存储；
  在此适配边界拒绝它，保持共享 getLatestEditableTurn 的协议无关语义。
*/
const editable = computed(() => {
  const turn = getLatestEditableTurn(groups.value, props.streaming);
  if (!turn) return null;
  return isSyntheticValuesMessageId(turn.humanMessage.id) ? null : turn;
});
/*
  重跑目标按类型从尾部寻找最新 assistant 回合；后续 clarification/processing 组不改变目标。
*/
const latestAssistantGroupId = computed(() => {
  if (props.streaming) return null;
  for (let index = groups.value.length - 1; index >= 0; index -= 1) {
    if (groups.value[index]?.type === "assistant") {
      return groups.value[index]?.id ?? null;
    }
  }
  return null;
});
/*
  后端 turn_duration 尚未随历史返回时，使用 streaming 下降沿测得的本次耗时。
  键仅使用 group.id：空 thread id → 真 id 是同一会话的交接；真正切换旧会话时清空缓存。
*/
const clientDurationsByGroupId = ref(new Map<string, number>());
watch(
  () => props.threadId,
  (next, previous) => {
    if (previous) clientDurationsByGroupId.value = new Map();
  },
);
function clientDurationKey(groupId: string) {
  return groupId;
}
const durations = computed(() => {
  const persisted = getRunDurationDisplaysByGroupIndex(groups.value);
  return persisted.map((rows, index) => {
    // 后端给了就用后端的：兜底只在这一格是空的时候顶上。
    if (rows.length > 0) return rows;
    const group = groups.value[index];
    if (props.threadError || !group?.id) return rows;
    const durationSeconds = clientDurationsByGroupId.value.get(
      clientDurationKey(group.id),
    );
    if (durationSeconds === undefined) return rows;
    return [{ runId: `client:${group.id}`, durationSeconds }];
  });
});
function renderedReasoningMessages(group: MessageGroup): Message[] {
  if (group.type === "assistant")
    return group.messages.filter((message) => reasoning(message));
  if (group.type === "assistant:subagent") {
    return group.messages.filter(
      (message) =>
        deriveProcessingMessageView([message]).trailingReasoning?.messageId ===
        message.id,
    );
  }
  if (group.type === "assistant:processing") {
    const target = deriveProcessingMessageView(
      group.messages,
    ).trailingReasoning;
    return target
      ? group.messages.filter((message) => message.id === target.messageId)
      : [];
  }
  return [];
}
const reasoningDurations = computed(() =>
  groups.value.map((group, index) => {
    const result = new Map<
      Message,
      { runId: string; durationSeconds: number }
    >();
    if (props.streaming && index === groups.value.length - 1) return result;
    const targets = renderedReasoningMessages(group);
    for (const display of durations.value[index] ?? []) {
      const target = targets.find(
        (message) =>
          getMessageRunId(message) === display.runId ||
          display.runId === `client:${group.id}`,
      );
      if (target) result.set(target, display);
    }
    return result;
  }),
);
function separateDurations(index: number) {
  const inline = new Set(
    [...(reasoningDurations.value[index]?.values() ?? [])].map(
      (display) => display.runId,
    ),
  );
  return (durations.value[index] ?? []).filter(
    (display) => !inline.has(display.runId),
  );
}
/*
  HIL legacy 回答判定只认产品可见 human 消息；控制消息和斜杠技能激活不能替用户回答。
*/
const humanInputState = computed(() =>
  deriveHumanInputThreadState(
    props.rawMessages ?? props.messages,
    (message) => !isHiddenFromUIMessage(message),
  ),
);
/*
  存在待答 HIL 请求时禁止编辑并重跑，避免退休仍等待回答的请求；复用同一 humanInputState。
*/
const hasOpenHumanInput = computed(
  () => humanInputState.value.latestOpenRequestId !== null,
);
const { pendingHumanInputs, handleHumanInputSubmit } = useMessageHumanInput({
  owner: () => [props.threadId, props.editOwnerKey],
  state: () => humanInputState.value,
  streaming: () => props.streaming,
  threadError: () => props.threadError,
  submit: () => props.submitHumanInput,
  dispatch: (request, response) => emit("humanInput", request, response),
  notifyError: (message) => toast.error(message),
});
const hasActiveAssistantText = computed(() => {
  let lastHumanIndex = -1;
  for (let index = groups.value.length - 1; index >= 0; index -= 1) {
    if (groups.value[index]?.type === "human") {
      lastHumanIndex = index;
      break;
    }
  }
  return (
    lastHumanIndex >= 0 &&
    groups.value
      .slice(lastHumanIndex)
      .some((group) => group.type === "assistant")
  );
});
const turnStartTime = ref<number | null>(props.streaming ? Date.now() : null);
const scroller = ref<HTMLElement | null>(null);
const contentElement = ref<HTMLElement | null>(null);
const historySentinel = ref<HTMLElement | null>(null);
const virtualList = ref<InstanceType<typeof VirtualMessageList> | null>(null);
const followingTail = ref(true);
const isListActive = computed(() => props.active !== false);
const scrollOwner = computed(() =>
  JSON.stringify([props.scrollOwnerKey ?? props.threadId, props.editOwnerKey]),
);
watch(
  scrollOwner,
  () => {
    virtualList.value?.stopFollowingTail();
    followingTail.value = true;
    userScrollIntent = false;
  },
  { flush: "sync" },
);
const {
  selection,
  selectionToolbarMargin,
  selectionToolbarElement,
  onSelection,
  dispatchSelection,
} = useMessageSelection({
  owner: () => [props.threadId, props.editOwnerKey],
  enabled: () => Boolean(props.selectionMode) && !props.streaming,
  groups: () => groups.value,
  crossedMessages: () =>
    toast.info($i18n.t.value.sidecar.selectionCrossesMessages),
  dispatch: (action, payload) => {
    if (action === "ask") emit("selectionAsk", payload);
    else emit("selectionAdd", payload);
  },
});
let userScrollIntent = false;
let historyObserver: IntersectionObserver | undefined;
let historyRequestPending: object | null = null;
const historyInteractionArmed = ref(false);

function text(message: Message) {
  return extractContentFromMessage(message);
}
function reasoning(message: Message) {
  return extractReasoningContentFromMessage(message);
}
function citations(message: Message) {
  return extractCitationSources(text(message));
}
function subtaskTerminal(
  toolCallId: string | undefined,
): SubtaskResultUpdate | undefined {
  const result = props.messages.find(
    (message) => message.type === "tool" && message.tool_call_id === toolCallId,
  );
  if (!result) return undefined;
  return parseSubtaskResult(text(result), result.additional_kwargs);
}
function subtaskPendingStatus(toolCallId: string | undefined) {
  return derivePendingSubtaskStatus(
    toolCallId,
    props.messages,
    props.streaming,
  );
}
function subtaskDescription(args: Record<string, unknown> | undefined) {
  return resolveSubtaskDescription(
    args?.description,
    args?.prompt,
    $i18n.t.value.subtasks.subtask,
  );
}
function subtaskPrompt(args: Record<string, unknown> | undefined) {
  return typeof args?.prompt === "string" ? args.prompt : "";
}
function subtaskId(
  toolCallId: string | undefined,
  groupIndex: number,
  callIndex: number,
) {
  return toolCallId ?? `task-${groupIndex}-${callIndex}`;
}
/*
  这条消息里 `task` 工具调用的条数，也就是组头要报的数字。

  上游是按**组**去重后数的（`tasks: Set<Subtask>`），但 assistant:subagent 组
  只可能装一条 ai 消息——getMessageGroups 里每遇到一条 hasSubagent 的消息就
  `groups.push({ type: "assistant:subagent", messages: [message] })` 新开一组，
  后续只有 tool 结果消息会被追加进来，而那些不带 task 调用。所以「每组一次」
  和「每条带 task 调用的 ai 消息一次」是同一件事。
*/
function subtaskCallCount(message: Message) {
  if (message.type !== "ai") return 0;
  let count = 0;
  for (const call of message.tool_calls ?? []) {
    if (call.name === "task") count += 1;
  }
  return count;
}
function groupIds(index: number) {
  const ids: string[] = [];
  for (let cursor = 0; cursor <= index; cursor += 1) {
    for (const message of groups.value[cursor]?.messages ?? []) {
      if (message.id) ids.push(message.id);
    }
  }
  return ids;
}
function lastAI(index: number) {
  return [...(groups.value[index]?.messages ?? [])]
    .reverse()
    .find((message) => message.type === "ai");
}
function stopFollowingTail() {
  followingTail.value = false;
  virtualList.value?.stopFollowingTail();
}
function onScroll() {
  if (!scroller.value) return;
  const scrollRange = scroller.value.scrollHeight - scroller.value.clientHeight;
  const atTail =
    scrollRange <= 0 ||
    scroller.value.scrollTop + scroller.value.clientHeight >=
      scroller.value.scrollHeight - 1;
  if (atTail) {
    followingTail.value = true;
    userScrollIntent = false;
    return;
  }
  if (userScrollIntent) {
    stopFollowingTail();
    userScrollIntent = false;
  }
  // Capture pagination only after consuming this scroll's reading intent;
  // otherwise a second stop would discard the newly captured physical anchor.
  if (
    historyInteractionArmed.value &&
    scroller.value.scrollTop <= 80 &&
    props.hasMoreHistory
  ) {
    requestHistoryLoad();
  }
}
function onScrollIntent() {
  userScrollIntent = true;
  historyInteractionArmed.value = true;
}
function onPointerDown(event: PointerEvent) {
  // Mouse text selection is paused by the physical scroll owner. Only direct
  // scrollbar manipulation marks generic scroll intent; touch retains its
  // existing native-scroll path.
  if (event.pointerType !== "mouse" || event.target === scroller.value)
    onScrollIntent();
}
function onWheel(event: WheelEvent) {
  if (
    event.deltaY < 0 &&
    scroller.value &&
    scroller.value.scrollHeight > scroller.value.clientHeight
  ) {
    historyInteractionArmed.value = true;
    userScrollIntent = false;
    stopFollowingTail();
  }
}
function onScrollKey(event: KeyboardEvent) {
  if (
    ["ArrowUp", "PageUp", "Home"].includes(event.key) ||
    (event.key === " " && event.shiftKey)
  ) {
    historyInteractionArmed.value = true;
    onScrollIntent();
  }
}
function requestHistoryLoad() {
  if (
    !props.hasMoreHistory ||
    props.historyLoadingMore ||
    !scroller.value ||
    historyRequestPending
  ) {
    return;
  }
  historyRequestPending = {};
  stopFollowingTail();
  virtualList.value?.captureHistoryAnchor();
  emit("loadMoreHistory");
}
function messageReferences(message: Message) {
  return readReferenceMessageContexts(message.additional_kwargs).map(
    (context, index) => ({ id: index + 1, context }),
  );
}
/*
  present_files 组的两个取数口，与上游 message-list.tsx 的 assistant:present-files
  分支逐条对应：文件清单来自组内**每一条**带 present_files 调用的 ai 消息
  （`extractPresentFilesFromMessage` 的 flatMap），前导正文只取 `messages[0]`。

  这一组**不再**走通用的 ai 分支：上游那一支不画 reasoning、不画工具折叠块、
  也不画 artifactTargets 的文件名按钮，只画正文 + 文件卡片。
*/
function presentFiles(group: MessageGroup) {
  return group.messages.flatMap((message) =>
    extractPresentFilesFromMessage(message),
  );
}
function presentFilesLead(group: MessageGroup) {
  const first = group.messages[0];
  return first ? text(first) : "";
}
function runIdOfGroup(index: number) {
  const messages = groups.value[index]?.messages ?? [];
  for (const message of [...messages].reverse()) {
    const runId = Reflect.get(message, "run_id");
    if (typeof runId === "string" && runId) return runId;
  }
  return undefined;
}
const workspaceChangeAnchors = computed(() =>
  getWorkspaceChangeAnchorGroupIndices(groups.value),
);
function workspaceChangesRun(index: number) {
  if (!workspaceChangeAnchors.value.has(index)) return undefined;
  const assistant = groups.value[index]?.messages.find(
    (message) => message.type === "ai" && getMessageRunId(message),
  );
  return assistant ? getMessageRunId(assistant) : undefined;
}

watch(
  () => props.streaming,
  (streaming, previous) => {
    if (streaming && !previous) turnStartTime.value = Date.now();
    if (!streaming && previous) {
      /*
        下降沿**先量再清**，顺序和上游一致（它读 `turnStartTimeRef.current` 之后才置 null）。
        落点是**从尾部倒着找的第一个非 human 且有 id 的组**——与上游
        `[...groupedMessages].reverse().find((group) => group.type !== "human" && group.id)`
        同一条。这一轮出错就不记：一次失败的 run 没有「耗时多久」可言。
      */
      const startTime = turnStartTime.value;
      const lastAssistantGroup = [...groups.value]
        .reverse()
        .find((group) => group.type !== "human" && group.id);
      if (startTime !== null && lastAssistantGroup?.id && !props.threadError) {
        const durationSeconds = Math.max(
          0,
          Math.floor((Date.now() - startTime) / 1_000),
        );
        const next = new Map(clientDurationsByGroupId.value);
        next.set(clientDurationKey(lastAssistantGroup.id), durationSeconds);
        clientDurationsByGroupId.value = next;
      }
      turnStartTime.value = null;
    }
  },
);
watch(
  () => props.active,
  async (active) => {
    if (!active) return;
    const owner = scrollOwner.value;
    followingTail.value = true;
    await nextTick();
    if (owner !== scrollOwner.value || !isListActive.value) return;
    await virtualList.value?.scrollToTail("instant");
  },
  { flush: "post" },
);
watch(
  () => props.tailRequest,
  async (request, previousRequest) => {
    if (
      request === undefined ||
      request === previousRequest ||
      props.active === false
    )
      return;
    const owner = scrollOwner.value;
    followingTail.value = true;
    await nextTick();
    if (owner !== scrollOwner.value || !isListActive.value) return;
    await virtualList.value?.scrollToTail("instant");
  },
);
watch(
  () => props.historyLoadingMore,
  async (loading, previous) => {
    if (loading || !previous || !historyRequestPending) return;
    const request = historyRequestPending;
    await virtualList.value?.completeHistoryLoad();
    if (historyRequestPending === request) historyRequestPending = null;
  },
);
watch([() => props.threadId, () => props.editOwnerKey], () => {
  historyInteractionArmed.value = false;
  historyRequestPending = null;
});
watch(historySentinel, (element, previous) => {
  if (previous) historyObserver?.unobserve(previous);
  if (!element || !("IntersectionObserver" in globalThis)) return;
  historyObserver ??= new IntersectionObserver(
    (entries) => {
      if (
        entries.some((entry) => entry.isIntersecting) &&
        historyInteractionArmed.value
      ) {
        requestHistoryLoad();
      }
    },
    { root: scroller.value, rootMargin: "96px 0px 0px" },
  );
  historyObserver.observe(element);
});
onUnmounted(() => {
  historyObserver?.disconnect();
});
</script>

<template>
  <div
    v-bind="$attrs"
    :data-testid="testId"
    role="log"
    class="min-h-0 flex-1 wrap-anywhere transition-[padding]"
  >
    <div
      ref="scroller"
      class="h-full overflow-y-auto [scrollbar-gutter:stable_both-edges]"
      @scroll="onScroll"
      @wheel="onWheel"
      @touchstart="onScrollIntent"
      @pointerdown="onPointerDown"
      @keydown="onScrollKey"
      @focusin="stopFollowingTail"
    >
      <!--
  加载骨架保留布局，status 播报由骨架组件提供。
-->
      <MessageListSkeleton v-if="loading" />
      <!--
  分页期间保留同一按钮、焦点及已加载行；哨兵属于稳定外层 div。
        分页失败由历史 owner 通知，保留重试入口。
-->
      <div
        v-if="hasMoreHistory || historyLoadingMore"
        ref="historySentinel"
        class="mx-auto flex w-full max-w-[var(--container-width-md)] justify-center pt-3"
      >
        <Button
          data-testid="load-earlier-messages"
          type="button"
          variant="ghost"
          size="sm"
          class="text-muted-foreground hover:text-foreground rounded-full px-3"
          :disabled="historyLoadingMore || !hasMoreHistory"
          @click="requestHistoryLoad"
        >
          <template v-if="historyLoadingMore">
            <Loader2 class="mr-2 size-4 animate-spin" />
            {{ $i18n.t.value.common.loading }}
          </template>
          <template v-else>
            <ChevronUp class="mr-2 size-4" />
            {{ $i18n.t.value.common.loadMore }}
          </template>
        </Button>
      </div>
      <div
        ref="contentElement"
        data-testid="message-list-content"
        class="mx-auto w-full max-w-[var(--container-width-md)] px-4"
        :class="hasTimelineContent ? 'pt-8' : undefined"
        :style="
          hasTimelineContent
            ? {
                paddingBottom: `calc(var(--spacing) * 12 + ${paddingBottom}px)`,
              }
            : undefined
        "
      >
        <!--
          消息流是 div 不是 ul：React 的 ConversationContent
          （frontend/src/components/ai-elements/conversation.tsx）就是一个纯 div，
          于是它在可访问性树里什么都不留下。这里若用 ul/li，空会话会凭空多出一个
          list、有消息时每条又多一个 listitem——读屏器会把一段对话读成一份清单。
        -->
        <VirtualMessageList
          ref="virtualList"
          :groups="groups"
          :streaming="streaming"
          :scroll-element="scroller"
          :following-tail="followingTail"
          :active="active"
          :owner-key="scrollOwner"
          :content-element="contentElement"
          :initial-scroll="initialScroll"
          :resize-scroll="resizeScroll"
          @active-group-change="activeGroupChanged"
          @reading-intent="stopFollowingTail"
        >
          <template #default="entry">
            <div class="flex w-full flex-col gap-2">
              <div
                v-for="duration in separateDurations(entry.index)"
                :key="duration.runId"
                class="text-muted-foreground border-border/60 mb-3 border-b pb-3 text-sm"
              >
                <RunDurationLabel
                  :duration-seconds="duration.durationSeconds"
                />
              </div>
              <div
                :data-assistant-turn="
                  entry.group.type === 'assistant' ? '' : undefined
                "
                :data-role="entry.group.type === 'human' ? 'human' : 'ai'"
                :class="
                  entry.group.type === 'human' && !entry.group.scheduledOrigin
                    ? 'is-user group group/conversation-message relative ml-auto flex w-full flex-col justify-end gap-2'
                    : 'group group/assistant-turn relative w-full'
                "
                @mouseup="onSelection($event, entry.index)"
              >
                <ScheduledRunPrompt
                  v-if="
                    entry.group.type === 'human' && entry.group.scheduledOrigin
                  "
                  :origin="entry.group.scheduledOrigin"
                />
                <ScheduledTaskCard
                  v-else-if="entry.group.type === 'assistant:scheduled-task'"
                  :result="entry.group.scheduleResult"
                />
                <ProcessingMessageGroup
                  v-else-if="entry.group.type === 'assistant:processing'"
                  :show-tool-details="tokenUsageInlineMode === 'step_debug'"
                  :messages="entry.group.messages"
                  :tool-artifacts="toolArtifacts"
                  :token-debug-steps="
                    tokenDebugStepsForMessages(entry.group.messages)
                  "
                  :duration-seconds="
                    reasoningDurations[entry.index]?.values().next().value
                      ?.durationSeconds
                  "
                  :streaming="streaming && entry.index === groups.length - 1"
                  :thread-id="threadId"
                  :is-mock="isMock"
                  :markdown-components="messageMarkdownComponents"
                  @artifact="emit('artifact', $event)"
                  @browser="emit('browser', $event)"
                />
                <!--
  present-files 组仅渲染可选正文与文件卡片；正文间距与 React message-list.tsx 调用点一致。
-->
                <div
                  v-else-if="entry.group.type === 'assistant:present-files'"
                  class="w-full"
                >
                  <MessageMarkdown
                    v-if="presentFilesLead(entry.group)"
                    class="mb-4"
                    :content="presentFilesLead(entry.group)"
                    :components="messageMarkdownComponents"
                    :streaming="streaming && entry.index === groups.length - 1"
                  />
                  <ArtifactFileCards
                    :thread-id="threadId ?? ''"
                    :files="presentFiles(entry.group)"
                    :is-mock="isMock"
                    :is-admin="isAdmin"
                    :run-id="archiveCandidates[entry.index]?.runId"
                    :archive-downloads-enabled="!streaming"
                    @select="emit('artifact', $event)"
                  />
                </div>
                <template
                  v-for="message in entry.group.messages"
                  v-else
                  :key="message.id"
                >
                  <HumanInputCard
                    v-if="extractHumanInputRequest(message)"
                    :request="extractHumanInputRequest(message)!"
                    :answered="
                      humanInputState.answeredResponses.get(
                        extractHumanInputRequest(message)!.request_id,
                      )
                    "
                    :active="
                      interactive !== false &&
                      !streaming &&
                      humanInputState.latestOpenRequestId ===
                        extractHumanInputRequest(message)!.request_id
                    "
                    :pending="
                      pendingHumanInputs.has(
                        extractHumanInputRequest(message)!.request_id,
                      )
                    "
                    :read-only="interactive === false"
                    @submit="
                      handleHumanInputSubmit(
                        extractHumanInputRequest(message)!,
                        $event,
                      )
                    "
                  />
                  <div
                    v-if="message.type === 'human'"
                    class="ml-auto flex w-fit max-w-full min-w-0 flex-col gap-2"
                  >
                    <ReferenceAttachment
                      :references="messageReferences(message)"
                      test-id="message-reference-attachment"
                      class="self-end shadow-none"
                    />
                    <div
                      v-if="
                        readConversationReferences(message.additional_kwargs)
                          .length
                      "
                      :aria-label="
                        $i18n.t.value.inputBox.referencedConversations
                      "
                      class="flex max-w-full flex-wrap justify-end gap-1"
                      data-testid="message-conversation-references"
                      role="group"
                    >
                      <ConversationReferenceChip
                        v-for="reference in readConversationReferences(
                          message.additional_kwargs,
                        )"
                        :key="reference.threadId"
                        :href="
                          pathOfThread(reference.threadId, {
                            agent_name: reference.agentName,
                          })
                        "
                        :title="reference.title || $i18n.t.value.pages.untitled"
                      />
                    </div>
                    <MessageAttachments
                      :message="message"
                      :thread-id="threadId"
                      :is-mock="isMock"
                    />
                    <!-- HumanMessageText owns plain text and historical slash-skill display. -->
                    <div
                      v-if="editState && editState.messageId === message.id"
                      class="bg-background border-border flex w-full min-w-0 flex-col gap-2 rounded-lg border p-2 shadow-sm"
                    >
                      <Textarea
                        :ref="setEditTextarea"
                        v-model="editState.text"
                        autofocus
                        :aria-disabled="editState.pending || undefined"
                        class="min-h-24 resize-y"
                        :readonly="editState.pending"
                        @keydown="onEditKeydown"
                      />
                      <div class="text-muted-foreground text-xs">
                        {{ $i18n.t.value.common.editRerunWarning }}
                      </div>
                      <div class="flex justify-end gap-1">
                        <Button
                          size="sm"
                          type="button"
                          variant="ghost"
                          :disabled="editState.pending"
                          @click="cancelEdit"
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
                    <div
                      v-else-if="stripUploadedFilesTag(text(message))"
                      class="is-user:dark group-[.is-user]:bg-secondary group-[.is-user]:text-foreground group-[.is-assistant]:text-foreground flex w-full max-w-full min-w-0 flex-col gap-2 overflow-visible group-[.is-user]:ml-auto group-[.is-user]:overflow-hidden group-[.is-user]:rounded-lg group-[.is-user]:px-4 group-[.is-user]:py-3"
                    >
                      <HumanMessageText
                        :content="stripUploadedFilesTag(text(message))"
                      />
                    </div>
                    <KnowledgeScopeSummary
                      :additional-kwargs="message.additional_kwargs"
                    />
                    <!--
  编辑按钮必须有真实消息 id；否则 undefined 与 undefined 相等会错误暴露不可寻址的动作。
-->
                    <HumanTurnActions
                      :copied="
                        copiedMessage === (message.id ?? `human:${entry.index}`)
                      "
                      :copy-label="$i18n.t.value.clipboard.copyToClipboard"
                      :copied-label="$i18n.t.value.clipboard.copiedToClipboard"
                      :edit-label="$i18n.t.value.messages.actions.editAndRerun"
                      :show-edit="
                        interactive !== false &&
                        !props.uploading &&
                        !props.branchPending &&
                        !props.hasGoal &&
                        !hasOpenHumanInput &&
                        !editState?.pending &&
                        editState?.messageId !== message.id &&
                        Boolean(message.id) &&
                        editable?.humanMessage.id === message.id
                      "
                      @copy="
                        copyMessage(
                          message.id ?? `human:${entry.index}`,
                          getMessageCopyData(message),
                        )
                      "
                      @edit="beginEdit(message, entry.index)"
                    />
                  </div>
                  <div
                    v-else-if="message.additional_kwargs?.element === 'task'"
                    class="flex flex-col gap-2"
                  >
                    <Collapsible :default-open="false">
                      <CollapsibleTrigger as-child class="group">
                        <div
                          class="text-muted-foreground flex w-full cursor-default items-center gap-2 text-sm select-none"
                        >
                          <Loader class="size-4" />
                          <span>{{ text(message) }}</span>
                        </div>
                      </CollapsibleTrigger>
                    </Collapsible>
                  </div>
                  <template
                    v-else-if="
                      message.type === 'ai' ||
                      (message.type === 'tool' &&
                        (entry.group.type === 'human' ||
                          entry.group.type === 'assistant'))
                    "
                  >
                    <!--
  正文使用 flex column，保证 reasoning 与 markdown 的 margin 不发生折叠。
-->
                    <div class="flex flex-col gap-2">
                      <!--
  子任务组头先于 reasoning 与卡片，使用本地化的任务数量；pt-2 不与 flex gap 折叠。
-->
                      <div
                        v-if="subtaskCallCount(message) > 0"
                        class="text-muted-foreground pt-2 text-sm font-normal"
                      >
                        {{
                          $i18n.t.value.subtasks.executing(
                            subtaskCallCount(message),
                          )
                        }}
                      </div>
                      <ProcessingMessageGroup
                        v-if="
                          entry.group.type === 'assistant:subagent' &&
                          reasoning(message)
                        "
                        :messages="[message]"
                        :tool-artifacts="toolArtifacts"
                        :token-debug-steps="
                          tokenDebugStepsForMessages([message])
                        "
                        :show-tool-details="
                          tokenUsageInlineMode === 'step_debug'
                        "
                        :duration-seconds="
                          reasoningDurations[entry.index]?.get(message)
                            ?.durationSeconds
                        "
                        :streaming="
                          streaming && entry.index === groups.length - 1
                        "
                        :thread-id="threadId"
                        :is-mock="isMock"
                        :markdown-components="messageMarkdownComponents"
                        @artifact="emit('artifact', $event)"
                        @browser="emit('browser', $event)"
                      />
                      <ReasoningDisclosure
                        v-else-if="reasoning(message)"
                        :content="reasoning(message) ?? ''"
                        :duration-seconds="
                          reasoningDurations[entry.index]?.get(message)
                            ?.durationSeconds
                        "
                        :streaming="
                          streaming && entry.index === groups.length - 1
                        "
                        :markdown-components="messageMarkdownComponents"
                      />
                      <!--
                  `my-3` 是**调用点**给的，不是渲染器自带的：上游
                  `message-list-item.tsx` 写的是
                  `<MarkdownContent className="my-3">`，而 reasoning、工具步骤那几个
                  调用点都没有传。漏掉它的后果是线程里第一条 AI 消息的正文整体上移
                  12px——对照台账上 branch-thread / workspace-changes /
                  thread-history-mermaid 三条一模一样的 `y Δ-12` 就是这一处。
                -->
                      <MessageMarkdown
                        v-if="
                          text(message) &&
                          !(
                            entry.group.type === 'assistant:subagent' &&
                            reasoning(message)
                          )
                        "
                        class="my-3"
                        :content="text(message)"
                        :components="messageMarkdownComponents"
                        :streaming="
                          streaming && entry.index === groups.length - 1
                        "
                      />
                      <CitationSourcesPanel :sources="citations(message)" />
                      <KnowledgeSourcesPanel :content="text(message)" />
                      <WorkspaceChangesBadge
                        v-if="
                          message.type === 'ai' &&
                          threadId &&
                          workspaceChangesRun(entry.index)
                        "
                        :thread-id="threadId"
                        :run-id="workspaceChangesRun(entry.index)"
                        :disabled="
                          streaming && entry.index === groups.length - 1
                        "
                      />
                      <!--
  产物工具调用由 ProcessingMessageGroup 渲染；普通 assistant/subagent 分支不重复新增路径按钮。
-->
                      <!--
  SubtaskCard 直接参与 gap-2 布局，不附加会叠加间距的包装层。
-->
                      <template
                        v-for="(call, callIndex) in message.type === 'ai'
                          ? (message.tool_calls ?? [])
                          : []"
                        :key="subtaskId(call.id, entry.index, callIndex)"
                      >
                        <SubtaskCard
                          v-if="call.name === 'task'"
                          :task-id="subtaskId(call.id, entry.index, callIndex)"
                          :thread-id="threadId"
                          :run-id="runIdOfGroup(entry.index) ?? activeRunId"
                          :description="subtaskDescription(call.args)"
                          :prompt="subtaskPrompt(call.args)"
                          :live-task="
                            subtasks?.[
                              subtaskId(call.id, entry.index, callIndex)
                            ]
                          "
                          :terminal="subtaskTerminal(call.id)"
                          :pending-status="subtaskPendingStatus(call.id)"
                          :is-loading="streaming"
                          :markdown-components="messageMarkdownComponents"
                        />
                      </template>
                    </div>
                  </template>
                  <!--
  子任务 tool 结果仅供任务 owner 更新卡片状态、结果及用量，不在列表重复渲染。
-->
                  <!--
  结构化 human_input 交给 HumanInputCard；其余 clarification 正文按 markdown 渲染，
                此调用点不增加普通 assistant 气泡的外边距。
-->
                  <MessageMarkdown
                    v-else-if="
                      message.type === 'tool' &&
                      entry.group.type === 'assistant:clarification' &&
                      !extractHumanInputRequest(message) &&
                      text(message)
                    "
                    :content="text(message)"
                    :components="messageMarkdownComponents"
                    :streaming="streaming && entry.index === groups.length - 1"
                  />
                </template>

                <MessageTokenUsage
                  v-if="
                    tokenUsageInlineMode === 'step_debug' ||
                    turnUsageMessagesByGroupIndex[entry.index]
                  "
                  :messages="
                    tokenUsageInlineMode === 'per_turn'
                      ? (turnUsageMessagesByGroupIndex[entry.index] ?? [])
                      : entry.group.messages
                  "
                  :token-debug-steps="inlineTokenDebugSteps(entry.group)"
                  :mode="tokenUsageInlineMode ?? 'off'"
                  :loading="streaming"
                />

                <AssistantTurnActions
                  v-if="entry.group.type === 'assistant'"
                  :copied="
                    copiedMessage ===
                    `assistant:${entry.group.id ?? entry.index}`
                  "
                  :copy-label="$i18n.t.value.clipboard.copyToClipboard"
                  :copied-label="$i18n.t.value.clipboard.copiedToClipboard"
                  :show-copy="Boolean(assistantCopyData[entry.index])"
                  :branch-label="$i18n.t.value.messages.actions.branch"
                  :regenerate-label="$i18n.t.value.messages.actions.regenerate"
                  :show-branch="
                    props.canBranch &&
                    !streamingAssistantGroups[entry.index] &&
                    branchable.has(entry.group.id ?? '')
                  "
                  :show-regenerate="
                    latestAssistantGroupId !== null &&
                    entry.group.id === latestAssistantGroupId &&
                    Boolean(lastAI(entry.index)?.id)
                  "
                  :branch-disabled="
                    interactive === false ||
                    Boolean(uploading) ||
                    Boolean(branchPending) ||
                    Boolean(editState?.pending)
                  "
                  :regenerate-disabled="
                    interactive === false ||
                    Boolean(uploading) ||
                    Boolean(editState?.pending)
                  "
                  @copy="
                    copyMessage(
                      `assistant:${entry.group.id ?? entry.index}`,
                      assistantCopyData[entry.index] ?? null,
                    )
                  "
                  @branch="
                    emit('branch', entry.group.id ?? '', groupIds(entry.index))
                  "
                  @regenerate="
                    emit(
                      'regenerate',
                      lastAI(entry.index)?.id ?? '',
                      entry.group.messages.flatMap((message) =>
                        message.id ? [message.id] : [],
                      ),
                    )
                  "
                >
                  <template #details>
                    <SkillUsageMenu
                      v-if="!streamingAssistantGroups[entry.index]"
                      :skills="skillUsageByGroupIndex.get(entry.index) ?? []"
                    />
                  </template>
                </AssistantTurnActions>
              </div>
            </div>
            <div
              v-if="placedTaskEvents.afterGroup.get(entry.index)?.length"
              class="mt-8 flex w-full flex-col gap-3"
            >
              <ScheduledTaskEventLine
                v-for="event in placedTaskEvents.afterGroup.get(entry.index)"
                :key="event.id"
                :event="event"
              />
            </div>
          </template>
        </VirtualMessageList>
        <div
          v-if="placedTaskEvents.tail.length"
          class="flex w-full flex-col gap-3"
        >
          <ScheduledTaskEventLine
            v-for="event in placedTaskEvents.tail"
            :key="event.id"
            :event="event"
          />
        </div>
        <div
          v-if="streaming && !hasActiveAssistantText"
          role="status"
          :class="['w-full', groups.length ? 'mt-8' : '']"
        >
          <RunActivity :start-time="turnStartTime" />
        </div>
      </div>
      <p
        v-if="actionError"
        role="alert"
        class="text-destructive mx-auto w-full max-w-[var(--container-width-md)] pb-4 text-xs"
      >
        {{ actionError }}
      </p>
    </div>
  </div>
  <!--
  选区工具条位于日志 live region 之外，锚定浏览器选区；mousedown.prevent 保留原选区。
-->
  <!--
  会话目录作为日志区兄弟定位，避免跟随消息内容滚走。
-->
  <ConversationOutline
    v-if="outlineEnabled"
    :chapters="chapters"
    :active-chapter-id="activeChapterId"
    @select="selectChapter"
  />
  <div
    v-if="selection"
    ref="selectionToolbarElement"
    data-sidecar-selection-toolbar
    class="bg-popover text-popover-foreground border-border fixed z-50 flex max-h-[calc(100dvh-1rem)] max-w-[calc(100vw-1rem)] flex-wrap items-center justify-center gap-1 overflow-y-auto rounded-full border p-1 shadow-lg"
    :style="{
      left: `${selectionToolbarMargin}px`,
      top: `${selectionToolbarMargin}px`,
    }"
  >
    <Button
      class="h-auto min-h-8 max-w-full min-w-0 rounded-full px-2.5 text-xs whitespace-normal"
      size="sm"
      type="button"
      variant="ghost"
      @click="dispatchSelection('add')"
      @mousedown.prevent
    >
      <MessageCircle class="size-3.5" />
      {{ $i18n.t.value.sidecar.addToConversation }}
    </Button>
    <Button
      v-if="selectionMode === 'main'"
      class="h-auto min-h-8 max-w-full min-w-0 rounded-full px-2.5 text-xs whitespace-normal"
      size="sm"
      type="button"
      variant="ghost"
      @click="dispatchSelection('ask')"
      @mousedown.prevent
    >
      <MessageSquarePlus class="size-3.5" />
      {{ $i18n.t.value.sidecar.askInSideChat }}
    </Button>
    <Button
      :aria-label="$i18n.t.value.common.close"
      class="size-8 rounded-full"
      size="icon-sm"
      type="button"
      variant="ghost"
      @click="selection = null"
      @mousedown.prevent
    >
      <span aria-hidden="true">×</span>
    </Button>
  </div>
</template>
