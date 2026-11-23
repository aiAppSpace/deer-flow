import type { KnowledgeScopeSnapshot } from "@/core/knowledge";

export interface AgentModelSettings {
  temperature?: number | null;
  max_tokens?: number | null;
}

export type ReasoningEffort = "low" | "medium" | "high";

export interface Agent {
  name: string;
  display_name?: string | null;
  description: string;
  model: string | null;
  mcp_plugins?: string[] | null;
  knowledge_scope?: KnowledgeScopeSnapshot | null;
  tool_groups: string[] | null;
  skills: string[] | null;
  /**
   * 这个自定义 agent 可以调哪些 subagent。
   *
   * 三态与 subagent 自己的 tools/skills 同构：`null` = 全部已启用的，
   * `[]` = 一个都不给，`[...]` = 只给这几个。**由服务端强制**，
   * 前端这一份只是编辑入口。
   */
  allowed_subagents?: string[] | null;
  model_settings?: AgentModelSettings | null;
  thinking_enabled?: boolean | null;
  reasoning_effort?: ReasoningEffort | null;
  soul?: string | null;
}

export interface CreateAgentRequest {
  name: string;
  display_name?: string | null;
  description?: string;
  model?: string | null;
  mcp_plugins?: string[] | null;
  knowledge_scope?: KnowledgeScopeSnapshot | null;
  tool_groups?: string[] | null;
  skills?: string[] | null;
  allowed_subagents?: string[] | null;
  model_settings?: AgentModelSettings | null;
  thinking_enabled?: boolean | null;
  reasoning_effort?: ReasoningEffort | null;
  soul?: string;
}

export interface PortableAgentDefinition extends CreateAgentRequest {
  memory_enabled?: boolean;
}

export interface AgentPackage {
  format: "deerflow.custom-agent";
  version: 1;
  agent: PortableAgentDefinition;
}

export interface UpdateAgentRequest {
  display_name?: string | null;
  description?: string | null;
  model?: string | null;
  mcp_plugins?: string[] | null;
  knowledge_scope?: KnowledgeScopeSnapshot | null;
  tool_groups?: string[] | null;
  skills?: string[] | null;
  allowed_subagents?: string[] | null;
  model_settings?: AgentModelSettings | null;
  thinking_enabled?: boolean | null;
  reasoning_effort?: ReasoningEffort | null;
  soul?: string | null;
}
