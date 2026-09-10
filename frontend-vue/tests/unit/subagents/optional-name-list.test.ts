/*
  【文件职责】     固定「全部 / 一个都不给 / 指定几个」这个三态的往返。
  【架构位置】     测试
  【依赖关系】     app/core/subagents/optional-name-list.ts
  【边界与注意】   守的是 `null` 与 `[]` **不是一回事**：前者是「全都给」，
                   后者是「一个都不给」。混成同一个空值，一个本该能用全部工具的
                   subagent 会变成什么都做不了，而界面上看不出区别。
*/

import { describe, expect, it } from "vitest";

import {
  allowedSubagentsToMode,
  isValidManagedSubagentName,
  modeToAllowedSubagents,
  optionalNameListFromDraft,
  optionalNameListToDraft,
  positiveInteger,
} from "@/core/subagents";

describe("三态往返", () => {
  it.each([
    [null, "all", ""],
    [[], "none", ""],
    [["read", "write"], "selected", "read, write"],
  ])("%j → %s", (value, mode, text) => {
    expect(optionalNameListToDraft(value as string[] | null)).toEqual({
      mode,
      text,
    });
  });

  it("回到 API 形状时 null 和 [] 各归各位", () => {
    expect(optionalNameListFromDraft("all", "anything")).toBeNull();
    expect(optionalNameListFromDraft("none", "anything")).toEqual([]);
  });

  it("selected 模式去重、去空白", () => {
    expect(
      optionalNameListFromDraft("selected", " read , write ,, read ,"),
    ).toEqual(["read", "write"]);
  });

  it("selected 但一个名字都没写，得到的是空数组而不是 null", () => {
    // 空数组 = 一个都不给。回落成 null（全都给）会**放大**权限。
    expect(optionalNameListFromDraft("selected", "   ")).toEqual([]);
  });

  it("往返之后还是原来那个意思", () => {
    for (const original of [null, [], ["a"], ["a", "b"]]) {
      const draft = optionalNameListToDraft(original as string[] | null);
      expect(
        optionalNameListFromDraft(draft.mode, draft.text),
        JSON.stringify(original),
      ).toEqual(original);
    }
  });
});

describe("agent 的 subagent 访问三态（同一个语义，载荷是数组）", () => {
  it.each([
    [null, "all"],
    [undefined, "all"],
    [[], "none"],
    [["research"], "selected"],
  ])("%j → %s", (value, mode) => {
    expect(allowedSubagentsToMode(value as string[] | null)).toBe(mode);
  });

  it("回到 API 形状时忽略 all/none 下残留的勾选", () => {
    expect(modeToAllowedSubagents("all", ["stale"])).toBeNull();
    expect(modeToAllowedSubagents("none", ["stale"])).toEqual([]);
    expect(modeToAllowedSubagents("selected", ["a", "b"])).toEqual(["a", "b"]);
  });
});

describe("表单里的数字与名字", () => {
  it.each([
    ["1", 1],
    ["50", 50],
    ["0", null],
    ["-1", null],
    ["1.5", null],
    ["", null],
    ["abc", null],
    [" 3 ", 3],
  ])("positiveInteger(%j) === %j", (input, expected) => {
    expect(positiveInteger(input)).toBe(expected);
  });

  it.each([
    ["research-agent", true],
    ["Research1", true],
    [" spaced ", true],
    ["with space", false],
    ["with_underscore", false],
    ["with/slash", false],
    ["", false],
    ["中文", false],
  ])("isValidManagedSubagentName(%j) === %j", (input, expected) => {
    // 名字要进 URL 路径段：放宽这条不会在前端出错，而是让请求打到一个怪路径上。
    expect(isValidManagedSubagentName(input)).toBe(expected);
  });
});
