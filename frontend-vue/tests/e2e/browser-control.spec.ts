/*
  【文件职责】     以 Vue 自有 DOM 固定browser live/static、输入 wire 与 REST 恢复路径。
  【架构位置】     测试
  【主要导出】     Playwright Vue browser-control scenarios
  【依赖关系】     frontend shared mock API · Playwright WebSocketRoute · Vue BrowserPanel
  【边界与注意】   Mock Gateway/WS 证明浏览器接线；真实握手、权限与 Chromium runtime 由 M6 real gate 证明。
*/

import {
  expect,
  test,
  type Locator,
  type Page,
  type WebSocketRoute,
} from "@playwright/test";

import { mockLangGraphAPI, MOCK_THREAD_ID } from "./utils/mock-api";

const STATIC_SCREENSHOT =
  "/mnt/user-data/outputs/.browser-frames/browser-static.svg";
const SVG_FRAME =
  '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400"><rect width="800" height="400" fill="#17324d"/></svg>';

async function prepareBrowser(page: Page) {
  mockLangGraphAPI(page, {
    threads: [
      {
        thread_id: MOCK_THREAD_ID,
        title: "Browser control",
        messages: [
          {
            type: "tool",
            id: "tool-browser-view",
            content: "browser snapshot",
            additional_kwargs: {
              browser_view: {
                screenshot: STATIC_SCREENSHOT,
                url: "https://static.example/start",
                title: "Static title",
              },
            },
          },
        ],
      },
    ],
    features: { browserControlEnabled: true },
  });
  await page.route("**/api/threads/*/artifacts/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: SVG_FRAME,
    }),
  );

  const clientMessages: Array<Record<string, unknown>> = [];
  const sockets: WebSocketRoute[] = [];
  let closed = 0;
  await page.routeWebSocket(
    /\/api\/threads\/[^/]+\/browser\/stream/,
    (socket) => {
      sockets.push(socket);
      socket.onMessage((message) => {
        if (typeof message === "string") {
          clientMessages.push(JSON.parse(message) as Record<string, unknown>);
        }
      });
      socket.onClose(() => {
        closed += 1;
      });
      socket.send(
        JSON.stringify({ type: "url", url: "https://gateway.example/final" }),
      );
      socket.send(
        JSON.stringify({
          type: "tabs",
          tabs: [
            {
              index: 0,
              title: "Gateway title",
              url: "https://gateway.example/final",
              active: true,
            },
          ],
        }),
      );
    },
  );
  return {
    clientMessages,
    sockets,
    closed: () => closed,
  };
}

async function waitForStableBoundingBox(locator: Locator) {
  let previous = "";
  let stableSamples = 0;
  await expect
    .poll(
      async () => {
        const box = await locator.boundingBox();
        if (!box) {
          previous = "";
          stableSamples = 0;
          return false;
        }
        const signature = [box.x, box.y, box.width, box.height]
          .map((value) => value.toFixed(1))
          .join(":");
        stableSamples = signature === previous ? stableSamples + 1 : 0;
        previous = signature;
        return stableSamples >= 2;
      },
      { intervals: [50, 100, 100] },
    )
    .toBe(true);

  const box = await locator.boundingBox();
  if (!box) throw new Error("Browser image has no stable bounding box.");
  return box;
}

