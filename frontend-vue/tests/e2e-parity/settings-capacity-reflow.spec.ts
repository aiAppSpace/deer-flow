import { expect, test } from "./support/test";

import { PARITY_CONTEXT_OPTIONS } from "./support/context-options";
import { surveyReflow } from "./support/reflow-survey";
import { waitForDomQuiet, waitForFiniteAnimations } from "./support/settle";
import {
  DEFAULT_DIMENSION,
  PARITY_SCENARIOS,
  runScenario,
  scenarioStates,
} from "./support/scenarios";

const APPS = [
  ["vue", process.env.E2E_APP_URL ?? "http://localhost:3115"],
  ["react", process.env.E2E_REACT_APP_URL ?? "http://localhost:3116"],
] as const;
const STATES = [
  "model-management#add",
  "model-management#edit-preserve-secret",
  "settings-memory-import#invalid-1",
  "settings-memory-import#imported",
  "channels#settings-panel",
  "channels#settings-panel-connected",
  "settings-sync#account-preference",
  "settings-sync#restored",
];

for (const [app, base] of APPS)
  for (const key of STATES)
    test(`${app}: ${key} preserves a native modal path for complete enlarged controls`, async ({
      browser,
    }) => {
      const [scenarioId, stateId] = key.split("#");
      const scenario = PARITY_SCENARIOS.find((item) => item.id === scenarioId)!;
      const state = scenarioStates(scenario).find(
        (item) => item.id === stateId,
      )!;
      const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
      const page = await context.newPage();
      const unmatched: string[] = [];
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.route("**/api/**", async (route) => {
        unmatched.push(
          `${route.request().method()} ${new URL(route.request().url()).pathname}`,
        );
        await route.abort("blockedbyclient");
      });
      try {
        await runScenario(
          page,
          base,
          scenario,
          DEFAULT_DIMENSION,
          state,
          30_000,
        );
        await page.setViewportSize({ width: 360, height: 800 });
        await page.addStyleTag({ content: "html{font-size:32px!important}" });
        await waitForFiniteAnimations(page);
        await waitForDomQuiet(page);

        // Fixed chrome must not leave a field/button taller than its only
        // scrollport. The constrained modal itself is the narrow fallback owner.
        const dialog = page.getByRole("dialog");
        await expect(dialog).toHaveCount(1);
        const owner = await dialog.elementHandle();
        const before = await dialog.evaluate((element) => ({
          top: element.scrollTop,
          client: element.clientHeight,
          content: element.scrollHeight,
        }));
        expect(before.content).toBeGreaterThan(before.client);
        await dialog.hover();
        await page.mouse.wheel(0, 800);
        await expect
          .poll(() => dialog.evaluate((element) => element.scrollTop))
          .toBeGreaterThan(before.top);
        expect(
          await dialog.evaluate(
            (element, original) => element === original,
            owner,
          ),
        ).toBe(true);

        // Measure the tallest actual input/action, rather than an easy nav or
        // close button. A real keyboard exit/reentry must reveal it completely.
        const controls = dialog.locator(
          "button:not([disabled]),input:not([disabled]):not([type=hidden]),textarea:not([disabled])",
        );
        const largest = await controls.evaluateAll((elements) => {
          let index = -1;
          let height = 0;
          elements.forEach((element, candidate) => {
            const rect = element.getBoundingClientRect();
            if (rect.width > 0 && rect.height > height) {
              index = candidate;
              height = rect.height;
            }
          });
          return { index, height };
        });
        expect(largest.index).toBeGreaterThanOrEqual(0);
        expect(largest.height).toBeGreaterThan(0);
        const control = controls.nth(largest.index);
        await control.focus();
        await expect(control).toBeFocused();
        await page.keyboard.press("Shift+Tab");
        await page.keyboard.press("Tab");
        await expect(control).toBeFocused();
        await expect(control).toBeInViewport({ ratio: 1 });

        const survey = await page.evaluate(surveyReflow, 24);
        expect(survey.width).toBe(360);
        expect(survey.rootPx).toBe(32);
        expect(survey.documentOverflowX).toBe(0);
        expect(survey.nonDeliberateHorizontalScrollers).toEqual([]);
        expect(survey.lostControls).toEqual([]);
        expect(survey.unreachableClips).toEqual([]);
        expect(unmatched, "all scenario APIs must remain mocked").toEqual([]);
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    });
