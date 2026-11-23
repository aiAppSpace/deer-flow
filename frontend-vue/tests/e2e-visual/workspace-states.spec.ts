import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

import { expect, test, type Page } from "@playwright/test";

import { mockLangGraphAPI } from "../e2e/utils/mock-api";
import { enUS } from "../../app/core/i18n/locales/en-US";
import { zhCN } from "../../app/core/i18n/locales/zh-CN";

const STREAM_THREAD_ID = "00000000-0000-0000-0000-000000007001";
const REASONING_THREAD_ID = "00000000-0000-0000-0000-000000007002";
const ARTIFACT_THREAD_ID = "00000000-0000-0000-0000-000000007003";
const RUN_ID = "00000000-0000-0000-0000-000000007099";
const ARTIFACT_PATH = "/artifact-fixtures/m7-visual-report.html";

const FREEZE_DYNAMIC_REGIONS = `
  *, *::before, *::after { caret-color: transparent !important; }
  time { visibility: hidden !important; }
`;

async function prepare(
  page: Page,
  options?: Parameters<typeof mockLangGraphAPI>[1],
) {
  mockLangGraphAPI(page, options);
  await page
    .addStyleTag({ content: FREEZE_DYNAMIC_REGIONS })
    .catch(() => undefined);
}

async function snapshot(
  page: Page,
  name: string,
  options: { preserveFocus?: boolean } = {},
) {
  await page.addStyleTag({ content: FREEZE_DYNAMIC_REGIONS });
  if (!options.preserveFocus) {
    await page.evaluate(() =>
      (document.activeElement as HTMLElement | null)?.blur(),
    );
  }
  await expect(page).toHaveScreenshot(name, {
    animations: "disabled",
    fullPage: true,
    maxDiffPixelRatio: 0.01,
  });
}

function heldStreamingFrames() {
  const human = {
    type: "human",
    id: "m7-visual-human",
    content: [{ type: "text", text: "Prepare a production readiness plan" }],
  };
  const chunk = {
    type: "AIMessageChunk",
    id: "m7-visual-ai",
    content: "Drafting the production readiness plan…",
    additional_kwargs: {
      reasoning_content:
        "Checking ingress, authentication, and rollback gates.",
    },
    tool_calls: [
      {
        id: "m7-visual-task",
        name: "task",
        args: { description: "Verify deployment contracts" },
      },
    ],
    invalid_tool_calls: [],
    tool_call_chunks: [],
  };
  return [
    `event: metadata\ndata: ${JSON.stringify({ run_id: RUN_ID, thread_id: STREAM_THREAD_ID })}\n\n`,
    `event: values\ndata: ${JSON.stringify({ messages: [human] })}\n\n`,
    `event: messages\ndata: ${JSON.stringify([chunk, {}])}\n\n`,
  ];
}

