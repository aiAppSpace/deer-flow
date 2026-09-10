/*
  【文件职责】     08 §111 点名的 round-trip 测试：text / image / tool-call 内容不会丢失。
  【架构位置】     L3 测试
  【主要导出】     无
  【依赖关系】     app/core/agent-deerflow/message-adapt.ts
                   public/demo/threads 下的 13 个 thread.json（516 条）
                   tests/fixtures/streams/deerflow-create.sse（golden trace）
  【边界与注意】   **这份测试与 tests/guards/message-content-contract.test.ts 不能互相顶替。**
                   后者是**类型层**护栏，钉的是 `AgentMessageContent` 联合本身
                   （塌成 string 会不会被编译器发现）；本文件钉的是**适配器**——
                   联合类型好好的，适配器照样可以把数组内容读丢。M1 evidence 记过
                   一次实测结论：`content[0]` + `"thinking" in part` 这类写法在
                   content 塌成 string 之后**编得过**，分支变死代码。

                   夹具直接读本仓 `public/demo/`，与 Showcase 页面消费的是同一份数据，
                   所以断言的是真实产品输入而不是另抄一份会过期的样本。
                   而不是安静地跑 0 条断言全绿。

                   流式那一半用的是 M0 真实录制（golden trace）而不是手写载荷。
                   录制里 9 个 `messages` 帧有 6 个是 `AIMessageChunk`，
                   其中两帧带 `tool_call_chunks`——工具调用碎片是**有真实佐证**的，
                   不是合成出来的。
*/

import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  accumulateStreamedMessage,
  mergeToolCallFragments,
  toAgentMessage,
  toRenderableMessage,
  toWireMessage,
} from "@/core/agent-deerflow/message-adapt";
import type { WireMessageLike } from "@/core/agent-deerflow/message-adapt";
import type { AgentContentPart, Message } from "@/core/types/message";

const THREADS_DIR = fileURLToPath(
  new URL("../../../public/demo/threads/", import.meta.url),
);

const GOLDEN_TRACE = fileURLToPath(
  new URL("../../fixtures/streams/deerflow-create.sse", import.meta.url),
);

interface DemoThread {
  values?: { messages?: Message[] };
}