test.describe("Vue browser control", () => {
  test("auto-opens the newest static frame and converges URL/title from live Gateway state", async ({
    page,
  }) => {
    const browser = await prepareBrowser(page);
    await page.goto(`/workspace/chats/${MOCK_THREAD_ID}`);

    const panel = page.getByTestId("browser-panel");
    await expect(panel).toBeVisible({ timeout: 15_000 });
    await expect(panel.getByTestId("browser-mode")).toHaveText("Live");
    /*
      头部不再画页面标题：上游那一格是写死的面板标签，Gateway 报上来的标题只走
      `<img alt>`，而且取的是**静态帧**的标题（上游 `alt={frame?.title ?? …}`），
      不是 live 标题——所以这里是 "Static title" 而不是 "Gateway title"。
    */
    await expect(panel.getByTestId("browser-mode")).toHaveAttribute(
      "data-variant",
      "default",
    );
    await expect(panel.locator("header")).not.toContainText("Gateway title");
    await expect(
      panel.getByPlaceholder("Enter a URL and press Enter"),
    ).toHaveValue("https://gateway.example/final");
    await expect(
      panel.getByRole("img", { name: "Static title" }),
    ).toBeVisible();

    await panel
      .getByPlaceholder("Enter a URL and press Enter")
      .fill("next.example/path");
    await panel.getByPlaceholder("Enter a URL and press Enter").press("Enter");
    await expect
      .poll(() =>
        browser.clientMessages.filter((item) => item.type === "navigate"),
      )
      .toEqual([{ type: "navigate", url: "https://next.example/path" }]);
  });

  test("maps pointer/wheel and forwards keydown once while preserving local IME", async ({
    page,
  }) => {
    const browser = await prepareBrowser(page);
    await page.goto(`/workspace/chats/${MOCK_THREAD_ID}`);
    const panel = page.getByTestId("browser-panel");
    await expect(panel.getByTestId("browser-mode")).toHaveText("Live");
    const image = panel.getByRole("img", { name: "Static title" });
    await expect
      .poll(() =>
        image.evaluate((element) => (element as HTMLImageElement).naturalWidth),
      )
      .toBe(800);
    const box = await waitForStableBoundingBox(image);
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;

    await page.mouse.click(box.x + 2, box.y + 2);
    await page.mouse.click(centerX, centerY);
    await page.mouse.move(centerX + 8, centerY + 4);
    await page.mouse.wheel(4, 8);
    await panel.focus();
    await page.keyboard.press("a");
    await panel.evaluate((element) => {
      element.dispatchEvent(
        new CompositionEvent("compositionstart", { bubbles: true }),
      );
      element.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          key: "Enter",
          isComposing: true,
        }),
      );
      element.dispatchEvent(
        new CompositionEvent("compositionend", { bubbles: true, data: "你" }),
      );
    });

    await expect
      .poll(() => browser.clientMessages.some((item) => item.type === "wheel"))
      .toBe(true);
    const clicks = browser.clientMessages.filter(
      (item) => item.type === "click",
    );
    expect(clicks).toHaveLength(1);
    expect(clicks[0]?.nx).toBeCloseTo(0.5, 1);
    expect(clicks[0]?.ny).toBeCloseTo(0.5, 1);
    // Current React forwards click/wheel/key input; pointer motion is local.
    expect(
      browser.clientMessages.filter((item) => item.type === "move"),
    ).toHaveLength(0);
    expect(
      browser.clientMessages.filter(
        (item) => item.type === "text" && item.text === "a",
      ),
    ).toHaveLength(1);
    await page.keyboard.press("ArrowRight");
    await expect
      .poll(() => browser.clientMessages.at(-1))
      .toEqual({ type: "key", key: "ArrowRight" });
    expect(
      browser.clientMessages.filter((item) => item.type === "text"),
    ).toEqual([{ type: "text", text: "a" }]);
    expect(
      browser.clientMessages.filter(
        (item) => item.type === "key" && item.key === "Enter",
      ),
    ).toHaveLength(0);
  });

  test("uses authoritative REST results in Static mode and keeps failed navigation retryable", async ({
    page,
  }) => {
    const browser = await prepareBrowser(page);
    const requests: unknown[] = [];
    let navigationAttempt = 0;
    await page.route("**/api/threads/*/browser/navigate", async (route) => {
      requests.push(route.request().postDataJSON());
      navigationAttempt += 1;
      if (navigationAttempt === 1) {
        await route.fulfill({
          status: 502,
          contentType: "application/json",
          body: JSON.stringify({ detail: "Browser navigation failed" }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          screenshot: "/mnt/user-data/outputs/.browser-frames/browser-rest.svg",
          url: "https://rest.example/final",
          title: "REST title",
        }),
      });
    });

    await page.goto(`/workspace/chats/${MOCK_THREAD_ID}`);
    const panel = page.getByTestId("browser-panel");
    await expect(panel.getByTestId("browser-mode")).toHaveText("Live");
    await panel.getByTitle("Stop live control").click();
    // 两态：文案恒为 Live，静态态靠 variant 与 title 区分（上游同形）。
    await expect(panel.getByTestId("browser-mode")).toHaveText("Live");
    await expect(panel.getByTestId("browser-mode")).toHaveAttribute(
      "data-variant",
      "ghost",
    );
    await expect(panel.getByTitle("Take live control")).toBeVisible();
    await expect.poll(browser.closed).toBe(1);

    await panel
      .getByPlaceholder("Enter a URL and press Enter")
      .fill("https://fallback.example");
    await panel.getByPlaceholder("Enter a URL and press Enter").press("Enter");
    await expect(
      page.getByText("Browser navigation failed", { exact: true }),
    ).toBeVisible();
    await panel.getByPlaceholder("Enter a URL and press Enter").press("Enter");
    await expect(panel.getByRole("img", { name: "REST title" })).toBeVisible();
    await expect(
      panel.getByPlaceholder("Enter a URL and press Enter"),
    ).toHaveValue("https://rest.example/final");
    expect(requests).toEqual([
      { url: "https://fallback.example" },
      { url: "https://fallback.example" },
    ]);
    await panel.getByLabel("Close browser").click();
    await expect(panel).toHaveCount(0);
  });
});
