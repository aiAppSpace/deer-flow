/*
  【文件职责】     把 assistant processing 消息组投影成稳定的推理、文本、工具步骤视图。
  【架构位置】     L3 DeerFlow 消息展示模型（纯 TS）
  【主要导出】     deriveProcessingMessageView 及 ProcessingStep 类型
  【依赖关系】     core/messages/utils · core/types/message · core/threads/types
  【边界与注意】   只解释一个消息组；工具结果/browser frame 索引每组只构建一次，组件不得重扫。
*/

import type { ArtifactEntry } from "@/core/threads/types";
import type { Message } from "@/core/types/message";

import {
  extractContentFromMessage,
  extractReasoningContentFromMessage,
  extractTextFromMessage,
} from "./utils";

interface ProcessingStepBase<T extends string> {
  id?: string;
  messageId?: string;
  type: T;
}

export interface ProcessingReasoningStep extends ProcessingStepBase<"reasoning"> {
  reasoning: string;
}

export interface ProcessingAssistantTextStep extends ProcessingStepBase<"assistantText"> {
  content: string;
}

export interface BrowserViewMeta {
  screenshot: string;
  url?: string;
  title?: string;
}

export interface ProcessingToolCallStep extends ProcessingStepBase<"toolCall"> {
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
  resultMessage?: Extract<Message, { type: "tool" }>;
  browserView?: BrowserViewMeta;
  artifacts?: ArtifactEntry[];
}

export type ProcessingStep =
  | ProcessingReasoningStep
  | ProcessingAssistantTextStep
  | ProcessingToolCallStep;

export interface ProcessingMessageView {
  steps: readonly ProcessingStep[];
  lastToolCall?: ProcessingToolCallStep;
  earlierSteps: readonly ProcessingStep[];
  collapsibleSteps: readonly ProcessingStep[];
  alwaysVisibleEarlierText: readonly ProcessingAssistantTextStep[];
  textAfterLastToolBeforeReasoning: readonly ProcessingAssistantTextStep[];
  trailingReasoning?: ProcessingReasoningStep;
  answerAfterReasoning: readonly ProcessingAssistantTextStep[];
  visibleBeforeTrailingReasoning: readonly ProcessingAssistantTextStep[];
}

