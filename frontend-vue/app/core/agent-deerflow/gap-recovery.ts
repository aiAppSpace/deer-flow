/*
  【文件职责】     05 A4–A6：把 gap 恢复的「L3 决定」那一半补上，含 5 次 rejoin 预算。
  【架构位置】     L3
  【主要导出】     MAX_STREAM_GAP_RECOVERIES · GapRecoveryOptions · createGapAwareRun
  【依赖关系】     @deerflow/agent-core · ./endpoints · ./gap · ./run-protocol
  【边界与注意】   内核遇到 gap 就进 `gap` 态并**停下**（08 硬规则 6：不从头重放，
                   先 reload durable state，再由 L3 决定是否 join）。本文件就是
                   那个「L3 决定」。

                   **上游那份不能照搬。** 它的 `clearReconnectRun` /
                   `lg:stream:` sessionStorage 记账是 **SDK 的重连簿记**——
                   SDK 靠 sessionStorage 记住"这个 thread 上有个 run 要重连"，
                   所以恢复时要先把它清掉再重新写回。我们的游标是 SSE
                   `Last-Event-ID`，由 run session 自己持有，没有这本账，
                   照搬等于把一套不存在的状态机搬进来。要保的是 A5 与 A6：

                     A5  最多 5 次 rejoin（初始流不计入，全 gap 路径共 6 次流调用）
                     A6  gap 不当正常结束，也不取消仍在跑的 run

                   A6 的实现方式是**这里一次 `protocol.cancel` 都不调**，
                   预算用尽时落 `failed` 而不是 `completed`。测试逐条钉住。

                   A4「gap 帧要包住初始流和 join 流两者」：每一段（初始流与每次
                   join）都是一个完整的 run session，用的是同一个 `classifyEvent`，
                   所以 join 流里的 gap 与初始流的走同一条路。另半句「保持惰性
                   async iterable」在这里是 `run()` 返回生成器、第一次迭代之前
                   一次网络请求都不发——也有用例钉住。

                   05 L5（整个会话的重连总量上限、成功后不清零）与 A5 是**两个
                   预算**。每次 rejoin 会新建一个 run session，而 L1 的重连计数是
                   会话内的，新建就归零了——所以这里把已用掉的重连数从下一段的
                   额度里扣掉，否则 6 段流可以合起来重连 6×maxReconnects 次。
*/

import type {
  RunSession,
  RunSessionOptions,
  RunSessionState,
  SessionOutput,
  SseEvent,
} from "@deerflow/agent-core";
import { AgentStreamError, createRunSession } from "@deerflow/agent-core";

import type { DeerFlowRunHandle } from "./endpoints";
import type { StreamReplayGapData } from "./gap";
import { parseStreamReplayGap, replayGapError } from "./gap";
import type { DeerFlowRunInput, DeerFlowProtocol } from "./run-protocol";

/** 05 A5。初始流不计入，所以全 gap 路径最多产生 6 次流调用。 */
export const MAX_STREAM_GAP_RECOVERIES = 5;

type Options = Omit<
  RunSessionOptions<DeerFlowRunInput, DeerFlowRunHandle>,
  "protocol" | "initialHandle" | "initialCursor"
>;

export interface GapRecoveryOptions {
  protocol: DeerFlowProtocol;
  /** 内核会话的其余参数（classifyEvent / buffer 上限 / 退避 / …）。 */
  session: Options;
  /**
   * 08 硬规则 6 的「先 reload durable state」。返回 thread 的 `values` 载荷；
   * 返回 undefined 表示没有 values；请求失败必须抛错，不能当作空状态。
   */
  loadDurableState: (
    handle: DeerFlowRunHandle,
    signal: AbortSignal,
  ) => Promise<Record<string, unknown> | undefined>;
  maxRejoins?: number;
  /** Observe an existing run, hydrating its submitted input before replay. */
  initialHandle?: DeerFlowRunHandle;
}

export interface GapAwareRun {
  /** 惰性：第一次迭代之前不发任何请求（05 A4）。 */
  run(
    input: DeerFlowRunInput,
  ): AsyncGenerator<SessionOutput<DeerFlowRunHandle>>;
  stop(): void;
  abort(): void;
  /** 已经用掉的 rejoin 次数，用于测试与诊断。 */
  getRejoinCount(): number;
}

