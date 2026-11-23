/*
  【文件职责】     `createThreadRunner`：M2 内核的**第一个真实调用方**。
  【架构位置】     L3 测试
  【主要导出】     无
  【依赖关系】     app/core/agent-deerflow/thread-runner.ts
  【边界与注意】   这份用例回答的是 M2 遗留的那条红项——「内核到现在一个调用方
                   都没有」。它走真 `Response` + 真 `ReadableStream`，
                   store / session / reducer / adapter 四层全部在环里，
                   断言的是**流跑完之后消息集合的形状**，不是某个中间态。

                   `scheduleNotify` 换成同步执行：本文件测的不是合并通知
                   （那是 store 自己的用例），把它同步掉之后 `onSnapshot`
                   的次数才等于「快照真的变了几次」，可以数。
*/

import { describe, expect, it, vi } from "vitest";

import type { DeerFlowRunHandle } from "@/core/agent-deerflow/endpoints";
import type { DeerFlowProtocol } from "@/core/agent-deerflow/run-protocol";
import { createThreadRunner } from "@/core/agent-deerflow/thread-runner";

const HANDLE: DeerFlowRunHandle = { threadId: "t-1", runId: "r-1" };

function sse(body: string): Response {
  return new Response(body, {
    headers: { "Content-Type": "text/event-stream" },
  });
}

function protocolOf(body: string): DeerFlowProtocol {
  return {
    create: async () => ({ handle: HANDLE, response: sse(body) }),
    resume: async () => sse(""),
    cancel: async () => ({ kind: "terminal", outcome: "cancelled" }),
    inspect: async () => ({ terminal: true, outcome: "completed", reason: "" }),
  };
}

const STREAM =
  `event: metadata\ndata: {"run_id":"r-1","thread_id":"t-1"}\nid: a\n\n` +
  `event: values\ndata: {"title":"Draft","messages":[{"id":"m1","type":"human","content":"hi"}]}\nid: b\n\n` +
  `event: messages\ndata: [{"id":"m2","type":"ai","content":"Hel"},{}]\nid: c\n\n` +
  `event: messages\ndata: [{"id":"m2","type":"ai","content":"lo"},{}]\nid: d\n\n` +
  `event: end\ndata: {}\n\n`;

function runnerFor(
  body: string,
  hooks: Parameters<typeof createThreadRunner>[0] extends infer O
    ? Partial<O>
    : never = {},
) {
  return createThreadRunner({
    protocol: protocolOf(body),
    loadDurableState: async () => undefined,
    scheduleNotify: (flush) => flush(),
    createId: () => "generated",
    now: () => 0,
    ...hooks,
  });
}

