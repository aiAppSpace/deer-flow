<script setup lang="ts">
/*
  【文件职责】     DeerFlow 消息分组、reasoning/tool/human-input 渲染与消息操作编排。
  【架构位置】     L3 UI adapter
  【主要导出】     默认 MessageList 组件
  【依赖关系】     core/messages · markdown L2 · artifacts/changes/sidecar 扩展消费者
  【边界与注意】   B 组行为稳定，但直接依赖宿主 Message 与业务卡片，不能伪装成独立 L2 包。
*/
import {
  computed,
  defineComponent,
  h,
  markRaw,
  nextTick,
  onMounted,
  onUnmounted,
  provide,
  ref,
  watch,
  type ComponentPublicInstance,
} from "vue";
import {
  CheckCircle2,
  ChevronUp,
  Clock3,
  Loader2,
  MessageCircle,
  MessageSquarePlus,
  Wrench,
} from "lucide-vue-next";

import AssistantTurnActions from "@/components/chat/AssistantTurnActions.vue";
import HumanTurnActions from "@/components/chat/HumanTurnActions.vue";
import HumanInputCard from "@/components/chat/HumanInputCard.vue";
import CitationSourcesPanel from "@/components/chat/CitationSourcesPanel.vue";
import MessageAttachments from "@/components/chat/MessageAttachments.vue";
import MessageListSkeleton from "@/components/chat/MessageListSkeleton.vue";
import ConversationOutline from "@/components/chat/ConversationOutline.vue";
import MessageMarkdown from "@/components/chat/MessageMarkdown.vue";
import MessageTokenUsage from "@/components/chat/MessageTokenUsage.vue";
import MarkdownLink from "@/components/chat/MarkdownLink.vue";
import ProcessingMessageGroup from "@/components/chat/ProcessingMessageGroup.vue";
import ReasoningDisclosure from "@/components/chat/ReasoningDisclosure.vue";
import RunActivity from "@/components/chat/RunActivity.vue";
import SubtaskCard from "@/components/chat/SubtaskCard.vue";
import { MARKDOWN_LINK_CONTEXT } from "@/components/chat/markdown-link-context";
import ArtifactFileCards from "@/components/workspace/artifacts/ArtifactFileCards.vue";
import WorkspaceChangesBadge from "@/components/workspace/changes/WorkspaceChangesBadge.vue";
import ReferenceAttachment from "@/components/workspace/sidecar/ReferenceAttachment.vue";
import { Button } from "@/components/ui/button";
import { richContentComponents } from "@/components/markdown/components";
import { isSyntheticValuesMessageId } from "@/core/agent-deerflow/reducer";
import { resolveMessageImageURL } from "@/core/artifacts/utils";
import { extractCitationSources } from "@/core/citations/sources";
import {
  deriveHumanInputThreadState,
  extractHumanInputRequest,
  shouldClearPendingHumanInputOnThreadError,
  type HumanInputRequest,
  type HumanInputResponse,
} from "@/core/messages/human-input";
import { getArtifactArchiveCandidatesByGroupIndex } from "@/core/messages/artifact-archive";
import {
  buildConversationChapters,
  CONVERSATION_OUTLINE_MIN_TURNS,
} from "@/core/messages/conversation-outline";
import { deriveAssistantTurnUsageState } from "@/core/messages/derived-state";
import type { BrowserViewMeta } from "@/core/messages/processing";
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
  stripUploadedFilesTag,
  type MessageGroup,
} from "@/core/messages/utils";
import {
  formatRunDuration,
  getRunDurationDisplaysByGroupIndex,
} from "@/core/messages/run-duration";
import {
  derivePendingSubtaskStatus,
  parseSubtaskResult,
  type SubtaskResultUpdate,
} from "@/core/tasks/subtask-result";
import type { Subtask } from "@/core/tasks/types";
import type { Message } from "@/core/types/message";
import { readReferenceMessageContexts } from "@/core/sidecar";
import { writeTextToClipboard } from "@/core/clipboard";
import { useWorkspaceToast } from "@/core/workspace-shell/toast";
import { cn } from "@/lib/utils";

/*
  **多根模板必须自己接 attrs**（wave 124）：下面把划词工具条挪出了 `role="log"`
  那个根，于是这个组件有两个根节点，Vue 不再自动把 `class` 挂上去
  （`AgentChat.vue` 传的是 `:class="… pt-10"`）。用 `v-bind="$attrs"` 显式挂回
  日志区那个根——工具条是 `position: fixed`，不该接任何布局 class。
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
    resizeScroll?: "smooth" | "instant";
    interactive?: boolean;
    artifactPaths?: readonly string[];
    isMock?: boolean;
    /** `.skill` 的 Install 只对管理员出现；判据在 ArtifactFileCards 的文件头。 */
    isAdmin?: boolean;
    subtasks?: Record<string, Subtask>;
    activeRunId?: string | null;
    hasMoreHistory?: boolean;
    historyLoadingMore?: boolean;
    historyError?: unknown;
    threadError?: unknown;
    submitHumanInput?: (
      request: HumanInputRequest,
      response: HumanInputResponse,
    ) => boolean | undefined | Promise<boolean | undefined>;
    tokenUsageInlineMode?: "off" | "per_turn" | "step_debug";
    /** 长会话的章节跳转目录。只有主会话开，sidecar 不开。 */
    enableConversationOutline?: boolean;
  }>(),
  {
    active: true,
    resizeScroll: "smooth",
  },
);
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
  两处播报走 workspace toaster，与上游同一条（`message-list.tsx:590` 的
  `toast.error` 与 `:693` 的 `toast.info`）。此前两处都是**静默**：提交失败只把
  pending 清掉、卡片自己重新可用，用户看不到任何解释。

  owner 由 workspace / showcase 两个 layout provide，所以 inject 一定拿得到；
  单测里要一起 provide（同一棵树里的 ArtifactFileCards 早就是这么用的）。
