/*
  【文件职责】     见下方导出与 JSDoc。
  【架构位置】     L3
  【主要导出】     MessageGroup / getMessageGroups / getBranchableAssistantGroupIds / EditableTurn / getLatestEditableTurn / groupMessages 等 29 个
  【依赖关系】     见下方 import。
  【边界与注意】   本文件由本仓维护；行为由 tests/ 下的用例约束。
*/

import {
  scheduledOriginOf,
  scheduleCardResultOf,
} from "@/core/scheduled-tasks/messages";
import type { ScheduledOrigin } from "@/core/scheduled-tasks/types";
import type { ScheduleToolResult } from "@/core/scheduled-tasks/tool-result";

import type { AIMessage, Message } from "@/core/types/message";
import {
  FENCE_MARKER_RE,
  INDENTED_CODE_RE,
  isClosingFence,
} from "@/core/streamdown/fences";

interface GenericMessageGroup<T = string> {
  type: T;
  id: string | undefined;
  messages: Message[];
}

interface HumanMessageGroup extends GenericMessageGroup<"human"> {
  scheduledOrigin?: ScheduledOrigin;
}

interface AssistantProcessingGroup extends GenericMessageGroup<"assistant:processing"> {}

interface AssistantMessageGroup extends GenericMessageGroup<"assistant"> {}

interface AssistantPresentFilesGroup extends GenericMessageGroup<"assistant:present-files"> {}

interface AssistantClarificationGroup extends GenericMessageGroup<"assistant:clarification"> {}

interface AssistantSubagentGroup extends GenericMessageGroup<"assistant:subagent"> {}

interface AssistantScheduledTaskGroup extends GenericMessageGroup<"assistant:scheduled-task"> {
  scheduleResult: ScheduleToolResult;
}

export type MessageGroup =
  | HumanMessageGroup
  | AssistantProcessingGroup
  | AssistantMessageGroup
  | AssistantPresentFilesGroup
  | AssistantClarificationGroup
  | AssistantSubagentGroup
  | AssistantScheduledTaskGroup;

const HIDDEN_CONTROL_MESSAGE_NAMES = new Set([
  "summary",
  "loop_warning",
  "todo_reminder",
  "todo_completion_reminder",
]);

