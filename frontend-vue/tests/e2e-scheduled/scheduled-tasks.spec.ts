/*
  【文件职责】     以真实 FastAPI Gateway/SQLite/HTTP/Nuxt/Chromium 验证调度合同。
  【架构位置】     real-backend acceptance
  【主要导出】     Playwright HTTP 与 browser scenarios
  【依赖关系】     run_replay_gateway.py · scheduled-task Gateway routers/repos/service · Vue page
  【边界与注意】   Gateway/Auth/DB/run lifecycle 真实；agent model 是签入 replay fixture，非真实外部模型。
*/
import { readFileSync } from "node:fs";

import { expect, test, type APIRequestContext } from "@playwright/test";

const APP = process.env.E2E_APP_URL ?? "http://localhost:3110";
const replayFixture = JSON.parse(
  readFileSync(
    new URL(
      "../../../backend/tests/fixtures/replay/write_read_file.ultra.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as { prompt: string };

async function register(request: APIRequestContext, label: string) {
  const response = await request.post(`${APP}/api/v1/auth/register`, {
    data: {
      email: `e2e-wp07-${label}-${Date.now()}@example.com`,
      password: "very-strong-password-123",
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

test.beforeAll(async ({ request }) => {
  const response = await request.get(`${APP}/api/features`);
  expect(response.status(), await response.text()).toBe(200);
  expect((await response.json()).scheduled_tasks).toMatchObject({
    available: true,
    running: true,
    tool_enabled: false,
  });
});

test("real Gateway owns create/read/update/context/pause/resume/validation/delete", async ({
  context,
}) => {
  await register(context.request, "http");
  const headers = await csrfHeaders(context.request);
  const threadId = crypto.randomUUID();
  const thread = await context.request.post(`${APP}/api/threads`, {
    headers,
    data: { thread_id: threadId, metadata: {} },
  });
  expect(thread.status(), await thread.text()).toBe(200);

  const createdResponse = await context.request.post(
    `${APP}/api/scheduled-tasks`,
    {
      headers,
      data: {
        context_mode: "fresh_thread_per_run",
        title: "Real HTTP task",
        prompt: "Summarize through the real Gateway",
        schedule_type: "cron",
        schedule_spec: { cron: "0 9 * * *" },
        timezone: "UTC",
      },
    },
  );
  expect(createdResponse.status(), await createdResponse.text()).toBe(200);
  const created = (await createdResponse.json()) as {
    id: string;
    thread_id: string | null;
    status: string;
    schedule_type: string;
  };
  expect(created).toMatchObject({
    thread_id: null,
    status: "enabled",
    schedule_type: "cron",
  });

  const [listed, detail, runs] = await Promise.all([
    context.request.get(`${APP}/api/scheduled-tasks`),
    context.request.get(`${APP}/api/scheduled-tasks/${created.id}`),
    context.request.get(
      `${APP}/api/scheduled-tasks/${created.id}/runs?limit=1&offset=0`,
    ),
  ]);
  expect(listed.status(), await listed.text()).toBe(200);
  expect(detail.status(), await detail.text()).toBe(200);
  expect(runs.status(), await runs.text()).toBe(200);
  expect(await runs.json()).toEqual([]);

  const reuse = await context.request.patch(
    `${APP}/api/scheduled-tasks/${created.id}`,
    {
      headers,
      data: { context_mode: "reuse_thread", thread_id: threadId },
    },
  );
  expect(reuse.status(), await reuse.text()).toBe(200);
  expect(await reuse.json()).toMatchObject({
    context_mode: "reuse_thread",
    thread_id: threadId,
  });
  const fresh = await context.request.patch(
    `${APP}/api/scheduled-tasks/${created.id}`,
    {
      headers,
      data: { context_mode: "fresh_thread_per_run" },
    },
  );
  expect(fresh.status(), await fresh.text()).toBe(200);
  expect(await fresh.json()).toMatchObject({
    context_mode: "fresh_thread_per_run",
    thread_id: null,
  });

  const paused = await context.request.post(
    `${APP}/api/scheduled-tasks/${created.id}/pause`,
    { headers },
  );
  expect(paused.status(), await paused.text()).toBe(200);
  expect(await paused.json()).toMatchObject({ status: "paused" });
  const resumed = await context.request.post(
    `${APP}/api/scheduled-tasks/${created.id}/resume`,
    { headers },
  );
  expect(resumed.status(), await resumed.text()).toBe(200);
  expect(await resumed.json()).toMatchObject({ status: "enabled" });

  const invalidCron = await context.request.post(`${APP}/api/scheduled-tasks`, {
    headers,
    data: {
      context_mode: "fresh_thread_per_run",
      title: "Bad cron",
      prompt: "Bad cron",
      schedule_type: "cron",
      schedule_spec: { cron: "bad cron" },
      timezone: "UTC",
    },
  });
  expect(invalidCron.status()).toBe(422);
  expect(await invalidCron.json()).toMatchObject({
    detail: {
      code: "invalid_schedule",
      message: expect.stringMatching(/5 fields/i),
    },
  });
  const invalidTimezone = await context.request.post(
    `${APP}/api/scheduled-tasks`,
    {
      headers,
      data: {
        context_mode: "fresh_thread_per_run",
        title: "Bad timezone",
        prompt: "Bad timezone",
        schedule_type: "cron",
        schedule_spec: { cron: "0 9 * * *" },
        timezone: "Mars/Base",
      },
    },
  );
  expect(invalidTimezone.status()).toBe(422);
  expect(await invalidTimezone.json()).toMatchObject({
    detail: {
      code: "invalid_timezone",
      message: expect.stringMatching(/timezone/i),
    },
  });
  const missingReuse = await context.request.post(
    `${APP}/api/scheduled-tasks`,
    {
      headers,
      data: {
        context_mode: "reuse_thread",
        title: "Missing reuse",
        prompt: "Missing reuse",
        schedule_type: "cron",
        schedule_spec: { cron: "0 9 * * *" },
        timezone: "UTC",
      },
    },
  );
  expect(missingReuse.status()).toBe(422);
  expect(await missingReuse.json()).toMatchObject({
    detail: {
      code: "reuse_thread_requires_thread",
      message: "reuse_thread requires thread_id",
    },
  });
  const inaccessibleReuse = await context.request.post(
    `${APP}/api/scheduled-tasks`,
    {
      headers,
      data: {
        context_mode: "reuse_thread",
        thread_id: crypto.randomUUID(),
        title: "Unknown reuse",
        prompt: "Unknown reuse",
        schedule_type: "cron",
        schedule_spec: { cron: "0 9 * * *" },
        timezone: "UTC",
      },
    },
  );
  expect(inaccessibleReuse.status()).toBe(404);
  expect(await inaccessibleReuse.json()).toMatchObject({
    detail: { code: "thread_not_found", message: "Thread not found" },
  });
  const tooSoon = new Date(Date.now() + 20_000).toISOString();
  const invalidOnce = await context.request.post(`${APP}/api/scheduled-tasks`, {
    headers,
    data: {
      context_mode: "fresh_thread_per_run",
      title: "Too soon",
      prompt: "Too soon",
      schedule_type: "once",
      schedule_spec: { run_at: tooSoon },
      timezone: "UTC",
    },
  });
  expect(invalidOnce.status()).toBe(422);
  expect(await invalidOnce.json()).toMatchObject({
    detail: {
      code: "once_too_soon",
      message: expect.stringMatching(/at least 60 seconds/i),
    },
  });

  const runAt = new Date(Date.now() + 120_000).toISOString();
  const validOnceResponse = await context.request.post(
    `${APP}/api/scheduled-tasks`,
    {
      headers,
      data: {
        context_mode: "fresh_thread_per_run",
        title: "Real once task",
        prompt: "Run once through the real Gateway",
        schedule_type: "once",
        schedule_spec: { run_at: runAt },
        timezone: "Asia/Shanghai",
      },
    },
  );
  expect(validOnceResponse.status(), await validOnceResponse.text()).toBe(200);
  const validOnce = (await validOnceResponse.json()) as {
    id: string;
    schedule_type: string;
    schedule_spec: { run_at: string };
    timezone: string;
  };
  expect(validOnce).toMatchObject({
    schedule_type: "once",
    timezone: "Asia/Shanghai",
  });
  expect(Date.parse(validOnce.schedule_spec.run_at)).toBe(Date.parse(runAt));
  const onceDeleted = await context.request.delete(
    `${APP}/api/scheduled-tasks/${validOnce.id}`,
    { headers },
  );
  expect(onceDeleted.status(), await onceDeleted.text()).toBe(200);

  const deleted = await context.request.delete(
    `${APP}/api/scheduled-tasks/${created.id}`,
    { headers },
  );
  expect(deleted.status(), await deleted.text()).toBe(200);
  expect(await deleted.json()).toEqual({ id: created.id, deleted: true });
});

test("Nuxt UI shows real Gateway validation and a real manual-run lifecycle", async ({
  context,
  page,
}) => {
  await register(context.request, "browser");
  await page.goto("/workspace/scheduled-tasks");

  await page.getByTestId("scheduled-task-new").click();
  const form = page.getByRole("dialog");
  await form
    .getByRole("textbox", { name: "Title", exact: true })
    .fill("Real browser task");
  await form
    .getByRole("textbox", { name: "Instructions", exact: true })
    .fill(replayFixture.prompt);
  // Reka 的 Select 是自定义 listbox：开触发器再点选项，没有 selectOption。
  await page.getByTestId("schedule-preset").click();
  await page.getByRole("option", { name: "Custom cron", exact: true }).click();
  await page.getByTestId("scheduled-task-custom-cron").fill("bad cron");
  const invalidResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/scheduled-tasks",
  );
  await form.getByRole("button", { name: "Create", exact: true }).click();
  expect((await invalidResponse).status()).toBe(422);
  // Gateway 的 detail 走 toast，不是页面上的内联提示——与 React 的 mutation hook 一致。
  await expect(page.getByTestId("workspace-toaster")).toContainText(
    "This schedule isn't valid.",
  );
  await expect(form).toBeVisible();
  await expect(
    form.getByRole("textbox", { name: "Title", exact: true }),
  ).toHaveValue("Real browser task");
  await expect(
    form.getByRole("textbox", { name: "Instructions", exact: true }),
  ).toHaveValue(replayFixture.prompt);
  await expect(page.getByTestId("scheduled-task-custom-cron")).toHaveValue(
    "bad cron",
  );

  /*
    这里原本还提交过一次 `Mars/Base` 去看真 Gateway 的时区 422。时区控件现在是一个
    只列 `Intl.supportedValuesOf("timeZone")` 的 Select（React 就是这样），UI 上根本
    构造不出一个不认识的时区，所以那条路径已经不属于这一层——同一条 422 由上面那个
    纯 HTTP 用例覆盖。
  */
  await page.getByTestId("scheduled-task-custom-cron").fill("0 9 * * *");
  const createResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/scheduled-tasks",
  );
  await form.getByRole("button", { name: "Create", exact: true }).click();
  const createdResponse = await createResponse;
  expect(createdResponse.status(), await createdResponse.text()).toBe(200);
  const created = (await createdResponse.json()) as { id: string };
  await expect(
    page.getByTestId(`scheduled-task-item-${created.id}`),
  ).toBeVisible();

  const detail = page.getByTestId("scheduled-task-detail");
  await detail.getByRole("button", { name: "Edit" }).click();
  await page
    .getByRole("dialog")
    .getByRole("textbox", { name: "Title", exact: true })
    .fill("Real browser task edited");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect(detail).toContainText("Real browser task edited");

  await detail.getByRole("button", { name: "Pause" }).click();
  await expect(detail.getByRole("button", { name: "Resume" })).toBeVisible();
  await detail.getByRole("button", { name: "Resume" }).click();
  await expect(detail.getByRole("button", { name: "Pause" })).toBeVisible();

  const triggerResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes(`/api/scheduled-tasks/${created.id}/trigger`),
  );
  await page.getByTestId("scheduled-task-trigger").click();
  expect((await triggerResponse).status()).toBe(200);
  const run = page.getByTestId("scheduled-run-row").first();
  await expect(run).toContainText("Trial run", { timeout: 30_000 });
  await expect(run).not.toContainText("Run ID");
  // React and Vue present terminal state through the icon when the agent's
  // summary occupies the readable line. Require the actual failed visual state;
  // the persisted status and full delivery error are checked below as well.
  await expect(run.locator(":scope > svg")).toHaveClass(/text-destructive/, {
    timeout: 60_000,
  });
  const details = run.locator("details");
  const summary = details.locator("summary");
  await expect(summary).toHaveText("Details");
  await summary.click();
  await expect(details).toHaveAttribute("open", "");
  await expect(run.getByTestId("scheduled-run-raw-error")).toBeVisible();
  await expect(run.getByTestId("scheduled-run-raw-error")).toContainText(
    "Artifact delivery incomplete",
  );

  const realRuns = await context.request.get(
    `${APP}/api/scheduled-tasks/${created.id}/runs?limit=1&offset=0`,
  );
  expect(realRuns.status(), await realRuns.text()).toBe(200);
  const runPage = (await realRuns.json()) as Array<{
    trigger: string;
    status: string;
    thread_id: string;
    run_id: string | null;
    scheduled_for: string;
    started_at: string | null;
    finished_at: string | null;
    created_at: string;
    error: string | null;
  }>;
  expect(runPage).toHaveLength(1);
  expect(runPage[0]).toMatchObject({
    trigger: "manual",
    status: "failed",
    error: expect.stringMatching(/Artifact delivery incomplete/),
  });
  expect(runPage[0]?.thread_id).toBeTruthy();
  expect(runPage[0]?.run_id).toBeTruthy();
  expect(runPage[0]?.scheduled_for).toBeTruthy();
  expect(runPage[0]?.started_at).toBeTruthy();
  expect(runPage[0]?.finished_at).toBeTruthy();
  expect(runPage[0]?.created_at).toBeTruthy();

  await detail
    .getByRole("button", { name: "More actions", exact: true })
    .click();
  await page.getByTestId("scheduled-task-delete").click();
  const deleteResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "DELETE" &&
      response.url().includes(`/api/scheduled-tasks/${created.id}`),
  );
  await page.getByTestId("scheduled-task-delete-confirm").click();
  expect((await deleteResponse).status()).toBe(200);
  await expect(
    page.getByTestId(`scheduled-task-item-${created.id}`),
  ).toHaveCount(0);
});

test("real Gateway distinguishes omitted edits, explicit clears and default-agent reset", async ({
  context,
}) => {
  await register(context.request, "patch-contract");
  const headers = await csrfHeaders(context.request);
  const endAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
  const createdResponse = await context.request.post(
    `${APP}/api/scheduled-tasks`,
    {
      headers,
      data: {
        title: "Patch contract",
        prompt: "Check the release checklist",
        context_mode: "fresh_thread_per_run",
        assistant_id: "lead_agent",
        schedule_type: "cron",
        schedule_spec: { cron: "0 9 * * *" },
        timezone: "UTC",
        goal_objective: "Complete the checklist",
        stop_condition: "Every item is complete",
        max_runs: 3,
        end_at: endAt,
      },
    },
  );
  expect(createdResponse.status(), await createdResponse.text()).toBe(200);
  const created = (await createdResponse.json()) as { id: string };
  try {
    const unchanged = await context.request.patch(
      `${APP}/api/scheduled-tasks/${created.id}`,
      { headers, data: { title: "Renamed contract" } },
    );
    expect(unchanged.status(), await unchanged.text()).toBe(200);
    expect(await unchanged.json()).toMatchObject({
      title: "Renamed contract",
      assistant_id: "lead_agent",
      goal_objective: "Complete the checklist",
      stop_condition: "Every item is complete",
      max_runs: 3,
    });
    const cleared = await context.request.patch(
      `${APP}/api/scheduled-tasks/${created.id}`,
      {
        headers,
        data: {
          assistant_id: null,
          goal_objective: null,
          stop_condition: null,
          max_runs: null,
          end_at: null,
        },
      },
    );
    expect(cleared.status(), await cleared.text()).toBe(200);
    expect(await cleared.json()).toMatchObject({
      assistant_id: "lead_agent",
      goal_objective: null,
      stop_condition: null,
      max_runs: null,
      end_at: null,
    });
  } finally {
    const deleted = await context.request.delete(
      `${APP}/api/scheduled-tasks/${created.id}`,
      { headers },
    );
    expect(deleted.status(), await deleted.text()).toBe(200);
  }
});
