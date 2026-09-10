/*
  【文件职责】     固定「还该不该继续轮询」的两条判据。
  【架构位置】     测试
  【依赖关系】     app/core/background-tasks/types.ts
  【边界与注意】   守的是「任务状态和通知状态是两件事」：任务完成了但通知还在重试时
                   详情要继续轮询，否则用户停在「已完成但什么都没收到」，而且看不出
                   系统还在努力。
*/

import { describe, expect, it } from "vitest";

import {
  isActiveBackgroundTask,
  shouldPollBackgroundTaskDetail,
  type BackgroundTaskDetail,
  type BackgroundTaskNotificationStatus,
  type BackgroundTaskStatus,
} from "@/core/background-tasks";

const ALL_STATUSES: BackgroundTaskStatus[] = [
  "submitted",
  "working",
  "input_required",
  "completed",
  "failed",
  "cancelled",
];

const ALL_NOTIFICATION_STATUSES: BackgroundTaskNotificationStatus[] = [
  "none",
  "pending",
  "claimed",
  "retry",
  "dispatched",
  "delivered",
  "dead_letter",
];

function detail(
  status: BackgroundTaskStatus,
  notification: BackgroundTaskNotificationStatus,
): BackgroundTaskDetail {
  return {
    task_id: "t",
    task_name: "n",
    status,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    error: null,
    tracking_degraded: false,
    cancel_requested: false,
    last_polled_at: null,
    last_poll_error: null,
    last_cancel_error: null,
    cancel_attempt_count: 0,
    notification_status: notification,
    notification_error: null,
    notification_attempt_count: 0,
    result: null,
    result_preview: null,
    result_truncated: false,
    result_artifact: null,
    input_required: null,
  };
}

describe("后台任务的活跃判据", () => {
  it("三个未结束状态算活跃，三个终态不算", () => {
    const active = ALL_STATUSES.filter((status) =>
      isActiveBackgroundTask(detail(status, "none")),
    );
    expect(active).toEqual(["submitted", "working", "input_required"]);
  });

  it("`input_required` 算活跃：远端还在等回复，不是结束了", () => {
    expect(isActiveBackgroundTask(detail("input_required", "none"))).toBe(true);
  });
});

describe("详情该不该继续轮询", () => {
  it("任务还活着就轮询，跟通知状态无关", () => {
    for (const notification of ALL_NOTIFICATION_STATUSES) {
      expect(
        shouldPollBackgroundTaskDetail(detail("working", notification)),
        notification,
      ).toBe(true);
    }
  });

  it("任务结束了但通知还在路上，仍要轮询", () => {
    const stillGoing = ALL_NOTIFICATION_STATUSES.filter((notification) =>
      shouldPollBackgroundTaskDetail(detail("completed", notification)),
    );
    expect(stillGoing).toEqual(["pending", "claimed", "retry", "dispatched"]);
  });

  it("任务结束、通知也落地或彻底失败，就停下来", () => {
    for (const notification of ["none", "delivered", "dead_letter"] as const) {
      expect(
        shouldPollBackgroundTaskDetail(detail("completed", notification)),
        notification,
      ).toBe(false);
    }
  });
});
