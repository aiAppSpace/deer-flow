/*
  【文件职责】     后台任务（MCP 长任务）的状态形状与「还该不该继续轮询」的判据。
  【架构位置】     L3 领域类型
  【主要导出】     BackgroundTaskStatus · BackgroundTaskNotificationStatus ·
                   BackgroundTask · BackgroundTaskDetail ·
                   ACTIVE_BACKGROUND_TASK_STATUSES ·
                   ACTIVE_BACKGROUND_TASK_NOTIFICATION_STATUSES ·
                   isActiveBackgroundTask · shouldPollBackgroundTaskDetail
  【依赖关系】     无
  【边界与注意】   **任务状态和通知状态是两件事。**

                   一个任务可以已经 completed，而把结果送回会话的那条通知还在重试。
                   详情面板据此继续轮询——只看任务状态的话，用户会停在
                   「已完成但什么都没收到」，而且看不出系统还在努力。
*/

export type BackgroundTaskStatus =
  | "submitted"
  | "working"
  | "input_required"
  | "completed"
  | "failed"
  | "cancelled";

export type BackgroundTaskNotificationStatus =
  | "none"
  | "pending"
  | "claimed"
  | "retry"
  | "dispatched"
  | "delivered"
  | "dead_letter";

export interface BackgroundTask {
  task_id: string;
  task_name: string;
  status: BackgroundTaskStatus;
  created_at: string;
  updated_at: string;
  error: string | null;
  /** 追踪降级：Gateway 暂时问不到远端状态，显示的进度可能是旧的。 */
  tracking_degraded: boolean;
  cancel_requested: boolean;
}

export interface BackgroundTaskDetail extends BackgroundTask {
  last_polled_at: string | null;
  last_poll_error: string | null;
  last_cancel_error: string | null;
  cancel_attempt_count: number;
  notification_status: BackgroundTaskNotificationStatus;
  notification_error: string | null;
  notification_attempt_count: number;
  result: unknown | null;
  result_preview: string | null;
  result_truncated: boolean;
  result_artifact: unknown | null;
  input_required: unknown | null;
}

export const ACTIVE_BACKGROUND_TASK_STATUSES: ReadonlySet<BackgroundTaskStatus> =
  new Set(["submitted", "working", "input_required"]);

export const ACTIVE_BACKGROUND_TASK_NOTIFICATION_STATUSES: ReadonlySet<BackgroundTaskNotificationStatus> =
  new Set(["pending", "claimed", "retry", "dispatched"]);

export function isActiveBackgroundTask(task: BackgroundTask): boolean {
  return ACTIVE_BACKGROUND_TASK_STATUSES.has(task.status);
}

export function shouldPollBackgroundTaskDetail(
  task: BackgroundTaskDetail,
): boolean {
  return (
    isActiveBackgroundTask(task) ||
    ACTIVE_BACKGROUND_TASK_NOTIFICATION_STATUSES.has(task.notification_status)
  );
}
