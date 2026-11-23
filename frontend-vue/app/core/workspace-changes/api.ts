/*
  【文件职责】     请求 Gateway workspace-changes summary/detail 协议。
  【架构位置】     L3 Gateway API
  【主要导出】     fetchWorkspaceChanges
  【依赖关系】     runtime config · shared Gateway error parser
  【边界与注意】   GET 无 CSRF；透传 Query AbortSignal，非 2xx 保留 status/detail/body。
*/
import { fetch } from "@/core/api/fetcher";
import { getBackendBaseURL } from "@/core/config";
import { throwGatewayApiError } from "@/core/api/errors";

import type { WorkspaceChangesResponse } from "./types";

export async function fetchWorkspaceChanges({
  threadId,
  runId,
  includeFiles = true,
  includeDiff = true,
  signal,
}: {
  threadId: string;
  runId: string;
  includeFiles?: boolean;
  includeDiff?: boolean;
  signal?: AbortSignal;
}): Promise<WorkspaceChangesResponse> {
  const query = new URLSearchParams({
    include_files: includeFiles ? "true" : "false",
    include_diff: includeDiff ? "true" : "false",
  });
  const response = await fetch(
    `${getBackendBaseURL()}/api/threads/${encodeURIComponent(
      threadId,
    )}/runs/${encodeURIComponent(runId)}/workspace-changes?${query}`,
    { signal },
  );

  if (!response.ok) {
    await throwGatewayApiError(response, "Failed to load workspace changes.");
  }

  return response.json();
}
