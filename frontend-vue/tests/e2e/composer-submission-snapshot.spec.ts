import { expect, test, type Page } from "@playwright/test";

import { mockLangGraphAPI, MOCK_THREAD_ID } from "./utils/mock-api";

// Runs the actual Composer -> AgentChat -> useThreadStream -> HTTP request path.
// Only Gateway responses are controlled; model/mode changes use real controls.
test("upload locks its controls and retains its model/context/knowledge across changes from another real tab", async ({
  page,
}) => {
  async function mockPage(target: Page) {
    mockLangGraphAPI(target, {
      threads: [{ thread_id: MOCK_THREAD_ID, title: "Snapshot", messages: [] }],
      features: { knowledgeScopeSelectionEnabled: true },
    });
    await target.route(
      "**/api/knowledge/retrieval-catalog/datasets?*",
      (route) =>
        route.fulfill({
          json: { items: [], page: 1, page_size: 100, total: 0 },
        }),
    );
    await target.route("**/api/models", (route) =>
      route.fulfill({
        json: {
          models: [
            {
              id: "reasoner",
              name: "reasoner",
              model: "reasoner",
              display_name: "Reasoner",
              supports_thinking: true,
              supports_reasoning_effort: true,
            },
            {
              id: "plain",
              name: "plain",
              model: "plain",
              display_name: "Plain",
              supports_thinking: false,
              supports_reasoning_effort: false,
            },
          ],
          token_usage: { enabled: false },
        },
      }),
    );
  }
  await mockPage(page);
  let uploadStarted!: () => void;
  const started = new Promise<void>((resolve) => {
    uploadStarted = resolve;
  });
  let releaseUpload!: () => void;
  const released = new Promise<void>((resolve) => {
    releaseUpload = resolve;
  });
  await page.route("**/api/threads/*/uploads", async (route) => {
    uploadStarted();
    await released;
    await route.fulfill({
      json: {
        success: true,
        message: "ok",
        skipped_files: [],
        files: [
          {
            filename: "one.txt",
            size: 3,
            path: "one.txt",
            virtual_path: "/mnt/user-data/uploads/one.txt",
            artifact_url: "/api/artifacts/one.txt",
          },
        ],
      },
    });
  });
  const bodies: Array<{
    context: Record<string, unknown>;
    input: { messages: Array<{ additional_kwargs?: Record<string, unknown> }> };
  }> = [];
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      new URL(request.url()).pathname.endsWith("/runs/stream")
    )
      bodies.push(request.postDataJSON());
  });
  let otherTab: Page | undefined;
  try {
    await page.goto(`/workspace/chats/${MOCK_THREAD_ID}`);
    const input = page.locator('textarea[name="message"]');
    const picker = page.getByTestId("composer-model-selector");
    await expect(picker).toContainText("Reasoner");
    const knowledge = page.getByTestId("knowledge-scope-trigger");
    await expect(knowledge).toHaveAttribute("aria-pressed", "true");
    await page.getByTestId("composer-mode-trigger").click();
    const pro = page.getByRole("menuitemradio", { name: /^Pro / });
    await pro.click();
    // The mode menu restores its trigger focus on exit. Complete that UI
    // transaction before opening another picker during the paused upload.
    await expect(pro).toBeHidden();
    await expect(page.getByTestId("composer-mode-trigger")).toContainText(
      "Pro",
    );
    await page.getByLabel("Upload files").setInputFiles({
      name: "one.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("one"),
    });
    await input.fill("Upload with the first selection");
    await input.press("Enter");
    await started;
    await expect(input).toHaveAttribute("aria-disabled", "true");
    await expect(picker).toBeDisabled();
    await expect(page.getByTestId("composer-mode-trigger")).toBeDisabled();
    await expect(knowledge).toBeDisabled();
    expect(bodies).toHaveLength(0);

    // A second real tab changes the same thread's persisted model and mode.
    // The uploading tab receives native storage events while its UI stays locked.
    otherTab = await page.context().newPage();
    await mockPage(otherTab);
    await otherTab.goto(`/workspace/chats/${MOCK_THREAD_ID}`);
    const otherPicker = otherTab.getByTestId("composer-model-selector");
    await expect(otherPicker).toContainText("Reasoner");
    await otherPicker.click();
    await otherTab.locator('[data-model-name="plain"]').click();
    await expect(otherPicker).toContainText("Plain");
    await expect(otherTab.getByTestId("composer-mode-trigger")).toContainText(
      "Flash",
    );
    await expect(picker).toContainText("Plain");
    await expect(page.getByTestId("composer-mode-trigger")).toContainText(
      "Flash",
    );
    await expect(picker).toBeDisabled();
    await expect(knowledge).toHaveAttribute("aria-pressed", "true");
    expect(bodies).toHaveLength(0);
    releaseUpload();
    await expect.poll(() => bodies.length).toBe(1);
    expect(bodies[0]!.context).toMatchObject({
      model_name: "reasoner",
      mode: "pro",
      thinking_enabled: true,
      is_plan_mode: true,
      subagent_enabled: false,
    });
    expect(bodies[0]!.input.messages.at(-1)?.additional_kwargs?.files).toEqual([
      {
        filename: "one.txt",
        size: 3,
        path: "/mnt/user-data/uploads/one.txt",
        status: "uploaded",
      },
    ]);
    expect(
      bodies[0]!.input.messages.at(-1)?.additional_kwargs?.knowledge_scope,
    ).toEqual({ version: 1, mode: "all" });
    expect(bodies[0]!.context).not.toHaveProperty("knowledge_scope");
    await expect(
      page.getByRole("button", { name: "Submit", exact: true }),
    ).toBeEnabled();
    await expect(picker).toBeEnabled();
    await expect(knowledge).toBeEnabled();
    await knowledge.click();
    await page.getByLabel("Off", { exact: true }).check();
    await page.getByRole("button", { name: "Apply", exact: true }).click();
    await expect(knowledge).toHaveAttribute("aria-pressed", "false");
    await input.fill("Use the new selection now");
    await input.press("Enter");
    await expect.poll(() => bodies.length).toBe(2);
    expect(bodies[1]!.context).toMatchObject({
      model_name: "plain",
      mode: "flash",
      thinking_enabled: false,
      is_plan_mode: false,
      subagent_enabled: false,
    });
    expect(bodies[1]!.context).not.toHaveProperty("reasoning_effort");
    expect(
      bodies[1]!.input.messages.at(-1)?.additional_kwargs?.knowledge_scope,
    ).toEqual({ version: 1, mode: "disabled" });
    expect(bodies[1]!.context).not.toHaveProperty("knowledge_scope");
  } finally {
    releaseUpload();
    await otherTab?.close();
  }
});
