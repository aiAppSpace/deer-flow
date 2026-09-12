/*
  【文件职责】     钉住 `AgentMessageContent` 的联合语义：string 与 AgentContentPart[] 两侧都必须无损往返。
  【架构位置】     门禁测试
  【主要导出】     无
  【依赖关系】     app/core/types/message.ts；tests/fixtures/message-content-shapes.json
  【边界与注意】   关键失效方式是**把 content 塌成 string**。
                   实测这个失效**只有一半会被编译器拦住**：

                     - `message.content.map(…)`（extractTextFromMessage 那类）会红，
                       因为 `typeof === "string"` 之后剩下 `never`，`.map` 不存在。
                     - `message.content[0]` + `"thinking" in part`
                       （extractReasoningContentFromMessage 那类）**编得过**——
                       string 的 index 访问返回 string，分支变成死代码，
                       reasoning 从此恒为 null。没有任何红。

                   所以「能编译」不是证据，本文件才是。夹具取自真实 thread：
                   516 条消息里 22 条是数组内容，而且**全部 22 条都是 human 消息**——
                   塌成 string 会 100% 破坏用户自己发的消息，不是边角情况。

                   夹具数据源在 `frontend/` 工作区，不进入 Vue 运行时依赖；更新时必须
                   重新验证 string 与数组内容两侧都存在且能无损往返。
*/

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

import type {
  AgentContentPart,
  AgentMessageContent,
  Message,
} from "@/core/types/message";

const fixture = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL("../fixtures/message-content-shapes.json", import.meta.url),
    ),
    "utf8",
  ),
) as {
  sourceMessages: number;
  arrayContent: {
    source_thread: string;
    type: string;
    id: string;
    content: unknown;
  }[];
  stringContent: {
    source_thread: string;
    type: string;
    id: string;
    content: unknown;
  }[];
};

// ---------------------------------------------------------------------------
// 类型层：联合的两侧都必须存在，且不能互相塌陷
// ---------------------------------------------------------------------------

describe("AgentMessageContent 的联合两侧", () => {
  test("string 与 AgentContentPart[] 都可以赋给 AgentMessageContent", () => {
    const asString: AgentMessageContent = "hello";
    const asParts: AgentMessageContent = [{ type: "text", text: "hello" }];
    expect(typeof asString).toBe("string");
    expect(Array.isArray(asParts)).toBe(true);
  });

  /*
    「不能整体赋给 string」这类**类型层**断言不放在这里，护栏在
    `app/core/types/message.contract.ts`（骑 typecheck 预算门禁）。

    **原来的理由「tests/ 不过 vue-tsc，写在这里的 @ts-expect-error 是空操作」
    从 2026-09-11 起是假的**：`make typecheck-tests` 已经接进 `make verify`。
    现在写在这里也会被查——只是护栏没必要搬家，两条命令都跑。
    （第十六轮核对；门禁 tests/guards/stale-coverage-claims.test.ts。）
  */

  test("AgentContentPart 保留协议未知字段（index signature 不是装饰）", () => {
    const part: AgentContentPart = {
      type: "thinking",
      thinking: "内部推理",
      signature: "abc",
    };
    expect(part.thinking).toBe("内部推理");
  });
});

// ---------------------------------------------------------------------------
// 运行时：真实夹具双向往返
// ---------------------------------------------------------------------------

/** 往返：wire JSON → 类型化 Message → wire JSON。类型不该逼任何一步做有损变换。 */
function roundTrip(wire: unknown): unknown {
  const typed = wire as Message;
  const content: AgentMessageContent = typed.content;
  const back: Message =
    typeof content === "string"
      ? { ...typed, content }
      : { ...typed, content: content.map((part) => ({ ...part })) };
  return JSON.parse(JSON.stringify(back));
}

describe("真实 thread 夹具往返", () => {
  test("夹具确实覆盖两侧，且数组侧不是空样本", () => {
    expect(fixture.sourceMessages).toBe(516);
    expect(fixture.arrayContent).toHaveLength(22);
    expect(fixture.stringContent.length).toBeGreaterThan(0);
    // 全部数组内容都来自 human 消息——这正是塌陷的破坏面。
    expect([...new Set(fixture.arrayContent.map((m) => m.type))]).toEqual([
      "human",
    ]);
  });

  test("数组内容原样往返，不被 join 成字符串", () => {
    for (const message of fixture.arrayContent) {
      const back = roundTrip(message) as { content: unknown };
      expect(Array.isArray(back.content)).toBe(true);
      expect(back.content).toEqual(message.content);
    }
  });

  test("字符串内容原样往返，不被包成单元素数组", () => {
    for (const message of fixture.stringContent) {
      const back = roundTrip(message) as { content: unknown };
      expect(typeof back.content).toBe("string");
      expect(back.content).toEqual(message.content);
    }
  });
});

// ---------------------------------------------------------------------------
// 运行时：夹具里没有、但协议允许的 part 形状
// ---------------------------------------------------------------------------

describe("夹具未覆盖的 part 形状", () => {
  // demo thread 里只有 text part。image_url / thinking / 未知 type 是协议允许
  // 且上游代码明确读取的形状（messages/utils.ts 读 image_url 与 "thinking" in part），
  // 夹具里恰好没有，所以在这里合成，避免「夹具没覆盖 = 没人守」。
  const exotic: AgentContentPart[] = [
    { type: "text", text: "见图" },
    { type: "image_url", image_url: "https://example.test/a.png" },
    {
      type: "image_url",
      image_url: { url: "https://example.test/b.png", detail: "high" },
    },
    { type: "thinking", thinking: "推理片段", signature: "sig-1" },
    { type: "vendor_custom", payload: { nested: [1, 2, 3] }, flag: false },
  ];

  test("五种 part 全部原样往返，未知字段不丢", () => {
    const message = { type: "ai", id: "m-1", content: exotic };
    const back = roundTrip(message) as { content: AgentContentPart[] };
    expect(back.content).toEqual(exotic);
    expect(back.content[3]!.signature).toBe("sig-1");
    expect(back.content[4]!.payload).toEqual({ nested: [1, 2, 3] });
  });

  test("image_url 的两种形状都在类型内，不需要强转", () => {
    const asString: AgentContentPart = {
      type: "image_url",
      image_url: "https://example.test/a.png",
    };
    const asObject: AgentContentPart = {
      type: "image_url",
      image_url: { url: "https://example.test/b.png" },
    };
    expect(typeof asString.image_url).toBe("string");
    expect(typeof asObject.image_url).toBe("object");
  });
});
