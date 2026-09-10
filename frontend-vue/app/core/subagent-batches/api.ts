/*
  【文件职责】     subagent 批次的 Gateway 读写与结果导出地址。
  【架构位置】     L3
  【主要导出】     fetchSubagentBatches · fetchSubagentBatchItems ·
                   controlSubagentBatch · retrySubagentBatchItem ·
                   subagentBatchResultsUrl
  【依赖关系】     core/api/fetcher · core/api/errors · core/config
  【边界与注意】   结果导出给的是**地址**而不是 blob：那份 JSONL 可能很大，
                   让浏览器直接下载比先读进内存再造 object URL 稳。
*/

import { throwGatewayApiError } from "@/core/api/errors";
import { fetch } from "@/core/api/fetcher";
import { getBackendBaseURL } from "@/core/config";

import type { SubagentBatch, SubagentBatchItem } from "./types";

function batchUrl(threadId: string, path = ""): string {
  return `${getBackendBaseURL()}/api/threads/${encodeURIComponent(threadId)}/subagent-batches${path}`;
}

async function readJson<T>(response: Response, fallback: string): Promise<T> {
  if (!response.ok) await throwGatewayApiError(response, fallback);
  return (await response.json()) as T;
}

export async function fetchSubagentBatches(
  threadId: string,
): Promise<SubagentBatch[]> {
  return readJson(
    await fetch(`${batchUrl(threadId)}?limit=20`),
    "Failed to load subagent batches",
  );
}

export const SUBAGENT_BATCH_ITEMS_PAGE_SIZE = 100;

export async function fetchSubagentBatchItems(
  threadId: string,
  batchId: string,
  options: {
    offset?: number;
    limit?: number;
    status?: SubagentBatchItem["status"];
  } = {},
): Promise<SubagentBatchItem[]> {
  const params = new URLSearchParams({
    offset: String(options.offset ?? 0),
    limit: String(options.limit ?? SUBAGENT_BATCH_ITEMS_PAGE_SIZE),
  });
  if (options.status) params.set("status", options.status);
  return readJson(
    await fetch(
      batchUrl(threadId, `/${encodeURIComponent(batchId)}/items?${params}`),
    ),
    "Failed to load batch items",
  );
}

export type SubagentBatchAction = "pause" | "resume" | "cancel";

export async function controlSubagentBatch(
  threadId: string,
  batchId: string,
  action: SubagentBatchAction,
): Promise<SubagentBatch> {
  return readJson(
    await fetch(
      batchUrl(threadId, `/${encodeURIComponent(batchId)}/${action}`),
      { method: "POST" },
    ),
    `Failed to ${action} subagent batch`,
  );
}

export async function retrySubagentBatchItem(
  threadId: string,
  batchId: string,
  itemId: string,
): Promise<SubagentBatchItem> {
  return readJson(
    await fetch(
      batchUrl(
        threadId,
        `/${encodeURIComponent(batchId)}/items/${encodeURIComponent(itemId)}/retry`,
      ),
      { method: "POST" },
    ),
    "Failed to retry subagent batch item",
  );
}

export function subagentBatchResultsUrl(
  threadId: string,
  batchId: string,
): string {
  return batchUrl(threadId, `/${encodeURIComponent(batchId)}/results.jsonl`);
}
