import { expect, test, type Browser, type Page } from "./support/test";

import { PARITY_CONTEXT_OPTIONS } from "./support/context-options";
import {
  PARITY_SCENARIOS,
  runScenario,
  scenarioStates,
} from "./support/scenarios";

async function openScenario(
  browser: Browser,
  base: string,
  id: string,
  stateId = "",
) {
  const context = await browser.newContext({
    ...PARITY_CONTEXT_OPTIONS,
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();
  const unexpected: string[] = [];
  await page.route("**/api/**", (route) => {
    unexpected.push(`${route.request().method()} ${route.request().url()}`);
    return route.abort();
  });
  const scenario = PARITY_SCENARIOS.find((entry) => entry.id === id)!;
  const state = scenarioStates(scenario).find((entry) => entry.id === stateId)!;
  try {
    await runScenario(page, base, scenario, undefined, state);
  } catch (error) {
    await context.close();
    throw error;
  }
  return { page, context, unexpected };
}

async function tabBackToInput(page: Page) {
  let reached = false;
  for (let step = 0; step < 18; step++) {
    await page.keyboard.press("Tab");
    if (
      await page
        .locator("textarea[name=message]")
        .evaluate((element) => element === element.ownerDocument.activeElement)
    ) {
      reached = true;
      break;
    }
  }
  expect(
    reached,
    "The actual input must remain reachable through the open reference picker",
  ).toBe(true);
}

for (const [app, base] of [
  ["vue", process.env.E2E_APP_URL ?? "http://localhost:3115"],
  ["react", process.env.E2E_REACT_APP_URL ?? "http://localhost:3116"],
] as const) {
  test(`${app}: toast lifetime and native Tab preserve the entry control`, async ({
    browser,
  }) => {
    const { page, context, unexpected } = await openScenario(
      browser,
      base,
      "skills-settings",
      "toggle-error",
    );
    try {
      const notice = page.locator("li").filter({ hasText: "Toggle rejected" });
      await expect(notice).toHaveCount(1);
      await expect(notice).toHaveAttribute("tabindex", "0");
      await expect(notice).not.toHaveAttribute("role");
      await expect(notice).not.toHaveAttribute("aria-live");
      await notice.hover();
      // This exceeds the unchanged 4000ms lifetime; hover must pause that existing clock.
      await page.waitForTimeout(4100);
      await expect(notice).toBeVisible();
      const trigger = page.getByRole("switch", { name: /deep-research$/ });
      await trigger.focus();
      await page.keyboard.press("Alt+KeyT");
      await page.keyboard.press("Tab");
      await expect(notice).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(notice).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await expect(trigger).toBeFocused();
      expect(unexpected).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test(`${app}: button-open references survive Tab and close on an outside pointer`, async ({
    browser,
  }) => {
    const { page, context, unexpected } = await openScenario(
      browser,
      base,
      "mentions",
      "all-reference-kinds",
    );
    try {
      await tabBackToInput(page);
      const picker = page.getByTestId("mention-picker");
      const host = page.locator("main .z-30").filter({
        has: page.locator("textarea[name=message]"),
      });
      await expect(picker).toBeVisible();
      await expect(host).toHaveCSS("z-index", "50");
      await expect(
        page.getByRole("button", { name: "Surprise", exact: true }),
      ).toHaveCount(0);
      await page
        .getByRole("button", { name: "Toggle Sidebar", exact: true })
        .first()
        .click();
      await expect(picker).toHaveCount(0);
      await expect(host).toHaveCSS("z-index", "30");
      await expect(
        page.getByRole("button", { name: "Surprise", exact: true }),
      ).toBeVisible();
      await page.getByTestId("mention-button").click();
      await page
        .getByRole("option", { name: "report.pdf", exact: true })
        .click();
      await expect(page.getByTestId("project-attachment-chip")).toContainText(
        "report.pdf",
      );
      await expect(
        page.getByRole("button", { name: "Surprise", exact: true }),
      ).toHaveCount(0);
      expect(unexpected).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test(`${app}: completed shelf attachments retain the empty input and removable chip`, async ({
    browser,
  }) => {
    const { page, context, unexpected } = await openScenario(
      browser,
      base,
      "project-document-attach",
    );
    try {
      const input = page.locator("textarea[name=message]");
      await expect(input).toHaveCount(1);
      await expect(input).toHaveValue("");
      await expect(page.locator("[role=textbox][contenteditable]")).toHaveCount(
        0,
      );
      const chip = page.getByTestId("project-attachment-chip");
      await expect(chip).toContainText("report.docx");
      await expect(
        page
          .locator("header")
          .getByRole("link", { name: "Quarterly research", exact: true }),
      ).toBeVisible();
      await chip
        .getByRole("button", { name: "Remove attached document", exact: true })
        .click();
      await expect(chip).toHaveCount(0);
      await expect(input).toHaveValue("");
      expect(unexpected).toEqual([]);
    } finally {
      await context.close();
    }
  });
}
