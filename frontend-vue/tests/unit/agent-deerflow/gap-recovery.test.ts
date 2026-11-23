/*
  【文件职责】     05 A4/A5/A6 的回归：gap 恢复的 rejoin 预算、不当结束、不取消 run。
  【架构位置】     L3 测试
  【主要导出】     无
  【依赖关系】     app/core/agent-deerflow/gap-recovery.ts · ./event-map · @deerflow/agent-core
  【边界与注意】   协议这一层用**脚本化的假响应**而不是假 RunProtocol：假 protocol
                   能证明状态机走对了，但证明不了「这一段流真的是 GET resume 发出去的」。
                   这里的 create/resume 都返回真的 `Response` + `ReadableStream`，
                   调用次数与参数逐次记账——A5 说的「共 6 次流调用」只有这样才数得出来。
*/

import type { SseEvent } from "@deerflow/agent-core";
import { describe, expect, it, vi } from "vitest";

import type { DeerFlowRunHandle } from "@/core/agent-deerflow/endpoints";
import { classifyDeerFlowEvent } from "@/core/agent-deerflow/event-map";
import {
  createGapAwareRun,
  MAX_STREAM_GAP_RECOVERIES,
} from "@/core/agent-deerflow/gap-recovery";
import type { DeerFlowProtocol } from "@/core/agent-deerflow/run-protocol";

const HANDLE: DeerFlowRunHandle = { threadId: "t-1", runId: "r-1" };

function sseResponse(body: string): Response {
  return new Response(body, {
    headers: { "Content-Type": "text/event-stream" },
  });
}

const gapPayload = (runId = HANDLE.runId, latest = "cursor-9") =>
  JSON.stringify({
    code: "stream_replay_gap",
    run_id: runId,
    requested_event_id: null,
    earliest_available_event_id: "cursor-5",
    latest_available_event_id: latest,
    recovery: "reload_durable_state",
  });

const GAP_SEGMENT = `event: values\ndata: {"title":"x"}\nid: c1\n\nevent: gap\ndata: ${gapPayload()}\nid: c2\n\n`;
const DONE_SEGMENT = `event: values\ndata: {"title":"done"}\nid: d1\n\nevent: end\ndata: {}\n\n`;
/** 读完却没有终止事件 —— 内核按意外 EOF 处理，会退避重连（08 §硬规则 4）。 */
const EOF_SEGMENT = `event: values\ndata: {"title":"partial"}\nid: e1\n\n`;

interface Recorder {
  protocol: DeerFlowProtocol;
  creates: number;
  resumes: { cursor: string | undefined }[];
  cancels: number;
  inspects: number;
}

/** `segments[0]` 走 create，其余依次走 resume；用完之后重复最后一段。 */
function scriptedProtocol(segments: string[]): Recorder {
  const state: Recorder = {
    creates: 0,
    resumes: [],
    cancels: 0,
    inspects: 0,
    protocol: undefined as unknown as DeerFlowProtocol,
  };
  let index = 0;
  const next = () => {
    const body = segments[Math.min(index, segments.length - 1)] as string;
    index += 1;
    return sseResponse(body);
  };

  state.protocol = {
    create: async () => {
      state.creates += 1;
      return { handle: HANDLE, response: next() };
    },
    resume: async (_handle, cursor) => {
      state.resumes.push({ cursor });
      return next();
    },
    cancel: async () => {
      state.cancels += 1;
      return { kind: "accepted" };
    },
    inspect: async () => {
      state.inspects += 1;
      return { terminal: true, outcome: "completed" };
    },
  };
  return state;
}

function runner(
  recorder: Recorder,
  overrides: {
    loadDurableState?: (
      handle: DeerFlowRunHandle,
    ) => Promise<Record<string, unknown> | undefined>;
    maxReconnects?: number;
    maxRejoins?: number;
  } = {},
) {
  return createGapAwareRun({
    protocol: recorder.protocol,
    session: {
      classifyEvent: classifyDeerFlowEvent,
      maxBufferBytes: 1024 * 1024,
      maxReconnects: overrides.maxReconnects ?? 0,
      sleep: async () => {},
    },
    loadDurableState:
      overrides.loadDurableState ?? (async () => ({ title: "durable" })),
    ...(overrides.maxRejoins === undefined
      ? {}
      : { maxRejoins: overrides.maxRejoins }),
  });
}

