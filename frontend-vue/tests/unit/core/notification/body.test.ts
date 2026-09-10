/*
  【文件职责】     钉住通知正文的三条：兜底、截断阈值、按码点切。
  【架构位置】     单元测试
  【依赖关系】     app/core/notification/body.ts
  【边界与注意】   前两条对着上游 `chat-page.tsx:152` 那三行的行为；第三条是本仓
                   **有意改掉**上游的地方：`substring(0, 200)` 按 UTF-16 码元切，
                   正好切在代理对中间就留下一个孤立代理。所以这里必须有一条用真
                   emoji 打的用例，否则"按码点切"只是注释里的说法。
*/

import { describe, expect, it } from "vitest";

import {
  NOTIFICATION_BODY_LIMIT,
  notificationBody,
} from "@/core/notification/body";

const FALLBACK = "Conversation finished";

describe("通知正文", () => {
  it("没取到文本就用兜底文案", () => {
    expect(notificationBody("", FALLBACK)).toBe(FALLBACK);
    expect(notificationBody(null, FALLBACK)).toBe(FALLBACK);
    expect(notificationBody(undefined, FALLBACK)).toBe(FALLBACK);
  });

  it("不超阈值就原样给出，一个字符都不动", () => {
    const text = "a".repeat(NOTIFICATION_BODY_LIMIT);
    expect(notificationBody(text, FALLBACK)).toBe(text);
  });

  it("超一个字符就截断，并接上游那三个点", () => {
    const text = "a".repeat(NOTIFICATION_BODY_LIMIT + 1);
    expect(notificationBody(text, FALLBACK)).toBe(
      "a".repeat(NOTIFICATION_BODY_LIMIT) + "...",
    );
  });

  it("按码点切，不把代理对切成两半", () => {
    // 🙂 是一个码点、两个 UTF-16 码元。限长 2 时：
    // 上游的 substring(0, 2) 会切出 "a" + 半个 emoji（孤立代理，显示成 �）。
    const text = "a🙂b";
    const cut = notificationBody(text, FALLBACK, 2);

    expect(cut).toBe("a🙂...");
    expect(
      [...cut].every((char) => {
        const code = char.codePointAt(0)!;
        return code < 0xd800 || code > 0xdfff;
      }),
      "结果里不许有孤立代理",
    ).toBe(true);
  });

  it("阈值按码点数算，不按码元数", () => {
    // 3 个 emoji = 3 码点 / 6 码元。限长 3 时不该被截。
    expect(notificationBody("🙂🙂🙂", FALLBACK, 3)).toBe("🙂🙂🙂");
    expect(notificationBody("🙂🙂🙂🙂", FALLBACK, 3)).toBe("🙂🙂🙂...");
  });

  it("阈值就是上游那个 200", () => {
    expect(NOTIFICATION_BODY_LIMIT).toBe(200);
  });
});
