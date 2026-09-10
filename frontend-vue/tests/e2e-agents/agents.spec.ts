/*
  【文件职责】     以真实 Auth/FastAPI/SQLite/LangGraph/setup_agent/Nuxt/Chromium 验证Agent lifecycle。
  【架构位置】     real-backend acceptance
  【主要导出】     Playwright HTTP 与 browser scenarios
  【依赖关系】     run_replay_gateway.py · agent_e2e_fixture.py · Vue Agent UI
  【边界与注意】   LLM 受控；ToolMessage、router、store、用户隔离、Auth/CSRF 与 UI 均为真实实现。
*/

import {
  expect,
  test,
  type APIRequestContext,
  type BrowserContext,
  type Page,
} from "@playwright/test";

const APP = process.env.E2E_APP_URL ?? "http://localhost:3112";
const PASSWORD = "very-strong-password-123";
const AGENT_NAME = "wp09-reviewer";

/**
 * 打开一个 ui/select 并按 value 选中某一项。
 *
 * Reka 的 combobox trigger 靠 pointerdown 打开、选项 portal 到 body，所以既不能
 * 再用 selectOption，也不该按可见文案匹配——文案会被翻译，value 不会。
 */
async function chooseSelectOption(
  page: Page,
  testId: string,
  value: string,
): Promise<void> {
  await page.getByTestId(testId).click();
  await page
    .locator(`[data-slot="select-item"][data-value="${value}"]`)
    .click();
}

async function initializeAdmin(request: APIRequestContext) {
  const response = await request.post(`${APP}/api/v1/auth/initialize`, {
    data: {
      email: `e2e-wp09-admin-${Date.now()}@example.com`,
      password: PASSWORD,
    },
  });
  expect(response.status(), await response.text()).toBe(201);
}

async function registerUser(request: APIRequestContext) {
  const response = await request.post(`${APP}/api/v1/auth/register`, {
    data: {
      email: `e2e-wp09-user-${Date.now()}@example.com`,
      password: PASSWORD,
    },
  });
  expect(response.status(), await response.text()).toBe(201);
}

async function csrfHeaders(request: APIRequestContext) {
  const storage = await request.storageState();
  const csrf = storage.cookies.find(({ name }) => name === "csrf_token")?.value;
  expect(csrf).toBeTruthy();
  return { "X-CSRF-Token": csrf ?? "" };
}

async function setEnabled(context: BrowserContext, enabled: boolean) {
  const response = await context.request.post(
    `${APP}/api/test-only/agents/set-enabled`,
    { headers: await csrfHeaders(context.request), data: { enabled } },
  );
  expect(response.status(), await response.text()).toBe(200);
  await expect
    .poll(async () => {
      const features = await context.request.get(`${APP}/api/features`);
      return (await features.json()) as { agents_api: { enabled: boolean } };
    })
    .toMatchObject({ agents_api: { enabled } });
}

