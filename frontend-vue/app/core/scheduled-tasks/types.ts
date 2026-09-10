export type ScheduledTask = {
  id: string;
  thread_id: string | null;
  context_mode: "fresh_thread_per_run" | "reuse_thread";
  title: string;
  prompt: string;
  schedule_type: "once" | "cron";
  schedule_spec: Record<string, unknown>;
  timezone: string;
  status:
    "enabled" | "paused" | "running" | "completed" | "failed" | "cancelled";
  next_run_at: string | null;
  last_run_at: string | null;
  last_run_id: string | null;
  last_thread_id: string | null;
  last_error: string | null;
  run_count: number;
  created_at: string;
  updated_at: string;
};

export type ScheduledTaskRun = {
  id: string;
  task_id: string;
  thread_id: string;
  run_id: string | null;
  scheduled_for: string;
  trigger: "scheduled" | "manual";
  /**
   * `launching` 是**已领取、还没真正跑起来**那一档。
   *
   * 少了它，那段时间的运行在界面上会掉进「未知状态」——而它恰恰是用户点完
   * 「立即运行」之后盯着看的那几秒。
   */
  status:
    | "queued"
    | "launching"
    | "running"
    | "success"
    | "failed"
    | "skipped"
    | "interrupted";
  error: string | null;
  /** 第几次尝试；重试过的运行靠它区分。 */
  attempt_count?: number;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
};