export function getMessageGroups(
  messages: Message[],
  { isCurrentTurnLoading = false }: { isCurrentTurnLoading?: boolean } = {},
): MessageGroup[] {
  if (messages.length === 0) {
    return [];
  }

  const groups: MessageGroup[] = [];
  const currentTurnStartIndex = isCurrentTurnLoading
    ? findCurrentTurnStartIndex(messages)
    : -1;

  function lastOpenGroup() {
    let index = groups.length - 1;
    while (groups[index]?.type === "assistant:scheduled-task") index -= 1;
    const last = groups[index];
    if (
      last &&
      last.type !== "human" &&
      last.type !== "assistant" &&
      last.type !== "assistant:clarification"
    ) {
      return last;
    }
    return null;
  }

  for (const [messageIndex, message] of messages.entries()) {
    if (isHiddenFromUIMessage(message)) {
      continue;
    }

    if (message.type === "human") {
      const scheduledOrigin = scheduledOriginOf(message);
      groups.push({
        id: message.id,
        type: "human",
        messages: [message],
        ...(scheduledOrigin ? { scheduledOrigin } : {}),
      });
      continue;
    }

    if (message.type === "tool") {
      const scheduleResult = scheduleCardResultOf(message);
      if (isClarificationToolMessage(message)) {
        // Add to the preceding processing group to preserve tool-call association,
        // then also open a standalone clarification group for prominent display.
        lastOpenGroup()?.messages.push(message);
        groups.push({
          id: message.id,
          type: "assistant:clarification",
          messages: [message],
        });
      } else if (scheduleResult) {
        lastOpenGroup()?.messages.push(message);
        for (let index = groups.length - 1; index >= 0; index -= 1) {
          const group = groups[index]!;
          if (group.type === "human") break;
          if (
            group.type === "assistant:scheduled-task" &&
            group.scheduleResult.task.id === scheduleResult.task.id
          )
            groups.splice(index, 1);
        }
        groups.push({
          id: message.id,
          type: "assistant:scheduled-task",
          messages: [message],
          scheduleResult,
        });
      } else {
        const open = lastOpenGroup();
        if (open) {
          open.messages.push(message);
        } else {
          // Fallback for orphan tool messages — LangGraph `messages-tuple` can
          // emit tool-result events out of order or replay them from subagent
          // state (e.g. bash subagent under LocalSandboxProvider with
          // allow_host_bash). When that happens, the tool message arrives after
          // a terminal group and lastOpenGroup() returns null. Previously we
          // dropped the message with console.error, silently hiding the tool
          // result from the UI. Attach to the most recent group instead so the
          // user can still see what the agent did.
          const lastGroup = groups[groups.length - 1];
          if (lastGroup) {
            lastGroup.messages.push(message);
          } else {
            // Leading orphan: `groups` is empty when this tool message
            // arrives. Two paths reach here: (1) history pagination cuts by
            // event seq, not turn boundaries, so the first loaded page begins
            // mid-turn with a tool result whose AI tool-call sits on an
            // unloaded older page (#4399); (2) the tool message is preceded
            // only by hidden control messages. Open a processing group so it
            // stays visible instead of being dropped with a per-render console
            // error.
            //
            // Only case (1) self-heals — loading the older page re-groups the
            // tool under its real turn. Case (2), and any truly orphaned tool
            // with no AI antecedent, has no page to load: the group persists
            // and renders as an empty ChainOfThought shell (convertToSteps
            // emits steps only for `type === "ai"`). That empty shell is an
            // accepted degradation — still a net win over dropping the result
            // and firing console.error every render.
            groups.push({
              id: message.id,
              type: "assistant:processing",
              messages: [message],
            });
          }
        }
      }
      continue;
    }

    if (message.type === "ai") {
      // A message with answer content and no tool calls becomes its own
      // assistant bubble below, which already renders the message's
      // reasoning_content inside the bubble's <Reasoning> collapsible. Such a
      // message must NOT also feed the processing group, or the ChainOfThought
      // panel above the bubble paints the identical reasoning a second time
      // (#3868). Intermediate reasoning (no content) and tool-calling steps
      // still belong in the processing group.
      // A content-only message is not necessarily the final answer while its
      // turn is still streaming: providers can append tool-call chunks to the
      // same message later. Keep that unresolved message in the processing
      // group so its visible text does not jump from an assistant bubble into
      // the steps panel when the tool call arrives (#4304).
      const hasAnswerContent = extractContentFromMessage(message).length > 0;
      const isUnresolvedAssistantText =
        currentTurnStartIndex >= 0 &&
        messageIndex > currentTurnStartIndex &&
        hasAnswerContent &&
        !hasToolCalls(message) &&
        // A provider that has already supplied reasoning with answer text is
        // completing an answer, not merely streaming a pre-tool narration.
        // Keep it out of the processing disclosure while the turn is active.
        !hasReasoning(message);
      const becomesAssistantBubble =
        hasAnswerContent &&
        !hasToolCalls(message) &&
        !isUnresolvedAssistantText;

      if (hasPresentFiles(message)) {
        groups.push({
          id: message.id,
          type: "assistant:present-files",
          messages: [message],
        });
      } else if (hasSubagent(message)) {
        groups.push({
          id: message.id,
          type: "assistant:subagent",
          messages: [message],
        });
      } else if (
        !becomesAssistantBubble &&
        (hasReasoning(message) ||
          hasToolCalls(message) ||
          isUnresolvedAssistantText)
      ) {
        const lastGroup = groups[groups.length - 1];
        // Accumulate consecutive intermediate AI messages into one processing group.
        if (lastGroup?.type !== "assistant:processing") {
          groups.push({
            id: message.id,
            type: "assistant:processing",
            messages: [message],
          });
        } else {
          lastGroup.messages.push(message);
        }
      }

      if (becomesAssistantBubble) {
        groups.push({ id: message.id, type: "assistant", messages: [message] });
      }
    }
  }

  return groups;
}

export function getBranchableAssistantGroupIds(
  groups: MessageGroup[],
  isCurrentTurnLoading: boolean,
): Set<string> {
  // Hidden messages were already removed by getMessageGroups, matching the
  // backend's branch checkpoint visibility rules. Within each visible human
  // turn, branching is exposed only when the final AI-bearing group is a
  // terminal assistant text group. Processing, present-files, and subagent
  // groups do not render assistant actions.
  const branchableGroupIds = new Set<string>();
  let lastAIGroup: MessageGroup | null = null;

  const completeTurn = () => {
    if (lastAIGroup?.type === "assistant" && lastAIGroup.id) {
      branchableGroupIds.add(lastAIGroup.id);
    }
    lastAIGroup = null;
  };

  for (const group of groups) {
    if (group.type === "human") {
      completeTurn();
      continue;
    }

    if (group.messages.some((message) => message.type === "ai")) {
      lastAIGroup = group;
    }
  }

  if (!isCurrentTurnLoading) {
    completeTurn();
  }

  return branchableGroupIds;
}

