/*
  由 scripts/gen-contract-constants.mjs 从 <repo>/contracts/*.json 生成，勿手改。
  改后端契约后运行 `make gen-contract-constants`；`make verify` 会校验一致性。
*/

/** 生成时各契约声明的版本号。契约做不兼容变更时这里会跟着变。 */
export const BACKEND_CONTRACT_VERSIONS = {
  subagentStatus: 2,
  slashSkill: 1,
  runEventStream: 1,
} as const;

/** `ToolMessage.additional_kwargs.subagent_status` 的合法取值。 */
export const SUBAGENT_STATUS_VALUES = [
  "completed",
  "failed",
  "cancelled",
  "timed_out",
  "polling_timed_out",
] as const;
export type BackendSubagentStatus = (typeof SUBAGENT_STATUS_VALUES)[number];

/** `subagent_stop_reason` 的合法取值（附加字段，旧前端读不到也不会坏）。 */
export const SUBAGENT_STOP_REASON_VALUES = [
  "token_capped",
  "turn_capped",
  "loop_capped",
] as const;
export type BackendSubagentStopReason = (typeof SUBAGENT_STOP_REASON_VALUES)[number];

/** 占用前导斜杠的 composer 控制命令，永远不能当作技能激活。 */
export const RESERVED_SLASH_SKILL_NAMES = [
  "agent",
  "bootstrap",
  "goal",
  "help",
  "memory",
  "models",
  "new",
  "status",
] as const;

/** 后端 `parse_slash_skill_reference` 使用的技能名语法。 */
export const SLASH_SKILL_PATTERN_SOURCE = "^/([a-z0-9]+(?:-[a-z0-9]+)*)(?:\\s+|$)";

/** run event 的分类维度。 */
export const RUN_EVENT_CATEGORIES = [
  "trace",
  "message",
  "outputs",
  "error",
  "middleware",
  "context",
  "subagent",
  "workspace",
] as const;
export type RunEventCategory = (typeof RUN_EVENT_CATEGORIES)[number];

/** 只读兼容：历史 event_type 到当前规范名的映射。新生产者不得使用左边的名字。 */
export const LEGACY_RUN_EVENT_ALIASES = {
  "ai_message": "llm.ai.response",
} as const;
