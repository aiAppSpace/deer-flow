import { expect, test, type Page, type Route } from "@playwright/test";

import {
  mockLangGraphAPI,
  MOCK_SIDECAR_THREAD_ID,
  MOCK_THREAD_ID,
  MOCK_THREAD_ID_2,
} from "./utils/mock-api";

function textFromContent(content: unknown) {
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .map((part) =>
      typeof part === "object" &&
      part !== null &&
      "text" in part &&
      typeof part.text === "string"
        ? part.text
        : "",
    )
    .join("");
}

async function selectTextOnPage(
  page: Page,
  text: string,
  scopeTestId = "main-message-list",
) {
  await page.evaluate(
    ({ targetText, scopeTestId }) => {
      window.getSelection()?.removeAllRanges();
      const root =
        document.querySelector(`[data-testid="${scopeTestId}"]`) ??
        document.body;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        const value = node.textContent ?? "";
        const start = value.indexOf(targetText);
        if (start >= 0) {
          const range = document.createRange();
          range.setStart(node, start);
          range.setEnd(node, start + targetText.length);
          const selection = window.getSelection();
          selection?.removeAllRanges();
          selection?.addRange(range);
          const rect = range.getBoundingClientRect();
          node.parentElement?.dispatchEvent(
            new MouseEvent("mouseup", {
              bubbles: true,
              clientX: rect.left + rect.width / 2,
              clientY: rect.top + rect.height / 2,
            }),
          );
          return;
        }
        node = walker.nextNode();
      }
      throw new Error(`Unable to find text: ${targetText}`);
    },
    { targetText: text, scopeTestId },
  );
  await expect(page.locator("[data-sidecar-selection-toolbar]")).toBeVisible();
}

async function clickSelectionToolbarButton(page: Page, label: string) {
  const clicked = await page.evaluate((buttonLabel) => {
    const button = Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        "[data-sidecar-selection-toolbar] button",
      ),
    ).find((candidate) =>
      candidate.textContent?.toLowerCase().includes(buttonLabel.toLowerCase()),
    );
    if (button?.offsetParent == null) {
      return false;
    }
    button.click();
    return true;
  }, label);
  expect(clicked).toBe(true);
}

async function selectTextAndClickToolbarButton(
  page: Page,
  text: string,
  label: string,
  scopeTestId?: string,
) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await selectTextOnPage(page, text, scopeTestId);
      await clickSelectionToolbarButton(page, label);
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

async function expectSidecarSelectionToolbarActions(page: Page, text: string) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await selectTextOnPage(page, text, "sidecar-message-list");
      const labels = await page.evaluate(() =>
        Array.from(
          document.querySelectorAll<HTMLButtonElement>(
            "[data-sidecar-selection-toolbar] button",
          ),
        ).map((button) => button.textContent?.trim() ?? ""),
      );
      expect(labels.some((label) => /add to conversation/i.test(label))).toBe(
        true,
      );
      expect(labels.some((label) => /ask in side chat/i.test(label))).toBe(
        false,
      );
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

/*
  侧栏面板由 splitpanes 驱动，`.splitpanes--ready .splitpanes__pane` 带
  `transition: width .2s ease-out`——面板刚打开的那 200ms 里 form 只有几十像素宽，
  工具条里的按钮全被 flex 压扁并溢出。

  在此之前这里不需要等：sidecar 面板自己**又发了一次 `GET /api/models`**，
  「等模型名出现」这一步顺带把动画等完了。那次重复请求已经修掉（改走共享的
  useModels，与 AgentChat 同一份 Vue Query 缓存），模型名于是第一帧就在，
  这几个几何断言就直接量在动画中间。

  所以要等的是**布局本身**，不是某个控件出现。连续两次量到同一个宽度才算停。
*/
async function waitForSidecarPaneSettled(page: Page) {
  let previous = -1;
  await expect
    .poll(
      async () => {
        const width = await page.evaluate(() => {
          const textarea = Array.from(
            document.querySelectorAll("textarea"),
          ).find((element) =>
            /deeper follow-up/i.test(element.getAttribute("placeholder") ?? ""),
          );
          const form = textarea?.closest("form");
          return form ? Math.round(form.getBoundingClientRect().width) : -1;
        });
        const settled = width > 0 && width === previous;
        previous = width;
        return settled;
      },
      { intervals: [100] },
    )
    .toBe(true);
}

async function expectComposerHeightsEqual(page: Page) {
  await waitForSidecarPaneSettled(page);
  const metrics = await page.evaluate(() => {
    const findFormByPlaceholder = (pattern: RegExp) => {
      const textarea = Array.from(document.querySelectorAll("textarea")).find(
        (element) => pattern.test(element.getAttribute("placeholder") ?? ""),
      );
      const form = textarea?.closest("form");
      if (!form) {
        return null;
      }
      const box = form.getBoundingClientRect();
      return {
        height: Math.round(box.height),
        bottomGap: Math.round(window.innerHeight - box.bottom),
      };
    };

    return {
      main: findFormByPlaceholder(/how can i assist you/i),
      sidecar: findFormByPlaceholder(/deeper follow-up/i),
    };
  });

  expect(metrics.main).not.toBeNull();
  expect(metrics.sidecar).not.toBeNull();
  expect(metrics.sidecar?.height).toBe(metrics.main?.height);
  expect(metrics.sidecar?.bottomGap).toBe(metrics.main?.bottomGap);
}

async function expectSidecarModelPinnedToSubmit(page: Page) {
  await waitForSidecarPaneSettled(page);
  const metrics = await page.evaluate(() => {
    const getComposerMetrics = (placeholderPattern: RegExp) => {
      const textarea = Array.from(document.querySelectorAll("textarea")).find(
        (element) =>
          placeholderPattern.test(element.getAttribute("placeholder") ?? ""),
      );
      const form = textarea?.closest("form");
      if (!form) {
        return null;
      }
      const formBox = form.getBoundingClientRect();
      const buttons = Array.from(form.querySelectorAll("button")).map(
        (button) => {
          const box = button.getBoundingClientRect();
          const text = button.textContent?.trim();
          return {
            label: text ? text : (button.getAttribute("aria-label") ?? ""),
            left: Math.round(box.left),
            right: Math.round(box.right),
          };
        },
      );
      const model = buttons.find(
        (button) => button.label === "DeepSeek V4 Pro",
      );
      const submit = buttons.find((button) => button.label === "Submit");

      return {
        formLeft: Math.round(formBox.left),
        formRight: Math.round(formBox.right),
        mode: buttons.find((button) => button.label === "Pro"),
        model,
        submit,
        gap: model && submit ? submit.left - model.right : null,
        overflows: buttons.some(
          (button) =>
            button.left < Math.round(formBox.left) ||
            button.right > Math.round(formBox.right),
        ),
      };
    };

    return {
      main: getComposerMetrics(/how can i assist you/i),
      sidecar: getComposerMetrics(/deeper follow-up/i),
    };
  });

  const main = metrics?.main;
  const sidecar = metrics?.sidecar;
  const mainModel = main?.model;
  const mainSubmit = main?.submit;
  const sidecarMode = sidecar?.mode;
  const sidecarModel = sidecar?.model;
  const sidecarSubmit = sidecar?.submit;

  if (
    !main ||
    !sidecar ||
    !mainModel ||
    !mainSubmit ||
    !sidecarMode ||
    !sidecarModel ||
    !sidecarSubmit
  ) {
    throw new Error("Unable to measure composer model and submit controls.");
  }

  expect(sidecarModel.left).toBeGreaterThan(sidecarMode.right);
  expect(sidecar.gap).toBe(main.gap);
  expect(sidecarModel.left).toBeGreaterThanOrEqual(sidecar.formLeft);
  expect(sidecarSubmit.right).toBeLessThanOrEqual(sidecar.formRight);
  expect(sidecar.overflows).toBe(false);
}