export type EditableTurn = {
  humanMessage: Message;
};

function isTerminalAssistantTextMessage(message: Message | undefined): boolean {
  return (
    message?.type === "ai" &&
    Boolean(extractTextFromMessage(message).trim()) &&
    !hasToolCalls(message)
  );
}

export function getLatestEditableTurn(
  groups: MessageGroup[],
  isCurrentTurnLoading: boolean,
): EditableTurn | null {
  if (isCurrentTurnLoading) {
    return null;
  }

  let candidate: EditableTurn | null = null;
  let currentHumanGroup: MessageGroup | null = null;
  let currentTurnGroups: MessageGroup[] = [];
  let lastAIGroup: MessageGroup | null = null;

  const completeTurn = () => {
    if (!currentHumanGroup) {
      currentTurnGroups = [];
      lastAIGroup = null;
      return;
    }

    const humanMessage = currentHumanGroup?.messages.find(
      (message) => message.type === "human" && message.id,
    );
    let assistantMessage: Message | undefined;
    for (let i = (lastAIGroup?.messages.length ?? 0) - 1; i >= 0; i -= 1) {
      const message = lastAIGroup?.messages[i];
      if (message?.type === "ai" && message.id) {
        assistantMessage = message;
        break;
      }
    }

    if (
      currentHumanGroup &&
      !(
        currentHumanGroup.type === "human" && currentHumanGroup.scheduledOrigin
      ) &&
      lastAIGroup?.type === "assistant" &&
      humanMessage &&
      isTerminalAssistantTextMessage(assistantMessage)
    ) {
      candidate = {
        humanMessage,
      };
    } else {
      candidate = null;
    }

    currentHumanGroup = null;
    currentTurnGroups = [];
    lastAIGroup = null;
  };

  for (const group of groups) {
    if (group.type === "human") {
      completeTurn();
      currentHumanGroup = group;
      currentTurnGroups = [group];
      continue;
    }

    if (currentHumanGroup) {
      currentTurnGroups.push(group);
    }

    if (group.messages.some((message) => message.type === "ai")) {
      lastAIGroup = group;
    }
  }

  completeTurn();
  return candidate;
}

export function groupMessages<T>(
  messages: Message[],
  mapper: (group: MessageGroup) => T,
): T[] {
  return getMessageGroups(messages)
    .map(mapper)
    .filter((result) => result !== undefined && result !== null) as T[];
}

/** Current-run identity comes from ThreadRunner's normalized message actions. */
export function isAssistantMessageGroupStreaming(
  groupMessages: readonly Message[],
  streamingMessageIds: ReadonlySet<string>,
) {
  return groupMessages.some(
    (message) =>
      message.type === "ai" &&
      typeof message.id === "string" &&
      streamingMessageIds.has(message.id),
  );
}

export function getAssistantTurnCopyData(
  messages: Message[],
  { isStreaming = false }: { isStreaming?: boolean } = {},
) {
  if (isStreaming) {
    return null;
  }

  return (
    [...messages]
      .reverse()
      .filter((message) => message.type === "ai")
      .map((message) => {
        // extractContentFromMessage never returns null, so fall back to
        // reasoning on empty text (same rule as getMessageCopyData) —
        // otherwise a reasoning-only turn loses its copy button entirely.
        const content = extractContentFromMessage(message);
        return content.length > 0
          ? content
          : (extractReasoningContentFromMessage(message) ?? "");
      })
      .find((content) => content.length > 0) ?? null
  );
}

export function getMessageCopyData(message: Message) {
  const content = extractContentFromMessage(message);
  if (message.type === "human") {
    return stripUploadedFilesTag(content);
  }
  if (content.length > 0) {
    return content;
  }
  return extractReasoningContentFromMessage(message) ?? "";
}

export function extractTextFromMessage(message: Message) {
  if (typeof message.content === "string") {
    return (
      splitInlineReasoningFromAIMessage(message)?.content ??
      message.content.trim()
    );
  }
  if (Array.isArray(message.content)) {
    return message.content
      .map((content) =>
        typeof content === "string"
          ? content
          : content.type === "text"
            ? content.text
            : "",
      )
      .join("\n")
      .trim();
  }
  return "";
}

