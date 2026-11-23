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
  for (const [scenarioId, stateId] of [
    ["showcase-fe3f7974-1bcb-4a01-a950-79673baafefd", "report-preview"],
    ["artifact-table-preview", ""],
    ["project-workflows", "instructions-saved"],
    ["project-workflows", "settings"],
  ]) {
    test(`${app}: ${scenarioId}#${stateId} retains complete mobile panel capacity`, async ({
      browser,
    }) => {
      const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
      try {
        const page = await context.newPage();
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        const scenario = PARITY_SCENARIOS.find(
          (item) => item.id === scenarioId,
        )!;
        const state = scenarioStates(scenario).find(
          (item) => item.id === stateId,
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
        for (const [height, rootPx] of [
          [360, 32],
          [800, 16],
          [800, 32],
        ]) {
          await page.setViewportSize({ width: 360, height: height! });
          await page.addStyleTag({
            content: `html{font-size:${rootPx}px!important}`,
          });
          await waitForFiniteAnimations(page);
          await waitForDomQuiet(page);
          const survey = await page.evaluate(surveyReflow, 24);
          expect(survey.width).toBe(360);
          expect(survey.rootPx).toBe(rootPx);
          expect(survey.documentOverflowX).toBe(0);
          expect(survey.nonDeliberateHorizontalScrollers).toEqual([]);
          expect(survey.lostControls).toEqual([]);
          expect(survey.unreachableClips).toEqual([]);
        }
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    });
  }
}
