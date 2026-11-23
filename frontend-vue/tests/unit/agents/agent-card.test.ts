/*
  【文件职责】     固定Agent 卡片的 model/skills/tool-groups 纯展示模型。
  【架构位置】     纯逻辑测试
  【主要导出】     无；Vitest cases
  【依赖关系】     core/agents/presentation · core/agents/types
  【边界与注意】   null/empty 是不同真实合同；多个值和重复值保持 Gateway 响应顺序。
*/

import { describe, expect, it } from "vitest";

import { buildAgentCardViewModel } from "@/core/agents/presentation";
import type { Agent } from "@/core/agents/types";

function agent(toolGroups: string[] | null): Agent {
  return {
    name: "reviewer",
    description: "Reviews code",
    model: "reasoning-model",
    tool_groups: toolGroups,
    skills: ["review", "review", "long-skill-name"],
  };
}

describe("Agent card presentation", () => {
  it("uses the Unicode display name without replacing the stable routing name", () => {
    const value = { ...agent(null), display_name: "审查助手 🚀" };
    expect(buildAgentCardViewModel(value).name).toBe("审查助手 🚀");
    expect(value.name).toBe("reviewer");
    expect(buildAgentCardViewModel({ ...value, display_name: "" }).name).toBe(
      "reviewer",
    );
  });
  it("represents null as an unrestricted configured-group filter", () => {
    expect(buildAgentCardViewModel(agent(null))).toMatchObject({
      model: "reasoning-model",
      toolGroups: { mode: "all", items: [] },
    });
  });

  it("keeps an explicit empty whitelist distinct", () => {
    expect(buildAgentCardViewModel(agent([])).toolGroups).toEqual({
      mode: "none",
      items: [],
    });
  });

  it("preserves multiple groups, skills, duplicates and response order with stable keys", () => {
    const view = buildAgentCardViewModel(
      agent(["browser", "file:read", "browser"]),
    );
    expect(view.toolGroups).toEqual({
      mode: "selected",
      items: [
        { key: "tool-group:0", label: "browser" },
        { key: "tool-group:1", label: "file:read" },
        { key: "tool-group:2", label: "browser" },
      ],
    });
    expect(view.skills).toEqual([
      { key: "skill:0", label: "review" },
      { key: "skill:1", label: "review" },
      { key: "skill:2", label: "long-skill-name" },
    ]);
  });
});
