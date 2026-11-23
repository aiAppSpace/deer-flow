import type { ParityDimension, ParityScenario, ParityStep } from "./scenarios";
import { MOCK_THREAD_ID } from "../../e2e/utils/mock-api";

const dimensions: ParityDimension[] = [
  { viewport: "desktop", theme: "light", locale: "en-US" },
  { viewport: "desktop", theme: "light", locale: "zh-CN" },
  { viewport: "mobile", theme: "light", locale: "en-US" },
  { viewport: "desktop", theme: "dark", locale: "en-US" },
];
const models = [
  {
    id: "alpha-api",
    name: "alpha-api",
    model: "alpha-api",
    display_name: "Alpha",
    supports_thinking: false,
    supports_reasoning_effort: false,
  },
  {
    id: "beta-api",
    name: "beta-api",
    model: "beta-api",
    display_name: "Shared",
    supports_thinking: true,
    supports_reasoning_effort: true,
  },
  {
    id: "beta-duplicate",
    name: "beta-duplicate",
    model: "beta-duplicate",
    display_name: "Shared",
    supports_thinking: true,
    supports_reasoning_effort: true,
  },
  {
    id: "very-long-model-name",
    name: "very-long-model-name",
    model: "provider/very-long-model-name-that-must-stay-inside-the-dialog",
    display_name:
      "A very long model display name that must truncate on narrow screens",
    supports_thinking: true,
    supports_reasoning_effort: true,
  },
];
const modelRoute = {
  pattern: "**/api/models",
  json: { models, token_usage: { enabled: false } },
};
const input = {
  role: "textbox" as const,
  name: /^(How can I assist you today\?|今天我能为你做些什么？)$/,
};
const openModel: ParityStep[] = [
  { kind: "click", target: { role: "button", name: "Alpha" } },
  {
    kind: "visible",
    target: { role: "dialog", name: /^(Choose a model|选择模型)$/ },
  },
];
const threadId = MOCK_THREAD_ID;
const accountModels = [
  {
    ...models[0],
    id: "account-model",
    name: "account-model",
    display_name: "Account Model",
    supports_thinking: true,
    supports_reasoning_effort: true,
  },
  {
    ...models[1],
    id: "thread-model",
    name: "thread-model",
    display_name: "Thread Model",
  },
];
const currentUser = {
  id: "00000000-0000-0000-0000-000000000028",
  email: "thread@example.com",
  system_role: "admin",
  needs_setup: false,
};
const refreshAccount: ParityStep[] = [
  { kind: "visible", target: input },
  {
    kind: "click",
    target: { role: "button", name: /^(Toggle Sidebar|切换侧边栏)$/ },
  },
  {
    kind: "click",
    target: { role: "button", name: /^(Settings and more|设置和更多)$/ },
  },
  { kind: "press", key: "Escape" },
  // Close the temporary drawer before returning to the composer. An account
  // refresh may retain the current owner and must not be used as a close action.
  {
    kind: "click",
    target: { role: "button", name: /^(Toggle Sidebar|切换侧边栏)$/ },
    viewports: ["mobile"],
  },
  {
    kind: "hidden",
    target: { selector: '[data-sidebar="sidebar"][data-mobile="true"]' },
    viewports: ["mobile"],
  },
  { kind: "visibility-change" },
];
const referencesFeature = {
  agents_api: { enabled: true },
  browser_control: { enabled: false },
  mcp_tasks: { enabled: false },
  knowledge_base: { scope_selection_enabled: false },
  conversation_references: { enabled: true, max_references: 3 },
  thread_activity: { available: false },
};

