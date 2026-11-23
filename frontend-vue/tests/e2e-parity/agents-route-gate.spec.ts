import { expect, test, type Page } from "./support/test";

import { enUS } from "../../app/core/i18n/locales/en-US";
import { mockLangGraphAPI, MOCK_THREAD_ID } from "../e2e/utils/mock-api";
import { PARITY_CONTEXT_OPTIONS } from "./support/context-options";
import { applyDimension, DEFAULT_DIMENSION } from "./support/scenarios";
import { waitForDomQuiet } from "./support/settle";

const APPS = [
  ["react", process.env.E2E_REACT_APP_URL ?? "http://localhost:3116"],
  ["vue", process.env.E2E_APP_URL ?? "http://localhost:3115"],
] as const;
const AGENT = {
  name: "route-gate-reviewer",
  display_name: "Route gate reviewer",
};
const ROUTES = [
  ["directory", "/workspace/agents"],
  ["new", "/workspace/agents/new"],
  ["chat", `/workspace/agents/${AGENT.name}/chats/${MOCK_THREAD_ID}`],
] as const;
const MARKER = "ROUTE-GATE-DURABLE-MESSAGE";

function installBusinessFixture(page: Page) {
  mockLangGraphAPI(page, {
    agents: [AGENT],
    threads: [
      {
        thread_id: MOCK_THREAD_ID,
        agent_name: AGENT.name,
        title: "Route gate thread",
        messages: [{ type: "ai", id: "route-gate-answer", content: MARKER }],
      },
    ],
  });
  const requests: string[] = [];
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    // Shell discovery and thread-list requests are permitted. Agent catalog,
    // detail/name checks, model loading and this chat's reads belong to children.
    if (
      /^\/api\/agents(?:\/|$)/.test(path) ||
      path === "/api/models" ||
      path.includes(`/threads/${MOCK_THREAD_ID}`)
    )
      requests.push(`${request.method()} ${path}`);
  });
  return requests;
}

