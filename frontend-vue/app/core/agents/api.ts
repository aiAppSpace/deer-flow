/*
  【文件职责】     提供 Agent CRUD、名称检查与 feature API 的认证 Gateway transport。
  【架构位置】     L3 Agent HTTP contract
  【主要导出】     list/get/create/update/delete/check Agent · typed errors
  【依赖关系】     shared authenticated fetch · Gateway response error · config
  【边界与注意】   后由 Vue Query 持有 server state；本层只保留可中止 transport 与精确 status/detail。
*/

import {
  readGatewayResponseError,
  type GatewayResponseError,
} from "@/core/api/errors";
import { fetch } from "@/core/api/fetcher";
import { getBackendBaseURL } from "@/core/config";

import type {
  Agent,
  AgentPackage,
  CreateAgentRequest,
  UpdateAgentRequest,
} from "./types";

export { fetchAgentsApiEnabled } from "@/core/features/api";

const BACKEND_UNAVAILABLE_STATUSES = new Set([502, 503, 504]);

export class AgentNameCheckError extends Error {
  constructor(
    message: string,
    public readonly reason: "backend_unreachable" | "request_failed",
    /**
     * Raw backend `detail` string when the failure came from a backend
     * response carrying one. `null` when no detail was provided (e.g.
     * network-layer failure, empty response body, unparseable body) — in
     * which case `message` is a generated fallback like "Failed to check
     * agent name: Bad Gateway" and the UI should prefer its own localized
     * fallback instead of surfacing the generated string.
     */
    public readonly detail: string | null = null,
  ) {
    super(message);
    this.name = "AgentNameCheckError";
  }
}

export class AgentsApiDisabledError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentsApiDisabledError";
  }
}

function isAgentsApiDisabledDetail(detail: string | undefined): boolean {
  return typeof detail === "string" && detail.includes("agents_api.enabled");
}

async function agentResponseError(
  res: Response,
  fallback: string,
): Promise<GatewayResponseError> {
  const error = await readGatewayResponseError(res, fallback);
  const detail =
    typeof error.body === "object" && error.body !== null
      ? Reflect.get(error.body, "detail")
      : undefined;
  error.message = typeof detail === "string" ? detail : fallback;
  return error;
}

async function throwAgentResponseError(
  res: Response,
  fallback: string,
  useDetail = true,
): Promise<never> {
  const error = await agentResponseError(res, fallback);
  const detail =
    typeof error.body === "object" && error.body !== null
      ? Reflect.get(error.body, "detail")
      : undefined;
  if (isAgentsApiDisabledDetail(detail)) {
    throw new AgentsApiDisabledError(detail);
  }
  if (!useDetail) error.message = fallback;
  throw error;
}

export async function listAgents(
  options: { signal?: AbortSignal } = {},
): Promise<Agent[]> {
  const res = await fetch(`${getBackendBaseURL()}/api/agents`, {
    signal: options.signal,
  });
  if (!res.ok) {
    await throwAgentResponseError(
      res,
      `Failed to load agents: ${res.statusText}`,
      false,
    );
  }
  const data = (await res.json()) as { agents: Agent[] };
  return data.agents;
}

export async function getAgent(
  name: string,
  options: { signal?: AbortSignal } = {},
): Promise<Agent> {
  const res = await fetch(
    `${getBackendBaseURL()}/api/agents/${encodeURIComponent(name)}`,
    { signal: options.signal },
  );
  if (!res.ok) {
    await throwAgentResponseError(res, `Agent '${name}' not found`, false);
  }
  return res.json() as Promise<Agent>;
}

export async function createAgent(request: CreateAgentRequest): Promise<Agent> {
  const res = await fetch(`${getBackendBaseURL()}/api/agents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    await throwAgentResponseError(
      res,
      `Failed to create agent: ${res.statusText}`,
    );
  }
  return res.json() as Promise<Agent>;
}

export async function updateAgent(
  name: string,
  request: UpdateAgentRequest,
  options: { signal?: AbortSignal } = {},
): Promise<Agent> {
  const res = await fetch(
    `${getBackendBaseURL()}/api/agents/${encodeURIComponent(name)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: options.signal,
    },
  );
  if (!res.ok) {
    await throwAgentResponseError(
      res,
      `Failed to update agent: ${res.statusText}`,
    );
  }
  return res.json() as Promise<Agent>;
}

export async function exportAgentPackage(
  name: string,
  options: { signal?: AbortSignal } = {},
): Promise<AgentPackage> {
  const response = await fetch(
    `${getBackendBaseURL()}/api/agents/${encodeURIComponent(name)}/export`,
    { signal: options.signal },
  );
  if (!response.ok)
    await throwAgentResponseError(
      response,
      `Failed to export agent: ${response.statusText}`,
    );
  return response.json() as Promise<AgentPackage>;
}

/** Package JSON is untrusted input; only Gateway validation can create an Agent. */
export async function importAgentPackage(
  agentPackage: unknown,
  name?: string,
): Promise<Agent> {
  const suffix = name ? `?name=${encodeURIComponent(name)}` : "";
  const response = await fetch(
    `${getBackendBaseURL()}/api/agents/import${suffix}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(agentPackage),
    },
  );
  if (!response.ok) {
    const error = await agentResponseError(
      response,
      `Failed to import agent: ${response.statusText}`,
    );
    const detail =
      error.body && typeof error.body === "object"
        ? Reflect.get(error.body, "detail")
        : undefined;
    if (isAgentsApiDisabledDetail(detail))
      throw new AgentsApiDisabledError(detail);
    if (Array.isArray(detail)) {
      const messages = detail.flatMap((issue) =>
        typeof issue === "object" &&
        issue !== null &&
        typeof issue.msg === "string" &&
        issue.msg.trim()
          ? [issue.msg]
          : [],
      );
      if (messages.length) error.message = messages.join("; ");
    }
    throw error;
  }
  return response.json() as Promise<Agent>;
}

export async function deleteAgent(
  name: string,
  options: { signal?: AbortSignal } = {},
): Promise<void> {
  const res = await fetch(
    `${getBackendBaseURL()}/api/agents/${encodeURIComponent(name)}`,
    {
      method: "DELETE",
      signal: options.signal,
    },
  );
  if (!res.ok) {
    await throwAgentResponseError(
      res,
      `Failed to delete agent: ${res.statusText}`,
      false,
    );
  }
}

export async function checkAgentName(
  name: string,
  options: { signal?: AbortSignal } = {},
): Promise<{ available: boolean; name: string }> {
  let res: Response;
  try {
    res = await fetch(
      `${getBackendBaseURL()}/api/agents/check?name=${encodeURIComponent(name)}`,
      { signal: options.signal },
    );
  } catch {
    throw new AgentNameCheckError(
      "Could not reach the DeerFlow backend.",
      "backend_unreachable",
    );
  }

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: string };
    if (isAgentsApiDisabledDetail(err.detail)) {
      throw new AgentsApiDisabledError(err.detail!);
    }
    if (BACKEND_UNAVAILABLE_STATUSES.has(res.status)) {
      throw new AgentNameCheckError(
        "Could not reach the DeerFlow backend.",
        "backend_unreachable",
      );
    }
    const backendDetail = typeof err.detail === "string" ? err.detail : null;
    throw new AgentNameCheckError(
      backendDetail ?? `Failed to check agent name: ${res.statusText}`,
      "request_failed",
      backendDetail,
    );
  }
  return res.json() as Promise<{ available: boolean; name: string }>;
}
