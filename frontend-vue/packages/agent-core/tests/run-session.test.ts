/*
  【文件职责】     run session 状态机：08 §硬规则 1–8 与 05 L10–L16 的可执行版本。
  【架构位置】     L1 测试
  【主要导出】     无
  【依赖关系】     ../src/session/* · ./helpers
  【边界与注意】   假协议**记录每次调用**，因为这一组测试里最重要的几条断言是
                   「某个方法没有被调用第二次」——create 只发一次、abort 不发
                   cancel。只看最终状态是看不出这些的：重放一次 create POST
                   之后最终状态照样是 completed，而后端已经跑了两个 run。

                   `sleep` 注入成空函数，退避的**时长**在 backoff.test.ts 里单独
                   断言。混在一起会让这组测试要么真等 30 秒，要么依赖 fake timer
                   与 async 生成器的交互——那是另一个坑。
*/

import { describe, expect, it, vi } from "vitest";

import { AgentStreamError } from "../src/errors";
import { createRunSession } from "../src/session/run-session";
import type {
  CancelResult,
  ClassifyEvent,
  InspectedRun,
  RunProtocol,
} from "../src/session/protocol";
import type { RunSessionState, SessionOutput } from "../src/session/state";

import { collect, streamOf } from "./helpers";

type Handle = { runId: string };

/** 只有 `body` 会被读到；造完整 Response 会把 undici 的行为也拖进来。 */
const responseOf = (body: string): Response =>
  ({ body: streamOf([body]) }) as Response;

const bodyless = (): Response => ({ body: null }) as Response;

/** DeerFlow 的事件语义在 L3；这里给一份等价的最小映射供状态机测试使用。 */
const classify: ClassifyEvent = (event) => {
  if (event.event === "end") return { kind: "completed" };
  if (event.event === "gap") return { kind: "gap" };
  if (event.event === "error") {
    return {
      kind: "failed",
      error: new AgentStreamError("backend_error", event.data),
    };
  }
  return { kind: "data" };
};

interface FakeOptions {
  creates?: (() => Promise<Response>)[];
  resumes?: (() => Promise<Response>)[];
  cancel?: CancelResult | (() => Promise<CancelResult>);
  inspects?: InspectedRun[];
  createFails?: unknown;
}

function fakeProtocol(options: FakeOptions) {
  const calls = {
    create: 0,
    resume: [] as (string | undefined)[],
    cancel: [] as (string | undefined)[],
    inspect: 0,
  };
  let inspectAt = 0;

  const protocol: RunProtocol<string, Handle> = {
    async create() {
      calls.create += 1;
      if (options.createFails) throw options.createFails;
      const make = options.creates?.[0];
      return {
        handle: { runId: "run-1" },
        response: make
          ? await make()
          : responseOf("event: end\ndata: null\n\n"),
      };
    },
    async resume(_handle, cursor) {
      calls.resume.push(cursor);
      const make = options.resumes?.[calls.resume.length - 1];
      if (!make) throw new AgentStreamError("network", "no resume queued");
      return make();
    },
    async cancel(_handle, cursor) {
      calls.cancel.push(cursor);
      const value = options.cancel ?? { kind: "terminal" as const };
      return typeof value === "function" ? value() : value;
    },
    async inspect() {
      calls.inspect += 1;
      return (
        options.inspects?.[inspectAt++] ?? {
          terminal: true,
          outcome: "cancelled",
        }
      );
    },
  };
  return { protocol, calls };
}

const makeSession = (options: FakeOptions, overrides = {}) => {
  const { protocol, calls } = fakeProtocol(options);
  const session = createRunSession<string, Handle>({
    protocol,
    classifyEvent: classify,
    maxBufferBytes: 1024 * 1024,
    maxReconnects: 3,
    sleep: async () => {},
    ...overrides,
  });
  return { session, calls };
};

const statesOf = (outputs: SessionOutput<Handle>[]) =>
  outputs.flatMap((o) => (o.kind === "state" ? [o.state] : []));

const statusesOf = (outputs: SessionOutput<Handle>[]) =>
  statesOf(outputs).map((s) => s.status);

const finalState = (
  outputs: SessionOutput<Handle>[],
): RunSessionState<Handle> | undefined => statesOf(outputs).at(-1);

