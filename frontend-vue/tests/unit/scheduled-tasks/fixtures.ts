import type {
  ScheduledTask,
  ThreadScheduledTask,
  ScheduledTaskRun,
} from "@/core/scheduled-tasks/types";
export function task(
  overrides: Partial<ThreadScheduledTask> = {},
): ScheduledTask {
  return {
    id: "task-1",
    thread_id: null,
    context_mode: "fresh_thread_per_run",
    assistant_id: null,
    title: "Daily digest",
    prompt: "Summarize updates",
    schedule_type: "cron",
    schedule_spec: { cron: "0 9 * * *" },
    timezone: "UTC",
    status: "enabled",
    next_run_at: "2030-01-02T09:00:00Z",
    last_run_at: null,
    last_run_id: null,
    last_thread_id: null,
    last_error: null,
    run_count: 0,
    created_at: "2030-01-01T00:00:00Z",
    updated_at: "2030-01-01T00:00:00Z",
    ...overrides,
  };
}
export function run(
  overrides: Partial<ScheduledTaskRun> = {},
): ScheduledTaskRun {
  return {
    id: "run-1",
    task_id: "task-1",
    thread_id: "thread-1",
    run_id: "agent-run",
    scheduled_for: "2030-01-01T09:00:00Z",
    trigger: "scheduled",
    status: "success",
    error: null,
    attempt_count: 1,
    started_at: "2030-01-01T09:00:00Z",
    finished_at: "2030-01-01T09:01:00Z",
    created_at: "2030-01-01T09:00:00Z",
    ...overrides,
  };
}
