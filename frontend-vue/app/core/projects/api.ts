/*
  【文件职责】     项目（project workspace）CRUD、归档/恢复与项目内会话列表的 Gateway HTTP adapter。
  【架构位置】     L3 project API boundary
  【主要导出】     listProjects · getProject · createProject · patchProject ·
                   archiveProject · restoreProject · deleteProject · listProjectThreads
  【依赖关系】     core api fetcher/errors/config · ./types
  【边界与注意】   端点形状以 `backend/app/gateway/routers/projects.py` 为准：
                   归档/恢复是 **POST 子资源**（`/archive` `/restore`）而不是 PATCH status，
                   删除返回 **204 无正文**。每个请求都收 `signal`——调用方是唯一的
                   Vue Query owner，取消由它负责，这一层不自己起生命周期。
*/
import { throwGatewayApiError } from "@/core/api/errors";
import { fetch } from "@/core/api/fetcher";
import { getBackendBaseURL } from "@/core/config";

import type {
  Project,
  ProjectCreateInput,
  ProjectPatchInput,
  ProjectStatus,
  ProjectThread,
} from "./types";

type RequestOptions = {
  signal?: AbortSignal;
};

/** `GET /api/projects` 的响应：**包了一层 `projects`**，不是裸数组。 */
interface ProjectListResponse {
  projects: Project[];
}

function projectsUrl(path = ""): string {
  return `${getBackendBaseURL()}/api/projects${path}`;
}

function projectUrl(projectId: string, suffix = ""): string {
  return projectsUrl(`/${encodeURIComponent(projectId)}${suffix}`);
}

export async function listProjects(
  status?: ProjectStatus,
  options: RequestOptions = {},
): Promise<Project[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const response = await fetch(projectsUrl(query), { signal: options.signal });
  if (!response.ok) {
    await throwGatewayApiError(
      response,
      `Failed to load projects: ${response.statusText}`,
    );
  }
  const body = (await response.json()) as ProjectListResponse;
  return body.projects;
}

export async function getProject(
  projectId: string,
  options: RequestOptions = {},
): Promise<Project> {
  const response = await fetch(projectUrl(projectId), {
    signal: options.signal,
  });
  if (!response.ok) {
    await throwGatewayApiError(
      response,
      `Failed to load project: ${response.statusText}`,
    );
  }
  return response.json();
}

export async function createProject(
  input: ProjectCreateInput,
  options: RequestOptions = {},
): Promise<Project> {
  const response = await fetch(projectsUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: input.name,
      instructions: input.instructions ?? "",
      presentation: input.presentation ?? {},
    }),
    signal: options.signal,
  });
  if (!response.ok) {
    await throwGatewayApiError(
      response,
      `Failed to create project: ${response.statusText}`,
    );
  }
  return response.json();
}

/**
 * PATCH 只发**显式给出的**字段。
 *
 * 用 `key in input` 而不是 `!== undefined` 判断：`{ instructions: undefined }`
 * 与「没传 instructions」在语义上不同，前者是调用方的疏漏，让它照样不发比
 * 悄悄把 `undefined` 序列化成缺字段更容易发现。
 */
export async function patchProject(
  projectId: string,
  input: ProjectPatchInput,
  options: RequestOptions = {},
): Promise<Project> {
  const payload: Record<string, unknown> = {};
  for (const key of ["name", "instructions", "presentation"] as const) {
    if (input[key] !== undefined) {
      payload[key] = input[key];
    }
  }
  const response = await fetch(projectUrl(projectId), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: options.signal,
  });
  if (!response.ok) {
    await throwGatewayApiError(
      response,
      `Failed to update project: ${response.statusText}`,
    );
  }
  return response.json();
}

export async function archiveProject(
  projectId: string,
  options: RequestOptions = {},
): Promise<Project> {
  const response = await fetch(projectUrl(projectId, "/archive"), {
    method: "POST",
    signal: options.signal,
  });
  if (!response.ok) {
    await throwGatewayApiError(
      response,
      `Failed to archive project: ${response.statusText}`,
    );
  }
  return response.json();
}

export async function restoreProject(
  projectId: string,
  options: RequestOptions = {},
): Promise<Project> {
  const response = await fetch(projectUrl(projectId, "/restore"), {
    method: "POST",
    signal: options.signal,
  });
  if (!response.ok) {
    await throwGatewayApiError(
      response,
      `Failed to restore project: ${response.statusText}`,
    );
  }
  return response.json();
}

/** 删除成功是 **204 无正文**，所以这里不读 body。 */
export async function deleteProject(
  projectId: string,
  options: RequestOptions = {},
): Promise<void> {
  const response = await fetch(projectUrl(projectId), {
    method: "DELETE",
    signal: options.signal,
  });
  if (!response.ok) {
    await throwGatewayApiError(
      response,
      `Failed to delete project: ${response.statusText}`,
    );
  }
}

export async function listProjectThreads(
  projectId: string,
  params: { limit?: number; offset?: number } = {},
  options: RequestOptions = {},
): Promise<ProjectThread[]> {
  const search = new URLSearchParams();
  if (params.limit !== undefined) {
    search.set("limit", String(params.limit));
  }
  if (params.offset !== undefined) {
    search.set("offset", String(params.offset));
  }
  const query = search.size > 0 ? `?${search.toString()}` : "";
  const response = await fetch(projectUrl(projectId, `/threads${query}`), {
    signal: options.signal,
  });
  if (!response.ok) {
    await throwGatewayApiError(
      response,
      `Failed to load project threads: ${response.statusText}`,
    );
  }
  return response.json();
}
