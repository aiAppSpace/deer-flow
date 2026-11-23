/*
  【文件职责】     固定fact 表单、PATCH omitted/显式值与搜索筛选合同。
  【架构位置】     pure view-model test
  【主要导出】     无；Vitest cases
  【依赖关系】     core/memory/view-model
  【边界与注意】   显式 0 不得被 truthy fallback 吞掉；空 memory 与无匹配结果必须区分。
*/

import { describe, expect, it } from "vitest";

import {
  buildMemoryFactCreateInput,
  validateMemoryFactForm,
} from "@/core/memory/view-model";

describe("memory fact form", () => {
  it.each(["", "0", "1", "0.01", "0.99"])(
    "accepts confidence %s",
    (confidence) => {
      expect(
        validateMemoryFactForm({
          content: "fact",
          category: "contract",
          confidence,
        }).ok,
      ).toBe(true);
    },
  );

  it.each(["NaN", "Infinity", "-0.01", "1.01"])(
    "rejects confidence %s",
    (confidence) => {
      expect(
        validateMemoryFactForm({
          content: "fact",
          category: "contract",
          confidence,
        }),
      ).toMatchObject({ ok: false, field: "confidence" });
    },
  );

  it("rejects whitespace-only content", () => {
    expect(
      validateMemoryFactForm({
        content: "   ",
        category: "contract",
        confidence: "0.8",
      }),
    ).toMatchObject({ ok: false, field: "content" });
  });

  it("builds exact create body and preserves explicit zero", () => {
    expect(
      buildMemoryFactCreateInput({
        content: "  explicit zero  ",
        category: "  contract  ",
        confidence: "0",
      }),
    ).toEqual({
      content: "explicit zero",
      category: "contract",
      confidence: 0,
    });
  });
});
