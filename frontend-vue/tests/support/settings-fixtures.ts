/*
  【文件职责】     设置对话框里「有列表的分区」的共享夹具：MCP server 与 subagent。
  【架构位置】     测试基础设施（**两个套件共用**）
  【主要导出】     MCP_CONFIG · SUBAGENTS
  【依赖关系】     无
  【边界与注意】   与 `channel-providers.ts` 同一条纪律（2026-09-18 第四十一轮）：
                   **一条门禁的夹具是它的一部分，不是背景。**

                   `settings-narrow-screen.spec.ts` 覆盖全部十个分区，但共享 mock
                   对 `/api/mcp/config` 与 `/api/subagents` 都不作答，于是 `tools`
                   与 `subagents` 两个分区量的是**空面板**——实测那两块面板的正文
                   只有 373 / 615 个字符、各一颗按钮，固有最小宽度 144 / 168，
                   而那一格有 278。**那不是「装得下」，是「里面没东西」。**

                   ⚠ 同一轮顺带订正了一个我自己写错的判断：`integrations`（827 字符、
                   min-content 241）与 `skills`（3 个 item、min-content 172）
                   **本来就有内容**，不在这份夹具里。别再去「补」它们。

                   `MCP_CONFIG` 与对照场景 `mcp-settings` 用的是同一份（那条场景从这里
                   引），抄第二份就会漂：两个套件量的必须是同一屏。

                   `SUBAGENTS` 的两条 builtin 照抄后端
                   `deerflow/subagents/builtins/`（`general-purpose` 与 `bash`，
                   描述取各自的首行），再加一条 managed——**这是真实部署里最常见的形状**：
                   内置的不可编辑、自建的可编辑。
*/

export const MCP_CONFIG = {
  mcp_servers: {
    local: {
      enabled: true,
      description: "Local tools",
      command: "uvx",
      args: ["local-tools"],
    },
    remote: {
      enabled: false,
      description: "Remote tools",
      type: "http",
      url: "https://example.test/mcp",
      headers: { "X-API-Key": "***" },
      // 这一屏**不认识**的字段：编辑时必须原样带过去。
      routing: { mode: "prefer" },
    },
  },
};

const SUBAGENT_DEFAULTS = {
  display_name: null,
  system_prompt: null,
  tools: null,
  disallowed_tools: null,
  skills: null,
  model: "parity-thinker",
  max_turns: 30,
  timeout_seconds: 600,
  enabled: true,
  conflict: false,
  config_overrides: {},
};

export const SUBAGENTS = [
  {
    ...SUBAGENT_DEFAULTS,
    name: "general-purpose",
    description:
      "A capable agent for bounded exploration and action when there is clear delegation benefit.",
    source: "builtin",
    editable: false,
  },
  {
    ...SUBAGENT_DEFAULTS,
    name: "bash",
    description:
      "Command execution specialist for bounded shell workflows with clear delegation benefit.",
    source: "builtin",
    editable: false,
  },
  {
    ...SUBAGENT_DEFAULTS,
    name: "release-notes",
    display_name: "Release notes writer",
    description:
      "Drafts release notes from merged pull requests and the changelog.",
    source: "managed",
    editable: true,
    tools: [],
    skills: [],
  },
];
