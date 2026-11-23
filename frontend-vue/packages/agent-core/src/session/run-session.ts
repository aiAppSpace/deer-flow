/*
  【文件职责】     create → stream → reconnect / gap / stop 的状态机，08 §硬规则 1–8。
  【架构位置】     L1
  【主要导出】     RunSessionOptions · RunSession · createRunSession
  【依赖关系】     ./protocol · ./state · ./backoff · ../transport · ../errors
  【边界与注意】   八条硬规则在本文件都有对应的**代码位置**，不是注释里的口号：
                   1. create 只调用一次        → `create()` 在循环外，且失败不重来
                   2. 拿到 handle 才能自动续传 → 重连分支读 `handle`，没有就 failed
                   3. 重连走 resume           → 循环里只调 `protocol.resume`
                   4. 只有网络错误可退避       → `error.retryable`（判据在 ../errors）
                   5. heartbeat 刷新活动时间   → yield heartbeat，由消费方记账
                   6. gap 不重放，先 reload    → 进 `gap` 态并**结束**，交给 L3
                   7. cancel 与 abort 分开     → `stop()` 走 cancel，`abort()` 只断读
                   8. stop 先进 stopping       → drain / poll 收敛后才落终态

                   `sleep` 与 `now` 注入而不是用全局：退避测试要能不等真实的 30 秒，
                   而 fake timer 拦不住 `await new Promise(r => setTimeout(r))` 之外
                   的实现细节漂移。注入之后测试给的是确定值，不是「希望时钟配合」。
*/

import { AgentStreamError, toAgentStreamError } from "../errors";
import { readSseFrames } from "../transport/read-sse-frames";

import { computeBackoffDelay, DEFAULT_BACKOFF } from "./backoff";
import type { BackoffOptions } from "./backoff";
import type { ClassifyEvent, RunProtocol, RunOutcome } from "./protocol";
import type { RunSessionState, SessionOutput } from "./state";

export interface RunSessionOptions<TStart, THandle> {
  protocol: RunProtocol<TStart, THandle>;
  /** A known run is observed through resume; it must never be created again. */
  initialHandle?: THandle;
  initialCursor?: string;
  classifyEvent: ClassifyEvent;
  /** 05 L6：后端一直不发分隔空行时最多攒多少字节。 */
  maxBufferBytes: number;
  /** 05 L5：整个 session 的重连总次数上限，成功后**不清零**。 */
  maxReconnects: number;
  backoff?: BackoffOptions;
  /** cancel 返回 accepted 后对 durable run 的有界轮询。 */
  inspectPolling?: { maxAttempts: number; intervalMs: number };
  sleep?: (ms: number) => Promise<void>;
}

export interface RunSession<TStart, THandle> {
  /** 惰性；`for await` 才真正发起 create。只能消费一次。 */
  run(input: TStart): AsyncGenerator<SessionOutput<THandle>>;
  /** UI 的 stop：请求服务端取消，并把会话收敛到终态。 */
  stop(): void;
  /** 只断开本地读取，不代表服务端 run 停了（05 L13）。 */
  abort(): void;
  getState(): RunSessionState<THandle>;
}

