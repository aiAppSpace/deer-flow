import { expect, test } from "./support/test";

import { PARITY_CONTEXT_OPTIONS } from "./support/context-options";
import { surveyReflow } from "./support/reflow-survey";
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
  test(`${app}: chat rows keep their original scroll owner through low-height text reflow`, async ({
    browser,
  }) => {
    for (const [scenarioId, stateId] of [
      ["thread-archive", ""],
      ["thread-list-infinite-scroll", ""],
      ["thread-activity", "unread-list"],
    ] as const) {
      const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
      const page = await context.newPage();
      const unmatched: string[] = [];
      await page.route("**/api/**", async (route) => {
        unmatched.push(
          `${route.request().method()} ${new URL(route.request().url()).pathname}`,
        );
        await route.abort();
      });
      try {
        const scenario = PARITY_SCENARIOS.find(
          (entry) => entry.id === scenarioId,
        )!;
        const state = scenarioStates(scenario).find(
          (entry) => entry.id === stateId,
        )!;
        await runScenario(
          page,
          base,
          scenario,
          DEFAULT_DIMENSION,
          state,
          30_000,
        );
        await waitForFiniteAnimations(page);
        await waitForDomQuiet(page);
        const port = page.locator('[data-slot="scroll-area-viewport"]');
        const originalPort = await port.elementHandle();
        expect(originalPort).not.toBeNull();
        const rows = port.locator('a[href*="/workspace/chats/"]');
        expect(await rows.count()).toBeGreaterThan(0);

        await page.setViewportSize({ width: 360, height: 360 });
        await page.addStyleTag({
          content: "html { font-size: 32px !important; }",
        });
        await waitForFiniteAnimations(page);
        await waitForDomQuiet(page);
        expect(
          await port.evaluate(
            (node, original) => node === original,
            originalPort,
          ),
        ).toBe(true);
        const capacity = await rows.first().evaluate((node) => ({
          row: node.getBoundingClientRect().height,
          viewport: node.closest('[data-slot="scroll-area-viewport"]')!
            .clientHeight,
        }));
        expect(capacity.row).toBeGreaterThan(0);
        expect(capacity.viewport).toBeGreaterThanOrEqual(capacity.row);
        expect(capacity.viewport).toBeLessThanOrEqual(360);

        await rows.first().focus();
        await page.keyboard.press("Shift+Tab");
        await page.keyboard.press("Tab");
        await expect(rows.first()).toBeFocused();
        await expect(rows.first()).toBeInViewport({ ratio: 1 });
        await rows.first().hover();
        await page.mouse.wheel(0, 360);
        await expect
          .poll(() => port.evaluate((node) => node.scrollTop))
          .toBeGreaterThan(0);

        const result = await page.evaluate(surveyReflow, 24);
        expect(result.documentOverflowX).toBe(0);
        expect(result.nonDeliberateHorizontalScrollers).toEqual([]);
        expect(result.lostControls).toEqual([]);
        expect(result.unreachableClips).toEqual([]);

        if (scenarioId === "thread-list-infinite-scroll") {
          await rows.first().focus();
          await page.keyboard.press("Shift+Tab");
          await page.keyboard.press("Tab");
          await expect(rows.first()).toBeInViewport({ ratio: 1 });
          await rows.first().hover();
          await page.mouse.wheel(
            0,
            await port.evaluate((node) => node.scrollHeight),
          );
          const virtualRows = port.locator("[data-index]");
          await expect.poll(() => virtualRows.count()).toBeGreaterThan(0);
          expect(await virtualRows.count()).toBeLessThan(100);
          expect(
            await port.evaluate(
              (node, original) => node === original,
              originalPort,
            ),
          ).toBe(true);
          const href = await virtualRows
            .locator('a[href*="/workspace/chats/"]')
            .first()
            .getAttribute("href");
          expect(href).not.toBeNull();
          const virtualLink = port.locator(`a[href="${href}"]`);
          await virtualLink.focus();
          await expect(virtualLink).toBeFocused();
          await expect(virtualLink).toBeInViewport({ ratio: 1 });
        }
        expect(unmatched).toEqual([]);
      } finally {
        await context.close();
      }
    }
  });
}
