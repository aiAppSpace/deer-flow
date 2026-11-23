import { expect, test } from "@playwright/test";
import { mockLangGraphAPI, type MockScheduledTask } from "./utils/mock-api";
const task: MockScheduledTask = {
  id: "task-1",
  title: "Daily summary",
  prompt: "Summarize changes",
  thread_id: null,
  context_mode: "fresh_thread_per_run",
  schedule_type: "cron",
  schedule_spec: { cron: "0 9 * * *" },
  timezone: "UTC",
  status: "enabled",
  next_run_at: null,
  last_run_at: null,
  last_run_id: null,
  last_error: null,
  run_count: 0,
  created_at: "2030-01-01T00:00:00Z",
  updated_at: "2030-01-01T00:00:00Z",
};
test.beforeEach(async ({ page }) => {
  mockLangGraphAPI(page, { threads: [], scheduledTasks: [task] });
  await page.goto("/workspace/scheduled-tasks");
  await expect(page.getByTestId("scheduled-task-item-task-1")).toBeVisible();
});
test("workspace page exposes a named search, single choice tabs and an article detail", async ({
  page,
}) => {
  await expect(
    page.getByRole("heading", { level: 1, name: "Scheduled tasks" }),
  ).toBeVisible();
  await expect(
    page.getByRole("searchbox", { name: "Search tasks" }),
  ).toBeVisible();
  const tabs = page.getByRole("group", { name: "Filter by status" });
  await expect(tabs.getByRole("radio")).toHaveCount(4);
  await expect(tabs.getByRole("radio", { name: /All/ })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(page.getByTestId("scheduled-task-detail")).toHaveAccessibleName(
    "Daily summary",
  );
  await expect(page.getByTestId("scheduled-task-detail")).toHaveJSProperty(
    "tagName",
    "ARTICLE",
  );
});
test("create opens one labeled modal form, with recipe and named required fields", async ({
  page,
}) => {
  await page.getByRole("button", { name: "New task", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("textbox", { name: "Title", exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("textbox", { name: "Instructions", exact: true }),
  ).toBeVisible();
  await expect(dialog.getByTestId("schedule-preset")).toBeVisible();
  await expect(dialog.getByTestId("schedule-timezone")).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Daily tech news digest", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});
test("edit uses the shared modal and fixes the existing schedule type", async ({
  page,
}) => {
  await page
    .getByTestId("scheduled-task-detail")
    .getByRole("button", { name: "Edit", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("textbox", { name: "Title", exact: true }),
  ).toHaveValue("Daily summary");
  await expect(dialog.getByTestId("scheduled-task-schedule-type")).toHaveCount(
    0,
  );
  await expect(
    dialog.getByRole("button", { name: "Save changes", exact: true }),
  ).toBeVisible();
});
