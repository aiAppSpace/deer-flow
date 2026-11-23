/*
  【文件职责】     把 L1 内核（store + session）与 L3 的 DeerFlow 协议装配成
                   一个「一个 thread 的运行器」，并把流事件分派给上层钩子。
  【架构位置】     L3（框架无关）
  【主要导出】     ThreadRunner · createThreadRunner
  【依赖关系】     @deerflow/agent-core · ./run-protocol · ./gap-recovery
                   ./reducer · ./event-map · ./message-adapt
  【边界与注意】   **这一层不认识 Vue，是有意的。** M2 的内核到 M4a 之前一个调用方
                   都没有；如果接线直接写成 composable，那么「内核能不能被非 Vue
                   宿主消费」这件事就再也没有证据了——而 08 的整包可复用是这套
                   分层的全部理由。本文件是那份证据：它用 `subscribe(listener)`
                   而不是 ref，Vue 侧只是把 listener 换成一次 `triggerRef`。

                   钩子的名字有意与上游 `useStream` 的回调对齐
                   （onCreated / onUpdateEvent / onCustomEvent / onError / onFinish），
                   因为 `hooks.ts` 里那五个回调体是逐段搬过来的，名字对得上才能
                   逐段核对。**唯一多出来的是 `onValues`**：上游靠 SDK 内部把
                   `values` 折进 `thread.messages`，这里必须显式说一声，
                   否则消费方不知道快照换了。

                   `submit()` 是**异步循环**而不是 `for await` 交给调用方：
                   gap 恢复会在一次 `submit` 内部产生多段流（05 A5 最多 6 次），
                   把迭代器暴露出去，调用方就得自己处理「这一段结束了但 run 没结束」。
*/

import {
  captureRunInvocation,
  type RunInvocation,
} from "@/core/diagnostics/run-observation";
import type {
  AgentSnapshot,
  AgentExternalStore,
  RunSessionState,
  SseEvent,
} from "@deerflow/agent-core";
import {
  AgentStreamError,
  createAgentExternalStore,
} from "@deerflow/agent-core";

import type { Message } from "../types/message";

import type { DeerFlowRunHandle } from "./endpoints";
import { classifyDeerFlowEvent, parseWireEventName } from "./event-map";
import { createGapAwareRun, MAX_STREAM_GAP_RECOVERIES } from "./gap-recovery";
import { toRenderableMessage, toWireMessages } from "./message-adapt";
import type { DeerFlowThreadState } from "./reducer";
import {
  createDeerFlowEventReducer,
  EMPTY_DEERFLOW_THREAD_STATE,
} from "./reducer";
import type { DeerFlowProtocol, DeerFlowRunInput } from "./run-protocol";

/** 05 L6 / L5 的默认值；调用方可以覆盖，测试里会调小。 */
export const DEFAULT_SESSION_LIMITS = {
  maxBufferBytes: 1024 * 1024,
  maxReconnects: 5,
} as const;

export interface ThreadRunnerHooks {
  /** 拿到 run handle 的第一时间（上游 `onCreated`）。 */
  onStart?: (handle: DeerFlowRunHandle) => void;
  /** `updates` 帧的原始载荷：标题写入与 summarization 捕获都读它。 */
  onUpdateEvent?: (data: unknown) => void;
  /** `custom` 帧的原始载荷：subtask 事件与 `stream_replay_gap` 都走这里。 */
  onCustomEvent?: (data: unknown) => void;
  /** 快照变了（合并通知之后）。 */
  onSnapshot?: () => void;
  /**
   * **每一次**会话状态变化，包括中间态。
   *
   * 不能只靠 `onStart` / `onSettled` 推状态：`creating` 段（create 请求已发出、
   * 响应还没回来）在这两个钩子之间，而 UI 的停止按钮必须在那一段就出现——
   * 实测漏掉它的表现是慢连接下停止按钮永远不出现（M4a gate 的第 4 条用例）。
   */
  onSessionState?: (state: RunSessionState<DeerFlowRunHandle>) => void;
  onError?: (error: AgentStreamError) => void;
  /** 到达终态。`outcome` 与 `RunSessionState.status` 同名。 */
  onSettled?: (state: RunSessionState<DeerFlowRunHandle>) => void;
}

