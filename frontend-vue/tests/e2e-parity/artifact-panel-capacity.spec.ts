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
  test(`${app}: a long artifact keeps physical scroll capacity at low height`, async ({
    browser,
  }) => {
    const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
    const page = await context.newPage();
    try {
      const scenario = PARITY_SCENARIOS.find(
        (entry) => entry.id === "showcase-fe3f7974-1bcb-4a01-a950-79673baafefd",
      )!;
      const state = scenarioStates(scenario).find(
        (entry) => entry.id === "report-preview",
      )!;
      await runScenario(page, base, scenario, DEFAULT_DIMENSION, state, 30_000);
      for (const width of [1280]) {
        for (const rootPx of [16]) {
          await page.setViewportSize({ width, height: 360 });
          await page.addStyleTag({
            content: `html { font-size: ${rootPx}px !important; }`,
          });
          await waitForFiniteAnimations(page);
          await waitForDomQuiet(page);
          const panel = page.locator('#artifacts [class~="@container"]');
          await expect(panel).toHaveCount(1);
          const capacity = await panel.evaluate((element) => ({
            clientHeight: element.clientHeight,
            height: element.getBoundingClientRect().height,
          }));
          expect(capacity.clientHeight).toBeGreaterThan(0);
          expect(capacity.height).toBeLessThanOrEqual(360);
          const lastLink = panel.locator("a[href]").last();
          await expect(lastLink).toBeAttached();
          const route = await lastLink.evaluate((element) => {
            let owner = element.parentElement;
            while (owner) {
              const style = getComputedStyle(owner);
              if (
                ["auto", "scroll", "overlay"].includes(style.overflowY) &&
                owner.scrollHeight > owner.clientHeight + 1
              ) {
                const box = owner.getBoundingClientRect();
                const control = element.getBoundingClientRect();
                return {
                  x: box.x,
                  y: box.y,
                  width: box.width,
                  height: box.height,
                  delta:
                    (control.top + control.bottom - box.top - box.bottom) / 2,
                };
              }
              owner = owner.parentElement;
            }
            return null;
          });
          expect(
            route,
            "the full report needs an actual user scroll owner",
          ).not.toBeNull();
          await page.mouse.move(
            route!.x + route!.width / 2,
            route!.y + route!.height / 2,
          );
          await page.mouse.wheel(0, route!.delta);
          await expect(lastLink).toBeInViewport({ ratio: 1 });
          const bounds = await lastLink.boundingBox();
          expect(bounds!.height).toBeGreaterThan(0);
          expect(bounds!.height).toBeLessThanOrEqual(360);
        }
      }
    } finally {
      await context.close();
    }
  });
}
