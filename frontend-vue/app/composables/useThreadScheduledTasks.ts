import { useQuery, useQueryClient } from "@tanstack/vue-query";
import { computed, toValue, watch, type MaybeRefOrGetter } from "vue";
import { useScheduledTasksFeature } from "./useSchedulerFeatures";
import { useThreadScheduledTasks } from "./useScheduledTasks";
import {
  fetchThreadScheduledTaskEvents,
  threadTasksFingerprint,
} from "@/core/scheduled-tasks/events";
import { scheduledTaskKeys } from "@/core/scheduled-tasks/query-keys";
import {
  parseScheduleToolResult,
  SCHEDULE_TASK_TOOL_NAME,
} from "@/core/scheduled-tasks/tool-result";
import type { ThreadScheduledTask } from "@/core/scheduled-tasks/types";
import type { Message } from "@/core/types/message";

export function useThreadScheduledTaskEvents(
  threadId: MaybeRefOrGetter<string | null>,
  options: {
    isNewThread?: MaybeRefOrGetter<boolean>;
    enabled?: MaybeRefOrGetter<boolean>;
  } = {},
) {
  const feature = useScheduledTasksFeature();
  const active = computed(
    () =>
      toValue(options.enabled) !== false &&
      !toValue(options.isNewThread) &&
      !!toValue(threadId) &&
      feature.available.value,
  );
  const query = useQuery({
    queryKey: computed(() => scheduledTaskKeys.events(toValue(threadId) ?? "")),
    queryFn: ({ queryKey, signal }) =>
      fetchThreadScheduledTaskEvents(String(queryKey[2]), { signal }),
    enabled: active,
    staleTime: Infinity,
    retry: false,
  });
  const tasks = useThreadScheduledTasks(threadId, { enabled: active });
  let seen: { id: string | null; fingerprint: string | null } = {
    id: null,
    fingerprint: null,
  };
  watch([() => toValue(threadId), () => tasks.data.value], ([id, data]) => {
    const fingerprint = data
      ? threadTasksFingerprint(data as ThreadScheduledTask[])
      : null;
    if (seen.id !== id) {
      seen = { id, fingerprint };
      return;
    }
    const previous = seen.fingerprint;
    seen.fingerprint = fingerprint;
    if (active.value && previous !== null && fingerprint !== previous)
      void query.refetch();
  });
  return query;
}
export function useScheduleToolResultRefresh(
  threadId: MaybeRefOrGetter<string | null>,
  messages: MaybeRefOrGetter<readonly Message[]>,
) {
  const client = useQueryClient();
  let seen: { id: string; keys: Set<string>; seeded: boolean } | null = null;
  watch(
    [() => toValue(threadId), () => toValue(messages)],
    ([id, list]) => {
      if (!id) {
        seen = null;
        return;
      }
      if (seen?.id !== id) seen = { id, keys: new Set(), seeded: false };
      if (!list.length) return;
      const baseline = !seen!.seeded;
      seen!.seeded = true;
      const taskIds = new Set<string>();
      for (const message of list) {
        if (message.type !== "tool" || message.name !== SCHEDULE_TASK_TOOL_NAME)
          continue;
        const key = message.id ?? message.tool_call_id;
        if (!key || seen!.keys.has(key)) continue;
        const result = parseScheduleToolResult(message.content);
        if (!result) continue;
        seen!.keys.add(key);
        taskIds.add(result.task.id);
      }
      if (baseline || !taskIds.size) return;
      void client.invalidateQueries({ queryKey: scheduledTaskKeys.thread(id) });
      void client.invalidateQueries({
        queryKey: scheduledTaskKeys.list(),
        exact: true,
      });
      for (const taskId of taskIds)
        void client.invalidateQueries({
          queryKey: scheduledTaskKeys.task(taskId),
        });
    },
    { deep: true, immediate: true },
  );
}
