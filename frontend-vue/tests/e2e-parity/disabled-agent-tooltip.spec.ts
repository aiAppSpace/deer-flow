import { expect, test, type Page, type TestInfo } from "./support/test";

import { PARITY_CONTEXT_OPTIONS } from "./support/context-options";
import { PARITY_SCENARIOS, runScenario } from "./support/scenarios";
import { waitForDomQuiet, waitForFiniteAnimations } from "./support/settle";

const APPS = [
  ["react", process.env.E2E_REACT_APP_URL ?? "http://localhost:3116"],
  ["vue", process.env.E2E_APP_URL ?? "http://localhost:3115"],
] as const;

async function refreshThroughDocumentMount(page: Page) {
  // A headless page remains visible when another tab comes to the foreground.
  // A real document reload reruns the existing mount query without injecting
  // visibility events or mutating the application's QueryClient.
  const response = page.waitForResponse(
    (entry) =>
      new URL(entry.url()).pathname === "/api/features" &&
      entry.request().method() === "GET",
  );
  await page.reload();
  expect((await response).ok()).toBe(true);
}

async function observeDisabledTooltip(
  page: Page,
  label: string,
  reason: string,
  app: string,
  testInfo: TestInfo,
) {
  const sidebar = page.locator('[data-sidebar="sidebar"]');
  const button = sidebar.getByRole("button", { name: label, exact: true });
  const row = button.locator("..");
  const popup = page.locator('[data-slot="tooltip-content"]:visible');
  await expect(button).toHaveAttribute("aria-disabled", "true");
  await expect(sidebar.locator('a[href="/workspace/agents"]')).toHaveCount(0);
  const descriptionId = await button.getAttribute("aria-describedby");
  expect(descriptionId).toBeTruthy();
  const description = page.locator(`[id="${descriptionId}"]`);
  await expect(description).toHaveCount(1);
  await expect(description).toHaveText(reason);
  expect(await row.evaluate((element) => element.tabIndex)).toBe(-1);
  expect(await button.evaluate((element) => element.tabIndex)).toBe(0);
  expect(
    await row.evaluate(
      (element) =>
        [
          ...element.querySelectorAll<HTMLElement>("button,a,input,[tabindex]"),
        ].filter((child) => child.tabIndex >= 0).length,
    ),
  ).toBe(1);
  expect(
    await button.evaluate((element) => getComputedStyle(element).pointerEvents),
  ).toBe("none");
  await row.hover();
  await expect(popup).toHaveCount(1);
  await expect(popup).toHaveAttribute("data-side", "right");
  await expect(popup).toContainText(reason);
  await expect(button).toHaveAttribute("aria-describedby", descriptionId!);

  await waitForFiniteAnimations(page);
  await expect(popup).toHaveCSS("opacity", "1");
  expect(
    await popup.evaluate((element) =>
      element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }),
    ),
  ).toBe(true);
  await testInfo.attach(`${app}-disabled-agents-visible-tooltip.png`, {
    body: await page.screenshot(),
    contentType: "image/png",
  });
  const visual = await popup.evaluate((element) => {
    const style = getComputedStyle(element);
    const rgba = (value: string) => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const context = canvas.getContext("2d")!;
      context.fillStyle = value;
      context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data];
    };
    return {
      opacity: style.opacity,
      visibility: style.visibility,
      effectiveOpacity: (() => {
        let value = 1;
        for (
          let parent: Element | null = element;
          parent;
          parent = parent.parentElement
        )
          value *= Number(getComputedStyle(parent).opacity);
        return value;
      })(),
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      lineHeight: style.lineHeight,
      padding: [
        style.paddingTop,
        style.paddingRight,
        style.paddingBottom,
        style.paddingLeft,
      ],
      borderWidth: style.borderWidth,
      borderRadius: style.borderRadius,
      boxShadow: style.boxShadow,
      color: rgba(style.color),
      background: rgba(style.backgroundColor),
      border: rgba(style.borderColor),
    };
  });
  expect(visual.effectiveOpacity).toBe(1);
  const triggerBox = await row.boundingBox();
  const popupBox = await popup.boundingBox();
  expect(triggerBox).not.toBeNull();
  expect(popupBox).not.toBeNull();
  expect(
    Math.abs(popupBox!.x - (triggerBox!.x + triggerBox!.width) - 4),
  ).toBeLessThanOrEqual(0.5);
  expect(
    Math.abs(
      popupBox!.y +
        popupBox!.height / 2 -
        triggerBox!.y -
        triggerBox!.height / 2,
    ),
  ).toBeLessThanOrEqual(0.5);

  await page.mouse.move(0, 0);
  await sidebar.locator('a[href="/workspace/chats"]').focus();
  await waitForDomQuiet(page);
  await page.keyboard.press("Tab");
  await expect(button).toBeFocused();
  await expect(popup).toHaveCount(1);
  await expect(popup).toHaveAttribute("data-side", "right");
  await expect(button).toHaveAttribute("aria-describedby", descriptionId!);
  await page.keyboard.press("Escape");
  await expect(popup).toHaveCount(0);
  await expect(button).toBeFocused();
  await expect(description).toHaveText(reason);
  await page.keyboard.press("Tab");
  await expect(
    sidebar.locator('a[href="/workspace/scheduled-tasks"]'),
  ).toBeFocused();
  return visual;
}

