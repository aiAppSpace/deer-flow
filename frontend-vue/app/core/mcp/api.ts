/*
  【文件职责】     读取或写入 Gateway MCP config，并保留 admin-required HTTP 错误。
  【架构位置】     L3 Gateway adapter
  【主要导出】     MCPConfigRequestError · load/update MCP config
  【依赖关系】     authenticated fetch · Gateway error parser
  【边界与注意】   AbortSignal 由唯一 Vue Query owner 提供；不吞 403 或原始 detail。
*/

import { fetch } from "@/core/api/fetcher";
import { readGatewayResponseError } from "@/core/api/errors";
import { getBackendBaseURL } from "@/core/config";

import type { MCPConfig, MCPServerConfig } from "./types";

export class MCPConfigRequestError extends Error {
  readonly status: number;
  constructor(
    status: number,
    message: string,
    readonly body: unknown = null,
    readonly responseText = "",
  ) {
    super(message);
    this.name = "MCPConfigRequestError";
    this.status = status;
  }
  get isAdminRequired(): boolean {
    return this.status === 403;
  }
}

async function readErrorDetail(
  response: Response,
  fallback: string,
): Promise<never> {
  const error = await readGatewayResponseError(response, fallback);
  throw new MCPConfigRequestError(
    response.status,
    error.message,
    error.body,
    error.responseText,
  );
}

export async function loadMCPConfig(options: { signal?: AbortSignal } = {}) {
  const response = await fetch(`${getBackendBaseURL()}/api/mcp/config`, {
    signal: options.signal,
  });
  if (!response.ok) {
    await readErrorDetail(response, "Failed to load MCP configuration");
  }
  return response.json() as Promise<MCPConfig>;
}

export async function updateMCPConfig(
  config: MCPConfig,
  options: { signal?: AbortSignal } = {},
) {
  const response = await fetch(`${getBackendBaseURL()}/api/mcp/config`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(config),
    signal: options.signal,
  });
  if (!response.ok) {
    await readErrorDetail(response, "Failed to update MCP configuration");
  }
  return response.json();
}

export async function updateMCPServerState(
  serverName: string,
  enabled: boolean,
  options: { signal?: AbortSignal } = {},
) {
  const response = await fetch(`${getBackendBaseURL()}/api/mcp/config`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      server_name: serverName,
      enabled,
    }),
    signal: options.signal,
  });
  if (!response.ok) {
    await readErrorDetail(response, "Failed to update MCP server");
  }
  return response.json() as Promise<MCPConfig>;
}

/**
 * 增/改/删一个 server 走的都是这一条：三个端点的形状一样，
 * 都返回**整份**新配置，调用方直接拿它替换缓存即可。
 */
async function mutateMCPServerConfig(
  path: string,
  method: "POST" | "PUT" | "DELETE",
  body: unknown | undefined,
  fallback: string,
  options: { signal?: AbortSignal } = {},
): Promise<MCPConfig> {
  const request: RequestInit = { method, signal: options.signal };
  if (body !== undefined) {
    request.headers = { "Content-Type": "application/json" };
    request.body = JSON.stringify(body);
  }
  const response = await fetch(`${getBackendBaseURL()}${path}`, request);
  if (!response.ok) {
    await readErrorDetail(response, fallback);
  }
  return (await response.json()) as MCPConfig;
}

/** 一次可以加多个：粘贴的那段 JSON 里本来就可能有好几个 server。 */
export function createMCPServers(
  servers: Record<string, MCPServerConfig>,
  options: { signal?: AbortSignal } = {},
) {
  return mutateMCPServerConfig(
    "/api/mcp/config/servers",
    "POST",
    { mcp_servers: servers },
    "Failed to add MCP servers",
    options,
  );
}

/**
 * 改一个已有的 server。
 *
 * server 名走**请求体**而不是路径：改名这件事要在一次请求里完成，
 * 而 PUT 到旧名字的路径上再在体里给新名字，语义是含混的。
 */
export function updateMCPServer(
  serverName: string,
  server: MCPServerConfig,
  options: { signal?: AbortSignal } = {},
) {
  return mutateMCPServerConfig(
    "/api/mcp/config/server",
    "PUT",
    { server_name: serverName, server },
    "Failed to update MCP server",
    options,
  );
}

export function deleteMCPServer(
  serverName: string,
  options: { signal?: AbortSignal } = {},
) {
  return mutateMCPServerConfig(
    `/api/mcp/config/servers/${encodeURIComponent(serverName)}`,
    "DELETE",
    undefined,
    "Failed to delete MCP server",
    options,
  );
}
