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
  for (const id of ["capability-center", "settings-memory-import"] as const)
    test(`${app}: ${id} controls retain desktop geometry and fit narrow enlarged text`, async ({
      browser,
    }) => {
      test.setTimeout(120_000);
      const scenario = PARITY_SCENARIOS.find((entry) => entry.id === id)!;
      expect(scenario.backend).toBe("mock");
      const states = scenarioStates(scenario).filter(
        (state) =>
          id === "settings-memory-import" || state.id === "migrated-settings",
      );
      expect(states.length).toBeGreaterThan(0);
      for (const state of states) {
        const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
        const page = await context.newPage();
        const unmatched: string[] = [];
        await page.route("**/api/**", async (route) => {
          const request = route.request();
          unmatched.push(
            `${request.method()} ${new URL(request.url()).pathname}`,
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
          if (id === "capability-center") {
            const cards = page.locator("button.group.flex.h-full");
            await expect(cards).toHaveCount(3);
            for (const card of await cards.all()) {
              const box = (await card.boundingBox())!;
              expect(box.width).toBe(264);
              expect(box.height).toBe(278);
            }
          } else {
            const filter = page.locator('[data-slot="toggle-group"]');
            await expect(filter).toHaveCount(1);
            expect((await filter.boundingBox())!.height).toBe(36);
            const actions = page
              .locator('[role="dialog"] input[type="file"]')
              .locator("..")
              .locator(":scope > button");
            await expect(actions).toHaveCount(4);
            for (const action of await actions.all())
              expect((await action.boundingBox())!.height).toBe(36);
          }

          const dialogsBefore = await page.locator('[role="dialog"]').count();
          await page.setViewportSize({ width: 360, height: 800 });
          await page.addStyleTag({ content: "html{font-size:32px!important}" });
          await waitForFiniteAnimations(page);
          await waitForDomQuiet(page);
          expect(await page.locator('[role="dialog"]').count()).toBe(
            dialogsBefore,
          );
          const survey = await page.evaluate(surveyReflow, 24);
          expect(survey.width).toBe(360);
          expect(survey.rootPx).toBe(32);
          expect(survey.documentOverflowX).toBe(0);
          expect(survey.nonDeliberateHorizontalScrollers).toEqual([]);
          expect(survey.lostControls).toEqual([]);
          expect(survey.unreachableClips).toEqual([]);
          expect(unmatched, `${id}#${state.id}: all APIs mocked`).toEqual([]);
        } finally {
          await context.close();
        }
      }
    });
