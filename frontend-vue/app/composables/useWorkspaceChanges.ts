/*
  【文件职责】     Workspace Changes summary/detail 的唯一 TanStack Query server-state owner。
  【架构位置】     L3 Vue server-state adapter
  【主要导出】     useWorkspaceChanges
  【依赖关系】     TanStack Vue Query · workspace changes API/query keys
  【边界与注意】   query key 包含 thread/run/include flags；queryFn 转发 AbortSignal。
*/
import { useQuery } from "@tanstack/vue-query";
import { computed, toValue, type MaybeRefOrGetter } from "vue";

import { fetchWorkspaceChanges } from "@/core/workspace-changes/api";
import { workspaceChangesKeys } from "@/core/workspace-changes/query-keys";

export function useWorkspaceChanges(options: {
  threadId: MaybeRefOrGetter<string>;
  runId: MaybeRefOrGetter<string | undefined>;
  includeFiles: boolean;
  includeDiff: boolean;
  enabled: MaybeRefOrGetter<boolean>;
}) {
  const threadId = computed(() => toValue(options.threadId));
  const runId = computed(() => toValue(options.runId) ?? "");
  const enabled = computed(() =>
    Boolean(toValue(options.enabled) && threadId.value && runId.value),
  );
  const query = useQuery({
    queryKey: computed(() =>
      workspaceChangesKeys.request(
        threadId.value,
        runId.value,
        options.includeFiles,
        options.includeDiff,
      ),
    ),
    enabled,
    queryFn: ({ signal }) =>
      fetchWorkspaceChanges({
        threadId: threadId.value,
        runId: runId.value,
        includeFiles: options.includeFiles,
        includeDiff: options.includeDiff,
        signal,
      }),
    staleTime: 5 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  return {
    data: query.data,
    loading: query.isLoading,
    fetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}
