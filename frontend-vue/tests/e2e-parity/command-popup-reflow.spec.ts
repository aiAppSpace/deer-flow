import { expect, test, type Page } from "./support/test";

import { PARITY_CONTEXT_OPTIONS } from "./support/context-options";
import { surveyReflow } from "./support/reflow-survey";
import {
  DEFAULT_DIMENSION,
  MOBILE_DIMENSION,
  PARITY_SCENARIOS,
  runScenario,
  scenarioStates,
} from "./support/scenarios";
import { waitForDomQuiet, waitForFiniteAnimations } from "./support/settle";

async function assertCommandPlacement(page: Page) {
  const list = page.getByRole("listbox", { name: "Command suggestions" });
  await expect(list).toBeVisible();
  const host = page.locator("main .z-30").filter({
    has: page.locator("textarea[name=message]"),
  });
  await expect(host).toHaveCount(1);
  await expect(host).toHaveCSS("z-index", "50");
  // Inspect before a pointer or focus action can scroll/reopen the popup and
  // accidentally repair stale placement under the workspace header.
  await expect
    .poll(() =>
      list.evaluate((element) => {
        const popup = element.parentElement!;
        if (getComputedStyle(popup).position !== "absolute") return true;
        const box = element.getBoundingClientRect();
        const viewport = window.visualViewport;
        let top = viewport?.offsetTop ?? 0;
        let bottom = top + (viewport?.height ?? innerHeight);
        for (
          let ancestor = popup.parentElement?.parentElement;
          ancestor;
          ancestor = ancestor.parentElement
        ) {
          if (
            !/^(auto|scroll|hidden|clip)$/.test(
              getComputedStyle(ancestor).overflowY,
            )
          )
            continue;
          const rect = ancestor.getBoundingClientRect();
          top = Math.max(top, rect.top + ancestor.clientTop);
          bottom = Math.min(
            bottom,
            rect.top + ancestor.clientTop + ancestor.clientHeight,
          );
        }
        return (
          box.height > 0 && box.top >= top - 0.5 && box.bottom <= bottom + 0.5
        );
      }),
    )
    .toBe(true);
  const options = list.getByRole("option");
  await expect(options).toHaveCount(2);
  for (const option of await options.all()) {
    await option.click({ trial: true, timeout: 10_000 });
    await expect(option).toBeInViewport({ ratio: 1 });
  }
  const survey = await page.evaluate(surveyReflow, 24);
  expect(survey.documentOverflowX).toBeLessThanOrEqual(0.5);
  expect(survey.nonDeliberateHorizontalScrollers).toEqual([]);
  expect(survey.lostControls).toEqual([]);
  expect(survey.unreachableClips).toEqual([]);
}

for (const [app, base] of [
  ["vue", process.env.E2E_APP_URL ?? "http://localhost:3115"],
  ["react", process.env.E2E_REACT_APP_URL ?? "http://localhost:3116"],
] as const)
  test(`${app}: commands fit their native clipping region across locale and layout changes`, async ({
    browser,
  }) => {
    test.setTimeout(90_000);
    const scenario = PARITY_SCENARIOS.find((entry) => entry.id === "sidebar")!;
    const state = scenarioStates(scenario)[0]!;
    for (const locale of ["en-US", "zh-CN"] as const) {
      const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
      const page = await context.newPage();
      try {
        await runScenario(
          page,
          base,
          scenario,
          { ...DEFAULT_DIMENSION, locale },
          state,
          30_000,
        );
        for (const [width, height, rootPx] of [
          [1280, 800, 32],
          [360, 800, 32],
          [360, 560, 32],
          [1280, 800, 16],
        ] as const) {
          await page.setViewportSize({ width, height });
          await page.addStyleTag({
            content: `html{font-size:${rootPx}px!important}`,
          });
          await waitForFiniteAnimations(page);
          await waitForDomQuiet(page);
          await assertCommandPlacement(page);
        }
        const textarea = page.locator("textarea[name=message]");
        const host = page.locator("main .z-30").filter({ has: textarea });
        await textarea.fill("/co");
        await textarea.press("ArrowDown");
        await textarea.press("Tab");
        await expect(textarea).toHaveValue("/compact ");
        await expect(
          page.getByRole("listbox", { name: "Command suggestions" }),
        ).toHaveCount(0);
        await expect(host).toHaveCSS("z-index", "30");
        await textarea.fill("/");
        await assertCommandPlacement(page);
        await textarea.press("Escape");
        await expect(
          page.getByRole("listbox", { name: "Command suggestions" }),
        ).toHaveCount(0);
        await expect(host).toHaveCSS("z-index", "30");
      } finally {
        await context.close();
      }
    }
  });

for (const [app, base] of [
  ["vue", process.env.E2E_APP_URL ?? "http://localhost:3115"],
  ["react", process.env.E2E_REACT_APP_URL ?? "http://localhost:3116"],
] as const)
  test(`${app}: side chat footer preserves complete mode controls in a narrow sheet`, async ({
    browser,
  }) => {
    const scenario = PARITY_SCENARIOS.find(
      (entry) => entry.id === "sidecar-chat",
    )!;
    for (const state of scenarioStates(scenario)) {
      const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
      const page = await context.newPage();
      try {
        await runScenario(
          page,
          base,
          scenario,
          state.id === "mobile-sheet" ? MOBILE_DIMENSION : DEFAULT_DIMENSION,
          state,
          30_000,
        );
        await page.setViewportSize({ width: 360, height: 800 });
        await page.addStyleTag({ content: "html{font-size:32px!important}" });
        await waitForFiniteAnimations(page);
        await waitForDomQuiet(page);
        const mode = page
          .getByTestId("sidecar-panel")
          .getByRole("button", { name: "Flash", exact: true });
        expect(
          await mode.evaluate((element) => {
            const box = element.getBoundingClientRect();
            let slot = element.parentElement;
            while (slot && !slot.classList.contains("grow"))
              slot = slot.parentElement;
            if (!slot) return false;
            const bounds = slot.getBoundingClientRect();
            const range = document.createRange();
            range.selectNodeContents(element);
            return (
              box.left >= bounds.left - 0.5 &&
              box.right <= bounds.right + 0.5 &&
              box.top >= bounds.top - 0.5 &&
              box.bottom <= bounds.bottom + 0.5 &&
              Array.from(range.getClientRects()).every(
                (line) =>
                  line.left >= box.left - 0.5 && line.right <= box.right + 0.5,
              )
            );
          }),
          `${app}#${state.id}: mode button and complete label fit their own footer slot`,
        ).toBe(true);
        await mode.click({ trial: true, timeout: 10_000 });
        await expect(mode).toBeInViewport({ ratio: 1 });
        await mode.click();
        const option = page.getByRole("menuitemradio", { name: /Flash/ });
        await expect(option).toBeVisible();
        await option.click();
        await expect(mode).toBeVisible();
      } finally {
        await context.close();
      }
    }
  });