/**
 * 单行消费者要的那份文本：**平接**（`""`），不像 `extractTextFromMessage`
 * 那样用 `"\n"` 接。上游把这两件事分成两个函数
 * （`textOfMessage` 平接给输入框/标题/通知，`extractContentFromMessage` 换行接给正文），
 * 判据写在 `frontend/src/core/threads/utils.ts:63`。
 *
 * 也**不剥 `<think>`**：这是给「取一段代表性文字」用的，不是给渲染用的。
 *
 * 上游空文本返回 `null`，这里返回 `""`——本文件的既有约定是 `""`，
 * 而两者在调用点都是 falsy，`if (text)` 的分支走向一样。
 */
export function textOfMessage(message: Message): string {
  if (typeof message.content === "string") return message.content;
  if (!Array.isArray(message.content)) return "";
  return message.content
    .map((part) =>
      typeof part === "string"
        ? part
        : part.type === "text"
          ? (part.text ?? "")
          : "",
    )
    .join("");
}

const THINK_OPEN_TAG = "<think>";
const THINK_CLOSE_TAG = "</think>";

interface InlineReasoningSplit {
  content: string;
  reasoning: string | null;
}

function markdownColumns(prefix: string): number {
  let column = 0;
  for (const char of prefix) {
    column += char === "\t" ? 4 - (column % 4) : 1;
  }
  return column;
}

