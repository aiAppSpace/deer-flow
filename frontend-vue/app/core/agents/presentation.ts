/*
  【文件职责】     将真实 Agent 响应转换为确定性的卡片展示模型。
  【架构位置】     L3 Agent presentation
  【主要导出】     displayNameOfAgent · buildAgentCardViewModel
  【依赖关系】     agents/types
  【边界与注意】   null=不过滤配置 tool groups；[]=显式空 whitelist；不去重、不重排。
*/

import type { Agent } from "@/core/agents/types";

interface BadgeView {
  key: string;
  label: string;
}

export interface AgentCardViewModel {
  name: string;
  description: string;
  model: string | null;
  skills: BadgeView[];
  toolGroups: {
    mode: "all" | "none" | "selected";
    items: BadgeView[];
  };
}

function badges(prefix: string, values: readonly string[] | null | undefined) {
  return (values ?? []).map((label, index) => ({
    key: `${prefix}:${index}`,
    label,
  }));
}

export function displayNameOfAgent(
  agent: Pick<Agent, "name" | "display_name"> | null | undefined,
  fallback: string,
): string {
  return agent?.display_name?.length
    ? agent.display_name
    : (agent?.name ?? fallback);
}

export function buildAgentCardViewModel(agent: Agent): AgentCardViewModel {
  return {
    name: displayNameOfAgent(agent, agent.name),
    description: agent.description,
    model: agent.model,
    skills: badges("skill", agent.skills),
    toolGroups: {
      mode:
        agent.tool_groups === null
          ? "all"
          : agent.tool_groups.length === 0
            ? "none"
            : "selected",
      items: badges("tool-group", agent.tool_groups),
    },
  };
}