async function startHeldStream() {
  const server = createServer((request, response) => {
    response.writeHead(200, {
      "Access-Control-Allow-Origin": request.headers.origin ?? "*",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Expose-Headers": "Content-Location",
      "Cache-Control": "no-cache",
      "Content-Type": "text/event-stream",
      "Content-Location": `/api/threads/${STREAM_THREAD_ID}/runs/${RUN_ID}`,
    });
    response.write(heldStreamingFrames().join(""));
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}/runs/stream`,
    async close() {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}

test("empty chat", async ({ page }) => {
  await prepare(page);
  await page.route("**/api/models", async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        models: [
          {
            id: "minimax-m3",
            name: "minimax-m3",
            model: "MiniMax-M3",
            display_name: "MiniMax CN / MiniMax-M3",
            supports_thinking: true,
            supports_reasoning_effort: true,
          },
        ],
        token_usage: { enabled: false },
      }),
    });
  });
  await page.goto("/workspace/chats/new");
  await expect(page.getByPlaceholder(/how can i assist you/i)).toBeVisible();
  await expect(page.locator('[data-effect="aurora-text"]')).toBeVisible();
  await expect(page.locator('[data-effect="confetti-button"]')).toBeVisible();
  const suggestions = page.getByTestId("welcome-suggestions");
  await expect(suggestions.getByRole("button")).toHaveText([
    "Surprise",
    "Write",
    "Research",
    "Collect",
    "Learn",
    "Create",
  ]);
  await expect(page.locator('[data-slot="suggestions-list"]')).toHaveCount(1);
  // Staggered entrance transforms are finite; compare the settled geometry.
  await expect
    .poll(async () => {
      const tops = await suggestions
        .getByRole("button")
        .evaluateAll((buttons) =>
          buttons.map((button) => button.getBoundingClientRect().top),
        );
      return Math.max(...tops) - Math.min(...tops);
    })
    .toBeLessThan(2);
  const suggestionCenterOffset = await suggestions.evaluate((element) => {
    const row = element.getBoundingClientRect();
    const composerRoot = element.parentElement!.getBoundingClientRect();
    return Math.abs(
      row.left + row.width / 2 - (composerRoot.left + composerRoot.width / 2),
    );
  });
  expect(suggestionCenterOffset).toBeLessThan(1);
  const modelButton = page.getByRole("button", {
    name: "MiniMax CN / MiniMax-M3",
  });
  await expect(modelButton).toBeVisible();
  const modelGeometry = await modelButton.evaluate((element) => ({
    clientWidth: element.clientWidth,
    maxWidth: getComputedStyle(element).maxWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(modelGeometry.maxWidth).toBe("224px");
  /*
    这个下限只是「按钮没有被压扁」的粗判据，真正的保证是下面那条
    `scrollWidth <= clientWidth`（名字没被截断）。

    数字降过两次，两次都是**同一行里别的控件变宽**把它挤窄的，不是它自己被压扁：
    - 160 → 150：wave 1 为了对齐 React 把模型触发器外面那层容器去掉了
      （行内块的行盒会多出几个 px），按钮窄了 5px，实测 155。
    - 150 → 144：wave 28 给模式触发器补上了上游的档位图标（`size-3` + `gap-1`，
      input-box.tsx:2393），同一行于是又紧了一档，实测 **150**。
    改这个数字之前先看下面那条断言过没过：过了就是「行里挤了点」，没过才是真被截断。
  */
  expect(modelGeometry.clientWidth).toBeGreaterThan(144);
  expect(modelGeometry.scrollWidth).toBeLessThanOrEqual(
    modelGeometry.clientWidth,
  );
  await snapshot(page, "empty-chat.png");

  const composer = page.getByPlaceholder(/how can i assist you/i);
  await page.getByRole("button", { name: "Research", exact: true }).click();
  await expect(composer).toHaveValue(enUS.inputBox.suggestions[1]!.prompt);
  await expect(page).toHaveURL(/\/workspace\/chats\/new$/);
  await expect
    .poll(() =>
      composer.evaluate((element: HTMLTextAreaElement) =>
        element.value.slice(element.selectionStart, element.selectionEnd),
      ),
    )
    .toBe("[topic]");

  await composer.fill("");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.getByRole("menuitem")).toHaveText([
    "Webpage",
    "Image",
    "Video",
    "Skill",
  ]);
  await page.getByRole("menuitem", { name: "Webpage", exact: true }).click();
  await expect(composer).toHaveValue(
    (enUS.inputBox.suggestionsCreate[0] as { prompt: string }).prompt,
  );
  await expect(page).toHaveURL(/\/workspace\/chats\/new$/);
  await expect
    .poll(() =>
      composer.evaluate((element: HTMLTextAreaElement) =>
        element.value.slice(element.selectionStart, element.selectionEnd),
      ),
    )
    .toBe("[topic]");

  await composer.fill("");
  await page.getByLabel(enUS.inputBox.uploadFiles).setInputFiles({
    name: "cat.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2n0AAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  const composerSurface = page.getByTestId("composer-surface");
  const attachment = composerSurface.getByTestId("composer-attachment");
  await expect(attachment).toContainText("cat.png");
  await expect(attachment.getByRole("img", { name: "cat.png" })).toBeVisible();
  const attachmentGeometry = await attachment.evaluate((element) => {
    const item = element.getBoundingClientRect();
    const surface = element
      .closest<HTMLElement>("[data-testid='composer-surface']")!
      .getBoundingClientRect();
    return {
      height: item.height,
      inside:
        item.top >= surface.top &&
        item.right <= surface.right &&
        item.bottom <= surface.bottom &&
        item.left >= surface.left,
    };
  });
  expect(attachmentGeometry).toEqual({ height: 32, inside: true });
  await composer.focus();
  await expect
    .poll(() =>
      composer.evaluate((element) => {
        const surface = element.closest<HTMLElement>(
          "[data-testid='composer-surface']",
        )!;
        return getComputedStyle(surface).boxShadow;
      }),
    )
    .toMatch(/0px 0px 0px 3px/);
  await expect
    .poll(() =>
      composer.evaluate((element) => getComputedStyle(element).outlineStyle),
    )
    .toBe("none");
  await snapshot(page, "empty-chat-attachment.png", {
    preserveFocus: true,
  });

  await attachment.hover();
  await expect(page.getByText("image/png", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Remove cat.png" }).click();
  await expect(attachment).toHaveCount(0);
});

test("streaming message", async ({ page }) => {
  const stream = await startHeldStream();
  await prepare(page, {
    threads: [
      {
        thread_id: STREAM_THREAD_ID,
        title: "Production readiness",
        messages: [],
      },
    ],
  });
  await page.route("**/api/langgraph/threads/*/runs/stream", (route) =>
    route.continue({ url: stream.url }),
  );
  try {
    await page.goto(`/workspace/chats/${STREAM_THREAD_ID}`);
    const composer = page.getByPlaceholder(/how can i assist you/i);
    await composer.fill("Prepare a production readiness plan");
    await composer.press("Enter");
    await expect(
      page.getByText("Drafting the production readiness plan…"),
    ).toBeVisible();
    await expect(page.locator('[data-effect="shine-border"]')).toBeVisible();
    await snapshot(page, "streaming-message.png");
  } finally {
    await stream.close();
  }
});

test("reasoning and tool state", async ({ page }) => {
  await prepare(page, {
    threads: [
      {
        thread_id: REASONING_THREAD_ID,
        title: "Reasoning and tools",
        messages: [
          {
            type: "human",
            id: "reasoning-human",
            content: "Inspect the deployment",
          },
          {
            type: "ai",
            id: "reasoning-ai",
            content: "The deployment contract is internally consistent.",
            additional_kwargs: {
              reasoning_content: "I checked the proxy and cookie boundaries.",
            },
            tool_calls: [
              {
                id: "reasoning-tool",
                name: "read_file",
                args: { path: "docker/nginx/nginx.conf" },
              },
            ],
          },
          {
            type: "tool",
            id: "reasoning-tool-result",
            name: "read_file",
            tool_call_id: "reasoning-tool",
            content: "nginx configuration verified",
          },
        ],
      },
    ],
  });
  await page.goto(`/workspace/chats/${REASONING_THREAD_ID}`);
  await expect(
    page.getByText("The deployment contract is internally consistent."),
  ).toBeVisible();
  await snapshot(page, "reasoning-tool.png");
});

test("artifact panel", async ({ page }) => {
  await prepare(page, {
    threads: [
      {
        thread_id: ARTIFACT_THREAD_ID,
        title: "Artifact preview",
        messages: [
          {
            type: "human",
            id: "artifact-human",
            content: "Create a release report",
          },
          {
            type: "ai",
            id: "artifact-ai",
            content: "",
            tool_calls: [
              {
                id: "artifact-write",
                name: "write_file",
                args: {
                  path: ARTIFACT_PATH,
                  content:
                    "<!doctype html><html><body><h1>M7 release report</h1><p>Production gates are measured.</p></body></html>",
                },
              },
            ],
          },
        ],
      },
    ],
  });
  await page.goto(`/workspace/chats/${ARTIFACT_THREAD_ID}`);
  await page.getByText(ARTIFACT_PATH).click();
  await expect(page.locator("#artifacts")).toBeVisible();
  await snapshot(page, "artifact.png");
});

test("settings dialog", async ({ page }) => {
  await prepare(page);
  await page.goto("/workspace/chats/new");
  const sidebar = page.locator("[data-sidebar='sidebar']");
  await sidebar.getByRole("button", { name: /Settings and more/ }).click();
  await page.getByRole("menuitem", { name: "Settings" }).click();
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
  await snapshot(page, "settings.png");
});

test("mobile workspace", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await prepare(page);
  await page.goto("/workspace/chats/new");
  await expect(page.getByPlaceholder(/how can i assist you/i)).toBeVisible();
  await snapshot(page, "mobile.png");
});

test("dark mode", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("theme", "dark"));
  await prepare(page);
  await page.goto("/workspace/chats/new");
  await expect(page.locator("html")).toHaveClass(/dark/);
  // The theme bootstrap runs before hydration; a dark root alone can be an empty page.
  await expect(page.getByPlaceholder(/how can i assist you/i)).toBeVisible();
  await expect(page.getByTestId("welcome-suggestions")).toBeVisible();
  await snapshot(page, "dark-mode.png");
});

test("zh-CN dark settings", async ({ page }) => {
  await page.context().addCookies([
    {
      name: "locale",
      value: "zh-CN",
      url: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3109",
    },
  ]);
  await page.addInitScript(() => localStorage.setItem("theme", "dark"));
  await prepare(page);
  await page.goto("/workspace/chats/new?settings=appearance");
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(
    page.getByRole("dialog", { name: zhCN.settings.title }),
  ).toContainText(zhCN.settings.appearance.languageDescription);
  await snapshot(page, "settings-zh-cn-dark.png");
});
