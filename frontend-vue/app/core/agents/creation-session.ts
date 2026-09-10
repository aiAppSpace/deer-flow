/*
  【文件职责】     解释 setup_agent 的结构化 ToolMessage，并构造隐藏保存提交。
  【架构位置】     L3 Agent 创建协议
  【主要导出】     classifySetupAgentResult · buildAgentSaveSubmission
  【依赖关系】     core/types/message · core/messages/utils
  【边界与注意】   只认 AI tool-call ID 与 ToolMessage.status；assistant 文本永远不是创建证据。
*/

import { textOfMessage } from "@/core/messages/utils";
import type { Message } from "@/core/types/message";

export type SetupAgentResult =
  { kind: "missing" } | { kind: "success" } | { kind: "error"; detail: string };

export function classifySetupAgentResult(
  messages: readonly Message[],
): SetupAgentResult {
  const toolCallIds = new Set<string>();
  for (const message of messages) {
    if (message.type !== "ai") continue;
    for (const call of message.tool_calls ?? []) {
      if (call.name === "setup_agent" && call.id) toolCallIds.add(call.id);
    }
  }

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.type !== "tool" || !toolCallIds.has(message.tool_call_id)) {
      continue;
    }
    if (message.status === "success") return { kind: "success" };
    if (message.status === "error") {
      return {
        kind: "error",
        detail: textOfMessage(message).trim() || "setup_agent failed.",
      };
    }
  }

  return { kind: "missing" };
}

export function buildAgentSaveSubmission(text: string) {
  return {
    text,
    files: [],
    additionalKwargs: { hide_from_ui: true } as const,
  };
}
