import { expect, test } from "./support/test";

import { PARITY_CONTEXT_OPTIONS } from "./support/context-options";
import {
  DEFAULT_DIMENSION,
  PARITY_SCENARIOS,
  runScenario,
  scenarioStates,
} from "./support/scenarios";
import { waitForDomQuiet, waitForFiniteAnimations } from "./support/settle";

const APPS = [
  ["vue", process.env.E2E_APP_URL ?? "http://localhost:3115"],
  ["react", process.env.E2E_REACT_APP_URL ?? "http://localhost:3116"],
] as const;

for (const [app, base] of APPS)
  test(`${app}: empty timelines add no invisible native scroll stop and regain message spacing`, async ({
    browser,
  }) => {
    test.setTimeout(180_000);
    const failures: string[] = [];
    for (const [id, stateId] of [
      ["chat", ""],
      ["sidebar", "default"],
    ] as const)
      for (const [width, height, rootPx] of [
        [1280, 720, 16],
        [360, 800, 16],
        [360, 360, 32],
      ] as const)
        for (const direction of ["Tab", "Shift+Tab"] as const) {
          const scenario = PARITY_SCENARIOS.find((entry) => entry.id === id)!;
          const state = scenarioStates(scenario).find(
            (entry) => entry.id === stateId,
          )!;
          const key = `${id} ${width}x${height}/${rootPx} ${direction}`;
          const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
          const page = await context.newPage();
          const unmatched: string[] = [];
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
            await waitForFiniteAnimations(page);
            await waitForDomQuiet(page);
            await page.setViewportSize({ width, height });
            await page.addStyleTag({
              content: `html{font-size:${rootPx}px!important}`,
            });
            await waitForFiniteAnimations(page);
            await waitForDomQuiet(page);
            const empty = await page
              .getByTestId("main-message-list")
              .evaluate((element) => {
                const port = element.firstElementChild!;
                return {
                  clientHeight: port.clientHeight,
                  scrollHeight: port.scrollHeight,
                  overflow: getComputedStyle(port).overflowY,
                };
              });
            if (empty.scrollHeight > empty.clientHeight)
              failures.push(
                `${key}: empty timeline scrollHeight ${empty.scrollHeight} exceeds capacity ${empty.clientHeight}`,
              );
            if (empty.overflow !== "auto")
              failures.push(`${key}: native scrolling was removed`);
            // Keep both original batches, with a fresh context for every direction.
            for (const count of [30, 10])
              for (let index = 0; index < count; index += 1) {
                await page.keyboard.press(direction);
                const active = await page.evaluate(() => {
                  const element = document.activeElement;
                  if (
                    !element ||
                    element === document.body ||
                    element === document.documentElement
                  )
                    return null;
                  const box = element.getBoundingClientRect();
                  return {
                    tag: element.tagName,
                    width: box.width,
                    height: box.height,
                  };
                });
                if (active && (active.width <= 0 || active.height <= 0))
                  failures.push(
                    `${key}: native focus landed on ${active.tag} ${active.width}x${active.height}`,
                  );
              }
            // Exercise the same empty owner becoming an actual conversation, rather
            // than removing or disabling the scroll container to hide the defect.
            await page.locator("textarea").fill("Hello");
            await page.locator("textarea").press("Enter");
            await expect(
              page.getByText("Hello from DeerFlow!", { exact: true }),
            ).toBeVisible();
            await expect(page.getByText(/^(Took|用时) /).first()).toBeVisible();
            await waitForFiniteAnimations(page);
            await waitForDomQuiet(page);
            const occupied = await page
              .getByTestId("main-message-list")
              .evaluate((element) => {
                const port = element.firstElementChild!;
                const content = port.firstElementChild!;
                return {
                  height: port.clientHeight,
                  overflow: getComputedStyle(port).overflowY,
                  topPadding: Number.parseFloat(
                    getComputedStyle(content).paddingTop,
                  ),
                  groups: content.querySelectorAll("[data-message-group-index]")
                    .length,
                };
              });
            if (
              occupied.height <= 0 ||
              occupied.groups < 2 ||
              occupied.topPadding <= 0 ||
              occupied.overflow !== "auto"
            )
              failures.push(
                `${key}: populated timeline lost capacity or spacing ${JSON.stringify(occupied)}`,
              );
            if (unmatched.length)
              failures.push(
                `${key}: unmatched API ${JSON.stringify(unmatched)}`,
              );
          } catch (error) {
            failures.push(`${key}: ${String(error)}`);
          } finally {
            await context.close();
          }
        }
    expect(failures).toEqual([]);
  });