function loadDemoThreads(): { id: string; messages: Message[] }[] {
  return readdirSync(THREADS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .map((id) => {
      const thread = JSON.parse(
        readFileSync(`${THREADS_DIR}${id}/thread.json`, "utf8"),
      ) as DemoThread;
      return { id, messages: thread.values?.messages ?? [] };
    });
}

const threads = loadDemoThreads();
const allMessages = threads.flatMap((thread) => thread.messages);

/** golden trace 里的 `messages` 帧（messages-tuple 模式的 `[chunk, metadata]`）。 */
function goldenMessageChunks(): WireMessageLike[] {
  const raw = readFileSync(GOLDEN_TRACE, "utf8");
  const chunks: WireMessageLike[] = [];
  for (const block of raw.split(/\r?\n\r?\n/)) {
    const name = /^event: (.*)$/m.exec(block)?.[1];
    const data = /^data: (.*)$/m.exec(block)?.[1];
    if (name !== "messages" || !data) continue;
    const [message] = JSON.parse(data) as [WireMessageLike, unknown];
    chunks.push(message);
  }
  return chunks;
}

describe("13 个 checkpoint 夹具（08 §测试资产 第 1 类）", () => {
  it("读到 13 个 thread 与 516 条消息（读空必须红，不能安静地零断言全绿）", () => {
    expect(threads).toHaveLength(13);
    expect(allMessages).toHaveLength(516);
  });

  it("每条消息都能原样往返（08 §111）", () => {
    const broken = allMessages.filter((message) => {
      const restored = toWireMessage(toAgentMessage(message));
      return (
        JSON.stringify(sortKeys(restored)) !== JSON.stringify(sortKeys(message))
      );
    });
    expect(broken).toEqual([]);
  });

  it("数组内容不会被 join 成字符串（22 条，全部是 human）", () => {
    const arrayContent = allMessages.filter((message) =>
      Array.isArray(message.content),
    );
    expect(arrayContent).toHaveLength(22);
    expect(new Set(arrayContent.map((message) => message.type))).toEqual(
      new Set(["human"]),
    );

    for (const message of arrayContent) {
      const agent = toAgentMessage(message);
      expect(Array.isArray(agent.content)).toBe(true);
      expect(agent.content).toEqual(message.content);
      // 浅拷一层：内核改自己的数组不能改到 wire 对象。
      expect(agent.content).not.toBe(message.content);
      const parts = agent.content as AgentContentPart[];
      expect(parts.every((part) => typeof part.type === "string")).toBe(true);
    }
  });

  it("工具调用的 name / args / id 一个不丢（230 个）", () => {
    let seen = 0;
    for (const message of allMessages) {
      const wireCalls = (message as { tool_calls?: { id?: string }[] })
        .tool_calls;
      if (!wireCalls?.length) continue;
      const agent = toAgentMessage(message);
      expect(agent.toolCalls).toHaveLength(wireCalls.length);
      wireCalls.forEach((call, index) => {
        seen += 1;
        const adapted = agent.toolCalls?.[index];
        expect(adapted?.id).toBe(call.id);
        expect(adapted?.name).toBe((call as unknown as { name: string }).name);
        expect(adapted?.args).toEqual(
          (call as unknown as { args: unknown }).args,
        );
      });
    }
    expect(seen).toBe(230);
  });

  it("reasoning 被搬出 additional_kwargs 而不是复制（203 条）", () => {
    const withReasoning = allMessages.filter(
      (message) =>
        typeof (
          message.additional_kwargs as
            { reasoning_content?: unknown } | undefined
        )?.reasoning_content === "string",
    );
    expect(withReasoning).toHaveLength(203);

    for (const message of withReasoning) {
      const agent = toAgentMessage(message);
      expect(agent.reasoning).toBe(
        (message.additional_kwargs as { reasoning_content: string })
          .reasoning_content,
      );
      // 留在 meta 里会在流式追加 reasoningChunks 之后变成对不上的旧值。
      expect(
        (agent.meta?.additional_kwargs as Record<string, unknown>)
          .reasoning_content,
      ).toBeUndefined();
    }
  });

  it("协议字段的落点是 meta，内核不解释它们（08 §111）", () => {
    const message = allMessages.find(
      (candidate) => candidate.type === "ai",
    ) as Message;
    const agent = toAgentMessage(message);
    expect(agent.meta).toBeDefined();
    expect(agent.meta?.type).toBe("ai");
    expect(agent.meta?.response_metadata).toEqual(message.response_metadata);
    // 内核的 role 是派生值；回程认的是 meta.type。
    expect(agent.role).toBe("assistant");
  });
});

describe("后端加字段时不能丢", () => {
  it("未知顶层字段原样往返", () => {
    const wire = {
      id: "m-1",
      type: "ai",
      content: "hi",
      brand_new_field: { nested: [1, 2, 3] },
    } as unknown as Message;
    expect(toWireMessage(toAgentMessage(wire))).toEqual(wire);
  });

  it("未知 type 归到 system 而不是 assistant，且原名留在 meta", () => {
    const wire = {
      id: "m-2",
      type: "ProbeMessage",
      content: "x",
    } as unknown as Message;
    const agent = toAgentMessage(wire);
    expect(agent.role).toBe("system");
    expect(agent.meta?.type).toBe("ProbeMessage");
    expect(toWireMessage(agent)).toEqual(wire);
  });

  it("没有 id 的 wire 消息拿 fallback id，且这一步是单向的", () => {
    const wire = { type: "ai", content: "x" } as unknown as Message;
    const agent = toAgentMessage(wire, "generated-1");
    expect(agent.id).toBe("generated-1");
    expect(toWireMessage(agent)).toEqual({
      type: "ai",
      content: "x",
      id: "generated-1",
    });
  });
});

describe("messages-tuple 流式分片（golden trace，第 2 类证据）", () => {
  const chunks = goldenMessageChunks();

  it("录制里确实有 AIMessageChunk 与 tool_call_chunks", () => {
    expect(chunks).toHaveLength(9);
    expect(
      chunks.filter((chunk) => chunk.type === "AIMessageChunk"),
    ).toHaveLength(6);
    expect(
      chunks.filter(
        (chunk) => (chunk.tool_call_chunks as unknown[] | undefined)?.length,
      ),
    ).toHaveLength(2);
  });

  it("累积后的 chunk 类名只在 adapter 出口收敛一次", () => {
    const chunk = {
      id: "chunk-1",
      type: "AIMessageChunk",
      content: "streamed",
      response_metadata: { provider: "fixture" },
    } as unknown as Message;
    expect(toRenderableMessage(chunk)).toEqual({
      ...chunk,
      type: "ai",
    });
    expect(chunk.type).toBe("AIMessageChunk");
    expect(
      toRenderableMessage({ type: "human", content: "done" } as Message),
    ).toEqual({ type: "human", content: "done" });
  });

  it("分片的 args 原文进 argsChunks，成品 args 不被覆盖", () => {
    const withParsed = chunks.find(
      (chunk) =>
        (chunk.tool_calls as unknown[] | undefined)?.length &&
        (chunk.tool_call_chunks as unknown[] | undefined)?.length,
    );
    expect(withParsed).toBeDefined();

    const agent = toAgentMessage(withParsed!);
    const call = agent.toolCalls?.[0];
    expect(call?.name).toBe("read_file");
    // 成品 args 是后端解析过的对象，保持原样。
    expect(call?.args).toEqual(
      (withParsed as unknown as { tool_calls: { args: unknown }[] })
        .tool_calls[0]!.args,
    );
    // 原文同时留着：解析失败时它是唯一还原现场的东西。
    expect(call?.argsChunks?.join("")).toContain('"path"');
    expect(call?.argsParseFailed).toBeUndefined();
  });

  it("只有分片、没有成品时，args 由分片拼出来", () => {
    const chunkOnly = chunks.find(
      (chunk) =>
        !(chunk.tool_calls as unknown[] | undefined)?.length &&
        (chunk.tool_call_chunks as unknown[] | undefined)?.length,
    );
    expect(chunkOnly).toBeDefined();

    const call = toAgentMessage(chunkOnly as WireMessageLike).toolCalls?.[0];
    expect(call?.name).toBe("write_file");
    expect(call?.args).toEqual({
      description: "Create the requested output file with exact content",
      path: "/mnt/user-data/outputs/note.txt",
      content: "hi from replay.",
    });
  });

  it("`__user` 后缀是真实存在的 id 重写：同一条 human 在两种模式下 id 不同", () => {
    const human = chunks.find((chunk) => chunk.type === "human");
    expect(human?.id).toMatch(/__user$/);
  });
});

describe("mergeToolCallFragments 的分片归并", () => {
  it("后续分片没有 id 时按 index 归并，不拆成多个调用", () => {
    const merged = mergeToolCallFragments(undefined, [
      { id: "call_1", index: 0, name: "search", args: '{"q":' },
      { index: 0, args: '"deer' },
      { index: 0, args: 'flow"}' },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged?.[0]?.id).toBe("call_1");
    expect(merged?.[0]?.args).toEqual({ q: "deerflow" });
    expect(merged?.[0]?.argsChunks).toEqual(['{"q":', '"deer', 'flow"}']);
  });

  it("分片被截断时标记 argsParseFailed 而不是抛错", () => {
    const merged = mergeToolCallFragments(undefined, [
      { id: "call_2", name: "search", args: '{"q": "half' },
    ]);
    expect(merged?.[0]?.argsParseFailed).toBe(true);
    expect(merged?.[0]?.args).toBeUndefined();
    expect(merged?.[0]?.argsChunks).toEqual(['{"q": "half']);
  });

  it("两侧都没有时返回 undefined（不是空数组）", () => {
    expect(mergeToolCallFragments(undefined, undefined)).toBeUndefined();
    // 空的 tool_calls 是**有意义的**：ai 消息里 `tool_calls: []` 必须原样回去。
    expect(mergeToolCallFragments([], undefined)).toEqual([]);
  });
});

describe("跨帧工具参数归并", () => {
  it("后续 args chunk 拼完整后替换首帧的 partial 成品 args", () => {
    const first = accumulateStreamedMessage(undefined, {
      type: "AIMessageChunk",
      id: "ai-1",
      content: "",
      tool_calls: [
        {
          id: "call-1",
          name: "write_file",
          args: { path: "/report.md", content: "Hello " },
        },
      ],
      tool_call_chunks: [
        {
          id: "call-1",
          index: 0,
          name: "write_file",
          args: '{"path":"/report.md","content":"Hello ',
        },
      ],
    } as WireMessageLike);
    const settled = accumulateStreamedMessage(first, {
      type: "AIMessageChunk",
      id: "ai-1",
      content: "",
      tool_calls: [],
      tool_call_chunks: [{ index: 0, args: 'world"}' }],
    } as WireMessageLike);

    expect(settled.toolCalls?.[0]?.args).toEqual({
      path: "/report.md",
      content: "Hello world",
    });
  });
});

/** 只为让 round-trip 的失败输出可读；`toEqual` 本身不关心键顺序。 */
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (typeof value !== "object" || value === null) return value;
  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(record)
      .sort()
      .map((key) => [key, sortKeys(record[key])]),
  );
}
