/*
  【文件职责】     消息的**可信位置**：后端盖的 thread 全局 seq，以及按它插位。
  【架构位置】     L3 thread ordering（纯函数，无状态）
  【主要导出】     MESSAGE_SEQ_KEY · isValidMessageSeq · trustedMessageSeq · insertByTrustedSeq
  【依赖关系】     ../types/message
  【边界与注意】   对应上游 `core/threads/message-order.ts` 里 seq 的那一半
                   （本仓把那个文件拆成 message-identity / message-seq / message-merge 三份）。

                   **`deerflow_seq` 是服务端拥有的展示元数据**，客户端只读、
                   永远不回写进 checkpoint。键名与后端
                   `deerflow/runtime/events/message_identity.py` 的 MESSAGE_SEQ_KEY 同名。

                   **只有正的安全整数才算数。** 缺失或非法的值**永远不覆盖**一个已知值——
                   这条和「同一身份的多个可信值收敛到最早的那个」一起，镜像后端
                   `get_message_seqs` 的 earliest-seq-wins 规则：重新持久化的副本
                   不能把消息往队尾推。

                   为什么本仓此前没有这一层：`message-merge.ts` 是从上游**加 seq 骨架
                   之前**的版本移植的（上游那版的局部规则叫 canonicalMinSeq）。
                   于是历史与实时合并时，一条 seq 已知、但在已加载窗口里找不到桥接
                   身份的消息，只能退回锚点编织——落到队尾而不是它在 feed 里的位置。
*/

import type { Message } from "../types/message";

/**
 * Thread 全局的 feed 位置。后端把它盖在历史行、以及它已经持久化过的
 * `values` 帧消息上。
 */
export const MESSAGE_SEQ_KEY = "deerflow_seq";

/** 只有正的安全整数才是可信的 seq。 */
export function isValidMessageSeq(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
}

/** 这条消息身上带着的可信位置；没有或不可信时返回 undefined。 */
export function trustedMessageSeq(message: Message): number | undefined {
  const seq = message.additional_kwargs?.[MESSAGE_SEQ_KEY];
  return isValidMessageSeq(seq) ? seq : undefined;
}

/**
 * 把带可信 seq 的消息插进一份**已经有序**的列表里它该在的位置。
 *
 * 两条不变式：
 * - 没有可信位置的条目**不会**为了给插入让路而移动；
 * - 被插入的消息若 seq 超过所有已知位置，保持既定的队尾顺序。
 *
 * 给「把抢救回来的消息叠回权威历史」的调用方用，所以 seq 骨架永远压过锚点猜测。
 */
export function insertByTrustedSeq(
  base: Message[],
  positioned: Message[],
): Message[] {
  if (positioned.length === 0) return base;
  const sorted = [...positioned].sort(
    (left, right) =>
      (trustedMessageSeq(left) ?? Number.POSITIVE_INFINITY) -
      (trustedMessageSeq(right) ?? Number.POSITIVE_INFINITY),
  );
  const result: Message[] = [];
  let next = 0;
  for (const message of base) {
    const seq = trustedMessageSeq(message);
    if (seq !== undefined) {
      while (
        next < sorted.length &&
        (trustedMessageSeq(sorted[next]!) ?? Number.POSITIVE_INFINITY) < seq
      ) {
        result.push(sorted[next]!);
        next += 1;
      }
    }
    result.push(message);
  }
  while (next < sorted.length) {
    result.push(sorted[next]!);
    next += 1;
  }
  return result;
}
