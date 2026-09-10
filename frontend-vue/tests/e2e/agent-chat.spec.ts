/*
  【文件职责】     Vue custom-agent chat contracts；验证与 React 产品行为对齐的 Vue 实现。
  【架构位置】     测试
  【主要导出】     Playwright Vue M7 scenarios
  【依赖关系】     frontend shared mock API；Vue product routes and DOM
  【边界与注意】   Vue 使用自身 DOM 与门禁，不依赖 React 组件结构。
*/

import { expect, test } from "@playwright/test";

import {
  handleRunStream,
  mockLangGraphAPI,
  MOCK_RUN_ID,
  MOCK_THREAD_ID,
} from "./utils/mock-api";

const MOCK_AGENTS = [
  {
    name: "test-agent",
    description: "A test agent for E2E tests",
    system_prompt: "You are a test agent.",
    model: "reasoning",
    tool_groups: ["browser", "file:read", "browser"],
    skills: ["review", "review", "long-skill-name"],
    model_settings: { temperature: 0, max_tokens: 200000 },
    thinking_enabled: false,
    reasoning_effort: "high",
  },
  {
    name: "second-agent",
    description: "Another test agent for E2E tests",
    system_prompt: "You are another test agent.",
    model: null,
    tool_groups: [],
    skills: [],
  },
];

const MOCK_MODELS = [
  {
    id: "basic",
    name: "basic",
    model: "provider/basic",
    display_name: "Basic",
    supports_thinking: false,
    supports_reasoning_effort: false,
  },
  {
    id: "reasoning",
    name: "reasoning",
    model: "provider/reasoning",
    display_name: "Reasoning",
    supports_thinking: true,
    supports_reasoning_effort: true,
  },
];

function setupAgentStream(
  route: Parameters<typeof handleRunStream>[0],
  status: "success" | "error",
) {
  const messages = [
    {
      type: "ai",
      id: `setup-call-message-${status}`,
      content: "",
      tool_calls: [
        {
          id: `setup-call-${status}`,
          name: "setup_agent",
          args: { soul: "# Reviewer", description: "Reviews code" },
        },
      ],
    },
    {
      type: "tool",
      id: `setup-result-${status}`,
      content:
        status === "success"
          ? "Agent 'reviewer' created successfully!"
          : "Error: storage permission denied",
      tool_call_id: `setup-call-${status}`,
      status,
    },
    {
      type: "ai",
      id: `setup-prose-${status}`,
      content:
        status === "success"
          ? "The first version is ready."
          : "Agent created successfully!",
    },
  ];
  return handleRunStream(route, { messages }, messages);
}