describe("createThreadRunner", () => {
  it("aborting an in-flight creation allows a fresh run to notify the same subscriber", async () => {
    const onSnapshot = vi.fn();
    let first = true;
    const create: DeerFlowProtocol["create"] = async (_input, signal) => {
      if (!first) return { handle: HANDLE, response: sse(STREAM) };
      first = false;
      return new Promise((_, reject) =>
        signal.addEventListener(
          "abort",
          () => reject(new DOMException("aborted", "AbortError")),
          { once: true },
        ),
      );
    };
    const runner = runnerFor(STREAM, {
      onSnapshot,
      protocol: { ...protocolOf(STREAM), create },
    });
    const pending = runner.submit({ threadId: "t-1", payload: {} });
    await vi.waitFor(() =>
      expect(runner.getSessionState().status).toBe("creating"),
    );
    runner.abort();
    await pending;
    await runner.submit({ threadId: "t-1", payload: {} });
    expect(runner.getWireMessages().map((message) => message.id)).toEqual([
      "m1",
      "m2",
    ]);
    expect(onSnapshot).toHaveBeenCalled();
    expect(runner.getSessionState().status).toBe("completed");
  });

  it("joining an existing run hydrates its human input before the first replayed AI chunk", async () => {
    const create = vi.fn();
    const resume = vi.fn(async () =>
      sse(
        'event: messages\ndata: [{"id":"ai","type":"ai","content":"answer"},{}]\n\nevent: end\ndata: null\n\n',
      ),
    );
    const runner = runnerFor("", {
      protocol: { ...protocolOf(""), create, resume },
      loadDurableState: async () => ({
        messages: [{ id: "human", type: "human", content: "question" }],
      }),
    });
    await runner.join(HANDLE);
    expect(create).not.toHaveBeenCalled();
    expect(resume).toHaveBeenCalledWith(
      HANDLE,
      undefined,
      expect.any(AbortSignal),
    );
    expect(runner.getWireMessages().map((message) => message.id)).toEqual([
      "human",
      "ai",
    ]);
  });

  it("abort keeps snapshot subscriptions alive for a later submission; dispose releases them", async () => {
    const onSnapshot = vi.fn();
    const cancel = vi.fn(async () => ({ kind: "accepted" as const }));
    const runner = runnerFor(STREAM, {
      onSnapshot,
      protocol: { ...protocolOf(STREAM), cancel },
    });
    await runner.submit({ threadId: "t-1", payload: {} });
    runner.abort();
    const beforeRetry = onSnapshot.mock.calls.length;
    await runner.submit({ threadId: "t-1", payload: {} });
    expect(onSnapshot.mock.calls.length).toBeGreaterThan(beforeRetry);
    expect(runner.getSessionState().status).toBe("completed");
    expect(cancel).not.toHaveBeenCalled();

    runner.dispose();
    const afterDispose = onSnapshot.mock.calls.length;
    runner.reset();
    expect(onSnapshot).toHaveBeenCalledTimes(afterDispose);
  });

  it("跑完一条流之后消息按协议顺序落地，delta 是追加不是覆盖", async () => {
    const runner = runnerFor(STREAM);
    await runner.submit({ threadId: "t-1", payload: {} });

    const messages = runner.getWireMessages();
    expect(messages.map((m) => m.id)).toEqual(["m1", "m2"]);
    // 正面特征：两个 chunk 拼起来是 "Hello"。覆盖语义会得到 "lo"，
    // 而 "lo" 也是「有内容」——只断言非空就是假绿。
    expect(JSON.stringify(messages[1]?.content)).toContain("Hello");
    expect(runner.getSessionState().status).toBe("completed");
    expect(runner.isStreaming()).toBe(false);
  });

  it("拿到 handle 时通知一次 onStart，不重复通知", async () => {
    const onStart = vi.fn();
    const runner = runnerFor(STREAM, { onStart });
    await runner.submit({ threadId: "t-1", payload: {} });
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStart).toHaveBeenCalledWith(HANDLE);
  });

  it("custom 帧转成 onCustomEvent 的解析后载荷", async () => {
    const onCustomEvent = vi.fn();
    const runner = runnerFor(
      `event: custom\ndata: {"type":"task_running","task_id":"x"}\nid: a\n\nevent: end\ndata: {}\n\n`,
      { onCustomEvent },
    );
    await runner.submit({ threadId: "t-1", payload: {} });
    expect(onCustomEvent).toHaveBeenCalledWith({
      type: "task_running",
      task_id: "x",
    });
  });

  it("updates 帧转成 onUpdateEvent；values 帧不走这个钩子", async () => {
    const onUpdateEvent = vi.fn();
    const runner = runnerFor(
      `event: values\ndata: {"title":"a"}\nid: a\n\n` +
        `event: updates\ndata: {"node":{"title":"b"}}\nid: b\n\n` +
        `event: end\ndata: {}\n\n`,
      { onUpdateEvent },
    );
    await runner.submit({ threadId: "t-1", payload: {} });
    expect(onUpdateEvent).toHaveBeenCalledTimes(1);
    expect(onUpdateEvent).toHaveBeenCalledWith({ node: { title: "b" } });
  });

  it("后端 error 事件落成 failed，并且报出来", async () => {
    const onError = vi.fn();
    const runner = runnerFor(
      `event: error\ndata: {"message":"boom"}\nid: a\n\n`,
      { onError },
    );
    await runner.submit({ threadId: "t-1", payload: {} });
    expect(runner.getSessionState().status).toBe("failed");
    expect(onError).toHaveBeenCalledTimes(1);
    expect(String(onError.mock.calls[0]?.[0])).toContain("boom");
  });

  // ⚠️ 这条是 M4a 的 e2e gate 第 4 条用例逼出来的，不是设计时想到的。
  //
  // 原来只在 `onStart` / `onSettled` 里刷会话状态，于是 `creating` 那一段
  // （create 请求已发出、响应还没回来）对 UI 不可见——慢连接下停止按钮
  // 永远不出现，而这恰好是最需要它的时候。
  it("每一次状态变化都通知，包含 create 还没回来的 creating 段", async () => {
    const seen: string[] = [];
    const runner = runnerFor(STREAM, {
      onSessionState: (state) => seen.push(state.status),
    });
    await runner.submit({ threadId: "t-1", payload: {} });

    expect(seen[0]).toBe("creating");
    expect(seen).toContain("streaming");
    expect(seen.at(-1)).toBe("completed");
  });

  it("reset 把快照与会话都清掉（切 thread 用）", async () => {
    const runner = runnerFor(STREAM);
    await runner.submit({ threadId: "t-1", payload: {} });
    expect(runner.getWireMessages()).toHaveLength(2);

    runner.reset();
    expect(runner.getWireMessages()).toEqual([]);
    expect(runner.getSessionState().status).toBe("idle");
  });

  it("reset 后旧 create 即使迟到也不能再写入新页面状态", async () => {
    let resolveCreate!: (value: {
      handle: DeerFlowRunHandle;
      response: Response;
    }) => void;
    const create = vi.fn(
      () =>
        new Promise<{ handle: DeerFlowRunHandle; response: Response }>(
          (resolve) => {
            resolveCreate = resolve;
          },
        ),
    );
    const onCustomEvent = vi.fn();
    const onSettled = vi.fn();
    const runner = createThreadRunner({
      protocol: {
        create,
        resume: async () => sse(""),
        cancel: async () => ({ kind: "terminal", outcome: "cancelled" }),
        inspect: async () => ({
          terminal: true,
          outcome: "completed",
          reason: "",
        }),
      },
      loadDurableState: async () => undefined,
      scheduleNotify: (flush) => flush(),
      onCustomEvent,
      onSettled,
    });

    const submission = runner.submit({ threadId: "old-thread", payload: {} });
    await vi.waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    runner.reset();
    resolveCreate({
      handle: { threadId: "old-thread", runId: "old-run" },
      response: sse(
        `event: custom\ndata: {"type":"task_running","task_id":"old"}\nid: a\n\n` +
          `event: end\ndata: {}\n\n`,
      ),
    });
    await submission;

    expect(onCustomEvent).not.toHaveBeenCalled();
    expect(onSettled).not.toHaveBeenCalled();
    expect(runner.getWireMessages()).toEqual([]);
    expect(runner.getSessionState().status).toBe("idle");
  });
});

