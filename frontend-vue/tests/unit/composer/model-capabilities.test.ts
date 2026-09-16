import { describe, expect, it } from "vitest";

import {
  normalizeComposerContext,
  resolveComposerModel,
} from "@/core/models/capabilities";
import type { Model } from "@/core/models/types";
import { buildRunContext } from "@/core/threads/submit";

const models: Model[] = [
  {
    id: "basic",
    name: "basic",
    model: "basic-provider",
    display_name: "Basic",
    supports_thinking: false,
    supports_reasoning_effort: false,
  },
  {
    id: "reasoner",
    name: "reasoner",
    model: "reasoner-provider",
    display_name: "Reasoner",
    supports_thinking: true,
    supports_reasoning_effort: true,
  },
  {
    id: "think-only",
    name: "think-only",
    model: "think-only-provider",
    display_name: "Think only",
    supports_thinking: true,
    supports_reasoning_effort: false,
  },
];

describe("model defaults and capabilities", () => {
  it("selects requested model, then agent default, then backend order", () => {
    expect(resolveComposerModel(models, "reasoner", "basic")?.name).toBe(
      "reasoner",
    );
    expect(resolveComposerModel(models, "missing", "think-only")?.name).toBe(
      "think-only",
    );
    expect(resolveComposerModel(models, undefined, "missing")?.name).toBe(
      "basic",
    );
  });

  it("forces flash while preserving the React submission context", () => {
    const normalized = normalizeComposerContext(
      {
        model_name: "basic",
        mode: "ultra",
        reasoning_effort: "high",
      },
      models[0],
    );
    expect(normalized).toEqual({
      model_name: "basic",
      mode: "flash",
      reasoning_effort: "high",
    });

    const payload = buildRunContext(normalized, undefined, models[0]);
    expect(payload).toEqual({
      model_name: "basic",
      mode: "flash",
      thinking_enabled: false,
      is_plan_mode: false,
      subagent_enabled: false,
      reasoning_effort: "high",
    });
  });

  it("keeps the explicit effort in the wire context for a thinking-only model", () => {
    expect(
      buildRunContext(
        { model_name: "think-only", mode: "pro", reasoning_effort: "high" },
        { agent_name: "analyst" },
        models[2],
      ),
    ).toEqual({
      agent_name: "analyst",
      model_name: "think-only",
      mode: "pro",
      thinking_enabled: true,
      is_plan_mode: true,
      subagent_enabled: false,
      reasoning_effort: "high",
    });
  });

  it("derives the React-equivalent effort from mode for every model", () => {
    expect(
      buildRunContext(
        { model_name: "reasoner", mode: "ultra" },
        undefined,
        models[1],
      ),
    ).toEqual({
      model_name: "reasoner",
      mode: "ultra",
      thinking_enabled: true,
      is_plan_mode: true,
      subagent_enabled: true,
      reasoning_effort: "high",
    });

    expect(
      buildRunContext(
        { model_name: "think-only", mode: "pro" },
        undefined,
        models[2],
      ),
    ).toEqual({
      model_name: "think-only",
      mode: "pro",
      thinking_enabled: true,
      is_plan_mode: true,
      subagent_enabled: false,
      reasoning_effort: "medium",
    });
  });
});
