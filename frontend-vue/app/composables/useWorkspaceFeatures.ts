/*
  【文件职责】     按 feature flag 各自加载 Gateway 的 /api/features，并提供 fail-closed 只读状态。
  【架构位置】     L3 Vue adapter
  【主要导出】     useAgentsApiEnabled · useBrowserControlEnabled · useMcpTasksEnabled ·
                   useSubagentBatchesCapability
  【依赖关系】     core/features API · core/agents/feature-cache · Vue lifecycle
  【边界与注意】   **一个 flag 一份状态，不是一份共享状态。** React 用两个独立的
                   React Query key（["features","agents_api"] 与
                   ["features","browser_control"]，见 frontend/src/core/agents/hooks.ts
                   与 frontend/src/core/features/hooks.ts），两者各自 staleTime: 0 +
                   refetchOnMount，于是同时挂载两个消费者时 /api/features 真的会被请求两次。

                   原来这里是一份全局单例加一个 `if (loading) return` 的合流，看起来更省，
                   代价是两个 flag 的新鲜度被绑在一起：先挂载的那个决定了后挂载的那个拿到
                   什么时候的答案。侧栏的 agents 入口和聊天页的 browser 面板本来就是两次
                   独立的挂载，各自重新问一次才是它们各自的语义。

                   同一个 flag 的**并发**挂载合流成一次请求；先后挂载则各自再问一次，
                   与 React Query 在 staleTime: 0 + refetchOnMount 下的行为一致——
                   翻到 agents 页时重新确认一遍 flag，正是它想要的。

                   agents_api 失败时回落到 feature-cache 的粘性值（见该文件），
                   browser_control 失败一律关闭。
*/

import { onMounted, readonly, ref } from "vue";

import {
  readCachedAgentsApiEnabled,
  resolveAgentsApiEnabled,
  writeCachedAgentsApiEnabled,
} from "@/core/agents/feature-cache";
import {
  fetchFeatures,
  fetchSubagentBatchesCapability,
  type SubagentBatchesCapability,
} from "@/core/features/api";

const agentsApiEnabled = ref(true);
const agentsApiLoaded = ref(false);
const browserControlEnabled = ref(false);
const browserControlLoaded = ref(false);
const mcpTasksEnabled = ref(false);
const mcpTasksLoaded = ref(false);
const subagentBatches = ref<SubagentBatchesCapability>({
  repositoryAvailable: false,
  workerRunning: false,
  maxRunning: 0,
});
const subagentBatchesLoaded = ref(false);
let agentsApiInFlight: Promise<void> | null = null;
let browserControlInFlight: Promise<void> | null = null;
let mcpTasksInFlight: Promise<void> | null = null;
let subagentBatchesInFlight: Promise<void> | null = null;

async function loadAgentsApi() {
  const cached = readCachedAgentsApiEnabled();
  try {
    const features = await fetchFeatures();
    agentsApiEnabled.value = features.agents_api.enabled;
    writeCachedAgentsApiEnabled(features.agents_api.enabled);
  } catch {
    agentsApiEnabled.value = resolveAgentsApiEnabled(undefined, cached);
  } finally {
    agentsApiLoaded.value = true;
  }
}

async function loadBrowserControl() {
  try {
    const features = await fetchFeatures();
    browserControlEnabled.value = features.browser_control?.enabled ?? false;
  } catch {
    browserControlEnabled.value = false;
  } finally {
    browserControlLoaded.value = true;
  }
}

async function loadMcpTasks() {
  try {
    const features = await fetchFeatures();
    mcpTasksEnabled.value = features.mcp_tasks?.enabled ?? false;
  } catch {
    // 与 browser_control 同一条 fail-closed：问不到就当没有。
    mcpTasksEnabled.value = false;
  } finally {
    mcpTasksLoaded.value = true;
  }
}

async function loadSubagentBatches() {
  try {
    subagentBatches.value = await fetchSubagentBatchesCapability();
  } catch {
    // fail-closed：两个能力都当没有，入口整块不出。
    subagentBatches.value = {
      repositoryAvailable: false,
      workerRunning: false,
      maxRunning: 0,
    };
  } finally {
    subagentBatchesLoaded.value = true;
  }
}

function refreshAgentsApi() {
  agentsApiInFlight ??= loadAgentsApi().finally(() => {
    agentsApiInFlight = null;
  });
  return agentsApiInFlight;
}

function refreshBrowserControl() {
  browserControlInFlight ??= loadBrowserControl().finally(() => {
    browserControlInFlight = null;
  });
  return browserControlInFlight;
}

function refreshMcpTasks() {
  mcpTasksInFlight ??= loadMcpTasks().finally(() => {
    mcpTasksInFlight = null;
  });
  return mcpTasksInFlight;
}

export function useAgentsApiEnabled(options: { enabled?: boolean } = {}) {
  onMounted(() => {
    if (options.enabled !== false) void refreshAgentsApi();
  });
  return {
    loaded: readonly(agentsApiLoaded),
    agentsApiEnabled: readonly(agentsApiEnabled),
    refresh: refreshAgentsApi,
  };
}

export function useBrowserControlEnabled(options: { enabled?: boolean } = {}) {
  onMounted(() => {
    if (options.enabled !== false) void refreshBrowserControl();
  });
  return {
    loaded: readonly(browserControlLoaded),
    browserControlEnabled: readonly(browserControlEnabled),
    refresh: refreshBrowserControl,
  };
}

export function useMcpTasksEnabled(options: { enabled?: boolean } = {}) {
  onMounted(() => {
    if (options.enabled !== false) void refreshMcpTasks();
  });
  return {
    loaded: readonly(mcpTasksLoaded),
    mcpTasksEnabled: readonly(mcpTasksEnabled),
    refresh: refreshMcpTasks,
  };
}

function refreshSubagentBatches() {
  subagentBatchesInFlight ??= loadSubagentBatches().finally(() => {
    subagentBatchesInFlight = null;
  });
  return subagentBatchesInFlight;
}

export function useSubagentBatchesCapability(
  options: { enabled?: boolean } = {},
) {
  onMounted(() => {
    if (options.enabled !== false) void refreshSubagentBatches();
  });
  return {
    loaded: readonly(subagentBatchesLoaded),
    capability: readonly(subagentBatches),
    refresh: refreshSubagentBatches,
  };
}
