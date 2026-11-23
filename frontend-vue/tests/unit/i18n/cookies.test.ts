/*
  【文件职责】     locale cookie 的解析与序列化（05 N4）。
  【架构位置】     L3 测试
  【主要导出】     无
  【依赖关系】     app/core/i18n/cookies.ts
  【边界与注意】   cookie 值是**不可信输入**：任何字符串都可能出现在里面。
                   这里穷举的三类恶意/畸形值，每一类在上游都会导致不同的失败：
                   非法 locale 会让词典查表拿到 undefined（整页空白）、
                   坏的百分号编码会让 `decodeURIComponent` 抛（plugin 初始化失败，
                   应用打不开）、同名前缀（`localex=`）会被朴素的 `startsWith` 误匹配。
*/

import { describe, expect, it } from "vitest";

import {
  LOCALE_COOKIE_MAX_AGE_SECONDS,
  LOCALE_COOKIE_NAME,
  parseLocaleCookie,
  serializeLocaleCookie,
} from "@/core/i18n/cookies";

describe("parseLocaleCookie", () => {
  it("取出合法 locale", () => {
    expect(parseLocaleCookie("locale=zh-CN")).toBe("zh-CN");
    expect(parseLocaleCookie("a=1; locale=en-US; b=2")).toBe("en-US");
  });

  it("不被同名前缀误匹配", () => {
    expect(parseLocaleCookie("localex=zh-CN")).toBeNull();
    expect(parseLocaleCookie("mylocale=zh-CN")).toBeNull();
  });

  it("非法 locale 一律 null，不透传给词典查表", () => {
    expect(parseLocaleCookie("locale=fr-FR")).toBeNull();
    expect(parseLocaleCookie("locale=")).toBeNull();
    expect(parseLocaleCookie("locale=<script>")).toBeNull();
  });

  it("坏的百分号编码返回 null 而不是抛", () => {
    // 一个坏 cookie 不该让整个应用打不开。
    expect(parseLocaleCookie("locale=%E0%A4%A")).toBeNull();
    expect(parseLocaleCookie("locale=%")).toBeNull();
  });

  it("没有 locale 这一项时返回 null", () => {
    expect(parseLocaleCookie("")).toBeNull();
    expect(parseLocaleCookie("theme=dark")).toBeNull();
  });
});

describe("serializeLocaleCookie", () => {
  it("与上游逐字一致的持久化格式（改了会让老用户丢语言偏好）", () => {
    expect(serializeLocaleCookie("zh-CN")).toBe(
      `${LOCALE_COOKIE_NAME}=zh-CN; max-age=${LOCALE_COOKIE_MAX_AGE_SECONDS}; path=/; SameSite=Lax`,
    );
    expect(LOCALE_COOKIE_NAME).toBe("locale");
    expect(LOCALE_COOKIE_MAX_AGE_SECONDS).toBe(365 * 24 * 60 * 60);
  });

  it("写出去的值能被自己读回来", () => {
    for (const locale of ["en-US", "zh-CN"] as const) {
      expect(parseLocaleCookie(serializeLocaleCookie(locale))).toBe(locale);
    }
  });
});