async function drain(run: ReturnType<typeof createGapAwareRun>) {
  const outputs = [];
  for await (const output of run.run({ threadId: "t-1", payload: {} })) {
    outputs.push(output);
  }
  return outputs;
}

const states = (outputs: Awaited<ReturnType<typeof drain>>) =>
  outputs.flatMap((o) => (o.kind === "state" ? [o.state] : []));
const events = (outputs: Awaited<ReturnType<typeof drain>>): SseEvent[] =>
  outputs.flatMap((o) => (o.kind === "event" ? [o.event] : []));

describe("gap 恢复（05 A4/A5/A6）", () => {
  it("A4：run() 之前不发任何请求（惰性 async iterable）", async () => {
    const recorder = scriptedProtocol([DONE_SEGMENT]);
    const iterator = runner(recorder).run({ threadId: "t-1", payload: {} });
    expect(recorder.creates).toBe(0);

    // 第一次 next 只拿到 `creating`——create 本身在下一次迭代才被 await。
    // 这比「run() 就发请求」还惰性一档，消费方可以先订阅再开流。
    const first = await iterator.next();
    expect(first.value).toEqual({
      kind: "state",
      state: { status: "creating" },
    });
    expect(recorder.creates).toBe(0);

    await iterator.next();
    expect(recorder.creates).toBe(1);
    await iterator.return(undefined);
  });

  it("没有 gap 时什么都不做：一次 create、零次 resume", async () => {
    const recorder = scriptedProtocol([DONE_SEGMENT]);
    const run = runner(recorder);
    const outputs = await drain(run);

    expect(recorder.creates).toBe(1);
    expect(recorder.resumes).toEqual([]);
    expect(run.getRejoinCount()).toBe(0);
    expect(states(outputs).at(-1)?.status).toBe("completed");
  });

  it("一次 gap：reload durable state → 合成 values → 用 latest id 续传", async () => {
    const recorder = scriptedProtocol([GAP_SEGMENT, DONE_SEGMENT]);
    const loadDurableState = vi.fn(async () => ({ title: "reloaded" }));
    const run = runner(recorder, { loadDurableState });
    const outputs = await drain(run);

    expect(loadDurableState).toHaveBeenCalledWith(
      HANDLE,
      expect.any(AbortSignal),
    );
    // 续传的游标是 gap 报的 latest_available_event_id，不是流里最后一帧的 id。
    expect(recorder.resumes).toEqual([{ cursor: "cursor-9" }]);
    expect(run.getRejoinCount()).toBe(1);

    const synthesized = events(outputs).filter(
      (event) => event.event === "values" && event.data.includes("reloaded"),
    );
    expect(synthesized).toHaveLength(1);
    expect(states(outputs).at(-1)?.status).toBe("completed");
  });

  // ⚠️ 本条是 **M4a 接线时补的**，不是 M2 就有的。
  //
  // 06 §M4a 写着「M2 已为 A7 留好接口：gap 恢复合成的那帧 `values`，
  // UI 侧的清空与警告挂在这一帧上」。接线时这句话当场不成立：合成的
  // `values` 与正常的 `values` **逐字段同形**，消费方分辨不出来，
  // A7 的清空挂不上去。上游 `api-client.ts:282` 在同一位置先发一帧
  // `custom`，React 侧靠 `onCustomEvent` 的 `stream_replay_gap` 分支做清空。
  //
  // 顺序是这条用例的重点：`custom` **必须在** `values` 之前。反了的话
  // 清空动作会把刚落地的 durable state 一起抹掉。
  it("A7 的触发信号：合成的 values 之前先发一帧 custom/stream_replay_gap", async () => {
    const recorder = scriptedProtocol([GAP_SEGMENT, DONE_SEGMENT]);
    const run = runner(recorder, {
      loadDurableState: vi.fn(async () => ({ title: "reloaded" })),
    });
    const emitted = events(await drain(run));

    const customIndex = emitted.findIndex(
      (event) =>
        event.event === "custom" && event.data.includes("stream_replay_gap"),
    );
    const reloadedIndex = emitted.findIndex(
      (event) => event.event === "values" && event.data.includes("reloaded"),
    );

    expect(customIndex).toBeGreaterThanOrEqual(0);
    expect(reloadedIndex).toBeGreaterThan(customIndex);
    expect(JSON.parse(emitted[customIndex]!.data)).toMatchObject({
      type: "stream_replay_gap",
      run_id: HANDLE.runId,
      recovery: "reload_durable_state",
    });
  });

  it("A6：gap 期间不外发 gap 态，也不把 gap 当正常结束", async () => {
    const recorder = scriptedProtocol([GAP_SEGMENT, DONE_SEGMENT]);
    const outputs = await drain(runner(recorder));
    expect(states(outputs).map((s) => s.status)).not.toContain("gap");
    // 中途没有假的 completed：只有真正读到 end 的那一次。
    expect(
      states(outputs).filter((s) => s.status === "completed"),
    ).toHaveLength(1);
  });

  it("A5：一直 gap 时正好 5 次 rejoin、共 6 次流调用，末态是 failed", async () => {
    const recorder = scriptedProtocol([GAP_SEGMENT]);
    const run = runner(recorder);
    const outputs = await drain(run);

    expect(run.getRejoinCount()).toBe(MAX_STREAM_GAP_RECOVERIES);
    expect(recorder.creates + recorder.resumes.length).toBe(
      MAX_STREAM_GAP_RECOVERIES + 1,
    );
    const last = states(outputs).at(-1);
    expect(last?.status).toBe("failed");
    expect(last?.status === "failed" && last.error.kind).toBe("replay_gap");
  });

  it("A6：整个 gap 路径一次 cancel 都不发（后端 run 可能还在跑）", async () => {
    const recorder = scriptedProtocol([GAP_SEGMENT]);
    await drain(runner(recorder));
    expect(recorder.cancels).toBe(0);
    expect(recorder.inspects).toBe(0);
  });

  it("A4：join 流里的 gap 与初始流走同一条路（第 2 段起全是 resume）", async () => {
    const recorder = scriptedProtocol([GAP_SEGMENT, GAP_SEGMENT, DONE_SEGMENT]);
    const run = runner(recorder);
    const outputs = await drain(run);
    expect(run.getRejoinCount()).toBe(2);
    expect(recorder.resumes).toHaveLength(2);
    expect(states(outputs).at(-1)?.status).toBe("completed");
  });

  it("gap 报的 run_id 与当前 run 不符时立刻失败，不盲目续传", async () => {
    const mismatched = `event: gap\ndata: ${gapPayload("other-run")}\n\n`;
    const recorder = scriptedProtocol([mismatched, DONE_SEGMENT]);
    const run = runner(recorder);
    const last = states(await drain(run)).at(-1);

    expect(recorder.resumes).toEqual([]);
    expect(run.getRejoinCount()).toBe(0);
    expect(last?.status).toBe("failed");
  });

  it("durable state failure remains visible and does not resume from a missing snapshot", async () => {
    const recorder = scriptedProtocol([GAP_SEGMENT, DONE_SEGMENT]);
    const run = runner(recorder, {
      loadDurableState: async () => {
        throw new Error("checkpoint read failed");
      },
    });
    const outputs = await drain(run);
    expect(recorder.resumes).toHaveLength(0);
    expect(states(outputs).at(-1)).toMatchObject({
      status: "failed",
      error: {
        kind: "replay_gap",
        cause: { message: "checkpoint read failed" },
      },
    });
  });

  it("a missing terminal stream accepts null cursors and rejoins until the observer end", async () => {
    const gap = JSON.parse(gapPayload());
    gap.earliest_available_event_id = null;
    gap.latest_available_event_id = null;
    const recorder = scriptedProtocol([
      `event: gap\ndata: ${JSON.stringify(gap)}\n\n`,
      "event: end\ndata: null\n\n",
    ]);
    const outputs = await drain(runner(recorder));
    expect(recorder.resumes).toEqual([{ cursor: undefined }]);
    expect(states(outputs).at(-1)?.status).toBe("completed");
    expect(recorder.creates).toBe(1);
    expect(recorder.cancels).toBe(0);
  });

  it("stop during durable reload cancels the known run instead of stopping an already finished segment", async () => {
    const recorder = scriptedProtocol([GAP_SEGMENT]);
    recorder.protocol.cancel = async () => {
      recorder.cancels += 1;
      return { kind: "terminal", outcome: "cancelled" };
    };
    let loading!: () => void;
    const started = new Promise<void>((resolve) => {
      loading = resolve;
    });
    const run = createGapAwareRun({
      protocol: recorder.protocol,
      session: {
        classifyEvent: classifyDeerFlowEvent,
        maxBufferBytes: 1024,
        maxReconnects: 0,
      },
      loadDurableState: async (_handle, signal) => {
        loading();
        return new Promise((_, reject) =>
          signal.addEventListener(
            "abort",
            () => reject(new DOMException("aborted", "AbortError")),
            { once: true },
          ),
        );
      },
    });
    const pending = drain(run);
    await started;
    run.stop();
    const outputs = await pending;
    expect(recorder.cancels).toBe(1);
    expect(recorder.creates).toBe(1);
    expect(states(outputs).at(-1)?.status).toBe("cancelled");
  });

  it("terminal durable status never skips a late error frame before end", async () => {
    const recorder = scriptedProtocol([
      GAP_SEGMENT,
      'event: error\ndata: {"message":"finalization failed"}\n\n',
    ]);
    const outputs = await drain(
      runner(recorder, {
        loadDurableState: async () => ({ status: "success", messages: [] }),
      }),
    );
    expect(recorder.resumes).toHaveLength(1);
    expect(states(outputs).at(-1)).toMatchObject({
      status: "failed",
      error: { kind: "backend_error", message: "finalization failed" },
    });
    expect(states(outputs).some((state) => state.status === "completed")).toBe(
      false,
    );
  });

  it("05 L5：重连额度跨 gap 段累计，不因为新建会话而归零", async () => {
    // 每段都是「读完没有 end」→ 内核退避重连；额度 1 用完之后必须报
    // reconnect_exhausted，而不是每段各重连一次地无限跑下去。
    const recorder = scriptedProtocol([EOF_SEGMENT, GAP_SEGMENT, EOF_SEGMENT]);
    const run = runner(recorder, { maxReconnects: 1 });
    const last = states(await drain(run)).at(-1);

    expect(last?.status).toBe("failed");
    expect(last?.status === "failed" && last.error.kind).toBe(
      "reconnect_exhausted",
    );
    expect(run.getRejoinCount()).toBe(1);
  });

  it("adds reconnect attempts across multiple gap segments instead of taking their maximum", async () => {
    const recorder = scriptedProtocol([
      EOF_SEGMENT,
      GAP_SEGMENT,
      EOF_SEGMENT,
      GAP_SEGMENT,
      EOF_SEGMENT,
    ]);
    const run = runner(recorder, { maxReconnects: 2 });
    const last = states(await drain(run)).at(-1);
    // Two explicit gap joins plus two network reconnects exhaust the budget.
    expect(recorder.resumes).toHaveLength(4);
    expect(last).toMatchObject({
      status: "failed",
      error: { kind: "reconnect_exhausted" },
    });
  });

  it("rejoin 预算可调，用尽时报的是 replay_gap 而不是 completed", async () => {
    const recorder = scriptedProtocol([GAP_SEGMENT]);
    const run = runner(recorder, { maxRejoins: 1 });
    const last = states(await drain(run)).at(-1);

    expect(run.getRejoinCount()).toBe(1);
    expect(recorder.creates + recorder.resumes.length).toBe(2);
    expect(last?.status === "failed" && last.error.kind).toBe("replay_gap");
  });
});
