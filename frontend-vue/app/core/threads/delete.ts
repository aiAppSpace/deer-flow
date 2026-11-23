/*
  【文件职责】     搜索并级联删除主 thread 的全部 sidecar，暴露部分失败重试信息。
  【架构位置】     L3
  【主要导出】     deleteThreadCascade · findSidecarThreadIdsForParent · error
  【依赖关系】     sidecar/thread · api/errors
  【边界与注意】   sidecar 清理失败按当前 React 报告警告并继续删除主 thread；404 幂等成功。
*/
import { fetch } from "@/core/api/fetcher";
import { getBackendBaseURL } from "@/core/config";
import {
  isGatewayResponseError,
  throwGatewayResponseError,
} from "@/core/api/errors";
import { SIDECAR_METADATA_KEY, isSidecarThread } from "@/core/sidecar/thread";
import type { AgentThread, AgentThreadState } from "@/core/threads/types";
import type { ThreadSearchQuery } from "@/core/types/message";

export interface ThreadCascadeClient {
  threads: {
    search(query?: ThreadSearchQuery<AgentThreadState>): Promise<AgentThread[]>;
    delete(threadId: string): Promise<void>;
  };
}

export class ThreadCascadeDeleteError extends Error {
  readonly parentThreadId: string;
  readonly failedThreadIds: string[];
  readonly deletedThreadIds: string[];
  readonly causes: unknown[];

  constructor(options: {
    parentThreadId: string;
    failedThreadIds: string[];
    deletedThreadIds: string[];
    causes: unknown[];
  }) {
    const messages = options.causes.flatMap((cause) =>
      cause instanceof Error && cause.message ? [cause.message] : [],
    );
    super(
      messages.join("; ") ||
        `Failed to delete ${options.failedThreadIds.length} conversation thread(s). Try again.`,
    );
    this.name = "ThreadCascadeDeleteError";
    this.parentThreadId = options.parentThreadId;
    this.failedThreadIds = options.failedThreadIds;
    this.deletedThreadIds = options.deletedThreadIds;
    this.causes = options.causes;
  }
}

export async function findSidecarThreadIdsForParent(
  apiClient: Pick<ThreadCascadeClient, "threads">,
  parentThreadId: string,
  pageSize = 100,
): Promise<string[]> {
  const ids = new Set<string>();
  let offset = 0;
  const limit = Math.max(1, pageSize);
  while (true) {
    const response = await apiClient.threads.search({
      metadata: {
        [SIDECAR_METADATA_KEY]: true,
        parent_thread_id: parentThreadId,
      },
      limit,
      offset,
      sortBy: "updated_at",
      sortOrder: "desc",
      select: ["thread_id", "metadata"],
    });
    for (const thread of response) {
      if (
        isSidecarThread(thread) &&
        thread.metadata?.parent_thread_id === parentThreadId
      ) {
        ids.add(thread.thread_id);
      }
    }
    if (response.length < limit) break;
    offset += response.length;
  }
  return [...ids];
}

/** The integrated Gateway may already remove local data: only 404 is idempotent success. */
async function deleteLocalThreadData(threadId: string) {
  const response = await fetch(
    `${getBackendBaseURL()}/api/threads/${encodeURIComponent(threadId)}`,
    { method: "DELETE" },
  );
  if (!response.ok && response.status !== 404)
    await throwGatewayResponseError(
      response,
      "Failed to delete local thread data.",
    );
}

async function deleteIdempotently(
  client: ThreadCascadeClient,
  threadId: string,
): Promise<void> {
  try {
    await client.threads.delete(threadId);
  } catch (error) {
    if (!(isGatewayResponseError(error) && error.status === 404)) throw error;
  }
  await deleteLocalThreadData(threadId);
}

/** Mirror React hooks.ts: sidecar cleanup is best effort; parent/local cleanup must succeed. */
export async function deleteThreadCascade(
  apiClient: ThreadCascadeClient,
  parentThreadId: string,
): Promise<string[]> {
  let sidecarIds: string[];
  try {
    sidecarIds = await findSidecarThreadIdsForParent(apiClient, parentThreadId);
  } catch (error) {
    console.warn(
      `Failed to look up sidecar threads for parent ${parentThreadId}; skipping cascade cleanup. Orphaned sidecar threads may remain.`,
      error,
    );
    sidecarIds = [];
  }
  const results = await Promise.allSettled(
    sidecarIds.map((threadId) => deleteIdempotently(apiClient, threadId)),
  );
  const deletedThreadIds: string[] = [];
  const failedThreadIds: string[] = [];
  const causes: unknown[] = [];
  results.forEach((result, index) => {
    const threadId = sidecarIds[index]!;
    if (result.status === "fulfilled") deletedThreadIds.push(threadId);
    else {
      failedThreadIds.push(threadId);
      causes.push(result.reason);
    }
  });
  if (failedThreadIds.length > 0) {
    console.warn(
      `Failed to delete ${failedThreadIds.length} sidecar thread(s) for parent ${parentThreadId}; orphaned sidecar threads may remain.`,
      failedThreadIds.map((threadId, index) => ({
        threadId,
        reason: causes[index],
      })),
    );
  }
  try {
    await deleteIdempotently(apiClient, parentThreadId);
  } catch (error) {
    throw new ThreadCascadeDeleteError({
      parentThreadId,
      failedThreadIds: [parentThreadId],
      deletedThreadIds,
      causes: [error],
    });
  }
  return [...deletedThreadIds, parentThreadId];
}