/*
  打开线程时的 checkpoint 种子（wave 8）。

  上游没有对应代码：SDK 的 `values = stream.values ?? historyValues` 是纯推导，
  种子永远盖不到正在流的消息。本仓的种子要进 store，那条边界就得自己守，
  于是它是 `seedDurableState` 的**返回值**而不是一句注释。
*/
describe("createThreadRunner · checkpoint 种子", () => {
  it("idle 时收下种子，消息与 durable state 一起落地", () => {
    const onSnapshot = vi.fn();
    const runner = runnerFor(STREAM, { onSnapshot });

    expect(
      runner.seedDurableState({
        title: "Summarized",
        messages: [
          { id: "s1", type: "human", content: "old question" },
          { id: "s2", type: "ai", content: "summary" },
        ],
      }),
    ).toBe(true);

    expect(runner.getWireMessages().map((m) => m.id)).toEqual(["s1", "s2"]);
    expect(runner.getSnapshot().state.title).toBe("Summarized");
    // 消费方靠 onSnapshot 才知道快照换了；不通知的话种子永远不上屏。
    expect(onSnapshot).toHaveBeenCalled();
    // 种子不是一次 run：会话状态必须还在 idle，否则停止按钮会凭空出现。
    expect(runner.getSessionState().status).toBe("idle");
  });

  it("run 开始之后拒收，晚到的种子不会抹掉流里的消息", async () => {
    const runner = runnerFor(STREAM);
    await runner.submit({ threadId: "t-1", payload: {} });
    expect(runner.getSessionState().status).toBe("completed");

    const accepted = runner.seedDurableState({
      messages: [{ id: "s1", type: "ai" }],
    });
    // 先断实际损失、再断返回值：守卫拿掉时报的是「[s1] 不等于 [m1, m2]」，
    // 也就是流跑出来的消息被种子抹掉了，而不只是一个布尔值不对。
    expect(runner.getWireMessages().map((m) => m.id)).toEqual(["m1", "m2"]);
    expect(accepted).toBe(false);
  });

  /*
    run 结束之后重取的那一帧走另一个入口（wave 41）。两条判据必须**同时**成立，
    只钉一条都会把这次改动的意义抹掉：
    · settle 之后要收（不收的话上下文压缩后的摘要要切走再回来才更新）；
    · 还在流的时候要拒（收下的话就退化成上面那条「晚到的种子抹掉流」的缺陷）。
  */
  it("run 结束之后收下重取的 checkpoint——seedDurableState 这时是收不下的", async () => {
    const runner = runnerFor(STREAM);
    await runner.submit({ threadId: "t-1", payload: {} });
    expect(runner.getSessionState().status).toBe("completed");

    // 同一帧、同一时刻：两个入口的差别就是这两行。
    expect(
      runner.seedDurableState({ messages: [{ id: "c1", type: "ai" }] }),
    ).toBe(false);
    expect(
      runner.refreshDurableState({ messages: [{ id: "c1", type: "ai" }] }),
    ).toBe(true);
    expect(runner.getWireMessages().map((m) => m.id)).toEqual(["c1"]);
  });

  it("还在流的时候 refreshDurableState 照样拒收", async () => {
    const attempts: boolean[] = [];
    // 流是同步跑完的，所以「流到一半」这个时刻只能从会话状态钩子里拿。
    // 钩子只在 submit() 期间触发，那时 runner 早就赋值完了。
    const runner = runnerFor(STREAM, {
      onSessionState(state) {
        if (state.status !== "streaming") return;
        attempts.push(
          runner.refreshDurableState({ messages: [{ id: "c1", type: "ai" }] }),
        );
      },
    });
    await runner.submit({ threadId: "t-1", payload: {} });

    expect(attempts.length).toBeGreaterThan(0);
    expect(attempts).not.toContain(true);
    // 先断实际损失：拒收失败时流里的消息会被这一帧抹掉。
    expect(runner.getWireMessages().map((m) => m.id)).toEqual(["m1", "m2"]);
  });

  it("reset 之后重新可种：切 thread 走的就是这条路", async () => {
    const runner = runnerFor(STREAM);
    await runner.submit({ threadId: "t-1", payload: {} });
    runner.reset();

    expect(
      runner.seedDurableState({ messages: [{ id: "s1", type: "ai" }] }),
    ).toBe(true);
    expect(runner.getWireMessages().map((m) => m.id)).toEqual(["s1"]);
  });

  it("种子保留后端写在消息上的 run 身份与运行耗时", () => {
    const runner = runnerFor(STREAM);
    runner.seedDurableState({
      messages: [
        {
          id: "s1",
          type: "ai",
          content: "a",
          run_id: "run-a",
          additional_kwargs: { turn_duration: 12 },
        },
      ],
    });
    const message = runner.getWireMessages()[0];
    // `POST /history` 相对 `GET /state` 的全部价值就是这两个字段；
    // 适配器把它们丢掉的话，换哪条路由都一样。
    expect(Reflect.get(message ?? {}, "run_id")).toBe("run-a");
    expect(message?.additional_kwargs?.turn_duration).toBe(12);
  });
});

