import { useQuery } from "@tanstack/vue-query";
import {
  computed,
  onScopeDispose,
  ref,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from "vue";
import { getAPIClient } from "@/core/api/api-client";
import type { DeerFlowRunHandle } from "@/core/agent-deerflow/endpoints";

/** Discover and observe server-started runs without creating a second run. */
export function useActiveThreadRun(options: {
  threadId: MaybeRefOrGetter<string | null>;
  enabled: MaybeRefOrGetter<boolean>;
  streaming: MaybeRefOrGetter<boolean>;
  currentRunId: MaybeRefOrGetter<string | null>;
  streamError: MaybeRefOrGetter<unknown>;
  join: (handle: DeerFlowRunHandle) => Promise<boolean>;
}) {
  const threadId = computed(() => toValue(options.threadId));
  const api = getAPIClient();
  const query = useQuery({
    queryKey: computed(() => ["thread", threadId.value]),
    queryFn: ({ signal, queryKey }) =>
      queryKey[1]
        ? api.runs.list(String(queryKey[1]), { signal })
        : Promise.resolve([]),
    enabled: computed(() => toValue(options.enabled) && !!threadId.value),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const candidate = computed(
    () =>
      query.data.value?.find(
        (run) => run.status === "pending" || run.status === "running",
      )?.run_id ?? null,
  );
  const retry = ref(0);
  let revision = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  let observed: string | null = null;
  let attempts = 0;
  const joining = ref(false);
  const completed = new Set<string>();
  const retryDelays = [1000, 2000];
  const clear = () => {
    clearTimeout(timer);
    timer = undefined;
  };
  watch(
    threadId,
    () => {
      revision += 1;
      clear();
      observed = null;
      attempts = 0;
      joining.value = false;
      completed.clear();
    },
    { flush: "sync" },
  );
  watch(
    candidate,
    () => {
      revision += 1;
      clear();
      observed = null;
      attempts = 0;
      joining.value = false;
    },
    { flush: "sync" },
  );
  watch(
    () => toValue(options.streaming),
    (streaming, previous) => {
      const id = toValue(options.currentRunId);
      if (previous && !streaming && id && !toValue(options.streamError))
        completed.add(id);
    },
    { flush: "sync" },
  );
  watch(
    [
      candidate,
      () => toValue(options.streaming),
      retry,
      () => toValue(options.enabled),
      joining,
    ],
    async ([runId, streaming, , enabled]) => {
      const id = threadId.value;
      if (
        !id ||
        !runId ||
        !enabled ||
        streaming ||
        joining.value ||
        timer ||
        completed.has(runId)
      )
        return;
      if (observed !== runId) {
        observed = runId;
        attempts = 0;
      }
      if (attempts >= 3) return;
      const token = revision;
      attempts += 1;
      joining.value = true;
      try {
        const accepted = await options.join({ threadId: id, runId });
        if (disposed || token !== revision) return;
        if (accepted && !toValue(options.streamError)) completed.add(runId);
        else scheduleRetry(token);
      } catch {
        // The stream owner exposes the actual error. Only the same observer retries.
        if (!disposed && token === revision) scheduleRetry(token);
      } finally {
        if (token === revision) joining.value = false;
      }
    },
    { immediate: true },
  );
  function scheduleRetry(token: number) {
    const delay = retryDelays[attempts - 1];
    if (delay === undefined) return;
    timer = setTimeout(() => {
      timer = undefined;
      if (!disposed && token === revision) retry.value += 1;
    }, delay);
  }
  onScopeDispose(() => {
    disposed = true;
    revision += 1;
    clear();
  });
  return query;
}
