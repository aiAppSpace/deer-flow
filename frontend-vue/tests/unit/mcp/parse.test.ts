/*
  【文件职责】     固定粘贴 MCP server 定义的解析边界。
  【架构位置】     测试
  【依赖关系】     app/core/mcp/parse.ts
  【边界与注意】   这里守的是**用户从哪儿复制来的都能用**：server 的 README 给的是
                   包着 `mcpServers` 的那种，`extensions_config.json` 里存的也是；
                   而有人会只复制里面那一段。两种都要收。

                   最刁的一条是「一个 server 真的叫 mcpServers」——把外壳无条件剥掉的话，
                   它会被整个吃掉，而用户看到的是「加成功了但列表里没有」。
*/

import { describe, expect, it } from "vitest";

import {
  formatMCPServerDefinition,
  MCPServerDefinitionError,
  parseMCPServerDefinition,
  type MCPServerDefinitionErrorCode,
} from "@/core/mcp/parse";

function expectDefinitionError(
  input: string,
  code: MCPServerDefinitionErrorCode,
  serverName?: string,
) {
  try {
    parseMCPServerDefinition(input);
    throw new Error("这段定义本该被拒绝");
  } catch (error) {
    expect(error).toBeInstanceOf(MCPServerDefinitionError);
    expect((error as MCPServerDefinitionError).code).toBe(code);
    if (serverName !== undefined) {
      expect((error as MCPServerDefinitionError).serverName).toBe(serverName);
    }
  }
}

describe("formatMCPServerDefinition", () => {
  it("写回粘贴框能接受的那种格式，一个字段都不丢", () => {
    const definition = formatMCPServerDefinition("remote", {
      enabled: false,
      description: "Remote tools",
      type: "http",
      url: "https://example.test/mcp",
      headers: { Authorization: "***" },
    });
    expect(JSON.parse(definition)).toEqual({
      mcpServers: {
        remote: {
          enabled: false,
          description: "Remote tools",
          type: "http",
          url: "https://example.test/mcp",
          headers: { Authorization: "***" },
        },
      },
    });
  });

  it("写出来的东西自己解析得回去", () => {
    const config = {
      enabled: false,
      description: "d",
      command: "npx",
      args: ["-y", "pkg"],
    };
    const parsed = parseMCPServerDefinition(
      formatMCPServerDefinition("round-trip", config),
    );
    expect(parsed["round-trip"]).toEqual(config);
  });
});

describe("parseMCPServerDefinition", () => {
  it("收 README 里那种包着 mcpServers 的", () => {
    const parsed = parseMCPServerDefinition(`{
      "mcpServers": {
        "github": {
          "command": "npx",
          "args": ["-y", "@modelcontextprotocol/server-github"]
        }
      }
    }`);
    expect(Object.keys(parsed)).toEqual(["github"]);
    expect(parsed.github).toMatchObject({
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-github"],
    });
  });

  it("也收裸的「名字→配置」映射", () => {
    const parsed = parseMCPServerDefinition(
      `{"remote": {"type": "http", "url": "https://example.test/mcp"}}`,
    );
    expect(Object.keys(parsed)).toEqual(["remote"]);
  });

  it("一个真叫 mcpServers 的 server 不会被当外壳吃掉", () => {
    const parsed = parseMCPServerDefinition(
      `{"mcpServers": {"command": "npx"}}`,
    );
    expect(parsed.mcpServers).toMatchObject({ command: "npx", enabled: true });
  });

  it("空名字也收：已有配置里就可能有一条", () => {
    expect(
      parseMCPServerDefinition(`{"": {"command": "npx"}}`)[""],
    ).toMatchObject({ command: "npx", enabled: true });
  });

  it("刚粘进来的默认启用；片段里写了 enabled 就听它的", () => {
    // 静默落成禁用读起来就是「加失败了」。
    expect(
      parseMCPServerDefinition(`{"a": {"command": "uvx"}}`).a?.enabled,
    ).toBe(true);
    expect(
      parseMCPServerDefinition(`{"a": {"command": "uvx", "enabled": false}}`).a
        ?.enabled,
    ).toBe(false);
  });

  it("这一屏不渲染的字段照样原样带过去", () => {
    // 前端只校验合并所需的形状；别的字段是 Gateway 的事，不能在这里丢掉。
    const parsed = parseMCPServerDefinition(`{
      "a": {
        "command": "uvx",
        "task_toolsets": [{"submit": "run"}],
        "routing": {"mode": "prefer"}
      }
    }`);
    expect(parsed.a).toMatchObject({
      task_toolsets: [{ submit: "run" }],
      routing: { mode: "prefer" },
    });
  });

  it("一段里有多个 server 时全都收", () => {
    const parsed = parseMCPServerDefinition(
      `{"mcpServers": {"a": {"command": "npx"}, "b": {"command": "uvx"}}}`,
    );
    expect(Object.keys(parsed).sort()).toEqual(["a", "b"]);
  });

  it.each([
    ["空白", "   ", "emptyDefinition"],
    ["不是 JSON", "{not json", "invalidJson"],
    ["顶层不是对象", "[1, 2]", "rootNotObject"],
    ["数组也不是对象", '"just a string"', "rootNotObject"],
    ["空的 server 表", `{"mcpServers": {}}`, "emptyServerMap"],
    ["整个是空对象", "{}", "emptyServerMap"],
  ])("拒绝%s", (_label, input, code) => {
    expectDefinitionError(input, code as MCPServerDefinitionErrorCode);
  });

  it("某一条不是对象时报出是哪一条", () => {
    // 一段里有五个 server 时，不说名字用户不知道改哪个。
    expectDefinitionError(`{"a": "npx"}`, "serverConfigNotObject", "a");
    expectDefinitionError(
      `{"mcpServers": []}`,
      "serverConfigNotObject",
      "mcpServers",
    );
  });
});