function controlledStream() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const response = new Response(
    new ReadableStream<Uint8Array>({
      start(value) {
        controller = value;
      },
    }),
    { headers: { "Content-Type": "text/event-stream" } },
  );
  return {
    response,
    emit(event: string, payload: unknown, id = event) {
      controller.enqueue(
        new TextEncoder().encode(
          `event: ${event}\ndata: ${JSON.stringify(payload)}\nid: ${id}\n\n`,
        ),
      );
    },
    disconnect() {
      controller.close();
    },
  };
}

describe("current run assistant ownership", () => {
  it("uses normalized message actions, excludes durable values and other roles, and retires at settlement", async () => {
    const stream = controlledStream();
    const runner = runnerFor("", {
      protocol: {
        ...protocolOf(""),
        create: async () => ({ handle: HANDLE, response: stream.response }),
      },
    });
    runner.seedDurableState({
      messages: [{ type: "ai", id: "history", content: "History" }],
    });
    const pending = runner.submit({ threadId: "t-1", payload: {} });
    try {
      await vi.waitFor(() =>
        expect(runner.getSessionState().status).toBe("streaming"),
      );
      expect([...runner.getStreamingMessageIds()]).toEqual([]);
      stream.emit("updates", {
        agent: { messages: [{ type: "ai", id: "durable", content: "Saved" }] },
      });
      await vi.waitFor(() =>
        expect(runner.getWireMessages().map((message) => message.id)).toContain(
          "durable",
        ),
      );
      expect([...runner.getStreamingMessageIds()]).toEqual([]);
      stream.emit(
        "messages",
        [{ type: "ai", id: "live", content: "Part" }, {}],
        "chunk-1",
      );
      await vi.waitFor(() =>
        expect([...runner.getStreamingMessageIds()]).toEqual(["live"]),
      );
      const beforeNextChunk = runner.getStreamingMessageIds();
      stream.emit(
        "messages",
        [{ type: "human", id: "human", content: "Question" }, {}],
        "chunk-2",
      );
      stream.emit(
        "messages",
        [
          { type: "tool", id: "tool", tool_call_id: "call", content: "Result" },
          {},
        ],
        "chunk-3",
      );
      stream.emit(
        "messages",
        [{ type: "ai", content: "Without supplied ID" }, {}],
        "chunk-4",
      );
      await vi.waitFor(() =>
        expect([...runner.getStreamingMessageIds()]).toEqual([
          "live",
          "generated",
        ]),
      );
      expect([...beforeNextChunk]).toEqual(["live"]);
      stream.emit("values", {
        messages: [{ type: "ai", id: "live", content: "Final" }],
      });
      await vi.waitFor(() =>
        expect(runner.getWireMessages()[0]?.content).toBe("Final"),
      );
      expect(runner.getStreamingMessageIds().has("live")).toBe(true);
      stream.emit("end", null);
      await pending;
      expect(runner.getSessionState().status).toBe("completed");
      expect([...runner.getStreamingMessageIds()]).toEqual([]);
    } finally {
      runner.dispose();
      await pending;
    }
  });

  for (const ending of [
    "abort",
    "reset",
    "dispose",
    "stop",
    "error",
  ] as const) {
    it(`retires current message ownership on ${ending}`, async () => {
      const stream = controlledStream();
      const runner = runnerFor("", {
        protocol: {
          ...protocolOf(""),
          create: async () => ({ handle: HANDLE, response: stream.response }),
        },
      });
      const pending = runner.submit({ threadId: "t-1", payload: {} });
      try {
        await vi.waitFor(() =>
          expect(runner.getSessionState().status).toBe("streaming"),
        );
        stream.emit("messages", [
          { type: "ai", id: "live", content: "Part" },
          {},
        ]);
        await vi.waitFor(() =>
          expect(runner.getStreamingMessageIds().has("live")).toBe(true),
        );
        if (ending === "error") stream.emit("error", { message: "Failed" });
        else runner[ending]();
        await pending;
        expect([...runner.getStreamingMessageIds()]).toEqual([]);
      } finally {
        runner.dispose();
        await pending;
      }
    });
  }

  it("keeps the same run's ownership through transport reconnect and clears it before the next run", async () => {
    const first = controlledStream();
    const resumed = controlledStream();
    const next = controlledStream();
    let creation = 0;
    const resume = vi.fn(async () => resumed.response);
    const runner = runnerFor("", {
      sleep: async () => {},
      protocol: {
        ...protocolOf(""),
        create: async () => ({
          handle: creation++ === 0 ? HANDLE : { ...HANDLE, runId: "r-2" },
          response: creation === 1 ? first.response : next.response,
        }),
        resume,
        inspect: async () => ({ terminal: false }),
      },
    });
    const pending = runner.submit({ threadId: "t-1", payload: {} });
    let nextPending: Promise<void> | undefined;
    try {
      await vi.waitFor(() =>
        expect(runner.getSessionState().status).toBe("streaming"),
      );
      first.emit(
        "messages",
        [{ type: "ai", id: "first", content: "Before reconnect" }, {}],
        "cursor-1",
      );
      await vi.waitFor(() =>
        expect(runner.getStreamingMessageIds().has("first")).toBe(true),
      );
      first.disconnect();
      await vi.waitFor(() => expect(resume).toHaveBeenCalledTimes(1));
      expect(runner.getStreamingMessageIds().has("first")).toBe(true);
      resumed.emit(
        "messages",
        [{ type: "ai", id: "second", content: "After reconnect" }, {}],
        "cursor-2",
      );
      await vi.waitFor(() =>
        expect([...runner.getStreamingMessageIds()]).toEqual([
          "first",
          "second",
        ]),
      );
      resumed.emit("end", null);
      await pending;
      nextPending = runner.submit({ threadId: "t-1", payload: {} });
      expect([...runner.getStreamingMessageIds()]).toEqual([]);
      await vi.waitFor(() =>
        expect(runner.getSessionState().status).toBe("streaming"),
      );
      next.emit("messages", [
        { type: "ai", id: "third", content: "New run" },
        {},
      ]);
      await vi.waitFor(() =>
        expect([...runner.getStreamingMessageIds()]).toEqual(["third"]),
      );
      next.emit("end", null);
      await nextPending;
    } finally {
      runner.dispose();
      await pending;
      await nextPending;
    }
  });
});