for (const locale of ["en-US", "zh-CN"] as const)
  for (const theme of ["light", "dark"] as const)
    test(`${locale}/${theme}: disabled Agents retains native tooltip and permanent keyboard reason`, async ({
      browser,
    }, testInfo) => {
      const label = locale === "en-US" ? "Agents" : "智能体";
      const reason = locale === "en-US" ? "Feature not enabled" : "功能未启用";
      const scenario = PARITY_SCENARIOS.find(
        (entry) => entry.id === "agents-feature-disabled",
      )!;
      const observations: Record<string, unknown> = {};
      for (const [app, base] of APPS) {
        const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
        try {
          const page = await context.newPage();
          const errors: string[] = [];
          page.on("pageerror", (error) => errors.push(error.message));
          await runScenario(page, base, scenario, {
            locale,
            theme,
            viewport: "desktop",
          });
          let enabled = false;
          await page.route("**/api/features", (route) =>
            route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify({ agents_api: { enabled } }),
            }),
          );
          observations[app] = await observeDisabledTooltip(
            page,
            label,
            reason,
            app,
            testInfo,
          );
          // Re-open with the keyboard. The real document mount query reads the
          // changed capability; component tests separately cover same-owner retirement.
          await page.keyboard.press("Shift+Tab");
          await expect(
            page.locator('[data-slot="tooltip-content"]:visible'),
          ).toHaveCount(1);
          enabled = true;
          await refreshThroughDocumentMount(page);
          const sidebar = page.locator('[data-sidebar="sidebar"]');
          await expect(
            sidebar.locator('a[href="/workspace/agents"]'),
          ).toBeVisible();
          await expect(
            sidebar.getByRole("button", { name: label, exact: true }),
          ).toHaveCount(0);
          await expect(
            page.locator('[data-slot="tooltip-content"]:visible'),
          ).toHaveCount(0);
          enabled = false;
          await refreshThroughDocumentMount(page);
          await expect(
            sidebar.getByRole("button", { name: label, exact: true }),
          ).toBeVisible();
          await expect(
            page.locator('[data-slot="tooltip-content"]:visible'),
          ).toHaveCount(0);
          await sidebar.locator('a[href="/workspace/chats"]').focus();
          await waitForDomQuiet(page);
          await page.keyboard.press("Tab");
          await expect(
            page.locator('[data-slot="tooltip-content"]:visible'),
          ).toHaveCount(1);
          await page.keyboard.press("Escape");
          await expect(
            page.locator('[data-slot="tooltip-content"]:visible'),
          ).toHaveCount(0);
          expect(errors).toEqual([]);
          await testInfo.attach(`${app}-disabled-agents.png`, {
            body: await page.screenshot(),
            contentType: "image/png",
          });
        } finally {
          await context.close();
        }
      }
      await testInfo.attach("disabled-tooltip-comparison.json", {
        body: JSON.stringify(observations, null, 2),
        contentType: "application/json",
      });
      expect(observations.vue).toEqual(observations.react);
    });
