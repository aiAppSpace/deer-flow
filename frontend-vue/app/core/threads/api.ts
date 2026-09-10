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
