/*
  【文件职责】     侧栏无限列表的分页取数、游标推导与缓存镜像写入。
  【架构位置】     L3
  【主要导出】     INFINITE_THREADS_PAGE_SIZE · INFINITE_THREADS_QUERY_KEY_PREFIX
                   fetchInfiniteThreadsPage · getInfiniteThreadsNextPageParam
                   mapInfiniteThreadsCache · filterInfiniteThreadsCache
                   upsertThreadInInfiniteCache
  【依赖关系】     @tanstack/vue-query（仅类型与 QueryClient）· ./thread-search-query
  【边界与注意】   这是本仓第一次 import `@tanstack/vue-query`。它进 `core/` 而不是
                   `composables/`，因为这几个函数**不用组件上下文**：拿到
                   `QueryClient` 就能跑，上游 `infinite.test.ts`（594 行）正是
                   直接 `new QueryClient()` 测的，搬过来不用改测试形状。

                   每页显式拥有 threads 与 nextOffset（null 表示服务端已耗尽）。
                   sidecar 过滤、删除和本地插入都不能用可见条数反推服务端进度。
                   普通对象字段经过 TanStack structural sharing 后仍保持同一合同。
*/

import type { InfiniteData, QueryClient } from "@tanstack/vue-query";

import type { ThreadSearchQuery } from "../types/message";

import {
  filterThreadSearchResults,
  type ThreadSearchParams,
} from "./thread-search-query";
import { searchThreadsByArchive } from "./api";
import type { AgentThread, AgentThreadState } from "./types";

export const INFINITE_THREADS_PAGE_SIZE = 50;

export const INFINITE_THREADS_QUERY_KEY_PREFIX = [
  "threads",
  "searchInfinite",
] as const;

/** Server progress belongs to the page, independently of its mutable visible rows. */
export interface InfiniteThreadsPage {
  threads: AgentThread[];
  nextOffset: number | null;
}
export type InfiniteThreadsData = InfiniteData<InfiniteThreadsPage>;

export type InfiniteThreadsParams = Omit<
  ThreadSearchParams,
  "limit" | "offset"
> & {
  /**
   * 只要活跃的（false）、只要已归档的（true）、还是不过滤（undefined）。
   *
   * 一旦给了它，这一页就改走 Gateway 原生的 `POST /api/threads/search`——
   * LangGraph 的 search 不认这个字段，传过去会被**静默忽略**，于是「已归档」
   * 页签拿回来的是整份活跃列表。上游同一条分支
   * （core/threads/hooks.ts 的 `params.archived === undefined ? … : …`）。
   */
  archived?: boolean;
};

type InfiniteThreadsSearchClient = {
  threads: {
    search(query?: ThreadSearchQuery<AgentThreadState>): Promise<AgentThread[]>;
  };
};

export async function fetchInfiniteThreadsPage(
  apiClient: InfiniteThreadsSearchClient,
  params: InfiniteThreadsParams,
  pageParam: number,
  pageSize: number = INFINITE_THREADS_PAGE_SIZE,
): Promise<InfiniteThreadsPage> {
  const threads: AgentThread[] = [];
  let offset = pageParam;
  let nextOffset: number | null = null;

  while (threads.length < pageSize) {
    const currentLimit = pageSize - threads.length;
    const response =
      params.archived === undefined
        ? await apiClient.threads.search({
            ...params,
            limit: currentLimit,
            offset,
          })
        : await searchThreadsByArchive({
            ...params,
            archived: params.archived,
            metadata: params.metadata ?? undefined,
            limit: currentLimit,
            offset,
          });

    threads.push(...filterThreadSearchResults(response, params));
    offset += response.length;

    if (response.length < currentLimit) {
      nextOffset = null;
      break;
    }

    nextOffset = offset;
  }

  return { threads, nextOffset };
}

export function getInfiniteThreadsNextPageParam(
  lastPage: InfiniteThreadsPage,
): number | undefined {
  return lastPage.nextOffset ?? undefined;
}

export function mapInfiniteThreadsCache(
  oldData: InfiniteThreadsData | undefined,
  mapper: (thread: AgentThread) => AgentThread,
): InfiniteThreadsData | undefined {
  if (!oldData) {
    return oldData;
  }
  return {
    ...oldData,
    pages: oldData.pages.map((page) => ({
      ...page,
      threads: page.threads.map(mapper),
    })),
  };
}

export function filterInfiniteThreadsCache(
  oldData: InfiniteThreadsData | undefined,
  predicate: (thread: AgentThread) => boolean,
): InfiniteThreadsData | undefined {
  if (!oldData) {
    return oldData;
  }
  return {
    ...oldData,
    pages: oldData.pages.map((page) => ({
      ...page,
      threads: page.threads.filter(predicate),
    })),
  };
}

/**
 * 已存在的那条**保留本地字段**（`...thread, ...t`），只有 metadata / values 做浅并。
 * 反过来写会让流式过程中刚拿到的标题被一条更早的搜索结果盖回去。
 */
function mergeExistingThread(
  incoming: AgentThread,
  existing: AgentThread,
): AgentThread {
  return {
    ...incoming,
    ...existing,
    metadata: {
      ...(incoming.metadata ?? {}),
      ...(existing.metadata ?? {}),
    },
    values: {
      ...incoming.values,
      ...existing.values,
    },
  };
}

/**
 * 列表缓存的 key 里带不带 `archived` 过滤。
 *
 * 带过滤的那几份，**成员关系是服务端说了算**：一条刚建出来的 thread 身上没有归档
 * 元数据，本地插进「只看未归档」的列表是在替服务端猜（上游同一处的注释：
 * "Run-created snapshots do not carry archive metadata"）。
 */
function hasArchiveFilter({ queryKey }: { queryKey: readonly unknown[] }) {
  return (
    typeof (queryKey[2] as InfiniteThreadsParams | undefined)?.archived ===
    "boolean"
  );
}

export function upsertThreadInInfiniteCache(
  queryClient: QueryClient,
  thread: AgentThread,
) {
  // A run snapshot does not establish archive membership. Only the server
  // may admit a new row into those filtered lists.
  void queryClient.invalidateQueries({
    queryKey: INFINITE_THREADS_QUERY_KEY_PREFIX,
    predicate: hasArchiveFilter,
  });
  queryClient.setQueriesData(
    {
      queryKey: INFINITE_THREADS_QUERY_KEY_PREFIX,
      exact: false,
      predicate: (query) => !hasArchiveFilter(query),
    },
    (oldData: InfiniteThreadsData | undefined) => {
      if (!oldData) {
        return oldData;
      }

      const merged = mapInfiniteThreadsCache(oldData, (t) =>
        t.thread_id === thread.thread_id ? mergeExistingThread(thread, t) : t,
      )!;

      const exists = merged.pages.some((page) =>
        page.threads.some((t) => t.thread_id === thread.thread_id),
      );
      if (exists) {
        return merged;
      }

      const firstPage = merged.pages[0] ?? { threads: [], nextOffset: null };
      const restPages = merged.pages.slice(1);
      return {
        ...oldData,
        pages: [
          { ...firstPage, threads: [thread, ...firstPage.threads] },
          ...restPages,
        ],
      };
    },
  );
}
