/*
  【文件职责】     消息的「UI 身份」与按身份去重——C 组每一条的公共底座。
  【架构位置】     L3（纯 TS，不认识 Vue）
  【主要导出】     messageIdentity · dedupeMessagesByIdentity
                   dedupeRunMessagesByIdentity · buildVisibleHistoryMessages
                   removeSetItems
  【依赖关系】     ../messages/utils · ../types/message · ./types
  【边界与注意】   上游这些函数是 `hooks.ts` 的模块私有函数，夹在 React hook 中间。
                   拆出来的理由不是整洁，是**可测**：05 C 组自述「全文档最容易在
                   重写中丢失的部分」，而它的 25 个上游单测里 C 组那几个正是因为
                   `import { … } from "@/core/threads/hooks"` 会连带拖进
                   `useStream` / react-query / sonner 才没能落地。拆到这里之后，
                   `message-merge.test.ts`（上游 2,381 行）可以逐条搬。

                   `messageIdentity` 的 `__user` 后缀归一化**只对 human 生效**
                   （05 C7）。DynamicContextMiddleware 把提交的 HumanMessage(id=X)
                   换成隐藏的 SystemMessage(id=X) 加真正的 HumanMessage(id=X__user)；
                   对所有类型都归一化，会让那条 system 与 human 撞成同一个身份。
*/

import { isHiddenFromUIMessage } from "../messages/utils";
import type { Message } from "../types/message";

import type { RunMessage } from "./types";

const INJECTED_USER_MESSAGE_ID_SUFFIX = "__user";

export function isNonEmptyString(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}

export function messageIdentity(message: Message): string | undefined {
  if (
    "tool_call_id" in message &&
    typeof message.tool_call_id === "string" &&
    message.tool_call_id.length > 0
  ) {
    return `tool:${message.tool_call_id}`;
  }
  if (typeof message.id === "string" && message.id.length > 0) {
    // DynamicContextMiddleware replaces the submitted HumanMessage(id=X) with
    // a hidden SystemMessage(id=X) and the real HumanMessage(id=X__user).
    // Treat those human copies as one UI message so a committed render ledger
    // cannot retain X beside the later checkpoint copy X__user.
    const messageId =
      message.type === "human" &&
      message.id.endsWith(INJECTED_USER_MESSAGE_ID_SUFFIX)
        ? message.id.slice(0, -INJECTED_USER_MESSAGE_ID_SUFFIX.length) ||
          message.id
        : message.id;
    return `message:${messageId}`;
  }
  return undefined;
}

export function dedupeMessagesByIdentity(messages: Message[]): Message[] {
  const lastIndexByIdentity = new Map<string, number>();
  const lastVisibleIndexByIdentity = new Map<string, number>();

  // This is a UI-display dedupe rule, not a general LangChain message-stream
  // contract. Hidden messages that share an identity with a visible message are
  // treated as control messages for this merged view; hidden messages carrying
  // independent tracing/task semantics should use a distinct id or a custom
  // stream/state channel instead of relying on message dedupe preservation.
  const preservedTurnDurations = new Map<string, number>();
  messages.forEach((message, index) => {
    const identity = messageIdentity(message);
    if (identity) {
      lastIndexByIdentity.set(identity, index);
      if (!isHiddenFromUIMessage(message)) {
        lastVisibleIndexByIdentity.set(identity, index);
      }
      if (message.additional_kwargs?.turn_duration !== undefined) {
        preservedTurnDurations.set(
          identity,
          message.additional_kwargs.turn_duration as number,
        );
      }
    }
  });

  return messages
    .filter((message, index) => {
      const identity = messageIdentity(message);
      if (!identity) {
        return true;
      }
      const visibleIndex = lastVisibleIndexByIdentity.get(identity);
      if (visibleIndex !== undefined) {
        return visibleIndex === index;
      }
      return lastIndexByIdentity.get(identity) === index;
    })
    .map((message) => {
      const identity = messageIdentity(message);
      if (
        identity &&
        preservedTurnDurations.has(identity) &&
        message.additional_kwargs?.turn_duration === undefined
      ) {
        return {
          ...message,
          additional_kwargs: {
            ...message.additional_kwargs,
            turn_duration: preservedTurnDurations.get(identity),
          },
        } as Message;
      }
      return message;
    });
}

export function dedupeRunMessagesByIdentity(
  messages: RunMessage[],
): RunMessage[] {
  const lastIndexByIdentity = new Map<string, number>();
  messages.forEach((message, index) => {
    const identity = messageIdentity(message.content);
    if (identity) {
      lastIndexByIdentity.set(`${message.run_id}:${identity}`, index);
    }
  });

  return messages.filter((message, index) => {
    const identity = messageIdentity(message.content);
    if (!identity) {
      return true;
    }
    return lastIndexByIdentity.get(`${message.run_id}:${identity}`) === index;
  });
}

export function removeSetItems<T>(
  values: ReadonlySet<T>,
  itemsToRemove: Iterable<T>,
) {
  const next = new Set(values);
  for (const item of itemsToRemove) {
    next.delete(item);
  }
  return next;
}

export function buildVisibleHistoryMessages(
  messageRows: RunMessage[],
  supersededRunIds: ReadonlySet<string>,
) {
  const visibleRows = messageRows.filter(
    (message) => !supersededRunIds.has(message.run_id),
  );
  return dedupeMessagesByIdentity([
    // Carry the owning run_id onto the content message so historical subtask
    // cards can fetch their persisted step history on expand (#3779). run_id
    // lives on the RunMessage wrapper and would otherwise be dropped here.
    ...visibleRows.map((message) => ({
      ...message.content,
      run_id: message.run_id,
      ...(Reflect.get(message, "feedback") === undefined
        ? {}
        : { feedback: Reflect.get(message, "feedback") }),
    })),
  ]);
}
