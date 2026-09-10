/*
  【文件职责】     Vue-owned scheduled-task 产品交互、payload、筛选与错误 E2E。
  【架构位置】     Playwright contract
  【主要导出】     Playwright scenarios
  【依赖关系】     shared mock Gateway · Vue scheduled-task page/components
  【边界与注意】   Mock 只验证确定性 UI/HTTP 边界；真实 FastAPI 语义由 wp07-real-backend suite 证明。

                   这里守的是**交互之后**的分支——e2e-parity 的样本只是一次页面加载，
                   点开编辑、切筛选、触发一次运行、以及各种失败路径它都到不了；而
                   e2e-parity 需要兄弟 React 应用才能跑，本模块的常规门禁不依赖它。
                   所以每条断言都写成 React 那边的形状：控件类型（按钮还是下拉）、
                   失败走 toast 还是内联、运行中的任务是否禁用动作。
*/
import { expect, test, type Page, type Route } from "@playwright/test";

import type { ScheduledTask } from "@/core/scheduled-tasks/types";

import {
  MOCK_THREAD_ID,
  mockLangGraphAPI,
  type MockAPIOptions,
} from "./utils/mock-api";

type TaskStatus = ScheduledTask["status"];

function task(
  id: string,
  options: {
    status?: TaskStatus;
    scheduleType?: "once" | "cron";
    threadId?: string | null;
    title?: string;
  } = {},
): ScheduledTask {
  const scheduleType = options.scheduleType ?? "cron";
  return {
    id,
    thread_id: options.threadId ?? null,
    context_mode: options.threadId
      ? ("reuse_thread" as const)
      : ("fresh_thread_per_run" as const),
    last_thread_id: null,
    title: options.title ?? `Task ${id}`,
    prompt: `Prompt ${id}`,
    schedule_type: scheduleType,
    schedule_spec:
      scheduleType === "cron"
        ? { cron: "0 9 * * *" }
        : { run_at: "2027-07-01T09:00:00+00:00" },
    timezone: "UTC",
    status: options.status ?? ("enabled" as const),
    next_run_at: "2027-07-01T09:00:00+00:00",
    last_run_at: null,
    last_run_id: null,
    last_error: null,
    run_count: 0,
    created_at: "2026-07-01T00:00:00+00:00",
    updated_at: "2026-07-01T00:00:00+00:00",
  };
}

/*
  夹具就是 Gateway 契约本身，不是从工厂反推出来的形状。反推那版把
  `schedule_spec` 收成了 `{cron} | {run_at}` 的字面量联合——于是 mock 里
  「按请求体回写 spec」这条正常路径反而编译不过。Gateway 加字段时，
  这一行会让这份 mock 当场失效，那正是我们要的。
*/
type MockTask = ScheduledTask;
type MockRun = {
  id: string;
  task_id: string;
  thread_id: string;
  run_id: string | null;
  scheduled_for: string;
  trigger: "scheduled" | "manual";
  status:
    "queued" | "running" | "success" | "failed" | "skipped" | "interrupted";
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
};

