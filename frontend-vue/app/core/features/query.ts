import { useQuery } from "@tanstack/vue-query";
import { computed, toValue, type MaybeRefOrGetter } from "vue";

import type { FeatureRequestOptions } from "@/core/features/api";
import { FEATURE_QUERY_POLICY } from "@/core/features/query-keys";

export interface WorkspaceFeatureOptions {
  enabled?: MaybeRefOrGetter<boolean>;
}

export function useFeatureQuery<T>(
  queryKey: readonly string[],
  load: (options?: FeatureRequestOptions) => Promise<T>,
  options: WorkspaceFeatureOptions,
) {
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => load({ signal }),
    enabled: computed(() => toValue(options.enabled) ?? true),
    ...FEATURE_QUERY_POLICY,
  });
  return {
    ...query,
    loaded: computed(() => !query.isPending.value),
    isLoading: query.isPending,
    refresh: query.refetch,
  };
}