function skipListFence(
  content: string,
  start: number,
  marker: string,
  listIndent: number,
): number {
  let lineStart = start;
  while (lineStart < content.length) {
    const newline = content.indexOf("\n", lineStart);
    const lineEnd = newline === -1 ? content.length : newline;
    const line = content.slice(lineStart, lineEnd);
    const whitespace = /^[ \t]*/.exec(line)![0];
    const indent = markdownColumns(whitespace);
    if (line.trim() !== "") {
      // A fenced block cannot outlive its containing list item, even when
      // the model has not supplied a closing fence yet.
      if (indent < listIndent) return lineStart;
      const closer = /^(`{3,}|~{3,})[ \t]*\r?$/.exec(
        line.slice(whitespace.length),
      )?.[1];
      if (
        indent <= listIndent + 3 &&
        closer?.startsWith(marker[0]!) &&
        closer.length >= marker.length
      ) {
        return lineEnd;
      }
    }
    lineStart = lineEnd + 1;
  }
  return content.length;
}

function splitInlineReasoning(content: string): InlineReasoningSplit {
  if (!content.includes(THINK_OPEN_TAG)) {
    return { content: content.trim(), reasoning: null };
  }
  const reasoningParts: string[] = [];
  const contentParts: string[] = [];
  // Scan code delimiters and reasoning openers in source order. Once inside
  // real reasoning, jump directly to its closing tag: Markdown in reasoning
  // must not change how the following answer is parsed.
  // Thematic-break repetitions already consume trailing whitespace. Do not add
  // another whitespace repetition after them: near-matches then backtrack quadratically.
  const tokens =
    /^ {0,3}(`{3,}|~{3,})|^( {4}|\t)|(\r?\n[ \t]*\r?\n)|^ {0,3}(#{1,6})(?=[ \t]|\r?$)|^ {0,3}((?:(?:=+|-+)[ \t]*|(?:\*[ \t]*){3,}|(?:_[ \t]*){3,}|(?:-[ \t]*){3,})\r?$)|^ {0,3}((?:[-+*]|\d{1,9}[.)])[ \t]+)(?=\S)|`+|<think>/gm;
  let fence: string | null = null;
  let inlineDelimiter: string | null = null;
  let headingEnd: number | null = null;
  let indentedCodeEnd: number | null = null;
  let contentStart = 0;
  let match: RegExpExecArray | null;
  while ((match = tokens.exec(content)) !== null) {
    if (headingEnd !== null && match.index >= headingEnd) {
      inlineDelimiter = null;
      headingEnd = null;
    }
    if (match[4] || match[5] || match[6]) {
      // Headings, thematic breaks and nonempty lists delimit inline spans
      // without a blank line. Ordered lists must start at 1 to interrupt.
      if (fence === null) {
        if (match[6] && !/^(?:[-+*]|1[.)])/.test(match[6])) {
          const previousLineStart =
            content.lastIndexOf("\n", match.index - 2) + 1;
          if (content.slice(previousLineStart, match.index).trim() !== "") {
            continue;
          }
        }
        inlineDelimiter = null;
        if (match[4]) {
          const newline = content.indexOf("\n", tokens.lastIndex);
          headingEnd = newline === -1 ? content.length : newline;
        }
        if (match[6]) {
          const newline = content.indexOf("\n", tokens.lastIndex);
          const lineEnd = newline === -1 ? content.length : newline;
          const line = content.slice(match.index, lineEnd);
          const listFence =
            /^ {0,3}(?:(?:[-+*]|\d{1,9}[.)])[ \t]{1,4})+(`{3,}|~{3,})/.exec(
              line,
            );
          const marker = listFence?.[1];
          if (
            listFence &&
            marker &&
            (marker.startsWith("~") ||
              !line.slice(listFence[0].length).includes("`"))
          ) {
            const prefix = listFence[0].slice(0, -marker.length);
            tokens.lastIndex = skipListFence(
              content,
              lineEnd + 1,
              marker,
              markdownColumns(prefix),
            );
          }
        }
      }
      continue;
    }
    if (match[3]) {
      // Inline spans cannot cross paragraph boundaries, unlike fenced code.
      if (fence === null) inlineDelimiter = null;
      continue;
    }
    if (match[2]) {
      // An indented continuation can still close an open inline code span.
      // Indented code cannot interrupt an existing paragraph either.
      const previousLineStart = content.lastIndexOf("\n", match.index - 2) + 1;
      const startsBlock =
        content.slice(previousLineStart, match.index).trim() === "";
      const continuesBlock =
        indentedCodeEnd !== null &&
        content.slice(indentedCodeEnd, match.index).trim() === "";
      if (inlineDelimiter === null && (startsBlock || continuesBlock)) {
        const newline = content.indexOf("\n", tokens.lastIndex);
        tokens.lastIndex = newline === -1 ? content.length : newline;
        indentedCodeEnd = tokens.lastIndex;
      } else {
        indentedCodeEnd = null;
      }
      continue;
    }
    const marker = match[1];
    if (marker) {
      const newline = content.indexOf("\n", tokens.lastIndex);
      const lineEnd = newline === -1 ? content.length : newline;
      const lineTail = content.slice(tokens.lastIndex, lineEnd);
      if (fence !== null) {
        if (
          marker.startsWith(fence.charAt(0)) &&
          marker.length >= fence.length &&
          lineTail.trim() === ""
        ) {
          fence = null;
        }
        tokens.lastIndex = lineEnd;
        continue;
      }
      // Backtick fence info strings cannot contain backticks. Such a run
      // may instead open or close an inline code span on this line.
      if (marker.startsWith("~") || !lineTail.includes("`")) {
        // Fenced blocks also interrupt paragraphs, including unfinished spans.
        inlineDelimiter = null;
        fence = marker;
        tokens.lastIndex = lineEnd;
        continue;
      }
    }
    if (fence !== null) {
      continue;
    }
    let delimiter = marker ?? match[0];
    if (delimiter.startsWith("`")) {
      // Backslash escapes apply outside a code span, not within one.
      let escapeStart = match.index;
      while (escapeStart > 0 && content[escapeStart - 1] === "\\") {
        escapeStart--;
      }
      if (inlineDelimiter === null && (match.index - escapeStart) % 2 === 1) {
        // An escape consumes one character, not the whole delimiter run.
        delimiter = delimiter.slice(1);
        if (!delimiter) continue;
      }
      if (inlineDelimiter === null) {
        inlineDelimiter = delimiter;
      } else if (inlineDelimiter === delimiter) {
        inlineDelimiter = null;
      }
      continue;
    }
    if (inlineDelimiter !== null || match[0] !== THINK_OPEN_TAG) {
      continue;
    }
    contentParts.push(content.slice(contentStart, match.index));
    const reasoningStart = tokens.lastIndex;
    const close = content.indexOf(THINK_CLOSE_TAG, reasoningStart);
    const reasoning = content
      .slice(reasoningStart, close === -1 ? undefined : close)
      .trim();
    if (reasoning) {
      reasoningParts.push(reasoning);
    }
    contentStart =
      close === -1 ? content.length : close + THINK_CLOSE_TAG.length;
    tokens.lastIndex = contentStart;
  }
  contentParts.push(content.slice(contentStart));

  return {
    content: contentParts.join("").trim(),
    reasoning: reasoningParts.length > 0 ? reasoningParts.join("\n\n") : null,
  };
}

// The split is re-derived on every render: `hasContent`, `hasReasoning`,
// `extractContentFromMessage` and `extractReasoningContentFromMessage` all run
// over the whole message list on each stream chunk, so an unmemoized scan costs
// O(total content) per chunk — quadratic across a long run. Cache per message
// object, keyed by the exact content string it was derived from so a message
// whose `content` is reassigned recomputes instead of serving a stale split.
const inlineReasoningCache = new WeakMap<
  object,
  { content: string; split: InlineReasoningSplit }
>();

function splitInlineReasoningFromAIMessage(message: Message) {
  if (message.type !== "ai" || typeof message.content !== "string") {
    return null;
  }
  const content = message.content;
  const cached = inlineReasoningCache.get(message);
  if (cached?.content === content) {
    return cached.split;
  }
  const split = splitInlineReasoning(content);
  inlineReasoningCache.set(message, { content, split });
  return split;
}

export function extractContentFromMessage(message: Message) {
  if (typeof message.content === "string") {
    return (
      splitInlineReasoningFromAIMessage(message)?.content ??
      message.content.trim()
    );
  }
  if (Array.isArray(message.content)) {
    return message.content
      .map((content) => {
        if (typeof content === "string") {
          return content;
        }
        switch (content.type) {
          case "text":
            return content.text;
          case "image_url": {
            const imageURL = extractURLFromImageURLContent(content.image_url!);
            return `![image](${imageURL})`;
          }
          default:
            return "";
        }
      })
      .join("\n")
      .trim();
  }
  return "";
}

export function extractReasoningContentFromMessage(message: Message) {
  if (message.type !== "ai") {
    return null;
  }
  if (
    message.additional_kwargs &&
    "reasoning_content" in message.additional_kwargs
  ) {
    return message.additional_kwargs.reasoning_content as string | null;
  }
  if (Array.isArray(message.content)) {
    const part = message.content[0];
    if (part && typeof part === "object" && "thinking" in part) {
      return part.thinking as string;
    }
  }
  if (typeof message.content === "string") {
    return splitInlineReasoningFromAIMessage(message)?.reasoning ?? null;
  }
  return null;
}

export function removeReasoningContentFromMessage(message: Message) {
  if (message.type !== "ai" || !message.additional_kwargs) {
    return;
  }
  delete message.additional_kwargs.reasoning_content;
}

export function extractURLFromImageURLContent(
  content:
    | string
    | {
        url: string;
      },
) {
  if (typeof content === "string") {
    return content;
  }
  return content.url;
}

export function hasContent(message: Message) {
  if (typeof message.content === "string") {
    return (
      (
        splitInlineReasoningFromAIMessage(message)?.content ??
        message.content.trim()
      ).length > 0
    );
  }
  if (Array.isArray(message.content)) {
    return message.content.length > 0;
  }
  return false;
}

export function hasReasoning(message: Message) {
  if (message.type !== "ai") {
    return false;
  }
  if (typeof message.additional_kwargs?.reasoning_content === "string") {
    return message.additional_kwargs.reasoning_content.trim().length > 0;
  }
  if (Array.isArray(message.content)) {
    const part = message.content[0];
    // Compatible with the Anthropic gateway
    return (part as unknown as { type: "thinking" })?.type === "thinking";
  }
  if (typeof message.content === "string") {
    return (
      (splitInlineReasoningFromAIMessage(message)?.reasoning ?? null) !== null
    );
  }
  return false;
}

export function hasToolCalls(message: Message) {
  return (
    message.type === "ai" && message.tool_calls && message.tool_calls.length > 0
  );
}

export function hasPresentFiles(message: Message) {
  return (
    message.type === "ai" &&
    message.tool_calls?.some((toolCall) => toolCall.name === "present_files")
  );
}

/** The latest visible user input or clarification result delimits a run. */
function findCurrentTurnStartIndex(messages: readonly Message[]): number {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];
    // Clarification replies are hidden: the result, rather than the last
    // visible human, separates completed answers from their continuation.
    if (
      message &&
      !isHiddenFromUIMessage(message) &&
      (message.type === "human" || isClarificationToolMessage(message))
    ) {
      return index;
    }
  }
  return -1;
}

