import { throwGatewayApiError } from "@/core/api/errors";
import { fetch } from "@/core/api/fetcher";
import { getBackendBaseURL } from "@/core/config";

import type { WorkspaceChangesResponse } from "./types";

export async function fetchWorkspaceChanges({
  threadId,
  runId,
  includeFiles = true,
  includeDiff = true,
}: {
  threadId: string;
  runId: string;
  includeFiles?: boolean;
  includeDiff?: boolean;
}): Promise<WorkspaceChangesResponse> {
  const query = new URLSearchParams({
    include_files: includeFiles ? "true" : "false",
    include_diff: includeDiff ? "true" : "false",
  });
  const response = await fetch(
    `${getBackendBaseURL()}/api/threads/${encodeURIComponent(
      threadId,
    )}/runs/${encodeURIComponent(runId)}/workspace-changes?${query}`,
  );

  if (!response.ok) {
    await throwGatewayApiError(response, "Failed to load workspace changes.");
  }

  return response.json();
}
