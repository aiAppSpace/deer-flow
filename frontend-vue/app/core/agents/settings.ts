/*
  【文件职责】     将 Agent 设置草稿按真实模型 capability 归一化为精确 PUT body。
  【架构位置】     L3 Agent 设置协议
  【主要导出】     buildAgentSettingsUpdatePayload · resolveAgentSettingsModel
  【依赖关系】     agents/types · models/types
  【边界与注意】   null 清除持久化 override；不支持的 thinking/reasoning 不得携带旧值。
*/

import type { ReasoningEffort, UpdateAgentRequest } from "@/core/agents/types";
import type { Model } from "@/core/models/types";
import {
  supportsThinking,
  isThinkingRequired,
  getReasoningEffortOptions,
} from "@/core/models/reasoning";

export const DEFAULT_AGENT_MODEL_VALUE = "__default__";
export const MAX_AGENT_OUTPUT_TOKENS = 200_000;

export type AgentThinkingSelection = "inherit" | "on" | "off";
export type AgentReasoningSelection = "inherit" | ReasoningEffort;

export interface AgentSettingsDraft {
  model: string;
  temperature: string | number;
  maxTokens: string | number;
  thinking: AgentThinkingSelection;
  reasoningEffort: AgentReasoningSelection;
}

export type AgentSettingsError = "temperature" | "max_tokens";

export type AgentSettingsPayloadResult =
  | { ok: true; request: UpdateAgentRequest }
  | { ok: false; error: AgentSettingsError };

export function resolveAgentSettingsModel(
  models: readonly Model[],
  selected: string,
) {
  return selected === DEFAULT_AGENT_MODEL_VALUE
    ? models[0]
    : models.find((model) => model.name === selected);
}

function parseSettings(draft: AgentSettingsDraft) {
  const temperatureText = String(draft.temperature).trim();
  const maxTokensText = String(draft.maxTokens).trim();
  const temperature = temperatureText === "" ? null : Number(temperatureText);
  if (
    temperature !== null &&
    (!Number.isFinite(temperature) || temperature < 0 || temperature > 2)
  ) {
    return { ok: false, error: "temperature" } as const;
  }
  const maxTokens = maxTokensText === "" ? null : Number(maxTokensText);
  if (
    maxTokens !== null &&
    (!Number.isInteger(maxTokens) ||
      maxTokens < 1 ||
      maxTokens > MAX_AGENT_OUTPUT_TOKENS)
  ) {
    return { ok: false, error: "max_tokens" } as const;
  }
  return { ok: true, temperature, maxTokens } as const;
}

export function buildAgentSettingsUpdatePayload(
  models: readonly Model[],
  draft: AgentSettingsDraft,
): AgentSettingsPayloadResult {
  const selectedModel = resolveAgentSettingsModel(models, draft.model);
  const settings = parseSettings(draft);
  if (!settings.ok) return settings;

  const modelSettings =
    settings.temperature !== null || settings.maxTokens !== null
      ? {
          temperature: settings.temperature,
          max_tokens: settings.maxTokens,
        }
      : null;
  const thinkingSupported = supportsThinking(selectedModel);
  const allowedEfforts = getReasoningEffortOptions(selectedModel).filter(
    (value) => ["low", "medium", "high"].includes(value),
  );
  const thinking =
    isThinkingRequired(selectedModel) && draft.thinking === "off"
      ? "inherit"
      : draft.thinking;

  return {
    ok: true,
    request: {
      model: draft.model === DEFAULT_AGENT_MODEL_VALUE ? null : draft.model,
      model_settings: modelSettings,
      thinking_enabled: thinkingSupported
        ? thinking === "inherit"
          ? null
          : thinking === "on"
        : null,
      reasoning_effort:
        allowedEfforts.includes(draft.reasoningEffort) &&
        draft.reasoningEffort !== "inherit"
          ? draft.reasoningEffort
          : null,
    },
  };
}
