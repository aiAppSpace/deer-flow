/*
  【文件职责】     钉住消息的**可信位置**：seq 的判据、收敛、以及它在合并里压过锚点。
  【架构位置】     单元测试
  【依赖关系】     app/core/threads/{message-seq,message-merge,message-identity}.ts
  【边界与注意】   逐条对着上游 `tests/unit/core/threads/message-order.test.ts` 搬。

                   本仓此前**整段没有这一层**：`message-merge.ts` 是从上游加 seq 骨架
                   之前的版本移植的，于是「seq 已知、但在已加载窗口里找不到桥接身份」
                   的消息只能退回锚点编织——落到队尾而不是它在 feed 里的位置。
                   缺的是排序，而排序错了不会报错，只会让用户看到乱序的对话。
*/

import { describe, expect, test } from "vitest";

import { getMessageRunId } from "@/core/messages/run-duration";
import { buildVisibleHistoryMessages } from "@/core/threads/message-identity";
import {
  mergeMessages,
  resolveTransientHistoryBridge,
} from "@/core/threads/message-merge";
import {
  MESSAGE_SEQ_KEY,
  insertByTrustedSeq,
  trustedMessageSeq,
} from "@/core/threads/message-seq";
import type { Message } from "@/core/types/message";
import type { RunMessage } from "@/core/threads/types";

function msg(
  id: string,
  type: "human" | "ai" | "tool" | "system",
  content: string,
  seq?: number,
  extra?: Record<string, unknown>,
): Message {
  return {
    id,
    type,
    content,
    ...(extra ?? {}),
    additional_kwargs: seq === undefined ? {} : { [MESSAGE_SEQ_KEY]: seq },
  } as Message;
}

function withKwargs(
  message: Message,
  kwargs: Record<string, unknown>,
): Message {
  return {
    ...message,
    additional_kwargs: { ...message.additional_kwargs, ...kwargs },
  } as Message;
}

function row(
  runId: string,
  seq: number,
  content: Message,
  index = 0,
): RunMessage {
  return {
    run_id: runId,
    seq,
    content,
    metadata: { caller: "lead_agent" },
    created_at: `2026-09-08T00:00:${String(index).padStart(2, "0")}Z`,
  };
}

const seqsOf = (messages: Message[]) =>
  messages.map((message) => message.additional_kwargs?.[MESSAGE_SEQ_KEY]);
const idsOf = (messages: Message[]) => messages.map((message) => message.id);

describe("可信位置的判据", () => {
  test("只认正的安全整数", () => {
    expect(trustedMessageSeq(msg("a", "ai", "x", 3))).toBe(3);
    expect(trustedMessageSeq(msg("a", "ai", "x"))).toBeUndefined();
    for (const value of [
      null,
      "7",
      Number.NaN,
      1.5,
      0,
      -2,
      Number.MAX_SAFE_INTEGER + 1,
    ]) {
      expect(
        trustedMessageSeq(
          withKwargs(msg("a", "ai", "x"), { [MESSAGE_SEQ_KEY]: value }),
        ),
        `seq=${String(value)}`,
      ).toBeUndefined();
    }
  });

  test("非法 seq 永不覆盖一个已知位置，也不会把合并弄坏", () => {
    for (const bad of [
      null,
      "7",
      Number.NaN,
      1.5,
      Number.MAX_SAFE_INTEGER + 1,
    ]) {
      const history = [msg("h1", "human", "q", 3), msg("a1", "ai", "a", 4)];
      const live = [
        withKwargs(msg("h1", "human", "q"), { [MESSAGE_SEQ_KEY]: bad }),
        withKwargs(msg("a1", "ai", "a2"), { [MESSAGE_SEQ_KEY]: bad }),
      ];
      const merged = mergeMessages(history, live, []);
      expect(idsOf(merged), `seq=${String(bad)}`).toEqual(["h1", "a1"]);
      expect(seqsOf(merged), `seq=${String(bad)}`).toEqual([3, 4]);
      expect(merged[1]!.content).toBe("a2");
    }
  });
});