function mockWP07Gateway(
  page: Page,
  options: {
    threads?: MockAPIOptions["threads"];
    scheduledTasks?: MockTask[];
  } = {},
) {
  mockLangGraphAPI(page, { threads: options.threads });
  let tasks = [...(options.scheduledTasks ?? [])];
  const runs: Record<string, MockRun[]> = {};
  const timestamp = "2026-07-01T00:00:00+00:00";

  void page.route("**/api/scheduled-tasks", (route) => {
    const request = route.request();
    if (request.method() === "GET") {
      return route.fulfill({ status: 200, json: tasks });
    }
    if (request.method() === "POST") {
      const payload = request.postDataJSON() as Record<string, unknown>;
      const contextMode =
        payload.context_mode === "reuse_thread"
          ? ("reuse_thread" as const)
          : ("fresh_thread_per_run" as const);
      const created: MockTask = {
        ...task("created"),
        context_mode: contextMode,
        thread_id:
          contextMode === "reuse_thread" &&
          typeof payload.thread_id === "string"
            ? payload.thread_id
            : null,
        title: String(payload.title ?? ""),
        prompt: String(payload.prompt ?? ""),
        schedule_type: payload.schedule_type === "once" ? "once" : "cron",
        schedule_spec:
          typeof payload.schedule_spec === "object" && payload.schedule_spec
            ? (payload.schedule_spec as Record<string, unknown>)
            : {},
        timezone: String(payload.timezone ?? "UTC"),
      };
      tasks = [created, ...tasks];
      runs[created.id] = [];
      return route.fulfill({ status: 200, json: created });
    }
    return route.fallback();
  });

  void page.route("**/api/threads/*/scheduled-tasks", (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    const path = new URL(route.request().url()).pathname.split("/");
    const threadId = decodeURIComponent(
      path[path.indexOf("threads") + 1] ?? "",
    );
    return route.fulfill({
      status: 200,
      json: tasks.filter((candidate) => candidate.thread_id === threadId),
    });
  });

  const handleTaskRoute = (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.split("/");
    const action = path.at(-1) ?? "";
    const hasAction = ["pause", "resume", "trigger"].includes(action);
    const taskId = decodeURIComponent(path.at(hasAction ? -2 : -1) ?? "");
    const current = tasks.find((candidate) => candidate.id === taskId);

    if (request.method() === "GET" && !hasAction) {
      return route.fulfill({
        status: current ? 200 : 404,
        json: current ?? { detail: "Scheduled task not found" },
      });
    }
    if (request.method() === "PATCH") {
      const payload = request.postDataJSON() as Record<string, unknown>;
      let updated: MockTask | undefined;
      tasks = tasks.map((candidate) => {
        if (candidate.id !== taskId) return candidate;
        const contextMode =
          payload.context_mode === "reuse_thread" ||
          payload.context_mode === "fresh_thread_per_run"
            ? payload.context_mode
            : candidate.context_mode;
        updated = {
          ...candidate,
          ...(typeof payload.title === "string"
            ? { title: payload.title }
            : {}),
          ...(typeof payload.prompt === "string"
            ? { prompt: payload.prompt }
            : {}),
          ...(typeof payload.schedule_spec === "object" && payload.schedule_spec
            ? {
                schedule_spec: payload.schedule_spec as Record<string, unknown>,
              }
            : {}),
          ...(typeof payload.timezone === "string"
            ? { timezone: payload.timezone }
            : {}),
          context_mode: contextMode,
          thread_id:
            contextMode === "fresh_thread_per_run"
              ? null
              : typeof payload.thread_id === "string"
                ? payload.thread_id
                : candidate.thread_id,
          updated_at: timestamp,
        };
        return updated;
      });
      return route.fulfill({
        status: updated ? 200 : 404,
        json: updated ?? { detail: "Scheduled task not found" },
      });
    }
    if (request.method() === "DELETE") {
      tasks = tasks.filter((candidate) => candidate.id !== taskId);
      Reflect.deleteProperty(runs, taskId);
      return route.fulfill({
        status: 200,
        json: { id: taskId, deleted: true },
      });
    }
    if (request.method() === "POST" && current && hasAction) {
      if (action === "trigger") {
        const runId = `run-${taskId}`;
        runs[taskId] = [
          {
            id: `task-run-${taskId}`,
            task_id: taskId,
            thread_id: current.thread_id ?? `thread-${taskId}`,
            run_id: runId,
            scheduled_for: timestamp,
            trigger: "manual",
            status: "success",
            error: null,
            started_at: timestamp,
            finished_at: timestamp,
            created_at: timestamp,
          },
          ...(runs[taskId] ?? []),
        ];
        tasks = tasks.map((candidate) =>
          candidate.id === taskId
            ? {
                ...candidate,
                last_run_id: runId,
                last_run_at: timestamp,
                run_count: candidate.run_count + 1,
              }
            : candidate,
        );
        return route.fulfill({
          status: 200,
          json: { id: taskId, triggered: true },
        });
      }
      const status = action === "pause" ? "paused" : "enabled";
      const updated = { ...current, status } as MockTask;
      tasks = tasks.map((candidate) =>
        candidate.id === taskId ? updated : candidate,
      );
      return route.fulfill({ status: 200, json: updated });
    }
    return route.fallback();
  };
  void page.route("**/api/scheduled-tasks/*", handleTaskRoute);
  for (const action of ["pause", "resume", "trigger"]) {
    void page.route(`**/api/scheduled-tasks/*/${action}`, handleTaskRoute);
  }

  // 用正则不用 glob：Playwright 的 glob 会连查询串一起匹配，而 runs 带 limit/offset，
  // 于是 `**` 那一版一条都拦不到——请求会穿过 mock 打到真后端上去。
  void page.route(/\/api\/scheduled-tasks\/[^/]+\/runs(\?|$)/, (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    const url = new URL(route.request().url());
    const taskId = decodeURIComponent(url.pathname.split("/").at(-2) ?? "");
    const limit = Number(url.searchParams.get("limit") ?? "50");
    const offset = Number(url.searchParams.get("offset") ?? "0");
    return route.fulfill({
      status: 200,
      json: (runs[taskId] ?? []).slice(offset, offset + limit),
    });
  });
}

