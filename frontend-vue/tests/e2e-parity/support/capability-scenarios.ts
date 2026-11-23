import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { enUS } from "../../../app/core/i18n/locales/en-US";
import { zhCN } from "../../../app/core/i18n/locales/zh-CN";
import type { Translations } from "../../../app/core/i18n/locales/types";
import { MOCK_THREAD_ID } from "../../e2e/utils/mock-api";
import type {
  ParityDimension,
  ParityRouteOverride,
  ParityScenario,
  ParityStep,
  ParityTarget,
} from "./scenarios";

const dimensions: ParityDimension[] = [
  { viewport: "desktop", theme: "light", locale: "en-US" },
  { viewport: "desktop", theme: "light", locale: "zh-CN" },
  { viewport: "mobile", theme: "light", locale: "en-US" },
  { viewport: "desktop", theme: "dark", locale: "en-US" },
];
const enDimensions = dimensions.filter((item) => item.locale === "en-US");
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const copy = (select: (value: Translations) => string) =>
  new RegExp(`^(?:${escape(select(enUS))}|${escape(select(zhCN))})$`);
const role = (
  role: Extract<ParityTarget, { role: string }>["role"],
  name?: string | RegExp,
): ParityTarget => ({ role, name });
const visible = (target: ParityTarget): ParityStep => ({
  kind: "visible",
  target,
});
const click = (target: ParityTarget): ParityStep => ({ kind: "click", target });
const fill = (target: ParityTarget, value: string): ParityStep => ({
  kind: "fill",
  target,
  value,
});
const button = (name: string | RegExp) => role("button", name);
const tab = (name: string | RegExp) => role("tab", name);
const text = (text: string | RegExp): ParityTarget => ({ text });
const save = button(copy((t) => t.common.save));
const apply = button(copy((t) => t.knowledge.scope.apply));
const lookupDetails = button(
  copy((t) => `${t.toolCalls.details}: mcp_lookup (call-4389)`),
);
const scopeTrigger: ParityTarget = { testId: "knowledge-scope-trigger" };
const agent = {
  name: "researcher",
  display_name: "Policy specialist",
  description: "Research agent",
  model: null,
  tool_groups: ["knowledge"],
  skills: null,
};
const personal = {
  github: {
    type: "http",
    url: "https://example.test/github",
    enabled: false,
    description: "Personal repository tools",
    headers: { Authorization: "***" },
    capability: { id: "fixture-github", plugin_id: "github", version: "1" },
  },
};
const platform = {
  github: {
    type: "http",
    url: "https://example.test/shared",
    enabled: false,
    description: "Shared repository tools",
  },
};
const mcpRoutes: ParityRouteOverride[] = [
  { pattern: "**/api/mcp/personal/config", json: { mcp_servers: personal } },
  { pattern: "**/api/mcp/config", json: { mcp_servers: platform } },
  {
    pattern: "**/api/capabilities/installations/mcp?scope=all",
    json: {
      can_manage: true,
      items: [
        {
          id: "shared-github",
          adapter: "mcp",
          plugin_id: null,
          name: "github",
          reference: "github",
          description: "Shared repository tools",
          installed: true,
          enabled: false,
          scope: "deployment",
          auth_status: "configured",
        },
      ],
    },
  },
];
const skills = [
  {
    name: "deep-research",
    description: "Search and verify sources",
    category: "public",
    enabled: true,
  },
  {
    name: "demo",
    description: "Synthetic export fixture",
    category: "custom",
    enabled: true,
  },
];
const openCustom: ParityStep[] = [
  click(tab(copy((t) => t.capabilities.custom))),
  click(button(/^(View details|查看详情) demo$/)),
];
const manifest = {
  skill_name: "demo",
  revision: "a".repeat(64),
  can_export: true,
  file_count: 1,
  directory_count: 1,
  total_bytes: 20,
  files: [{ path: "SKILL.md", type: "file", size: 20, executable: false }],
  requirements: {
    compatibility: "Python 3.12",
    allowed_tools: ["bash"],
    required_secrets: [{ name: "DEMO_TOKEN", optional: false }],
  },
  warnings: [],
  blockers: [],
};
const openExport: ParityStep[] = [
  ...openCustom,
  click(button(copy((t) => t.common.export))),
];
const lark = {
  installed: true,
  version: "v1.0.65",
  manifest_version: "v1.0.65",
  latest_available_version: "v1.0.66",
  runtime_version_mismatch: true,
  app_configured: true,
  app_id: "cli_existing_mock",
  app_brand: "feishu",
  skills_expected: 27,
  skills_installed: 4,
  installed_skills: ["lark-doc", "lark-im", "lark-shared", "lark-sheets"],
  enabled_skills: ["lark-doc", "lark-im", "lark-shared", "lark-sheets"],
  install_path: "/mock/integrations/skills/lark-cli",
  cli: {
    available: true,
    path: "/usr/bin/lark-cli",
    version: "lark-cli version v1.0.65",
    error: null,
  },
  auth: {
    status: "authenticated",
    message: "Lark authorization is live-verified.",
    user: "existing-user",
    verified: true,
  },
  sandbox_runtime_mode: "none",
  sandbox_runtime_ready: false,
  sandbox_runtime_detail: null,
};
const datasets: ParityRouteOverride[] = [
  {
    pattern: "**/api/knowledge/retrieval-catalog/datasets?*",
    json: {
      items: [{ id: "policies", name: "Company policies", selectable: true }],
      page: 1,
      page_size: 100,
      total: 1,
    },
  },
  {
    pattern: "**/api/knowledge/retrieval-catalog/datasets/policies/documents?*",
    json: {
      items: [
        { id: "leave", name: "Leave.pdf", selectable: true },
        { id: "parsing", name: "Parsing.pdf", selectable: false },
      ],
      page: 1,
      page_size: 100,
      total: 2,
    },
  },
];
const selectDataset: ParityStep[] = [
  click(scopeTrigger),
  click(
    role(
      "radio",
      copy((t) => t.knowledge.scope.selectedDatasets),
    ),
  ),
  click(role("checkbox", "Company policies")),
];
const selectFile: ParityStep[] = [
  ...selectDataset,
  click(button(copy((t) => t.knowledge.scope.files))),
  click(
    role(
      "radio",
      copy((t) => t.knowledge.scope.selectedDocuments),
    ),
  ),
  click(role("checkbox", "Leave.pdf")),
];
const scopeFeature = { knowledgeScopeSelectionEnabled: true };
const sourceId = "0123456789abcdef0123456789abcdef-1";
const citationMessages = [
  { id: "human", type: "human", content: "What is the maximum pressure?" },
  {
    id: "search",
    type: "ai",
    content: "",
    tool_calls: [
      {
        id: "search-1",
        name: "knowledge_search",
        args: { query: "maximum pressure" },
      },
    ],
  },
  {
    id: "tool",
    type: "tool",
    name: "knowledge_search",
    tool_call_id: "search-1",
    content: `[citation:1](#knowledge-${sourceId}) Safety manual.pdf`,
    artifact: {
      knowledge_sources: {
        version: 1,
        sources: [
          {
            id: sourceId,
            provider: "ragflow",
            dataset_name: "Engineering",
            dataset_id: "policies",
            document_name: "Safety manual.pdf",
            document_id: "safety",
            chunk_id: "chunk-a",
            text: "Maximum pressure: 42 kPa.\nInspect the seal before operation.",
            pages: [3],
            truncated: false,
          },
        ],
      },
    },
  },
  {
    id: "answer",
    type: "ai",
    content: `Maximum pressure: **42 kPa**. [citation:1](#knowledge-${sourceId})\n\n## Sources\n- [Safety manual.pdf](#knowledge-${sourceId})`,
  },
];
const loadedSkills = [
  {
    name: "using-superpowers",
    description: "Check applicable skills first",
    category: "custom",
    path: "/mnt/skills/custom/using-superpowers/SKILL.md",
    content: "# Using Superpowers\n\nRead relevant skills before starting.",
    content_hash: "a".repeat(64),
    activation: "slash",
    partial: false,
  },
  {
    name: "verification-before-completion",
    description: "Verify the result before completion",
    category: "public",
    path: "/mnt/skills/public/verification-before-completion/SKILL.md",
    content:
      "# Verification Before Completion\n\nRun checks and record actual results.",
    content_hash: "b".repeat(64),
    activation: "automatic",
    partial: true,
  },
];
const skillMessages = (include: boolean) => [
  { type: "human", id: "u", content: "Check this change", run_id: "skill-run" },
  {
    type: "ai",
    id: "start",
    content: "Read the applicable skill first.",
    run_id: "skill-run",
    additional_kwargs: include ? { skill_usage: loadedSkills[0] } : {},
  },
  {
    type: "ai",
    id: "read",
    content: "",
    run_id: "skill-run",
    tool_calls: [
      {
        id: "read-call",
        name: "read_file",
        args: { path: loadedSkills[1]!.path },
      },
    ],
  },
  {
    type: "tool",
    id: "loaded",
    content: loadedSkills[1]!.content,
    name: "read_file",
    tool_call_id: "read-call",
    run_id: "skill-run",
    additional_kwargs: include ? { skill_usage: loadedSkills[1] } : {},
  },
  {
    type: "ai",
    id: "final",
    content: "The change is verified.",
    run_id: "skill-run",
  },
];
const iconFile = {
  name: "blue.png",
  mimeType: "image/png",
  base64:
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9XkAAAAASUVORK5CYII=",
};
const editPersonal: ParityStep[] = [
  click(button(/^(Edit|编辑) github \((My plugins|我的插件)\)$/)),
];
const revision = "a".repeat(64);
const assetRoot = `/api/plugins/community.bookmarks/assets/${revision}/static/dist`;
const packageRoot = fileURLToPath(
  new URL("../../fixtures/extensions/bookmarks/", import.meta.url),
);
const bookmarkContribution = {
  namespace: "community.bookmarks",
  viewer_id: "default",
  module: "bookmarks.v1",
  transport: "assets-v1",
  entry: `${assetRoot}/index.mjs`,
  title: "Bookmarks",
  description: "Save answers privately",
  backend_actions: ["search", "save", "rename", "get", "delete"],
  settings: { enabled: true },
};
const bookmarkRoutes: ParityRouteOverride[] = [
  { pattern: "**/api/plugins", json: [bookmarkContribution] },
  ...["index.mjs", "chunks/bookmarks.mjs", "styles.css", "bookmark.svg"].map(
    (file) => ({
      pattern: `**${assetRoot}/${file}`,
      contentType: file.endsWith(".mjs")
        ? "text/javascript"
        : file.endsWith(".css")
          ? "text/css"
          : "image/svg+xml",
      json: readFileSync(path.join(packageRoot, file), "utf8"),
    }),
  ),
  {
    pattern: "**/api/plugins/community.bookmarks/actions/search",
    json: {
      total: 1,
      items: [
        {
          id: "saved-answer",
          thread_id: MOCK_THREAD_ID,
          message_id: "answer",
          label: "Plugin architecture",
          text: "ORCHID plugin design: pages, backend actions and model tools.",
          created_at: "2026-09-01T00:00:00Z",
          truncated: true,
        },
      ],
    },
  },
  {
    pattern: "**/api/plugins/community.bookmarks/actions/get",
    json: {
      text: "ORCHID plugin design: pages, backend actions and model tools. Full saved content.",
    },
  },
  {
    pattern: "**/api/plugins/community.bookmarks/actions/save",
    json: { success: true },
  },
  {
    pattern: "**/api/plugins/community.bookmarks/actions/rename",
    json: { success: true },
  },
];
const mentionsSource = `export default {apiVersion:1,module:'team',mentionProviders:[{id:'people',label:'Team members',search:async(query,ctx)=>ctx.callBackend('search',{query,threadId:ctx.threadId})},{id:'broken',label:'Unavailable',search:async()=>{throw Error('offline')}}]};`;
const mentionsEntry = `/api/plugins/modules/team/${createHash("sha256").update(mentionsSource).digest("hex")}.mjs`;
const mentionsRoutes: ParityRouteOverride[] = [
  {
    pattern: "**/api/plugins",
    json: [
      {
        namespace: "community.team",
        viewer_id: "default",
        module: "team",
        entry: mentionsEntry,
        title: "Team",
        description: "",
        settings: { enabled: true },
        backend_actions: ["search"],
      },
    ],
  },
  {
    pattern: `**${mentionsEntry}`,
    contentType: "text/javascript",
    json: mentionsSource,
  },
  {
    pattern: "**/api/plugins/community.team/actions/search",
    json: [{ id: "alice", label: "Alice", description: "Team members" }],
    queryFilter: { requestField: "query", fields: ["label", "description"] },
  },
];

