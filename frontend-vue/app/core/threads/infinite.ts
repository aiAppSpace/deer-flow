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
  /*
    插完还要问一次服务端：本地这一条是**猜**的成员关系（见 hasArchiveFilter）。
    上游在这里只失效、**不**乐观插入（`hooks.ts:1281`）。

    **本仓不能照抄那一半**，实测过：`useThreads` 的 `upsert()` 是靠「这条在不在
    当前视图里」来分「新行 / 已有行」的——不插进本地缓存，视图里就永远没有它，
    于是这一轮 run 里后面每一次 `upsert` 都再判一次「新行」、再失效一次，级联出去。
    单场景实测：只失效那版 React 4 次 / 本仓 **6 次**，方向反了过来。
    插 + 失效之后是 React 4 次 / 本仓 4 次。

    ⚠ **这里原来写着「走到这个函数的只有『刚建出来的 thread』那条路」——那句话是错的**
    （第四十八轮订正）。`useThreads.upsert()` 的 else 支真正的含义是「**这条线程不在
    我当前这份列表里**」：列表首取还在飞时 `threads.value` 是空的，于是**每一条既有
    线程都会走到那里**（`AgentChat.vue` 那条 metadata watcher 每开一屏都调一次）。

    这句话写错的代价是实打实的：它让人以为下面这次失效只会落在新建线程上，
    于是调用方那边「先把这条放进空缓存、再调这个函数」看起来无害。
    **而对空缓存来说，上面的 `setQueriesData` 本来就是空操作
    （`infinite.test.ts` 第一条用例钉着），唯一实际发生的就是下面这次失效**——
    放进缓存那一步已经让查询变成「idle 且有数据」，失效于是不再与在飞的首取合并，
    **另发一次体逐字相同的 `POST /api/threads/search`**。对照台账上那两行
    `requestsOnlyVue: POST /api/threads/search` 就是它。
    **`useThreads.upsert()` 现在在空缓存那一支放完就 `return`，不再走到这里**，
    完整读数与判词写在那里。

    走到这里的（列表已经有数据、但没有这条）仍然不会猜错成员关系：
    新建的 thread 不可能已归档；既有线程只会被**合并**进已有页（`exists` 分支）
    或插到第一页最前，紧跟着这次失效带回来的服务端那一份会纠正它。
  */
  void queryClient.invalidateQueries({
    queryKey: INFINITE_THREADS_QUERY_KEY_PREFIX,
    predicate: hasArchiveFilter,
  });
}