async function expectSidecarModelHiddenWhenCompact(page: Page) {
  await waitForSidecarPaneSettled(page);
  const metrics = await page.evaluate(() => {
    const sideTextarea = Array.from(document.querySelectorAll("textarea")).find(
      (element) =>
        /deeper follow-up/i.test(element.getAttribute("placeholder") ?? ""),
    );
    const form = sideTextarea?.closest("form");
    if (!form) {
      return null;
    }

    const formBox = form.getBoundingClientRect();
    const visibleButtons = Array.from(form.querySelectorAll("button"))
      .map((button) => {
        const box = button.getBoundingClientRect();
        const styles = window.getComputedStyle(button);
        const visible =
          styles.display !== "none" &&
          styles.visibility !== "hidden" &&
          box.width > 0 &&
          box.height > 0;
        const text = button.textContent?.trim();
        return {
          label: text ? text : (button.getAttribute("aria-label") ?? ""),
          left: Math.round(box.left),
          right: Math.round(box.right),
          visible,
        };
      })
      .filter((button) => button.visible);

    return {
      formLeft: Math.round(formBox.left),
      formRight: Math.round(formBox.right),
      labels: visibleButtons.map((button) => button.label),
      overflows: visibleButtons.some(
        (button) =>
          button.left < Math.round(formBox.left) ||
          button.right > Math.round(formBox.right),
      ),
    };
  });

  expect(metrics).not.toBeNull();
  expect(metrics!.labels).toContain("Pro");
  expect(metrics!.labels).toContain("Submit");
  expect(metrics!.labels).not.toContain("DeepSeek V4 Pro");
  expect(metrics!.overflows).toBe(false);
}

async function expectSidecarScrollDoesNotAnimateAfterOpen(page: Page) {
  await page.waitForFunction(() => {
    const root = document.querySelector('[data-testid="sidecar-message-list"]');
    const scrollElement = root?.firstElementChild;
    if (!(scrollElement instanceof HTMLElement)) {
      return false;
    }
    return (
      scrollElement.scrollHeight > scrollElement.clientHeight &&
      scrollElement.scrollTop > 0
    );
  });

  const firstScrollTop = await page.evaluate(() => {
    const root = document.querySelector('[data-testid="sidecar-message-list"]');
    const scrollElement = root?.firstElementChild;
    if (!(scrollElement instanceof HTMLElement)) {
      throw new Error("Sidecar scroll container was not found.");
    }
    return Math.round(scrollElement.scrollTop);
  });

  await page.waitForTimeout(220);

  const secondScrollTop = await page.evaluate(() => {
    const root = document.querySelector('[data-testid="sidecar-message-list"]');
    const scrollElement = root?.firstElementChild;
    if (!(scrollElement instanceof HTMLElement)) {
      throw new Error("Sidecar scroll container was not found.");
    }
    return Math.round(scrollElement.scrollTop);
  });

  expect(secondScrollTop).toBe(firstScrollTop);
}

async function openSidecarAndExpectNoAnimatedScroll(page: Page) {
  await page.evaluate(() => {
    const targetWindow = window as Window & {
      __sidecarPanelTransforms?: string[];
    };
    targetWindow.__sidecarPanelTransforms = [];
  });

  await page.getByTestId("sidecar-header-trigger").click();
  await expect(page.getByTestId("sidecar-message-list")).toBeVisible();
  for (let index = 0; index < 20; index += 1) {
    await page.waitForTimeout(25);
    await page.evaluate(() => {
      const targetWindow = window as Window & {
        __sidecarPanelTransforms?: string[];
      };
      const panel = document.querySelector('[data-testid="sidecar-panel"]');
      const shell = panel?.parentElement;
      if (shell) {
        targetWindow.__sidecarPanelTransforms?.push(
          window.getComputedStyle(shell).transform,
        );
      }
    });
  }

  const { panelTransforms, scrollBehavior } = await page.evaluate(() => {
    const targetWindow = window as Window & {
      __sidecarPanelTransforms?: string[];
    };
    const root = document.querySelector('[data-testid="sidecar-message-list"]');
    const scrollElement = root?.firstElementChild;
    if (!(scrollElement instanceof HTMLElement)) {
      throw new Error("Sidecar scroll container was not found.");
    }
    return {
      panelTransforms: targetWindow.__sidecarPanelTransforms ?? [],
      scrollBehavior: window.getComputedStyle(scrollElement).scrollBehavior,
    };
  });

  expect(scrollBehavior).toBe("auto");
  expect(
    panelTransforms.every(
      (transform) =>
        transform === "none" || transform === "matrix(1, 0, 0, 1, 0, 0)",
    ),
  ).toBe(true);
}