describe("历史行把位置盖到消息身上", () => {
  test("同一身份的多行收敛到**最早**的那条可见行", () => {
    // 后端 get_message_seqs 就是 earliest-seq-wins：重新持久化的更新不能把
    // 消息往队尾推。内容取最新的可见副本，位置留在最早的那条。
    const rows = [
      row("run-1", 1, msg("h1", "human", "question"), 0),
      row("run-1", 2, msg("a1", "ai", "first draft"), 1),
      row("run-1", 3, msg("a1", "ai", "updated answer"), 2),
    ];

    const visible = buildVisibleHistoryMessages(rows, new Set());

    expect(idsOf(visible)).toEqual(["h1", "a1"]);
    expect(visible[1]!.content).toBe("updated answer");
    expect(seqsOf(visible)).toEqual([1, 2]);
  });

  test("没有身份的行也带上它自己那一行的 seq", () => {
    /*
      收敛那一遍是**按身份**做的，`messageIdentity` 取不到身份时它提前返回。
      所以「把 row.seq 盖到消息上」这一步对有身份的消息是冗余的（马上被收敛值覆盖），
      唯独在这里承重：没有 id、也没有 tool_call_id 的行，只有这一次机会拿到位置。
      少了它，这类消息在合并时没有可信位置，只能退回锚点编织。
    */
    const anonymous = {
      type: "ai",
      content: "no identity",
    } as unknown as Message;

    const visible = buildVisibleHistoryMessages(
      [row("run-1", 7, anonymous, 0)],
      new Set(),
    );

    expect(visible).toHaveLength(1);
    expect(visible[0]!.additional_kwargs?.[MESSAGE_SEQ_KEY]).toBe(7);
  });

  test("隐藏的控制行不贡献可见位置", () => {
    const hiddenRow = row(
      "run-1",
      2,
      withKwargs(msg("req-1", "system", "reminder"), { hide_from_ui: true }),
      0,
    );
    const visibleRow = row("run-1", 5, msg("req-1__user", "human", "q"), 1);

    const visible = buildVisibleHistoryMessages(
      [visibleRow, hiddenRow],
      new Set(),
    );

    expect(visible).toHaveLength(1);
    expect(visible[0]!.type).toBe("human");
    // 最早的**可见**行胜出；seq=2 的隐藏控制副本不许把用户消息往前拽。
    expect(visible[0]!.additional_kwargs?.[MESSAGE_SEQ_KEY]).toBe(5);
  });
});

describe("骨架压过锚点猜测", () => {
  test("实时独有、带 seq 的消息填进窗口内部的空档（1,3,5 + 2,5）", () => {
    const history = [
      msg("h1", "human", "first", 1),
      msg("a1", "ai", "second", 3),
      msg("a2", "ai", "last", 5),
    ];
    const live = [msg("h2", "human", "middle", 2), msg("a2", "ai", "last", 5)];

    expect(seqsOf(mergeMessages(history, live, []))).toEqual([1, 2, 3, 5]);
  });

  test("两边一个身份都不共有时，seq 照样把它们并到一起", () => {
    // 这一条是本仓此前**做不到**的：没有桥接身份，抢救回来的那条只能落到队尾。
    const history = [
      msg("old-1", "human", "old q", 10),
      msg("old-2", "ai", "old a", 11),
    ];
    const live = [
      msg("rescued", "human", "rescued turn", 2),
      msg("tail-step", "ai", "streaming step"),
    ];

    expect(idsOf(mergeMessages(history, live, []))).toEqual([
      "rescued",
      "old-1",
      "old-2",
      "tail-step",
    ]);
  });

  test("既定的 seq 顺序不会被相反的实时顺序翻过来", () => {
    const history = [msg("h1", "human", "q", 1), msg("a1", "ai", "a", 2)];
    const live = [msg("a1", "ai", "a", 2), msg("h1", "human", "q", 1)];

    expect(seqsOf(mergeMessages(history, live, []))).toEqual([1, 2]);
  });

  test("只有隐藏控制副本带 seq 时，它仍然给可见的孪生兄弟定位", () => {
    const hiddenControl = withKwargs(msg("m1", "system", "control", 2), {
      hide_from_ui: true,
    });
    const history = [
      msg("h0", "human", "q", 1),
      hiddenControl,
      msg("a3", "ai", "tail", 3),
    ];
    const live = [msg("m1", "ai", "visible twin")];

    const merged = mergeMessages(history, live, []);

    expect(idsOf(merged)).toEqual(["h0", "m1", "a3"]);
    expect(seqsOf(merged)).toEqual([1, 2, 3]);
    expect(merged[1]!.content).toBe("visible twin");
  });

  test("两段无 seq 的片段夹在已知锚点之间，各自保住段内顺序", () => {
    const history = [msg("h1", "human", "q1", 1), msg("a9", "ai", "a9", 9)];
    const live = [
      msg("h1", "human", "q1"),
      msg("s1", "ai", "step 1"),
      msg("s2", "tool", "step 2"),
      msg("a9", "ai", "a9"),
      msg("s3", "ai", "step 3"),
      msg("s4", "ai", "step 4"),
    ];

    expect(idsOf(mergeMessages(history, live, []))).toEqual([
      "h1",
      "s1",
      "s2",
      "a9",
      "s3",
      "s4",
    ]);
  });

  test("实时独有、有位置的结果，同时锚住它前面那些无位置的步骤", () => {
    const start = msg("start", "human", "start", 1);
    const end = msg("end", "ai", "end", 9);
    const step = msg("step", "ai", "step");
    const result = msg("result", "ai", "result", 3);

    expect(
      idsOf(mergeMessages([start, end], [start, step, result, end], [])),
    ).toEqual(["start", "step", "result", "end"]);
  });
});

