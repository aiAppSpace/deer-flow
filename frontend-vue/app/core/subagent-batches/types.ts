/*
  【文件职责】     subagent 批次与批次条目的形状，以及进度换算。
  【架构位置】     L3 领域类型
  【主要导出】     SubagentBatchStatus · SubagentBatchItemStatus · SubagentBatchCounts ·
                   SubagentBatch · SubagentBatchItem · isActiveSubagentBatch ·
                   completedSubagentBatchItems · subagentBatchProgress
  【依赖关系】     无
  【边界与注意】   **「完成」= 成功 + 失败 + 取消**，不是只有成功。

                   进度条走的是「这批还剩多少没跑」，失败的条目也已经跑完了。
                   只数成功的话，一批里有失败项时进度条永远到不了头，而批次
                   状态却已经是 completed——两个读数自相矛盾。

                   `subagentBatchProgress` 对非有限数和 0 总数都要能返回 0：
                   总数是后端给的，拿到 `null`/`NaN` 时算出来的 `NaN` 会让
                   进度条的 transform 变成 `translateX(NaN%)`，整条不显示。
*/

export type SubagentBatchStatus =
  "queued" | "running" | "paused" | "completed" | "failed" | "cancelled";

export type SubagentBatchItemStatus =
  | "pending"
  | "queued"
  | "leased"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";

export type SubagentBatchCounts = Record<SubagentBatchItemStatus, number>;

export interface SubagentBatch {
  id: string;
  title: string;
  subagent_type: string;
  status: SubagentBatchStatus;
  total_items: number;
  max_live_items: number;
  max_running_items: number;
  max_attempts: number;
  counts: SubagentBatchCounts;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface SubagentBatchItem {
  id: string;
  batch_id: string;
  item_key: string;
  position: number;
  status: SubagentBatchItemStatus;
  attempt: number;
  model_name: string | null;
  result_preview: string | null;
  result_truncated: boolean;
  error: string | null;
  stop_reason: string | null;
  token_usage: Record<string, number> | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export function isActiveSubagentBatch(batch: SubagentBatch): boolean {
  return ["queued", "running", "paused"].includes(batch.status);
}

export function completedSubagentBatchItems(batch: SubagentBatch): number {
  return batch.counts.succeeded + batch.counts.failed + batch.counts.cancelled;
}

export function subagentBatchProgress(batch: SubagentBatch): number {
  if (!Number.isFinite(batch.total_items) || batch.total_items <= 0) return 0;
  const completed = completedSubagentBatchItems(batch);
  if (!Number.isFinite(completed)) return 0;
  return Math.min(100, Math.max(0, (completed / batch.total_items) * 100));
}