test.describe.serial("real Gateway Agent lifecycle", () => {
  test("unauthenticated API and workspace navigation use the real shared login boundary", async ({
    page,
    request,
  }) => {
    const agents = await request.get(`${APP}/api/agents`);
    expect(agents.status()).toBe(401);
    expect(await agents.json()).toEqual({
      detail: { code: "not_authenticated", message: "Authentication required" },
    });
    const models = await request.get(`${APP}/api/models`);
    expect(models.status()).toBe(401);

    await page.goto("/workspace/agents");
    await expect(page).toHaveURL(/\/login\?redirect=\/workspace\/agents/);
  });

  test("admin creates through the real setup_agent tool, persists exact settings, and sees truthful errors", async ({
    context,
    page,
  }) => {
    await initializeAdmin(context.request);
    const headers = await csrfHeaders(context.request);

    const modelsResponse = await context.request.get(`${APP}/api/models`);
    expect(modelsResponse.status(), await modelsResponse.text()).toBe(200);
    const modelNames = (
      (await modelsResponse.json()) as {
        models: Array<{
          name: string;
          supports_thinking: boolean;
          supports_reasoning_effort: boolean;
        }>;
      }
    ).models.map((model) => ({
      name: model.name,
      thinking: model.supports_thinking,
      reasoning: model.supports_reasoning_effort,
    }));
    expect(modelNames).toEqual([
      { name: "basic-model", thinking: false, reasoning: false },
      { name: "reasoning-model", thinking: true, reasoning: true },
    ]);

    const check = await context.request.get(
      `${APP}/api/agents/check?name=${AGENT_NAME}`,
    );
    expect(check.status(), await check.text()).toBe(200);
    expect(await check.json()).toEqual({ available: true, name: AGENT_NAME });

    const runBodies: Array<Record<string, unknown>> = [];
    page.on("request", (request) => {
      if (
        request.method() === "POST" &&
        /\/api\/langgraph\/threads\/[^/]+\/runs\/stream$/.test(
          new URL(request.url()).pathname,
        )
      ) {
        runBodies.push(request.postDataJSON() as Record<string, unknown>);
      }
    });

    await page.goto("/workspace/agents/new");
    await page.getByPlaceholder("e.g. code-reviewer").fill(AGENT_NAME);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(
      page.getByText(
        "Let's design the agent's purpose and review style before saving.",
      ),
    ).toBeVisible({ timeout: 30_000 });
    /*
      上游 agents/new/page.tsx 在 agent 还没建出来这一步用的是裸 `PromptInput`
      （textarea + submit，没有附件/语音/润色/模式/模型选择器）——不是页面其余部分
      共用的那个完整 ChatComposer。这几行钉住的正是这一点：AgentBootstrapComposer
      装上之后，只有它自己的 textarea/submit，ChatComposer 那一整排控件必须一个都
      不在。之前这里从没断言过，因为 ChatComposer 的完整控件集悄悄冒出来也不会让
      任何既有用例变红——它只是多余，不是错误。
    */
    await expect(
      page.getByTestId("agent-bootstrap-composer-textarea"),
    ).toBeVisible();
    await expect(
      page.getByTestId("agent-bootstrap-composer-submit"),
    ).toBeVisible();
    await expect(page.getByTestId("add-attachments-button")).toHaveCount(0);
    await expect(page.getByTestId("voice-input-button")).toHaveCount(0);
    await expect(page.getByTestId("polish-input-button")).toHaveCount(0);
    await expect(page.getByTestId("composer-mode-trigger")).toHaveCount(0);
    await expect(page.getByTestId("composer-model-selector")).toHaveCount(0);
    /*
      保存走页头右上角的 ⋯ 菜单（wave 78 起，同上游 agents/new/page.tsx:309）：
      菜单项只有菜单展开时才在 DOM 里，所以要先点开触发器。
    */
    await page.getByTestId("agent-more").click();
    const save = page.getByTestId("agent-save");
    await expect(save).toBeEnabled();
    await save.evaluate((element) => {
      element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await expect(page.getByTestId("agent-created")).toBeVisible({
      timeout: 30_000,
    });

    const hiddenRuns = runBodies.filter((body) =>
      (
        (body.input as { messages?: Array<{ additional_kwargs?: unknown }> })
          ?.messages ?? []
      ).some(
        (message) =>
          (message.additional_kwargs as { hide_from_ui?: boolean } | undefined)
            ?.hide_from_ui === true,
      ),
    );
    expect(runBodies).toHaveLength(2);
    expect(hiddenRuns).toHaveLength(1);
    await expect(
      page.getByText(/Please save this custom agent now based on everything/),
    ).toHaveCount(0);

    const createdResponse = await context.request.get(
      `${APP}/api/agents/${AGENT_NAME}`,
    );
    expect(createdResponse.status(), await createdResponse.text()).toBe(200);
    expect(await createdResponse.json()).toMatchObject({
      name: AGENT_NAME,
      description: "Reviews code and explains actionable findings",
      model: null,
      tool_groups: null,
      skills: ["review", "review"],
    });

    const duplicate = await context.request.post(`${APP}/api/agents`, {
      headers,
      data: {
        name: AGENT_NAME,
        description: "duplicate",
        soul: "# Duplicate",
      },
    });
    expect(duplicate.status()).toBe(409);
    const invalid = await context.request.post(`${APP}/api/agents`, {
      headers,
      data: { name: "invalid name", soul: "# Invalid" },
    });
    expect(invalid.status()).toBe(422);
    const unknownModel = await context.request.put(
      `${APP}/api/agents/${AGENT_NAME}`,
      { headers, data: { model: "missing-model" } },
    );
    expect(unknownModel.status()).toBe(422);
    expect(await unknownModel.json()).toEqual({
      detail:
        "Unknown model 'missing-model'. Use a model name defined under `models:` in config.yaml.",
    });
    const missing = await context.request.get(`${APP}/api/agents/not-found`);
    expect(missing.status()).toBe(404);

    await page.getByRole("link", { name: "Back to Gallery" }).click();
    const card = page.getByTestId(`agent-card-${AGENT_NAME}`);
    await expect(card.getByTestId("agent-tool-groups-all")).toHaveText(
      "All configured tool groups",
    );
    await expect(card.getByTestId("agent-skill")).toHaveText([
      "review",
      "review",
    ]);
    await card
      .getByRole("button", { name: `Model settings: ${AGENT_NAME}` })
      .click();
    // 三个下拉从原生 <select> 换成了 ui/select：触发器是 combobox，选项 portal 到
    // body。按 data-value 选，而不是按可见文案——文案是会被翻译的。
    await chooseSelectOption(page, "agent-settings-model", "reasoning-model");
    await page.getByTestId("agent-settings-temperature").fill("0");
    await page.getByTestId("agent-settings-max-tokens").fill("200000");
    await chooseSelectOption(page, "agent-settings-thinking", "off");
    await chooseSelectOption(page, "agent-settings-reasoning", "high");
    const updateResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "PUT" &&
        new URL(response.url()).pathname === `/api/agents/${AGENT_NAME}`,
    );
    await page.getByRole("button", { name: "Save", exact: true }).click();
    const updatedHttp = await updateResponse;
    expect(updatedHttp.status(), await updatedHttp.text()).toBe(200);
    expect(updatedHttp.request().postDataJSON()).toEqual({
      model: "reasoning-model",
      model_settings: { temperature: 0, max_tokens: 200000 },
      thinking_enabled: false,
      reasoning_effort: "high",
      // #4887 的 subagent 访问绑定：`null` = 不限制。这条 PUT 是逐字比的，
      // 新字段必须写进来——只对上「有没有发出去」等于让「多发了什么」看不见。
      allowed_subagents: null,
    });
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(card.getByTestId("agent-model")).toHaveText("reasoning-model");

    const reread = await context.request.get(`${APP}/api/agents/${AGENT_NAME}`);
    expect(await reread.json()).toMatchObject({
      model: "reasoning-model",
      model_settings: { temperature: 0, max_tokens: 200000 },
      thinking_enabled: false,
      reasoning_effort: "high",
    });

    await setEnabled(context, false);
    const disabled = await context.request.get(`${APP}/api/agents`);
    expect(disabled.status()).toBe(403);
    expect(await disabled.json()).toEqual({
      detail:
        "Custom-agent management API is disabled. Set agents_api.enabled=true to expose agent and user-profile routes over HTTP.",
    });
    const callsAfterDisable: string[] = [];
    page.on("request", (request) => {
      if (/\/api\/agents(?:\/|$)/.test(new URL(request.url()).pathname)) {
        callsAfterDisable.push(request.url());
      }
    });
    await page.goto("/workspace/agents");
    await expect(page.getByTestId("agents-feature-disabled")).toBeVisible();
    expect(callsAfterDisable).toEqual([]);
    await setEnabled(context, true);
  });

  test("a second authenticated user has an isolated Agent namespace", async ({
    context,
  }) => {
    await registerUser(context.request);
    const headers = await csrfHeaders(context.request);
    const list = await context.request.get(`${APP}/api/agents`);
    expect(list.status(), await list.text()).toBe(200);
    expect(await list.json()).toEqual({ agents: [] });

    const sameName = await context.request.post(`${APP}/api/agents`, {
      headers,
      data: {
        name: AGENT_NAME,
        description: "Second user's reviewer",
        soul: "# Isolated reviewer",
        model: "basic-model",
        tool_groups: [],
        skills: [],
      },
    });
    expect(sameName.status(), await sameName.text()).toBe(201);
    expect(await sameName.json()).toMatchObject({
      name: AGENT_NAME,
      description: "Second user's reviewer",
      model: "basic-model",
      tool_groups: [],
      skills: [],
    });
  });
});
