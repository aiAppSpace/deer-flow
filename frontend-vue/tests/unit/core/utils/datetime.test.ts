/*
  【文件职责】     钉住相对时间的措辞与两条边界（非法时间、locale）。
  【架构位置】     L3 测试
  【依赖关系】     core/utils/datetime
  【边界与注意】   措辞必须与 React 的 formatTimeAgo 逐字相同，所以断言的是**整句**
                   而不是「包含某个数字」——差一个 about 就是两个应用念的不是同一句话。
*/

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { formatTimeAgo } from "@/core/utils/datetime";

describe("formatTimeAgo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-02T00:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses the date-fns wording React ships, in both locales", () => {
    expect(formatTimeAgo("2026-08-01T00:00:00Z", "en-US")).toBe(
      "about 1 month ago",
    );
    expect(formatTimeAgo("2026-08-01T00:00:00Z", "zh-CN")).toBe(
      "大约 1 个月前",
    );
    expect(formatTimeAgo("2026-06-01T00:00:00Z", "en-US")).toBe("3 months ago");
  });

  /*
    `locale` 是**必填**的（类型上是 `string | undefined`，位置上不许省）。
    上游那份可选，因为它自己会 `getLocaleFromCookie() ?? detectLocale()` 兜底；
    本仓不能照抄——`detectLocale()` 读 navigator，Nuxt 服务端渲染时读不到，
    同一次调用会在两端给出不同的话。既然不能兜底就不能让人漏传。

    下面这两个 `undefined` 是**显式写出来的**：它证明的是「显式表示没有 locale
    时落回 en-US」，而不是「省略参数时落回 en-US」——后者已经编不过了。
  */
  it("falls back to en-US for an unknown locale, and for an explicit undefined", () => {
    expect(formatTimeAgo("2026-08-01T00:00:00Z", "fr-FR")).toBe(
      "about 1 month ago",
    );
    expect(formatTimeAgo("2026-08-01T00:00:00Z", undefined)).toBe(
      "about 1 month ago",
    );
  });

  /*
    后端可能给出空的 lastUpdated，`new Date("")` 会让 date-fns 抛 Invalid time value。
    这里返回中性占位而不是抛——与 React 一致。缺失时间要不要整块不渲染，是
    threads/updated-time 那一层的判断，不是这里的。
  */
  it("returns a neutral placeholder for empty and unparseable input", () => {
    for (const value of ["", "   ", "not-a-date", null, undefined]) {
      expect(formatTimeAgo(value, "en-US")).toBe("-");
    }
  });

  it("accepts a Date and a numeric timestamp", () => {
    expect(formatTimeAgo(new Date("2026-08-01T00:00:00Z"), "en-US")).toBe(
      "about 1 month ago",
    );
    expect(formatTimeAgo(Date.parse("2026-08-01T00:00:00Z"), "en-US")).toBe(
      "about 1 month ago",
    );
  });
});