export interface ThreadRunnerOptions extends ThreadRunnerHooks {
  protocol: DeerFlowProtocol;
  /** 08 硬规则 6：gap 之后先 reload durable state。 */
  loadDurableState: (
    handle: DeerFlowRunHandle,
    signal: AbortSignal,
  ) => Promise<Record<string, unknown> | undefined>;
  createId?: () => string;
  now?: () => number;
  /** 见 external-store：Vue 侧可换 `nextTick`，测试里换同步执行。 */
  scheduleNotify?: (flush: () => void) => void;
  maxBufferBytes?: number;
  maxReconnects?: number;
  maxRejoins?: number;
  sleep?: (ms: number) => Promise<void>;
  onUnknownEvent?: (name: string, event: SseEvent) => void;
}

export interface ThreadRunner {
  getSnapshot(): AgentSnapshot<DeerFlowThreadState>;
  /** 归一化消息转回 wire 形状——C 组的归并函数全部在 wire 层工作。 */
  getWireMessages(): Message[];
  /** Assistant IDs actually received on this run's message stream, never inferred from row order. */
  getStreamingMessageIds(): ReadonlySet<string>;
  getSessionState(): RunSessionState<DeerFlowRunHandle>;
  isStreaming(): boolean;
  /**
   * 打开线程时把最新 checkpoint 落进 store（上游 SDK 的 `initialValues`）。
   *
   * **只在 idle 时生效，返回值就是「有没有落下去」。** 这不是防御性编程，
   * 是种子的语义边界：种子是异步取回来的，它到达时这个 runner 可能已经在跑
   * 一个 run 了（`/chats/new` 提交之后 threadId 从 null 变成真 id 就是这条路径），
   * 而 `values` 帧对 reducer 是**全量替换**——晚到的种子会把正在流的消息抹掉。
   * 上游靠 `values = stream.values ?? historyValues` 这个纯推导天然没有这个问题，
   * 本仓的种子要进 store，就得把同一条边界显式写出来。
   *
   * 切 thread 时调用方会 `reset()`，状态回到 idle，于是下一条线程能重新种。
   */
  seedDurableState(values: Record<string, unknown>): boolean;
  /**
   * run 结束之后重新取回来的 checkpoint。
   *
   * 与 `seedDurableState` 只差放行条件一处，但那一处是全部的意义所在：run settle
   * 之后 `sessionState.status` 停在 `completed`/`cancelled`/`failed`，**永远不会自己
   * 回到 `idle`**（只有 `reset()` 会），所以走 `seedDurableState` 的话这一帧会被
   * 无声丢掉。这里改成「只在**还在流**的时候拒绝」。
   *
   * 反过来也不能把 `seedDurableState` 一起放宽：那道 `idle` 守的是**run 开始之前
   * 就发出、run 结束之后才落地**的那一帧——它持有的是 run 之前的状态，放进来会把
   * 整个 run 抹掉。两个入口拿到的 `values` 新旧不同，所以判据也不同。
   */
  refreshDurableState(values: Record<string, unknown>): boolean;
  subscribe(listener: () => void): () => void;
  submit(input: DeerFlowRunInput): Promise<void>;
  /** Observe an existing run; never creates or automatically cancels it. */
  join(handle: DeerFlowRunHandle): Promise<void>;
  stop(): void;
  abort(): void;
  /** Permanently release this owner's subscriptions and local connections. */
  dispose(): void;
  /** 切换 thread：丢掉快照与会话，不发任何请求。 */
  reset(): void;
  flushNotifications(): void;
}

