import { fetch } from "@/core/api/fetcher";
import { getBackendBaseURL } from "@/core/config";

export interface FeaturesResponse {
  agents_api: { enabled: boolean };
  browser_control?: { enabled: boolean };
  mcp_tasks?: { enabled: boolean };
  subagent_batches?: {
    enabled?: boolean;
    repository_available?: boolean;
    worker_running?: boolean;
    max_running?: number;
  };
}

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

export async function fetchFeatures(): Promise<FeaturesResponse> {
  const res = await fetch(`${getBackendBaseURL()}/api/features`);
  if (!res.ok) {
    throw new Error(`Failed to load features: ${res.statusText}`);
  }
  return (await res.json()) as FeaturesResponse;
}

export async function fetchAgentsApiEnabled(): Promise<boolean> {
  return (await fetchFeatures()).agents_api.enabled;
}

export async function fetchBrowserControlEnabled(): Promise<boolean> {
  return (await fetchFeatures()).browser_control?.enabled ?? false;
}

/**
 * MCP 长任务（后台任务）开关。
 *
 * 整个字段缺席按**关**处理：老 Gateway 不认识这个能力，这时候画出「后台任务」
 * 入口，用户点开只会看到一个永远在报错的抽屉。
 */
export async function fetchMcpTasksEnabled(): Promise<boolean> {
  return (await fetchFeatures()).mcp_tasks?.enabled ?? false;
}

export async function fetchSubagentBatchesCapability(): Promise<SubagentBatchesCapability> {
  const feature = (await fetchFeatures()).subagent_batches;
  const legacyEnabled = feature?.enabled ?? false;
  return {
    repositoryAvailable: feature?.repository_available ?? legacyEnabled,
    workerRunning: feature?.worker_running ?? legacyEnabled,
    maxRunning: feature?.max_running ?? 0,
  };
}