test.describe("Agent chat", () => {
  test("generates enabled follow-up suggestions after the completed stream", async ({
    page,
  }) => {
    mockLangGraphAPI(page);
    let suggestionRequest:
      { messages?: unknown[]; n?: number; model_name?: string } | undefined;
    await page.route("**/api/suggestions/config", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ enabled: true, max_suggestions: 3 }),
      }),
    );
    await page.route("**/api/threads/*/suggestions", (route) => {
      suggestionRequest = route
        .request()
        .postDataJSON() as typeof suggestionRequest;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          suggestions: [
            "Check tomorrow's forecast",
            "Compare nearby cities",
            "Show the hourly weather",
          ],
        }),
      });
    });
    await page.route("**/api/langgraph/threads/*/runs/stream", (route) =>
      handleRunStream(route),
    );

    await page.goto("/workspace/chats/new");
    const textarea = page.getByPlaceholder(/how can i assist you/i);
    await textarea.fill("Today's weather");
    await textarea.press("Enter");

    await expect(page.getByText("Hello from DeerFlow!")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Check tomorrow's forecast" }),
    ).toBeVisible();
    expect(suggestionRequest).toMatchObject({ n: 3 });
    expect(suggestionRequest?.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: "user", content: "Today's weather" }),
        expect.objectContaining({ role: "assistant" }),
      ]),
    );
  });

  /*
    agent 会话页的欢迎区念的是 agent 自己，不是通用问候语。

    上游把两者分成两个组件：`/workspace/chats/*` 用 `Welcome`（👋 + DeerFlow 介绍），
    `/workspace/agents/{name}/chats/*` 用 `AgentWelcome`（agent 名 + 描述）。
    本仓一个 `AgentChat` 服务两条路由，此前只渲染通用那一支——打开一个自定义 agent
    的新会话，屏幕上完全看不出这是哪个 agent。所以这条同时断言
    「该出现的出现了」和「不该出现的没出现」：只断言前者的话，两句都显示也算绿。
  */
  test("an agent thread greets with the agent, not the generic welcome", async ({
    page,
  }) => {
    mockLangGraphAPI(page, { agents: MOCK_AGENTS });
    await page.goto("/workspace/agents/test-agent/chats/new");

    // 页头面包屑上也写着 agent 名，所以要锚在欢迎区本身；用 testid 而不是
    // class，本仓的 e2e 不钉 class。
    const welcome = page.getByTestId("agent-welcome");
    await expect(welcome).toBeVisible({ timeout: 15_000 });
    await expect(
      welcome.getByText("test-agent", { exact: true }),
    ).toBeVisible();
    await expect(welcome.getByText("A test agent for E2E tests")).toBeVisible();
    await expect(page.getByText("Hello, again!")).toHaveCount(0);
  });

  test("agent gallery page loads and shows agents", async ({ page }) => {
    mockLangGraphAPI(page, { agents: MOCK_AGENTS });

    await page.goto("/workspace/agents");

    // The agent card should appear with the agent name
    await expect(page.getByText("test-agent")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("agent gallery preserves exact model, duplicate skills, and tool-group order", async ({
    page,
  }) => {
    mockLangGraphAPI(page, { agents: MOCK_AGENTS });
    await page.goto("/workspace/agents");

    const card = page.getByTestId("agent-card-test-agent");
    await expect(card.getByTestId("agent-model")).toHaveText("reasoning");
    await expect(card.getByTestId("agent-tool-group")).toHaveText([
      "browser",
      "file:read",
      "browser",
    ]);
    await expect(card.getByTestId("agent-skill")).toHaveText([
      "review",
      "review",
      "long-skill-name",
    ]);
    await expect(
      page
        .getByTestId("agent-card-second-agent")
        .getByTestId("agent-tool-groups-none"),
    ).toHaveText("No configured tool groups");
  });

  test("settings use real capabilities, send exact PUT, and re-read the list", async ({
    page,
  }) => {
    let mutableAgents = structuredClone(MOCK_AGENTS);
    let putBody: Record<string, unknown> | undefined;
    let listReads = 0;
    const agentRequests: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.pathname.startsWith("/api/agents")) {
        agentRequests.push(`${request.method()} ${url.pathname}`);
      }
    });
    mockLangGraphAPI(page, { agents: mutableAgents });
    await page.route("**/api/models", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          models: MOCK_MODELS,
          token_usage: { enabled: false },
        }),
      }),
    );
    await page.route("**/api/agents", (route) => {
      if (route.request().method() === "GET") {
        listReads += 1;
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ agents: mutableAgents }),
        });
      }
      return route.fallback();
    });
    await page.route(/\/api\/agents\/test-agent$/, (route) => {
      if (route.request().method() !== "PUT") return route.fallback();
      putBody = route.request().postDataJSON() as Record<string, unknown>;
      mutableAgents = mutableAgents.map((item) =>
        item.name === "test-agent"
          ? {
              ...item,
              model: "basic",
              model_settings: {
                temperature: 0,
                max_tokens: 200000,
              },
              thinking_enabled: null,
              reasoning_effort: null,
            }
          : item,
      );
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mutableAgents[0]),
      });
    });

    await page.goto("/workspace/agents");
    await page
      .getByRole("button", { name: "Model settings: test-agent" })
      .click();
    // 模型选择器从原生 <select> 换成了 ui/select：触发器是 combobox，
    // 选项是 portal 出去的 option。
    await page.getByTestId("agent-settings-model").click();
    await page.locator('[data-slot="select-item"][data-value="basic"]').click();
    await expect(page.getByTestId("agent-settings-thinking")).toHaveCount(0);
    await expect(page.getByTestId("agent-settings-reasoning")).toHaveCount(0);
    await page.getByTestId("agent-settings-temperature").fill("0");
    await page.getByTestId("agent-settings-max-tokens").fill("200000");
    await page.getByRole("button", { name: "Save", exact: true }).click();

    await expect
      .poll(() => ({ putBody, agentRequests }))
      .toEqual({
        putBody: {
          model: "basic",
          model_settings: { temperature: 0, max_tokens: 200000 },
          thinking_enabled: null,
          reasoning_effort: null,
          /*
            #4887 的 subagent 访问绑定：`null` = 不限制（上游的
            `allowedSubagentsFromMode("all")` 也是 null）。这一整条 PUT 是
            **逐字比**的，所以新字段必须写进来——只对上「有没有发出去」等于
            让「多发了什么」永远看不见。
          */
          allowed_subagents: null,
        },
        agentRequests: expect.arrayContaining([
          "GET /api/agents",
          "PUT /api/agents/test-agent",
        ]),
      });
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page.getByTestId("agent-card-test-agent").getByTestId("agent-model"),
    ).toHaveText("basic");
    expect(listReads).toBeGreaterThanOrEqual(2);
  });

  test("settings failure stays visible and does not submit twice", async ({
    page,
  }) => {
    let puts = 0;
    mockLangGraphAPI(page, { agents: MOCK_AGENTS });
    await page.route("**/api/models", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          models: MOCK_MODELS,
          token_usage: { enabled: false },
        }),
      }),
    );
    await page.route(/\/api\/agents\/test-agent$/, (route) => {
      if (route.request().method() !== "PUT") return route.fallback();
      puts += 1;
      return route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Unknown model 'retired'" }),
      });
    });

    await page.goto("/workspace/agents");
    await page
      .getByRole("button", { name: "Model settings: test-agent" })
      .click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(
      page.getByRole("alert").filter({ hasText: "Unknown model" }),
    ).toBeVisible();
    expect(puts).toBe(1);
  });

  test("model discovery failure is visible with no retry storm", async ({
    page,
  }) => {
    let modelReads = 0;
    mockLangGraphAPI(page, { agents: MOCK_AGENTS });
    await page.route("**/api/models", (route) => {
      modelReads += 1;
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ detail: "model catalog unavailable" }),
      });
    });

    await page.goto("/workspace/agents");
    await page
      .getByRole("button", { name: "Model settings: test-agent" })
      .click();
    await expect(
      page.getByRole("alert").filter({ hasText: "model catalog unavailable" }),
    ).toBeVisible();
    await page.waitForTimeout(300);
    expect(modelReads).toBe(1);
  });

  test("creation requires a successful setup_agent ToolMessage, hides save input, and deduplicates save", async ({
    page,
  }) => {
    let hiddenRuns = 0;
    let created = false;
    let lastInput: unknown[] = [];
    mockLangGraphAPI(page, { agents: [] });
    await page.route("**/api/agents/check?*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ available: true, name: "reviewer" }),
      }),
    );
    await page.route("**/api/agents/reviewer", (route) =>
      route.fulfill({
        status: created ? 200 : 404,
        contentType: "application/json",
        body: JSON.stringify(
          created
            ? {
                name: "reviewer",
                description: "Reviews code",
                model: "reasoning",
                tool_groups: ["browser"],
                skills: ["review"],
              }
            : { detail: "Agent not found" },
        ),
      }),
    );
    await page.route("**/api/agents", (route) =>
      route.request().method() === "GET"
        ? route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              agents: created
                ? [
                    {
                      name: "reviewer",
                      description: "Reviews code",
                      model: "reasoning",
                      tool_groups: ["browser"],
                      skills: ["review"],
                    },
                  ]
                : [],
            }),
          })
        : route.fallback(),
    );
    await page.route("**/api/langgraph/threads/*/runs/stream", (route) => {
      const body = route.request().postDataJSON() as {
        input?: {
          messages?: Array<{ additional_kwargs?: { hide_from_ui?: boolean } }>;
        };
      };
      lastInput = body.input?.messages ?? [];
      const hidden = body.input?.messages?.some(
        (message) => message.additional_kwargs?.hide_from_ui === true,
      );
      if (!hidden) return handleRunStream(route);
      hiddenRuns += 1;
      created = true;
      return setupAgentStream(route, "success");
    });

    await page.goto("/workspace/agents/new");
    /*
      按 placeholder 定位，不按可访问名：这一屏的输入框**没有 aria-label**，
      名字来自 placeholder，与上游那颗 `<Input>` 一致（wave 28 去掉了本仓自己加的
      aria-label）。此前这里写的是 getByLabel("Name your new Agent")。
    */
    await page.getByPlaceholder("e.g. code-reviewer").fill("reviewer");
    await page.getByRole("button", { name: "Continue" }).click();
    /*
      保存走页头右上角的 ⋯ 菜单（wave 78 起，同上游 agents/new/page.tsx:309）：
      菜单项只有菜单展开时才在 DOM 里，所以要先点开触发器。
    */
    await page.getByTestId("agent-more").click();
    const save = page.getByTestId("agent-save");
    await expect(save).toBeEnabled({ timeout: 15_000 });
    await save.evaluate((element) => {
      element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await expect(page.getByTestId("agent-created")).toBeVisible({
      timeout: 15_000,
    });
    expect(hiddenRuns).toBe(1);
    expect(lastInput).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          additional_kwargs: expect.objectContaining({ hide_from_ui: true }),
        }),
      ]),
    );
    await expect(
      page.getByText(/Please save this custom agent now based on everything/),
    ).toHaveCount(0);
  });

  test("assistant success prose cannot mask a setup_agent error and explicit retry creates one new run", async ({
    page,
  }) => {
    let hiddenRuns = 0;
    let created = false;
    mockLangGraphAPI(page, { agents: [] });
    await page.route("**/api/agents/check?*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ available: true, name: "reviewer" }),
      }),
    );
    await page.route("**/api/agents/reviewer", (route) =>
      route.fulfill({
        status: created ? 200 : 404,
        contentType: "application/json",
        body: JSON.stringify(
          created
            ? {
                name: "reviewer",
                description: "Reviews code",
                model: null,
                tool_groups: null,
                skills: null,
              }
            : { detail: "Agent not found" },
        ),
      }),
    );
    await page.route("**/api/langgraph/threads/*/runs/stream", (route) => {
      const body = route.request().postDataJSON() as {
        input?: {
          messages?: Array<{ additional_kwargs?: { hide_from_ui?: boolean } }>;
        };
      };
      const hidden = body.input?.messages?.some(
        (message) => message.additional_kwargs?.hide_from_ui === true,
      );
      if (!hidden) return handleRunStream(route);
      hiddenRuns += 1;
      if (hiddenRuns === 1) return setupAgentStream(route, "error");
      created = true;
      return setupAgentStream(route, "success");
    });

    await page.goto("/workspace/agents/new");
    await page.getByPlaceholder("e.g. code-reviewer").fill("reviewer");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByTestId("agent-more").click();
    await page.getByTestId("agent-save").click();
    await expect(page.getByTestId("agent-creation-error")).toContainText(
      "storage permission denied",
    );
    await expect(page.getByTestId("agent-created")).toHaveCount(0);

    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByTestId("agent-created")).toBeVisible();
    expect(hiddenRuns).toBe(2);
  });

  test("agent chat page loads with input box and AI disclaimer", async ({
    page,
  }) => {
    mockLangGraphAPI(page, { agents: MOCK_AGENTS });

    await page.goto("/workspace/agents/test-agent/chats/new");

    // The prompt input textarea should be visible
    const textarea = page.getByPlaceholder(/how can i assist you/i);
    await expect(textarea).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByText("DeerFlow is AI and can make mistakes", { exact: true }),
    ).toBeVisible();
  });

  test("keeps new-chat drafts isolated between agents", async ({ page }) => {
    mockLangGraphAPI(page, { agents: MOCK_AGENTS });

    await page.goto("/workspace/agents/test-agent/chats/new");
    const firstAgentInput = page.getByPlaceholder(/how can i assist you/i);
    await expect(firstAgentInput).toBeVisible({ timeout: 15_000 });
    await firstAgentInput.fill("Draft for the first agent");

    await page.goto("/workspace/agents/second-agent/chats/new");
    const secondAgentInput = page.getByPlaceholder(/how can i assist you/i);
    await expect(secondAgentInput).toHaveValue("");
    await secondAgentInput.fill("Draft for the second agent");

    await page.goto("/workspace/agents/test-agent/chats/new");
    await expect(page.getByPlaceholder(/how can i assist you/i)).toHaveValue(
      "Draft for the first agent",
    );
  });

  test("agent chat page shows agent badge", async ({ page }) => {
    mockLangGraphAPI(page, { agents: MOCK_AGENTS });

    await page.goto("/workspace/agents/test-agent/chats/new");

    // The agent badge should display in the header (scoped to header to avoid
    // matching the welcome area which also shows the agent name)
    await expect(
      page.locator("header span", { hasText: "test-agent" }),
    ).toBeVisible({ timeout: 15_000 });
  });

  for (const {
    name,
    toolGroups,
    browserControlEnabled,
    expectedVisible,
    mock,
  } of [
    {
      name: "shows Browser Live for an explicit browser tool group",
      toolGroups: ["browser"],
      browserControlEnabled: true,
      expectedVisible: true,
    },
    {
      name: "shows Browser Live when tool groups are unrestricted",
      toolGroups: null,
      browserControlEnabled: true,
      expectedVisible: true,
    },
    {
      name: "hides Browser Live without the browser tool group",
      toolGroups: ["web"],
      browserControlEnabled: true,
      expectedVisible: false,
    },
    {
      name: "hides Browser Live when browser control is unavailable",
      toolGroups: ["browser"],
      browserControlEnabled: false,
      expectedVisible: false,
    },
    {
      name: "hides Browser Live in mock custom-agent chats",
      toolGroups: ["browser"],
      browserControlEnabled: true,
      expectedVisible: false,
      mock: true,
    },
  ]) {
    test(name, async ({ page }) => {
      const agent = {
        name: "browser-agent",
        description: "A custom agent for Browser Live tests",
        tool_groups: toolGroups,
      };
      mockLangGraphAPI(page, {
        agents: [agent],
        features: { browserControlEnabled },
        threads: [
          {
            thread_id: MOCK_THREAD_ID,
            title: "Browser agent conversation",
            agent_name: agent.name,
            messages: [
              {
                type: "ai",
                id: "msg-ai-browser-agent",
                content: "Ready to browse",
              },
            ],
          },
        ],
      });

      const featuresLoaded = mock
        ? null
        : page.waitForResponse(
            (response) =>
              new URL(response.url()).pathname === "/api/features" &&
              response.status() === 200,
          );
      await page.goto(
        `/workspace/agents/${agent.name}/chats/${MOCK_THREAD_ID}${mock ? "?mock=true" : ""}`,
      );
      if (featuresLoaded) await featuresLoaded;
      if (mock) {
        await expect(
          page.locator("header span", { hasText: agent.name }),
        ).toBeVisible();
      } else {
        await expect(page.getByText("Ready to browse")).toBeVisible();
      }

      const browserTrigger = page.getByTestId("browser-trigger");
      if (expectedVisible) {
        await expect(browserTrigger).toBeVisible();
        await expect(
          page.getByRole("button", { name: "New chat", exact: true }),
        ).toBeVisible();
        const chatHeader = page.locator("#chat > header");
        await expect(
          chatHeader.getByRole("link", { name: "Scheduled tasks" }),
        ).toHaveCount(0);
        await browserTrigger.click();
        await expect(
          page.getByPlaceholder("Enter a URL and press Enter"),
        ).toBeVisible();
        // 打开态的名字是 `common.close`（"Close"），与上游
        // `browser-trigger.tsx` 的 `t.common.close` 同键。这里曾经是
        // `browser.close`（"Close browser"）——同一颗按钮两个应用念出不同的话。
        await expect(browserTrigger).toHaveAttribute("aria-label", "Close");
        await browserTrigger.click();
        await expect(page.getByTestId("browser-panel")).toHaveCount(0);
        await expect(browserTrigger).toHaveAttribute(
          "aria-label",
          "Open browser panel",
        );
      } else {
        await expect(browserTrigger).toHaveCount(0);
      }
    });
  }

  test("hides Browser Live before a custom-agent thread is created", async ({
    page,
  }) => {
    mockLangGraphAPI(page, {
      agents: [
        {
          name: "browser-agent",
          description: "A custom agent for Browser Live tests",
          tool_groups: ["browser"],
        },
      ],
      features: { browserControlEnabled: true },
    });

    await page.goto("/workspace/agents/browser-agent/chats/new");
    await expect(page.getByPlaceholder(/how can i assist you/i)).toBeVisible();
    await expect(page.getByTestId("browser-trigger")).toHaveCount(0);
  });

  test("agent chat can regenerate its latest response", async ({ page }) => {
    const humanMessage = {
      type: "human",
      id: "msg-human-agent",
      content: [{ type: "text", text: "Original agent question" }],
    };
    const aiMessage = {
      type: "ai",
      id: "msg-ai-agent",
      content: "Custom agent response",
    };
    mockLangGraphAPI(page, {
      agents: MOCK_AGENTS,
      threads: [
        {
          thread_id: MOCK_THREAD_ID,
          title: "Agent conversation",
          agent_name: "test-agent",
          messages: [humanMessage, aiMessage],
        },
      ],
    });

    let prepareMessageId: string | undefined;
    let streamBody: Record<string, unknown> | undefined;
    await page.route(
      `**/api/threads/${MOCK_THREAD_ID}/runs/regenerate/prepare`,
      (route) => {
        prepareMessageId = (
          route.request().postDataJSON() as { message_id?: string }
        ).message_id;
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            input: { messages: [humanMessage] },
            checkpoint: {
              checkpoint_id: "checkpoint-before-human",
              checkpoint_ns: "",
              checkpoint_map: null,
            },
            metadata: {
              regenerate_from_message_id: aiMessage.id,
              regenerate_from_run_id: `run-${MOCK_THREAD_ID}`,
              regenerate_checkpoint_id: "checkpoint-before-human",
            },
            target_run_id: `run-${MOCK_THREAD_ID}`,
          }),
        });
      },
    );
    await page.route(
      `**/api/langgraph/threads/${MOCK_THREAD_ID}/runs/stream`,
      (route) => {
        streamBody = route.request().postDataJSON() as Record<string, unknown>;
        return handleRunStream(route);
      },
    );

    await page.goto(`/workspace/agents/test-agent/chats/${MOCK_THREAD_ID}`);
    await expect(page.getByText(aiMessage.content)).toBeVisible({
      timeout: 15_000,
    });

    await page.evaluate((selectedText) => {
      const element = Array.from(document.querySelectorAll("p")).find(
        (candidate) => candidate.textContent?.includes(selectedText),
      );
      const textNode = element?.firstChild;
      if (!element || !textNode) {
        throw new Error("Unable to find the custom agent response");
      }
      const range = document.createRange();
      range.selectNodeContents(textNode);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    }, aiMessage.content);
    await expect(
      page.getByRole("button", { name: "Ask in side chat" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");

    const assistantTurn = page.locator("[data-assistant-turn]").last();
    await assistantTurn.hover();
    await page.getByRole("button", { name: "Regenerate" }).click();

    await expect.poll(() => prepareMessageId).toBe(aiMessage.id);
    await expect.poll(() => streamBody).toBeDefined();
    expect(streamBody).toMatchObject({
      checkpoint: {
        checkpoint_id: "checkpoint-before-human",
        checkpoint_ns: "",
        checkpoint_map: null,
      },
      metadata: {
        regenerate_from_message_id: aiMessage.id,
        regenerate_from_run_id: `run-${MOCK_THREAD_ID}`,
        regenerate_checkpoint_id: "checkpoint-before-human",
      },
      context: {
        agent_name: "test-agent",
        thread_id: MOCK_THREAD_ID,
      },
    });
  });

  test("agent chat can edit and rerun its latest user message", async ({
    page,
  }) => {
    const humanMessage = {
      type: "human",
      id: "msg-human-agent",
      content: [{ type: "text", text: "Original agent question" }],
    };
    const replacementHumanMessage = {
      type: "human",
      id: "msg-human-agent-edited",
      content: [{ type: "text", text: "Edited agent question" }],
    };
    const aiMessage = {
      type: "ai",
      id: "msg-ai-agent",
      content: "Custom agent response",
    };
    /*
      两份服务端状态要一起推进：`/messages/page`（事件库）与 `/history`
      （checkpoint）。edit-regenerate 跑完之后后端两边写的都是**替换后**的消息，
      而 run 结束时前端会重取 checkpoint（`useThreadStream` 的 `onSettled`，
      与上游 SDK 在 `onSuccess` 里 `history.mutate` 后采纳 `lastHead` 同形）。
      只推进 historyRows 的话，这一屏会在 run 结束的瞬间被旧 checkpoint 拉回去。
    */
    const agentThread = {
      thread_id: MOCK_THREAD_ID,
      title: "Agent conversation",
      agent_name: "test-agent",
      messages: [humanMessage, aiMessage] as Record<string, unknown>[],
    };
    mockLangGraphAPI(page, {
      agents: MOCK_AGENTS,
      threads: [agentThread],
    });
    let historyRows = [
      { run_id: `run-${MOCK_THREAD_ID}`, content: humanMessage },
      { run_id: `run-${MOCK_THREAD_ID}`, content: aiMessage },
    ];
    await page.route(
      `**/api/threads/${MOCK_THREAD_ID}/messages/page`,
      (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: historyRows.map((row, index) => ({
              run_id: row.run_id,
              seq: index + 1,
              content: row.content,
              metadata: { caller: "lead_agent" },
              created_at: `2025-01-01T00:00:${String(index).padStart(2, "0")}Z`,
            })),
            has_more: false,
            next_before_seq: null,
          }),
        }),
    );

    let prepareBody:
      { human_message_id?: string; replacement_text?: string } | undefined;
    let streamBody: Record<string, unknown> | undefined;
    await page.route(
      `**/api/threads/${MOCK_THREAD_ID}/runs/edit-regenerate/prepare`,
      (route) => {
        prepareBody = route.request().postDataJSON() as {
          human_message_id?: string;
          replacement_text?: string;
        };
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            input: { messages: [replacementHumanMessage] },
            checkpoint: {
              checkpoint_id: "checkpoint-before-human",
              checkpoint_ns: "",
              checkpoint_map: null,
            },
            metadata: {
              replay_kind: "edit",
              regenerate_from_message_id: aiMessage.id,
              regenerate_from_run_id: `run-${MOCK_THREAD_ID}`,
              regenerate_checkpoint_id: "checkpoint-before-human",
              edit_from_message_id: humanMessage.id,
              edit_message_id: replacementHumanMessage.id,
              edit_version_group_id: humanMessage.id,
            },
            target_run_id: `run-${MOCK_THREAD_ID}`,
            replacement_human_message_id: replacementHumanMessage.id,
            source_message_ids: [humanMessage.id, aiMessage.id],
          }),
        });
      },
    );
    await page.route(
      `**/api/langgraph/threads/${MOCK_THREAD_ID}/runs/stream`,
      (route) => {
        streamBody = route.request().postDataJSON() as Record<string, unknown>;
        const aiReply = {
          type: "ai",
          id: "msg-ai-1",
          content: "Hello from DeerFlow!",
        };
        agentThread.messages = [replacementHumanMessage, aiReply];
        historyRows = [
          { run_id: MOCK_RUN_ID, content: replacementHumanMessage },
          {
            run_id: MOCK_RUN_ID,
            content: {
              type: "ai",
              id: "msg-ai-1",
              content: "Hello from DeerFlow!",
            },
          },
        ];
        return handleRunStream(route);
      },
    );

    await page.goto(`/workspace/agents/test-agent/chats/${MOCK_THREAD_ID}`);
    await expect(page.getByText("Original agent question")).toBeVisible({
      timeout: 15_000,
    });

    const humanTurn = page.getByText("Original agent question");
    await humanTurn.hover();
    await page.getByRole("button", { name: "Edit and rerun" }).click();

    const editor = page.locator("textarea").first();
    await expect(editor).toHaveValue("Original agent question");
    await editor.fill("Edited agent question");
    await page.getByRole("button", { name: "Update and rerun" }).click();

    await expect
      .poll(() => prepareBody)
      .toEqual({
        human_message_id: humanMessage.id,
        replacement_text: "Edited agent question",
      });
    await expect.poll(() => streamBody).toBeDefined();
    expect(streamBody).toMatchObject({
      input: { messages: [replacementHumanMessage] },
      checkpoint: {
        checkpoint_id: "checkpoint-before-human",
        checkpoint_ns: "",
        checkpoint_map: null,
      },
      metadata: {
        replay_kind: "edit",
        regenerate_from_message_id: aiMessage.id,
        regenerate_from_run_id: `run-${MOCK_THREAD_ID}`,
        regenerate_checkpoint_id: "checkpoint-before-human",
        edit_from_message_id: humanMessage.id,
        edit_message_id: replacementHumanMessage.id,
        edit_version_group_id: humanMessage.id,
      },
      context: {
        agent_name: "test-agent",
        thread_id: MOCK_THREAD_ID,
      },
    });
    await expect(page.getByText("Edited agent question")).toBeVisible();
    await expect(page.getByText("Original agent question")).not.toBeVisible();
    await expect(page.getByText("Hello from DeerFlow!")).toBeVisible();
  });
});
