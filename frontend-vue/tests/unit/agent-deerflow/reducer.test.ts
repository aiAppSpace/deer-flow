/*
  【文件职责】     DeerFlow 事件 reducer 的行为，重点是 08 点名最易做错的两条。
  【架构位置】     L3 测试
  【主要导出】     无
  【依赖关系】     app/core/agent-deerflow/reducer.ts · @deerflow/agent-core
                   tests/fixtures/streams/deerflow-create.sse（M0 真实录制）
  【边界与注意】   **哪些断言有真实录制佐证、哪些是合成的，本文件分成两个 describe
                   写清楚。** 上一窗口的红项说过：golden trace 只覆盖 7 种事件，
                   `custom` / `debug`、subagent namespace、reasoning delta 在
                   replay 场景（write_read_file.ultra）里根本不产生。拿合成载荷当
                   "覆盖了"是自欺；分开写，读的人才知道哪条结论的证据强度是多少。

                   **第二个 describe 的名字曾把这件事说反了**：它写着
                   「write_read_file.ultra 不产生这些帧」，而它测的 `updates` /
                   `values` 恰恰是录制里最多的两种（50 / 13 帧）——同一份文件里
                   90 行之外的帧普查一直在断言这两个数。写下那天（`d6048f81`）
                   录制里就已经是 50 / 13，所以它不是过期、是从头就说反了。
                   分档说明现在写在那一段的分节注释里，数字只留在普查那一条。

                   **`checkpoints` / `tasks` 已经不在合成那一档了**：M2 收尾时把这
                   两个请求模式加进了 M0 的录制（08 §402 点名要求），录制从 74 帧
                   涨到 226 帧，两者各 52 / 100 帧都是真实数据。

                   录制那一半的主断言是**整条流跑完之后的消息集合逐字段等于最后
                   一帧 `values`**。这条断言同时压住 adapter 与 reducer：
                   流式分片造出的 3 条幽灵 AI 消息（id 只出现在 `messages` 帧里，
                   从没进过 `values`）必须被 `values` 的全量语义清掉，
                   浅合并会让它们留下来。
*/

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { AgentSnapshot, SseEvent } from "@deerflow/agent-core";
import { createAgentExternalStore } from "@deerflow/agent-core";
import { describe, expect, it, vi } from "vitest";

import { toWireMessage } from "@/core/agent-deerflow/message-adapt";
import type { DeerFlowThreadState } from "@/core/agent-deerflow/reducer";
import {
  createDeerFlowEventReducer,
  EMPTY_DEERFLOW_THREAD_STATE,
  isSyntheticValuesMessageId,
  SYNTHETIC_VALUES_ID_PREFIX,
} from "@/core/agent-deerflow/reducer";

const GOLDEN_TRACE = fileURLToPath(
  new URL("../../fixtures/streams/deerflow-create.sse", import.meta.url),
);

function goldenEvents(): SseEvent[] {
  const raw = readFileSync(GOLDEN_TRACE, "utf8");
  const events: SseEvent[] = [];
  for (const block of raw.split(/\r?\n\r?\n/)) {
    const event = /^event: (.*)$/m.exec(block)?.[1];
    const data = /^data: (.*)$/m.exec(block)?.[1];
    if (!event) continue;
    events.push({ event, data: data ?? "" });
  }
  return events;
}

interface Harness {
  store: ReturnType<typeof makeStore>;
  unknown: ReturnType<typeof vi.fn>;
}

function makeStore(onUnknownEvent: (name: string, event: SseEvent) => void) {
  let seq = 0;
  return createAgentExternalStore<DeerFlowThreadState, SseEvent>({
    initialState: EMPTY_DEERFLOW_THREAD_STATE,
    reducer: createDeerFlowEventReducer({ onUnknownEvent }),
    createId: () => `generated-${(seq += 1)}`,
    now: () => 1_700_000_000_000,
  });
}

function harness(): Harness {
  const unknown = vi.fn();
  return { store: makeStore(unknown), unknown };
}

function ordered(snapshot: AgentSnapshot<DeerFlowThreadState>) {
  return snapshot.messageIds.map((id) => snapshot.messages[id]);
}

