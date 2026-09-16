/*
  【文件职责】     提交回合的请求体构造，以及工具结果探测。
  【架构位置】     L3（纯 TS）
  【主要导出】     hasToolResult · buildThreadSubmitMessages · buildRunContext
  【依赖关系】     ../types/message · ../settings（LocalSettings 的 context 形状）
  【边界与注意】   上游两处 run-context 字面量在此收敛为唯一构造器；模型能力约束 UI，
                   wire context 则严格保持 React 的 explicit effort → mode fallback 语义。
*/

import type { Message } from "../types/message";
import type { FileInMessage } from "../messages/utils";
import {
  normalizeComposerContext,
  type ComposerMode,
  type ComposerReasoningEffort,
} from "../models/capabilities";
import type { Model } from "../models/types";

export function hasToolResult(messages: Message[], toolName: string): boolean {
  const matchingToolCallIds = new Set<string>();
  for (const message of messages) {
    if (message.type !== "ai") {
      continue;
    }
    for (const toolCall of message.tool_calls ?? []) {
      if (toolCall.name === toolName && toolCall.id) {
        matchingToolCallIds.add(toolCall.id);
      }
    }
  }

  return messages.some(
    (message) =>
      message.type === "tool" &&
      (message.name === toolName ||
        matchingToolCallIds.has(message.tool_call_id)),
  );
}

export function buildThreadSubmitMessages({
  text,
  additionalKwargs,
  additionalInputMessages = [],
  filesForSubmit = [],
}: {
  text: string;
  additionalKwargs?: Record<string, unknown>;
  additionalInputMessages?: Message[];
  filesForSubmit?: FileInMessage[];
}): Message[] {
  return [
    ...additionalInputMessages,
    {
      type: "human",
      content: [
        {
          type: "text",
          text,
        },
      ],
      additional_kwargs: {
        ...additionalKwargs,
        ...(filesForSubmit.length > 0 ? { files: filesForSubmit } : {}),
      },
    } as Message,
  ];
}

export interface ThreadRunContextInput extends Record<string, unknown> {
  mode?: ComposerMode | string;
  reasoning_effort?: ComposerReasoningEffort;
}

const REASONING_EFFORT_BY_MODE: Record<string, "low" | "medium" | "high"> = {
  ultra: "high",
  pro: "medium",
  thinking: "low",
};

/**
 * 拼 run 请求里的 `context`。
 *
 * **不带 `thread_id`**（wave 216 去掉）。Gateway 的 `build_run_config` 里写着
 * `context["thread_id"] = thread_id`，而那个 `thread_id` 取自 **URL 路径**——
 * 客户端传什么都会被当场覆盖，注释也明写着「thread_id comes from the URL path,
 * not caller config」。也就是说这颗键在 wire 上**完全是空转的**。
 *
 * 上游两处（`core/threads/hooks.ts` 的普通提交与 replay 提交）也在发它，而且
 * **发的还是错的那一个**：`sendMessage(threadId, …)` 拿到的是提交那一刻客户端
 * 预生成的 draft id，而 run 打到的是后端真正创建出来的线程。
 * 对照台账 `chat-thread-init-ordering` 上那条 `requestBodies` 差异就是它
 * （React 侧被归一成 `«generated»`，本仓侧是夹具线程 id——两边指的不是同一条线程）。
 *
 * 一个服务端保证会丢弃、而且有一侧一直发错的字段，正确的做法是两边都不发。
 */
export function buildRunContext(
  context: ThreadRunContextInput,
  extraContext?: Record<string, unknown>,
  model?: Model | null,
): Record<string, unknown> {
  const normalized = model
    ? normalizeComposerContext(context, model)
    : { ...context };
  const mode = normalized.mode;
  const result: Record<string, unknown> = {
    ...extraContext,
    ...normalized,
    thinking_enabled: mode !== "flash",
    is_plan_mode: mode === "pro" || mode === "ultra",
    subagent_enabled: mode === "ultra",
    reasoning_effort:
      normalized.reasoning_effort ??
      (mode === undefined ? undefined : REASONING_EFFORT_BY_MODE[mode]),
  };
  return result;
}