describe("内容替换不丢排序元数据", () => {
  test("没有 seq 的实时刷新，保住 seq、run_id 与 turn_duration", () => {
    const history = [
      withKwargs(
        // `run_id` 不在 Message 的声明里，但线路上带着（core/messages/run-duration.ts 同源）。
        { ...msg("h1", "human", "question", 1), run_id: "run-1" } as Message & {
          run_id: string;
        },
        { turn_duration: 42 },
      ),
      msg("a1", "ai", "draft", 2),
    ];
    const live = [msg("h1", "human", "question"), msg("a1", "ai", "final")];

    const merged = mergeMessages(history, live, []);

    expect(idsOf(merged)).toEqual(["h1", "a1"]);
    expect(merged.map((message) => message.content)).toEqual([
      "question",
      "final",
    ]);
    expect(seqsOf(merged)).toEqual([1, 2]);
    expect(getMessageRunId(merged[0]!)).toBe("run-1");
    expect(merged[0]!.additional_kwargs?.turn_duration).toBe(42);
  });

  test("工具结果按 tool_call_id 去重，并留在已知位置上", () => {
    const historyTool = {
      id: "tool-old-row",
      type: "tool",
      content: "partial",
      tool_call_id: "call-1",
      additional_kwargs: { [MESSAGE_SEQ_KEY]: 6 },
    } as Message;
    const liveTool = {
      id: "tool-new-row",
      type: "tool",
      content: "complete",
      tool_call_id: "call-1",
    } as Message;

    const merged = mergeMessages(
      [msg("h1", "human", "q", 5), historyTool],
      [msg("h1", "human", "q"), liveTool],
      [],
    );

    expect(merged).toHaveLength(2);
    const tool = merged.find((message) => message.type === "tool")!;
    expect(tool.content).toBe("complete");
    expect(tool.additional_kwargs?.[MESSAGE_SEQ_KEY]).toBe(6);
  });
});

describe("插位与幂等", () => {
  test("insertByTrustedSeq：位置超过所有已知 seq 的留在队尾", () => {
    const base = [msg("h1", "human", "q", 1), msg("a1", "ai", "a", 2)];
    expect(
      idsOf(insertByTrustedSeq(base, [msg("new", "ai", "late", 9)])),
    ).toEqual(["h1", "a1", "new"]);
    // 没有要插的东西时**原样返回同一个数组**，不制造新引用。
    expect(insertByTrustedSeq(base, [])).toBe(base);
  });

  test("桥接把带 seq 的抢救消息放进已加载窗口内部", () => {
    const history = [msg("h1", "human", "q1", 1), msg("a1", "ai", "a1", 3)];
    const rescued = [msg("mid", "ai", "rescued step", 2)];

    const resolved = resolveTransientHistoryBridge(history, rescued);

    expect(idsOf(resolved)).toEqual(["h1", "mid", "a1"]);
    expect(seqsOf(resolved)).toEqual([1, 2, 3]);
  });

  test("合并是幂等的，并且不在乎重复投递的顺序", () => {
    const history = [
      msg("h1", "human", "q1", 1),
      msg("a1", "ai", "a1", 2),
      msg("h2", "human", "q2", 4),
    ];
    const live = [msg("a2", "ai", "a2 streaming", 5), msg("h2", "human", "q2")];
    const optimistic = [msg("opt-1", "human", "draft")];

    const once = mergeMessages(history, live, optimistic);
    const twice = mergeMessages(once, live, optimistic);
    expect(idsOf(twice)).toEqual(idsOf(once));
    expect(seqsOf(twice)).toEqual(seqsOf(once));

    const reordered = mergeMessages(
      [...history].reverse(),
      [...live].reverse(),
      optimistic,
    );
    expect(idsOf(reordered)).toEqual(idsOf(once));
  });

  test("mergeMessages 不改动它的入参", () => {
    const history = [msg("h1", "human", "q", 1)];
    const live = [msg("h1", "human", "q"), msg("a1", "ai", "a")];
    const historySnapshot = JSON.stringify(history);
    const liveSnapshot = JSON.stringify(live);

    mergeMessages(history, live, []);

    expect(JSON.stringify(history)).toBe(historySnapshot);
    expect(JSON.stringify(live)).toBe(liveSnapshot);
  });
});