/** Product states use the same HTTP fixtures and interactions for React and Vue. */
export const COMPOSER_PARITY_SCENARIOS: ParityScenario[] = [
  {
    id: "model-favorites",
    title: "模型收藏分组、同名区分与紧凑选择浮层",
    backend: "mock",
    path: "/workspace/chats/new",
    settle: [],
    dimensions,
    routes: [modelRoute],
    states: [
      { id: "catalog", steps: openModel },
      {
        id: "favorite-without-selecting",
        steps: [
          ...openModel,
          {
            kind: "click",
            target: {
              role: "button",
              name: /^(Favorite Shared \(beta-api\)|收藏 Shared（beta-api）)$/,
            },
          },
          {
            kind: "visible",
            target: { role: "group", name: /^(Favorites|收藏)$/ },
          },
          { kind: "visible", target: { role: "button", name: "Alpha" } },
        ],
      },
      {
        id: "selected-favorite",
        steps: [
          ...openModel,
          {
            kind: "click",
            target: {
              role: "button",
              name: /^(Favorite Shared \(beta-api\)|收藏 Shared（beta-api）)$/,
            },
          },
          {
            kind: "click",
            target: { role: "button", name: "Shared (beta-api)" },
          },
          { kind: "visible", target: { role: "button", name: "Shared" } },
        ],
      },
    ],
  },
  {
    id: "model-management",
    title: "管理员共享模型目录、编辑和凭证语义",
    backend: "mock",
    path: `/workspace/chats/${threadId}?settings=models`,
    settle: [],
    dimensions,
    mock: { threads: [{ thread_id: threadId }] },
    routes: [
      modelRoute,
      {
        pattern: "**/api/managed-models",
        json: {
          models: [
            {
              name: "yaml",
              display_name: "Server model",
              model: "provider-yaml",
              source: "config",
              enabled: true,
            },
            {
              name: "managed",
              display_name: "Managed model",
              model: "provider-managed",
              provider: "openai-compatible",
              base_url: "https://models.example/v1",
              source: "managed",
              enabled: true,
              supports_vision: true,
              has_api_key: true,
              revision: "rev-1",
              context_window: 128000,
              max_tokens: 8192,
            },
          ],
        },
      },
    ],
    states: [
      {
        id: "directory",
        steps: [
          { kind: "visible", target: { text: "Server model" } },
          { kind: "visible", target: { text: "Managed model" } },
        ],
      },
      {
        id: "add",
        steps: [
          {
            kind: "click",
            target: { role: "button", name: /^(Add model|添加模型)$/ },
          },
          {
            kind: "visible",
            target: { role: "textbox", name: /^(Unique name|唯一名称)$/ },
          },
          {
            kind: "visible",
            target: { role: "button", name: /^(Test connection|测试连接)$/ },
          },
        ],
      },
      {
        id: "edit-preserve-secret",
        steps: [
          {
            kind: "click",
            target: { role: "button", name: /^(Edit model|编辑模型)$/ },
          },
          {
            kind: "visible",
            target: {
              text: /^(Remove the saved API key|移除已保存的 API Key)$/,
            },
          },
          {
            kind: "visible",
            target: { role: "button", name: /^(Save|保存)$/ },
          },
        ],
      },
    ],
  },
  {
    id: "mentions",
    title: "技能、项目文件和对话的统一引用与原位编辑",
    backend: "mock",
    path: "/workspace/chats/new?project=proj-1",
    settle: [],
    dimensions,
    mock: {
      threads: [
        {
          thread_id: threadId,
          title: "Writer brief",
          agent_name: "writer",
          updated_at: "2026-09-01T00:00:00Z",
        },
      ],
      skills: [
        { name: "research", description: "Research a topic", enabled: true },
        { name: "writing", description: "Write a report", enabled: true },
      ],
      projects: [{ id: "proj-1", name: "Research project" }],
      projectDocuments: [
        {
          id: "doc-1",
          project_id: "proj-1",
          name: "report.pdf",
          size_bytes: 10,
        },
      ],
    },
    routes: [{ pattern: "**/api/features", json: referencesFeature }],
    states: [
      {
        id: "all-reference-kinds",
        steps: [
          { kind: "click", target: { testId: "mention-button" } },
          { kind: "visible", target: { testId: "mention-picker" } },
          { kind: "visible", target: { role: "option", name: "report.pdf" } },
          { kind: "visible", target: { role: "option", name: "Writer brief" } },
        ],
      },
      {
        id: "inline-skill",
        steps: [
          { kind: "fill", target: input, value: "@res" },
          {
            kind: "click",
            target: { role: "option", name: "research Research a topic" },
          },
          { kind: "visible", target: { testId: "inline-skill-reference" } },
        ],
      },
      {
        id: "conversation-reference",
        steps: [
          { kind: "fill", target: input, value: "@Writer" },
          { kind: "click", target: { role: "option", name: "Writer brief" } },
          {
            kind: "visible",
            target: { testId: "conversation-reference-chip" },
          },
        ],
      },
      {
        id: "project-file-authoritative-attach",
        steps: [
          { kind: "fill", target: input, value: "@report" },
          { kind: "click", target: { role: "option", name: "report.pdf" } },
          { kind: "visible", target: { testId: "project-attachment-chip" } },
        ],
      },
    ],
  },
  {
    id: "reasoning-duration",
    title: "供应商推理、内联推理与纯回答的统一耗时标题",
    backend: "mock",
    path: "/workspace/chats/duration-provider",
    settle: [],
    dimensions,
    mock: {
      threads: ["provider", "inline", "none"].map((encoding) => ({
        thread_id: `duration-${encoding}`,
        title: "耗时标题预览",
        messages: [
          { type: "human", id: `human-${encoding}`, content: "你好" },
          {
            type: "ai",
            id: `ai-${encoding}`,
            content:
              encoding === "inline"
                ? "<think>先理解用户的需求，再给出简洁的回答。</think>你好！有什么可以帮你的吗？"
                : "你好！有什么可以帮你的吗？",
            additional_kwargs: {
              turn_duration: 31,
              ...(encoding === "provider"
                ? { reasoning_content: "先理解用户的需求，再给出简洁的回答。" }
                : {}),
            },
          },
        ],
      })),
    },
    states: [
      {
        id: "provider-collapsed",
        steps: [{ kind: "visible", target: { testId: "run-duration" } }],
      },
      {
        id: "provider-expanded",
        steps: [
          {
            kind: "click",
            target: {
              role: "button",
              name: /^(Took 31s Reasoning|用时 31 秒 思考过程)$/,
            },
          },
          {
            kind: "visible",
            target: { text: "先理解用户的需求，再给出简洁的回答。" },
          },
        ],
      },
      {
        id: "inline-collapsed",
        path: "/workspace/chats/duration-inline",
        steps: [{ kind: "visible", target: { testId: "run-duration" } }],
      },
      {
        id: "no-reasoning",
        path: "/workspace/chats/duration-none",
        steps: [
          { kind: "visible", target: { testId: "run-duration" } },
          { kind: "visible", target: { text: "你好！有什么可以帮你的吗？" } },
        ],
      },
    ],
  },
  {
    id: "settings-model-sync",
    title: "线程模型覆盖下的账户模式与推理档编辑",
    backend: "mock",
    path: `/workspace/chats/${threadId}`,
    settle: [],
    dimensions: dimensions.filter((dimension) => dimension.locale === "en-US"),
    mock: {
      threads: [
        { thread_id: threadId },
        { thread_id: "agent-model-sync", agent_name: "researcher" },
      ],
      agents: [
        {
          name: "researcher",
          description: "Research agent",
          model: null,
          tool_groups: null,
          skills: null,
        },
      ],
    },
    stubs: {
      localStorage: {
        [`deerflow.thread-model.${threadId}`]: "thread-model",
        "deerflow.thread-model.agent-model-sync": "thread-model",
      },
    },
    routes: [
      {
        pattern: "**/api/models",
        json: { models: accountModels, token_usage: { enabled: false } },
      },
      { pattern: "**/api/v1/auth/me", json: currentUser },
      {
        pattern: "**/api/v1/auth/preferences",
        json: {
          model_name: "account-model",
          mode: "pro",
          reasoning_effort: "medium",
          notification_enabled: true,
          locale: "en-US",
        },
      },
    ],
    states: [
      {
        id: "thread-model-and-account-effort-zh",
        dimensions: [{ viewport: "desktop", theme: "light", locale: "zh-CN" }],
        routes: [
          {
            pattern: "**/api/v1/auth/preferences",
            json: {
              model_name: "account-model",
              mode: "pro",
              reasoning_effort: "medium",
              notification_enabled: true,
              locale: "zh-CN",
            },
          },
        ],
        steps: [
          ...refreshAccount,
          { kind: "visible", target: { role: "button", name: "Thread Model" } },
          { kind: "click", target: { role: "button", name: /^推理深度: 中$/ } },
          { kind: "visible", target: { role: "menuitemradio", name: /^高/ } },
        ],
      },
      {
        id: "thread-model-and-account-effort",
        steps: [
          ...refreshAccount,
          { kind: "visible", target: { role: "button", name: "Thread Model" } },
          {
            kind: "click",
            target: {
              role: "button",
              name: /^(Reasoning Effort: Medium|推理深度: 中)$/,
            },
          },
          {
            kind: "visible",
            target: { role: "menuitemradio", name: /^(High|高)/ },
          },
        ],
      },
      {
        id: "mode-menu",
        steps: [
          ...refreshAccount,
          { kind: "visible", target: { role: "button", name: "Thread Model" } },
          {
            kind: "visible",
            target: {
              role: "button",
              name: /^(Reasoning Effort: Medium|推理深度: 中)$/,
            },
          },
          { kind: "click", target: { role: "button", name: /^Pro$/ } },
          {
            kind: "visible",
            target: { role: "menuitemradio", name: /^Ultra/ },
          },
        ],
      },
      {
        id: "custom-agent-effort",
        path: "/workspace/agents/researcher/chats/agent-model-sync",
        steps: [
          ...refreshAccount,
          { kind: "visible", target: { role: "button", name: "Thread Model" } },
          {
            kind: "click",
            target: {
              role: "button",
              name: /^(Reasoning Effort: Medium|推理深度: 中)$/,
            },
          },
          {
            kind: "visible",
            target: { role: "menuitemradio", name: /^(High|高)/ },
          },
        ],
      },
    ],
  },
];
