import { expect, test } from "./support/test";
import { PARITY_CONTEXT_OPTIONS } from "./support/context-options";
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

for (const [app, base] of APPS)
  test(`${app}: expanded tool failure survives both mobile transitions and its copy actions remain reachable`, async ({
    browser,
  }) => {
    const scenario = PARITY_SCENARIOS.find(
      (entry) => entry.id === "tool-call-details",
    )!;
    expect(scenario.backend).toBe("mock");
    const state = scenarioStates(scenario).find(
      (entry) => entry.id === "bounded-error",
    )!;
    const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
    const page = await context.newPage();
    const unmatched: string[] = [];
    await page.route("**/api/**", async (route) => {
      const request = route.request();
      unmatched.push(`${request.method()} ${new URL(request.url()).pathname}`);
      await route.abort("blockedbyclient");
    });
    try {
      await runScenario(page, base, scenario, DEFAULT_DIMENSION, state, 30_000);
      const details = page.getByRole("button", {
        name: "Tool details: mcp_lookup (call-4389)",
        exact: true,
      });
      const error = page.getByRole("region", { name: "Error", exact: true });
      const originalError = await error.locator("pre").textContent();
      expect(originalError).toContain("denied:");
      for (const [width, rootPx] of [
        [360, 32],
        [1280, 16],
      ] as const) {
        await page.setViewportSize({ width, height: 800 });
        await page.addStyleTag({
          content: `html{font-size:${rootPx}px!important}`,
        });
        await waitForFiniteAnimations(page);
        await waitForDomQuiet(page);
        await expect(details).toHaveAttribute("aria-expanded", "true");
        await expect(
          page.getByRole("region", { name: "Input", exact: true }),
        ).toHaveCount(1);
        await expect(error).toHaveCount(1);
        expect(await error.locator("pre").textContent()).toBe(originalError);
        for (const name of ["Tool name", "Call ID", "Input", "Error"]) {
          const copy = page
            .getByRole("region", { name, exact: true })
            .getByRole("button", {
              name: `Copy to clipboard: ${name}`,
              exact: true,
            });
          await copy.scrollIntoViewIfNeeded();
          const geometry = await copy.evaluate((element) => {
            let scroller = element.parentElement;
            while (
              scroller &&
              !(
                ["auto", "scroll"].includes(
                  getComputedStyle(scroller).overflowY,
                ) && scroller.scrollHeight > scroller.clientHeight
              )
            ) {
              scroller = scroller.parentElement;
            }
            return {
              buttonHeight: element.getBoundingClientRect().height,
              scrollportHeight: scroller?.clientHeight ?? 0,
            };
          });
          expect(geometry.buttonHeight).toBeGreaterThan(0);
          expect(geometry.scrollportHeight).toBeGreaterThan(0);
          expect(geometry.buttonHeight).toBeLessThanOrEqual(
            geometry.scrollportHeight,
          );
          await copy.focus();
          await expect(copy).toBeFocused();
          // Enter through native keyboard navigation before measuring
          // reachability: programmatic focus may leave a fractional clip at
          // the scrollport edge after Playwright's programmatic scroll.
          await page.keyboard.press("Shift+Tab");
          await expect(copy).not.toBeFocused();
          await page.keyboard.press("Tab");
          await expect(copy).toBeFocused();
          await expect(copy).toBeInViewport({ ratio: 1 });
          // Exercise a real keyboard transition even if this control was
          // already focused before a breakpoint change. Playwright's
          // programmatic scroll alone does not exercise native focus scrolling.
          await page.keyboard.press("Shift+Tab");
          await expect(copy).not.toBeFocused();
          await page.keyboard.press("Tab");
          await expect(copy).toBeFocused();
          await expect(copy).toBeInViewport({ ratio: 1 });
        }
      }
      expect(unmatched, "every API request is mocked").toEqual([]);
    } finally {
      await context.close();
    }
  });