async function fillRequiredCreate(page: Page, title = "Created task") {
  await page.getByTestId("scheduled-task-title").first().fill(title);
  await page
    .getByTestId("scheduled-task-prompt")
    .first()
    .fill("Created prompt");
}

/** Reka 的 Select 是自定义 listbox：先开触发器，再点选项，没有 selectOption。 */
async function chooseOption(page: Page, testId: string, option: string) {
  await page.getByTestId(testId).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

test.describe("Vue scheduled tasks", () => {
  test("route thread is an editable default and the page owns its DOM", async ({
    page,
  }) => {
    mockWP07Gateway(page, {
      threads: [{ thread_id: MOCK_THREAD_ID, title: "Scoped thread" }],
      scheduledTasks: [task("scoped", { threadId: MOCK_THREAD_ID })],
    });

    await page.goto(
      `/workspace/scheduled-tasks?thread_id=${encodeURIComponent(MOCK_THREAD_ID)}`,
    );
    await expect(page.getByTestId("scheduled-task-item-scoped")).toBeVisible();
    // context mode 是两颗按钮，选中的那颗是 default 变体——不是一个 <select>。
    await expect(
      page.getByTestId("scheduled-task-context-reuse"),
    ).toHaveAttribute("data-variant", "default");
    await expect(page.getByTestId("scheduled-task-thread-id")).toHaveValue(
      MOCK_THREAD_ID,
    );

    await page.getByTestId("scheduled-task-context-fresh").click();
    await expect(page.getByTestId("scheduled-task-thread-id")).toHaveCount(0);
    await expect(
      page.getByTestId("scheduled-task-context-fresh"),
    ).toHaveAttribute("data-variant", "default");
  });

  test("recipe and custom cron submit the exact fresh-thread Gateway payload", async ({
    page,
  }) => {
    mockWP07Gateway(page, { scheduledTasks: [] });
    let payload: Record<string, unknown> | undefined;
    page.on("request", (request) => {
      if (
        request.method() === "POST" &&
        new URL(request.url()).pathname === "/api/scheduled-tasks"
      ) {
        payload = request.postDataJSON() as Record<string, unknown>;
      }
    });

    await page.goto("/workspace/scheduled-tasks");
    // recipe 按钮的可访问名只有标题，emoji 与描述都不进名字。
    await expect(
      page.getByRole("button", { name: "GitHub Issue triage", exact: true }),
    ).toBeVisible();
    await page.getByTestId("scheduled-task-recipe-issues").click();
    await expect(page.getByTestId("scheduled-task-prompt")).toHaveValue(
      /\{\{repo\}\}/,
    );
    await chooseOption(page, "schedule-preset", "Custom cron");
    await page.getByTestId("scheduled-task-custom-cron").fill("15 8 * * 1");
    await page.getByTestId("scheduled-task-submit").click();

    await expect(
      page.getByRole("button", { name: /GitHub Issue triage/ }).last(),
    ).toBeVisible();
    expect(payload).toMatchObject({
      context_mode: "fresh_thread_per_run",
      thread_id: null,
      title: "GitHub Issue triage",
      schedule_type: "cron",
      schedule_spec: { cron: "15 8 * * 1" },
    });
    expect(payload?.timezone).toEqual(expect.any(String));
    expect(payload).not.toHaveProperty("enabled");
    expect(payload).not.toHaveProperty("non_interactive");
  });

  test("one-time wall clock uses the selected DST timezone and explicit UTC", async ({
    page,
  }) => {
    mockWP07Gateway(page, { scheduledTasks: [] });
    let payload: Record<string, unknown> | undefined;
    page.on("request", (request) => {
      if (
        request.method() === "POST" &&
        new URL(request.url()).pathname === "/api/scheduled-tasks"
      ) {
        payload = request.postDataJSON() as Record<string, unknown>;
      }
    });

    await page.goto("/workspace/scheduled-tasks");
    await fillRequiredCreate(page, "DST once");
    await page
      .getByTestId("scheduled-task-create-form")
      .getByRole("button", { name: "One-time" })
      .click();
    await chooseOption(page, "schedule-timezone", "America/New_York");
    await page.getByTestId("scheduled-task-run-at").fill("2027-03-14T03:30");
    await page.getByTestId("scheduled-task-submit").click();

    await expect(
      page.getByRole("button", { name: /DST once/ }).last(),
    ).toBeVisible();
    // 墙上时间 → UTC 的换算发生在 ScheduleInput 里，与 React 同一处边界。
    expect(payload).toMatchObject({
      schedule_type: "once",
      schedule_spec: { run_at: "2027-03-14T07:30:00+00:00" },
      timezone: "America/New_York",
    });
  });

  test("edit stays inside the detail pane and keeps its unsaved text", async ({
    page,
  }) => {
    mockWP07Gateway(page, {
      scheduledTasks: [task("lifecycle", { title: "Lifecycle task" })],
    });
    await page.goto("/workspace/scheduled-tasks");
    const detail = page.getByTestId("scheduled-task-detail");

    await detail.getByRole("button", { name: "Edit" }).click();
    // 编辑块在详情**里面**：上面的字段和下面的动作按钮都还在。
    await expect(detail.getByTestId("scheduled-task-edit-form")).toBeVisible();
    await expect(detail).toContainText("Context mode:");
    await expect(detail.getByRole("button", { name: "Pause" })).toBeVisible();
    await expect(detail.getByTestId("scheduled-task-runs")).toBeVisible();
    await expect(
      detail
        .getByTestId("scheduled-task-edit-form")
        .getByRole("button", { name: "One-time" }),
    ).toHaveCount(0);

    const editTitle = detail.getByTestId("scheduled-task-title");
    await editTitle.fill("Half-typed title");
    await detail.getByRole("button", { name: "Cancel edit" }).click();
    await detail.getByRole("button", { name: "Edit" }).click();
    await expect(editTitle).toHaveValue("Half-typed title");
  });

  test("pause, resume, trigger, run detail, and confirmed delete complete the lifecycle", async ({
    page,
  }) => {
    mockWP07Gateway(page, {
      scheduledTasks: [task("lifecycle", { title: "Lifecycle task" })],
    });
    await page.goto("/workspace/scheduled-tasks");
    const detail = page.getByTestId("scheduled-task-detail");

    await detail.getByRole("button", { name: "Edit" }).click();
    await detail.getByTestId("scheduled-task-title").fill("Edited task");
    await detail.getByTestId("scheduled-task-prompt").fill("Edited prompt");
    await detail.getByTestId("scheduled-task-submit").click();
    await expect(detail.getByText("Edited task")).toBeVisible();

    await detail.getByRole("button", { name: "Pause" }).click();
    await expect(detail.getByRole("button", { name: "Resume" })).toBeVisible();
    await detail.getByRole("button", { name: "Resume" }).click();
    await expect(detail.getByRole("button", { name: "Pause" })).toBeVisible();

    await page.getByTestId("scheduled-task-trigger").click();
    await expect(page.getByTestId("scheduled-task-runs")).toContainText(
      "1 run",
    );
    const run = page.getByTestId("scheduled-task-run-task-run-lifecycle");
    await expect(run).toContainText("manual · Success");
    await expect(run).toContainText("run-lifecycle");
    // 一条运行只有四行裸值，没有 Scheduled for / Thread ID / Run ID 这些字段名。
    await expect(run).not.toContainText("Scheduled for");
    await expect(run).not.toContainText("Thread ID");
    await expect(run).not.toContainText("Run ID");

    await page.getByTestId("scheduled-task-delete").click();
    await expect(
      page.getByTestId("scheduled-task-delete-dialog"),
    ).toBeVisible();
    await page.getByTestId("scheduled-task-delete-confirm").click();
    await expect(page.getByTestId("scheduled-task-item-lifecycle")).toHaveCount(
      0,
    );
  });

  test("filters are the eight buttons React ships, and selection falls back", async ({
    page,
  }) => {
    const statuses: TaskStatus[] = [
      "enabled",
      "paused",
      "running",
      "completed",
      "failed",
      "cancelled",
    ];
    mockWP07Gateway(page, {
      scheduledTasks: statuses.map((status, index) =>
        task(status, {
          status,
          title: `${status} task`,
          scheduleType: index % 2 ? "once" : "cron",
        }),
      ),
    });
    await page.goto("/workspace/scheduled-tasks");
    const filters = page.getByTestId("scheduled-task-filters");
    await expect(filters.getByRole("button")).toHaveCount(8);
    // Gateway 有六种状态，但 React 只给了五颗状态按钮。
    await expect(
      filters.getByTestId("scheduled-task-status-filter-running"),
    ).toHaveCount(0);
    await expect(
      filters.getByTestId("scheduled-task-status-filter-cancelled"),
    ).toHaveCount(0);

    await page.getByTestId("scheduled-task-item-paused").click();
    await expect(page.getByTestId("scheduled-task-detail")).toContainText(
      "paused task",
    );
    await page.getByTestId("scheduled-task-status-filter-enabled").click();
    await expect(page.getByTestId("scheduled-task-item-enabled")).toBeVisible();
    await expect(page.getByTestId("scheduled-task-detail")).toContainText(
      "enabled task",
    );
    await page.getByTestId("scheduled-task-status-filter-all").click();
    await page.getByTestId("scheduled-task-type-filter-once").click();
    await expect(
      page.getByTestId("scheduled-task-list").locator("button"),
    ).toHaveCount(3);
  });

  test("runs paginate with limit/offset and never stop silently at fifty", async ({
    page,
  }) => {
    mockWP07Gateway(page, { scheduledTasks: [task("paged")] });
    const offsets: number[] = [];
    const runs = Array.from({ length: 55 }, (_, index) => ({
      id: `run-${index}`,
      task_id: "paged",
      thread_id: `thread-${index}`,
      run_id: `gateway-run-${index}`,
      scheduled_for: "2026-07-01T00:00:00+00:00",
      trigger: index % 2 ? "scheduled" : "manual",
      status: index === 0 ? "interrupted" : "success",
      error: index === 0 ? "Interrupted by operator" : null,
      started_at: "2026-07-01T00:00:00+00:00",
      finished_at: "2026-07-01T00:01:00+00:00",
      created_at: "2026-07-01T00:00:00+00:00",
    }));
    await page.route(/\/api\/scheduled-tasks\/paged\/runs(\?|$)/, (route) => {
      const url = new URL(route.request().url());
      const limit = Number(url.searchParams.get("limit"));
      const offset = Number(url.searchParams.get("offset"));
      offsets.push(offset);
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(runs.slice(offset, offset + limit)),
      });
    });

    await page.goto("/workspace/scheduled-tasks");
    await expect(
      page.locator('[data-testid^="scheduled-task-run-run-"]'),
    ).toHaveCount(50);
    // 满页就意味着还有下一页：这时候「50 runs」不是历史的全部。
    await page.getByTestId("scheduled-task-load-more-runs").click();
    await expect(
      page.locator('[data-testid^="scheduled-task-run-run-"]'),
    ).toHaveCount(55);
    await expect(page.getByTestId("scheduled-task-runs")).toContainText(
      "55 runs",
    );
    expect(offsets).toEqual([0, 50]);
    await expect(page.getByTestId("scheduled-task-load-more-runs")).toHaveCount(
      0,
    );
    await expect(page.getByTestId("scheduled-task-run-run-0")).toContainText(
      "Interrupted by operator",
    );
  });

  test("a running task keeps its actions enabled and shows the Gateway's 409", async ({
    page,
  }) => {
    mockWP07Gateway(page, {
      scheduledTasks: [task("active", { status: "running" })],
    });
    await page.route("**/api/scheduled-tasks/active/pause", (route) =>
      route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Scheduled task has an active run" }),
      }),
    );
    await page.goto("/workspace/scheduled-tasks");
    const detail = page.getByTestId("scheduled-task-detail");
    // React 不做先行禁用；冲突由 Gateway 的 409 拒绝。
    for (const name of ["Edit", "Pause", "Trigger now", "Delete"]) {
      await expect(detail.getByRole("button", { name })).toBeEnabled();
    }
    await detail.getByRole("button", { name: "Pause" }).click();
    await expect(page.getByTestId("workspace-toaster")).toContainText(
      "Scheduled task has an active run",
    );
  });

  test("Gateway validation detail lands in a toast, not a fake success", async ({
    page,
  }) => {
    mockWP07Gateway(page, { scheduledTasks: [] });
    await page.route("**/api/scheduled-tasks", (route) => {
      if (route.request().method() === "POST") {
        return route.fulfill({
          status: 422,
          contentType: "application/json",
          body: JSON.stringify({
            detail: "Cron expression must have exactly 5 fields",
          }),
        });
      }
      return route.fallback();
    });
    await page.goto("/workspace/scheduled-tasks");
    await fillRequiredCreate(page, "Invalid cron");
    await chooseOption(page, "schedule-preset", "Custom cron");
    await page.getByTestId("scheduled-task-custom-cron").fill("bad cron");
    await page.getByTestId("scheduled-task-submit").click();
    await expect(page.getByTestId("workspace-toaster")).toContainText(
      "Cron expression must have exactly 5 fields",
    );
    // 表单不清空：失败之后刚才填的东西还在。
    await expect(page.getByTestId("scheduled-task-title")).toHaveValue(
      "Invalid cron",
    );
  });

  test("Gateway action failures preserve detail and follow the shared 401 login contract", async ({
    page,
  }) => {
    mockWP07Gateway(page, { scheduledTasks: [task("failure")] });
    const failures = [
      {
        status: 403,
        detail: "Scheduled task permission denied",
        expected: "Scheduled task permission denied",
      },
      {
        status: 404,
        detail: "Scheduled task not found",
        expected: "Scheduled task not found",
      },
      {
        status: 409,
        detail: "Scheduled task has an active run",
        expected: "Scheduled task has an active run",
      },
      {
        status: 502,
        detail: "Scheduler launch failed upstream",
        expected: "Scheduler launch failed upstream",
      },
      {
        status: 401,
        detail: "Authentication required",
        expected: "Unauthorized",
      },
    ];
    let attempt = 0;
    await page.route("**/api/scheduled-tasks/failure/trigger", (route) => {
      const failure = failures[attempt++];
      if (!failure) {
        throw new Error("unexpected extra trigger request");
      }
      return route.fulfill({
        status: failure.status,
        contentType: "application/json",
        body: JSON.stringify({ detail: failure.detail }),
      });
    });
    await page.goto("/workspace/scheduled-tasks");
    for (const failure of failures.slice(0, -1)) {
      await page.getByTestId("scheduled-task-trigger").click();
      await expect(page.getByTestId("workspace-toaster")).toContainText(
        failure.expected,
      );
    }
    await page.getByTestId("scheduled-task-trigger").click();
    await expect
      .poll(() => {
        const url = new URL(page.url());
        return {
          pathname: url.pathname,
          query: [...url.searchParams.entries()],
        };
      })
      .toEqual({
        pathname: "/login",
        query: [["next", "/workspace/scheduled-tasks"]],
      });
    expect(attempt).toBe(failures.length);
  });
});
