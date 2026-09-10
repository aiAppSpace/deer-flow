/*
  【文件职责】     解析用户粘贴的 MCP server 定义，并把一条已有配置反序列化回同一种格式。
  【架构位置】     L3 纯函数
  【主要导出】     MCPServerDefinitionErrorCode · MCPServerDefinitionError ·
                   parseMCPServerDefinition · formatMCPServerDefinition
  【依赖关系】     ./types
  【边界与注意】   **两种形状都收**：包着 `mcpServers` 的（server 自己的 README 和
                   `extensions_config.json` 用的就是这个）和裸的「名字→配置」映射。
                   用户从哪儿复制来的都能直接用，这是这个入口的全部意义。

                   `mcpServers` **可以是一个 server 的名字**。所以只有当它的值本身
                   长得像一张「名字→配置」表时才当外壳剥掉——否则一个真叫
                   `mcpServers` 的 server 会被吃掉，而用户看到的是「加成功了但列表里没有」。

                   **只校验合并进配置所需要的形状**。传输方式、命令白名单、参数筛查
                   都在 Gateway 上——那是无论哪个客户端都要守住的边界，前端这一层
                   多校验一遍只会让两处规则慢慢分叉。

                   **加进来的默认是启用的**：用户刚粘贴的定义就是他想跑的东西，
                   一个静默落成禁用的条目读起来就是「加失败了」。片段里显式写了
                   `enabled` 的仍然以它为准。
*/

import type { MCPServerConfig } from "./types";

export type MCPServerDefinitionErrorCode =
  | "emptyDefinition"
  | "invalidJson"
  | "rootNotObject"
  | "emptyServerMap"
  | "serverConfigNotObject";

/** 粘进来的东西不是一张能用的 `mcpServers` 表。 */
export class MCPServerDefinitionError extends Error {
  readonly code: MCPServerDefinitionErrorCode;
  readonly serverName?: string;

  constructor(code: MCPServerDefinitionErrorCode, serverName?: string) {
    super(code);
    this.name = "MCPServerDefinitionError";
    this.code = code;
    this.serverName = serverName;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isWrappedServerMap(
  value: Record<string, unknown>,
): value is Record<string, unknown> & { mcpServers: Record<string, unknown> } {
  if (!Object.hasOwn(value, "mcpServers") || !isPlainObject(value.mcpServers)) {
    return false;
  }
  const candidates = Object.values(value.mcpServers);
  return candidates.length === 0 || candidates.every(isPlainObject);
}

/** 把一条已有配置写回粘贴框能接受的那种格式。 */
export function formatMCPServerDefinition(
  name: string,
  config: MCPServerConfig,
): string {
  return JSON.stringify({ mcpServers: { [name]: config } }, null, 2);
}

export function parseMCPServerDefinition(
  input: string,
): Record<string, MCPServerConfig> {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new MCPServerDefinitionError("emptyDefinition");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new MCPServerDefinitionError("invalidJson");
  }

  if (!isPlainObject(parsed)) {
    throw new MCPServerDefinitionError("rootNotObject");
  }

  const servers = isWrappedServerMap(parsed) ? parsed.mcpServers : parsed;

  const entries = Object.entries(servers);
  if (entries.length === 0) {
    throw new MCPServerDefinitionError("emptyServerMap");
  }

  return Object.fromEntries(
    entries.map(([name, config]) => {
      if (!isPlainObject(config)) {
        throw new MCPServerDefinitionError("serverConfigNotObject", name);
      }
      return [
        name,
        { enabled: true, description: "", ...config } as MCPServerConfig,
      ] as const;
    }),
  );
}
