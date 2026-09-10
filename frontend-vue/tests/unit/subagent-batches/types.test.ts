/*
  【文件职责】     固定批次进度的换算。
  【架构位置】     测试
  【依赖关系】     app/core/subagent-batches/types.ts
  【边界与注意】   守的是「完成 = 成功 + 失败 + 取消」。只数成功的话，一批里有失败项时
                   进度条永远到不了头，而批次状态已经是 completed——两个读数自相矛盾。
*/

import { describe, expect, it } from "vitest";

import {
  completedSubagentBatchItems,
  isActiveSubagentBatch,
  subagentBatchProgress,
  type SubagentBatch,
  type SubagentBatchCounts,
  type SubagentBatchStatus,
} from "@/core/subagent-batches";

function counts(overrides: Partial<SubagentBatchCounts> = {}) {
  return {
    pending: 0,
    queued: 0,
    leased: 0,
    running: 0,
    succeeded: 0,
    failed: 0,
    cancelled: 0,
    ...overrides,
  };
}

function batch(overrides: Partial<SubagentBatch> = {}): SubagentBatch {
  return {
    id: "b1",
    title: "Batch",
    subagent_type: "researcher",
    status: "running",
    total_items: 10,
    max_live_items: 5,
    max_running_items: 2,
    max_attempts: 3,
    counts: counts(),
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    completed_at: null,
    ...overrides,
  };
}

describe("批次活跃判据", () => {
  it("排队/运行/暂停算活跃，三个终态不算", () => {
    const statuses: SubagentBatchStatus[] = [
      "queued",
      "running",
      "paused",
      "completed",
      "failed",
      "cancelled",
    ];
    expect(
      statuses.filter((status) => isActiveSubagentBatch(batch({ status }))),
    ).toEqual(["queued", "running", "paused"]);
  });

  it("已暂停算活跃：它还能恢复，不是结束了", () => {
    expect(isActiveSubagentBatch(batch({ status: "paused" }))).toBe(true);
  });
});

describe("批次进度", () => {
  it("失败和取消也算跑完了", () => {
    const value = batch({
      total_items: 10,
      counts: counts({ succeeded: 3, failed: 2, cancelled: 1, running: 4 }),
    });
    expect(completedSubagentBatchItems(value)).toBe(6);
    expect(subagentBatchProgress(value)).toBe(60);
  });

  it("全部跑完就是 100，哪怕全失败", () => {
    expect(
      subagentBatchProgress(
        batch({ total_items: 4, counts: counts({ failed: 4 }) }),
      ),
    ).toBe(100);
  });

  it("总数为 0 或不是有限数时给 0，而不是 NaN", () => {
    // NaN 会让进度条的 transform 变成 translateX(NaN%)，整条不显示。
    for (const total of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(
        subagentBatchProgress(batch({ total_items: total })),
        String(total),
      ).toBe(0);
    }
  });

  it("计数超过总数时封顶到 100，不越界", () => {
    expect(
      subagentBatchProgress(
        batch({ total_items: 2, counts: counts({ succeeded: 5 }) }),
      ),
    ).toBe(100);
  });
});
