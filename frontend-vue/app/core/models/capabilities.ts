/*
  【文件职责】     解析 composer 默认模型并按模型能力规范化运行上下文。
  【架构位置】     L3 模型/提交协议适配
  【主要导出】     resolveComposerModel · normalizeComposerContext
  【依赖关系】     models/types
  【边界与注意】   UI 可见能力仍由模型元数据控制；run context 必须保留与 React 相同的模式 effort。
*/

import type { Model } from "./types";
import {
  getResolvedMode,
  resolveReasoningEffort,
  type ReasoningEffortValue,
} from "./reasoning";

export type ComposerMode = "flash" | "thinking" | "pro" | "ultra";
export type ComposerReasoningEffort = ReasoningEffortValue;

const VALID_MODES = new Set<ComposerMode>([
  "flash",
  "thinking",
  "pro",
  "ultra",
]);

export function resolveComposerModel(
  models: readonly Model[],
  requestedModelName?: string,
  agentDefaultModelName?: string | null,
): Model | undefined {
  return (
    models.find((model) => model.name === requestedModelName) ??
    models.find((model) => model.name === agentDefaultModelName) ??
    models[0]
  );
}

/**
 * Normalize composer selection against the selected model. Capability flags
 * control which UI choices are available, while the selected mode/effort is
 * retained so every frontend submits the same observable run context. The
 * Gateway model factory remains the authority that strips unsupported model
 * kwargs before provider construction.
 */
export function normalizeComposerContext<T extends Record<string, unknown>>(
  context: T,
  model: Model | null | undefined,
): T & {
  model_name?: string;
  mode?: ComposerMode;
  reasoning_effort?: ComposerReasoningEffort;
} {
  if (!model) {
    return { ...context };
  }

  const mode = getResolvedMode(
    VALID_MODES.has(context.mode as ComposerMode)
      ? (context.mode as ComposerMode)
      : undefined,
    model,
  );
  const normalized: Record<string, unknown> = {
    ...context,
    model_name: model.name,
    mode,
  };

  const effort = resolveReasoningEffort(
    model,
    typeof context.reasoning_effort === "string"
      ? context.reasoning_effort
      : undefined,
  );
  if (effort === undefined) delete normalized.reasoning_effort;
  else normalized.reasoning_effort = effort;

  return normalized as ReturnType<typeof normalizeComposerContext<T>>;
}