/**
 * 「这个 run 还在跑」的会话状态集合。
 *
 * 导出而不是私有：Vue 侧的 `isStreaming` 读的是响应式的 `sessionStatus` ref，
 * 不能直接调 `runner.isStreaming()`（那是闭包变量，不进依赖收集），于是它必须
 * 自己判一次。原先两边各写了一份字面量数组——实测把 runner 这份里的 `creating`
 * 删掉，整套门禁一条都不红，因为上屏的那份在 composable 里。同一条协议知识写两遍，
 * 早晚对不上。
 *
 * **`creating` 必须在里面**：create 请求已发出、响应还没回来的那一段也算在跑，
 * 停止按钮要在那时就出现（见 `ThreadRunnerHooks.onSessionState` 的注释）。
 */
export const STREAMING_STATUSES: ReadonlySet<string> = new Set([
  "creating",
  "streaming",
  "reconnecting",
  "stopping",
]);

function defaultCreateId(): string {
  return globalThis.crypto.randomUUID();
}

export function createThreadRunner(options: ThreadRunnerOptions): ThreadRunner {
  const {
    protocol,
    loadDurableState,
    createId = defaultCreateId,
    now = () => Date.now(),
    scheduleNotify,
    maxBufferBytes = DEFAULT_SESSION_LIMITS.maxBufferBytes,
    maxReconnects = DEFAULT_SESSION_LIMITS.maxReconnects,
    maxRejoins = MAX_STREAM_GAP_RECOVERIES,
    sleep,
    onUnknownEvent,
    onStart,
    onSessionState,
    onUpdateEvent,
    onCustomEvent,
    onSnapshot,
    onError,
    onSettled,
  } = options;

  let streamingMessageIds: ReadonlySet<string> = new Set();
  const reduceEvent = createDeerFlowEventReducer({ onUnknownEvent });
  const store: AgentExternalStore<DeerFlowThreadState, SseEvent> =
    createAgentExternalStore<DeerFlowThreadState, SseEvent>({
      initialState: EMPTY_DEERFLOW_THREAD_STATE,
      reducer(event, snapshot, context) {
        const actions = reduceEvent(event, snapshot, context);
        if (parseWireEventName(event.event).mode === "messages") {
          for (const action of actions) {
            if (
              (action.type === "upsert-message" ||
                action.type === "merge-message") &&
              action.message.role === "assistant" &&
              !streamingMessageIds.has(action.message.id)
            ) {
              streamingMessageIds = new Set([
                ...streamingMessageIds,
                action.message.id,
              ]);
            }
          }
        }
        return actions;
      },
      createId,
      now,
      ...(scheduleNotify ? { scheduleNotify } : {}),
    });

  let sessionState: RunSessionState<DeerFlowRunHandle> = { status: "idle" };
  let active: ReturnType<typeof createGapAwareRun> | undefined;
  let announcedHandle: string | undefined;
  let generation = 0;
  let activeObservation: RunInvocation | null = null;
  let disposed = false;
  const subscriptions = new Set<() => void>();

  const unsubscribeSnapshot = store.subscribe(() => onSnapshot?.());

  function parseData(event: SseEvent): unknown {
    try {
      return JSON.parse(event.data);
    } catch {
      // 分派用的载荷读不出来时交原文。这里**不能**抛：reducer 那边已经把
      // 解析失败落成 error action 了，在分派路径上再抛一次会把整条流掐断。
      return event.data;
    }
  }

  async function consume(
    input: DeerFlowRunInput,
    initialHandle?: DeerFlowRunHandle,
  ): Promise<void> {
    if (disposed) throw new Error("Thread runner has been disposed.");
    active?.abort();
    activeObservation?.retire();
    const observation = captureRunInvocation(() => input, "adapter");
    activeObservation = observation;
    streamingMessageIds = new Set();
    const runGeneration = ++generation;
    const run = createGapAwareRun({
      protocol,
      loadDurableState,
      maxRejoins,
      ...(initialHandle ? { initialHandle } : {}),
      session: {
        classifyEvent: classifyDeerFlowEvent,
        maxBufferBytes,
        maxReconnects,
        ...(sleep ? { sleep } : {}),
      },
    });
    active = run;
    announcedHandle = undefined;

    try {
      for await (const output of run.run(input)) {
        if (runGeneration !== generation) break;
        if (output.kind === "state") {
          sessionState = output.state;
          if (!STREAMING_STATUSES.has(output.state.status)) {
            streamingMessageIds = new Set();
          }
          onSessionState?.(output.state);
          const handle =
            "handle" in output.state ? output.state.handle : undefined;
          if (handle && handle.runId !== announcedHandle) {
            announcedHandle = handle.runId;
            onStart?.(handle);
            observation?.delivered(handle, handle.threadId, handle.runId);
          }
          if (output.state.status === "failed") {
            onError?.(output.state.error);
          }
          if (!STREAMING_STATUSES.has(output.state.status)) {
            onSettled?.(output.state);
          }
          continue;
        }
        if (output.kind === "heartbeat") continue;

        // 派发在前、分类钩子在后：钩子（比如 A7 的清空）要看到的是
        // **这一帧已经进过 store 之后**的世界。反过来的话 gap 的清空动作
        // 会先跑，紧随其后的 `values` 又把状态写回去。
        store.dispatch(output.event);
        const { mode } = parseWireEventName(output.event.event);
        if (mode === "updates") onUpdateEvent?.(parseData(output.event));
        if (mode === "custom") onCustomEvent?.(parseData(output.event));
      }
    } catch (cause) {
      if (runGeneration !== generation) return;
      const error =
        cause instanceof AgentStreamError
          ? cause
          : new AgentStreamError("unknown", String(cause), { cause });
      sessionState = { status: "failed", error };
      streamingMessageIds = new Set();
      onSessionState?.(sessionState);
      onError?.(error);
      onSettled?.(sessionState);
    } finally {
      if (runGeneration === generation) active = undefined;
    }
  }

  // 与 gap 恢复走同一条路：合成一帧 `values` 交给 reducer。两个种子入口必须同形，
  // 否则「durable state 怎么落地」这件事就有两份实现。
  function applyDurableValues(values: Record<string, unknown>): boolean {
    store.dispatch({ event: "values", data: JSON.stringify(values) });
    return true;
  }

  function abortLocalRun() {
    generation += 1;
    activeObservation?.retire();
    activeObservation = null;
    active?.abort();
    active = undefined;
    announcedHandle = undefined;
    streamingMessageIds = new Set();
    sessionState = { status: "idle" };
    if (!disposed) onSessionState?.(sessionState);
  }

  return {
    getSnapshot: () => store.getSnapshot(),
    getWireMessages() {
      const snapshot = store.getSnapshot();
      return toWireMessages(
        snapshot.messageIds.flatMap((id) => {
          const message = snapshot.messages[id];
          return message ? [message] : [];
        }),
      ).map(toRenderableMessage);
    },
    getSessionState: () => sessionState,
    getStreamingMessageIds: () => streamingMessageIds,
    isStreaming: () => STREAMING_STATUSES.has(sessionState.status),
    seedDurableState(values) {
      if (sessionState.status !== "idle") return false;
      return applyDurableValues(values);
    },
    refreshDurableState(values) {
      if (STREAMING_STATUSES.has(sessionState.status)) return false;
      return applyDurableValues(values);
    },
    subscribe(listener) {
      if (disposed) return () => {};
      const unsubscribe = store.subscribe(listener);
      const release = () => {
        unsubscribe();
        subscriptions.delete(release);
      };
      subscriptions.add(release);
      return release;
    },
    submit: consume,
    join: (handle) =>
      consume({ threadId: handle.threadId, payload: {} }, handle),
    stop() {
      active?.stop();
    },
    abort: abortLocalRun,
    dispose() {
      if (disposed) return;
      disposed = true;
      abortLocalRun();
      unsubscribeSnapshot();
      for (const release of [...subscriptions]) release();
    },
    reset() {
      if (disposed) return;
      abortLocalRun();
      store.reset(EMPTY_DEERFLOW_THREAD_STATE);
    },
    flushNotifications: () => store.flushNotifications(),
  };
}
