/*
  【文件职责】     固定模型目录、capability 与 Agent update exact payload。
  【架构位置】     纯逻辑测试
  【主要导出】     无；Vitest cases
  【依赖关系】     core/agents/settings · core/models/types
  【边界与注意】   unsupported capability 必须显式清空旧值；false/0 不得被 truthy fallback 吞掉。
*/

import { describe, expect, it } from "vitest";

import {
  DEFAULT_AGENT_MODEL_VALUE,
  buildAgentSettingsUpdatePayload,
  resolveAgentSettingsModel,
} from "@/core/agents/settings";
import type { Model } from "@/core/models/types";

const models: Model[] = [
  {
    id: "basic",
    name: "basic",
    model: "basic-provider-id",
    display_name: "Basic",
    supports_thinking: false,
    supports_reasoning_effort: false,
  },
  {
    id: "thinking",
    name: "thinking",
    model: "thinking-provider-id",
    display_name: "Thinking",
    supports_thinking: true,
    supports_reasoning_effort: false,
  },
  {
    id: "reasoning",
    name: "reasoning",
    model: "reasoning-provider-id",
    display_name: "Reasoning",
    supports_thinking: true,
    supports_reasoning_effort: true,
  },
];

const baseDraft = {
  model: "reasoning",
  temperature: "",
  maxTokens: "",
  thinking: "inherit" as const,
  reasoningEffort: "inherit" as const,
};

describe("Agent settings model resolution", () => {
  it("uses the first real /api/models row for inherited default", () => {
    expect(resolveAgentSettingsModel(models, DEFAULT_AGENT_MODEL_VALUE)).toBe(
      models[0],
    );
  });

  it("rejects an unknown explicit model", () => {
    expect(
      buildAgentSettingsUpdatePayload(models, {
        ...baseDraft,
        model: "removed-model",
      }),
    ).toEqual({ ok: false, error: "model" });
  });
});

describe("Agent settings exact payload", () => {
  it("preserves explicit false, reasoning and numeric zero", () => {
    expect(
      buildAgentSettingsUpdatePayload(models, {
        ...baseDraft,
        temperature: "0",
        maxTokens: "200000",
        thinking: "off",
        reasoningEffort: "high",
      }),
    ).toEqual({
      ok: true,
      request: {
        model: "reasoning",
        model_settings: { temperature: 0, max_tokens: 200000 },
        thinking_enabled: false,
        reasoning_effort: "high",
      },
    });
  });

  it("accepts the numeric values emitted by browser number-input v-model", () => {
    expect(
      buildAgentSettingsUpdatePayload(models, {
        ...baseDraft,
        temperature: 0,
        maxTokens: 200000,
        thinking: "off",
        reasoningEffort: "high",
      }),
    ).toEqual({
      ok: true,
      request: {
        model: "reasoning",
        model_settings: { temperature: 0, max_tokens: 200000 },
        thinking_enabled: false,
        reasoning_effort: "high",
      },
    });
  });

  it("keeps true/null/inherit semantics exact", () => {
    expect(
      buildAgentSettingsUpdatePayload(models, {
        ...baseDraft,
        model: "thinking",
        thinking: "on",
      }),
    ).toEqual({
      ok: true,
      request: {
        model: "thinking",
        model_settings: null,
        thinking_enabled: true,
        reasoning_effort: null,
      },
    });
  });

  it("clears stale thinking and reasoning when switching to an unsupported model", () => {
    expect(
      buildAgentSettingsUpdatePayload(models, {
        ...baseDraft,
        model: "basic",
        thinking: "on",
        reasoningEffort: "medium",
      }),
    ).toEqual({
      ok: true,
      request: {
        model: "basic",
        model_settings: null,
        thinking_enabled: null,
        reasoning_effort: null,
      },
    });
  });

  it.each([
    [{ temperature: "-0.1", maxTokens: "" }, "temperature"],
    [{ temperature: "2.1", maxTokens: "" }, "temperature"],
    [{ temperature: "warm", maxTokens: "" }, "temperature"],
    [{ temperature: "", maxTokens: "0" }, "max_tokens"],
    [{ temperature: "", maxTokens: "1.5" }, "max_tokens"],
    [{ temperature: "", maxTokens: "200001" }, "max_tokens"],
  ] as const)("rejects invalid numeric drafts: %o", (values, error) => {
    expect(
      buildAgentSettingsUpdatePayload(models, {
        ...baseDraft,
        ...values,
      }),
    ).toEqual({ ok: false, error });
  });
});
