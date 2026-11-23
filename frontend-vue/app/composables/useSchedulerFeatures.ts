import { computed } from "vue";

import {
  DEFAULT_SCHEDULED_TASKS_FEATURE,
  DEFAULT_THREAD_ACTIVITY_FEATURE,
  fetchScheduledTasksFeature,
  fetchThreadActivityFeature,
} from "@/core/features/api";
import {
  useFeatureQuery,
  type WorkspaceFeatureOptions,
} from "@/core/features/query";
import { FEATURES_QUERY_KEYS } from "@/core/features/query-keys";

/** Keep persistence, execution and chat-tool capability independent. */
export function useScheduledTasksFeature(
  options: WorkspaceFeatureOptions = {},
) {
  const query = useFeatureQuery(
    FEATURES_QUERY_KEYS.scheduledTasks,
    fetchScheduledTasksFeature,
    options,
  );
  const feature = computed(
    () => query.data.value ?? DEFAULT_SCHEDULED_TASKS_FEATURE,
  );
  return {
    ...query,
    available: computed(() => feature.value.available),
    running: computed(() => feature.value.running),
    toolEnabled: computed(() => feature.value.toolEnabled),
    minIntervalSeconds: computed(() => feature.value.minIntervalSeconds),
  };
}

/** Disabled until discovery confirms activity/read-marker persistence. */
export function useThreadActivityFeature(
  options: WorkspaceFeatureOptions = {},
) {
  const query = useFeatureQuery(
    FEATURES_QUERY_KEYS.threadActivity,
    fetchThreadActivityFeature,
    options,
  );
  return {
    ...query,
    available: computed(
      () => (query.data.value ?? DEFAULT_THREAD_ACTIVITY_FEATURE).available,
    ),
  };
}