export function isClarificationToolMessage(message: Message) {
  return message.type === "tool" && message.name === "ask_clarification";
}

export function extractPresentFilesFromMessage(message: Message) {
  if (message.type !== "ai" || !hasPresentFiles(message)) {
    return [];
  }
  const files: string[] = [];
  for (const toolCall of message.tool_calls ?? []) {
    if (
      toolCall.name === "present_files" &&
      Array.isArray(toolCall.args.filepaths)
    ) {
      files.push(...(toolCall.args.filepaths as string[]));
    }
  }
  return files;
}

export function hasSubagent(message: AIMessage) {
  for (const toolCall of message.tool_calls ?? []) {
    if (toolCall.name === "task") {
      return true;
    }
  }
  return false;
}

export function findToolCallResult(toolCallId: string, messages: Message[]) {
  for (const message of messages) {
    if (message.type === "tool" && message.tool_call_id === toolCallId) {
      const content = extractTextFromMessage(message);
      if (content) {
        return content;
      }
    }
  }
  return undefined;
}

export function isHiddenFromUIMessage(message: Message) {
  if (message.additional_kwargs?.hide_from_ui === true) {
    return true;
  }
  if (
    typeof message.name === "string" &&
    HIDDEN_CONTROL_MESSAGE_NAMES.has(message.name)
  ) {
    return true;
  }
  // Only the human branch consults the text. Extracting it up front made every
  // caller pay a full content scan for every AI message it was about to
  // discard, and this predicate runs over the whole message list on each
  // stream chunk (grouping, dedup, human-input state).
  if (message.type !== "human") {
    return false;
  }
  const content = extractTextFromMessage(message);
  return (
    content.includes("<slash_skill_activation>") &&
    stripUploadedFilesTag(content).length === 0
  );
}

