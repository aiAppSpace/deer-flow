/*
  【文件职责】     解析 Gateway 的重放缺口载荷，并映射到内核的 replay_gap 错误。
  【架构位置】     L3
  【主要导出】     StreamReplayGapData · parseStreamReplayGap · replayGapError
  【依赖关系】     @deerflow/agent-core
  【边界与注意】   `gap` 这个 wire 事件名只属于 DeerFlow；内核那边的对应物叫
                   `replay_gap`（08 §错误与 watchdog）。两个名字的翻译只在这里
                   发生，别的地方出现 `"gap"` 字面量就说明协议知识漏出去了。

                   必需字段不可缺省。终态 run 的幂等创建重试在缓冲已回收时，
                   earliest/latest 都可以是 null；先载入 durable state，再无
                   游标 join 同一 run，由 observer end 收敛。
*/

import { AgentStreamError } from "@deerflow/agent-core";

export interface StreamReplayGapData {
  code: "stream_replay_gap";
  run_id: string;
  /** 初始流的缺口没有请求游标，这里是 null 而不是缺省。 */
  requested_event_id: string | null;
  earliest_available_event_id: string | null;
  latest_available_event_id: string | null;
  recovery: "reload_durable_state";
}

export function parseStreamReplayGap(data: unknown): StreamReplayGapData {
  if (typeof data !== "object" || data === null) {
    throw new Error("Invalid stream replay gap payload.");
  }

  const value = data as Record<string, unknown>;
  const requestedEventId = value.requested_event_id;
  const earliestEventId = value.earliest_available_event_id;
  const latestEventId = value.latest_available_event_id;
  if (
    value.code !== "stream_replay_gap" ||
    typeof value.run_id !== "string" ||
    (requestedEventId !== null && typeof requestedEventId !== "string") ||
    (earliestEventId !== null && typeof earliestEventId !== "string") ||
    (latestEventId !== null && typeof latestEventId !== "string") ||
    value.recovery !== "reload_durable_state"
  ) {
    throw new Error("Invalid stream replay gap payload.");
  }

  return value as unknown as StreamReplayGapData;
}

/** 缺口不可重试：重连解决不了「那段历史已经被逐出」。 */
export function replayGapError(gap: StreamReplayGapData): AgentStreamError {
  return new AgentStreamError(
    "replay_gap",
    `Stream history is no longer available from ${
      gap.requested_event_id ?? "the initial stream"
    }; earliest retained is ${gap.earliest_available_event_id}.`,
    { cause: gap },
  );
}
