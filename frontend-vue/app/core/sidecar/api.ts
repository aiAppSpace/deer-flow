import { throwGatewayApiError } from "@/core/api/errors";
import { getAPIClient } from "@/core/api";
import { fetch as fetchWithAuth } from "@/core/api/fetcher";
import { getBackendBaseURL } from "@/core/config";
import type { AgentThread } from "@/core/threads";

import type { SidecarContext } from "./context";
import {
  SIDECAR_METADATA_KEY,
  buildSidecarThreadMetadata,
  isSidecarThread,
} from "./thread";

type SidecarThreadSearchClient = {
  threads: {
    search: (query: Record<string, unknown>) => Promise<AgentThread[]>;
  };
};

export async function createSidecarThread({
  parentThreadId,
  context,
  signal,
}: {
  parentThreadId: string;
  context: SidecarContext | SidecarContext[];
  signal?: AbortSignal;
}): Promise<AgentThread> {
  const response = await fetchWithAuth(`${getBackendBaseURL()}/api/threads`, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      metadata: buildSidecarThreadMetadata(parentThreadId, context),
    }),
  });

  if (!response.ok) {
    await throwGatewayApiError(response, "Failed to create side conversation.");
  }

  return (await response.json()) as AgentThread;
}

export async function findLatestSidecarThread({
  parentThreadId,
  isMock,
  signal,
  apiClient = getAPIClient(isMock) as SidecarThreadSearchClient,
}: {
  parentThreadId: string;
  isMock?: boolean;
  signal?: AbortSignal;
  apiClient?: SidecarThreadSearchClient;
}): Promise<AgentThread | null> {
  const response = await apiClient.threads.search({
    metadata: {
      [SIDECAR_METADATA_KEY]: true,
      parent_thread_id: parentThreadId,
    },
    limit: 1,
    offset: 0,
    sortBy: "updated_at",
    sortOrder: "desc",
    ...(signal ? { signal } : {}),
  });

  return (
    response.find(
      (thread) =>
        isSidecarThread(thread) &&
        thread.metadata?.parent_thread_id === parentThreadId,
    ) ?? null
  );
}
