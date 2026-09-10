/*
  【文件职责】     用 Vue Query 暴露后台任务列表/详情与取消。
  【架构位置】     L3 composable
  【主要导出】     useBackgroundTasks · useBackgroundTask · useCancelBackgroundTask
  【依赖关系】     @tanstack/vue-query · core/background-tasks
  【边界与注意】   **轮询间隔随状态变，不是一个固定值**：有活跃任务时 3 秒，
                   全都结束了退到 15 秒。写死 3 秒的话，一条早就完成的会话会一直
                   每 3 秒问一次；写死 15 秒的话，用户盯着「运行中」要等 15 秒
                   才看到它变完成。

                   `refetchIntervalInBackground: false`：标签页在后台时停掉。
                   这是个后台任务列表，用户没在看的时候没有人需要这份新鲜度。

                   详情的轮询判据比列表**多一条**（见 types 的
                   `shouldPollBackgroundTaskDetail`）：任务完成了但通知还在重试时
                   仍要继续问，否则详情停在「已完成」，而结果其实还没送到。

                   取消成功后**就地写回两处缓存再失效**：只失效不写回的话，用户点完
                   取消，卡片还显示「运行中」直到下一次轮询回来。
*/

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/vue-query";
import { computed, toValue, type MaybeRefOrGetter } from "vue";

import {
  backgroundTaskKeys,
  cancelBackgroundTask,
  fetchBackgroundTask,
  fetchBackgroundTasks,
  isActiveBackgroundTask,
  shouldPollBackgroundTaskDetail,
  type BackgroundTask,
  type BackgroundTaskDetail,
} from "@/core/background-tasks";

const ACTIVE_POLL_MS = 3_000;
const IDLE_POLL_MS = 15_000;

export function useBackgroundTasks(
  threadId: MaybeRefOrGetter<string>,
  options: { enabled?: MaybeRefOrGetter<boolean> } = {},
) {
  return useQuery({
    queryKey: computed(() => backgroundTaskKeys.list(toValue(threadId))),
    queryFn: () => fetchBackgroundTasks(toValue(threadId)),
    enabled: computed(
      () => toValue(options.enabled) !== false && Boolean(toValue(threadId)),
    ),
    refetchInterval: (query) =>
      query.state.data?.some(isActiveBackgroundTask)
        ? ACTIVE_POLL_MS
        : IDLE_POLL_MS,
    refetchIntervalInBackground: false,
  });
}

export function useBackgroundTask(
  threadId: MaybeRefOrGetter<string>,
  taskId: MaybeRefOrGetter<string>,
  options: { enabled?: MaybeRefOrGetter<boolean> } = {},
) {
  return useQuery({
    queryKey: computed(() =>
      backgroundTaskKeys.detail(toValue(threadId), toValue(taskId)),
    ),
    queryFn: () => fetchBackgroundTask(toValue(threadId), toValue(taskId)),
    enabled: computed(
      () =>
        toValue(options.enabled) !== false &&
        Boolean(toValue(threadId)) &&
        Boolean(toValue(taskId)),
    ),
    refetchInterval: (query) =>
      query.state.data && shouldPollBackgroundTaskDetail(query.state.data)
        ? ACTIVE_POLL_MS
        : false,
    refetchIntervalInBackground: false,
  });
}

/** 取消成功后把新详情写回列表里的那一行，不等下一次轮询。 */
function writeCancelledTask(
  queryClient: QueryClient,
  threadId: string,
  task: BackgroundTaskDetail,
) {
  queryClient.setQueryData(
    backgroundTaskKeys.detail(threadId, task.task_id),
    task,
  );
  queryClient.setQueryData(
    backgroundTaskKeys.list(threadId),
    (current: BackgroundTask[] | undefined) =>
      current?.map((item) => (item.task_id === task.task_id ? task : item)),
  );
}

export function useCancelBackgroundTask(
  threadId: MaybeRefOrGetter<string>,
  options: { onError?: (error: Error) => void } = {},
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) =>
      cancelBackgroundTask(toValue(threadId), taskId),
    onSuccess: (task) => {
      const id = toValue(threadId);
      writeCancelledTask(queryClient, id, task);
      void queryClient.invalidateQueries({
        queryKey: backgroundTaskKeys.list(id),
      });
    },
    onError: (error: Error) => options.onError?.(error),
  });
}
