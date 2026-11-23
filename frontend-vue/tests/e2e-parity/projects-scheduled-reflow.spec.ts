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
  ["project-workflows", "documents"],
  ["project-document-upload", "uploaded"],
  ["project-document-archived", ""],
  ["project-document-promotion", ""],
  ["project-trash", "listing"],
  ["project-trash-content-conflict", ""],
  ["scheduled-tasks", "edit"],
  ["scheduled-task-chat-events", "lifecycle-event"],
] as const;

for (const [app, base] of APPS)
  for (const [id, stateId] of CASES)
    test(`${app}: ${id}#${stateId} preserves actions at narrow 200% text`, async ({
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
        if (id.startsWith("project-")) {
          const actions = page.locator("main").getByRole("button", {
            name: /^(Upload|Preview|Download|Attach to chat|Move to trash|Save to project|Restore|Delete permanently)$/,
          });
          expect(await actions.count()).toBeGreaterThan(0);
          for (const action of await actions.all())
            expect((await action.boundingBox())!.height).toBe(32);
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
        if (id === "scheduled-tasks") {
          const contexts = page
            .getByRole("group", {
              name: "Where runs happen",
            })
            .getByRole("button");
          await expect(contexts).toHaveCount(2);
          for (const action of await contexts.all()) {
            await action.scrollIntoViewIfNeeded();
            await expect(action).toBeInViewport({ ratio: 1 });
          }
        } else if (id === "scheduled-task-chat-events") {
          await expect(
            page.getByTestId("scheduled-task-card").first(),
          ).toBeVisible();
          const statuses = page.getByTestId("scheduled-task-card-status");
          expect(await statuses.count()).toBeGreaterThan(0);
          for (const status of await statuses.all()) {
            await status.scrollIntoViewIfNeeded();
            await expect(status).toBeInViewport({ ratio: 1 });
          }
        }
        expect(
          unmatched,
          "all API requests must use this state's mocks",
        ).toEqual([]);
      } finally {
        await context.close();
      }
    });
