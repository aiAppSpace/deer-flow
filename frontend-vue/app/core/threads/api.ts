/*
  【文件职责】     Thread token、branch、metadata 与 context compact Gateway API。
  【架构位置】     L3
  【主要导出】     fetchThreadTokenUsage · branch/patch/compact thread helpers
  【依赖关系】     core/api/fetcher · core/api/errors · core/config
  【边界与注意】   写请求共用保真 Gateway 错误；compact 固定 force 并支持 abort。
*/
import { fetch as fetchWithAuth } from "@/core/api/fetcher";
import { throwGatewayResponseError } from "@/core/api/errors";
import { getBackendBaseURL } from "@/core/config";

import type { AgentThread, ThreadTokenUsageResponse } from "./types";

export type ThreadCompactResponse = {
  thread_id: string;
  compacted: boolean;
  reason?: string | null;
  removed_message_count: number;
  preserved_message_count: number;
  summary_updated: boolean;
  checkpoint_id?: string | null;
  total_tokens: number;
};

export type CompactThreadContextOptions = {
  signal?: AbortSignal;
  agentName?: string | null;
  modelName?: string | null;
};

export type ThreadBranchResponse = {
  thread_id: string;
  parent_thread_id: string;
  parent_checkpoint_id: string;
  branched_from_message_id: string;
  workspace_clone_mode: string;
};

export type BranchThreadFromTurnInput = {
  messageId: string;
  messageIds?: string[];
  title?: string;
};

export type ThreadMetadataPatch = Record<string, unknown>;

/**
 * The subset of thread fields the Gateway ``PATCH /api/threads/{id}`` handler
 * returns with meaningful values. The endpoint's ``ThreadResponse`` model also
 * serializes default ``values`` and ``interrupts``, but PATCH leaves those empty;
 * callers that need state should read it via a full thread fetch instead.
 */
export type ThreadMetadataPatchResponse = Pick<
  AgentThread,
  "thread_id" | "status" | "created_at" | "updated_at" | "metadata"
>;

export async function fetchThreadTokenUsage(
  threadId: string,
): Promise<ThreadTokenUsageResponse | null> {
  const response = await fetchWithAuth(
    `${getBackendBaseURL()}/api/threads/${encodeURIComponent(threadId)}/token-usage`,
    {
      method: "GET",
    },
  );

  if (!response.ok) {
    if (response.status === 403 || response.status === 404) {
      return null;
    }
    throw new Error("Failed to load thread token usage.");
  }

  return (await response.json()) as ThreadTokenUsageResponse;
}

export async function branchThreadFromTurn(
  threadId: string,
  input: BranchThreadFromTurnInput,
): Promise<ThreadBranchResponse> {
  const response = await fetchWithAuth(
    `${getBackendBaseURL()}/api/threads/${encodeURIComponent(threadId)}/branches`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message_id: input.messageId,
        message_ids: input.messageIds ?? [input.messageId],
        ...(input.title ? { title: input.title } : {}),
      }),
    },
  );

  if (!response.ok) {
    await throwGatewayResponseError(response, "Failed to branch conversation.");
  }

  return (await response.json()) as ThreadBranchResponse;
}

export async function patchThreadMetadata(
  threadId: string,
  metadata: ThreadMetadataPatch,
): Promise<ThreadMetadataPatchResponse> {
  const response = await fetchWithAuth(
    `${getBackendBaseURL()}/api/threads/${encodeURIComponent(threadId)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ metadata }),
    },
  );

  if (!response.ok) {
    await throwGatewayResponseError(response, "Failed to update conversation.");
  }

  return (await response.json()) as ThreadMetadataPatchResponse;
}

/**
 * 把会话移进某个项目，或移出（`projectId` 传 `null`）。
 *
 * **纯组织关系**：后端明说历史、运行状态与会话文件都不动（RFC v2 §6），
 * 所以这里不需要连带清理任何本地缓存的会话内容——只有归属元数据变了。
 */
/**
 * 建一条会话行，可选地把它归属到某个项目。
 *
 * **这是新会话进项目的唯一通道**——run 请求本身不带项目字段。所以从项目页
 * 「新建会话」进来之后，第一条消息发出去之前必须先走这里；顺序反了，会话
 * 就落在项目外面，而用户看到的是自己明明从项目里开的。
 *
 * 后端按 `thread_id` 幂等：同一个 id 重试不会建出第二行，所以发送失败后
 * 用同一个 id 重试是安全的。
 */
/**
 * 按归档状态搜会话，走 Gateway 原生的 `POST /api/threads/search`。
 *
 * **为什么不用 SDK 的那个 search**：LangGraph 那条路由不认 `archived`，
 * 多传一个它不认的字段不会报错，只会被忽略——「已归档」页签因此拿回整份活跃
 * 列表，而且看起来完全正常。上游为此单开了这个函数（core/threads/api.ts），
 * 本仓同形。
 */
export async function searchThreadsByArchive({
  archived,
  metadata,
  status,
  limit,
  offset,
}: {
  archived: boolean;
  metadata?: Record<string, unknown>;
  status?: string;
  limit: number;
  offset: number;
}): Promise<AgentThread[]> {
  const response = await fetchWithAuth(
    `${getBackendBaseURL()}/api/threads/search`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived, metadata, status, limit, offset }),
    },
  );

  if (!response.ok) {
    await throwGatewayResponseError(response, "Failed to load conversations.");
  }

  return (await response.json()) as AgentThread[];
}

export async function createThread(
  threadId: string,
  projectId?: string,
): Promise<AgentThread> {
  const response = await fetchWithAuth(`${getBackendBaseURL()}/api/threads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      thread_id: threadId,
      ...(projectId ? { project_id: projectId } : {}),
    }),
  });

  if (!response.ok) {
    await throwGatewayResponseError(response, "Failed to create conversation.");
  }

  return (await response.json()) as AgentThread;
}

export async function moveThreadToProject(
  threadId: string,
  projectId: string | null,
): Promise<ThreadMetadataPatchResponse> {
  const response = await fetchWithAuth(
    `${getBackendBaseURL()}/api/threads/${encodeURIComponent(threadId)}/move`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ project_id: projectId }),
    },
  );

  if (!response.ok) {
    await throwGatewayResponseError(response, "Failed to move conversation.");
  }

  return (await response.json()) as ThreadMetadataPatchResponse;
}

export async function compactThreadContext(
  threadId: string,
  options: CompactThreadContextOptions = {},
): Promise<ThreadCompactResponse> {
  const response = await fetchWithAuth(
    `${getBackendBaseURL()}/api/threads/${encodeURIComponent(threadId)}/compact`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        force: true,
        ...(options.agentName ? { agent_name: options.agentName } : {}),
        ...(options.modelName ? { model_name: options.modelName } : {}),
      }),
      signal: options.signal,
    },
  );

  if (!response.ok) {
    await throwGatewayResponseError(response, "Failed to compact context.");
  }

  return (await response.json()) as ThreadCompactResponse;
}