function send(store: Harness["store"], event: string, data: unknown): void {
  store.dispatch({ event, data: JSON.stringify(data) });
}

// ---------------------------------------------------------------------------
// 有真实录制佐证的部分
// ---------------------------------------------------------------------------

describe("golden trace 全流回放（M0 真实录制）", () => {
  const events = goldenEvents();
  const lastValues = [...events].reverse().find((e) => e.event === "values");
  const expected = JSON.parse((lastValues as SseEvent).data) as Record<
    string,
    unknown
  > & { messages: unknown[] };

  it("录制里确实有 226 帧，覆盖 08 §402 点名的 checkpoints 与 tasks", () => {
    const byName = events.reduce<Record<string, number>>(
      (acc, e) => ({ ...acc, [e.event]: (acc[e.event] ?? 0) + 1 }),
      {},
    );
    expect(events).toHaveLength(226);
    expect(byName).toEqual({
      metadata: 1,
      values: 13,
      updates: 50,
      messages: 9,
      checkpoints: 52,
      tasks: 100,
      end: 1,
    });
  });

  /*
    下面这三个数是「哪些 reducer 规则有真实录制佐证」的**唯一出处**——
    第二个 describe 里的合成用例不再各自抄一份（wave 56：一个数字只写一处）。
    50 帧 updates 里 38 帧是「节点写 null」，10 帧写 messages 通道；
    而 remove 型消息与 values 重排在整条录制里一次都不出现，
    所以那两条规则只有合成佐证。**这条断言红了，就说明重录之后
    第二个 describe 的分档说明要跟着改。**
  */
  it("录制对 updates / values 各条规则的佐证强度", () => {
    const updates = events
      .filter((e) => e.event === "updates")
      .map((e) => JSON.parse(e.data) as Record<string, unknown>);

    const nullNodeWrites = updates.filter((payload) =>
      Object.values(payload).every((value) => value === null),
    );
    const messageChannelWrites = updates.filter((payload) =>
      Object.values(payload).some(
        (value) =>
          typeof value === "object" && value !== null && "messages" in value,
      ),
    );
    expect(nullNodeWrites).toHaveLength(38);
    expect(messageChannelWrites).toHaveLength(10);

    const removed = updates.flatMap((payload) =>
      Object.values(payload).flatMap((value) =>
        typeof value === "object" && value !== null && "messages" in value
          ? (
              (value as { messages?: { type?: string }[] }).messages ?? []
            ).filter((message) => message.type === "remove")
          : [],
      ),
    );
    expect(removed, "录制里出现了 remove，合成那一档要重新分").toEqual([]);

    const valueFrames = events
      .filter((e) => e.event === "values")
      .map(
        (e) =>
          (JSON.parse(e.data) as { messages?: { id?: string }[] }).messages ??
          [],
      )
      .map((messages) => messages.map((message) => message.id));
    const reorders = valueFrames.filter((ids, index) => {
      const previous = valueFrames[index - 1];
      if (!previous || previous.length !== ids.length) return false;
      return (
        [...previous].sort().join() === [...ids].sort().join() &&
        previous.join() !== ids.join()
      );
    });
    expect(reorders, "录制里出现了 values 重排，合成那一档要重新分").toEqual(
      [],
    );
  });

  it("跑完整条流之后，消息集合逐字段等于最后一帧 values", () => {
    const { store } = harness();
    for (const event of events) store.dispatch(event);

    const final = ordered(store.getSnapshot()).map((message) =>
      toWireMessage(message as NonNullable<typeof message>),
    );
    expect(final).toEqual(expected.messages);
  });

  it("流式分片造出的 3 条幽灵 AI 消息被 values 的全量语义清掉", () => {
    const chunkIds = new Set(
      events
        .filter((e) => e.event === "messages")
        .map((e) => (JSON.parse(e.data) as [{ id: string }, unknown])[0].id),
    );
    const durableIds = new Set(
      (expected.messages as { id: string }[]).map((m) => m.id),
    );
    // 只在 messages 帧里出现过、从没进过任何 values 的 id。
    const ghosts = [...chunkIds].filter((id) => !durableIds.has(id));
    expect(ghosts).toHaveLength(3);

    // 逐帧记账。**必须证明它们真的被造出来过**，否则末态干净可能只是因为
    // 幽灵消息压根没产生，那样这条断言什么都没测。清理不是发生在流末尾：
    // 每个 values 帧都会当场清掉当时存在的幽灵。
    const { store } = harness();
    const everSeen = new Set<string>();
    for (const event of events) {
      store.dispatch(event);
      for (const id of store.getSnapshot().messageIds) {
        if (ghosts.includes(id)) everSeen.add(id);
      }
    }
    expect([...everSeen].sort()).toEqual([...ghosts].sort());
    for (const ghost of ghosts) {
      expect(store.getSnapshot().messageIds).not.toContain(ghost);
    }
  });

  it("`X` → `X__user` 的 id 顶替：一条 human 不会变成两条", () => {
    const { store } = harness();
    const upTo = events.findIndex(
      (e) => e.event === "values" && e.data.includes("__user"),
    );
    expect(upTo).toBeGreaterThan(0);
    for (const event of events.slice(0, upTo + 1)) store.dispatch(event);

    const messages = ordered(store.getSnapshot());
    expect(messages).toHaveLength(2);
    expect(messages.map((m) => m?.role)).toEqual(["system", "human"]);
    expect(messages[1]?.id).toMatch(/__user$/);
  });

  it("durable state 里没有 messages（消息只住在快照的消息表里）", () => {
    const { store } = harness();
    for (const event of events) store.dispatch(event);

    const { state } = store.getSnapshot();
    expect(state.messages).toBeUndefined();
    const { messages: _drop, ...rest } = expected;
    expect(state).toEqual(rest);
  });

  it("跑完全程没有触发未知事件回调", () => {
    const { store, unknown } = harness();
    for (const event of events) store.dispatch(event);
    expect(unknown).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 合成载荷：逐条隔离 reducer 规则
//
// **这一档不是「录制里没有的事件」**：updates 与 values 恰恰是录制里最多的两种
// （50 / 13 帧，上面那条普查钉着）。合成的是**载荷形状**——把一条规则单独摆出来，
// 让它失效时红的是这一条而不是整条流。
//
// 佐证强度分两级，上面那条「佐证强度」断言是它的机器口径：
//   有录制佐证 —— 通道隔离、add_messages、节点写 null（录制里 38 帧都是这样）；
//   只有合成佐证 —— remove 型消息、values 重排、subagent 命名空间（`updates|agent:…`）、
//                   坏 JSON 与 error 帧：整条录制里一次都不出现。
// ---------------------------------------------------------------------------

describe("合成载荷（逐条隔离 reducer 规则）", () => {
  it("updates 只写自己的通道，不碰别的通道", () => {
    const { store } = harness();
    send(store, "values", { messages: [], title: "t0", artifacts: ["a"] });
    send(store, "updates", { "TitleMiddleware.after_agent": { title: "t1" } });

    expect(store.getSnapshot().state).toEqual({
      title: "t1",
      artifacts: ["a"],
    });
  });

  it("updates 的 messages 通道是 add_messages，不是整段替换", () => {
    const { store } = harness();
    send(store, "values", {
      messages: [
        { id: "a", type: "human", content: "hi" },
        { id: "b", type: "ai", content: "hello" },
      ],
    });
    // 只写了 b。整段替换的实现会把 a 弄丢。
    send(store, "updates", {
      model: { messages: [{ id: "b", type: "ai", content: "hello!" }] },
    });

    const messages = ordered(store.getSnapshot());
    expect(messages.map((m) => m?.id)).toEqual(["a", "b"]);
    expect(messages[1]?.content).toBe("hello!");
  });

  it("updates 里 type 为 remove 的消息会被删掉", () => {
    const { store } = harness();
    send(store, "values", {
      messages: [
        { id: "a", type: "human", content: "hi" },
        { id: "b", type: "ai", content: "oops" },
      ],
    });
    send(store, "updates", {
      model: { messages: [{ id: "b", type: "remove", content: "" }] },
    });
    expect(store.getSnapshot().messageIds).toEqual(["a"]);
  });

  it("节点写 null 时什么都不动（录制里多数 updates 帧都是这样）", () => {
    const { store } = harness();
    send(store, "values", { messages: [], title: "t0" });
    const before = store.getSnapshot();
    send(store, "updates", { "MemoryMiddleware.after_agent": null });
    expect(store.getSnapshot()).toBe(before);
  });

  it("values 重排已知 id 时整段重建（upsert 表达不了重排）", () => {
    const { store } = harness();
    send(store, "values", {
      messages: [
        { id: "a", type: "human", content: "1" },
        { id: "b", type: "ai", content: "2" },
      ],
    });
    send(store, "values", {
      messages: [
        { id: "b", type: "ai", content: "2" },
        { id: "a", type: "human", content: "1" },
      ],
    });
    expect(store.getSnapshot().messageIds).toEqual(["b", "a"]);
  });

  it("一次 values 归约返回多个 action（08 明确要求，不能拆成三次 dispatch）", () => {
    const reducer = createDeerFlowEventReducer();
    const snapshot: AgentSnapshot<DeerFlowThreadState> = {
      state: {},
      messageIds: ["stale"],
      messages: {},
      session: { status: "idle" },
      lastActivityAt: 0,
    };
    const actions = reducer(
      {
        event: "values",
        data: JSON.stringify({
          title: "t",
          messages: [{ id: "a", type: "human", content: "x" }],
        }),
      },
      snapshot,
      { createId: () => "x", now: () => 0 },
    );
    expect(actions.map((a) => a.type)).toEqual([
      "replace-state",
      "remove-message",
      "upsert-message",
    ]);
  });

  it("messages 分片跨帧累积内容，contentChunks 只记真实 delta", () => {
    const { store } = harness();
    send(store, "messages", [
      { id: "m1", type: "AIMessageChunk", content: "Hel" },
      { langgraph_node: "model" },
    ]);
    send(store, "messages", [
      { id: "m1", type: "AIMessageChunk", content: "lo" },
      { langgraph_node: "model" },
    ]);

    const message = store.getSnapshot().messages.m1;
    expect(message?.content).toBe("Hello");
    expect(message?.contentChunks).toEqual(["Hel", "lo"]);
    expect(message?.isStreaming).toBe(true);
  });

  it("reasoning delta 跨帧累积（录制里没有 reasoning）", () => {
    const { store } = harness();
    for (const piece of ["think", "ing…"]) {
      send(store, "messages", [
        {
          id: "m1",
          type: "AIMessageChunk",
          content: "",
          additional_kwargs: { reasoning_content: piece },
        },
        {},
      ]);
    }
    const message = store.getSnapshot().messages.m1;
    expect(message?.reasoning).toBe("thinking…");
    expect(message?.reasoningChunks).toEqual(["think", "ing…"]);
  });

  it("工具调用 args 分片跨帧拼接（录制里分片只在同一帧内）", () => {
    const { store } = harness();
    send(store, "messages", [
      {
        id: "m1",
        type: "AIMessageChunk",
        content: "",
        tool_call_chunks: [
          { id: "call_1", index: 0, name: "search", args: '{"q":' },
        ],
      },
      {},
    ]);
    expect(
      store.getSnapshot().messages.m1?.toolCalls?.[0]?.argsParseFailed,
    ).toBe(true);

    send(store, "messages", [
      {
        id: "m1",
        type: "AIMessageChunk",
        content: "",
        tool_call_chunks: [{ index: 0, args: '"deerflow"}' }],
      },
      {},
    ]);
    const call = store.getSnapshot().messages.m1?.toolCalls?.[0];
    expect(call?.args).toEqual({ q: "deerflow" });
    expect(call?.argsParseFailed).toBeUndefined();
  });

  it("subagent namespace 按 mode 归类，不落进未知分支", () => {
    const { store, unknown } = harness();
    store.dispatch({
      event: "updates|agent:0e5f",
      data: JSON.stringify({ node: { title: "from subagent" } }),
    });
    expect(unknown).not.toHaveBeenCalled();
    expect(store.getSnapshot().state.title).toBe("from subagent");
  });

  it("custom / debug 是明确忽略，不是漏网（checkpoints/tasks 已由录制覆盖）", () => {
    const { store, unknown } = harness();
    send(store, "values", { messages: [], title: "t0" });
    const before = store.getSnapshot();
    for (const name of ["custom", "debug", "metadata"]) {
      send(store, name, { anything: true });
    }
    expect(unknown).not.toHaveBeenCalled();
    expect(store.getSnapshot()).toBe(before);
  });

  it("未知事件走回调，不静默当成功（08 §352）", () => {
    const { store, unknown } = harness();
    send(store, "brand_new_event", { x: 1 });
    expect(unknown).toHaveBeenCalledTimes(1);
    expect(unknown.mock.calls[0]?.[0]).toBe("brand_new_event");
  });

  it("载荷解析失败报 parse_error，不当忽略", () => {
    const reducer = createDeerFlowEventReducer();
    const actions = reducer(
      { event: "values", data: "{not json" },
      {
        state: {},
        messageIds: [],
        messages: {},
        session: { status: "idle" },
        lastActivityAt: 0,
      },
      { createId: () => "x", now: () => 0 },
    );
    expect(actions).toHaveLength(1);
    const action = actions[0];
    expect(action?.type).toBe("error");
    expect(action?.type === "error" && action.error.kind).toBe("parse_error");
  });

  it("error 事件归约成 error action", () => {
    const reducer = createDeerFlowEventReducer();
    const actions = reducer(
      { event: "error", data: "boom" },
      {
        state: {},
        messageIds: [],
        messages: {},
        session: { status: "idle" },
        lastActivityAt: 0,
      },
      { createId: () => "x", now: () => 0 },
    );
    expect(actions[0]?.type).toBe("error");
  });
});

/*
  **位置键不是服务端 id。** `values` 里没有 id 的消息在存储里只能按位置对齐，
  于是 reducer 编一个 `values-<index>`——而它随后就坐在 `AgentMessage.id` 上，
  与真 id 长得一模一样。2026-09-12 量到的后果是一颗点了会失败的
  「编辑并重新运行」（读数与判据写在 reducer.ts 的那段注释与 MessageList.vue 的调用点）。

  这一组钉的是**判据本身**：认得出自己编的键，也不能把真 id 误判成编的。
*/
describe("values 快照里的位置键", () => {
  it("reducer 给没有 id 的消息编的就是这个前缀 + 序号", () => {
    const reducer = createDeerFlowEventReducer();
    const actions = reducer(
      {
        event: "values",
        data: JSON.stringify({
          messages: [
            { type: "human", content: "Hello" },
            { type: "ai", id: "msg-ai-1", content: "Hi" },
          ],
        }),
      },
      {
        state: {},
        messageIds: [],
        messages: {},
        session: { status: "idle" },
        lastActivityAt: 0,
      },
      { createId: () => "x", now: () => 0 },
    );
    const ids = actions.flatMap((action) =>
      action.type === "upsert-message" ? [action.message.id] : [],
    );
    expect(ids).toContain(`${SYNTHETIC_VALUES_ID_PREFIX}0`);
    expect(ids).toContain("msg-ai-1");
  });

  it("判据认得出编出来的键", () => {
    expect(isSyntheticValuesMessageId("values-0")).toBe(true);
    expect(isSyntheticValuesMessageId("values-12")).toBe(true);
  });

  /*
    **收紧到「前缀 + 纯数字」的理由就在这几条**：松一格（只判前缀）会把下面这些
    真 id 误挡成不可编辑，而那是一个静默的功能缺失——按钮不见了，没有任何报错。
  */
  it("判据不把真 id 误判成编出来的", () => {
    for (const id of [
      "values-abc",
      "values-0-real",
      "values-",
      "msg-human-1",
      "",
      undefined,
    ])
      expect(isSyntheticValuesMessageId(id)).toBe(false);
  });
});
