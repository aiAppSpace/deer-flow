/*
  【文件职责】     subagent 列表与托管 subagent 的增改删。
  【架构位置】     L3
  【主要导出】     listSubagents · createManagedSubagent ·
                   updateManagedSubagent · deleteManagedSubagent
  【依赖关系】     core/api/fetcher · core/config
  【边界与注意】   **错误详情要认 FastAPI 的两种形状**：字符串 `detail`，
                   以及校验失败时那个 `[{msg}]` 数组。只认字符串的话，
                   用户提交一个不合法的字段会看到一句通用的「保存失败」，
                   而后端明明说清了是哪个字段不对。
*/

import { fetch } from "@/core/api/fetcher";
import { getBackendBaseURL } from "@/core/config";

import type {
  CreateManagedSubagentRequest,
  Subagent,
  UpdateManagedSubagentRequest,
} from "./types";

async function errorDetail(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { detail?: unknown };
  if (typeof body.detail === "string") return body.detail;
  if (Array.isArray(body.detail)) {
    const messages = body.detail
      .map((item) =>
        item && typeof item === "object" && "msg" in item
          ? String((item as { msg: unknown }).msg)
          : null,
      )
      .filter((message): message is string => message !== null);
    if (messages.length > 0) return messages.join("; ");
  }
  return fallback;
}

function subagentsUrl(name?: string): string {
  const base = `${getBackendBaseURL()}/api/subagents`;
  return name === undefined ? base : `${base}/${encodeURIComponent(name)}`;
}

export async function listSubagents(): Promise<Subagent[]> {
  const res = await fetch(subagentsUrl());
  if (!res.ok) {
    throw new Error(await errorDetail(res, "Failed to load subagents"));
  }
  const body = (await res.json()) as { subagents: Subagent[] };
  return body.subagents;
}

export async function createManagedSubagent(
  request: CreateManagedSubagentRequest,
): Promise<Subagent> {
  const res = await fetch(subagentsUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    throw new Error(await errorDetail(res, "Failed to create subagent"));
  }
  return (await res.json()) as Subagent;
}

export async function updateManagedSubagent(
  name: string,
  request: UpdateManagedSubagentRequest,
): Promise<Subagent> {
  const res = await fetch(subagentsUrl(name), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    throw new Error(await errorDetail(res, "Failed to update subagent"));
  }
  return (await res.json()) as Subagent;
}

export async function deleteManagedSubagent(name: string): Promise<void> {
  const res = await fetch(subagentsUrl(name), { method: "DELETE" });
  if (!res.ok) {
    throw new Error(await errorDetail(res, "Failed to delete subagent"));
  }
}