*/
const toast = useWorkspaceToast();
type SelectionPayload = {
  message: Message;
  selectedText: string;
  displayIndex: number;
};
/*
  划词工具条的状态：引用内容 + 它锚在屏幕上的哪里。

  上游 message-list.tsx 的 SelectionToolbarState 是同一个形状（context + x/y/
  placement）。位置必须进状态而不是留在 CSS 里：工具条锚的是**选区**，
  而选区的位置只有 mouseup 那一刻的 Range 知道。
*/
type SelectionToolbarState = SelectionPayload & {
  /** 选区中线的视口 x；工具条自己再 -translate-x-1/2 居中。 */
  x: number;
  /** 选区上沿（placement top）或下沿（placement bottom）加上边距后的视口 y。 */
  y: number;
  placement: "top" | "bottom";
};
const pendingHumanInputs = ref(new Set<string>());
const copiedMessage = ref<string | null>(null);
const actionError = ref("");
let previousHumanInputThreadError: unknown = props.threadError;
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
  ...richContentComponents,
  a: MarkdownLink,
  img: MarkdownMessageImage,
});

const groups = computed(() =>
  getMessageGroups(props.messages, {
    isCurrentTurnLoading: props.streaming,
  }),
);
const turnUsageMessagesByGroupIndex = computed(
  () => deriveAssistantTurnUsageState(groups.value).byGroupIndex,
);
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
  const total = groups.value.length;
  if (total > 80) {
    const maxStart = Math.max(0, total - VIRTUAL_WINDOW_SIZE);
    // 目标放在窗口靠前的位置，它下面那几组也一起渲染出来。
    windowStart.value = Math.min(Math.max(0, groupIndex - 2), maxStart);
    followingTail.value = false;
    await nextTick();
  }
  const target = scroller.value?.querySelector<HTMLElement>(
    `[data-index="${groupIndex}"]`,
  );
  target?.scrollIntoView({ block: "start", behavior: "auto" });
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
  **编辑并重新运行要的是服务端 id，不是存储键。**

  `values` 快照里没有 id 的消息由 reducer 编一个位置键（`values-<index>`），
  而那个键在 `AgentMessage.id` 上与真 id 长得一模一样。2026-09-12 实测：
  用户刚发出的那条 human 消息在 mock 回显的 `values` 里就没有 id
  （两个应用发出去的 POST 体逐字相同，都不带 id），于是本仓给它编了 `values-0`，
  `getLatestEditableTurn` 认为这一轮可编辑，画出了「编辑并重新运行」——
  **点下去会把 `values-0` 交给 `POST /runs/edit-regenerate/prepare`，服务端解析不了。**

  判据放在调用点而不是 `getLatestEditableTurn` 里：那支工具与上游逐字同源，
  而**上游没有这个分支**（它的 `stream_mode` 里没有 `values`，实测
  上游 `["messages-tuple","updates","custom"]` / 本仓多一个 `"values"`）。
  把一条只有本仓才需要的判据塞进共享工具，下一次对照就会把两边判成分叉。
*/
const editable = computed(() => {
  const turn = getLatestEditableTurn(groups.value, props.streaming);
  if (!turn) return null;
  return isSyntheticValuesMessageId(turn.humanMessage.id) ? null : turn;
});
/*
  「最新的 assistant 回合」是**按类型往回找**的，不是「最后一个组」。上游
  message-list.tsx:597 的 latestAssistantGroupId 从尾部倒着扫，只认
  `type === "assistant"`，并在 thread.isLoading 时直接返回 null。

  本仓此前写的是位置判据 `entry.index === groups.length - 1`。只要 assistant 组
  后面再挂上任何**别的**组，重跑入口就整个消失——待答的 clarification 组正是这种
  情况：同一条线程上 React 仍然给出 Regenerate，Vue 没有（对照台账上
  `- button "Regenerate"` 只此一处）。processing / subagent 组也是同一个形状。
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
  **客户端兜底计时**，与上游 message-list.tsx:339 同一条。

  后端把 `turn_duration` 写在 AI 消息的 `additional_kwargs` 里，但那要等这一轮落库、
  再被历史查询取回来才有值；**刚跑完的这一轮拿不到**。上游因此在 streaming 的下降沿
  自己量一次墙钟先顶上，等后端那个值到了再让位。本仓此前只认后端给的值，于是
  「首次提交后」那一屏上游有 `Completed in <1s`、本仓一个字都没有
  （对照台账 wave 175 记的那一行；当时判成「取到的时长有没有值」，**判错了，是缺功能**）。

  **键只用 group.id，不像上游那样拼上 threadId——这是有意的分叉，实测逼出来的。**
  上游 `${threadId}:${group.id}` 在它那侧成立，因为 React 一开始就生成好 threadId、
  从头到尾不变；本仓这个组件的 `threadId` 是**交接过来的**：实测下降沿那一刻它还是空串
  （`PROBE_FALLING_EDGE … "threadId":""`），渲染时才变成真 id，于是写进去的是
  `":msg-ai-1"`、读出来找的是 `"<id>:msg-ai-1"`，**永远对不上**。
  第一版就是这么写的，单测全绿、真应用一个字都不显示——**又一次假绿**，
  和 wave 158/175 同一族（id 交接）。

  拼 threadId 的用意是「换了会话别复用上一个会话量出来的秒数」。这一点改由
  下面那个 watch 保证：**从一个真 id 换到另一个真 id 时清空**；空串→真 id 是交接本身，
  不清。这比上游那条键更稳，因为它不依赖「写和读的那一刻 threadId 相同」。
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
/*
  可见性判据必须显式传 `isHiddenFromUIMessage`，不能用 deriveHumanInputThreadState
  的默认值（那个只看 `hide_from_ui`）。上游 message-list.tsx:521 传的就是它。

  差别落在 HIL 状态机的 legacy 兜底上：那条兜底把「请求之后出现的任意**可见**
  human 消息」当成对最新未答请求的回答。默认判据看不见两类消息——名字在
  HIDDEN_CONTROL_MESSAGE_NAMES 里的（summary / loop_warning / todo_reminder /
  todo_completion_reminder），以及正文只有 `<slash_skill_activation>` 的那种。
  于是本仓此前只要用户在待答卡片之后触发一次斜杠技能，卡片就被静默判成已答，
  真正的问题再也回答不了。
*/
const humanInputState = computed(() =>
  deriveHumanInputThreadState(
    props.rawMessages ?? props.messages,
    (message) => !isHiddenFromUIMessage(message),
  ),
);
/*
  待答卡片打开时，人类消息上的「编辑并重跑」入口要收起来——重跑会把这条待答
  请求连同它所在的回合一起作废，而卡片还在屏幕上等人回答。上游把这条判据写在
  chat-page.tsx 的 `canEdit`（`!hasOpenHumanInputCard`，:345）里，再经 message-list
  的 `canEdit` 传到每条人类消息上；本仓的 `hasOpenHumanInputRequest` 一直躺在
  core 里没有任何调用点，入口因此在待答态下仍然可点。

  直接读上面那份 humanInputState，不再 derive 第二遍：判据与可见性判据都已经
  和上游一致，`latestOpenRequestId !== null` 就是 hasOpenHumanInputRequest 的定义。
*/
const hasOpenHumanInput = computed(
  () => humanInputState.value.latestOpenRequestId !== null,
);
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
const historySentinel = ref<HTMLElement | null>(null);
const windowStart = ref<number | null>(null);
const followingTail = ref(true);
const selection = ref<SelectionToolbarState | null>(null);
let userScrollIntent = false;
let contentResizeObserver: ResizeObserver | undefined;
let historyObserver: IntersectionObserver | undefined;
let historyAnchor: { scrollHeight: number; scrollTop: number } | null = null;
const historyInteractionArmed = ref(false);
let followAnimationFrame: number | undefined;
let retainFollowUntil = 0;
const VIRTUAL_WINDOW_SIZE = 50;
const ESTIMATED_GROUP_HEIGHT_PX = 80;
const RETAIN_FOLLOW_DURATION_MS = 350;
const SELECTION_TOOLBAR_MARGIN = 8;
/*
  工具条渲染出来的大概高度（p-1 内边距 + h-8 的按钮）。只用来判断选区上方放不放得下，
  所以不需要精确值——放不下就翻到选区下方。两个常量与上游
  message-list.tsx:146/150 逐字相同。
*/
const SELECTION_TOOLBAR_ESTIMATED_HEIGHT = 48;

