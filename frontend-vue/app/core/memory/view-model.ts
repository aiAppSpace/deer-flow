/*
  【文件职责】     Memory fact 表单校验、提交输入和正文截断。
  【架构位置】     L3 framework-neutral Memory view model
  【主要导出】     validateMemoryFactForm · buildMemoryFactCreateInput · truncateMemoryFact
  【依赖关系】     memory types
  【边界与注意】   confidence 为有限 0..1；完整 PATCH payload 由实际表单提交方构造。
*/

import type { MemoryFactInput } from "./types";

export type MemoryViewFilter = "all" | "facts" | "summaries";

export interface MemoryFactForm {
  content: string;
  category: string;
  confidence: string | number;
}

export type MemoryFactFormValidation =
  | { ok: true; value: MemoryFactInput }
  | { ok: false; field: "content" | "confidence" };

export function validateMemoryFactForm(
  form: MemoryFactForm,
): MemoryFactFormValidation {
  const content = form.content.trim();
  if (!content) return { ok: false, field: "content" };
  const confidence = Number(form.confidence);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    return { ok: false, field: "confidence" };
  }
  return {
    ok: true,
    value: {
      content,
      category: form.category.trim() || "context",
      confidence,
    },
  };
}

export function buildMemoryFactCreateInput(form: MemoryFactForm) {
  const result = validateMemoryFactForm(form);
  if (!result.ok) throw new Error(result.field);
  return result.value;
}

export function truncateMemoryFact(content: string, maxLength = 140) {
  const normalized = content.replaceAll(/\s+/g, " ").trim();
  return normalized.length <= maxLength
    ? normalized
    : `${normalized.slice(0, Math.max(0, maxLength - 3))}...`;
}
