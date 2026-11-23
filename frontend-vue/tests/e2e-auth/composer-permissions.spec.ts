import { expect, test, type Page } from "@playwright/test";

import { enUS } from "../../app/core/i18n/locales/en-US";
import {
  handleRunStream,
  mockLangGraphAPI,
  MOCK_THREAD_ID,
} from "../e2e/utils/mock-api";

async function installPermissions(page: Page, permissions: string[]) {
  mockLangGraphAPI(page, {
    threads: [
      { thread_id: MOCK_THREAD_ID, title: "Permission boundary", messages: [] },
    ],
  });
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      json: {
        id: "00000000-0000-0000-0000-000000000028",
        email: "viewer@example.com",
        system_role: "workspace-viewer",
        needs_setup: false,
        permissions,
      },
    }),
  );
}

test("a resolved custom role without runs:create cannot send or prepare a goal", async ({
  page,
}) => {
  await installPermissions(page, []);
  const writes: string[] = [];
  page.on("request", (request) => {
    if (
      (request.method() === "POST" && request.url().includes("/runs/stream")) ||
      (request.method() === "PUT" && request.url().endsWith("/goal"))
    )
      writes.push(request.url());
  });
  await page.goto(`/workspace/chats/${MOCK_THREAD_ID}`);
  const submit = page.getByRole("button", {
    name: enUS.inputBox.startTurnUnavailable,
    exact: true,
  });
  await expect(submit).toBeDisabled();
  await expect(submit).toHaveAttribute(
    "title",
    enUS.inputBox.startTurnUnavailable,
  );
  const input = page.getByPlaceholder(/how can i assist you/i);
  for (const text of ["Keep this draft", "/goal Prepare the report"]) {
    await input.fill(text);
    await input.press("Enter");
    await expect(input).toHaveValue(text);
    await expect(
      page
        .getByText(enUS.inputBox.startTurnUnavailable, { exact: true })
        .last(),
    ).toBeVisible();
    expect(writes).toEqual([]);
  }
});

test("runs:create without runs:cancel retains a disabled stop affordance during the run", async ({
  page,
}) => {
  await installPermissions(page, ["runs:create"]);
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/runs/stream", async (route) => {
    await pending;
    await handleRunStream(route);
  });
  const cancellations: string[] = [];
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      new URL(request.url()).pathname.endsWith("/cancel")
    )
      cancellations.push(request.url());
  });
  try {
    await page.goto(`/workspace/chats/${MOCK_THREAD_ID}`);
    const input = page.getByPlaceholder(/how can i assist you/i);
    await expect(
      page.getByRole("button", { name: "Submit", exact: true }),
    ).toBeEnabled();
    await input.fill("Keep working");
    await input.press("Enter");
    const stop = page.getByRole("button", {
      name: enUS.inputBox.stopStreamingUnavailable,
      exact: true,
    });
    await expect(stop).toBeDisabled();
    await expect(stop).toHaveAttribute(
      "title",
      enUS.inputBox.stopStreamingUnavailable,
    );
    await stop.press("Space");
    expect(cancellations).toEqual([]);
  } finally {
    release();
  }
  await expect(
    page.getByText("Hello from DeerFlow!", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Submit", exact: true }),
  ).toBeEnabled();
});