/**
 * Represents a file stored in message additional_kwargs.files.
 * Used for optimistic UI (uploading state) and structured file metadata.
 */
export interface FileInMessage {
  filename: string;
  size: number; // bytes
  path?: string; // virtual path, may not be set during upload
  status?: "uploading" | "uploaded";
}

/**
 * Strip backend-injected human context tags from message content.
 * Kept under its historical name because callers use it for uploaded-file
 * display cleanup.
 */
export function stripUploadedFilesTag(content: string): string {
  return content
    .replace(
      /<(current_uploads|uploaded_files|slash_skill_activation)>[\s\S]*?<\/\1>/g,
      "",
    )
    .trim();
}

/**
 * Tag names that backend middlewares wrap around internal payloads before
 * letting them ride along inside LangGraph message ``content``.
 *
 * These markers are *not* user copy — they come from:
 *
 * - ``UploadsMiddleware`` → ``<current_uploads>`` (``<uploaded_files>``
 *   before #4174; still emitted by IM channels and present in history)
 * - ``SkillActivationMiddleware`` → ``<slash_skill_activation>``
 * - ``DynamicContextMiddleware`` → ``<system-reminder>`` (carrying
 *   ``<memory>`` / ``<current_date>`` inside)
 * - ``TodoListMiddleware`` / ``LoopDetectionMiddleware`` style reminders
 *   live in ``hide_from_ui`` HumanMessages, but their inner payload uses
 *   the same tag vocabulary.
 * - Project context uses attributed ``<project>`` and ``<documents>`` blocks.
 *
 * The primary export filter is {@link isHiddenFromUIMessage}. This list is
 * the defence-in-depth strip for any message that — by middleware bug,
 * provider quirk, or merge-conflict regression — slips through without
 * its ``hide_from_ui`` flag set.
 */
export const INTERNAL_MARKER_TAGS = [
  "current_uploads",
  "uploaded_files",
  "slash_skill_activation",
  "system-reminder",
  "memory",
  "current_date",
  "project",
  "documents",
] as const;

// The project context blocks carry attributes (``<project name="…">``,
// ``<documents count=… shown=…>``), so the opener match tolerates an
// attribute span — same shape as the streamdown preprocess regex.
const INTERNAL_MARKER_RE = new RegExp(
  `<(${INTERNAL_MARKER_TAGS.join("|")})(?:\\s[^>]*)?>[\\s\\S]*?</\\1>`,
  "g",
);

/**
 * Character ranges that must survive marker stripping: fenced code blocks
 * (marker-aware, so a shorter or different fence inside a block does not
 * close it, and a fence line that carries an info string never closes one)
 * and 4-space indented code lines — the same protection the render
 * path applies in ``stripLeakedSystemTags``. ``project`` and ``documents``
 * are generic tag names, so a fenced Maven ``pom.xml`` or pasted XML must not
 * lose its span on export; a marker whose span STARTS inside a protected
 * range is left alone, while injected blocks (never fenced) keep being
 * removed even when their content contains a fence.
 */
