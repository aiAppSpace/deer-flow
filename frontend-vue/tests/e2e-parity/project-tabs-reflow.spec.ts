/*
  Project navigation must remain reachable when narrow width and enlarged text
  meet. Both applications consume the same registered mock and keyboard flow.
*/
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
  test(`${app}: project tabs keep desktop geometry and remain reachable at narrow 200% text`, async ({
    browser,
  }) => {
    const scenario = PARITY_SCENARIOS.find(
      (entry) => entry.id === "project-detail",
    )!;
    expect(scenario.backend).toBe("mock");
    const state = scenarioStates(scenario)[0]!;
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
      const tablist = page.getByRole("tablist", { name: "Quarterly research" });
      const listBox = (await tablist.boundingBox())!;
      expect(listBox.height).toBe(36);
      const tabs = tablist.getByRole("tab");
      await expect(tabs).toHaveCount(4);
      for (const tab of await tabs.all()) {
        const box = (await tab.boundingBox())!;
        expect(box.height).toBe(29);
        expect(Math.abs(box.y - (listBox.y + 3.5))).toBeLessThan(0.1);
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
      for (const tab of await tabs.all()) {
        await tab.scrollIntoViewIfNeeded();
        await expect(tab).toBeInViewport({ ratio: 1 });
      }
      await tablist.getByRole("tab", { name: "Chats", exact: true }).focus();
      for (const name of ["Documents", "Instructions", "Settings"]) {
        await page.keyboard.press("ArrowRight");
        const tab = tablist.getByRole("tab", { name, exact: true });
        await expect(tab).toBeFocused();
        await expect(tab).toHaveAttribute("aria-selected", "true");
        await expect(tab).toBeInViewport({ ratio: 1 });
      }
      expect(unmatched, "every API request is mocked").toEqual([]);
    } finally {
      await context.close();
    }
  });