export function createGapAwareRun(options: GapRecoveryOptions): GapAwareRun {
  const {
    protocol,
    session: sessionOptions,
    loadDurableState,
    maxRejoins = MAX_STREAM_GAP_RECOVERIES,
    initialHandle,
  } = options;

  let active: RunSession<DeerFlowRunInput, DeerFlowRunHandle> | undefined;
  let stopped = false;
  let aborted = false;
  let rejoins = 0;
  const recoveryController = new AbortController();

  async function* runInternal(
    input: DeerFlowRunInput,
  ): AsyncGenerator<SessionOutput<DeerFlowRunHandle>> {
    try {
      let handleForJoin = initialHandle;
      let cursor: string | undefined;
      let usedReconnects = 0;
      if (initialHandle) {
        yield {
          kind: "state",
          state: { status: "streaming", handle: initialHandle },
        };
        try {
          const values = await loadDurableState(
            initialHandle,
            recoveryController.signal,
          );
          if (aborted) return;
          if (values !== undefined && !stopped) {
            yield {
              kind: "event",
              event: { event: "values", data: JSON.stringify(values) },
            };
          }
        } catch (cause) {
          if (aborted) return;
          if (!stopped) {
            yield failure(
              initialHandle,
              new AgentStreamError(
                "http",
                "Could not load the existing run state.",
                { cause },
              ),
            );
            return;
          }
        }
      }

      while (true) {
        if (aborted) return;
        const remaining = Math.max(
          0,
          sessionOptions.maxReconnects - usedReconnects,
        );
        const session = createRunSession<DeerFlowRunInput, DeerFlowRunHandle>({
          ...sessionOptions,
          maxReconnects: remaining,
          protocol,
          ...(handleForJoin ? { initialHandle: handleForJoin } : {}),
          ...(cursor === undefined ? {} : { initialCursor: cursor }),
        });
        active = session;
        // stop()/abort() 可能在上一段与这一段之间到达，补一次转发。
        if (aborted) session.abort();
        else if (stopped) session.stop();

        let gap: StreamReplayGapData | undefined;
        let finalState: RunSessionState<DeerFlowRunHandle> | undefined;
        let segmentReconnects = 0;

        for await (const output of session.run(input)) {
          if (output.kind === "state") {
            finalState = output.state;
            if (output.state.status === "reconnecting") {
              segmentReconnects = output.state.attempt;
            }
            // gap 态本身不外发：这一段还没结束，外面看到 `gap` 会以为流停了。
            // 预算用尽时下面会补一个 failed。
            if (output.state.status === "gap") continue;
          }
          if (output.kind === "event" && isGapEvent(output.event)) {
            gap = parseGapEvent(output.event);
          }
          yield output;
        }

        active = undefined;
        usedReconnects += segmentReconnects;
        if (finalState?.status !== "gap") return;
        const handle = finalState.handle;

        if (!gap) {
          // 内核判成 gap，载荷却读不出来：不能当正常结束（A6）。
          yield failure(
            handle,
            new AgentStreamError(
              "replay_gap",
              "The stream reported a replay gap without a readable payload.",
            ),
          );
          return;
        }
        if (gap.run_id !== handle.runId) {
          yield failure(
            handle,
            new AgentStreamError(
              "replay_gap",
              `Stream replay gap for run ${gap.run_id} does not match the active run ${handle.runId}.`,
            ),
          );
          return;
        }
        if (rejoins >= maxRejoins) {
          // 预算用尽落 failed 而不是 completed（A6）。此处**不发 cancel**：
          // 后端那个 run 很可能还在跑，取消它就是丢掉正在进行的任务。
          yield failure(handle, replayGapError(gap));
          return;
        }
        if (aborted) return;

        rejoins += 1;
        // A7 的触发信号。**M4a 补的，M2 漏了。**
        //
        // 06 §M4a 写的是「M2 已把接口留好：gap 恢复合成的那帧 `values`，
        // UI 侧的清空与警告挂在这一帧上」——接线时发现这句话不成立：
        // 合成的 `values` 在消费方眼里与正常的 `values` **完全同形**，
        // 没有任何字段能区分，挂不上去。上游 `api-client.ts:282` 正是在
        // 同一个位置先发一帧 `custom`，React 侧靠 `onCustomEvent` 里的
        // `type === "stream_replay_gap"` 分支做那一整套清空。
        //
        // 顺序不能反：`custom` 必须在 `values` **之前**。反过来的话，
        // 清空动作会把刚落地的 durable state 一起抹掉。
        yield {
          kind: "event",
          event: {
            event: "custom",
            data: JSON.stringify({ type: "stream_replay_gap", ...gap }),
          },
        };
        let values: Record<string, unknown> | undefined;
        try {
          values = await loadDurableState(handle, recoveryController.signal);
        } catch (cause) {
          if (aborted) return;
          if (!stopped) {
            yield failure(
              handle,
              new AgentStreamError(
                "replay_gap",
                "Could not reload durable state after a stream replay gap.",
                { cause },
              ),
            );
            return;
          }
        }
        if (aborted) return;
        if (values !== undefined) {
          // 合成一帧 `values` 交给 reducer：全量替换正是 gap 之后要的语义
          // （A7 要清空的乐观/瞬态状态由 UI 层在 M4a 接手，这里只管 durable）。
          yield {
            kind: "event",
            event: { event: "values", data: JSON.stringify(values) },
          };
        }
        handleForJoin = handle;
        cursor = gap.latest_available_event_id ?? undefined;
      }
    } finally {
      recoveryController.abort();
      active?.abort();
      active = undefined;
    }
  }

  return {
    run: runInternal,
    stop() {
      stopped = true;
      recoveryController.abort();
      active?.stop();
    },
    abort() {
      aborted = true;
      recoveryController.abort();
      active?.abort();
    },
    getRejoinCount: () => rejoins,
  };
}

function failure(
  handle: DeerFlowRunHandle,
  error: AgentStreamError,
): SessionOutput<DeerFlowRunHandle> {
  return { kind: "state", state: { status: "failed", handle, error } };
}

/** `gap` 这个 wire 名只在 L3 出现；`gap.ts` 的文件头说明了为什么。 */
function isGapEvent(event: SseEvent): boolean {
  return event.event === "gap" || event.event.startsWith("gap|");
}

function parseGapEvent(event: SseEvent): StreamReplayGapData | undefined {
  try {
    return parseStreamReplayGap(JSON.parse(event.data));
  } catch {
    return undefined;
  }
}