const DEFAULT_INSPECT_POLLING = { maxAttempts: 10, intervalMs: 500 };

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export function createRunSession<TStart, THandle>(
  options: RunSessionOptions<TStart, THandle>,
): RunSession<TStart, THandle> {
  const {
    protocol,
    initialHandle,
    initialCursor,
    classifyEvent,
    maxBufferBytes,
    maxReconnects,
    backoff = DEFAULT_BACKOFF,
    inspectPolling = DEFAULT_INSPECT_POLLING,
    sleep = defaultSleep,
  } = options;

  // 实例状态，不是模块状态：每个 thread / sidecar 会话各持一份（05 L8）。
  //
  // 两个 controller 不能合成一个。stop() 必须掐断**读**（否则 pump 一直挂在
  // read() 上，cancel 发不出去），但绝不能掐断随后那次 cancel/inspect ——
  // 合成一个的话 settleStop 会拿着一个已经 aborted 的 signal 去发 cancel，
  // 请求当场夭折，服务端的 run 根本没被通知。05 L13 说的「abort 不等于 cancel」
  // 在实现里就落在这两个 controller 的分界上。
  const streamController = new AbortController();
  const controlController = new AbortController();
  let state: RunSessionState<THandle> = { status: "idle" };
  let stopRequested = false;
  let cursor: string | undefined = initialCursor;
  let reconnects = 0;

  function setState(next: RunSessionState<THandle>): SessionOutput<THandle> {
    state = next;
    return { kind: "state", state: next };
  }

  /**
   * 可选字段：没有就**不写这个键**，而不是写一个 undefined。
   *
   * `exactOptionalPropertyTypes` 会把 `{ cursor: undefined }` 判成错，这不是
   * 编译器挑剔——两者在 `"cursor" in state`、`Object.keys()` 和 JSON 序列化下
   * 表现不同。会话状态会被适配层原样透传给 UI 与日志，留一个显式 undefined
   * 等于对外声称「这个字段存在，只是没值」。
   */
  const optional = <K extends string, V>(
    key: K,
    value: V | undefined,
  ): Record<K, V> | Record<string, never> =>
    value === undefined ? {} : ({ [key]: value } as Record<K, V>);

  function terminalFromOutcome(
    outcome: RunOutcome | undefined,
    reason: string | undefined,
    currentHandle: THandle,
  ): RunSessionState<THandle> {
    switch (outcome) {
      case "completed":
        return { status: "completed", handle: currentHandle };
      case "failed":
        return {
          status: "failed",
          handle: currentHandle,
          error: new AgentStreamError(
            "backend_error",
            reason ?? "Run ended in a failed state.",
          ),
        };
      // 缺省按已取消处理：走到这里说明用户点了 stop 且后端确认了终态。
      // 适配层没给出 outcome 时，把它读成「取消成功」比读成 completed 安全——
      // 后者会让 UI 显示一条其实被打断的回答已经正常完成。
      default:
        return {
          status: "cancelled",
          handle: currentHandle,
          ...optional("reason", reason),
        };
    }
  }

  /** cancel 之后把会话收敛到终态。drain / accepted / terminal 三条路各不相同。 */
  async function* settleStop(
    currentHandle: THandle,
  ): AsyncGenerator<SessionOutput<THandle>> {
    let result;
    try {
      result = await protocol.cancel(
        currentHandle,
        cursor,
        controlController.signal,
      );
    } catch (error) {
      yield setState({
        status: "failed",
        handle: currentHandle,
        error: toAgentStreamError(error, "http"),
      });
      return;
    }

    if (result.kind === "terminal") {
      yield setState(
        terminalFromOutcome(result.outcome, result.reason, currentHandle),
      );
      return;
    }

    if (result.kind === "drain") {
      yield setState({
        status: "stopping",
        handle: currentHandle,
        ...optional("cursor", cursor),
        mode: "draining",
      });
      // 尾帧照常归约：cancel 之后后端仍会把已经产生的内容发完，
      // 丢掉它们等于让用户看到的答案比后端存下来的短一截。
      // drain 必须用 control signal：stop() 刚刚 abort 掉了 stream signal，
      // 拿它去读尾帧会在第一次 read 之前就抛 abort——表现是用户每点一次停止，
      // 最后一段回答就被吞掉一截。这条是被 run-session.test.ts 的 drain 用例
      // 抓出来的，先写的版本正是错的那一版。
      const drained = yield* pump(
        result.response,
        currentHandle,
        controlController.signal,
        result,
      );
      if (drained !== "open") return;
      // EOF is not confirmation. Inspect and observe the remaining tail below.
    }

    yield setState({
      status: "stopping",
      handle: currentHandle,
      ...optional("cursor", cursor),
      mode: "polling",
    });
    for (let attempt = 0; attempt < inspectPolling.maxAttempts; attempt += 1) {
      let inspected;
      try {
        inspected = await protocol.inspect(
          currentHandle,
          controlController.signal,
        );
      } catch (error) {
        yield setState({
          status: "failed",
          handle: currentHandle,
          error: toAgentStreamError(error, "http"),
        });
        return;
      }
      if (inspected.terminal) {
        // A durable terminal status can precede finalization and the stream's
        // end frame. Keep the observer until the producer closes the run.
        try {
          const response = await protocol.resume(
            currentHandle,
            cursor,
            controlController.signal,
          );
          yield setState({
            status: "stopping",
            handle: currentHandle,
            ...optional("cursor", cursor),
            mode: "draining",
          });
          const outcome = yield* pump(
            response,
            currentHandle,
            controlController.signal,
            inspected,
          );
          if (outcome === "open") {
            yield setState({
              status: "failed",
              handle: currentHandle,
              error: new AgentStreamError(
                "network",
                "Run stream ended before a terminal event.",
              ),
            });
          }
        } catch (error) {
          yield setState({
            status: "failed",
            handle: currentHandle,
            error: toAgentStreamError(error, "http"),
          });
        }
        return;
      }
      await sleep(inspectPolling.intervalMs);
    }
    // 轮询预算用完仍未终态。这**不是**已取消：后端可能还在跑，
    // 谎报成 cancelled 会让 UI 允许用户马上再发一条，撞上同一个 thread。
    yield setState({
      status: "failed",
      handle: currentHandle,
      error: new AgentStreamError(
        "backend_error",
        `Run did not reach a terminal state within ${inspectPolling.maxAttempts} inspections.`,
      ),
    });
  }

  /**
   * 读一个 response 直到它结束或出现终止信号。
   *
   * 返回 `"open"` 表示流自然读完但协议没说结束——那是意外 EOF，调用方据此决定
   * 是否续传；其余情况状态已经落地，调用方直接收工。
   */
  async function* pump(
    response: Response,
    currentHandle: THandle,
    signal: AbortSignal,
    completion?: { outcome?: RunOutcome; reason?: string },
  ): AsyncGenerator<SessionOutput<THandle>, "open" | "settled"> {
    if (!response.body) {
      yield setState({
        status: "failed",
        handle: currentHandle,
        error: new AgentStreamError("http", "Response has no body to stream."),
      });
      return "settled";
    }

    const frames = readSseFrames(response.body, { maxBufferBytes, signal });

    try {
      for await (const frame of frames) {
        if (frame.kind === "heartbeat") {
          yield { kind: "heartbeat", comment: frame.comment };
          continue;
        }

        // 游标在**发出事件之前**推进：事件发出后消费方可能立刻触发 stop，
        // 那时 cancel 要带的是这一帧的 id，不是上一帧的。
        if (frame.event.id !== undefined) cursor = frame.event.id;

        const signal = classifyEvent(frame.event);
        if (signal.kind === "data") {
          yield { kind: "event", event: frame.event };
          continue;
        }
        if (signal.kind === "completed") {
          yield { kind: "event", event: frame.event };
          yield setState(
            terminalFromOutcome(
              completion?.outcome ?? "completed",
              completion?.reason,
              currentHandle,
            ),
          );
          return "settled";
        }
        if (signal.kind === "failed") {
          yield { kind: "event", event: frame.event };
          yield setState({
            status: "failed",
            handle: currentHandle,
            error: signal.error,
          });
          return "settled";
        }
        // gap：不从头重放，也不继续读这条流。先让 L3 reload durable state。
        yield { kind: "event", event: frame.event };
        yield setState({
          status: "gap",
          handle: currentHandle,
          recovery: "reload_durable_state",
        });
        return "settled";
      }
    } catch (error) {
      const failure = toAgentStreamError(error, "network");
      if (failure.kind === "abort" && stopRequested) {
        // 用户点的 stop：读被我们自己掐断，不是故障。收敛交给 settleStop。
        return "open";
      }
      if (failure.retryable) return "open";
      yield setState({
        status: "failed",
        handle: currentHandle,
        error: failure,
      });
      return "settled";
    }

    // 流读完了，协议却没给终止事件——意外 EOF，按可重连处理（08 §硬规则 4）。
    return "open";
  }

  async function* runInternal(
    input: TStart,
  ): AsyncGenerator<SessionOutput<THandle>> {
    let runHandle: THandle;
    let response: Response;
    if (initialHandle !== undefined) {
      runHandle = initialHandle;
      if (stopRequested) {
        yield* settleStop(runHandle);
        return;
      }
      try {
        response = await protocol.resume(
          runHandle,
          cursor,
          streamController.signal,
        );
      } catch (error) {
        yield setState({
          status: "failed",
          handle: runHandle,
          error: toAgentStreamError(error, "network"),
        });
        return;
      }
    } else {
      yield setState({ status: "creating" });
      try {
        const opened = await protocol.create(input, streamController.signal);
        runHandle = opened.handle;
        response = opened.response;
      } catch (error) {
        // 硬规则 1：响应头到达前断掉，结果不确定。**不重发 POST。**
        // 收敛成 missing_handle（不可重试）而不是保留 network（可重试），
        // 是为了让「不能重放 create」写在类型里而不是靠调用方自觉。
        const cause = toAgentStreamError(error, "network");
        yield setState({
          status: "failed",
          error:
            cause.kind === "abort"
              ? cause
              : new AgentStreamError(
                  "missing_handle",
                  `Run creation failed before a run handle was returned: ${cause.message}`,
                  { cause },
                ),
        });
        return;
      }
    }

    while (true) {
      if (stopRequested) {
        yield* settleStop(runHandle);
        return;
      }

      yield setState({
        status: "streaming",
        handle: runHandle,
        ...optional("cursor", cursor),
      });
      const outcome = yield* pump(response, runHandle, streamController.signal);
      if (outcome === "settled") return;

      if (stopRequested) {
        yield* settleStop(runHandle);
        return;
      }

      // 硬规则 5：计数只增不减。每段成功后清零的写法（gamma）让持续抖动的
      // 连接可以无限重连，长任务下这就是「永远在重试、永远不报错」。
      if (reconnects >= maxReconnects) {
        yield setState({
          status: "failed",
          handle: runHandle,
          error: new AgentStreamError(
            "reconnect_exhausted",
            `Giving up after ${reconnects} reconnect attempts.`,
          ),
        });
        return;
      }
      reconnects += 1;
      yield setState({
        status: "reconnecting",
        handle: runHandle,
        ...optional("cursor", cursor),
        attempt: reconnects,
      });
      await sleep(computeBackoffDelay(reconnects, backoff));
      if (stopRequested) {
        yield* settleStop(runHandle);
        return;
      }

      try {
        // 硬规则 3：续传只能是 resume，不能复用 create 的 URL/method/body。
        response = await protocol.resume(
          runHandle,
          cursor,
          streamController.signal,
        );
      } catch (error) {
        const failure = toAgentStreamError(error, "network");
        if (failure.retryable && reconnects < maxReconnects) continue;
        yield setState({ status: "failed", handle: runHandle, error: failure });
        return;
      }
    }
  }

  return {
    run: runInternal,
    stop() {
      stopRequested = true;
      // 只断读，让挂在 read() 上的 pump 立刻回来走 settleStop。
      // 服务端的 cancel 由 settleStop 用另一个 controller 显式发（05 L13）。
      streamController.abort();
    },
    abort() {
      streamController.abort();
      controlController.abort();
    },
    getState: () => state,
  };
}
