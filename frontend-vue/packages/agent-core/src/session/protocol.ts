/*
  【文件职责】     会话与协议之间的接口：怎么开流、怎么续、怎么停、怎么查终态。
  【架构位置】     L1
  【主要导出】     StreamRequest · OpenedStream · CancelResult · InspectedRun
                   RunProtocol · StreamSignal · ClassifyEvent
  【依赖关系】     ../errors · ../transport/sse-event
  【边界与注意】   内核收到的**不是**一个可重复调用的 `url + init`（08 §Run session）。
                   给它那个，它迟早会在断线时把 create POST 再发一遍——那是「用户
                   发一次、后端跑两个 run」的形状。所以 create/resume/cancel/inspect
                   是四个各自具名的方法，谁能重放写在类型里。

                   `ClassifyEvent` 是这里唯一的「协议知识入口」。内核不认识 `end`
                   / `error` / `gap` 这些名字（它们是 DeerFlow 的 wire 事件名，
                   写进 L1 就等于把协议塞进内核），但它必须知道「这一帧意味着流
                   正常结束 / 后端报错 / 出现重放缺口」，否则 EOF 到底是完成还是
                   断线永远分不出来。把这个判断做成适配层传入的纯函数，是让内核
                   保持协议无关的同时仍能正确收敛的唯一办法。
*/

import type { AgentStreamError } from "../errors";
import type { SseEvent } from "../transport/sse-event";

export interface StreamRequest {
  url: string | URL;
  init: RequestInit;
}

export interface OpenedStream<THandle> {
  handle: THandle;
  response: Response;
}

/**
 * cancel 的三种真实结果，不能压成 `void`（05 L16）。
 *
 * `outcome` 是本文件相对 08 的一处**有意加宽**，理由见 `InspectedRun`。
 */
export type CancelResult =
  | { kind: "drain"; response: Response; outcome?: RunOutcome; reason?: string }
  | { kind: "accepted" }
  | { kind: "terminal"; outcome?: RunOutcome; reason?: string };

export type RunOutcome = "completed" | "cancelled" | "failed";

/**
 * durable run 的一次探查。
 *
 * ⚠️ **相对 08 §Run session 的 `InspectedRun` 多了 `outcome`。** 08 只给了
 * `{ terminal, reason }`，但同一份文档的 §事件与完整状态归约又要求「只有 durable
 * `interrupted` 才进入 `cancelled`，`success` 进入 `completed`，`error|timeout`
 * 进入 `failed`」——三个去向，而 `terminal: boolean` 只能表达两个。要在只有
 * `{terminal, reason}` 的情况下分出三路，内核就得认识 `"interrupted"` 这类
 * DeerFlow durable status 字符串，那正是 L1 禁入清单第 2/3 条禁止的。
 * 所以映射留在适配层，内核只接收映射结果。08 已同步这一处。
 */
export interface InspectedRun {
  terminal: boolean;
  outcome?: RunOutcome;
  reason?: string;
}

export interface RunProtocol<TStart, THandle> {
  /** 只调用一次；网络错误发生在拿到 handle 之前时默认 fail closed。 */
  create(input: TStart, signal: AbortSignal): Promise<OpenedStream<THandle>>;
  /** 只针对已存在的 run；由协议适配器决定 GET、header 或 query cursor。 */
  resume(
    handle: THandle,
    cursor: string | undefined,
    signal: AbortSignal,
  ): Promise<Response>;
  /** 不得把 200 SSE、202 accepted 和 204 terminal 压成 void。 */
  cancel(
    handle: THandle,
    cursor: string | undefined,
    signal: AbortSignal,
  ): Promise<CancelResult>;
  /** cancel 只返回 accepted 时，用 durable run resource 收敛到终态。 */
  inspect(handle: THandle, signal: AbortSignal): Promise<InspectedRun>;
}

/** 一帧业务事件对**流的走向**意味着什么。内容含义仍归 reducer。 */
export type StreamSignal =
  | { kind: "data" }
  | { kind: "completed" }
  | { kind: "failed"; error: AgentStreamError }
  | { kind: "gap" };

export type ClassifyEvent = (event: SseEvent) => StreamSignal;