function protectedCodeRanges(content: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  let fenceMarker: string | null = null;
  let fenceStart = 0;
  let offset = 0;
  for (const line of content.split("\n")) {
    const fenceMatch = FENCE_MARKER_RE.exec(line);
    if (fenceMatch) {
      const marker = fenceMatch[1]!;
      if (fenceMarker === null) {
        fenceMarker = marker;
        fenceStart = offset;
      } else if (isClosingFence(line, fenceMarker)) {
        ranges.push([fenceStart, offset + line.length]);
        fenceMarker = null;
      }
    } else if (fenceMarker !== null) {
      // Inside a fenced block: covered by the open range.
    } else if (INDENTED_CODE_RE.test(line)) {
      ranges.push([offset, offset + line.length]);
    }
    offset += line.length + 1;
  }
  if (fenceMarker !== null) {
    // Unclosed fence: everything after the opener is code.
    ranges.push([fenceStart, content.length]);
  }
  return ranges;
}

/**
 * Strip every known backend-injected marker from message content.
 *
 * Intended for the chat export path where a marker leaking through is a
 * privacy regression. UI render paths should keep using
 * {@link stripUploadedFilesTag} — they receive ``hide_from_ui`` messages
 * via a separate filter and the narrower function avoids stripping content
 * a user might legitimately type into a meta-discussion (e.g. asking the
 * model about its own ``<memory>`` system).
 *
 * Code-aware like the renderer: markers inside fenced or indented code
 * blocks are preserved, so a pasted ``<project>``/``<documents>`` snippet in
 * a code block is not silently deleted from the exported markdown.
 */
export function stripInternalMarkers(content: string): string {
  const protectedRanges = protectedCodeRanges(content);
  if (protectedRanges.length === 0) {
    return content.replace(INTERNAL_MARKER_RE, "").trim();
  }
  return content
    .replace(INTERNAL_MARKER_RE, (match: string, ...args: unknown[]) => {
      const offset = args[args.length - 2] as number;
      const isProtected = protectedRanges.some(
        ([start, end]) => offset >= start && offset < end,
      );
      return isProtected ? match : "";
    })
    .trim();
}

// The upload context block renders sizes as human-readable strings
// (uploads_middleware.py::_format_file_entry emits "<n> KB" / "<n> MB",
// mirroring formatBytes). Convert them back to bytes so the parsed
// FileInMessage.size honours its bytes contract and chips re-render at the
// original magnitude instead of e.g. treating "177.6 KB" as 177 bytes.
function parseHumanReadableSize(raw: string): number {
  const match = /([\d.]+)\s*(B|KB|MB|GB|TB)?/i.exec(raw.trim());
  if (!match) return 0;
  const value = parseFloat(match[1] ?? "");
  if (!Number.isFinite(value)) return 0;
  const multipliers: Record<string, number> = {
    B: 1,
    KB: 1024,
    MB: 1024 ** 2,
    GB: 1024 ** 3,
    TB: 1024 ** 4,
  };
  const unit = (match[2] ?? "B").toUpperCase();
  return Math.round(value * (multipliers[unit] ?? 1));
}

export function parseUploadedFiles(content: string): FileInMessage[] {
  // Match the upload context block; the tag name depends on backend version
  // (<current_uploads> since #4174, <uploaded_files> before / on IM paths).
  const uploadedFilesRegex =
    /<(current_uploads|uploaded_files)>([\s\S]*?)<\/\1>/;
  const match = content.match(uploadedFilesRegex);

  if (!match) {
    return [];
  }

  const uploadedFilesContent = match[2];

  // Check if it's "No files have been uploaded yet."
  if (uploadedFilesContent?.includes("No files have been uploaded yet.")) {
    return [];
  }

  // Check if the backend reported no new files were uploaded in this message
  if (uploadedFilesContent?.includes("(empty)")) {
    return [];
  }

  // Parse file list
  // Format: - filename (size)\n  Path: /path/to/file
  // The filename itself may contain parentheses (e.g. "photo (1).png"), so
  // the size group is anchored on the trailing "(<number> <unit>)" pair the
  // backend emits instead of stopping the filename at the first "(".
  const fileRegex =
    /- (.+)\s*\(([\d.]+\s*(?:B|KB|MB|GB|TB))\)\s*\n\s*Path:\s*([^\n]+)/gi;
  const files: FileInMessage[] = [];
  let fileMatch;

  while ((fileMatch = fileRegex.exec(uploadedFilesContent ?? "")) !== null) {
    files.push({
      filename: fileMatch[1]!.trim(),
      size: parseHumanReadableSize(fileMatch[2]!),
      path: fileMatch[3]!.trim(),
    });
  }

  return files;
}
