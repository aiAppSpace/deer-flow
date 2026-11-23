import { expect, test } from "./support/test";

import { PARITY_CONTEXT_OPTIONS } from "./support/context-options";
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
] as const) {
  for (const key of [
    "capability-center#migrated-settings",
    "project-workflows#documents",
    "project-document-upload#trashed",
  ]) {
    test(`${app}: ${key} keeps complete low-height controls in a physical scrollport`, async ({
      browser,
    }) => {
      const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
      const page = await context.newPage();
      try {
        const [id, stateId] = key.split("#");
        const scenario = PARITY_SCENARIOS.find((entry) => entry.id === id)!;
        const state = scenarioStates(scenario).find(
          (entry) => entry.id === stateId,
        )!;
        await runScenario(
          page,
          base,
          scenario,
          state.dimensions?.[0] ??
            scenario.dimensions?.[0] ??
            DEFAULT_DIMENSION,
          state,
          30_000,
        );
        await page.setViewportSize({
          width: page.viewportSize()!.width,
          height: 360,
        });
        await waitForFiniteAnimations(page);
        await waitForDomQuiet(page);

        if (key.startsWith("capability-center")) {
          const dialog = page.getByRole("dialog");
          await expect(dialog).toHaveCount(1);
          const capacity = await dialog.evaluate((element) => ({
            client: element.clientHeight,
            content: element.scrollHeight,
            overflow: getComputedStyle(element).overflowY,
          }));
          expect(["auto", "scroll"]).toContain(capacity.overflow);
          expect(capacity.content).toBeGreaterThan(capacity.client);
          const cards = dialog.getByRole("button", {
            name: /^(System|Light|Dark)(?:\s|$)/,
          });
          await expect(cards).toHaveCount(3);
          for (const card of await cards.all()) {
            await card.focus();
            await page.keyboard.press("Shift+Tab");
            await page.keyboard.press("Tab");
            await expect(card).toBeFocused();
            await expect(card).toBeInViewport({ ratio: 1 });
          }
          const before = await dialog.evaluate((element) => element.scrollTop);
          const box = await dialog.boundingBox();
          await page.mouse.move(box!.x + 4, box!.y + box!.height / 2);
          await page.mouse.wheel(0, -1_000);
          await expect
            .poll(() => dialog.evaluate((element) => element.scrollTop))
            .toBeLessThan(before);
        } else {
          const panel = page.getByRole("tabpanel");
          await expect(panel).toHaveCount(1);
          const capacity = await panel.evaluate((element) => {
            const owner = element.closest(
              '[data-slot="scroll-area-viewport"]',
            )!;
            return {
              height: element.clientHeight,
              outer: owner.clientHeight,
              content: element.scrollHeight,
              overflow: getComputedStyle(element).overflowY,
            };
          });
          expect(capacity.height).toBeLessThanOrEqual(capacity.outer);
          expect(capacity.content).toBeGreaterThan(capacity.height);
          expect(["auto", "scroll"]).toContain(capacity.overflow);
          await page
            .getByRole("tab", { name: "Documents", exact: true })
            .focus();
          await page.keyboard.press("Tab");
          await expect(panel).toBeFocused();
          await expect(panel).toBeInViewport({ ratio: 1 });
          await page.keyboard.press("PageDown");
          await expect
            .poll(() => panel.evaluate((element) => element.scrollTop))
            .toBeGreaterThan(0);
        }
      } finally {
        await context.close();
      }
    });
  }
}