function parseToolResult(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function readBrowserView(message: Message): BrowserViewMeta | undefined {
  const candidate = message.additional_kwargs?.browser_view;
  if (
    !candidate ||
    typeof candidate !== "object" ||
    typeof Reflect.get(candidate, "screenshot") !== "string"
  ) {
    return undefined;
  }
  const url = Reflect.get(candidate, "url");
  const title = Reflect.get(candidate, "title");
  return {
    screenshot: Reflect.get(candidate, "screenshot") as string,
    ...(typeof url === "string" ? { url } : {}),
    ...(typeof title === "string" ? { title } : {}),
  };
}

function indexToolCallData(messages: readonly Message[]) {
  const results = new Map<string, unknown>();
  const resultMessages = new Map<string, Extract<Message, { type: "tool" }>>();
  const browserViews = new Map<string, BrowserViewMeta>();

  for (const message of messages) {
    if (message.type !== "tool" || !message.tool_call_id) continue;
    const id = message.tool_call_id;
    if (!resultMessages.has(id)) resultMessages.set(id, message);
    if (!results.has(id)) {
      const text = extractTextFromMessage(message);
      if (text) results.set(id, parseToolResult(text));
    }
    if (!browserViews.has(id)) {
      const browserView = readBrowserView(message);
      if (browserView) browserViews.set(id, browserView);
    }
  }

  return { browserViews, results, resultMessages };
}

function deriveSteps(
  messages: readonly Message[],
  toolArtifacts: readonly ArtifactEntry[],
): ProcessingStep[] {
  const steps: ProcessingStep[] = [];
  const { browserViews, results, resultMessages } = indexToolCallData(messages);
  const artifactsByToolCallId = new Map<string, ArtifactEntry[]>();
  for (const entry of toolArtifacts) {
    const entries = artifactsByToolCallId.get(entry.tool_call_id) ?? [];
    entries.push(entry);
    artifactsByToolCallId.set(entry.tool_call_id, entries);
  }

  for (const [messageIndex, message] of messages.entries()) {
    if (message.type !== "ai") continue;

    const reasoning = extractReasoningContentFromMessage(message);
    if (reasoning) {
      steps.push({
        id: message.id,
        messageId: message.id,
        type: "reasoning",
        reasoning,
      });
    }

    const content = extractContentFromMessage(message);
    if (content) {
      steps.push({
        id: `${message.id ?? `ai-${messageIndex}`}-content`,
        messageId: message.id,
        type: "assistantText",
        content,
      });
    }

    for (const toolCall of message.tool_calls ?? []) {
      if (toolCall.name === "task") continue;
      const step: ProcessingToolCallStep = {
        id: toolCall.id,
        messageId: message.id,
        type: "toolCall",
        name: toolCall.name,
        args: toolCall.args ?? {},
      };
      if (toolCall.id) {
        if (results.has(toolCall.id)) step.result = results.get(toolCall.id);
        step.resultMessage = resultMessages.get(toolCall.id);
        step.artifacts = artifactsByToolCallId.get(toolCall.id);
        const browserView = browserViews.get(toolCall.id);
        if (browserView) step.browserView = browserView;
      }
      steps.push(step);
    }
  }

  return steps;
}

/**
 * Match React's processing panel layout exactly: earlier non-text steps are
 * collapsible, only the latest tool stays active, and answer text emitted
 * after trailing reasoning remains below its disclosure.
 */
export function deriveProcessingMessageView(
  messages: readonly Message[],
  toolArtifacts: readonly ArtifactEntry[] = [],
): ProcessingMessageView {
  const steps = deriveSteps(messages, toolArtifacts);
  const lastToolCall = [...steps]
    .reverse()
    .find((step): step is ProcessingToolCallStep => step.type === "toolCall");
  const lastToolCallIndex = lastToolCall ? steps.indexOf(lastToolCall) : -1;
  const earlierSteps =
    lastToolCallIndex >= 0 ? steps.slice(0, lastToolCallIndex) : [];
  const afterLastTool =
    lastToolCallIndex >= 0 ? steps.slice(lastToolCallIndex + 1) : steps;
  const trailingReasoning = lastToolCall
    ? afterLastTool.find(
        (step): step is ProcessingReasoningStep => step.type === "reasoning",
      )
    : [...steps]
        .reverse()
        .find(
          (step): step is ProcessingReasoningStep => step.type === "reasoning",
        );
  const trailingReasoningIndex = trailingReasoning
    ? steps.indexOf(trailingReasoning)
    : -1;
  const answerAfterReasoning =
    trailingReasoningIndex >= 0
      ? steps
          .slice(trailingReasoningIndex + 1)
          .filter(
            (step): step is ProcessingAssistantTextStep =>
              step.type === "assistantText",
          )
      : [];
  const answerIds = new Set(answerAfterReasoning);
  const textAfterLastToolBeforeReasoning = lastToolCall
    ? afterLastTool.filter(
        (step): step is ProcessingAssistantTextStep =>
          step.type === "assistantText" && !answerIds.has(step),
      )
    : [];
  const alwaysVisibleEarlierText = earlierSteps.filter(
    (step): step is ProcessingAssistantTextStep =>
      step.type === "assistantText",
  );
  const visibleBeforeTrailingReasoning = (
    lastToolCall
      ? [...alwaysVisibleEarlierText, ...textAfterLastToolBeforeReasoning]
      : steps.filter(
          (step): step is ProcessingAssistantTextStep =>
            step.type === "assistantText" && !answerIds.has(step),
        )
  ) as ProcessingAssistantTextStep[];

  return {
    steps,
    lastToolCall,
    earlierSteps,
    collapsibleSteps: earlierSteps.filter(
      (step) => step.type !== "assistantText",
    ),
    alwaysVisibleEarlierText,
    textAfterLastToolBeforeReasoning,
    trailingReasoning,
    answerAfterReasoning,
    visibleBeforeTrailingReasoning,
  };
}
