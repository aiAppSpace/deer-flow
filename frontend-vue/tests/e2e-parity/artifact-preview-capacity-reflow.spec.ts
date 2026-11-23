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
  test(`${app}: report preview preserves complete enlarged links through its native panel path`, async ({
    browser,
  }) => {
    const scenario = PARITY_SCENARIOS.find(
      (item) => item.id === "showcase-fe3f7974-1bcb-4a01-a950-79673baafefd",
    )!;
    const state = scenarioStates(scenario).find(
      (item) => item.id === "report-preview",
    )!;
    const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await runScenario(
        page,
        base,
        scenario,
        state.dimensions?.[0] ?? scenario.dimensions?.[0] ?? DEFAULT_DIMENSION,
        state,
        30_000,
      );
      await page.setViewportSize({ width: 360, height: 800 });
      await page.addStyleTag({ content: "html{font-size:32px!important}" });
      await waitForFiniteAnimations(page);
      await waitForDomQuiet(page);
      // The published report contains this visible raw URL as well as a
      // separately named citation. Select the actual long action by its name.
      const link = page.getByRole("link", {
        name: /^https:\/\/www\.oreateai\.com\/blog\/navigating/,
      });
      await expect(link).toHaveCount(1);
      const original = await link.evaluate((element) => ({
        text: element.textContent,
        href: element.getAttribute("href"),
        height: element.getBoundingClientRect().height,
      }));
      expect(original.height).toBeGreaterThan(0);
      const owners = await link.evaluateHandle((element) => {
        const found: HTMLElement[] = [];
        for (
          let ancestor = element.parentElement;
          ancestor;
          ancestor = ancestor.parentElement
        ) {
          const style = getComputedStyle(ancestor);
          if (
            ["auto", "scroll"].includes(style.overflowY) &&
            ancestor.scrollHeight > ancestor.clientHeight + 1
          )
            found.push(ancestor);
        }
        return found;
      });
      const geometry = await owners.evaluate((elements) =>
        elements.map((element) => ({
          height: element.clientHeight,
          top: element.scrollTop,
        })),
      );
      // One bounded preview owner plus the existing whole-panel fallback.
      // The action must fit their real capacities without changing its text.
      expect(geometry.length).toBeGreaterThanOrEqual(2);
      expect(original.height).toBeLessThanOrEqual(geometry[0]!.height);
      expect(original.height).toBeLessThanOrEqual(geometry[1]!.height);
      const outer = await owners.evaluateHandle((elements) => elements[1]!);
      await outer.asElement()!.hover();
      await page.mouse.wheel(0, 1_000);
      await expect
        .poll(() => outer.evaluate((element) => element.scrollTop))
        .toBeGreaterThan(geometry[1]!.top);
      await link.focus();
      await expect(link).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Tab");
      await expect(link).toBeFocused();
      expect(
        await link.evaluate((element) => ({
          text: element.textContent,
          href: element.getAttribute("href"),
        })),
      ).toEqual({ text: original.text, href: original.href });
      expect(await outer.evaluate((element) => element.isConnected)).toBe(true);
      const survey = await page.evaluate(surveyReflow, 24);
      expect(survey.width).toBe(360);
      expect(survey.rootPx).toBe(32);
      expect(survey.documentOverflowX).toBe(0);
      expect(survey.nonDeliberateHorizontalScrollers).toEqual([]);
      expect(survey.lostControls).toEqual([]);
      expect(survey.unreachableClips).toEqual([]);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
