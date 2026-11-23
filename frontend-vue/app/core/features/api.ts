import { fetch } from "@/core/api/fetcher";
import { getBackendBaseURL } from "@/core/config";

export interface FeaturesResponse {
  agents_api: { enabled: boolean };
  scheduled_tasks?: {
    available?: boolean;
    running?: boolean;
    tool_enabled?: boolean;
    min_interval_seconds?: number;
  };
  thread_activity?: { available?: boolean };
  browser_control?: { enabled: boolean };
  mcp_tasks?: { enabled: boolean };
  subagent_batches?: {
    enabled?: boolean;
    repository_available?: boolean;
    worker_running?: boolean;
    max_running?: number;
  };
  conversation_references?: {
    enabled?: boolean;
    max_references?: number;
  };
  knowledge_base?: { scope_selection_enabled?: boolean };
}

export interface FeatureRequestOptions {
  signal?: AbortSignal;
}

export interface ConversationReferencesCapability {
  enabled: boolean;
  maxReferences: number;
}

export interface KnowledgeBaseFeature {
  scopeSelectionEnabled: boolean;
}

export interface ScheduledTasksFeature {
  /** Persistence exists, independently of scheduler execution. */
  available: boolean;
  /** This Gateway's scheduler is executing and can accept new schedules. */
  running: boolean;
  /** Chats may manage schedules and a scheduled run may stop its own schedule. */
  toolEnabled: boolean;
  minIntervalSeconds: number;
}

export interface ThreadActivityFeature {
  /** Activity, read markers and unread state have SQL persistence. */
  available: boolean;
}

/** Older Gateways keep the schedule page usable, without exposing chat tools. */
export const DEFAULT_SCHEDULED_TASKS_FEATURE: ScheduledTasksFeature = {
  available: true,
  running: true,
  toolEnabled: false,
  minIntervalSeconds: 60,
};

/** Do not poll or post read markers before activity capability is confirmed. */
export const DEFAULT_THREAD_ACTIVITY_FEATURE: ThreadActivityFeature = {
  available: false,
};

/**
 * subagent 批次的两个**独立**能力。
 *
 * 「有没有存储」和「worker 跑没跑」不是一回事：worker 停了，历史批次还应该看得见
 * （只是不能暂停/恢复/重试），所以入口照出、控制键禁用。合成一个布尔的话，
 * worker 一停，用户连自己昨天跑的那批结果都翻不出来。
 *
 * `enabled` 是老 Gateway 的字段，两个新字段缺席时回落到它。
 */
export interface SubagentBatchesCapability {
  repositoryAvailable: boolean;
  workerRunning: boolean;
  maxRunning: number;
}

export async function fetchFeatures(
  options: FeatureRequestOptions = {},
): Promise<FeaturesResponse> {
  const url = `${getBackendBaseURL()}/api/features`;
  const res = options.signal
    ? await fetch(url, { signal: options.signal })
    : await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load features: ${res.statusText}`);
  }
  return (await res.json()) as FeaturesResponse;
}

export async function fetchAgentsApiEnabled(
  options?: FeatureRequestOptions,
): Promise<boolean> {
  return (await fetchFeatures(options)).agents_api.enabled;
}

export async function fetchBrowserControlEnabled(
  options?: FeatureRequestOptions,
): Promise<boolean> {
  return (await fetchFeatures(options)).browser_control?.enabled ?? false;
}

/**
 * MCP 长任务（后台任务）开关。
 *
 * 整个字段缺席按**关**处理：老 Gateway 不认识这个能力，这时候画出「后台任务」
 * 入口，用户点开只会看到一个永远在报错的抽屉。
 */
export async function fetchMcpTasksEnabled(
  options?: FeatureRequestOptions,
): Promise<boolean> {
  return (await fetchFeatures(options)).mcp_tasks?.enabled ?? false;
}

export async function fetchSubagentBatchesCapability(
  options?: FeatureRequestOptions,
): Promise<SubagentBatchesCapability> {
  const feature = (await fetchFeatures(options)).subagent_batches;
  const legacyEnabled = feature?.enabled ?? false;
  return {
    repositoryAvailable: feature?.repository_available ?? legacyEnabled,
    workerRunning: feature?.worker_running ?? legacyEnabled,
    maxRunning: feature?.max_running ?? 0,
  };
}

export async function fetchConversationReferencesCapability(
  options?: FeatureRequestOptions,
): Promise<ConversationReferencesCapability> {
  const capability = (await fetchFeatures(options)).conversation_references;
  const maxReferences = capability?.max_references;
  return {
    enabled: capability?.enabled === true,
    maxReferences:
      typeof maxReferences === "number" &&
      Number.isInteger(maxReferences) &&
      maxReferences > 0
        ? maxReferences
        : 0,
  };
}

export async function fetchKnowledgeBaseFeature(
  options?: FeatureRequestOptions,
): Promise<KnowledgeBaseFeature> {
  return {
    scopeSelectionEnabled:
      (await fetchFeatures(options)).knowledge_base?.scope_selection_enabled ??
      false,
  };
}

export async function fetchScheduledTasksFeature(
  options?: FeatureRequestOptions,
): Promise<ScheduledTasksFeature> {
  const feature = (await fetchFeatures(options)).scheduled_tasks;
  const defaults = DEFAULT_SCHEDULED_TASKS_FEATURE;
  const minInterval = feature?.min_interval_seconds;
  return {
    available:
      typeof feature?.available === "boolean"
        ? feature.available
        : defaults.available,
    running:
      typeof feature?.running === "boolean"
        ? feature.running
        : defaults.running,
    toolEnabled:
      typeof feature?.tool_enabled === "boolean"
        ? feature.tool_enabled
        : defaults.toolEnabled,
    minIntervalSeconds:
      typeof minInterval === "number" &&
      Number.isInteger(minInterval) &&
      minInterval > 0
        ? minInterval
        : defaults.minIntervalSeconds,
  };
}

export async function fetchThreadActivityFeature(
  options?: FeatureRequestOptions,
): Promise<ThreadActivityFeature> {
  return {
    available:
      (await fetchFeatures(options)).thread_activity?.available === true,
  };
}
