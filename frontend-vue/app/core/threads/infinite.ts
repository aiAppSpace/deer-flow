/*
  【文件职责】     侧栏无限列表的分页取数、游标推导与缓存镜像写入。
  【架构位置】     L3
  【主要导出】     INFINITE_THREADS_PAGE_SIZE · INFINITE_THREADS_QUERY_KEY_PREFIX
                   fetchInfiniteThreadsPage · getInfiniteThreadsNextPageParam
                   mapInfiniteThreadsCache · filterInfiniteThreadsCache
                   upsertThreadInSearchCache · upsertThreadInInfiniteCache
  【依赖关系】     @tanstack/vue-query（仅类型与 QueryClient）· ./thread-search-query
  【边界与注意】   这是本仓第一次 import `@tanstack/vue-query`。它进 `core/` 而不是
                   `composables/`，因为这几个函数**不用组件上下文**：拿到
                   `QueryClient` 就能跑，上游 `infinite.test.ts`（594 行）正是
                   直接 `new QueryClient()` 测的，搬过来不用改测试形状。

                   `getInfiniteThreadsNextPageParam` 的 Symbol 标注不是优化。
                   sidecar 过滤会让一页的**返回条数少于取回条数**，此时
                   「页满 = 还有下一页」不成立；真实 offset 由取数函数写在页上。
                   删掉标注、退回按长度推导，表现是长列表在某个位置永远翻不动。
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

const INFINITE_THREADS_NEXT_PAGE_PARAM = Symbol(
  "deerflow.infiniteThreads.nextPageParam",
);

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

type InfiniteThreadsPageWithNextParam = AgentThread[] & {
  [INFINITE_THREADS_NEXT_PAGE_PARAM]?: number;
};

function annotateInfiniteThreadsPage(
  page: AgentThread[],
  nextPageParam: number | undefined,
): AgentThread[] {
  if (nextPageParam !== undefined) {
    Reflect.set(page, INFINITE_THREADS_NEXT_PAGE_PARAM, nextPageParam);
  }
  return page;
}

export async function fetchInfiniteThreadsPage(
  apiClient: InfiniteThreadsSearchClient,
  params: InfiniteThreadsParams,
  pageParam: number,
  pageSize: number = INFINITE_THREADS_PAGE_SIZE,
): Promise<AgentThread[]> {
  const threads: AgentThread[] = [];
  let offset = pageParam;
  let nextPageParam: number | undefined;

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
            archived: params.archived,
            metadata: params.metadata ?? undefined,
            limit: currentLimit,
            offset,
          });

    threads.push(...filterThreadSearchResults(response, params));
    offset += response.length;

    if (response.length < currentLimit) {
      nextPageParam = undefined;
      break;
    }

    nextPageParam = offset;
  }

  return annotateInfiniteThreadsPage(threads, nextPageParam);
}

export function getInfiniteThreadsNextPageParam(
  lastPage: AgentThread[],
  allPages: AgentThread[][],
  pageSize: number = INFINITE_THREADS_PAGE_SIZE,
): number | undefined {
  const annotatedNextPageParam = Reflect.get(
    lastPage as InfiniteThreadsPageWithNextParam,
    INFINITE_THREADS_NEXT_PAGE_PARAM,
  );
  if (typeof annotatedNextPageParam === "number") {
    return annotatedNextPageParam;
  }

  if (lastPage.length < pageSize) {
    return undefined;
  }
  return allPages.reduce((sum, page) => sum + page.length, 0);
}

export function mapInfiniteThreadsCache(
  oldData: InfiniteData<AgentThread[]> | undefined,
  mapper: (thread: AgentThread) => AgentThread,
): InfiniteData<AgentThread[]> | undefined {
  if (!oldData) {
    return oldData;
  }
  return {
    ...oldData,
    pages: oldData.pages.map((page) => page.map(mapper)),
  };
}

export function filterInfiniteThreadsCache(
  oldData: InfiniteData<AgentThread[]> | undefined,
  predicate: (thread: AgentThread) => boolean,
): InfiniteData<AgentThread[]> | undefined {
  if (!oldData) {
    return oldData;
  }
  return {
    ...oldData,
    pages: oldData.pages.map((page) => page.filter(predicate)),
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

export function upsertThreadInSearchCache(
  queryClient: QueryClient,
  thread: AgentThread,
) {
  queryClient.setQueriesData(
    {
      queryKey: ["threads", "search"],
      exact: false,
    },
    (oldData: AgentThread[] | undefined) => {
      if (!oldData) {
        return [thread];
      }

      const existingIndex = oldData.findIndex(
        (t) => t.thread_id === thread.thread_id,
      );
      if (existingIndex === -1) {
        return [thread, ...oldData];
      }

      return oldData.map((t, index) =>
        index === existingIndex ? mergeExistingThread(thread, t) : t,
      );
    },
  );
}

export function upsertThreadInInfiniteCache(
  queryClient: QueryClient,
  thread: AgentThread,
) {
  queryClient.setQueriesData(
    {
      queryKey: INFINITE_THREADS_QUERY_KEY_PREFIX,
      exact: false,
    },
    (oldData: InfiniteData<AgentThread[]> | undefined) => {
      if (!oldData) {
        return oldData;
      }

      const merged = oldData.pages.map((page) =>
        page.map((t) =>
          t.thread_id === thread.thread_id ? mergeExistingThread(thread, t) : t,
        ),
      );

      const exists = merged.some((page) =>
        page.some((t) => t.thread_id === thread.thread_id),
      );
      if (exists) {
        return { ...oldData, pages: merged };
      }

      const firstPage = merged[0] ?? [];
      const restPages = merged.slice(1);
      return {
        ...oldData,
        pages: [[thread, ...firstPage], ...restPages],
      };
    },
  );
}
