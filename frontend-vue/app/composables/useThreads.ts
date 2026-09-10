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
import { computed, reactive, toValue, type MaybeRefOrGetter } from "vue";

import { getAPIClient } from "@/core/api/api-client";
import { projectKeys } from "@/core/projects/query-keys";
import { removeDeletedThreadCaches } from "@/core/threads/cache-invalidation";
import {
  fetchInfiniteThreadsPage,
  getInfiniteThreadsNextPageParam,
  INFINITE_THREADS_PAGE_SIZE,
  INFINITE_THREADS_QUERY_KEY_PREFIX,
  mapInfiniteThreadsCache,
  type InfiniteThreadsParams,
  upsertThreadInInfiniteCache,
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
  options: {
    archived?: MaybeRefOrGetter<boolean>;
    /**
     * 这个调用点要不要**自己发请求**。缺省要。
     *
     * 只读缓存的调用点（`AgentChat.vue` 读 `headerTitle`、`ProjectsSection.vue`
     * 读分组）传 `false`：它们与侧栏共用同一个 query key，侧栏取回来的数据它们
     * 直接就能读到，自己再发一次是白发。上游的 chat-page 压根不挂这个查询。
     */
    enabled?: MaybeRefOrGetter<boolean>;
  } = {},
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
  /*
    **查询自己会跑。**（2026-09-11 改；此前是 `enabled: false` 的手动查询，
    `eaf9d6a7` 写下时没有留理由。）

    手动查询在这个仓库里是有代价的，而且代价是量出来的：Vue Query 5 对
    `enabled: false` 的查询，`invalidateQueries` / `refetchQueries`
    （含 `type: "all"`）**都不会跑 queryFn**，`resetQueries` 更是**把数据清空而不重取**。
    于是本仓所有针对列表 key 的失效全是空操作，产生过两个真缺陷：

    - `core/threads/archive.ts` 归档时 `resetQueries` 这个 key——探针实测侧栏
      从 1 条变成 0 条且没有重取，**归档一条会话侧栏就空了**；
    - run 结束后 `invalidateStoppedThreadCaches` 不重取，对照台账上 4 行
      `requestsOnlyReact: POST /api/threads/search` 就是它。

    「谁来发第一次请求」因此交回给 Vue Query，调用点只决定**要不要发**。
  */
  const query = useInfiniteQuery({
    queryKey,
    enabled: computed(() => toValue(options.enabled) ?? true),
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
  /**
   * 现在就再问一次后端。
   *
   * 查询自己会发第一次请求、换页签也会跟着 query key 自己重取，所以这里只剩
   * 「显式重取」这一个用途：`chats/index.vue` 的重试按钮、以及改名之后的收敛。
   * **`force` 之外什么都不做**——留着这个形参是因为两个调用方的语义不同，
   * 把「什么都不做」写出来比让调用方去猜好。
   */
  async function loadInitial(force = false) {
    if (force) await query.refetch();
  }

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
    upsertThreadInInfiniteCache(queryClient, thread);
  }

  function updateCachedThread(
    threadId: string,
    updater: (thread: AgentThread) => AgentThread,
  ) {
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

  /*
    改名之后要做的三件事，与上游 `useRenameThread`
    （frontend/src/core/threads/hooks.ts:3310）同一条：

    1. **先 cancel 在途的列表请求**。改名之前发出的那一个回来时会把旧标题写回缓存
       ——界面先变对、过一会儿又变回去，而且没有任何报错。上游那行注释
       （"Prevent pre-rename snapshot requests from restoring the stale title."）
       说的就是它。
    2. 本地写一遍，界面立刻更新，不等这一轮网络。
    3. 再让**服务端存下来的那一份**成为最终事实：标题被服务端规范化（trim / 截断）、
       或者别的设备并发改过名时，只有这一步能收敛。上游用 `invalidateQueries`；
       本仓的列表是手动查询，只能强制重取，理由写在第 3 步那段里。

    **本仓此前只有第 2 步**，也就是「改完就相信自己写进缓存的那个字符串」。
    对照台账 `thread-title-sync` 上的 `requestsOnlyReact: POST /api/threads/search`
    就是这一步的缺席。

    **没有跟上游的 `GET /api/langgraph/threads/{id}`**：那一条在上游是
    `useThreadMetadata` 这个查询被 invalidate 触发的，而本仓的会话头部直接读列表缓存
    （AgentChat.vue 的 `headerTitle`），没有第二个查询要收敛。为了对上一条请求计数
    去发一个没人读的请求，是搬运不是对齐。判词记在
    docs/plans/vue-parity-open-accounts.md。
  */
  async function rename(threadId: string, title: string) {
    await apiClient.threads.updateState(threadId, { values: { title } });
    await queryClient.cancelQueries({
      queryKey: INFINITE_THREADS_QUERY_KEY_PREFIX,
    });
    updateCachedThread(threadId, (thread) => ({
      ...thread,
      values: { ...thread.values, title },
    }));
    /*
      **列表这一份必须 `loadInitial(true)`，`invalidateQueries` 对它是空操作。**
      本仓的列表查询是 `enabled: false` 的手动查询（见上面 `useInfiniteQuery`），
      失效只会把它标脏，没有观察者会去重取——第一版就是这么写的，
      对照台账那一行 `requestsOnlyReact: POST /api/threads/search` **一行没动**，
      是它把这件事量出来的。上游那边列表是普通 enabled 查询，所以 invalidate 就够。

      **不 await**：调用方（ThreadSidebar.vue 的 `confirmRename`）拿 `await` 的结果
      去关对话框，等重取回来才关等于把一次网络往返压在用户眼前。
      本地那一步已经把界面改对了，这一步只负责稍后收敛。
    */
    void loadInitial(true);
    /*
      项目页那张会话列表是 REST 形状（不在 updateCachedThread 的覆盖里），
      而且是普通 enabled 查询，失效就会重取。
    */
    void queryClient.invalidateQueries({
      queryKey: projectKeys.threadsPrefix(),
    });
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
