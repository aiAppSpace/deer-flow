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

for (const [app, base] of APPS)
  for (const id of ["scheduled-task-chat-card", "scheduled-task-chat-events"])
    for (const locale of ["en-US", "zh-CN"] as const)
      test(`${app}: ${id} ${locale} retains complete scheduled actions at narrow enlarged text`, async ({
        browser,
      }) => {
        const scenario = PARITY_SCENARIOS.find((entry) => entry.id === id)!;
        const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
        const page = await context.newPage();
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        try {
          await runScenario(
            page,
            base,
            scenario,
            { ...DEFAULT_DIMENSION, locale },
            scenarioStates(scenario)[0],
            30_000,
          );
          const cards = page.getByTestId("scheduled-task-card");
          const scroller = page
            .getByTestId("main-message-list")
            .locator(":scope > div");
          const originalScroller = await scroller.elementHandle();
          const count = await cards.count();
          expect(count).toBeGreaterThan(0);
          for (const control of await cards
            .locator("footer :is(button,a)")
            .all())
            expect((await control.boundingBox())!.height).toBe(32);

          await page.setViewportSize({ width: 360, height: 800 });
          await page.addStyleTag({ content: "html{font-size:32px!important}" });
          await waitForFiniteAnimations(page);
          await waitForDomQuiet(page);
          const survey = await page.evaluate(surveyReflow, 24);
          expect(survey.width).toBe(360);
          expect(survey.rootPx).toBe(32);
          expect(survey.documentOverflowX).toBe(0);
          expect(survey.nonDeliberateHorizontalScrollers).toEqual([]);
          expect(survey.lostControls).toEqual([]);
          expect(survey.unreachableClips).toEqual([]);
          expect(await cards.count()).toBe(count);
          expect(
            await scroller.evaluate(
              (element, original) => element === original,
              originalScroller,
            ),
          ).toBe(true);

          // Browse history through its native scroller before tabbing its
          // actions, rather than racing the initial tail-following animation.
          await scroller.hover();
          await page.mouse.wheel(0, -1_000);
          await waitForDomQuiet(page);
          const moreSteps =
            locale === "en-US" ? "1 more step" : "查看其他 1 个步骤";
          const lessSteps = locale === "en-US" ? "Less steps" : "隐藏步骤";
          const earlier = page.getByRole("button", {
            name: new RegExp(`^(?:${moreSteps}|${lessSteps})$`),
          });
          await expect(earlier).toHaveAccessibleName(moreSteps);
          const earlierTextFits = () =>
            earlier.evaluate((element) => {
              const box = element.getBoundingClientRect();
              const walker = document.createTreeWalker(
                element,
                NodeFilter.SHOW_TEXT,
              );
              for (
                let node = walker.nextNode();
                node;
                node = walker.nextNode()
              ) {
                if (!node.textContent?.trim()) continue;
                const range = document.createRange();
                range.selectNodeContents(node);
                if (
                  Array.from(range.getClientRects()).some(
                    (line) =>
                      line.left < box.left - 0.5 ||
                      line.right > box.right + 0.5 ||
                      line.top < box.top - 0.5 ||
                      line.bottom > box.bottom + 0.5,
                  )
                )
                  return false;
              }
              return true;
            });
          expect(await earlierTextFits()).toBe(true);
          await earlier.focus();
          await waitForDomQuiet(page);
          await page.keyboard.press("Shift+Tab");
          await waitForDomQuiet(page);
          await expect(earlier).not.toBeFocused();
          await page.keyboard.press("Tab");
          await waitForDomQuiet(page);
          await expect(earlier).toBeFocused();
          await expect(earlier).toBeInViewport({ ratio: 1 });
          await page.keyboard.press("Enter");
          await expect(earlier).toHaveAccessibleName(lessSteps);
          await page.keyboard.press("Enter");
          await expect(earlier).toHaveAccessibleName(moreSteps);
          // Wrapping follows the available inline size, not the 360px survey
          // viewport. Keep a second width above its diagnostic breakpoint.
          await page.setViewportSize({ width: 375, height: 800 });
          await waitForDomQuiet(page);
          expect(await earlierTextFits()).toBe(true);
          await page.setViewportSize({ width: 360, height: 800 });
          await waitForDomQuiet(page);
          const run = cards.first().getByRole("button", {
            name: locale === "en-US" ? "Run once now" : "立即试运行",
            exact: true,
          });
          await run.focus();
          await waitForDomQuiet(page);
          await page.keyboard.press("Shift+Tab");
          await waitForDomQuiet(page);
          await expect(run).not.toBeFocused();
          await page.keyboard.press("Tab");
          await waitForDomQuiet(page);
          await expect(run).toBeFocused();
          await expect(run).toBeInViewport({ ratio: 1 });

          for (const control of await cards
            .locator("footer :is(button,a)")
            .all()) {
            if (await control.isDisabled()) continue;
            await control.focus();
            await waitForDomQuiet(page);
            await page.keyboard.press("Shift+Tab");
            await waitForDomQuiet(page);
            await expect(control).not.toBeFocused();
            await page.keyboard.press("Tab");
            await waitForDomQuiet(page);
            await expect(control).toBeFocused();
            const geometry = await control.evaluate((element) => {
              const rect = element.getBoundingClientRect();
              let left = 0,
                right = innerWidth,
                top = 0,
                bottom = innerHeight;
              for (
                let parent = element.parentElement;
                parent;
                parent = parent.parentElement
              ) {
                const style = getComputedStyle(parent);
                const bounds = parent.getBoundingClientRect();
                if (/^(auto|scroll|hidden|clip)$/.test(style.overflowX)) {
                  left = Math.max(left, bounds.left + parent.clientLeft);
                  right = Math.min(
                    right,
                    bounds.left + parent.clientLeft + parent.clientWidth,
                  );
                }
                if (/^(auto|scroll|hidden|clip)$/.test(style.overflowY)) {
                  top = Math.max(top, bounds.top + parent.clientTop);
                  bottom = Math.min(
                    bottom,
                    bounds.top + parent.clientTop + parent.clientHeight,
                  );
                }
              }
              const range = document.createRange();
              range.selectNodeContents(element);
              const content = Array.from(range.getClientRects());
              return {
                visible:
                  rect.left >= left - 0.5 &&
                  rect.right <= right + 0.5 &&
                  rect.top >= top - 0.5 &&
                  rect.bottom <= bottom + 0.5,
                completeText: content.every(
                  (line) =>
                    line.left >= rect.left - 0.5 &&
                    line.right <= rect.right + 0.5 &&
                    line.top >= rect.top - 0.5 &&
                    line.bottom <= rect.bottom + 0.5,
                ),
              };
            });
            // Match the existing survey's half-pixel native scroll boundary;
            // exact IntersectionObserver ratio remains asserted for Run above.
            expect(geometry).toEqual({ visible: true, completeText: true });
          }
          expect(errors).toEqual([]);
        } finally {
          await context.close();
        }
      });