describe("正常路径", () => {
  it("creating → streaming → completed，事件与心跳都发出来", async () => {
    const { session, calls } = makeSession({
      creates: [
        async () =>
          responseOf(
            "event: values\ndata: {}\nid: 1\n\n: heartbeat\n\nevent: end\ndata: null\n\n",
          ),
      ],
    });
    const outputs = await collect(session.run("hi"));

    expect(statusesOf(outputs)).toEqual(["creating", "streaming", "completed"]);
    expect(outputs.filter((o) => o.kind === "heartbeat")).toHaveLength(1);
    expect(outputs.filter((o) => o.kind === "event")).toHaveLength(2);
    expect(calls.create).toBe(1);
    expect(calls.resume).toEqual([]);
  });

  it("终止事件本身也要交给消费方，不能被状态机吞掉", async () => {
    const { session } = makeSession({
      creates: [async () => responseOf("event: end\ndata: null\n\n")],
    });
    const events = (await collect(session.run("hi"))).flatMap((o) =>
      o.kind === "event" ? [o.event.event] : [],
    );
    expect(events).toEqual(["end"]);
  });
});

describe("创建阶段（08 硬规则 1 / 05 L10）", () => {
  it("L10：响应头之前断网 → failed，且**不重发 create**", async () => {
    const { session, calls } = makeSession({
      createFails: new AgentStreamError("network", "socket hang up"),
    });
    const outputs = await collect(session.run("hi"));

    expect(calls.create).toBe(1);
    const state = finalState(outputs);
    expect(state?.status).toBe("failed");
    // 收敛成 missing_handle 而不是留着 network：后者 retryable=true，
    // 调用方照着它重试就等于重放 create POST。
    expect(state).toMatchObject({
      error: { kind: "missing_handle", retryable: false },
    });
  });

  it("没有 handle 时不能伪装成 cancelled（硬规则 8）", async () => {
    const { session, calls } = makeSession({
      createFails: new AgentStreamError("network", "dns"),
    });
    const outputs = await collect(session.run("hi"));
    expect(statusesOf(outputs)).not.toContain("cancelled");
    expect(calls.cancel).toEqual([]);
  });

  it("没有 body 的响应是 http 错误，不是空流", async () => {
    const { session } = makeSession({ creates: [async () => bodyless()] });
    expect(finalState(await collect(session.run("hi")))).toMatchObject({
      status: "failed",
      error: { kind: "http" },
    });
  });
});

describe("续传（08 硬规则 2/3/4 · 05 L11）", () => {
  it("L11：意外 EOF 后走 resume 并带上最后一个 id，不复用 create", async () => {
    const { session, calls } = makeSession({
      creates: [async () => responseOf("event: values\ndata: {}\nid: 7\n\n")],
      resumes: [async () => responseOf("event: end\ndata: null\n\n")],
    });
    const outputs = await collect(session.run("hi"));

    expect(calls.create).toBe(1);
    expect(calls.resume).toEqual(["7"]);
    expect(statusesOf(outputs)).toEqual([
      "creating",
      "streaming",
      "reconnecting",
      "streaming",
      "completed",
    ]);
  });

  it("游标推进到最后一个**带 id** 的帧", async () => {
    const { session, calls } = makeSession({
      creates: [
        async () =>
          responseOf("data: a\nid: 1\n\ndata: b\nid: 2\n\ndata: c\n\n"),
      ],
      resumes: [async () => responseOf("event: end\ndata: null\n\n")],
    });
    await collect(session.run("hi"));
    expect(calls.resume).toEqual(["2"]);
  });

  it("L5：重连总次数封顶，且成功一段之后**不清零**", async () => {
    // 每次 resume 都只发一个事件就断，模拟持续抖动的连接。
    const flaky = async () => responseOf("data: x\nid: 9\n\n");
    const { session, calls } = makeSession({
      creates: [flaky],
      resumes: [flaky, flaky, flaky, flaky, flaky],
    });
    const outputs = await collect(session.run("hi"));

    expect(calls.resume).toHaveLength(3); // maxReconnects
    expect(finalState(outputs)).toMatchObject({
      status: "failed",
      error: { kind: "reconnect_exhausted" },
    });
  });

  it("后端 error 事件不重连（硬规则 4）", async () => {
    const { session, calls } = makeSession({
      creates: [async () => responseOf('event: error\ndata: "boom"\n\n')],
    });
    const outputs = await collect(session.run("hi"));

    expect(calls.resume).toEqual([]);
    expect(finalState(outputs)).toMatchObject({
      status: "failed",
      error: { kind: "backend_error", retryable: false },
    });
  });

  it("解析层错误（buffer 上限）不重连", async () => {
    const { session, calls } = makeSession(
      { creates: [async () => responseOf("data: " + "x".repeat(500))] },
      { maxBufferBytes: 64 },
    );
    const outputs = await collect(session.run("hi"));
    expect(calls.resume).toEqual([]);
    expect(finalState(outputs)).toMatchObject({
      error: { kind: "parse_error" },
    });
  });
});

