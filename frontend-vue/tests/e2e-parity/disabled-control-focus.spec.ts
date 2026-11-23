import { expect, test } from "./support/test";
import { captureScenario } from "./support/capture";
import { PARITY_CONTEXT_OPTIONS } from "./support/context-options";
import {
  DEFAULT_DIMENSION,
  PARITY_SCENARIOS,
  scenarioStates,
} from "./support/scenarios";

const cases = [
  ["integrations", "install"],
  ["integrations", "install-error"],
  ["skill-export", "download"],
  ["plugin-icons", "uploaded-preview"],
] as const;

for (const [app, base] of [
  ["react", process.env.E2E_REACT_APP_URL ?? "http://localhost:3116"],
  ["vue", process.env.E2E_APP_URL ?? "http://localhost:3115"],
] as const) {
  for (const [id, terminal] of cases) {
    test(`${app}: ${id}#${terminal} recovers dialog focus and continues native keyboard`, async ({
      browser,
    }, info) => {
      const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
      try {
        const page = await context.newPage();
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        const scenario = PARITY_SCENARIOS.find((item) => item.id === id)!;
        const state = scenarioStates(scenario).find(
          (item) => item.id === terminal,
        )!;
        expect(scenario, id).toBeTruthy();
        expect(state, terminal).toBeTruthy();
        // Use the unchanged scenario's real actions, transport, and settling.
        // No test-side focus(), blur(), disabled edits, or request timing changes.
        const capture = await captureScenario(
          page,
          base,
          scenario,
          DEFAULT_DIMENSION,
          state,
        );
        const dialog = page.getByRole("dialog");
        await expect(dialog).toHaveCount(1);
        await expect(dialog).toBeFocused();
        const keyboard: unknown[] = [];
        for (const key of ["Tab", "Shift+Tab", "Tab", "Shift+Tab"]) {
          await page.keyboard.press(key);
          const focused = page.locator(":focus");
          await expect(focused).toBeVisible();
          await expect(focused).toBeEnabled();
          await expect(focused).toBeInViewport({ ratio: 1 });
          const target = await focused.evaluate((element) => ({
            tag: element.tagName,
            role: element.getAttribute("role"),
            name:
              element.getAttribute("aria-label") ?? element.textContent?.trim(),
            inside: element.closest('[role="dialog"]') !== null,
            isDialog: element.getAttribute("role") === "dialog",
          }));
          expect(target.inside, JSON.stringify(target)).toBe(true);
          expect(target.isDialog, JSON.stringify(target)).toBe(false);
          keyboard.push({ key, target });
        }
        await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0);
        expect(errors).toEqual([]);
        await info.attach(`${app}-${id}-${terminal}-focus-contract`, {
          body: JSON.stringify(
            { app, id, terminal, capture, keyboard },
            null,
            2,
          ),
          contentType: "application/json",
        });
      } finally {
        await context.close();
      }
    });
  }
}