/** Current routes and product states shared verbatim across both frontends. */
export const CAPABILITY_PARITY_SCENARIOS: ParityScenario[] = [
  {
    id: "capability-center",
    title: "能力中心目录、查询、详情、社区与旧设置替换",
    backend: "mock",
    path: "/workspace/capabilities",
    dimensions,
    settle: [],
    mock: { skills },
    routes: mcpRoutes,
    states: [
      {
        id: "directory",
        steps: [
          visible(
            role(
              "heading",
              copy((t) => t.capabilities.title),
            ),
          ),
          visible(
            button(/^(View details Lark \/ Feishu|查看详情 飞书 \/ Lark)$/),
          ),
        ],
      },
      {
        id: "search",
        steps: [
          fill(
            role(
              "textbox",
              copy((t) => t.capabilities.searchPlugins),
            ),
            "github",
          ),
          visible(button(/^(Edit|编辑) github \((My plugins|我的插件)\)$/)),
        ],
      },
      {
        id: "skills",
        path: "/workspace/capabilities?tab=skills",
        steps: [
          visible(button(/^(View details|查看详情) (deep-research|深度研究)$/)),
          visible(button(copy((t) => t.settings.skills.installFromFile))),
        ],
      },
      {
        id: "skill-detail",
        path: "/workspace/capabilities?tab=skills",
        steps: [
          click(button(/^(View details|查看详情) (deep-research|深度研究)$/)),
          visible(role("dialog")),
        ],
      },
      {
        id: "community",
        path: "/workspace/capabilities?tab=skills",
        steps: [
          click(tab(copy((t) => t.capabilities.community))),
          visible(text(copy((t) => t.capabilities.communityTitle))),
        ],
      },
      {
        id: "empty-search",
        steps: [
          fill(
            role(
              "textbox",
              copy((t) => t.capabilities.searchPlugins),
            ),
            "no-such-plugin",
          ),
          visible(text(copy((t) => t.capabilities.noResults))),
        ],
      },
      {
        id: "mcp-unavailable-lark-independent",
        routes: [
          {
            pattern: "**/api/mcp/personal/config",
            status: 403,
            json: { detail: "Admin only" },
          },
        ],
        steps: [
          visible(role("alert")),
          visible(
            button(/^(View details Lark \/ Feishu|查看详情 飞书 \/ Lark)$/),
          ),
        ],
      },
      {
        id: "migrated-settings",
        path: "/workspace/capabilities?settings=appearance",
        steps: [
          visible(
            role(
              "dialog",
              copy((t) => t.common.settings),
            ),
          ),
          { kind: "hidden", target: button(/^(Tools|工具)$/) },
          { kind: "hidden", target: button(/^(Integrations|集成)$/) },
        ],
      },
    ],
  },
  {
    id: "mcp-settings",
    upstreamSpecs: ["platform-mcp-controls"],
    title: "共享与个人MCP独立身份、管理、失败与编辑",
    backend: "mock",
    path: "/workspace/capabilities",
    dimensions,
    settle: [],
    routes: mcpRoutes,
    states: [
      {
        id: "same-name-independent",
        steps: [
          fill(
            role(
              "textbox",
              copy((t) => t.capabilities.searchPlugins),
            ),
            "github",
          ),
          visible(
            role(
              "switch",
              /^(Enabled github \(Platform provided\)|已启用 github \(平台提供\))$/,
            ),
          ),
          visible(
            role(
              "switch",
              /^(Enabled github \(My plugins\)|已启用 github \(我的插件\))$/,
            ),
          ),
        ],
      },
      {
        id: "edit-personal",
        steps: [
          click(button(/^(Edit|编辑) github \((My plugins|我的插件)\)$/)),
          visible(
            role(
              "textbox",
              copy((t) => t.settings.tools.serverDefinitionLabel),
            ),
          ),
          visible(button(copy((t) => t.capabilities.icon.reset))),
        ],
      },
      {
        id: "edit-platform",
        steps: [
          click(
            button(/^(Edit|编辑) github \((Platform provided|平台提供)\)$/),
          ),
          visible(
            role(
              "textbox",
              copy((t) => t.settings.tools.serverDefinitionLabel),
            ),
          ),
        ],
      },
      {
        id: "add-personal",
        steps: [
          click(
            button(
              /^(Add MCP plugin \(My plugins\)|添加 MCP 插件 \(我的插件\))$/,
            ),
          ),
          visible(
            role(
              "textbox",
              copy((t) => t.settings.tools.serverDefinitionLabel),
            ),
          ),
        ],
      },
      {
        id: "toggle-failure",
        dimensions: enDimensions,
        routes: [
          {
            pattern: "**/api/mcp/config",
            status: 409,
            json: { detail: "Configuration changed. Refresh before editing." },
          },
        ],
        steps: [
          visible(role("alert")),
          visible(button("Add MCP plugin (My plugins)")),
        ],
      },
    ],
  },
  {
    id: "integrations",
    title: "能力中心飞书安装、应用切换、权限与OAuth状态",
    backend: "mock",
    path: "/workspace/capabilities?plugin=lark",
    settle: [],
    dimensions: enDimensions,
    states: [
      {
        id: "install",
        steps: [
          visible(text("Lark / Feishu CLI")),
          click(button("Install")),
          visible(text("Installed 3 Lark/Feishu skills.")),
        ],
      },
      {
        id: "configured",
        routes: [{ pattern: "**/api/integrations/lark/status", json: lark }],
        steps: [
          visible(text("Installed: v1.0.65")),
          visible(text(/Update available: v1.0.66/)),
          visible(text(/Skill pack version differs/)),
        ],
      },
      {
        id: "change-app",
        routes: [{ pattern: "**/api/integrations/lark/status", json: lark }],
        steps: [
          click(button("Change Lark app")),
          visible(role("textbox", "App ID")),
          visible(role("button", "Switch app")),
        ],
      },
      {
        id: "permissions",
        routes: [
          {
            pattern: "**/api/integrations/lark/status",
            json: {
              ...lark,
              auth: { status: "not_authorized", verified: false },
            },
          },
        ],
        steps: [
          click(button("Calendar")),
          fill(
            role("textbox", "Exact OAuth scope"),
            "calendar:calendar.event:read",
          ),
          visible(button("Connect Lark")),
        ],
      },
      {
        id: "install-error",
        routes: [
          {
            pattern: "**/api/integrations/lark/install",
            status: 503,
            json: { detail: "CLI installer unavailable" },
          },
        ],
        steps: [
          click(button("Install")),
          visible(text("CLI installer unavailable")),
        ],
      },
      {
        id: "status-error",
        routes: [
          {
            pattern: "**/api/integrations/lark/status",
            status: 503,
            json: { detail: "Integration status unavailable" },
          },
        ],
        steps: [visible(text(/Integration status unavailable/))],
      },
    ],
  },
  ...["dingtalk", "wecom", "hubspot"].map((id): ParityScenario => ({
    id: id === "hubspot" ? "business-plugins" : `business-plugins-${id}`,
    upstreamSpecs: ["business-plugins"],
    title: `内置业务插件 ${id} 的凭证配置与错误恢复`,
    backend: "mock",
    path: `/workspace/capabilities?plugin=${id}`,
    settle: [],
    dimensions: enDimensions,
    states: [
      {
        id: "configuration",
        steps: [
          visible(role("textbox", "Connection name")),
          visible(button("Save configuration")),
          { kind: "hidden", target: role("textbox", "Server URL") },
        ],
      },
      {
        id: "rejected-credentials",
        routes: [
          {
            pattern: "**/api/capabilities/installations",
            status: 422,
            json: { detail: "Invalid credential" },
          },
        ],
        steps: [
          fill(role("textbox", "Connection name"), `team-${id}`),
          ...Object.entries(
            id === "dingtalk"
              ? { access_token: "token", sign_secret: "secret" }
              : id === "wecom"
                ? { webhook_key: "key" }
                : { access_token: "token" },
          ).map(([key, value]) =>
            fill({ selector: `#plugin-field-${key}` }, value),
          ),
          click(button("Save configuration")),
          visible(role("alert")),
        ],
      },
    ],
  })),
  {
    id: "skills-settings",
    title: "技能启用失败保留原值、社区过滤与导入入口",
    backend: "mock",
    path: "/workspace/capabilities?tab=skills",
    settle: [],
    dimensions,
    mock: { skills },
    states: [
      { id: "builtin", steps: [visible(role("switch", /deep-research$/))] },
      {
        id: "toggle-error",
        routes: [
          {
            pattern: "**/api/skills/deep-research",
            status: 500,
            json: { detail: "Toggle rejected" },
          },
        ],
        steps: [
          click(role("switch", /deep-research$/)),
          visible(text("Toggle rejected")),
        ],
      },
      {
        id: "custom",
        steps: [
          click(tab(copy((t) => t.capabilities.custom))),
          visible(role("switch", /demo$/)),
        ],
      },
      {
        id: "community-no-search-results",
        steps: [
          fill(
            role(
              "textbox",
              copy((t) => t.capabilities.searchSkills),
            ),
            "no-such-skill",
          ),
          click(tab(copy((t) => t.capabilities.community))),
          visible(text(copy((t) => t.capabilities.noResults))),
        ],
      },
    ],
  },
  {
    id: "skill-export",
    title: "技能导出清单、409刷新门禁与阻断详情",
    backend: "mock",
    path: "/workspace/capabilities?tab=skills",
    dimensions,
    settle: [],
    mock: { skills },
    routes: [
      { pattern: "**/api/skills/custom/demo/export-manifest", json: manifest },
    ],
    states: [
      {
        id: "manifest",
        steps: [
          ...openExport,
          visible(text("DEMO_TOKEN (required)")),
          click({ selector: '[role="dialog"] details > summary' }),
          visible(text("SKILL.md")),
        ],
        dimensions: enDimensions,
      },
      {
        id: "download",
        dimensions: enDimensions,
        routes: [
          {
            pattern: "**/api/skills/custom/demo/export?*",
            contentType: "application/zip",
            headers: {
              "Content-Disposition": 'attachment; filename="demo.skill"',
            },
            json: "synthetic archive transport fixture",
          },
        ],
        steps: [
          ...openExport,
          {
            kind: "download",
            target: button("Download .skill"),
            suggestedFilename: "demo.skill",
          },
          visible(text("File handed to your browser for download.")),
        ],
      },
      {
        id: "stale-content",
        dimensions: enDimensions,
        routes: [
          {
            pattern: "**/api/skills/custom/demo/export?*",
            status: 409,
            json: { detail: { code: "skill_changed", message: "Changed" } },
          },
        ],
        steps: [
          ...openExport,
          click(button("Download .skill")),
          visible(
            text(
              "The skill changed. Refresh the file list before downloading.",
            ),
          ),
          click(button("Refresh file list")),
          visible(button("Download .skill")),
        ],
      },
      {
        id: "blocked",
        routes: [
          {
            pattern: "**/api/skills/custom/demo/export-manifest",
            json: {
              ...manifest,
              revision: null,
              can_export: false,
              blockers: [
                {
                  code: "skill_export_link",
                  message: "Linked files or directories cannot be exported.",
                  path: "scripts/linked",
                },
              ],
            },
          },
        ],
        steps: [
          ...openExport,
          visible(text("scripts/linked")),
          {
            kind: "hidden",
            target: button(/^(Download \.skill|下载 \.skill)$/),
          },
        ],
      },
    ],
  },
  {
    id: "plugin-icons",
    title: "MCP本地图标与自定义图标编辑预览",
    backend: "mock",
    path: "/workspace/capabilities",
    settle: [],
    dimensions,
    routes: mcpRoutes,
    states: [
      {
        id: "local-brand",
        steps: [visible({ selector: 'img[data-plugin-icon="github"]' })],
      },
      {
        id: "uploaded-preview",
        steps: [
          ...editPersonal,
          {
            kind: "set-input-files",
            target: { selector: '[role="dialog"] input[type="file"]' },
            file: iconFile,
          },
          visible({
            selector: '[role="dialog"] img[src^="data:image/png;base64,"]',
          }),
          visible(save),
        ],
      },
      {
        id: "invalid-upload-preserves-icon",
        steps: [
          ...editPersonal,
          {
            kind: "set-input-files",
            target: { selector: '[role="dialog"] input[type="file"]' },
            file: {
              name: "vector.svg",
              mimeType: "image/svg+xml",
              base64: Buffer.from(
                '<svg xmlns="http://www.w3.org/2000/svg"/>',
              ).toString("base64"),
            },
          },
          visible(text(copy((t) => t.capabilities.icon.errors.type))),
          visible(button(copy((t) => t.capabilities.icon.reset))),
        ],
      },
      {
        id: "editor",
        steps: [
          click(button(/^(Edit|编辑) github \((My plugins|我的插件)\)$/)),
          visible(button(copy((t) => t.capabilities.icon.upload))),
          visible(button(copy((t) => t.capabilities.icon.change))),
          {
            kind: "set-input-files",
            target: { selector: '[role="dialog"] input[type="file"]' },
            file: iconFile,
          },
          visible({
            selector: '[role="dialog"] img[src^="data:image/png;base64,"]',
          }),
          click(button(copy((t) => t.capabilities.icon.reset))),
          visible(
            role(
              "textbox",
              copy((t) => t.settings.tools.serverDefinitionLabel),
            ),
          ),
        ],
      },
      {
        id: "unknown-name-no-impersonation",
        routes: [
          {
            pattern: "**/api/mcp/personal/config",
            json: {
              mcp_servers: {
                "my-github-lookalike": {
                  ...personal.github,
                  capability: undefined,
                },
              },
            },
          },
        ],
        steps: [
          visible(text("my-github-lookalike")),
          click(
            button(
              /^(Edit|编辑) my-github-lookalike \((My plugins|我的插件)\)$/,
            ),
          ),
          visible(button(copy((t) => t.capabilities.icon.upload))),
        ],
      },
    ],
  },
  {
    id: "agent-knowledge-binding",
    upstreamSpecs: ["agent-knowledge-binding", "agent-settings-layout"],
    title: "Agent设置布局、能力选择与知识默认范围保存",
    backend: "mock",
    path: "/workspace/agents",
    dimensions,
    settle: [],
    mock: { agents: [agent], features: scopeFeature },
    routes: [
      ...datasets,
      { pattern: "**/api/agents/researcher", json: agent },
      {
        pattern: "**/api/subagents",
        json: {
          subagents: [
            {
              name: "general-purpose",
              description:
                "A general-purpose worker for independent analysis. ".repeat(
                  20,
                ),
              enabled: true,
            },
            { name: "bash", description: "Run shell commands", enabled: true },
          ],
        },
      },
    ],
    states: [
      {
        id: "settings",
        steps: [
          click({ selector: '[title="Agent settings"], [title="智能体设置"]' }),
          visible(role("dialog", /^(Agent settings|智能体设置) · researcher$/)),
          visible(save),
        ],
      },
      {
        id: "selected-subagent-description",
        steps: [
          click({ selector: '[title="Agent settings"], [title="智能体设置"]' }),
          click({ selector: '[role="dialog"] [role="combobox"] >> nth=-1' }),
          click(
            role(
              "option",
              copy((t) => t.settings.subagents.selectedAllowed),
            ),
          ),
          click(role("checkbox", "general-purpose")),
          click({ selector: 'summary[aria-label^="general-purpose:"]' }),
          visible({
            selector: `[role="dialog"] details[open] > p:text-is("${"A general-purpose worker for independent analysis. ".repeat(20).trim()}")`,
          }),
          visible(save),
        ],
      },
      {
        id: "selected-dataset",
        steps: [
          click({ selector: '[title="Agent settings"], [title="智能体设置"]' }),
          ...selectDataset,
          click(apply),
          visible(text("Company policies")),
          visible(save),
        ],
      },
      {
        id: "binding-reset",
        routes: [
          {
            pattern: "**/api/agents",
            json: {
              agents: [
                {
                  ...agent,
                  knowledge_scope: {
                    version: 1,
                    mode: "selected",
                    dataset_ids: ["policies"],
                    display: {
                      datasets: [{ id: "policies", name: "Company policies" }],
                    },
                  },
                },
              ],
            },
          },
          {
            pattern: "**/api/agents/researcher",
            json: {
              ...agent,
              knowledge_scope: {
                version: 1,
                mode: "selected",
                dataset_ids: ["policies"],
                display: {
                  datasets: [{ id: "policies", name: "Company policies" }],
                },
              },
            },
          },
        ],
        steps: [
          click({ selector: '[title="Agent settings"], [title="智能体设置"]' }),
          visible(text("Company policies")),
          click(button(/^(Use all knowledge bases|使用全部知识库)$/)),
          visible(save),
        ],
      },
    ],
  },
  {
    id: "knowledge-scope",
    title: "普通及Agent会话知识范围、单文件选择与不可搜索状态",
    backend: "mock",
    path: "/workspace/chats/new",
    dimensions,
    settle: [],
    mock: { agents: [agent], features: scopeFeature },
    routes: datasets,
    states: [
      {
        id: "all",
        steps: [
          click(scopeTrigger),
          visible(
            role(
              "radio",
              copy((t) => t.knowledge.scope.allDatasets),
            ),
          ),
        ],
      },
      {
        id: "disabled",
        steps: [
          click(scopeTrigger),
          click(
            role(
              "radio",
              copy((t) => t.knowledge.scope.disabled),
            ),
          ),
          click(apply),
          visible(button(copy((t) => t.knowledge.scope.buttonDisabled))),
        ],
      },
      {
        id: "file-selection",
        steps: [...selectFile, visible(role("checkbox", "Parsing.pdf"))],
      },
      {
        id: "applied-file",
        steps: [...selectFile, click(apply), visible(scopeTrigger)],
      },
      {
        id: "agent-file-selection",
        path: "/workspace/agents/researcher/chats/new",
        steps: [...selectFile, visible(role("checkbox", "Parsing.pdf"))],
      },
      {
        id: "catalog-error",
        routes: [
          {
            pattern: "**/api/knowledge/retrieval-catalog/datasets?*",
            status: 503,
            json: { detail: "Catalog unavailable" },
          },
        ],
        steps: [
          click(scopeTrigger),
          click(
            role(
              "radio",
              copy((t) => t.knowledge.scope.selectedDatasets),
            ),
          ),
          visible(text(copy((t) => t.knowledge.scope.loadFailed))),
        ],
      },
    ],
  },
  {
    id: "knowledge-citations",
    title: "知识引用、Sources条目、历史来源证据与窄屏对话框",
    backend: "mock",
    path: `/workspace/chats/${MOCK_THREAD_ID}`,
    dimensions,
    settle: [],
    mock: {
      threads: [
        {
          thread_id: MOCK_THREAD_ID,
          title: "Knowledge source verification",
          messages: citationMessages,
        },
      ],
    },
    states: [
      {
        id: "restored-after-reload",
        steps: [
          { kind: "reload" },
          visible({
            selector: 'button[aria-label*="Safety manual.pdf"] >> nth=0',
          }),
        ],
      },
      {
        id: "references",
        steps: [
          visible({
            selector: 'button[aria-label*="Safety manual.pdf"] >> nth=0',
          }),
        ],
      },
      {
        id: "source-evidence",
        steps: [
          click({
            selector: 'button[aria-label*="Safety manual.pdf"] >> nth=0',
          }),
          visible(role("dialog")),
          visible(text("Inspect the seal before operation.")),
        ],
      },
    ],
  },
  {
    id: "skill-usage",
    title: "每轮技能菜单、快照切换、部分内容与旧历史",
    backend: "mock",
    path: "/workspace/chats/skill-history",
    dimensions,
    settle: [],
    mock: {
      threads: [
        {
          thread_id: "skill-history",
          title: "Skills used",
          messages: skillMessages(true),
        },
        {
          thread_id: "skill-history-old",
          title: "Older history",
          messages: skillMessages(false),
        },
      ],
    },
    states: [
      {
        id: "restored-after-reload",
        steps: [
          { kind: "reload" },
          click(button(copy((t) => t.skillUsage.used))),
          click(role("menuitem", /using-superpowers/)),
          visible(role("heading", "Using Superpowers")),
        ],
      },
      {
        id: "menu",
        steps: [
          click(button(copy((t) => t.skillUsage.used))),
          visible(role("menuitem", /using-superpowers/)),
          visible(role("menuitem", /verification-before-completion/)),
        ],
      },
      {
        id: "snapshot",
        steps: [
          click(button(copy((t) => t.skillUsage.used))),
          click(role("menuitem", /using-superpowers/)),
          visible(role("region", "SKILL.md")),
          visible(role("heading", "Using Superpowers")),
          visible(button(copy((t) => t.skillUsage.copy))),
        ],
      },
      {
        id: "switch-partial",
        steps: [
          click(button(copy((t) => t.skillUsage.used))),
          click(role("menuitem", /verification-before-completion/)),
          visible(role("heading", "Verification Before Completion")),
          visible(text(copy((t) => t.skillUsage.partial))),
        ],
      },
      {
        id: "old-no-evidence",
        path: "/workspace/chats/skill-history-old",
        steps: [
          { kind: "hidden", target: button(copy((t) => t.skillUsage.used)) },
          visible(text("The change is verified.")),
        ],
      },
    ],
  },
  {
    id: "tool-call-details",
    title: "工具调试详情、错误截断与数字精度",
    backend: "mock",
    path: "/workspace/chats/tool-details",
    dimensions,
    settle: [],
    stubs: {
      localStorage: {
        "deerflow.local-settings": JSON.stringify({
          tokenUsage: { headerTotal: true, inlineMode: "step_debug" },
        }),
      },
    },
    routes: [
      {
        pattern: "**/api/models",
        json: { models: [], token_usage: { enabled: true } },
      },
    ],
    mock: {
      threads: [
        ...["error", "precise"].map((state) => ({
          thread_id:
            state === "error" ? "tool-details" : "tool-details-precise",
          title: "Tool details",
          messages: [
            { type: "human", id: "human", content: "Look up the run" },
            {
              type: "ai",
              id: "ai-tool",
              content: "",
              tool_calls: [
                {
                  id: "call-4389",
                  name: "mcp_lookup",
                  args: { run_id: "run-4389" },
                },
              ],
            },
            {
              type: "tool",
              id: "tool-result",
              tool_call_id: "call-4389",
              status: state === "error" ? "error" : "success",
              content:
                state === "error"
                  ? "denied: " + "x".repeat(20000)
                  : '{"run_id":9223372036854775807,"ratio":0.1234567890123456789}',
            },
            { type: "ai", id: "answer", content: "The lookup finished." },
          ],
        })),
      ],
    },
    states: [
      {
        id: "collapsed",
        steps: [visible(lookupDetails)],
      },
      {
        id: "bounded-error",
        steps: [
          click(lookupDetails),
          visible(role("region", /^(Input|输入)$/)),
          visible(role("region", /^(Error|错误)$/)),
        ],
      },
      {
        id: "precise-result",
        path: "/workspace/chats/tool-details-precise",
        steps: [
          click(lookupDetails),
          visible(
            text(
              '{"run_id":9223372036854775807,"ratio":0.1234567890123456789}',
            ),
          ),
        ],
      },
    ],
  },
  {
    id: "bookmark-plugin",
    title: "完整书签包页面、宿主导航、搜索、重命名与删除确认",
    backend: "mock",
    path: "/workspace/extensions/community.bookmarks/library",
    dimensions,
    settle: [],
    routes: bookmarkRoutes,
    mock: {
      threads: [
        {
          thread_id: MOCK_THREAD_ID,
          title: "Plugin architecture",
          messages: [
            {
              type: "human",
              id: "u",
              content: "What should a plugin host provide?",
            },
            {
              type: "ai",
              id: "answer",
              content:
                "ORCHID plugin design: pages, backend actions and model tools.",
            },
          ],
        },
      ],
    },
    states: [
      {
        id: "library",
        steps: [
          visible(role("searchbox", /^(Search bookmarks|搜索书签)$/)),
          visible(role("textbox", /^(Bookmark name|书签名称)$/)),
        ],
      },
      {
        id: "rename",
        steps: [
          fill(role("textbox", /^(Bookmark name|书签名称)$/), "Renamed answer"),
          click(button(/^(Save name|保存名称)$/)),
          visible(button(/^(Open conversation|返回会话)$/)),
        ],
      },
      {
        id: "full-answer",
        steps: [
          click(button(/^(Read full answer|查看完整内容)$/)),
          visible(text(/Full saved content/)),
        ],
      },
      {
        id: "delete-confirm",
        steps: [
          click(button(copy((t) => t.common.delete))),
          visible(button(/^(Confirm delete|确认删除)$/)),
          visible(button(copy((t) => t.common.cancel))),
        ],
      },
      {
        id: "search-error",
        routes: [
          {
            pattern: "**/api/plugins/community.bookmarks/actions/search",
            status: 503,
            json: { detail: "Search unavailable" },
          },
        ],
        steps: [
          visible(role("alert")),
          visible(role("searchbox", /^(Search bookmarks|搜索书签)$/)),
        ],
      },
      {
        id: "unknown-page",
        path: "/workspace/extensions/missing.plugin/library",
        steps: [
          visible(
            role(
              "heading",
              copy((t) => t.extensions.pageUnavailable),
            ),
          ),
          visible(button(copy((t) => t.extensions.reload))),
          visible(
            role(
              "link",
              copy((t) => t.extensions.viewAll),
            ),
          ),
        ],
      },
      {
        id: "directory-discovery-error",
        path: "/workspace/capabilities?tab=extensions",
        routes: [
          {
            pattern: "**/api/plugins",
            status: 503,
            json: { detail: "Unavailable" },
          },
        ],
        steps: [
          visible(role("alert")),
          visible(button(/^(View Bookmarks|查看 会话书签)$/)),
        ],
      },
    ],
  },
  {
    id: "plugin-assets",
    title: "当前书签assets-v1原生模块图、CSS图像与缺失资产恢复",
    backend: "mock",
    path: "/workspace/extensions/community.bookmarks/library",
    dimensions,
    settle: [],
    routes: bookmarkRoutes,
    states: [
      {
        id: "native-module-graph",
        steps: [
          visible(
            role(
              "heading",
              /^(Keep answers worth returning to|留住值得再看的回答)$/,
            ),
          ),
          visible(role("searchbox", /^(Search bookmarks|搜索书签)$/)),
        ],
      },
      {
        id: "missing-entry",
        routes: [
          {
            pattern: `**${assetRoot}/index.mjs`,
            status: 404,
            json: { detail: "Plugin asset unavailable" },
          },
        ],
        steps: [
          visible(
            role(
              "heading",
              copy((t) => t.extensions.pageUnavailable),
            ),
          ),
          visible(button(copy((t) => t.extensions.reload))),
        ],
      },
      {
        id: "forbidden-entry",
        routes: [
          {
            pattern: `**${assetRoot}/index.mjs`,
            status: 403,
            json: { detail: "Plugin asset forbidden" },
          },
        ],
        steps: [
          visible(
            role(
              "heading",
              copy((t) => t.extensions.pageUnavailable),
            ),
          ),
          visible(
            role(
              "link",
              copy((t) => t.extensions.viewAll),
            ),
          ),
        ],
      },
    ],
  },
  {
    id: "extension-mentions",
    title: "插件候选与技能共存、失败隔离和结构化引用",
    backend: "mock",
    path: "/workspace/chats/new",
    dimensions,
    settle: [],
    mock: {
      skills: [
        { name: "research", description: "Research a topic", enabled: true },
      ],
    },
    routes: mentionsRoutes,
    states: [
      {
        id: "coexisting-candidates",
        steps: [
          fill(
            role("textbox", /how can i assist you|今天我能为你做些什么/i),
            "Ask @",
          ),
          visible(role("option", "research Research a topic")),
          visible(role("option", "Alice Team members")),
        ],
      },
      {
        id: "draft-reload",
        steps: [
          fill(
            role("textbox", /how can i assist you|今天我能为你做些什么/i),
            "Ask @",
          ),
          click(role("option", "Alice Team members")),
          { kind: "reload" },
          visible(text("Alice")),
        ],
      },
      {
        id: "selected-extension",
        steps: [
          fill(
            role("textbox", /how can i assist you|今天我能为你做些什么/i),
            "Ask @",
          ),
          click(role("option", "Alice Team members")),
          visible(text("Alice")),
        ],
      },
      {
        id: "search-failure-isolated",
        routes: [
          {
            pattern: "**/api/plugins/community.team/actions/search",
            status: 503,
            json: { detail: "Search unavailable" },
          },
        ],
        steps: [
          fill(
            role("textbox", /how can i assist you|今天我能为你做些什么/i),
            "Ask @",
          ),
          visible(role("option", "research Research a topic")),
        ],
      },
    ],
  },
];
