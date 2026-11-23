import { expect, test } from "@playwright/test";

import { mockLangGraphAPI, type MockScheduledTask } from "./utils/mock-api";

const task: MockScheduledTask = {
  id: "action-errors",
  thread_id: null,
  context_mode: "fresh_thread_per_run",
  title: "Retained task",
  prompt: "Summarize the release notes",
  schedule_type: "cron",
  schedule_spec: { cron: "0 9 * * *" },
  timezone: "UTC",
  status: "enabled",
  next_run_at: null,
  last_run_at: null,
  last_run_id: null,
  last_error: null,
  run_count: 0,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

// Preserve the pre-redesign browser mutation contract, using current Gateway
// envelopes and readable copy. Unit error mapping alone cannot prove wiring.
for (const failure of [
  {
    status: 403,
    detail: "Scheduled task permission denied",
    message: "You don't have permission to do this.",
  },
  {
    status: 404,
    detail: { code: "task_not_found", message: "Scheduled task not found" },
    message: "This task no longer exists.",
  },
  {
    status: 409,
    detail: {
      code: "task_running",
      message: "Scheduled task has an active run",
    },
    message: "This task is running right now. Try again when the run finishes.",
  },
  {
    status: 502,
    detail: {
      code: "trigger_failed",
      message: "Scheduler launch failed upstream",
    },
    message: "The run couldn't be started.",
  },
]) {
  test(`trial-run HTTP ${failure.status} keeps task detail and allows an explicit retry`, async ({
    page,
  }) => {
    mockLangGraphAPI(page, { threads: [], scheduledTasks: [task] });
    let attempts = 0;
    await page.route(`**/api/scheduled-tasks/${task.id}/trigger`, (route) => {
      attempts += 1;
      return attempts === 1
        ? route.fulfill({
            status: failure.status,
            json: { detail: failure.detail },
          })
        : route.fallback();
    });
    await page.goto("/workspace/scheduled-tasks");
    const detail = page.getByTestId("scheduled-task-detail");
    const trigger = detail.getByRole("button", {
      name: "Run once now",
      exact: true,
    });
    await trigger.click();
    await expect(page.getByTestId("workspace-toaster")).toContainText(
      `Failed to start a trial run: ${failure.message}`,
    );
    await expect(detail.getByRole("heading")).toHaveText(task.title);
    await expect(
      page.getByText("Trial run started", { exact: true }),
    ).toHaveCount(0);
    await expect(page.getByTestId("scheduled-run-row")).toHaveCount(0);
    await expect(trigger).toBeEnabled();
    expect(attempts).toBe(1);
    await trigger.click();
    await expect(
      page.getByText("Trial run started", { exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId("scheduled-run-row")).toHaveCount(1);
    expect(attempts).toBe(2);
  });
}

test("trial-run HTTP 401 redirects to login with the task page as return path", async ({
  page,
}) => {
  mockLangGraphAPI(page, { threads: [], scheduledTasks: [task] });
  let attempts = 0;
  await page.route(`**/api/scheduled-tasks/${task.id}/trigger`, (route) => {
    attempts += 1;
    return route.fulfill({ status: 401, json: { detail: "Unauthorized" } });
  });
  await page.goto("/workspace/scheduled-tasks");
  // The session is expired by the mutation; keep the login page anonymous too.
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ status: 401, json: { detail: "Unauthorized" } }),
  );
  await page.route("**/api/v1/auth/setup-status", (route) =>
    route.fulfill({ json: { needs_setup: false, registration_enabled: true } }),
  );
  await page.route("**/api/v1/auth/providers", (route) =>
    route.fulfill({ json: { providers: [] } }),
  );
  await page.getByTestId("scheduled-task-trigger").click();
  await expect
    .poll(() => {
      const url = new URL(page.url());
      return { path: url.pathname, query: [...url.searchParams.entries()] };
    })
    .toEqual({
      path: "/login",
      query: [["next", "/workspace/scheduled-tasks"]],
    });
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  expect(attempts).toBe(1);
});