test.describe("Side chat", () => {
  test("creates a hidden sidecar thread from selected quoted text", async ({
    page,
  }) => {
    const parentMessages = [
      {
        type: "human",
        id: "parent-human-1",
        content: [{ type: "text", text: "Plan the feature." }],
      },
      {
        type: "ai",
        id: "parent-ai-1",
        content:
          "Build it as a side conversation. Keep the cited snippets compact.",
      },
    ];
    let createdThreadBody: { metadata?: Record<string, unknown> } | undefined;
    let sidecarThreadCreateCount = 0;
    let streamBody:
      | {
          input?: {
            messages?: Array<{
              type?: string;
              content?: unknown;
              additional_kwargs?: Record<string, unknown>;
            }>;
          };
          context?: Record<string, unknown>;
        }
      | undefined;
    let sidecarThreadMessages: Array<{
      type?: string;
      id?: string;
      name?: string;
      content?: unknown;
      additional_kwargs?: Record<string, unknown>;
      artifact?: Record<string, unknown>;
    }> = [];

    mockLangGraphAPI(page, {
      threads: [
        {
          thread_id: MOCK_THREAD_ID,
          title: "Main conversation",
          messages: parentMessages,
        },
        {
          thread_id: MOCK_THREAD_ID_2,
          title: "Second conversation",
          messages: [
            {
              type: "human",
              id: "second-human-1",
              content: "Switch target.",
            },
          ],
        },
      ],
    });
    await page.route("**/api/models", (route) => {
      if (route.request().method() !== "GET") {
        return route.fallback();
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          models: [
            {
              id: "deepseek-v4-pro",
              name: "deepseek-v4-pro",
              model: "deepseek-v4-pro",
              display_name: "DeepSeek V4 Pro",
              supports_thinking: true,
              supports_reasoning_effort: true,
            },
            {
              id: "fast-model",
              name: "fast-model",
              model: "fast-model",
              display_name: "Fast Model",
              supports_thinking: false,
              supports_reasoning_effort: false,
            },
          ],
          token_usage: { enabled: false },
        }),
      });
    });

    await page.route("**/api/threads", (route) => {
      if (route.request().method() !== "POST") {
        return route.fallback();
      }
      sidecarThreadCreateCount += 1;
      createdThreadBody = route.request().postDataJSON() as {
        metadata?: Record<string, unknown>;
      };
      return route.fallback();
    });
    await page.route(
      `**/api/langgraph/threads/${MOCK_THREAD_ID}/state`,
      (route) => {
        if (route.request().method() !== "GET") {
          return route.fallback();
        }
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            values: {
              title: "Main conversation",
              messages: parentMessages,
              artifacts: [],
            },
            next: [],
            metadata: {},
            created_at: "2025-01-01T00:00:00Z",
          }),
        });
      },
    );
    await page.route(
      `**/api/langgraph/threads/${MOCK_THREAD_ID}/history`,
      (route) => {
        if (route.request().method() !== "GET") {
          return route.fallback();
        }
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            {
              values: {
                title: "Main conversation",
                messages: parentMessages,
                artifacts: [],
              },
              next: [],
              metadata: {},
              created_at: "2025-01-01T00:00:00Z",
              parent_config: null,
            },
          ]),
        });
      },
    );
    await page.route(
      new RegExp(`/api/langgraph/threads/${MOCK_THREAD_ID}/runs(?:\\?|$)`),
      (route) => {
        if (route.request().method() !== "GET") {
          return route.fallback();
        }
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            {
              run_id: `run-${MOCK_THREAD_ID}`,
              thread_id: MOCK_THREAD_ID,
              assistant_id: "lead_agent",
              status: "success",
              metadata: {},
              kwargs: {},
              created_at: "2025-01-01T00:00:00Z",
              updated_at: "2025-01-01T00:00:00Z",
            },
          ]),
        });
      },
    );
    await page.route(
      new RegExp(`/api/threads/${MOCK_THREAD_ID}/messages/page`),
      (route) => {
        if (route.request().method() !== "GET") {
          return route.fallback();
        }
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: parentMessages.map((message, index) => ({
              run_id: `run-${MOCK_THREAD_ID}`,
              seq: index + 1,
              content: message,
              metadata: { caller: "lead_agent" },
              created_at: `2025-01-01T00:00:${String(index).padStart(2, "0")}Z`,
            })),
            has_more: false,
            next_before_seq: null,
          }),
        });
      },
    );
    await page.route(
      `**/api/langgraph/threads/${MOCK_SIDECAR_THREAD_ID}/state`,
      (route) => {
        if (route.request().method() !== "GET") {
          return route.fallback();
        }
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            values: {
              title: "Side chat",
              messages: sidecarThreadMessages,
              artifacts: [],
            },
            next: [],
            metadata: {},
            created_at: "2025-01-01T00:00:00Z",
          }),
        });
      },
    );
    await page.route(
      `**/api/langgraph/threads/${MOCK_SIDECAR_THREAD_ID}/history`,
      (route) => {
        if (route.request().method() !== "GET") {
          return route.fallback();
        }
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            {
              values: {
                title: "Side chat",
                messages: sidecarThreadMessages,
                artifacts: [],
              },
              next: [],
              metadata: {},
              created_at: "2025-01-01T00:00:00Z",
              parent_config: null,
            },
          ]),
        });
      },
    );
    await page.route(
      new RegExp(
        `/api/langgraph/threads/${MOCK_SIDECAR_THREAD_ID}/runs(?:\\?|$)`,
      ),
      (route) => {
        if (route.request().method() !== "GET") {
          return route.fallback();
        }
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(
            sidecarThreadMessages.length > 0
              ? [
                  {
                    run_id: `run-${MOCK_SIDECAR_THREAD_ID}`,
                    thread_id: MOCK_SIDECAR_THREAD_ID,
                    assistant_id: "lead_agent",
                    status: "success",
                    metadata: {},
                    kwargs: {},
                    created_at: "2025-01-01T00:00:00Z",
                    updated_at: "2025-01-01T00:00:00Z",
                  },
                ]
              : [],
          ),
        });
      },
    );
    await page.route(
      new RegExp(`/api/threads/${MOCK_SIDECAR_THREAD_ID}/messages/page`),
      (route) => {
        if (route.request().method() !== "GET") {
          return route.fallback();
        }
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: sidecarThreadMessages.map((message, index) => ({
              run_id: `run-${MOCK_SIDECAR_THREAD_ID}`,
              seq: index + 1,
              content: message,
              metadata: { caller: "lead_agent" },
              created_at: `2025-01-01T00:00:${String(index).padStart(2, "0")}Z`,
            })),
            has_more: false,
            next_before_seq: null,
          }),
        });
      },
    );
    const fulfillSidecarRunStream = async (route: Route) => {
      const body = route.request().postDataJSON() as typeof streamBody;
      if (body?.input?.messages) {
        streamBody = body;
        const responseMessage = {
          type: "ai",
          id: `msg-ai-sidecar-${sidecarThreadMessages.length}`,
          content: "Hello from DeerFlow!",
        };
        sidecarThreadMessages = [
          ...sidecarThreadMessages,
          ...body.input.messages,
          responseMessage,
        ];
      }
      const events = [
        {
          event: "metadata",
          data: {
            run_id: `run-${MOCK_SIDECAR_THREAD_ID}`,
            thread_id: MOCK_SIDECAR_THREAD_ID,
          },
        },
        {
          event: "values",
          data: {
            messages: sidecarThreadMessages,
          },
        },
        { event: "end", data: {} },
      ];
      return route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        headers: {
          "Content-Location": `/api/threads/${MOCK_SIDECAR_THREAD_ID}/runs/run-${MOCK_SIDECAR_THREAD_ID}`,
          "Access-Control-Expose-Headers": "Content-Location",
        },
        body: events
          .map((event) => {
            return `event: ${event.event}\ndata: ${JSON.stringify(
              event.data,
            )}\n\n`;
          })
          .join(""),
      });
    };
    await page.route(
      "**/api/langgraph/threads/*/runs/stream",
      fulfillSidecarRunStream,
    );
    await page.route("**/api/langgraph/runs/stream", fulfillSidecarRunStream);
    await page.route("**/runs/stream", fulfillSidecarRunStream);

    await page.goto(`/workspace/chats/${MOCK_THREAD_ID}`);
    await expect(
      page.getByText("Build it as a side conversation."),
    ).toBeVisible({ timeout: 15_000 });

    await selectTextAndClickToolbarButton(
      page,
      "Build it as a side conversation.",
      "Add to conversation",
    );
    const quoteAttachment = page.getByTestId("conversation-quote-attachment");
    const mainInputForm = page.locator("form").filter({
      has: page.getByPlaceholder(/how can i assist you/i),
    });
    await expect(quoteAttachment).toBeVisible();
    await expect(
      mainInputForm.getByTestId("conversation-quote-attachment"),
    ).toBeVisible();
    await expect(quoteAttachment).toContainText("1 selected text fragment");
    await selectTextAndClickToolbarButton(
      page,
      "Keep the cited snippets compact.",
      "Add to conversation",
    );
    await expect(quoteAttachment).toContainText("2 selected text fragments");
    await expect(page.locator("textarea[name='message']").first()).toHaveValue(
      "",
    );
    await quoteAttachment
      .getByRole("button", { name: /clear selected references/i })
      .click();
    await expect(quoteAttachment).toBeHidden();

    await selectTextAndClickToolbarButton(
      page,
      "Build it as a side conversation.",
      "Ask in side chat",
    );
    await expect(
      page.getByRole("heading", { name: "Ask a follow-up" }),
    ).toBeVisible();
    // Draft state (no thread created yet): the header shows a plain close (X),
    // not the destructive delete — there is nothing persisted to delete.
    await expect(page.getByTestId("sidecar-close-button")).toBeVisible();
    await expect(page.getByTestId("sidecar-delete-button")).toBeHidden();
    const sidecarReference = page.getByTestId("sidecar-reference-attachment");
    const sidecarInputForm = page.locator("form").filter({
      has: page.getByPlaceholder(/deeper follow-up/i),
    });
    await expect(sidecarReference).toBeVisible();
    await expect(
      sidecarInputForm.getByTestId("sidecar-reference-attachment"),
    ).toBeVisible();
    await expect(sidecarReference).toContainText("1 selected text fragment");
    await expect(
      sidecarInputForm.getByTestId("sidecar-add-attachments-button"),
    ).toBeVisible();
    await expect(
      sidecarInputForm.getByRole("button", { name: "Pro", exact: true }),
    ).toBeVisible();
    await expect(
      sidecarInputForm.getByRole("button", { name: /DeepSeek V4 Pro/i }),
    ).toBeVisible();
    await expectSidecarModelPinnedToSubmit(page);
    const originalViewport = page.viewportSize();
    await page.setViewportSize({
      width: 820,
      height: originalViewport?.height ?? 720,
    });
    await expectSidecarModelHiddenWhenCompact(page);
    await page.setViewportSize(
      originalViewport ?? { width: 1280, height: 720 },
    );
    await expect(
      sidecarInputForm.getByRole("button", { name: /DeepSeek V4 Pro/i }),
    ).toBeVisible();
    await expectSidecarModelPinnedToSubmit(page);
    await sidecarInputForm
      .getByRole("button", { name: "Pro", exact: true })
      .click();
    await page.getByRole("menuitemradio").filter({ hasText: "Flash" }).click();
    await expect(
      sidecarInputForm.getByRole("button", { name: "Flash", exact: true }),
    ).toBeVisible();
    await sidecarInputForm
      .getByRole("button", { name: /DeepSeek V4 Pro/i })
      .click();
    await page.getByText("Fast Model").click();
    await expect(
      sidecarInputForm.getByRole("button", { name: /Fast Model/i }),
    ).toBeVisible();
    const mainInput = page.getByPlaceholder(/how can i assist you/i);
    const sidecarInput = page.getByPlaceholder(/deeper follow-up/i);
    await mainInput.fill("Left draft");
    await expect(sidecarInput).toHaveValue("");
    await sidecarInput.fill("Right draft");
    await expect(mainInput).toHaveValue("Left draft");

    await selectTextAndClickToolbarButton(
      page,
      "Keep the cited snippets compact.",
      "Ask in side chat",
    );
    await expect(sidecarReference).toContainText("2 selected text fragments");
    await selectTextAndClickToolbarButton(
      page,
      "Build it as a side conversation.",
      "Add to conversation",
    );
    await expect(quoteAttachment).toContainText("1 selected text fragment");
    await expectComposerHeightsEqual(page);
    await quoteAttachment
      .getByRole("button", { name: /clear selected references/i })
      .click();
    await expect(quoteAttachment).toBeHidden();

    await sidecarInput.fill("What tradeoffs should we consider?");
    await sidecarInput.press("Enter");

    await expect
      .poll(() => createdThreadBody?.metadata, { timeout: 10_000 })
      .toMatchObject({
        deerflow_sidecar: true,
        parent_thread_id: MOCK_THREAD_ID,
        sidecar_context_type: "referenced_message",
        sidecar_context_label: "Selected assistant text #2",
        referenced_message_id: "parent-ai-1",
        referenced_message_role: "assistant",
        sidecar_context_count: 2,
        referenced_message_ids: ["parent-ai-1", "parent-ai-1"],
        referenced_message_roles: ["assistant", "assistant"],
      });
    expect(sidecarThreadCreateCount).toBe(1);

    await expect
      .poll(() => streamBody?.input?.messages?.length, { timeout: 10_000 })
      .toBe(2);
    /*
      **`thread_id` 不在 context 里**（wave 216 两边同改）：Gateway 的
      `build_run_config` 写着 `context["thread_id"] = thread_id`，取的是 URL
      路径里的那一个，客户端传什么都被当场覆盖。这条 sidecar run 的目标线程
      仍然由 URL 决定，下面那条 `parent_thread_id` 才是真正承载信息的键。
    */
    expect(streamBody?.context).toMatchObject({
      model_name: "fast-model",
      thinking_enabled: false,
      is_plan_mode: false,
      subagent_enabled: false,
      reasoning_effort: "minimal",
    });
    expect(streamBody?.context).not.toHaveProperty("thread_id");

    const messages = streamBody?.input?.messages ?? [];
    expect(messages[0]?.additional_kwargs).toMatchObject({
      hide_from_ui: true,
      sidecar_context: true,
      parent_thread_id: MOCK_THREAD_ID,
    });
    expect(textFromContent(messages[0]?.content)).toContain(
      "You are answering in a side conversation",
    );
    expect(textFromContent(messages[0]?.content)).toContain(
      "<parent_conversation_context",
    );
    expect(textFromContent(messages[0]?.content)).toContain(
      '<parent_message index="1" role="User" message_id="parent-human-1">',
    );
    expect(textFromContent(messages[0]?.content)).toContain(
      "Plan the feature.",
    );
    expect(textFromContent(messages[0]?.content)).toContain(
      '<parent_message index="2" role="Assistant" message_id="parent-ai-1">',
    );
    expect(textFromContent(messages[0]?.content)).toContain(
      '<referenced_message index="1" label="Selected assistant text #2">',
    );
    expect(textFromContent(messages[0]?.content)).toContain(
      "Build it as a side conversation.",
    );
    expect(textFromContent(messages[0]?.content)).toContain(
      'referenced_message index="2"',
    );
    expect(textFromContent(messages[0]?.content)).toContain(
      "Keep the cited snippets compact.",
    );
    expect(textFromContent(messages[1]?.content)).toBe(
      "What tradeoffs should we consider?",
    );
    expect(messages[1]?.additional_kwargs).toMatchObject({
      sidecar_visible_message: true,
      referenced_message_count: 2,
      referenced_message_ids: ["parent-ai-1", "parent-ai-1"],
      referenced_message_roles: ["assistant", "assistant"],
      referenced_message_contexts: [
        {
          label: "Selected assistant text #2",
          message_id: "parent-ai-1",
          role: "assistant",
          content: "Build it as a side conversation.",
        },
        {
          label: "Selected assistant text #2",
          message_id: "parent-ai-1",
          role: "assistant",
          content: "Keep the cited snippets compact.",
        },
      ],
    });

    await expect(sidecarInput).toHaveValue("");
    await expect(sidecarReference).toBeHidden();
    await expectComposerHeightsEqual(page);
    await expect(page.getByTestId("sidecar-header-trigger")).toBeVisible();

    // Hiding the side chat is owned by the header trigger; the panel's own
    // button deletes the side chat instead of hiding it.
    await expect(
      page.getByTestId("sidecar-header-trigger"),
    ).toHaveAccessibleName("Close side chat");
    await page.getByTestId("sidecar-header-trigger").click();
    await expect(page.getByTestId("sidecar-panel")).toBeHidden();
    await expect(
      page.getByTestId("sidecar-header-trigger"),
    ).toHaveAccessibleName("Open side chat");
    await page.getByTestId("sidecar-header-trigger").click();
    await expect(page.getByTestId("sidecar-panel")).toBeVisible();

    await expect(
      page
        .getByTestId("sidecar-message-list")
        .getByText("Hello from DeerFlow!")
        .first(),
    ).toBeVisible();

    // Selecting text inside the side chat itself only offers "Add to
    // conversation" (no "Ask in side chat"), and the snippet attaches to the
    // side chat's own composer rather than the main composer's quotes.
    await expectSidecarSelectionToolbarActions(page, "Hello from DeerFlow!");
    await selectTextAndClickToolbarButton(
      page,
      "Hello from DeerFlow!",
      "Add to conversation",
      "sidecar-message-list",
    );
    await expect(sidecarReference).toContainText("1 selected text fragment");
    await expect(
      mainInputForm.getByTestId("conversation-quote-attachment"),
    ).toBeHidden();

    await sidecarInput.fill("What did the side answer say?");
    await sidecarInput.press("Enter");
    await expect
      .poll(
        () => textFromContent(streamBody?.input?.messages?.at(1)?.content),
        { timeout: 10_000 },
      )
      .toBe("What did the side answer say?");

    const sidecarSelectionMessages = streamBody?.input?.messages ?? [];
    expect(textFromContent(sidecarSelectionMessages[0]?.content)).toContain(
      '<referenced_message index="1"',
    );
    expect(textFromContent(sidecarSelectionMessages[0]?.content)).toContain(
      "Hello from DeerFlow!",
    );
    expect(sidecarSelectionMessages[1]?.additional_kwargs).toMatchObject({
      sidecar_visible_message: true,
      referenced_message_count: 1,
      referenced_message_ids: ["msg-ai-sidecar-0"],
      referenced_message_roles: ["assistant"],
      referenced_message_contexts: [
        {
          message_id: "msg-ai-sidecar-0",
          role: "assistant",
          content: "Hello from DeerFlow!",
        },
      ],
    });
    await expect(sidecarReference).toBeHidden();

    await sidecarInput.fill("Can you continue with the left context?");
    await sidecarInput.press("Enter");
    await expect
      .poll(
        () => textFromContent(streamBody?.input?.messages?.at(1)?.content),
        { timeout: 10_000 },
      )
      .toBe("Can you continue with the left context?");

    const followUpMessages = streamBody?.input?.messages ?? [];
    expect(textFromContent(followUpMessages[0]?.content)).toContain(
      "<parent_conversation_context",
    );
    expect(textFromContent(followUpMessages[0]?.content)).toContain(
      "The user did not attach new referenced messages for this side question.",
    );
    expect(textFromContent(followUpMessages[0]?.content)).not.toContain(
      "<referenced_message",
    );
  });

  test("keeps sidecar uploads and human input on the sidecar thread", async ({
    page,
  }) => {
    const parentMessages = [
      {
        type: "human",
        id: "parent-human-1",
        content: [{ type: "text", text: "Plan the feature." }],
      },
      {
        type: "ai",
        id: "parent-ai-1",
        content: "Build it as a side conversation.",
      },
    ];
    const sidecarMessages: Array<Record<string, unknown>> = [
      {
        type: "human",
        id: "side-human-1",
        content: "What tradeoffs should we consider?",
      },
      {
        type: "ai",
        id: "side-ai-1",
        content: "Hello from DeerFlow!",
      },
    ];
    const sidecarRuntimeMessages = sidecarMessages;
    const streamBodies: Array<{
      input?: {
        messages?: Array<{
          content?: unknown;
          additional_kwargs?: Record<string, unknown>;
        }>;
      };
    }> = [];
    const streamThreadURLs: string[] = [];
    const uploadThreadIDs: string[] = [];
    let sidecarThreadCreateCount = 0;
    let hiddenRunStarted = false;
    let releaseHiddenRun!: () => void;
    const hiddenRunGate = new Promise<void>((resolve) => {
      releaseHiddenRun = resolve;
    });

    mockLangGraphAPI(page, {
      threads: [
        {
          thread_id: MOCK_THREAD_ID,
          title: "Main conversation",
          messages: parentMessages,
        },
        {
          thread_id: MOCK_SIDECAR_THREAD_ID,
          title: "Restored side chat",
          updated_at: "2025-01-01T00:00:01Z",
          metadata: {
            deerflow_sidecar: true,
            parent_thread_id: MOCK_THREAD_ID,
            sidecar_context_type: "referenced_message",
            sidecar_context_label: "Selected assistant text #2",
            sidecar_context_count: 1,
            referenced_message_id: "parent-ai-1",
            referenced_message_ids: ["parent-ai-1"],
            referenced_message_role: "assistant",
            referenced_message_roles: ["assistant"],
          },
          messages: sidecarMessages,
        },
        {
          thread_id: MOCK_THREAD_ID_2,
          title: "Second conversation",
          messages: [
            {
              type: "human",
              id: "second-human-1",
              content: "Switch target.",
            },
          ],
        },
      ],
    });
    await page.route("**/api/threads", (route) => {
      if (route.request().method() !== "POST") {
        return route.fallback();
      }
      sidecarThreadCreateCount += 1;
      return route.fallback();
    });
    await page.route("**/api/threads/*/uploads", (route) => {
      if (route.request().method() !== "POST") {
        return route.fallback();
      }
      const pathname = new URL(route.request().url()).pathname;
      uploadThreadIDs.push(
        pathname.split("/threads/")[1]?.split("/uploads")[0] ?? "",
      );
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          files: [
            {
              filename: "sidecar-notes.txt",
              size: 5,
              path: "/tmp/sidecar-notes.txt",
              virtual_path: "/mnt/user-data/uploads/sidecar-notes.txt",
              artifact_url: "/artifact/sidecar-notes.txt",
            },
          ],
          message: "ok",
          skipped_files: [],
        }),
      });
    });
    await page.route("**/runs/stream", async (route) => {
      const body = route
        .request()
        .postDataJSON() as (typeof streamBodies)[number];
      streamBodies.push(body);
      streamThreadURLs.push(route.request().url());
      const submittedText = textFromContent(
        body.input?.messages?.at(-1)?.content,
      );
      if (submittedText === "Keep running while hidden") {
        hiddenRunStarted = true;
        await hiddenRunGate;
      }
      const responseMessage =
        submittedText === "Request sidecar approval"
          ? {
              type: "tool",
              id: "sidecar-human-input-request",
              name: "ask_clarification",
              tool_call_id: "sidecar-clarification-call",
              content: "Waiting for clarification",
              artifact: {
                human_input: {
                  version: 2,
                  kind: "human_input_request",
                  source: "ask_clarification",
                  request_id: "sidecar-request-1",
                  question: "Confirm sidecar delivery",
                  input_mode: "form",
                  fields: [
                    {
                      name: "owner",
                      label: "Owner",
                      type: "text",
                      required: true,
                    },
                    {
                      name: "approved",
                      label: "Approved",
                      type: "checkbox",
                      required: false,
                    },
                  ],
                },
              },
            }
          : {
              type: "ai",
              id: `sidecar-response-${streamBodies.length}`,
              content: "Hello from DeerFlow!",
            };
      sidecarRuntimeMessages.push(
        ...(body.input?.messages ?? []),
        responseMessage,
      );
      const events = [
        {
          event: "metadata",
          data: {
            run_id: `run-${MOCK_SIDECAR_THREAD_ID}`,
            thread_id: MOCK_SIDECAR_THREAD_ID,
          },
        },
        {
          event: "values",
          data: {
            messages: sidecarRuntimeMessages,
          },
        },
        { event: "end", data: {} },
      ];
      return route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        headers: {
          "Content-Location": `/api/threads/${MOCK_SIDECAR_THREAD_ID}/runs/run-${MOCK_SIDECAR_THREAD_ID}`,
          "Access-Control-Expose-Headers": "Content-Location",
        },
        body: events
          .map(
            (event) =>
              `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`,
          )
          .join(""),
      });
    });

    await page.goto(`/workspace/chats/${MOCK_THREAD_ID_2}`);
    await expect(page.getByText("Switch target.")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("sidecar-header-trigger")).toBeHidden();

    await page.goto(`/workspace/chats/${MOCK_THREAD_ID}`);
    await expect(page.getByTestId("sidecar-header-trigger")).toBeVisible({
      timeout: 10_000,
    });
    await page.getByTestId("sidecar-header-trigger").click();
    await expect(page.getByTestId("sidecar-panel")).toBeVisible();

    const sidecarInput = page.getByPlaceholder(/deeper follow-up/i);
    const sidecarInputForm = page.locator("form").filter({
      has: sidecarInput,
    });

    await sidecarInput.fill("Keep running while hidden");
    await sidecarInput.press("Enter");
    await expect.poll(() => hiddenRunStarted).toBe(true);
    await expect(sidecarInput).toBeDisabled();
    await page.getByTestId("sidecar-header-trigger").click();
    await expect(page.getByTestId("sidecar-panel")).toBeHidden();
    await page.getByTestId("sidecar-header-trigger").click();
    await expect(page.getByTestId("sidecar-panel")).toBeVisible();
    releaseHiddenRun();
    await expect(sidecarInput).toBeEnabled();
    expect(sidecarThreadCreateCount).toBe(0);

    // PromptInput intentionally owns its file input as a sibling of the form,
    // so scope it to the sidecar surface rather than inventing a form-child
    // relationship that does not exist in the product DOM.
    const sidecarFileInput = page
      .getByTestId("sidecar-panel")
      .locator("input[type='file']");
    await expect(sidecarFileInput).toHaveCount(1);
    await sidecarFileInput.setInputFiles({
      name: "sidecar-notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("hello"),
    });
    await expect(sidecarInputForm.getByText("sidecar-notes.txt")).toBeVisible();
    await sidecarInput.fill("Review the attached sidecar notes");
    await sidecarInput.press("Enter");
    await expect.poll(() => uploadThreadIDs).toEqual([MOCK_SIDECAR_THREAD_ID]);
    await expect
      .poll(
        () =>
          streamBodies.at(-1)?.input?.messages?.at(-1)?.additional_kwargs
            ?.files,
      )
      .toEqual([
        {
          filename: "sidecar-notes.txt",
          size: 5,
          path: "/mnt/user-data/uploads/sidecar-notes.txt",
          status: "uploaded",
        },
      ]);
    expect(streamThreadURLs.at(-1)).toContain(
      `/threads/${MOCK_SIDECAR_THREAD_ID}/runs/stream`,
    );
    await expect(sidecarInputForm.getByText("sidecar-notes.txt")).toBeHidden();
    await expect(sidecarInput).toBeEnabled();

    await sidecarInput.fill("Request sidecar approval");
    await sidecarInput.press("Enter");
    await expect
      .poll(() =>
        textFromContent(streamBodies.at(-1)?.input?.messages?.at(-1)?.content),
      )
      .toBe("Request sidecar approval");
    const humanInputCard = page
      .getByTestId("sidecar-message-list")
      .locator("section")
      .filter({ hasText: "Confirm sidecar delivery" });
    await expect(humanInputCard).toBeVisible();
    await humanInputCard.getByRole("button", { name: "Submit" }).click();
    await expect(humanInputCard.getByRole("alert")).toBeVisible();
    await humanInputCard.locator("input[type='text']").fill("Dana");
    await humanInputCard.getByRole("button", { name: "Submit" }).click();
    await expect
      .poll(
        () =>
          streamBodies.at(-1)?.input?.messages?.at(-1)?.additional_kwargs
            ?.human_input_response,
      )
      .toMatchObject({
        request_id: "sidecar-request-1",
        value:
          'Owner: Dana; Approved: no [values: {"owner":"Dana","approved":false}]',
      });
    expect(
      streamBodies.at(-1)?.input?.messages?.at(-1)?.additional_kwargs,
    ).toMatchObject({
      hide_from_ui: true,
      human_input_response: expect.any(Object),
    });
    expect(streamThreadURLs.at(-1)).toContain(
      `/threads/${MOCK_SIDECAR_THREAD_ID}/runs/stream`,
    );
    await expect(humanInputCard.getByText(/Answered:/)).toBeVisible();
  });

  test("shows reference summary on visible messages with reference metadata", async ({
    page,
  }) => {
    mockLangGraphAPI(page, {
      threads: [
        {
          thread_id: MOCK_THREAD_ID,
          title: "Referenced conversation",
          messages: [
            {
              type: "human",
              id: "human-with-references",
              content: [
                { type: "text", text: "What tradeoffs should we consider?" },
              ],
              additional_kwargs: {
                referenced_message_count: 2,
                referenced_message_ids: ["parent-ai-1"],
                referenced_message_roles: ["assistant", "assistant"],
                referenced_message_contexts: [
                  {
                    label: "Selected assistant text #2",
                    message_id: "parent-ai-1",
                    role: "assistant",
                    content: "Build it as a side conversation.",
                  },
                  {
                    label: "Selected assistant text #2",
                    message_id: "parent-ai-1",
                    role: "assistant",
                    content: "Keep the cited snippets compact.",
                  },
                ],
              },
            },
            {
              type: "ai",
              id: "ai-after-references",
              content: "Use the selected snippets as constraints.",
            },
          ],
        },
      ],
    });

    await page.goto(`/workspace/chats/${MOCK_THREAD_ID}`);

    await expect(
      page.getByText("What tradeoffs should we consider?"),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByTestId("message-reference-attachment"),
    ).toContainText("2 selected text fragments");
    await expect(page.getByTestId("message-reference-attachment")).toHaveClass(
      /max-w-\[min\(18rem,100%\)\]/,
    );
  });

  test("opens restored side chat history without animated scroll", async ({
    page,
  }) => {
    const tallSidecarMessages = Array.from({ length: 12 }).flatMap(
      (_, index) => [
        {
          type: "human",
          id: `side-human-${index}`,
          content: [{ type: "text", text: `Follow-up ${index + 1}` }],
        },
        {
          type: "ai",
          id: `side-ai-${index}`,
          content: [
            `Restored side answer ${index + 1}.`,
            "This paragraph gives the side chat enough height to require scrolling.",
            "Opening the panel should reveal the existing history without a visible scroll animation.",
          ].join(" "),
        },
      ],
    );

    mockLangGraphAPI(page, {
      threads: [
        {
          thread_id: MOCK_THREAD_ID,
          title: "Main conversation",
          messages: [
            {
              type: "human",
              id: "parent-human-1",
              content: [{ type: "text", text: "Plan the feature." }],
            },
            {
              type: "ai",
              id: "parent-ai-1",
              content: "Build it as a side conversation.",
            },
          ],
        },
        {
          thread_id: MOCK_SIDECAR_THREAD_ID,
          title: "Restored side chat",
          updated_at: "2025-01-01T00:00:01Z",
          metadata: {
            deerflow_sidecar: true,
            parent_thread_id: MOCK_THREAD_ID,
            sidecar_context_type: "referenced_message",
            sidecar_context_label: "Selected assistant text #2",
            sidecar_context_count: 1,
            referenced_message_id: "parent-ai-1",
            referenced_message_ids: ["parent-ai-1"],
            referenced_message_role: "assistant",
            referenced_message_roles: ["assistant"],
          },
          messages: tallSidecarMessages,
        },
      ],
    });

    await page.goto(`/workspace/chats/${MOCK_THREAD_ID}`);
    await expect(
      page.getByText("Build it as a side conversation."),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("sidecar-header-trigger")).toBeVisible({
      timeout: 10_000,
    });

    await openSidecarAndExpectNoAnimatedScroll(page);
    await expectSidecarScrollDoesNotAnimateAfterOpen(page);
    await page.getByTestId("sidecar-header-trigger").click();
    await expect(page.getByTestId("sidecar-panel")).toBeHidden();
    await page.waitForTimeout(350);
    await openSidecarAndExpectNoAnimatedScroll(page);
  });

  test("self-heals the trigger when the sidecar thread is deleted elsewhere", async ({
    page,
  }) => {
    mockLangGraphAPI(page, {
      threads: [
        {
          thread_id: MOCK_THREAD_ID,
          title: "Main conversation",
          messages: [
            {
              type: "human",
              id: "parent-human-1",
              content: [{ type: "text", text: "Plan the feature." }],
            },
            {
              type: "ai",
              id: "parent-ai-1",
              content: "Build it as a side conversation.",
            },
          ],
        },
        {
          thread_id: MOCK_SIDECAR_THREAD_ID,
          title: "Restored side chat",
          updated_at: "2025-01-01T00:00:01Z",
          metadata: {
            deerflow_sidecar: true,
            parent_thread_id: MOCK_THREAD_ID,
            sidecar_context_type: "referenced_message",
            sidecar_context_label: "Selected assistant text #2",
            sidecar_context_count: 1,
            referenced_message_id: "parent-ai-1",
            referenced_message_ids: ["parent-ai-1"],
            referenced_message_role: "assistant",
            referenced_message_roles: ["assistant"],
          },
          messages: [
            {
              type: "ai",
              id: "side-ai-1",
              content: "Restored side answer.",
            },
          ],
        },
      ],
    });

    await page.goto(`/workspace/chats/${MOCK_THREAD_ID}`);
    await expect(
      page.getByText("Build it as a side conversation."),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("sidecar-header-trigger")).toBeVisible({
      timeout: 10_000,
    });

    // Simulate the sidecar thread being deleted from another surface: the
    // backend search now returns no matching sidecar thread.
    await page.route("**/api/langgraph/threads/search", (route) => {
      if (route.request().method() !== "POST") {
        return route.fallback();
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    // Clicking the (still-cached) trigger forces a re-query; because the thread
    // is gone the trigger hides itself instead of opening a dead thread (#3555).
    await page.getByTestId("sidecar-header-trigger").click();
    await expect(page.getByTestId("sidecar-panel")).toBeHidden();
    await expect(page.getByTestId("sidecar-header-trigger")).toBeHidden({
      timeout: 10_000,
    });
  });

  test("deletes the side chat from the panel's own button", async ({
    page,
  }) => {
    mockLangGraphAPI(page, {
      threads: [
        {
          thread_id: MOCK_THREAD_ID,
          title: "Main conversation",
          messages: [
            {
              type: "human",
              id: "parent-human-1",
              content: [{ type: "text", text: "Plan the feature." }],
            },
            {
              type: "ai",
              id: "parent-ai-1",
              content: "Build it as a side conversation.",
            },
          ],
        },
        {
          thread_id: MOCK_SIDECAR_THREAD_ID,
          title: "Restored side chat",
          updated_at: "2025-01-01T00:00:01Z",
          metadata: {
            deerflow_sidecar: true,
            parent_thread_id: MOCK_THREAD_ID,
            sidecar_context_type: "referenced_message",
            sidecar_context_label: "Selected assistant text #2",
            sidecar_context_count: 1,
            referenced_message_id: "parent-ai-1",
            referenced_message_ids: ["parent-ai-1"],
            referenced_message_role: "assistant",
            referenced_message_roles: ["assistant"],
          },
          messages: [
            {
              type: "ai",
              id: "side-ai-1",
              content: "Restored side answer.",
            },
          ],
        },
      ],
    });

    await page.goto(`/workspace/chats/${MOCK_THREAD_ID}`);
    await expect(
      page.getByText("Build it as a side conversation."),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("sidecar-header-trigger")).toBeVisible({
      timeout: 10_000,
    });

    // Open the side chat panel via the header trigger.
    await page.getByTestId("sidecar-header-trigger").click();
    await expect(page.getByTestId("sidecar-panel")).toBeVisible();

    // The panel's own button deletes the side chat (it does not merely hide it).
    await page.getByTestId("sidecar-delete-button").click();
    await expect(
      page.getByText("This action cannot be undone", { exact: false }),
    ).toBeVisible();

    const deleteRequestPromise = page.waitForRequest(
      (request) =>
        request.method() === "DELETE" &&
        request.url().includes(`/threads/${MOCK_SIDECAR_THREAD_ID}`),
    );
    await page.getByTestId("sidecar-delete-confirm-button").click();
    await deleteRequestPromise;

    // The panel closes and, because the sidecar thread is gone, the header
    // trigger unmounts too — hiding is owned by the trigger, deleting by this.
    await expect(page.getByTestId("sidecar-panel")).toBeHidden();
    await expect(page.getByTestId("sidecar-header-trigger")).toBeHidden({
      timeout: 10_000,
    });
  });

  test("keeps the delete dialog open while the delete is in flight", async ({
    page,
  }) => {
    mockLangGraphAPI(page, {
      threads: [
        {
          thread_id: MOCK_THREAD_ID,
          title: "Main conversation",
          messages: [
            {
              type: "human",
              id: "parent-human-1",
              content: [{ type: "text", text: "Plan the feature." }],
            },
            {
              type: "ai",
              id: "parent-ai-1",
              content: "Build it as a side conversation.",
            },
          ],
        },
        {
          thread_id: MOCK_SIDECAR_THREAD_ID,
          title: "Restored side chat",
          updated_at: "2025-01-01T00:00:01Z",
          metadata: {
            deerflow_sidecar: true,
            parent_thread_id: MOCK_THREAD_ID,
            sidecar_context_type: "referenced_message",
            sidecar_context_label: "Selected assistant text #2",
            sidecar_context_count: 1,
            referenced_message_id: "parent-ai-1",
            referenced_message_ids: ["parent-ai-1"],
            referenced_message_role: "assistant",
            referenced_message_roles: ["assistant"],
          },
          messages: [
            {
              type: "ai",
              id: "side-ai-1",
              content: "Restored side answer.",
            },
          ],
        },
      ],
    });

    // Hold the local-delete step open so the mutation stays pending while we
    // probe every dismissal path Radix would otherwise honor.
    let releaseDelete: (() => void) | undefined;
    const deleteGate = new Promise<void>((resolve) => {
      releaseDelete = resolve;
    });
    await page.route(`**/threads/${MOCK_SIDECAR_THREAD_ID}`, async (route) => {
      if (route.request().method() !== "DELETE") {
        return route.fallback();
      }
      await deleteGate;
      return route.fallback();
    });

    await page.goto(`/workspace/chats/${MOCK_THREAD_ID}`);
    await expect(
      page.getByText("Build it as a side conversation."),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("sidecar-header-trigger")).toBeVisible({
      timeout: 10_000,
    });

    await page.getByTestId("sidecar-header-trigger").click();
    await expect(page.getByTestId("sidecar-panel")).toBeVisible();

    await page.getByTestId("sidecar-delete-button").click();
    // 删除确认是 alertdialog：只有取消与确认两个出口，没有第三个「X」——
    // 一个中途会消失的关闭按钮反而会让人以为点它等于取消。
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Delete side chat");
    await expect(
      page.locator(
        '[data-slot="alert-dialog-content"] [data-slot="dialog-close"]',
      ),
    ).toHaveCount(0);

    await page.getByTestId("sidecar-delete-confirm-button").click();

    // Delete is in flight: confirm shows the loading label and Cancel disables.
    await expect(
      page.getByTestId("sidecar-delete-confirm-button"),
    ).toBeDisabled();
    await expect(page.getByRole("button", { name: "Cancel" })).toBeDisabled();

    // Esc and overlay clicks must not dismiss the dialog mid-delete.
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    await page
      .locator('[data-slot="alert-dialog-overlay"]')
      .click({ position: { x: 5, y: 5 } });
    await expect(dialog).toBeVisible();

    // Once the delete resolves the dialog closes and the panel goes away.
    releaseDelete?.();
    await expect(dialog).toBeHidden({ timeout: 10_000 });
    await expect(page.getByTestId("sidecar-panel")).toBeHidden();
  });

  test("closes the draft side chat without deleting when no conversation exists", async ({
    page,
  }) => {
    mockLangGraphAPI(page, {
      threads: [
        {
          thread_id: MOCK_THREAD_ID,
          title: "Main conversation",
          messages: [
            {
              type: "human",
              id: "parent-human-1",
              content: [{ type: "text", text: "Plan the feature." }],
            },
            {
              type: "ai",
              id: "parent-ai-1",
              content: "Build it as a side conversation.",
            },
          ],
        },
      ],
    });
    await page.route("**/api/models", (route) => {
      if (route.request().method() !== "GET") {
        return route.fallback();
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          models: [
            {
              id: "deepseek-v4-pro",
              name: "deepseek-v4-pro",
              model: "deepseek-v4-pro",
              display_name: "DeepSeek V4 Pro",
              supports_thinking: true,
              supports_reasoning_effort: true,
            },
          ],
          token_usage: { enabled: false },
        }),
      });
    });

    let deleteRequestFired = false;
    page.on("request", (request) => {
      if (
        request.method() === "DELETE" &&
        request.url().includes("/threads/")
      ) {
        deleteRequestFired = true;
      }
    });

    await page.goto(`/workspace/chats/${MOCK_THREAD_ID}`);
    await expect(
      page.getByText("Build it as a side conversation."),
    ).toBeVisible({ timeout: 15_000 });

    // Open the side chat as a draft (references only, no thread created yet).
    await selectTextAndClickToolbarButton(
      page,
      "Build it as a side conversation.",
      "Ask in side chat",
    );
    await expect(page.getByTestId("sidecar-panel")).toBeVisible();
    await expect(
      page.getByTestId("sidecar-reference-attachment"),
    ).toBeVisible();

    // The draft has no persisted thread, so the header offers a plain close (X)
    // instead of the destructive delete button.
    await expect(page.getByTestId("sidecar-delete-button")).toBeHidden();
    await page.getByTestId("sidecar-close-button").click();

    await expect(page.getByTestId("sidecar-panel")).toBeHidden();
    // No thread was ever created, so closing must not issue a DELETE request.
    expect(deleteRequestFired).toBe(false);
  });
});
