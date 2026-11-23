import { expect, test } from "./support/test";

import { PARITY_CONTEXT_OPTIONS } from "./support/context-options";
import { surveyOverlayGeometry } from "./support/overlay-survey";
import {
  DEFAULT_DIMENSION,
  PARITY_SCENARIOS,
  runScenario,
  scenarioStates,
} from "./support/scenarios";
import { waitForDomQuiet, waitForFiniteAnimations } from "./support/settle";

for (const [app, base] of [
  ["vue", process.env.E2E_APP_URL ?? "http://localhost:3115"],
  ["react", process.env.E2E_REACT_APP_URL ?? "http://localhost:3116"],
] as const)
  test(`${app}: reasoning menu keeps its native trigger and selection across the mobile breakpoint`, async ({
    browser,
  }) => {
    const scenario = PARITY_SCENARIOS.find(
      (entry) => entry.id === "settings-model-sync",
    )!;
    for (const locale of ["en-US", "zh-CN"] as const) {
      const state = scenarioStates(scenario).find(
        (entry) =>
          entry.id ===
          (locale === "zh-CN"
            ? "thread-model-and-account-effort-zh"
            : "thread-model-and-account-effort"),
      )!;
      const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
      const page = await context.newPage();
      try {
        await runScenario(
          page,
          base,
          scenario,
          { ...DEFAULT_DIMENSION, locale },
          state,
          30_000,
        );
        const menu = page.getByRole("menu");
        await expect(menu).toHaveCount(1);
        const menuId = await menu.getAttribute("id");
        expect(menuId).toBeTruthy();
        const linkedTrigger = page.locator(`button[aria-controls="${menuId}"]`);
        const triggerId = await linkedTrigger.getAttribute("id");
        expect(triggerId).toBeTruthy();
        const trigger = page.locator(`button[id="${triggerId}"]`);
        await expect(trigger).toBeVisible();
        await expect(trigger).toHaveAttribute("aria-expanded", "true");
        await page.setViewportSize({ width: 375, height: 812 });
        await waitForFiniteAnimations(page);
        await waitForDomQuiet(page);
        await expect(trigger).toBeVisible();
        await expect(menu).toBeVisible();
        await expect(menu).toHaveAttribute("id", menuId!);
        expect((await page.evaluate(surveyOverlayGeometry, 64)).bad).toEqual(
          [],
        );
        await menu.getByRole("menuitemradio", { name: /^(High|高) / }).click();
        await expect(menu).toBeHidden();
        await expect(trigger).toContainText(locale === "zh-CN" ? "高" : "High");
        await page.setViewportSize({ width: 1280, height: 800 });
        await trigger.click();
        await expect(menu).toBeVisible();
        await expect(
          menu.getByRole("menuitemradio", { name: /^(High|高) / }),
        ).toHaveAttribute("aria-checked", "true");
        await page.keyboard.press("Escape");
        await expect(menu).toBeHidden();
        await expect(trigger).toBeFocused();
      } finally {
        await context.close();
      }
    }
  });
