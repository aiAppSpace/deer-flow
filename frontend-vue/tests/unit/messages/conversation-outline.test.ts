/*
  【文件职责】     固定会话目录的分章与标题规整。
  【架构位置】     测试
  【依赖关系】     app/core/messages/conversation-outline.ts
  【边界与注意】   守两件容易做错的事：**一章 = 一次提问**（助手回复不成章，
                   否则条目翻倍而定位更难），以及**按字符截断**——按 UTF-16 码元
                   切会把一个中文或 emoji 切成两半，显示出来是乱码方块。
*/

import { describe, expect, it } from "vitest";

import {
  buildConversationChapters,
  CONVERSATION_CHAPTER_TITLE_MAX_LENGTH,
  CONVERSATION_OUTLINE_MIN_TURNS,
} from "@/core/messages/conversation-outline";
import { getMessageGroups } from "@/core/messages/utils";
import type { Message } from "@/core/types/message";

function message(
  type: string,
  id: string | undefined,
  content: unknown,
): Message {
  return { type, id, content } as unknown as Message;
}

describe("会话目录", () => {
  it("每一次提问一章，助手那些组不成章", () => {
    const groups = getMessageGroups([
      message("human", "human-1", "First question"),
      message("ai", "assistant-1", "First answer"),
      message("human", "human-2", "Second question"),
      {
        ...message("ai", "tool-call", ""),
        tool_calls: [{ id: "call-1", name: "bash", args: {} }],
      } as unknown as Message,
      {
        ...message("tool", "tool-result", "done"),
        tool_call_id: "call-1",
      } as unknown as Message,
      message("ai", "assistant-2", "Second answer"),
    ]);
    expect(buildConversationChapters(groups, "Attachment")).toEqual([
      { id: "human-1", groupIndex: 0, title: "First question" },
      { id: "human-2", groupIndex: 2, title: "Second question" },
    ]);
  });

  it("空白归一，并剥掉上传附件的那段标记", () => {
    const groups = getMessageGroups([
      message("human", "human-1", "  First line\n\n  second\tline  "),
      message(
        "human",
        "human-2",
        "<uploaded_files>\n- report.pdf\n</uploaded_files>\n\nSummarize the report",
      ),
    ]);
    expect(
      buildConversationChapters(groups, "Attachment").map((c) => c.title),
    ).toEqual(["First line second line", "Summarize the report"]);
  });

  it("只有附件、没有文字的那一轮用兜底标题", () => {
    // 否则目录里出现一条没名字的空条目，点它才知道是什么。
    const groups = getMessageGroups([
      message("human", "human-image", [
        { type: "image_url", image_url: { url: "data:image/png;base64,x" } },
      ]),
    ]);
    expect(buildConversationChapters(groups, "图片或文件消息")[0]?.title).toBe(
      "图片或文件消息",
    );
  });

  it("按字符截断，不把 emoji 切成两半", () => {
    const content = `${"问".repeat(CONVERSATION_CHAPTER_TITLE_MAX_LENGTH - 1)}😀结尾`;
    const groups = getMessageGroups([message("human", "human-long", content)]);
    const title =
      buildConversationChapters(groups, "Attachment")[0]?.title ?? "";
    expect([...title]).toHaveLength(CONVERSATION_CHAPTER_TITLE_MAX_LENGTH + 1);
    /*
      **要断言那个 emoji 是完整的**，不能只数字符数。按 UTF-16 码元切会留下一个
      孤立的高位代理——它在 `[...title]` 里照样算一个字符，也不是 U+FFFD，
      于是「数字符数」和「不含 �」两条都测不出来。渲染出来才是一个乱码方块。
    */
    expect(title.endsWith("😀…")).toBe(true);
    expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(title)).toBe(false);
  });

  it("正好等于上限时不截断，也不加省略号", () => {
    const content = "问".repeat(CONVERSATION_CHAPTER_TITLE_MAX_LENGTH);
    const groups = getMessageGroups([message("human", "h", content)]);
    expect(buildConversationChapters(groups, "A")[0]?.title).toBe(content);
  });

  it("没有 id 时用位置兜底，但那是最后一档", () => {
    const groups = getMessageGroups([
      message("human", undefined, "Question"),
      message("ai", undefined, "Answer"),
    ]);
    expect(buildConversationChapters(groups, "Attachment")[0]?.id).toBe(
      "human-turn:0",
    );
  });

  it("门槛是 5 轮", () => {
    expect(CONVERSATION_OUTLINE_MIN_TURNS).toBe(5);
  });
});