const renderedGroups = computed(() => {
  if (groups.value.length <= 80)
    return groups.value.map((group, index) => ({ group, index }));
  const maxStart = Math.max(0, groups.value.length - VIRTUAL_WINDOW_SIZE);
  const start = Math.min(windowStart.value ?? maxStart, maxStart);
  return groups.value
    .slice(start, start + VIRTUAL_WINDOW_SIZE)
    .map((group, offset) => ({ group, index: start + offset }));
});
const virtualTopHeight = computed(() =>
  groups.value.length > 80
    ? (renderedGroups.value[0]?.index ?? 0) * ESTIMATED_GROUP_HEIGHT_PX
    : 0,
);
const virtualBottomHeight = computed(() => {
  if (groups.value.length <= 80) return 0;
  const renderedEnd = (renderedGroups.value.at(-1)?.index ?? -1) + 1;
  return (
    Math.max(0, groups.value.length - renderedEnd) * ESTIMATED_GROUP_HEIGHT_PX
  );
});

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
  return typeof args?.description === "string" ? args.description : "Subtask";
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
async function handleHumanInputSubmit(
  request: HumanInputRequest,
  response: HumanInputResponse,
) {
  pendingHumanInputs.value = new Set([
    ...pendingHumanInputs.value,
    request.request_id,
  ]);
  try {
    if (props.submitHumanInput) {
      const accepted = await props.submitHumanInput(request, response);
      if (accepted === false) {
        const next = new Set(pendingHumanInputs.value);
        next.delete(request.request_id);
        pendingHumanInputs.value = next;
      }
      return;
    }
    emit("humanInput", request, response);
  } catch (error) {
    const next = new Set(pendingHumanInputs.value);
    next.delete(request.request_id);
    pendingHumanInputs.value = next;
    toast.error(error instanceof Error ? error.message : String(error));
  }
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
async function copyMessage(key: string, value: string | null) {
  if (!value) return;
  actionError.value = "";
  if (!(await writeTextToClipboard(value))) {
    actionError.value = $i18n.t.value.messages.copyFailed;
    return;
  }
  copiedMessage.value = key;
  setTimeout(() => {
    if (copiedMessage.value === key) copiedMessage.value = null;
  }, 2_000);
}
function scrollToTail(mode: "smooth" | "instant" = "instant") {
  if (!scroller.value || props.active === false || !followingTail.value) return;
  if (mode === "instant") {
    if (followAnimationFrame !== undefined) {
      cancelAnimationFrame(followAnimationFrame);
      followAnimationFrame = undefined;
    }
    scroller.value.scrollTop = scroller.value.scrollHeight;
    return;
  }
  retainFollowUntil = performance.now() + RETAIN_FOLLOW_DURATION_MS;
  if (followAnimationFrame !== undefined) return;
  const animate = () => {
    followAnimationFrame = undefined;
    const element = scroller.value;
    if (!element || props.active === false || !followingTail.value) return;
    const gap = element.scrollHeight - element.clientHeight - element.scrollTop;
    if (gap > 1) {
      const before = element.scrollTop;
      element.scrollTop += Math.max(1, gap * 0.35);
      // A browser can reject a fractional step at a layout boundary. Jumping
      // only in that no-progress case prevents an otherwise endless rAF loop.
      if (element.scrollTop === before)
        element.scrollTop = element.scrollHeight;
    } else if (gap > 0) {
      element.scrollTop = element.scrollHeight;
    }
    if (
      performance.now() < retainFollowUntil ||
      element.scrollHeight - element.clientHeight - element.scrollTop > 1
    ) {
      followAnimationFrame = requestAnimationFrame(animate);
    }
  };
  followAnimationFrame = requestAnimationFrame(animate);
}
function stopFollowingTail() {
  followingTail.value = false;
  if (followAnimationFrame !== undefined) {
    cancelAnimationFrame(followAnimationFrame);
    followAnimationFrame = undefined;
  }
}
function setContentElement(element: Element | ComponentPublicInstance | null) {
  contentResizeObserver?.disconnect();
  contentResizeObserver = undefined;
  if (!(element instanceof HTMLElement)) return;
  if ("ResizeObserver" in globalThis) {
    contentResizeObserver = new ResizeObserver(() => {
      if (!followingTail.value || props.active === false) return;
      scrollToTail(props.resizeScroll ?? "smooth");
    });
    contentResizeObserver.observe(element);
  }
  void nextTick(() => {
    if (followingTail.value && props.active !== false) {
      scrollToTail(props.resizeScroll ?? "smooth");
    }
  });
}
function onScroll() {
  if (!scroller.value) return;
  const maxStart = Math.max(0, groups.value.length - VIRTUAL_WINDOW_SIZE);
  const scrollRange = scroller.value.scrollHeight - scroller.value.clientHeight;
  const atTail =
    scrollRange <= 0 ||
    scroller.value.scrollTop + scroller.value.clientHeight >=
      scroller.value.scrollHeight - 1;
  if (atTail) {
    followingTail.value = true;
    userScrollIntent = false;
    windowStart.value = maxStart;
    return;
  }
  if (
    historyInteractionArmed.value &&
    scroller.value.scrollTop <= 80 &&
    props.hasMoreHistory
  ) {
    requestHistoryLoad();
  }
  if (userScrollIntent) {
    stopFollowingTail();
    userScrollIntent = false;
  }
  if (groups.value.length <= 80) return;
  if (followingTail.value) {
    windowStart.value = maxStart;
    return;
  }
  const ratio = scrollRange <= 0 ? 0 : scroller.value.scrollTop / scrollRange;
  windowStart.value = Math.round(maxStart * ratio);
}
function onScrollIntent() {
  userScrollIntent = true;
  historyInteractionArmed.value = true;
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
function historyErrorMessage() {
  const error = props.historyError;
  return error instanceof Error
    ? error.message
    : typeof error === "string"
      ? error
      : $i18n.t.value.messages.loadEarlierFailed;
}
function requestHistoryLoad() {
  if (
    !props.hasMoreHistory ||
    props.historyLoadingMore ||
    !scroller.value ||
    historyAnchor
  ) {
    return;
  }
  historyAnchor = {
    scrollHeight: scroller.value.scrollHeight,
    scrollTop: scroller.value.scrollTop,
  };
  stopFollowingTail();
  emit("loadMoreHistory");
}
/*
  划词工具条的入口。对齐 message-list.tsx:649 的 handleAssistantTextSelection。

  **只有 `assistant` 组、且组里那条是 ai 消息，才起工具条。** 上游是靠**在哪儿绑**
  表达这条判据的：`group.type !== "assistant" || msg.type !== "ai"` 时那层
  onMouseUp 根本不挂（message-list.tsx:1058）。本仓把处理器挂在组容器上，所以同一条
  判据写在函数开头——两种写法的可观察行为相同，而组容器正好就是上游要
  `closest("[data-assistant-turn]")` 才拿得到的那个元素。实测这一条：在人类消息上
  划词，上游一个工具条都不出，本仓出（对照 probe 的 human 变体 onlyVue 2 行）。
  `assistant` 组恒定只有一条消息（core/messages/utils.ts:198，与上游同构），
  所以直接取 messages[0]，不用再猜是哪一条。

  **按包含关系判定归属，不按正文子串。** 此前这里拿 `text(candidate).includes()`
  找消息，机制上比上游窄一档：`text()` 给的是 markdown **源码**，而选区里是**渲染
  之后**的文字。一段跨越行内标记的选区（`this is **bold** text` 上选
  "is bold te"）在源码里根本不是子串，于是本仓静默不弹工具条，而上游只看
  anchor/focus 两个节点在不在这一轮里，照弹不误。
*/
function onSelection(event: MouseEvent, index: number) {
  if (!props.selectionMode || props.streaming) return;
  const group = groups.value[index];
  if (group?.type !== "assistant") return;
  const message = group.messages[0];
  if (!message || message.type !== "ai") return;

  const domSelection = globalThis.getSelection?.();
  const selectedText = domSelection?.toString().trim() ?? "";
  if (
    !domSelection ||
    domSelection.isCollapsed ||
    !selectedText ||
    domSelection.rangeCount === 0
  ) {
    selection.value = null;
    return;
  }
  const { anchorNode, focusNode } = domSelection;
  if (!anchorNode || !focusNode) return;
  const turn = event.currentTarget as HTMLElement | null;
  if (!turn?.contains(anchorNode)) return;
  if (!turn.contains(focusNode)) {
    // 选区漏到了别的轮次里，引用会有歧义：说一句，而不是静默失败（上游 :693 同款）。
    toast.info($i18n.t.value.sidecar.selectionCrossesMessages);
    selection.value = null;
    return;
  }

  /*
    工具条带着 `-translate-y-full`，锚在 rect.top 时会被它自己的高度顶上去；
    选区贴近视口顶端时上方放不下，就翻到选区下方，保证两颗按钮都够得着
    （上游 #3551）。
  */
  const rect = domSelection.getRangeAt(0).getBoundingClientRect();
  const fitsAbove =
    rect.top - SELECTION_TOOLBAR_MARGIN - SELECTION_TOOLBAR_ESTIMATED_HEIGHT >=
    0;
  selection.value = {
    message,
    selectedText,
    displayIndex: index + 1,
    x: rect.left + rect.width / 2,
    y: fitsAbove
      ? rect.top - SELECTION_TOOLBAR_MARGIN
      : rect.bottom + SELECTION_TOOLBAR_MARGIN,
    placement: fitsAbove ? "top" : "bottom",
  };
}
function onKey(event: KeyboardEvent) {
  if (event.key === "Escape") selection.value = null;
}
/*
  滚动就收起。工具条是 fixed 且按 mouseup 那一刻的视口坐标锚定的，页面一滚它就与
  被引用的那段文字脱节。上游同样在 window 上用**捕获**阶段听（message-list.tsx:643），
  捕获是必需的：真正在滚的是会话流那个容器，scroll 事件不冒泡到 window。
*/
function onSelectionScroll() {
  if (selection.value) selection.value = null;
}
function dispatchSelection(action: "ask" | "add") {
  const current = selection.value;
  if (!current) return;
  const payload: SelectionPayload = {
    message: current.message,
    selectedText: current.selectedText,
    displayIndex: current.displayIndex,
  };
  if (action === "ask") emit("selectionAsk", payload);
  else emit("selectionAdd", payload);
  selection.value = null;
  globalThis.getSelection?.()?.removeAllRanges();
}
function messageReferences(message: Message) {
  return readReferenceMessageContexts(message.additional_kwargs).map(
    (context, index) => ({ id: index + 1, context }),
  );
}
const ARTIFACT_TOOL_NAMES = new Set([
  "write_file",
  "str_replace",
  "finalize_artifact_write",
  "present_files",
]);
function toolLabel(name: string) {
  if (name === "write_file") return $i18n.t.value.toolCalls.writeFile;
  return name
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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
function workspaceChangesRun(index: number) {
  if (groups.value[index]?.type !== "assistant") return undefined;
  const runId = runIdOfGroup(index);
  if (!runId) return undefined;
  for (let cursor = index + 1; cursor < groups.value.length; cursor += 1) {
    if (
      groups.value[cursor]?.type === "assistant" &&
      runIdOfGroup(cursor) === runId
    )
      return undefined;
  }
  return runId;
}
function durationLabel(seconds: number) {
  const copy = $i18n.t.value.runDuration;
  const duration = formatRunDuration(seconds, {
    lessThanSecond: copy.lessThanSecond,
    hours: copy.hours,
    minutes: copy.minutes,
    seconds: copy.seconds,
    separator: copy.separator,
  });
  return duration ? copy.completedIn(duration) : "";
}

watch(
  () => groups.value.length,
  async (nextLength, previousLength = 0) => {
    void previousLength;
    const wasFollowingTail = followingTail.value;

    if (nextLength <= 80) {
      windowStart.value = null;
    } else if (wasFollowingTail) {
      windowStart.value = Math.max(0, nextLength - VIRTUAL_WINDOW_SIZE);
    }

    if (!wasFollowingTail || props.active === false) return;
    await nextTick();
    // A persisted-page refresh can land between the optimistic message and the
    // stream response. DOM scroll events from that intermediate layout may
    // recalculate windowStart before this post-render continuation runs. Pin
    // the virtual window to the current tail again before scrolling so the
    // optimistic turn remains mounted throughout the reconciliation.
    if (groups.value.length > 80) {
      windowStart.value = Math.max(
        0,
        groups.value.length - VIRTUAL_WINDOW_SIZE,
      );
      await nextTick();
    }
    if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight;
  },
  { immediate: true },
);
watch(
  () => props.streaming,
  async (streaming) => {
    if (streaming || !followingTail.value || props.active === false) return;
    await nextTick();
    scrollToTail(props.resizeScroll ?? "smooth");
  },
  { flush: "post" },
);
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
    followingTail.value = true;
    await nextTick();
    if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight;
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
    followingTail.value = true;
    if (groups.value.length > 80) {
      windowStart.value = Math.max(
        0,
        groups.value.length - VIRTUAL_WINDOW_SIZE,
      );
    }
    await nextTick();
    if (groups.value.length > 80) {
      windowStart.value = Math.max(
        0,
        groups.value.length - VIRTUAL_WINDOW_SIZE,
      );
      await nextTick();
    }
    if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight;
  },
);
watch(humanInputState, (state) => {
  if (pendingHumanInputs.value.size === 0) return;
  pendingHumanInputs.value = new Set(
    [...pendingHumanInputs.value].filter(
      (requestId) => !state.answeredResponses.has(requestId),
    ),
  );
});
watch(
  () => props.threadError,
  (currentError) => {
    const clear = shouldClearPendingHumanInputOnThreadError({
      currentError,
      previousError: previousHumanInputThreadError,
      pendingRequestCount: pendingHumanInputs.value.size,
    });
    previousHumanInputThreadError = currentError;
    if (clear) pendingHumanInputs.value = new Set();
  },
);
watch(
  () => props.streaming,
  (streaming, previousStreaming) => {
    if (previousStreaming && !streaming) {
      pendingHumanInputs.value = new Set();
    }
  },
);
watch(
  () => props.threadId,
  () => {
    pendingHumanInputs.value = new Set();
    previousHumanInputThreadError = props.threadError;
    actionError.value = "";
  },
);
watch(
  () => props.historyLoadingMore,
  async (loading, previous) => {
    if (loading || !previous || !historyAnchor) return;
    await nextTick();
    if (scroller.value) {
      const addedHeight =
        scroller.value.scrollHeight - historyAnchor.scrollHeight;
      scroller.value.scrollTop =
        historyAnchor.scrollTop + Math.max(0, addedHeight);
    }
    historyAnchor = null;
  },
);
watch(
  () => props.threadId,
  () => {
    historyInteractionArmed.value = false;
    historyAnchor = null;
  },
);
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
onMounted(() => {
  globalThis.addEventListener("keydown", onKey);
  globalThis.addEventListener("scroll", onSelectionScroll, true);
});
onUnmounted(() => {
  globalThis.removeEventListener("keydown", onKey);
  globalThis.removeEventListener("scroll", onSelectionScroll, true);
  contentResizeObserver?.disconnect();
  historyObserver?.disconnect();
  if (followAnimationFrame !== undefined) {
    cancelAnimationFrame(followAnimationFrame);
  }
});
</script>

<template>
  <div
    v-bind="$attrs"
    :data-testid="testId"
    role="log"
    class="min-h-0 flex-1 transition-[padding]"
  >
    <div
      ref="scroller"
      class="h-full overflow-y-auto [scrollbar-gutter:stable_both-edges]"
      @scroll="onScroll"
      @wheel="onWheel"
      @touchstart="onScrollIntent"
      @pointerdown="onScrollIntent"
      @keydown="onScrollKey"
    >
      <!--
        历史加载中的占位。wave 169 之前这里是一行居中的灰字，上游是一整块骨架屏
        （`message-list.tsx:926`）——**各缺一半**：本仓的文字对读屏器友好，但视觉上
        会让内容到达时整屏跳一下；上游的骨架保住了布局，却对读屏器完全无声。
        两边同改成「骨架 + `role="status"` 播报」，文案沿用本仓这一条词典键。
      -->
      <MessageListSkeleton v-if="loading" />
      <!--
        「加载更早」整块照 `message-list.tsx:159` 的 `LoadMoreHistoryIndicator` 重排，
        三处可观察差异都由此而来：

        ① **加载态是同一颗按钮，不是换成一段文字。** 上游把 loading 折进按钮里
           （置灰 + `Loader2Icon animate-spin` + `common.loading`）；本仓原来把按钮
           整个卸载、换成一个 `<span role="status">`。点完的那一刻焦点所在的元素
           消失，键盘用户被丢回 body——和 composer 里「发送/停止是同一颗键」
           同一条理由。

        ② **哨兵挂在外层 div 上，不在按钮上**（上游 `<div ref={sentinelRef}>`）。
           挂在按钮上时，加载中按钮被卸载，IntersectionObserver 也跟着掉，
           连续滚动加载要等按钮重新挂上才恢复。

        ③ **按钮不是下划线文字，是一颗 ghost 圆角键，而且带 `ChevronUp` 图标**
           （上游 `variant="ghost" size="sm"
           className="text-muted-foreground hover:text-foreground rounded-full px-3"`）。
           文案也回到上游 common 下的 loadMore / loading——本仓原来在 messages 下
           自造了 loadEarlier / loadingEarlier 两条词条（本轮已删），
           渲染出来是「Load earlier messages」而上游是「Load more」。
           这里不写带点的键名：注释里的 `a.b` 会被 i18n 扫描器当成一处消费，
           把死词条从 unused 集里抹掉（坑 126）。

        出错那一支是本仓独有的（上游这一处没有错误态，失败后按钮原样留着、
        用户看不出发生过什么）。**保留**：删掉是产品回归，
        与 GatewayStatusBanner 上那颗重试同一条取舍。
      -->
      <div
        v-if="hasMoreHistory || historyLoadingMore || historyError"
        ref="historySentinel"
        class="mx-auto flex w-full max-w-[var(--container-width-md)] justify-center pt-3"
      >
        <span v-if="historyError" role="alert" class="text-destructive text-xs">
          {{ historyErrorMessage() }}
          <button
            type="button"
            class="ml-2 underline"
            @click="requestHistoryLoad"
          >
            {{ $i18n.t.value.messages.tryAgain }}
          </button>
        </span>
        <Button
          v-else
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
        :ref="setContentElement"
        data-testid="message-list-content"
        class="mx-auto w-full max-w-[var(--container-width-md)] px-4 pt-8 pb-[72px]"
      >
        <!--
          消息流是 div 不是 ul：React 的 ConversationContent
          （frontend/src/components/ai-elements/conversation.tsx）就是一个纯 div，
          于是它在可访问性树里什么都不留下。这里若用 ul/li，空会话会凭空多出一个
          list、有消息时每条又多一个 listitem——读屏器会把一段对话读成一份清单。
        -->
        <div
          data-testid="message-list"
          :style="{
            paddingTop: `${virtualTopHeight}px`,
            paddingBottom: `${virtualBottomHeight}px`,
          }"
          class="flex w-full flex-col gap-8"
        >
          <!--
            人类消息也要 relative。少了它，那排「复制 / 编辑并重跑」的绝对定位工具条
            就不再挂在这条气泡下面，而是挂在最近的定位祖先——整个 `section#chat`——上，
            于是它跑到聊天区右下角，并且比聊天区多出 28px。后果不只是位置错：那 28px
            让本该 overflow:hidden 的面板变得可滚动，一次焦点变化就能把整个聊天区
            往上推 28px。React 的 AIElementMessage 两种角色都是 `relative w-full`
            （frontend/src/components/workspace/messages/message-list-item.tsx）。

          **这一层不加 `gap-2`。** 上游把「一个回合」拆成两层：外层
          `w-full group/assistant-turn` 装 actions 与运行耗时（没有 gap），内层
          `group flex flex-col gap-2 is-assistant` 才是消息内容。本仓压成了一层，
          于是给它加 gap 会连 actions / 耗时一起推开 8px——`make e2e` 的
          「shows a completed run duration once after multi-step history」当场量到
          `actionsToDuration` 从 8 变 16。gap 要加在**消息内容**那一层，见下面
          ai 分支外面那个 `flex flex-col gap-2`。
          -->
          <div
            v-for="entry in renderedGroups"
            :key="entry.group.id ?? entry.index"
            :data-index="entry.index"
            :data-assistant-turn="
              entry.group.type === 'assistant' ? '' : undefined
            "
            :data-role="entry.group.type === 'human' ? 'human' : 'ai'"
            :class="
              entry.group.type === 'human'
                ? 'is-user group bg-secondary relative ml-auto w-fit max-w-full rounded-lg px-4 py-3 whitespace-pre-wrap'
                : 'group relative w-full'
            "
            @mouseup="onSelection($event, entry.index)"
          >
            <ProcessingMessageGroup
              v-if="entry.group.type === 'assistant:processing'"
              :messages="entry.group.messages"
              :streaming="streaming && entry.index === groups.length - 1"
              :thread-id="threadId"
              :is-mock="isMock"
              :markdown-components="messageMarkdownComponents"
              @artifact="emit('artifact', $event)"
              @browser="emit('browser', $event)"
            />
            <!--
              present_files 自己是一组，不走下面那圈按消息的通用渲染：上游
              message-list.tsx 的 assistant:present-files 分支只画「组内第一条消息的
              正文（有才画）」+ 文件卡片清单，reasoning、工具调用折叠块、artifactTargets
              的文件名按钮**一个都没有**。本仓此前根本没有这条分支，于是同一组消息
              落进通用的 ai 分支，画出来是 Reasoning + 两个折叠块 + 一颗文件名按钮，
              而上游画的是一张带下载链接的文件卡片——四行对四行，全是这一处。

              正文的 `mb-4` 是上游写在这个调用点上的，不是渲染器自带的
              （assistant 气泡那一处传的是 `my-3`）。
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
              <template v-if="message.type === 'human'">
                <MessageAttachments
                  :message="message"
                  :thread-id="threadId"
                  :is-mock="isMock"
                />
                <!--
                  用 div 而不是 p：React 的人类消息是
                  `<div className="wrap-break-word whitespace-pre-wrap">`
                  （frontend/src/components/workspace/messages/message-list-item.tsx
                  的 HumanMessageText）。输入框里打的是纯文本，不是一段文章——
                  报成 paragraph，读屏器的「按段落浏览」会把每一条提问都当成正文段落，
                  而 React 那边不会。
                -->
                <div class="wrap-break-word whitespace-pre-wrap">
                  {{ stripUploadedFilesTag(text(message)) }}
                </div>
                <ReferenceAttachment
                  :references="messageReferences(message)"
                  test-id="message-reference-attachment"
                  class="mt-2"
                />
                <!--
                  **`Boolean(message.id)` 这一项不能省**，它是上游
                  message-list.tsx:1025 `group.type === "human" && Boolean(msg.id) && …`
                  里那一项。少了它，两边都是 `undefined` 的时候
                  `editable?.humanMessage.id === message.id` 会**相等**：
                  新建会话刚发出第一条时，那条人类消息还没有后端给的 id，
                  `editable` 也是 null，于是 `undefined === undefined` 成立，
                  本仓就给一条**根本没法寻址、点了也重跑不了**的消息画出编辑键。
                  wave 180 实测：两个应用的 groups 一模一样（human 的 id 都是 null），
                  上游不画、本仓画——差的就是这一项。
                -->
                <HumanTurnActions
                  :copied="
                    copiedMessage === (message.id ?? `human:${entry.index}`)
                  "
                  :copy-label="$i18n.t.value.clipboard.copyToClipboard"
                  :edit-label="$i18n.t.value.messages.actions.editAndRerun"
                  :show-edit="
                    interactive !== false &&
                    !hasOpenHumanInput &&
                    Boolean(message.id) &&
                    editable?.humanMessage.id === message.id
                  "
                  @copy="
                    copyMessage(
                      message.id ?? `human:${entry.index}`,
                      getMessageCopyData(message),
                    )
                  "
                  @edit="
                    emit(
                      'edit',
                      message.id ?? '',
                      text(message),
                      groupIds(entry.index),
                    )
                  "
                />
              </template>
              <template v-else-if="message.type === 'ai'">
                <!--
                  上游的 `MessageContent` 是 `flex … flex-col gap-2`，本仓此前是
                  block。差的不只是 8px 间隙：block 里相邻兄弟的 margin 会**折叠**，
                  于是正文那层的 `my-3` 被上面 reasoning 块的下外边距吃掉——同一处
                  `my-3` 在没有 reasoning 的消息上生效、在有 reasoning 的消息上失效
                  （对照台账里 branch-thread 归零而 streaming-reasoning-order 纹丝不动，
                  就是这个）。flex 容器不折叠 margin。
                -->
                <div class="flex flex-col gap-2">
                  <!--
                    子任务组头。上游 `message-list.tsx` 的 assistant:subagent 分支
                    在**所有卡片之前**先渲染一行
                    `<div className="text-muted-foreground pt-2 text-sm font-normal">`，
                    内容是 `t.subtasks.executing(tasks.size)`；count===1 时那个函数
                    既不插数字也不加复数，念出来正好是 "Executing subtask"。
                    本仓此前整行没有，`subtasks.executing` 一直躺在未引用的词条里
                    （对照台账上 `- text: Executing subtask` 只此一处）。

                    放在 ReasoningDisclosure 之前而不是工具调用循环之前：上游把组头
                    push 进 results 之后才开始遍历消息，推理块和卡片都排在它后面。
                    这一行是 block、外面是 flex 容器，`pt-2` 不与容器的 gap 折叠，
                    两边都是 8px 内边距 + 20px 行高 = 28px。
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
                  <ReasoningDisclosure
                    v-if="reasoning(message)"
                    :content="reasoning(message) ?? ''"
                    :streaming="streaming && entry.index === groups.length - 1"
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
                    v-if="text(message)"
                    class="my-3"
                    :content="text(message)"
                    :components="messageMarkdownComponents"
                    :streaming="streaming && entry.index === groups.length - 1"
                  />
                  <CitationSourcesPanel :sources="citations(message)" />
                  <!--
                    **这里不画 artifact 的文件名按钮。** 曾经有一排
                    `write_file` / `str_replace` / `finalize_artifact_write` /
                    `present_files` 的文字按钮挂在这一层，上游一处都没有：
                    带这些工具调用的 ai 消息在两个应用里都归 `assistant:processing`
                    组，画成 chain-of-thought 的一步（NotebookPen + 可点的路径
                    chip，本仓是 ProcessingToolStep.vue，上游是
                    message-group.tsx:853 的同一支）。剩下走得到这条通用分支的
                    只有 `assistant:subagent` 组（同一条消息既有 task 又有写文件
                    调用时），而上游那一支只画「执行 N 个子任务」+ reasoning +
                    SubtaskCard（message-list.tsx:1195），文件名按钮同样没有。
                    `assistant` 组按构造就不带 tool_calls
                    （becomesAssistantBubble 要求 `!hasToolCalls`），
                    `assistant:clarification` 组里是 tool 消息不是 ai 消息，
                    两条都取不到东西——整段是「本仓多出来的」，按双向规则删掉。
                  -->
                  <!--
                    卡片是 gap-2 容器的**直接**子节点，不再套 `my-2 text-sm`。
                    上游 assistant:subagent 分支把 SubtaskCard 直接 push 进
                    `<div className="relative z-1 flex flex-col gap-2">`，中间没有层；
                    flex 容器不折叠 margin，多出来的 `my-2` 会在 gap 的 8px 之外再加
                    8px，把整张卡片往下推 8px。非 task 的工具调用仍走原来的 details，
                    那是本仓自己的渲染路径（上游的工具步骤在 processing 组里），
                    不在这一轮的范围内。
                  -->
                  <template
                    v-for="(call, callIndex) in message.tool_calls ?? []"
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
                        subtasks?.[subtaskId(call.id, entry.index, callIndex)]
                      "
                      :terminal="subtaskTerminal(call.id)"
                      :pending-status="subtaskPendingStatus(call.id)"
                      :is-loading="streaming"
                      :markdown-components="messageMarkdownComponents"
                    />
                    <div v-else class="my-2 text-sm">
                      <details class="group/tool">
                        <summary
                          class="text-muted-foreground hover:text-foreground flex cursor-pointer list-none items-center gap-2 py-1.5 transition-colors"
                        >
                          <Wrench :size="15" />
                          <span>{{ toolLabel(call.name) }}</span>
                        </summary>
                        <pre
                          v-if="
                            call.args &&
                            Object.keys(call.args).length &&
                            !ARTIFACT_TOOL_NAMES.has(call.name)
                          "
                          class="bg-muted text-muted-foreground mt-1 ml-6 max-h-64 overflow-auto rounded-lg p-3 text-xs whitespace-pre-wrap"
                          >{{ JSON.stringify(call.args, null, 2) }}</pre>
                      </details>
                    </div>
                  </template>
                </div>
              </template>
              <!--
                子任务组里的 tool 结果**不单独渲染**。上游 assistant:subagent 分支只
                遍历 `type === "ai"` 的消息（组头 + 推理块 + 卡片），tool 结果只被读
                去更新子任务的状态、结果、模型与 token，不再画一遍。本仓此前走的是
                通用的 tool 分支，于是同一份任务结果出现两次：一次在卡片里，一次是
                下面这个 `<details>`（可访问性树上多一行 `- group: task result`）。
              -->
              <!--
                clarification 组有**两支**，此前只做了一支。带 `artifact.human_input`
                的走上面的 HumanInputCard；不带的那一支，上游把这条 tool 消息的正文
                当 markdown 画出来（message-list.tsx:1147 的 `if (hasContent(message))`），
                本仓此前什么都不画——下面那个 details 把整个 clarification 组排除掉了，
                于是一段本该念出来的追问在会话里凭空消失。

                **不传 `my-3`**：上游这一处的 MarkdownContent 没有 className，
                与 assistant 气泡那一处不是同一个调用点。
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
              <details
                v-else-if="
                  message.type === 'tool' &&
                  entry.group.type !== 'assistant:subagent' &&
                  entry.group.type !== 'assistant:clarification'
                "
                class="my-2 text-sm"
              >
                <summary
                  class="text-muted-foreground hover:text-foreground flex cursor-pointer list-none items-center gap-2 py-1.5"
                >
                  <CheckCircle2 :size="15" />
                  {{
                    $i18n.t.value.messages.toolResult(
                      message.name ?? $i18n.t.value.messages.tool,
                    )
                  }}
                </summary>
                <pre
                  class="bg-muted text-muted-foreground mt-1 ml-6 max-h-64 overflow-auto rounded-lg p-3 text-xs whitespace-pre-wrap"
                  >{{ text(message) }}</pre>
              </details>
            </template>

            <WorkspaceChangesBadge
              v-if="threadId && workspaceChangesRun(entry.index)"
              :thread-id="threadId"
              :run-id="workspaceChangesRun(entry.index)"
              :disabled="streaming"
            />

            <MessageTokenUsage
              v-if="turnUsageMessagesByGroupIndex[entry.index]"
              :messages="turnUsageMessagesByGroupIndex[entry.index] ?? []"
              :mode="tokenUsageInlineMode ?? 'off'"
              :loading="streaming"
            />

            <AssistantTurnActions
              v-if="entry.group.type === 'assistant'"
              :copied="
                copiedMessage === `assistant:${entry.group.id ?? entry.index}`
              "
              :copy-label="$i18n.t.value.clipboard.copyToClipboard"
              :branch-label="$i18n.t.value.messages.actions.branch"
              :regenerate-label="$i18n.t.value.messages.actions.regenerate"
              :show-branch="branchable.has(entry.group.id ?? '')"
              :show-regenerate="
                latestAssistantGroupId !== null &&
                entry.group.id === latestAssistantGroupId &&
                Boolean(lastAI(entry.index)?.id)
              "
              :branch-disabled="interactive === false"
              :regenerate-disabled="interactive === false"
              @copy="
                copyMessage(
                  `assistant:${entry.group.id ?? entry.index}`,
                  getAssistantTurnCopyData(entry.group.messages, {
                    isStreaming: streaming && entry.index === groups.length - 1,
                  }),
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
            />
            <div
              v-for="duration in durations[entry.index] ?? []"
              :key="duration.runId"
              data-testid="run-duration"
              :title="$i18n.t.value.runDuration.description"
              class="text-muted-foreground mt-2 flex items-center gap-2 text-sm"
            >
              <Clock3 :size="16" />
              <span>{{ durationLabel(duration.durationSeconds) }}</span>
            </div>
          </div>
        </div>
        <div
          v-if="streaming && !hasActiveAssistantText"
          role="status"
          :class="['w-full', renderedGroups.length ? 'mt-8' : '']"
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
    划词工具条**挂在日志区外面**，与上游一致（`message-list.tsx` 里它是
    `</Conversation>` 之后的兄弟节点）。**wave 124 之前它在里面**，后果不是排版
    ——`role="log"` 是一个 live region，插进去的内容会被读屏器当作日志播报出来，
    而这是一条随选区出现/消失的浮动工具条。实测：可访问性树里那三颗按钮
    **上游深度 2、本仓深度 3**（wave 123 量出的 6 行就是它）。

    锚在**选区**上（上游 message-list.tsx:1328），不是屏幕角落：
      此前这里是 `right-8 bottom-28`，实测同一段选区上游画在 (367,197)、本仓画在
      (955,642)——引用的是哪一段完全看不出来。

      三颗按钮都要 `@mousedown.prevent`：默认的 mousedown 会先把选区折叠掉，
      工具条上的高亮随之消失，看起来像点错了。上游三颗也都写了。
    -->
  <!--
    会话目录挂在**日志区外面**（与上游 message-list.tsx 同处）：它是绝对定位在
    这一屏右侧的浮层，放进滚动容器里会跟着内容一起滚走。
  -->
  <ConversationOutline
    v-if="outlineEnabled"
    :chapters="chapters"
    :active-chapter-id="activeChapterId"
    @select="selectChapter"
  />
  <div
    v-if="selection"
    data-sidecar-selection-toolbar
    :class="
      cn(
        'bg-popover text-popover-foreground border-border fixed z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border p-1 shadow-lg',
        selection.placement === 'bottom'
          ? 'translate-y-0'
          : '-translate-y-full',
      )
    "
    :style="{ left: `${selection.x}px`, top: `${selection.y}px` }"
  >
    <Button
      class="h-8 rounded-full px-2.5 text-xs"
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
      class="h-8 rounded-full px-2.5 text-xs"
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
