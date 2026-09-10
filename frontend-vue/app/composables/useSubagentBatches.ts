/*
  【文件职责】     用 Vue Query 暴露 subagent 批次列表/条目、控制与重试。
  【架构位置】     L3 composable
  【主要导出】     useSubagentBatches · useSubagentBatchItems ·
                   useControlSubagentBatch · useRetrySubagentBatchItem
  【依赖关系】     @tanstack/vue-query · core/subagent-batches
  【边界与注意】   **worker 没跑就别轮询**：批次不会自己前进，每 2 秒问一次只是
                   在两边烧 CPU。`polling` 因此是一个独立入参，而不是从 enabled 推。

                   条目列表是无限查询，而 Vue Query 的定时重取会把**已加载的每一页**
                   都重新拉一遍。所以只在用户还停在第一页时保持 3 秒轮询，
                   点过「加载更多」之后停掉自动重取——否则一批上千条时，
                   每 3 秒就是十几个请求。手动失效和窗口聚焦仍然会刷新已加载的页。
                   （上游 hooks.ts 里那段注释讲的是同一件事。）

                   重试一个条目要同时失效**批次列表**和**条目列表**：重试改变的是
                   这一条的状态和整批的计数，只刷一半会让进度条和条目自相矛盾。
*/

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/vue-query";
import { computed, toValue, type MaybeRefOrGetter } from "vue";

import {
  controlSubagentBatch,
  fetchSubagentBatchItems,
  fetchSubagentBatches,
  isActiveSubagentBatch,
  retrySubagentBatchItem,
  subagentBatchKeys,
  SUBAGENT_BATCH_ITEMS_PAGE_SIZE,
  type SubagentBatchAction,
} from "@/core/subagent-batches";

const ACTIVE_POLL_MS = 2_000;
const IDLE_POLL_MS = 15_000;
const ITEMS_POLL_MS = 3_000;

export function useSubagentBatches(
  threadId: MaybeRefOrGetter<string>,
  options: {
    enabled?: MaybeRefOrGetter<boolean>;
    polling?: MaybeRefOrGetter<boolean>;
  } = {},
) {
  return useQuery({
    queryKey: computed(() => subagentBatchKeys.list(toValue(threadId))),
    queryFn: () => fetchSubagentBatches(toValue(threadId)),
    enabled: computed(
      () => toValue(options.enabled) !== false && Boolean(toValue(threadId)),
    ),
    refetchInterval: (query) => {
      if (toValue(options.polling) === false) return false;
      return query.state.data?.some(isActiveSubagentBatch)
        ? ACTIVE_POLL_MS
        : IDLE_POLL_MS;
    },
    refetchIntervalInBackground: false,
  });
}

export function useSubagentBatchItems(
  threadId: MaybeRefOrGetter<string>,
  batchId: MaybeRefOrGetter<string>,
  options: {
    enabled?: MaybeRefOrGetter<boolean>;
    polling?: MaybeRefOrGetter<boolean>;
  } = {},
) {
  return useInfiniteQuery({
    queryKey: computed(() =>
      subagentBatchKeys.items(toValue(threadId), toValue(batchId)),
    ),
    queryFn: ({ pageParam }) =>
      fetchSubagentBatchItems(toValue(threadId), toValue(batchId), {
        offset: Number(pageParam),
        limit: SUBAGENT_BATCH_ITEMS_PAGE_SIZE,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === SUBAGENT_BATCH_ITEMS_PAGE_SIZE
        ? allPages.reduce((total, page) => total + page.length, 0)
        : undefined,
    enabled: computed(
      () =>
        toValue(options.enabled) !== false &&
        Boolean(toValue(threadId)) &&
        Boolean(toValue(batchId)),
    ),
    refetchInterval: (query) => {
      if (toValue(options.polling) === false) return false;
      return (query.state.data?.pages.length ?? 0) <= 1 ? ITEMS_POLL_MS : false;
    },
    refetchIntervalInBackground: false,
  });
}

export function useControlSubagentBatch(
  threadId: MaybeRefOrGetter<string>,
  options: { onError?: (error: Error) => void } = {},
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      batchId,
      action,
    }: {
      batchId: string;
      action: SubagentBatchAction;
    }) => controlSubagentBatch(toValue(threadId), batchId, action),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: subagentBatchKeys.list(toValue(threadId)),
      }),
    onError: (error: Error) => options.onError?.(error),
  });
}

export function useRetrySubagentBatchItem(
  threadId: MaybeRefOrGetter<string>,
  batchId: MaybeRefOrGetter<string>,
  options: { onError?: (error: Error) => void } = {},
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) =>
      retrySubagentBatchItem(toValue(threadId), toValue(batchId), itemId),
    onSuccess: () => {
      const thread = toValue(threadId);
      void queryClient.invalidateQueries({
        queryKey: subagentBatchKeys.list(thread),
      });
      void queryClient.invalidateQueries({
        queryKey: subagentBatchKeys.items(thread, toValue(batchId)),
      });
    },
    onError: (error: Error) => options.onError?.(error),
  });
}
