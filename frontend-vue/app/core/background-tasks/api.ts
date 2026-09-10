/*
  【文件职责】     后台任务的 Gateway 读写。
  【架构位置】     L3
  【主要导出】     fetchBackgroundTasks · fetchBackgroundTask · cancelBackgroundTask
  【依赖关系】     core/api/fetcher · core/api/errors · core/config
  【边界与注意】   列表只取前 20 条：这是一个抽屉里的近期清单，不是任务管理页。
                   取消是 POST 且**返回更新后的详情**——调用方要用它就地更新缓存，
                   否则用户点完取消，卡片还显示「运行中」直到下一次轮询。
*/

import { throwGatewayApiError } from "@/core/api/errors";
import { fetch } from "@/core/api/fetcher";
import { getBackendBaseURL } from "@/core/config";

import type { BackgroundTask, BackgroundTaskDetail } from "./types";

function threadTasksUrl(threadId: string, path = ""): string {
  return `${getBackendBaseURL()}/api/threads/${encodeURIComponent(threadId)}/mcp-tasks${path}`;
}

export async function fetchBackgroundTasks(
  threadId: string,
): Promise<BackgroundTask[]> {
  const response = await fetch(`${threadTasksUrl(threadId)}?limit=20`);
  if (!response.ok) {
    await throwGatewayApiError(
      response,
      `Failed to load background tasks: ${response.statusText}`,
    );
  }
  return (await response.json()) as BackgroundTask[];
}

export async function fetchBackgroundTask(
  threadId: string,
  taskId: string,
): Promise<BackgroundTaskDetail> {
  const response = await fetch(
    threadTasksUrl(threadId, `/${encodeURIComponent(taskId)}`),
  );
  if (!response.ok) {
    await throwGatewayApiError(
      response,
      `Failed to load background task: ${response.statusText}`,
    );
  }
  return (await response.json()) as BackgroundTaskDetail;
}

export async function cancelBackgroundTask(
  threadId: string,
  taskId: string,
): Promise<BackgroundTaskDetail> {
  const response = await fetch(
    threadTasksUrl(threadId, `/${encodeURIComponent(taskId)}/cancel`),
    { method: "POST" },
  );
  if (!response.ok) {
    await throwGatewayApiError(
      response,
      `Failed to cancel background task: ${response.statusText}`,
    );
  }
  return (await response.json()) as BackgroundTaskDetail;
}
