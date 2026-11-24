/*
  由 scripts/gen-contract-constants.mjs 从 <repo>/contracts/*.json 生成，勿手改。
  改后端契约后运行 `make gen-contract-constants`；`make verify` 会校验一致性。
*/

/** 生成时各契约声明的版本号。契约做不兼容变更时这里会跟着变。 */
export const BACKEND_CONTRACT_VERSIONS = {
  subagentStatus: 2,
  slashSkill: 1,
  runEventStream: 1,
  threadOrigin: 1,
  scheduledGoalNotes: 3,
  scheduledTaskErrors: 1,
} as const;

export const THREAD_ORIGIN_KEY = "deerflow_origin";
export const THREAD_ORIGIN_KINDS = [
  "extension",
  "github",
  "im_channel",
  "mcp_notification",
  "schedule",
  "subagent_batch",
] as const;

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
  "model_length_capped",
] as const;
export type BackendSubagentStopReason = (typeof SUBAGENT_STOP_REASON_VALUES)[number];

/** 占用前导斜杠的 composer 控制命令，永远不能当作技能激活。 */
export const RESERVED_SLASH_SKILL_NAMES = [
  "agent",
  "bootstrap",
  "context",
  "goal",
  "help",
  "memory",
  "model",
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

/** Host-owned scheduled-task notes; readers must not duplicate their text. */
export const SCHEDULED_AGENT_STOP_LAST_ERROR_PREFIX =
  "stopped by the agent in run ";
export const SCHEDULED_AUTO_PAUSE_LAST_ERROR =
  "paused after 3 unmet scheduled goal runs";
export const SCHEDULED_ORIGIN_KEY = "deerflow_scheduled_origin";

export const SCHEDULED_GOAL_UNMET_REASON_CODES = [
  "blocked:missing_evidence",
  "blocked:needs_user_input",
  "blocked:run_failed",
  "blocked:external_wait",
  "blocked:goal_not_met_yet",
  "max_continuations_reached",
  "no_progress_detected",
  "token_capped",
  "loop_capped",
  "recursion_capped",
  "evaluator_failed",
  "no_durable_end_of_turn",
  "thread_changed_after_evaluation",
  "thread_changed_before_continuation",
  "no_verdict",
] as const;
export type BackendScheduledGoalUnmetReasonCode =
  (typeof SCHEDULED_GOAL_UNMET_REASON_CODES)[number];

export const SCHEDULED_GOAL_CHECK_FAILURE_CODES = [
  "evaluator_failed",
  "no_durable_end_of_turn",
  "thread_changed_after_evaluation",
  "thread_changed_before_continuation",
] as const;

export const SCHEDULED_HOST_RUN_ERRORS = {
  restarted: "interrupted: gateway restarted before the run reached a terminal state",
  lease_lost: "interrupted: the owning gateway stopped renewing its run lease",
  queue_timeout: "scheduled task queue wait timeout exceeded",
  paused_while_queued: "scheduled task was paused while queued",
  deleted_while_queued: "scheduled task was deleted while queued",
  end_reached: "schedule end condition reached",
  interrupted: "run was interrupted before completion",
} as const;
export type BackendScheduledHostRunError =
  (typeof SCHEDULED_HOST_RUN_ERRORS)[keyof typeof SCHEDULED_HOST_RUN_ERRORS];

export const SCHEDULED_TASK_LIFECYCLE_EVENTS = [
  "task_stopped",
  "task_paused",
  "task_finished",
] as const;
export type BackendScheduledTaskLifecycleEvent =
  (typeof SCHEDULED_TASK_LIFECYCLE_EVENTS)[number];

export const SCHEDULED_TASK_LIFECYCLE_REASONS = {
  task_stopped: ["agent_stop"],
  task_paused: ["consecutive_unmet"],
  task_finished: ["max_runs", "end_at", "once_done", "once_failed"],
} as const satisfies Record<BackendScheduledTaskLifecycleEvent, readonly string[]>;
export type BackendScheduledTaskLifecycleReason<
  Event extends BackendScheduledTaskLifecycleEvent,
> = (typeof SCHEDULED_TASK_LIFECYCLE_REASONS)[Event][number];

/** Codes returned to the UI; agent-only codes have no UI consumer. */
export const SCHEDULED_TASK_UI_ERROR_CODES = [
  "invalid_request",
  "invalid_schedule",
  "invalid_schedule_type",
  "invalid_timezone",
  "interval_too_short",
  "interval_too_long",
  "once_in_past",
  "once_too_soon",
  "once_time_passed",
  "invalid_context_mode",
  "reuse_thread_requires_thread",
  "thread_not_found",
  "invalid_assistant",
  "unknown_assistant",
  "invalid_goal",
  "goal_requires_fresh_thread",
  "invalid_stop_condition",
  "invalid_notification_group",
  "invalid_max_runs",
  "end_at_in_past",
  "end_at_before_first_run",
  "frequent_requires_limit",
  "max_runs_not_above_used",
  "limits_exhausted",
  "task_not_found",
  "task_running",
  "run_queued",
  "task_changed",
  "task_finished",
  "task_quota_exceeded",
  "scheduler_not_running",
  "scheduler_unavailable",
  "trigger_failed",
] as const;
export type BackendScheduledTaskErrorCode =
  (typeof SCHEDULED_TASK_UI_ERROR_CODES)[number];
