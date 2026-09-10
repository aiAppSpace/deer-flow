/*
  【文件职责】     thread 历史的分页协议：解析、游标、扁平化、跨刷新对账。
  【架构位置】     L3（纯 TS）
  【主要导出】     parseThreadMessagesPageResponse · getThreadHistoryNextPageParam
                   buildThreadMessagesPageUrl · flattenThreadHistoryPages
                   reconcileThreadHistoryRows · THREAD_HISTORY_QUERY_POLICY
                   threadHistoryQueryKey
  【依赖关系】     ./message-identity · ./types
  【边界与注意】   05 C1（保留后端 thread 全局 seq）与 C6（历史失效时保留已加载的页）
                   的实现都在 `reconcileThreadHistoryRows` 一个函数里。

                   `buildThreadMessagesPageUrl` 上游读 `window.location.origin`。
                   这里保留同一行为但把它写成显式的 `origin` 参数默认值——Nuxt 下
                   这个函数会在 SSR 侧被打包进 chunk，`typeof window` 判断在上游是
                   隐式的，在这里必须能被测试穷举（相对 base / 绝对 base 两条路径
                   走的是不同分支）。
*/

import { dedupeRunMessagesByIdentity } from "./message-identity";
import type { RunMessage } from "./types";
import { isValidMessageSeq } from "./message-seq";

export type ThreadMessagesPageResponse = {
  data: RunMessage[];
  has_more: boolean;
  next_before_seq: number | null;
};

/**
 * Validate the sequence fields that history reconciliation and pagination use
 * as runtime identities. The static RunMessage type cannot protect this JSON
 * boundary from version skew or malformed responses.
 */
export function parseThreadMessagesPageResponse(
  value: unknown,
): ThreadMessagesPageResponse {
  if (typeof value !== "object" || value === null) {
    throw new Error("Thread history returned an invalid response.");
  }

  const data = Reflect.get(value, "data");
  const hasMore = Reflect.get(value, "has_more");
  const nextBeforeSeq = Reflect.get(value, "next_before_seq");
  if (!Array.isArray(data) || typeof hasMore !== "boolean") {
    throw new Error("Thread history returned an invalid response.");
  }

  const seenSeqs = new Set<number>();
  for (const row of data) {
    const seq =
      typeof row === "object" && row !== null
        ? Reflect.get(row, "seq")
        : undefined;
    if (!isValidMessageSeq(seq)) {
      throw new Error("Thread history returned a row with an invalid seq.");
    }
    if (seenSeqs.has(seq)) {
      throw new Error("Thread history returned duplicate seq values.");
    }
    seenSeqs.add(seq);
  }

  if (
    (hasMore && !isValidMessageSeq(nextBeforeSeq)) ||
    (!hasMore && nextBeforeSeq !== null)
  ) {
    throw new Error(
      "Thread history returned an invalid next_before_seq cursor.",
    );
  }

  return value as ThreadMessagesPageResponse;
}

export function getThreadHistoryNextPageParam(
  lastPage: ThreadMessagesPageResponse,
): number | undefined {
  if (!lastPage.has_more) {
    return undefined;
  }
  if (lastPage.next_before_seq === null) {
    console.warn(
      "Thread history returned has_more without next_before_seq; pagination cannot continue.",
    );
    return undefined;
  }
  return lastPage.next_before_seq;
}

export const threadHistoryQueryKey = (threadId: string) =>
  ["thread-messages", threadId] as const;

export function buildThreadMessagesPageUrl(
  baseUrl: string,
  threadId: string,
  beforeSeq?: number,
  origin: string = typeof window !== "undefined"
    ? window.location.origin
    : "http://localhost",
) {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  const path = `/api/threads/${encodeURIComponent(threadId)}/messages/page`;
  const url = new URL(`${normalizedBaseUrl}${path}`, origin);
  if (beforeSeq !== undefined) {
    url.searchParams.set("before_seq", String(beforeSeq));
  }
  return normalizedBaseUrl ? url.toString() : `${url.pathname}${url.search}`;
}

export function flattenThreadHistoryPages(
  pages: ThreadMessagesPageResponse[],
): RunMessage[] {
  return dedupeRunMessagesByIdentity(
    pages
      .slice()
      .reverse()
      .flatMap((page) => page.data),
  );
}

/**
 * Preserve rows that this client has already loaded while newest-first cursor
 * pages move forward during a long run.
 *
 * A background refetch recalculates every loaded page from the refreshed first
 * page. When older pages have not all been loaded yet, that can displace rows
 * which were visible a moment ago even though they still exist on the server.
 * Thread-global seq is the authoritative order; refreshed copies win without
 * moving their established position.
 */
export function reconcileThreadHistoryRows(
  previousRows: RunMessage[],
  currentRows: RunMessage[],
  isAuthoritativeComplete: boolean,
): RunMessage[] {
  const sourceRows = isAuthoritativeComplete
    ? currentRows
    : [...previousRows, ...currentRows];
  if (sourceRows.some((row) => !isValidMessageSeq(row.seq))) {
    console.error(
      "Thread history reconciliation received an invalid sequence value.",
    );
    // Never skip an invalid row or feed it into Map/Array.sort: either choice
    // can silently lose or misorder messages. A failed refresh keeps the last
    // known-good snapshot; an invalid first snapshot degrades to server order.
    return previousRows.length > 0 ? previousRows : currentRows;
  }

  const rowsBySeq = new Map<number, RunMessage>();
  for (const row of sourceRows) {
    rowsBySeq.set(row.seq, row);
  }

  const reconciled = dedupeRunMessagesByIdentity(
    [...rowsBySeq.values()].sort((left, right) => left.seq - right.seq),
  );
  if (
    reconciled.length === previousRows.length &&
    reconciled.every((row, index) => row === previousRows[index])
  ) {
    return previousRows;
  }
  return reconciled;
}

export const THREAD_HISTORY_QUERY_POLICY = {
  refetchOnWindowFocus: false,
  staleTime: 5 * 60 * 1_000,
} as const;