async function noBusinessSubtree(page: Page) {
  await expect(
    page.getByRole("heading", { name: enUS.agents.title, exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByPlaceholder(enUS.agents.nameStepPlaceholder, { exact: true }),
  ).toHaveCount(0);
  await expect(page.locator("textarea")).toHaveCount(0);
  await expect(page.getByText(MARKER, { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("dialog", {
      name: `${enUS.agents.settingsTitle} · ${AGENT.name}`,
      exact: true,
    }),
  ).toHaveCount(0);
}

async function enabledSubtree(page: Page, route: (typeof ROUTES)[number][0]) {
  if (route === "directory") {
    await expect(
      page.getByRole("heading", { name: enUS.agents.title, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(AGENT.display_name, { exact: true }),
    ).toBeVisible();
  } else if (route === "new") {
    await expect(
      page.getByPlaceholder(enUS.agents.nameStepPlaceholder, { exact: true }),
    ).toBeVisible();
  } else {
    await expect(page.locator("textarea")).toBeVisible();
    await expect(page.getByText(MARKER, { exact: true })).toBeVisible();
  }
}

for (const viewport of ["desktop", "mobile"] as const)
  for (const [name, path] of ROUTES)
    test(`${viewport}/${name}: pending and disabled capability never mount route business`, async ({
      browser,
    }, testInfo) => {
      const presentation: Record<string, unknown> = {};
      for (const [app, base] of APPS) {
        const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
        let release!: () => void;
        const pending = new Promise<void>((resolve) => {
          release = resolve;
        });
        try {
          const page = await context.newPage();
          const requests = installBusinessFixture(page);
          await applyDimension(page, base, { ...DEFAULT_DIMENSION, viewport });
          await page.route("**/api/features", async (route) => {
            await pending;
            if (!page.isClosed())
              await route.fulfill({ json: { agents_api: { enabled: false } } });
          });
          await page.goto(`${base}${path}`);
          const loading = page.getByText(enUS.common.loading, { exact: true });
          await expect(loading).toBeVisible();
          await noBusinessSubtree(page);
          if (viewport === "mobile")
            await expect(page.locator('[data-sidebar="sidebar"]')).toHaveCount(
              0,
            );
          expect(requests).toEqual([]);
          presentation[app] = await loading.evaluate((element) => {
            const style = getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            const owner = element.closest("main")!.getBoundingClientRect();
            return {
              fontSize: style.fontSize,
              lineHeight: style.lineHeight,
              centeredX:
                Math.abs(rect.x + rect.width / 2 - owner.x - owner.width / 2) <=
                1,
              centeredY:
                Math.abs(
                  rect.y + rect.height / 2 - owner.y - owner.height / 2,
                ) <= 1,
            };
          });
          expect(presentation[app]).toMatchObject({
            centeredX: true,
            centeredY: true,
          });
          await testInfo.attach(`${app}-${viewport}-${name}-pending.png`, {
            body: await page.screenshot(),
            contentType: "image/png",
          });
          release();
          await expect(
            page.getByText(enUS.agents.featureDisabledTitle, { exact: true }),
          ).toBeVisible();
          await expect(
            page.getByText(enUS.agents.featureDisabledDescription, {
              exact: true,
            }),
          ).toBeVisible();
          await noBusinessSubtree(page);
          expect(requests).toEqual([]);
          expect(new URL(page.url()).pathname).toBe(path);
          await testInfo.attach(`${app}-${viewport}-${name}-disabled.png`, {
            body: await page.screenshot(),
            contentType: "image/png",
          });
        } finally {
          release();
          await context.close();
        }
      }
      expect(presentation.vue).toEqual(presentation.react);
    });

for (const [name, path] of ROUTES)
  test(`mobile/${name}: real sidebar observer changes unmount and restore the active route`, async ({
    browser,
  }, testInfo) => {
    for (const [app, base] of APPS) {
      const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
      try {
        const page = await context.newPage();
        const requests = installBusinessFixture(page);
        await applyDimension(page, base, {
          ...DEFAULT_DIMENSION,
          viewport: "mobile",
        });
        let enabled = true;
        await page.route("**/api/features", (route) =>
          route.fulfill({ json: { agents_api: { enabled } } }),
        );
        await page.goto(`${base}${path}`);
        await enabledSubtree(page, name);
        await expect(page.locator('[data-sidebar="sidebar"]')).toHaveCount(0);
        if (name === "new")
          await page
            .getByPlaceholder(enUS.agents.nameStepPlaceholder)
            .fill("retired-draft");
        await page
          .locator("main button:visible:not(:disabled)")
          .first()
          .focus();
        enabled = false;
        // A user opens the real drawer. Its new Agents observer refreshes the
        // shared stale query; no QueryClient injection or fake focus event.
        await page.locator("body").press("ControlOrMeta+b");
        await expect(page.locator('[data-sidebar="sidebar"]')).toBeVisible();
        await expect(
          page.getByText(enUS.agents.featureDisabledTitle, { exact: true }),
        ).toHaveCount(1);
        await page.keyboard.press("Escape");
        await expect(page.locator('[data-sidebar="sidebar"]')).toHaveCount(0);
        await expect(
          page.getByText(enUS.agents.featureDisabledTitle, { exact: true }),
        ).toBeVisible();
        await noBusinessSubtree(page);
        await waitForDomQuiet(page);
        const disabledRequests = [...requests];
        enabled = true;
        await page.locator("body").press("ControlOrMeta+b");
        await expect(
          page.locator('[data-sidebar="sidebar"] a[href="/workspace/agents"]'),
        ).toBeVisible();
        await page.keyboard.press("Escape");
        await enabledSubtree(page, name);
        if (name === "new")
          await expect(
            page.getByPlaceholder(enUS.agents.nameStepPlaceholder),
          ).toHaveValue("");
        expect(new URL(page.url()).pathname).toBe(path);
        await testInfo.attach(`${app}-${name}-lifecycle.json`, {
          body: JSON.stringify(
            { disabledRequests, restoredRequests: requests },
            null,
            2,
          ),
          contentType: "application/json",
        });
      } finally {
        await context.close();
      }
    }
  });

test("directory owns the real edit dialog and browser back rechecks route admission", async ({
  browser,
}) => {
  for (const [, base] of APPS) {
    const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
    try {
      const page = await context.newPage();
      installBusinessFixture(page);
      await applyDimension(page, base, DEFAULT_DIMENSION);
      let enabled = true;
      await page.route("**/api/features", (route) =>
        route.fulfill({ json: { agents_api: { enabled } } }),
      );
      await page.goto(`${base}/workspace/agents`);
      await enabledSubtree(page, "directory");
      await page.getByTitle(enUS.agents.settings, { exact: true }).click();
      const dialog = page.getByRole("dialog", {
        name: `${enUS.agents.settingsTitle} · ${AGENT.name}`,
        exact: true,
      });
      await expect(dialog).toBeVisible();
      expect(new URL(page.url()).pathname).toBe("/workspace/agents");
      // The dialog is portal content, but it still belongs to the admitted
      // directory subtree. A real mobile drawer observer revokes admission
      // while that dialog is open; its form must retire with the route child.
      await page.setViewportSize({ width: 375, height: 812 });
      await expect(page.locator('[data-sidebar="sidebar"]')).toHaveCount(0);
      await dialog
        .getByRole("button", { name: enUS.agents.settingsCancel, exact: true })
        .focus();
      enabled = false;
      await page.keyboard.press("ControlOrMeta+b");
      await expect(page.locator('[data-sidebar="sidebar"]')).toBeVisible();
      await expect(
        page.getByText(enUS.agents.featureDisabledTitle, { exact: true }),
      ).toHaveCount(1);
      await expect(dialog).toHaveCount(0);
      await page.keyboard.press("Escape");
      await expect(page.locator('[data-sidebar="sidebar"]')).toHaveCount(0);
      await noBusinessSubtree(page);
      enabled = true;
      await page.locator("body").press("ControlOrMeta+b");
      await expect(
        page.locator('[data-sidebar="sidebar"] a[href="/workspace/agents"]'),
      ).toBeVisible();
      await page.keyboard.press("Escape");
      await enabledSubtree(page, "directory");
      await expect(dialog).toHaveCount(0);
      await page.setViewportSize({ width: 1280, height: 800 });
      await page
        .getByRole("link", { name: enUS.agents.newAgent, exact: true })
        .first()
        .click();
      await enabledSubtree(page, "new");
      await page
        .getByRole("button", { name: enUS.agents.backToGallery, exact: true })
        .click();
      await enabledSubtree(page, "directory");
      // Exit the whole agents branch before changing server capability. Back
      // must reconstruct its admission owner, including with a cached answer.
      await page
        .locator('[data-sidebar="sidebar"] a[href="/workspace/chats"]')
        .click();
      await expect(page).toHaveURL(`${base}/workspace/chats`);
      enabled = false;
      await page.goBack();
      await expect(
        page.getByText(enUS.agents.featureDisabledTitle, { exact: true }),
      ).toBeVisible();
      await noBusinessSubtree(page);
      await page.goForward();
      enabled = true;
      await page.goBack();
      await enabledSubtree(page, "directory");
    } finally {
      await context.close();
    }
  }
});
