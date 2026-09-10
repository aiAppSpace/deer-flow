/*
  【文件职责】     subagent 的形状与托管 subagent 的创建/更新请求体。
  【架构位置】     L3 领域类型
  【主要导出】     SubagentSource · Subagent · CreateManagedSubagentRequest ·
                   UpdateManagedSubagentRequest
  【依赖关系】     无
  【边界与注意】   `tools` / `disallowed_tools` / `skills` 三个字段的 `null` 与 `[]`
                   **不是一回事**：`null` 是「全都给」，`[]` 是「一个都不给」。
                   把它们混成同一个空值，一个本该能用全部工具的 subagent 会变成
                   什么都做不了，而界面上看不出区别。表单侧的三态转换在
                   `optional-name-list.ts`。

                   `source` 决定这一条能不能改：builtin 与 config 来自代码和配置文件，
                   只有 managed 是 Gateway 可写的。`editable` 是后端算好的结论，
                   前端按它来，不要自己从 source 推。
*/

export type SubagentSource = "builtin" | "config" | "managed";

export interface Subagent {
  name: string;
  display_name: string | null;
  description: string;
  system_prompt: string | null;
  /** `null` = 全部工具；`[]` = 一个都不给。 */
  tools: string[] | null;
  disallowed_tools: string[] | null;
  /** `null` = 全部技能；`[]` = 一个都不给。 */
  skills: string[] | null;
  model: string;
  max_turns: number;
  timeout_seconds: number;
  enabled: boolean;
  source: SubagentSource;
  editable: boolean;
  /** 同名的托管条目与配置文件条目撞了：改之前要先解决冲突。 */
  conflict: boolean;
  config_overrides: Record<string, unknown>;
}

export interface CreateManagedSubagentRequest {
  name: string;
  display_name?: string | null;
  description: string;
  system_prompt: string;
  tools?: string[] | null;
  disallowed_tools?: string[] | null;
  skills?: string[] | null;
  model?: string;
  max_turns?: number;
  timeout_seconds?: number;
  enabled?: boolean;
}

export type UpdateManagedSubagentRequest = Partial<
  Omit<CreateManagedSubagentRequest, "name">
>;
