/*
  【文件职责】     Gateway capabilities 的唯一 Vue Query owner。
  【架构位置】     L3 Vue server-state adapter
  【主要导出】     Agent、browser、MCP、subagent、references、knowledge hooks
  【边界与注意】   每种 capability 使用独立 key，挂载时重取且不自动重试。
                   Query 独占实时状态；Agent 的 localStorage 仅保留 React 的冷启动回退策略。
                   loaded/refresh 是现有 Vue 消费者的兼容接口，不复制 Query 状态。
*/

import { computed, onMounted, ref, watch } from "vue";

import {
  readCachedAgentsApiEnabled,
  resolveAgentsApiEnabled,
  writeCachedAgentsApiEnabled,
} from "@/core/agents/feature-cache";
import {
  fetchAgentsApiEnabled,
  fetchBrowserControlEnabled,
  fetchConversationReferencesCapability,
  fetchKnowledgeBaseFeature,
  fetchMcpTasksEnabled,
  fetchSubagentBatchesCapability,
  type SubagentBatchesCapability,
} from "@/core/features/api";
import { FEATURES_QUERY_KEYS } from "@/core/features/query-keys";
import {
  useFeatureQuery,
  type WorkspaceFeatureOptions,
} from "@/core/features/query";

export function useAgentsApiEnabled(options: WorkspaceFeatureOptions = {}) {
  const query = useFeatureQuery(
    FEATURES_QUERY_KEYS.agentsApi,
    fetchAgentsApiEnabled,
    options,
  );
  const cached = ref<boolean>();
  // Read browser persistence after mount to keep the hydration fallback identical.
  onMounted(() => {
    cached.value = readCachedAgentsApiEnabled();
  });
  watch(
    query.data,
    (value) => {
      if (value !== undefined) {
        cached.value = value;
        writeCachedAgentsApiEnabled(value);
      }
    },
    { immediate: true },
  );
  const enabled = computed(() =>
    resolveAgentsApiEnabled(query.data.value, cached.value),
  );
  return { ...query, enabled, agentsApiEnabled: enabled };
}

export function useBrowserControlEnabled(
  options: WorkspaceFeatureOptions = {},
) {
  const query = useFeatureQuery(
    FEATURES_QUERY_KEYS.browserControl,
    fetchBrowserControlEnabled,
    options,
  );
  const enabled = computed(() => query.data.value ?? false);
  return { ...query, enabled, browserControlEnabled: enabled };
}

export function useMcpTasksEnabled(options: WorkspaceFeatureOptions = {}) {
  const query = useFeatureQuery(
    FEATURES_QUERY_KEYS.mcpTasks,
    fetchMcpTasksEnabled,
    options,
  );
  const enabled = computed(() => query.data.value ?? false);
  return { ...query, enabled, mcpTasksEnabled: enabled };
}

const DEFAULT_SUBAGENT_BATCHES_CAPABILITY: SubagentBatchesCapability = {
  repositoryAvailable: false,
  workerRunning: false,
  maxRunning: 0,
};

export function useSubagentBatchesCapability(
  options: WorkspaceFeatureOptions = {},
) {
  const query = useFeatureQuery(
    FEATURES_QUERY_KEYS.subagentBatches,
    fetchSubagentBatchesCapability,
    options,
  );
  const capability = computed(
    () => query.data.value ?? DEFAULT_SUBAGENT_BATCHES_CAPABILITY,
  );
  return {
    ...query,
    capability,
    repositoryAvailable: computed(() => capability.value.repositoryAvailable),
    workerRunning: computed(() => capability.value.workerRunning),
    maxRunning: computed(() => capability.value.maxRunning),
  };
}

export function useConversationReferencesCapability(
  options: WorkspaceFeatureOptions = {},
) {
  const query = useFeatureQuery(
    FEATURES_QUERY_KEYS.conversationReferences,
    fetchConversationReferencesCapability,
    options,
  );
  return {
    ...query,
    // Failed refresh must not authorize reference sends using a cached answer.
    enabled: computed(
      () => query.isSuccess.value && (query.data.value?.enabled ?? false),
    ),
    maxReferences: computed(() => query.data.value?.maxReferences ?? 0),
  };
}

export function useKnowledgeBaseEnabled(options: WorkspaceFeatureOptions = {}) {
  const query = useFeatureQuery(
    FEATURES_QUERY_KEYS.knowledgeBase,
    fetchKnowledgeBaseFeature,
    options,
  );
  return {
    ...query,
    scopeSelectionEnabled: computed(
      () => query.data.value?.scopeSelectionEnabled ?? false,
    ),
  };
}