describe("重放缺口（08 硬规则 6）", () => {
  it("gap → gap 态并停止，不从头重放", async () => {
    const { session, calls } = makeSession({
      creates: [
        async () =>
          responseOf('data: a\nid: 1\n\nevent: gap\ndata: {"code":"x"}\n\n'),
      ],
      resumes: [async () => responseOf("event: end\ndata: null\n\n")],
    });
    const outputs = await collect(session.run("hi"));

    expect(finalState(outputs)).toEqual({
      status: "gap",
      handle: { runId: "run-1" },
      recovery: "reload_durable_state",
    });
    // 关键：内核**没有**自作主张去 resume。是否 join 由 L3 在 reload 之后决定。
    expect(calls.resume).toEqual([]);
    expect(calls.create).toBe(1);
  });

  it("gap 事件本身仍然交给消费方——L3 要读里面的 latest id", async () => {
    const { session } = makeSession({
      creates: [async () => responseOf('event: gap\ndata: {"code":"x"}\n\n')],
    });
    const events = (await collect(session.run("hi"))).flatMap((o) =>
      o.kind === "event" ? [o.event] : [],
    );
    expect(events).toHaveLength(1);
    expect(events[0]?.data).toBe('{"code":"x"}');
  });
});

describe("停止：cancel 与 abort 是两回事（08 硬规则 7/8 · 05 L13/L16）", () => {
  it("L16：cancel 返回 drain 时继续归约尾帧直到终止事件", async () => {
    const { session, calls } = makeSession({
      creates: [async () => responseOf("data: a\nid: 1\n\n")],
      cancel: {
        kind: "drain",
        response: responseOf("data: tail\n\nevent: end\ndata: null\n\n"),
      },
    });
    const iterator = session.run("hi")[Symbol.asyncIterator]();
    const outputs: SessionOutput<Handle>[] = [];
    // 先拿到 streaming 与第一个事件，再点 stop——模拟用户在流式中途按下停止。
    for (let i = 0; i < 3; i += 1) {
      const next = await iterator.next();
      if (next.done) break;
      outputs.push(next.value);
    }
    session.stop();
    for (;;) {
      const next = await iterator.next();
      if (next.done) break;
      outputs.push(next.value);
    }

    expect(calls.cancel).toEqual(["1"]);
    expect(statusesOf(outputs)).toContain("stopping");
    // 尾帧没有被丢掉：用户看到的答案不会比后端存下来的短一截。
    const tails = outputs.flatMap((o) =>
      o.kind === "event" ? [o.event.data] : [],
    );
    expect(tails).toContain("tail");
    expect(finalState(outputs)?.status).toBe("completed");
  });

  it("L16：cancel 返回 accepted 时轮询 durable run，直到终态才落 cancelled", async () => {
    const { session, calls } = makeSession({
      creates: [async () => responseOf("data: a\nid: 1\n\n")],
      cancel: { kind: "accepted" },
      inspects: [
        { terminal: false },
        { terminal: false },
        { terminal: true, outcome: "cancelled", reason: "interrupted" },
      ],
      resumes: [
        async () =>
          responseOf("data: confirmed-tail\n\nevent: end\ndata: null\n\n"),
      ],
    });
    session.stop();
    const outputs = await collect(session.run("hi"));

    expect(calls.inspect).toBe(3);
    expect(calls.resume).toHaveLength(1);
    expect(
      outputs.some(
        (output) =>
          output.kind === "event" && output.event.data === "confirmed-tail",
      ),
    ).toBe(true);
    expect(statesOf(outputs).some((s) => s.status === "stopping")).toBe(true);
    expect(finalState(outputs)).toMatchObject({
      status: "cancelled",
      reason: "interrupted",
    });
  });

  it("轮询预算用完仍未终态 → failed，**不能**谎报成 cancelled", async () => {
    const { session } = makeSession(
      {
        creates: [async () => responseOf("data: a\nid: 1\n\n")],
        cancel: { kind: "accepted" },
        inspects: [{ terminal: false }, { terminal: false }],
      },
      { inspectPolling: { maxAttempts: 2, intervalMs: 0 } },
    );
    session.stop();
    const outputs = await collect(session.run("hi"));
    expect(finalState(outputs)?.status).toBe("failed");
  });

  it("durable success 映射成 completed，不是 cancelled（08 §258）", async () => {
    const { session } = makeSession({
      creates: [async () => responseOf("data: a\nid: 1\n\n")],
      cancel: { kind: "accepted" },
      inspects: [{ terminal: true, outcome: "completed" }],
      resumes: [async () => responseOf("event: end\ndata: null\n\n")],
    });
    session.stop();
    expect(finalState(await collect(session.run("hi")))?.status).toBe(
      "completed",
    );
  });

  it("durable error 映射成 failed", async () => {
    const { session } = makeSession({
      creates: [async () => responseOf("data: a\nid: 1\n\n")],
      cancel: { kind: "terminal", outcome: "failed", reason: "timeout" },
    });
    session.stop();
    expect(finalState(await collect(session.run("hi")))).toMatchObject({
      status: "failed",
      error: { kind: "backend_error" },
    });
  });

  it("known handles only resume, including stop before the first read", async () => {
    const { session, calls } = makeSession(
      {
        resumes: [async () => responseOf("event: end\ndata: null\n\n")],
      },
      { initialHandle: { runId: "run-1" }, initialCursor: "saved" },
    );
    await collect(session.run("ignored"));
    expect(calls.create).toBe(0);
    expect(calls.resume).toEqual(["saved"]);
    const stopped = makeSession({}, { initialHandle: { runId: "run-1" } });
    stopped.session.stop();
    await collect(stopped.session.run("ignored"));
    expect(stopped.calls.create).toBe(0);
    expect(stopped.calls.resume).toHaveLength(0);
    expect(stopped.calls.cancel).toHaveLength(1);
  });

  it("a cancelled drain without END and without a confirmed tail is never success", async () => {
    const { session } = makeSession({
      cancel: { kind: "drain", response: responseOf("data: partial\n\n") },
      inspects: [{ terminal: true, outcome: "cancelled" }],
      resumes: [async () => responseOf("data: still partial\n\n")],
    });
    session.stop();
    expect(finalState(await collect(session.run("hi")))?.status).toBe("failed");
  });

  it("L13：abort 只断本地读取，**绝不**发 cancel", async () => {
    const { session, calls } = makeSession({
      creates: [async () => responseOf("data: a\nid: 1\n\n")],
    });
    session.abort();
    await collect(session.run("hi")).catch(() => []);
    expect(calls.cancel).toEqual([]);
  });

  it("stop 之后 cancel 用的是**没被 abort 的** signal", async () => {
    // 回归用例：两个 controller 曾经是同一个，于是 stop() 先 abort 掉 signal，
    // 随后的 cancel 请求带着一个已 aborted 的 signal 出门，服务端根本没收到。
    const seen: boolean[] = [];
    const { protocol } = fakeProtocol({
      creates: [async () => responseOf("data: a\nid: 1\n\n")],
    });
    const spied: RunProtocol<string, Handle> = {
      ...protocol,
      async cancel(_handle, _cursor, signal) {
        seen.push(signal.aborted);
        return { kind: "terminal", outcome: "cancelled" };
      },
    };
    const session = createRunSession<string, Handle>({
      protocol: spied,
      classifyEvent: classify,
      maxBufferBytes: 1024,
      maxReconnects: 1,
      sleep: async () => {},
    });
    session.stop();
    await collect(session.run("hi"));
    expect(seen).toEqual([false]);
  });
});

