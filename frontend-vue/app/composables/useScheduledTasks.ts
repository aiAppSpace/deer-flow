import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import {
  computed,
  nextTick,
  ref,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from "vue";
import { captureWorkspaceQueryOwner } from "@/core/auth/workspace-queries";
import { GatewayResponseError } from "@/core/api/errors";
import {
  hasActiveRun,
  isActiveRun,
  type ScheduledTask,
  type ScheduledTaskRun,
  type ScheduledTaskRenewal,
} from "@/core/scheduled-tasks/types";
import { ACTIVE_POLL_MS, IDLE_POLL_MS } from "@/core/scheduled-tasks/polling";
import {
  createScheduledTask,
  deleteScheduledTask,
  fetchScheduledTaskRuns,
  fetchScheduledTask,
  fetchScheduledTasks,
  fetchThreadScheduledTasks,
  pauseScheduledTask,
  resumeScheduledTask,
  triggerScheduledTask,
  updateScheduledTask,
  type ScheduledTaskUpdatePayload,
} from "@/core/scheduled-tasks/api";
import { scheduledTaskKeys } from "@/core/scheduled-tasks/query-keys";
export { ACTIVE_POLL_MS, IDLE_POLL_MS } from "@/core/scheduled-tasks/polling";

export function useScheduledTasks(
  threadId: MaybeRefOrGetter<string | null> = null,
  options: { enabled?: MaybeRefOrGetter<boolean> } = {},
) {
  const query = useQuery({
    queryKey: computed(() =>
      toValue(threadId)
        ? scheduledTaskKeys.thread(toValue(threadId)!)
        : scheduledTaskKeys.list(),
    ),
    queryFn: ({ queryKey: key, signal }) =>
      key[1] === "thread"
        ? fetchThreadScheduledTasks(String(key[2]), { signal })
        : fetchScheduledTasks({ signal }),
    enabled: computed(() => toValue(options.enabled) !== false),
    refetchInterval: (q) =>
      (q.state.data ?? []).some(hasActiveRun) ? ACTIVE_POLL_MS : IDLE_POLL_MS,
    refetchIntervalInBackground: false,
  });
  return { ...query, tasks: computed(() => query.data.value ?? []) };
}
export function useThreadScheduledTasks(
  threadId: MaybeRefOrGetter<string | null>,
  options: { enabled?: MaybeRefOrGetter<boolean> } = {},
) {
  return useScheduledTasks(threadId, {
    enabled: () => !!toValue(threadId) && toValue(options.enabled) !== false,
  });
}
export function useScheduledTask(
  taskId: MaybeRefOrGetter<string | null>,
  options: {
    enabled?: MaybeRefOrGetter<boolean>;
    live?: MaybeRefOrGetter<boolean>;
    initialData?: ScheduledTask;
  } = {},
) {
  const enabled = computed(
    () => !!toValue(taskId) && toValue(options.enabled) !== false,
  );
  const notFound = (error: unknown) =>
    error instanceof GatewayResponseError && error.status === 404;
  const query = useQuery({
    queryKey: computed(() => scheduledTaskKeys.task(toValue(taskId) ?? "")),
    queryFn: ({ queryKey, signal }) =>
      fetchScheduledTask(String(queryKey[2]), { signal }),
    enabled,
    initialData: options.initialData,
    staleTime: 0,
    refetchOnMount: true,
    retry: (count, error) => !notFound(error) && count < 2,
    refetchInterval: (q) =>
      notFound(q.state.error) || toValue(options.live) === false
        ? false
        : q.state.data && hasActiveRun(q.state.data)
          ? ACTIVE_POLL_MS
          : IDLE_POLL_MS,
    refetchIntervalInBackground: false,
  });
  watch(
    () => toValue(options.live),
    (live, previous) => {
      if (live && previous === false && enabled.value) void query.refetch();
    },
  );
  return query;
}
export const RUN_HISTORY_PAGE_SIZE = 50;
export { isActiveRun } from "@/core/scheduled-tasks/types";
export function runHistoryRefetchInterval(
  runs: readonly ScheduledTaskRun[] | undefined,
  page: number,
): number | false {
  return page === 0
    ? (runs ?? []).some(isActiveRun)
      ? ACTIVE_POLL_MS
      : IDLE_POLL_MS
    : false;
}
export function useScheduledTaskRunHistory(
  taskId: MaybeRefOrGetter<string | null>,
) {
  const client = useQueryClient();
  const page = ref(0);
  let moving = false;
  let active = new Set<string>();
  watch(
    () => toValue(taskId),
    () => {
      page.value = 0;
      active = new Set();
    },
    { flush: "sync" },
  );
  const query = useQuery({
    queryKey: computed(() =>
      scheduledTaskKeys.runPage(toValue(taskId) ?? "", page.value),
    ),
    queryFn: ({ queryKey, signal }) =>
      fetchScheduledTaskRuns(String(queryKey[2]), {
        limit: RUN_HISTORY_PAGE_SIZE + 1,
        offset: Number(queryKey[3]) * RUN_HISTORY_PAGE_SIZE,
        signal,
      }),
    enabled: computed(() => !!toValue(taskId)),
    refetchInterval: (q) => runHistoryRefetchInterval(q.state.data, page.value),
    refetchIntervalInBackground: false,
    refetchOnMount: computed(() => page.value === 0),
    refetchOnWindowFocus: computed(() => page.value === 0),
    refetchOnReconnect: computed(() => page.value === 0),
  });
  watch(query.data, (data) => {
    if (page.value !== 0 || !data) return;
    const finished = data.some(
      (run) => active.has(run.id) && !isActiveRun(run),
    );
    active = new Set(data.filter(isActiveRun).map((run) => run.id));
    if (finished)
      void client.invalidateQueries({
        queryKey: scheduledTaskKeys.root(),
        predicate: (q) => q.queryKey[1] !== "runs",
      });
  });
  // This observer shares page zero's cache and never refreshes it while history shows an older page.
  const newest = useQuery({
    queryKey: computed(() =>
      scheduledTaskKeys.runPage(toValue(taskId) ?? "", 0),
    ),
    queryFn: ({ queryKey, signal }) =>
      fetchScheduledTaskRuns(String(queryKey[2]), {
        limit: RUN_HISTORY_PAGE_SIZE + 1,
        offset: 0,
        signal,
      }),
    enabled: computed(() => !!toValue(taskId)),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  return {
    ...query,
    runs: computed(
      () => query.data.value?.slice(0, RUN_HISTORY_PAGE_SIZE) ?? [],
    ),
    latestRuns: computed(
      () => newest.data.value?.slice(0, RUN_HISTORY_PAGE_SIZE) ?? [],
    ),
    page,
    hasOlder: computed(
      () => (query.data.value?.length ?? 0) > RUN_HISTORY_PAGE_SIZE,
    ),
    older: () => {
      if (
        moving ||
        query.isFetching.value ||
        (query.data.value?.length ?? 0) <= RUN_HISTORY_PAGE_SIZE
      )
        return;
      moving = true;
      page.value += 1;
      void nextTick(() => {
        moving = false;
      });
    },
    newer: () => {
      if (!query.isFetching.value) page.value = Math.max(0, page.value - 1);
    },
    latest: () => {
      page.value = 0;
      void client.invalidateQueries({
        queryKey: scheduledTaskKeys.runPage(toValue(taskId) ?? "", 0),
        exact: true,
      });
    },
  };
}
export function useScheduledTaskMutations() {
  const queryClient = useQueryClient();
  function ownedMutation<TInput, TResult>(
    perform: (input: TInput) => Promise<TResult>,
  ) {
    type Variables = { input: TInput; owns: () => boolean };
    const mutation = useMutation({
      mutationFn: ({ input }: Variables) => perform(input),
      onSuccess: (_data, { owns }) => {
        if (owns())
          return queryClient.invalidateQueries({
            queryKey: scheduledTaskKeys.root(),
          });
      },
    });
    const snapshot = (input: TInput): Variables => ({
      input,
      owns: captureWorkspaceQueryOwner(queryClient),
    });
    return {
      ...mutation,
      variables: computed(() => mutation.variables.value?.input),
      mutate: (input: TInput) => mutation.mutate(snapshot(input)),
      mutateAsync: (input: TInput) => mutation.mutateAsync(snapshot(input)),
    };
  }
  const create = ownedMutation(createScheduledTask);
  const update = ownedMutation(
    ({
      task,
      payload,
    }: {
      task: ScheduledTask;
      payload: ScheduledTaskUpdatePayload;
    }) => updateScheduledTask(task.id, payload),
  );
  const pause = ownedMutation(({ task }: { task: ScheduledTask }) =>
    pauseScheduledTask(task.id),
  );
  const resume = ownedMutation(
    ({
      task,
      renewal,
    }: {
      task: ScheduledTask;
      renewal?: ScheduledTaskRenewal;
    }) => resumeScheduledTask(task.id, renewal),
  );
  const trigger = ownedMutation(({ task }: { task: ScheduledTask }) =>
    triggerScheduledTask(task.id),
  );
  const remove = ownedMutation(({ task }: { task: ScheduledTask }) =>
    deleteScheduledTask(task.id),
  );
  return { create, update, pause, resume, trigger, remove };
}
