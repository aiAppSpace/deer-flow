/*
  【文件职责】     thread 历史的 vue-query 无限查询与跨刷新对账（05 C1 / C6）。
  【架构位置】     L3（Vue 适配）
  【主要导出】     useThreadHistory
  【依赖关系】     @tanstack/vue-query · @/core/threads/history · message-identity
  【边界与注意】   上游用 `useState` + `useEffect` 保留上一次的行集（C6：历史失效时
                   保留已加载的页）。Vue 侧用普通 `ref` 加一次 `watch(..., {
                   immediate: true })`——**`immediate` 不能省（05 M5）**：
                   保留态的第一帧就是「刚拿到第一页」，惰性 watch 会让第一页
                   永远不进保留区，表现是第一次后台刷新就把首屏抹掉。

                   `threadId` 收 `MaybeRefOrGetter` 而不是 string：查询 key 必须
                   随 thread 变，写成裸 string 的话切 thread 不重新取数——
                   这是 vue-query 与 react-query 最容易踩错的一处差异。

                   **这里没有、也不该有 checkpoint 退路。** 曾经写过一支「第一页为空
                   就改取 `POST /history`」，那是在 runner 还没有 checkpoint 种子时
                   的补救。上游 `useThreadHistory`（hooks.ts:2623）是**纯分页**，
                   checkpoint 由 `useStream` 无条件取一次、经归并覆盖在分页行上。
                   本仓现在也是这个形状：种子在 `useThreadStream` 里喂进 runner
                   （见 `@/core/threads/checkpoint-seed`）。把退路留着会有两个后果——
                   同一条线程发两次 `/history`（实测在 browser-feature 这类空事件库
                   场景里就是多出来的一条请求），以及退路造出来的行与种子行形状不同，
                   两条路径各自演化。
*/

import { useInfiniteQuery } from "@tanstack/vue-query";
import { computed, ref, toValue, watch, type MaybeRefOrGetter } from "vue";

import { fetch } from "@/core/api/fetcher";
import { readGatewayResponseError } from "@/core/api/errors";
import { getBackendBaseURL } from "@/core/config";
import {
  buildThreadMessagesPageUrl,
  flattenThreadHistoryPages,
  getThreadHistoryNextPageParam,
  parseThreadMessagesPageResponse,
  reconcileThreadHistoryRows,
  THREAD_HISTORY_QUERY_POLICY,
  threadHistoryQueryKey,
  type ThreadMessagesPageResponse,
} from "@/core/threads/history";
import { buildVisibleHistoryMessages } from "@/core/threads/message-identity";
import type { RunMessage } from "@/core/threads/types";

const EMPTY_RUN_MESSAGES: RunMessage[] = [];

export interface UseThreadHistoryOptions {
  enabled?: MaybeRefOrGetter<boolean>;
  pendingSupersededRunIds?: MaybeRefOrGetter<ReadonlySet<string>>;
  /** Query failures stay observable; the application owns the user notification. */
  onError?: (error: Error) => void;
}

export function useThreadHistory(
  threadId: MaybeRefOrGetter<string>,
  options: UseThreadHistoryOptions = {},
) {
  const { enabled = true, pendingSupersededRunIds } = options;

  const historyQuery = useInfiniteQuery<
    ThreadMessagesPageResponse,
    Error,
    { pages: ThreadMessagesPageResponse[]; pageParams: (number | null)[] },
    readonly unknown[],
    number | null
  >({
    ...THREAD_HISTORY_QUERY_POLICY,
    queryKey: computed(() => threadHistoryQueryKey(toValue(threadId))),
    enabled: computed(() => toValue(enabled) && Boolean(toValue(threadId))),
    initialPageParam: null,
    queryFn: async ({ pageParam, signal }) => {
      const url = buildThreadMessagesPageUrl(
        getBackendBaseURL(),
        toValue(threadId),
        pageParam ?? undefined,
      );
      const response = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        signal,
      });
      if (!response.ok) {
        throw await readGatewayResponseError(
          response,
          "Failed to load thread history.",
        );
      }
      return parseThreadMessagesPageResponse(await response.json());
    },
    getNextPageParam: getThreadHistoryNextPageParam,
  });

  watch(
    historyQuery.error,
    (error) => {
      if (error) options.onError?.(error);
    },
    { immediate: true },
  );

  let loadMorePromise: ReturnType<typeof historyQuery.fetchNextPage> | null =
    null;

  function loadMore() {
    if (!historyQuery.hasNextPage.value) return Promise.resolve();
    if (loadMorePromise) return loadMorePromise;
    loadMorePromise = historyQuery.fetchNextPage().finally(() => {
      loadMorePromise = null;
    });
    return loadMorePromise;
  }

  const currentMessageRows = computed(() =>
    flattenThreadHistoryPages(historyQuery.data.value?.pages ?? []),
  );

  const retainedHistory = ref<{ threadId: string; rows: RunMessage[] }>({
    threadId: toValue(threadId),
    rows: EMPTY_RUN_MESSAGES,
  });

  const previousRows = computed(() =>
    retainedHistory.value.threadId === toValue(threadId)
      ? retainedHistory.value.rows
      : EMPTY_RUN_MESSAGES,
  );

  const isAuthoritativeComplete = computed(() => {
    const pages = historyQuery.data.value?.pages ?? [];
    return (
      historyQuery.isSuccess.value &&
      !historyQuery.isFetching.value &&
      pages.length > 0 &&
      pages.at(-1)?.has_more === false
    );
  });

  const messageRows = computed(() =>
    reconcileThreadHistoryRows(
      previousRows.value,
      currentMessageRows.value,
      isAuthoritativeComplete.value,
    ),
  );

  // 05 M5：`immediate` 不是可选项，理由见文件头。
  watch(
    [messageRows, () => toValue(threadId)],
    ([rows, id]) => {
      if (
        retainedHistory.value.threadId === id &&
        retainedHistory.value.rows === rows
      ) {
        return;
      }
      retainedHistory.value = { threadId: id, rows };
    },
    { immediate: true },
  );

  const messages = computed(() =>
    buildVisibleHistoryMessages(
      messageRows.value,
      (pendingSupersededRunIds
        ? toValue(pendingSupersededRunIds)
        : undefined) ?? new Set<string>(),
    ),
  );

  /**
   * 历史「已经问完了」——不是「暂时没在加载」。
   *
   * 不能用 `!isLoading && !hasNextPage` 代替：TanStack 的 `isLoading` 是
   * `isPending && isFetching`，查询已启用但还没真正发出请求的那一瞬间它是 false，
   * 于是会出现「一帧看起来历史已经空了」的窗口。谁拿这个窗口做跳转决定，
   * 谁就会把有历史的线程踢走。
   *
   * 请求失败也算问完了：调用方需要一个终点，否则错误状态下永远等不到结论。
   */
  const settled = computed(
    () =>
      isAuthoritativeComplete.value ||
      (historyQuery.isError.value && !historyQuery.isFetching.value),
  );

  return {
    messages,
    settled,
    loading: computed(
      () =>
        historyQuery.isLoading.value || historyQuery.isFetchingNextPage.value,
    ),
    loadingInitial: historyQuery.isLoading,
    loadingMore: historyQuery.isFetchingNextPage,
    hasMore: computed(() => Boolean(historyQuery.hasNextPage.value)),
    loadMore,
    error: historyQuery.error,
  };
}