describe("实例隔离（05 L8）", () => {
  it("两个 session 各自记账，游标不串", async () => {
    const a = makeSession({
      creates: [async () => responseOf("data: a\nid: 100\n\n")],
      resumes: [async () => responseOf("event: end\ndata: null\n\n")],
    });
    const b = makeSession({
      creates: [async () => responseOf("data: b\nid: 200\n\n")],
      resumes: [async () => responseOf("event: end\ndata: null\n\n")],
    });
    await Promise.all([
      collect(a.session.run("x")),
      collect(b.session.run("y")),
    ]);
    expect(a.calls.resume).toEqual(["100"]);
    expect(b.calls.resume).toEqual(["200"]);
  });

  it("getState 反映最新状态", async () => {
    const { session } = makeSession({
      creates: [async () => responseOf("event: end\ndata: null\n\n")],
    });
    expect(session.getState()).toEqual({ status: "idle" });
    await collect(session.run("hi"));
    expect(session.getState().status).toBe("completed");
  });
});

describe("退避在会话里被真的调用", () => {
  it("每次重连前都 sleep 一次，时长随 attempt 增长", async () => {
    const sleep = vi.fn((_ms: number) => Promise.resolve());
    const flaky = async () => responseOf("data: x\nid: 1\n\n");
    const { session } = makeSession(
      { creates: [flaky], resumes: [flaky, flaky, flaky] },
      {
        sleep,
        maxReconnects: 3,
        backoff: { baseMs: 10, factor: 2, maxMs: 1000, jitterRatio: 0 },
      },
    );
    await collect(session.run("hi"));
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([10, 20, 40]);
  });
});
