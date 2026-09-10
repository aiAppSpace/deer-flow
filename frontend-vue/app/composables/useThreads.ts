/*
  【文件职责】     Vue Query 的 thread 列表唯一 server-state 所有者与写操作镜像。
  【架构位置】     L3 Vue adapter
  【主要导出】     useThreads
  【依赖关系】     core/threads/infinite · delete · cache-invalidation
  【边界与注意】   主列表永远走 sidecar 过滤后的 raw-offset 分页；不得另存副本。
*/
import {
  useInfiniteQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/vue-query";
import { computed, reactive, toValue, watch, type MaybeRefOrGetter } from "vue";

import { getAPIClient } from "@/core/api/api-client";
import { removeDeletedThreadCaches } from "@/core/threads/cache-invalidation";
import {
  fetchInfiniteThreadsPage,
  getInfiniteThreadsNextPageParam,
  INFINITE_THREADS_PAGE_SIZE,
  INFINITE_THREADS_QUERY_KEY_PREFIX,
  mapInfiniteThreadsCache,
  type InfiniteThreadsParams,
  upsertThreadInInfiniteCache,
  upsertThreadInSearchCache,
} from "@/core/threads/infinite";
import {
  deleteThreadCascade,
  ThreadCascadeDeleteError,
} from "@/core/threads/delete";
import { patchThreadMetadata } from "@/core/threads/api";
import { buildThreadListView } from "@/core/threads/thread-list-model";
import { mergeThreadSnapshot } from "@/core/threads/thread-snapshot";
import type { AgentThread } from "@/core/threads/types";
import {
  isThreadPinned,
  THREAD_PINNED_METADATA_KEY,
} from "@/core/threads/utils";
import { getSessionComposerDraftStorage } from "@/core/threads/composer-draft";
import { clearComposerDrafts } from "@/core/threads/composer-draft-lifecycle";

/*
  四个字段，与 React 的 useInfiniteThreads 默认参数逐字相同
  （frontend/src/core/threads/hooks.ts）。原来多要了一个 `status`，而列表这条路径上
  没有任何消费者读它——多要一个字段不会报错，只会让两个应用向 Gateway 要的东西不一样，
  而这份差异藏在 POST body 里，对照取样只比 method+path+query，永远看不见。
*/
const THREAD_LIST_PARAMS: InfiniteThreadsParams = {
  sortBy: "updated_at",
  sortOrder: "desc",
  select: ["thread_id", "updated_at", "values", "metadata"],
};

/**
 * The single Vue Query owner for server thread-list state.
 *
 * `archived` 是**响应式**的：会话列表页有活跃/已归档两个页签，切页签换的是
 * query key 而不是过滤内存里的数组——归档的会话根本不在活跃那份响应里。
 *
 * **不传就是 `false`（只要活跃的），不是"不过滤"。** Gateway 的语义是
 * 「omitted includes all」（`backend/app/gateway/routers/threads.py:459`），
 * 所以此前不传的三个消费者——侧栏、聊天页、项目分区——把**已归档的会话
 * 一起列了出来**。上游在每个调用点各写一次 `archived: false`
 * （recent-chat-list.tsx:478、projects-section.tsx:156）。
 *
 * 这里把它放进默认值而不是照抄到每个调用点，是因为漏写的代价不只是"少了个过滤"：
 * `archived` 进 query key，漏写的那个消费者会拿到**另一份缓存**，于是多打一次网络、
 * 而且 AgentChat 的 `upsert` 落不进侧栏那份。三个消费者必须是同一个 key，
 * 而"必须一致"这件事交给默认值来保证，比交给三处各写一遍可靠。
 * 想看已归档的那份，显式传 `true`。
 */
export function useThreads(
  options: { archived?: MaybeRefOrGetter<boolean> } = {},
) {
  const queryClient = useQueryClient();
  const apiClient = getAPIClient();
  const params = computed<InfiniteThreadsParams>(() => ({
    ...THREAD_LIST_PARAMS,
    archived: toValue(options.archived) ?? false,
  }));
  const queryKey = computed(
    () => [...INFINITE_THREADS_QUERY_KEY_PREFIX, params.value] as const,
  );
  const query = useInfiniteQuery({
    queryKey,
    enabled: false,
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      fetchInfiniteThreadsPage(
        apiClient,
        { ...params.value, signal },
        Number(pageParam),
        INFINITE_THREADS_PAGE_SIZE,
      ),
    /*
      **只传两个参数。** 直接把函数交给 Vue Query，它会按
      `(lastPage, allPages, lastPageParam, allPageParams)` 调用，第三个实参落进
      本函数的 `pageSize`——于是 `pageSize` 变成上一页的 offset（首屏是 0），
      `lastPage.length < pageSize` 永远为假，「还有下一页」永远为真。
      表现是每次加载完列表都会再多问一页，问回来是空的，谁也看不出哪里不对。
      React 那边写的就是显式的两参箭头函数（frontend/src/core/threads/hooks.ts）。
    */
    getNextPageParam: (lastPage, allPages) =>
      getInfiniteThreadsNextPageParam(lastPage, allPages),
  });

  /*
    去重与排序、以及侧栏可见条数的上限，都走 core/threads/thread-list-model 的
    同一份规则（React 的 buildThreadListModel）。`threads` 是全量（列表页用），
    `displayedThreads` 是置顶 + 前 200 条（侧栏用），`canLoadMore` 是侧栏那颗
    「加载更早的对话」按钮的出现条件之一——超过上限之后再翻页也不会有新行出现，
    所以按钮要收起来。
  */
  const view = computed(() => {
    const byId = new Map<string, AgentThread>();
    for (const page of query.data.value?.pages ?? []) {
      for (const thread of page) {
        byId.set(
          thread.thread_id,
          mergeThreadSnapshot(byId.get(thread.thread_id), thread),
        );
      }
    }
    return buildThreadListView([...byId.values()]);
  });
  const threads = computed(() => view.value.threads);
  const displayedThreads = computed(() => view.value.displayedThreads);
  let initialLoadRequested = false;

  async function loadInitial(force = false) {
    if (force || !initialLoadRequested) {
      initialLoadRequested = true;
      await query.refetch();
    }
  }

  /*
    换页签就是换 query key，新 key 名下一页数据都没有。`enabled: false` 的查询
    不会自己跑，而 `loadInitial` 有一道「只首屏取一次」的守卫——不在这里重置它，
    切到「已归档」会停在一个永远空的列表上，看起来就像用户一条归档都没有。
  */
  watch(params, () => {
    initialLoadRequested = false;
    void loadInitial();
  });

  let loadMorePromise: ReturnType<typeof query.fetchNextPage> | null = null;
  function loadMore() {
    if (
      loadMorePromise ||
      query.isFetchingNextPage.value ||
      !query.hasNextPage.value
    ) {
      return loadMorePromise ?? Promise.resolve();
    }
    loadMorePromise = query.fetchNextPage().finally(() => {
      loadMorePromise = null;
    });
    return loadMorePromise;
  }

  function upsert(thread: AgentThread) {
    const existing = threads.value.find(
      (candidate) => candidate.thread_id === thread.thread_id,
    );
    if (existing) {
      const merged = mergeThreadSnapshot(existing, thread);
      updateCachedThread(thread.thread_id, (cached) =>
        mergeThreadSnapshot(cached, merged),
      );
      return;
    }
    if (!queryClient.getQueryData(queryKey.value)) {
      queryClient.setQueryData(queryKey.value, {
        pages: [[thread]],
        pageParams: [0],
      });
    }
    upsertThreadInSearchCache(queryClient, thread);
    upsertThreadInInfiniteCache(queryClient, thread);
  }

  function updateCachedThread(
    threadId: string,
    updater: (thread: AgentThread) => AgentThread,
  ) {
    queryClient.setQueriesData(
      { queryKey: ["threads", "search"], exact: false },
      (oldData: AgentThread[] | undefined) =>
        oldData?.map((thread) =>
          thread.thread_id === threadId ? updater(thread) : thread,
        ),
    );
    queryClient.setQueriesData(
      { queryKey: INFINITE_THREADS_QUERY_KEY_PREFIX, exact: false },
      (oldData: InfiniteData<AgentThread[]> | undefined) =>
        mapInfiniteThreadsCache(oldData, (thread) =>
          thread.thread_id === threadId ? updater(thread) : thread,
        ),
    );
  }

  function upsertCreated(
    threadId: string,
    title: string,
    agentName?: string | null,
  ) {
    const now = new Date().toISOString();
    upsert({
      thread_id: threadId,
      created_at: now,
      updated_at: now,
      metadata: agentName ? { agent_name: agentName } : {},
      status: "idle",
      values: { title, messages: [] },
      interrupts: {},
      context: agentName
        ? {
            thread_id: threadId,
            agent_name: agentName,
            model_name: undefined,
            thinking_enabled: false,
            is_plan_mode: false,
            subagent_enabled: false,
          }
        : undefined,
    });
  }

  async function setPinned(threadId: string, pinned: boolean) {
    await patchThreadMetadata(threadId, {
      [THREAD_PINNED_METADATA_KEY]: pinned,
    });
    const existing = threads.value.find(
      (thread) => thread.thread_id === threadId,
    );
    if (existing) {
      updateCachedThread(threadId, (thread) => ({
        ...thread,
        metadata: {
          ...thread.metadata,
          [THREAD_PINNED_METADATA_KEY]: pinned,
        },
      }));
    }
  }

  async function remove(threadId: string) {
    try {
      const deletedIds = await deleteThreadCascade(apiClient, threadId);
      removeDeletedThreadCaches(queryClient, deletedIds);
      for (const deletedId of deletedIds) {
        clearComposerDrafts(
          getSessionComposerDraftStorage() as Storage | null,
          {
            threadId: deletedId,
          },
        );
      }
    } catch (error) {
      if (error instanceof ThreadCascadeDeleteError) {
        removeDeletedThreadCaches(queryClient, error.deletedThreadIds);
        for (const deletedId of error.deletedThreadIds) {
          clearComposerDrafts(
            getSessionComposerDraftStorage() as Storage | null,
            { threadId: deletedId },
          );
        }
      }
      throw error;
    }
  }

  async function rename(threadId: string, title: string) {
    await apiClient.threads.updateState(threadId, { values: { title } });
    const existing = threads.value.find(
      (thread) => thread.thread_id === threadId,
    );
    if (existing)
      updateCachedThread(threadId, (thread) => ({
        ...thread,
        values: { ...thread.values, title },
      }));
  }

  return reactive({
    threads,
    displayedThreads,
    hasMore: computed(() => Boolean(query.hasNextPage.value)),
    canLoadMore: computed(() => view.value.canLoadMore),
    loading: computed(() => query.isFetching.value),
    loadingMore: computed(() => query.isFetchingNextPage.value),
    error: query.error,
    loadInitial,
    loadMore,
    upsert,
    upsertCreated,
    setPinned,
    remove,
    rename,
    isPinned: isThreadPinned,
  });
}
