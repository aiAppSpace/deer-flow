import { expect, test } from "./support/test";
import { PARITY_CONTEXT_OPTIONS } from "./support/context-options";
import {
  DEFAULT_DIMENSION,
  PARITY_SCENARIOS,
  runScenario,
  scenarioStates,
} from "./support/scenarios";

for (const [app, base] of [
  ["vue", process.env.E2E_APP_URL ?? "http://localhost:3115"],
  ["react", process.env.E2E_REACT_APP_URL ?? "http://localhost:3116"],
] as const) {
  test(`${app}: current deletion hands focus to the usable new composer`, async ({
    browser,
  }) => {
    const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
    try {
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const scenario = PARITY_SCENARIOS.find(
        (item) => item.id === "thread-delete-confirm",
      )!;
      const state = scenarioStates(scenario).find(
        (item) => item.id === "deleted",
      )!;
      await runScenario(page, base, scenario, DEFAULT_DIMENSION, state, 30_000);
      await expect(
        page.getByRole("dialog", { name: "Delete chat", exact: true }),
      ).toHaveCount(0);
      await expect(page).toHaveURL(/\/workspace\/chats\/new$/);
      await expect(
        page.locator(`[data-sidebar="sidebar"] a[href="${scenario.path}"]`),
      ).toHaveCount(0);
      const composer = page.getByRole("textbox", {
        name: "How can I assist you today?",
        exact: true,
      });
      await expect(composer).toBeEnabled();
      await expect(composer).toBeFocused();
      await page.keyboard.type("A fresh conversation");
      await expect(composer).toHaveValue("A fresh conversation");
      await page.keyboard.press("Tab");
      await expect(composer).not.toBeFocused();
      expect(
        await page.evaluate(
          () =>
            document.activeElement instanceof HTMLElement &&
            document.activeElement !== document.body &&
            document.activeElement.isConnected,
        ),
      ).toBe(true);
      await page.keyboard.press("Shift+Tab");
      await expect(composer).toBeFocused();
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}
