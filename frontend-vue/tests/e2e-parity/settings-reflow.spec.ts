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

const APPS = [
  ["vue", process.env.E2E_APP_URL ?? "http://localhost:3115"],
  ["react", process.env.E2E_REACT_APP_URL ?? "http://localhost:3116"],
] as const;
const CASES = [
  ["scheduled-tasks", "create"],
  ["model-management", "directory"],
  ["agent-knowledge-binding", "selected-dataset"],
] as const;

for (const [app, base] of APPS)
  for (const [id, stateId] of CASES)
    test(`${app}: ${id} controls remain reachable at narrow 200% text`, async ({
      browser,
    }) => {
      const scenario = PARITY_SCENARIOS.find((entry) => entry.id === id)!;
      expect(scenario.backend).toBe("mock");
      const state = scenarioStates(scenario).find(
        (entry) => entry.id === stateId,
      )!;
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
        await runScenario(page, base, scenario, DEFAULT_DIMENSION, state);
        await waitForFiniteAnimations(page);
        await waitForDomQuiet(page);
        if (id === "scheduled-tasks") {
          const recipes = page
            .getByTestId("schedule-recipes")
            .getByRole("button");
          await expect(recipes).toHaveCount(4);
          for (const name of [
            "GitHub Trending daily",
            "Daily tech news digest",
            "GitHub Issue triage",
            "Weekly report",
          ]) {
            const recipe = page
              .getByTestId("schedule-recipes")
              .getByRole("button", { name, exact: true });
            await expect(recipe).toHaveCount(1);
            expect((await recipe.boundingBox())!.height).toBe(32);
          }
        } else if (id === "model-management") {
          for (const name of ["Add model", "Reload", "Edit model", "Disable"])
            expect(
              (await page
                .getByRole("button", { name, exact: true })
                .boundingBox())!.height,
            ).toBe(36);
        } else {
          expect((await page.getByRole("dialog").boundingBox())!.width).toBe(
            512,
          );
        }

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
        if (id === "agent-knowledge-binding") {
          const reset = page.getByRole("button", {
            name: "Use all knowledge bases",
            exact: true,
          });
          await reset.scrollIntoViewIfNeeded();
          await expect(reset).toBeInViewport({ ratio: 1 });
          await reset.click();
          await expect(
            page.getByText("Company policies", { exact: true }),
          ).toHaveCount(0);
          const save = page.getByRole("button", { name: "Save", exact: true });
          await save.focus();
          await expect(save).toBeInViewport({ ratio: 1 });
        }
        expect(
          unmatched,
          "all API requests must use this state's mocks",
        ).toEqual([]);
      } finally {
        await context.close();
      }
    });
