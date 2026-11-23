import { expect, test, type Page } from "./support/test";

import { PARITY_CONTEXT_OPTIONS } from "./support/context-options";
import {
  DEFAULT_DIMENSION,
  PARITY_SCENARIOS,
  runScenario,
  scenarioStates,
} from "./support/scenarios";
import { waitForDomQuiet, waitForFiniteAnimations } from "./support/settle";

async function openTriple(
  page: Page,
  base: string,
  scenarioId: string,
  stateId: string,
) {
  const scenario = PARITY_SCENARIOS.find((item) => item.id === scenarioId)!;
  const state = scenarioStates(scenario).find((item) => item.id === stateId)!;
  await runScenario(
    page,
    base,
    scenario,
    state.dimensions?.[0] ?? scenario.dimensions?.[0] ?? DEFAULT_DIMENSION,
    state,
    30_000,
  );
  await page.setViewportSize({ width: 360, height: 360 });
  await page.addStyleTag({ content: "html{font-size:32px!important}" });
  await waitForFiniteAnimations(page);
  await waitForDomQuiet(page);
}

async function focusedGeometry(page: Page) {
  return page.evaluate(async () => {
    const active = document.activeElement!;
    return new Promise<{
      width: number;
      height: number;
      withinOverlay: boolean;
      name: string;
    }>((resolve) => {
      const observer = new IntersectionObserver(([entry]) => {
        observer.disconnect();
        resolve({
          width: entry!.intersectionRect.width,
          height: entry!.intersectionRect.height,
          withinOverlay: Boolean(
            active.closest(
              '[data-slot="sheet-content"],[data-slot="popover-picker-content"]',
            ),
          ),
          name: active.getAttribute("aria-label") ?? active.textContent ?? "",
        });
      });
      observer.observe(active);
    });
  });
}

for (const [app, base] of [
  ["vue", process.env.E2E_APP_URL ?? "http://localhost:3115"],
  ["react", process.env.E2E_REACT_APP_URL ?? "http://localhost:3116"],
] as const) {
  test(`${app}: first Tab after knowledge selection reveals the returned control`, async ({
    browser,
  }) => {
    const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
    try {
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await openTriple(
        page,
        base,
        "agent-knowledge-binding",
        "selected-dataset",
      );
      await page.keyboard.press("Tab");
      const focus = await focusedGeometry(page);
      expect(focus.width, JSON.stringify(focus)).toBeGreaterThan(0);
      expect(focus.height, JSON.stringify(focus)).toBeGreaterThan(0);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test(`${app}: promotion restores its opener and toast return stays visible after reflow`, async ({
    browser,
  }) => {
    const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
    try {
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await openTriple(page, base, "project-document-promotion", "");
      const entry = page.getByRole("button", {
        name: "Save to project",
        exact: true,
      });
      await expect(entry).toBeFocused();
      // Alt+T is the common published notification shortcut. The toast owns
      // the entry focus and must reveal it when the keyboard leaves the list.
      await page.keyboard.press("Alt+KeyT");
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
      await expect(entry).toBeFocused();
      await expect(entry).toBeInViewport({ ratio: 1 });
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test(`${app}: skill title and actions retain capacity and negative entry stays in its modal`, async ({
    browser,
  }) => {
    const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
    try {
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await openTriple(page, base, "skill-usage", "snapshot");
      const region = page.getByRole("region", {
        name: "SKILL.md",
        exact: true,
      });
      const heading = region.getByRole("heading", {
        name: "SKILL.md",
        exact: true,
      });
      const geometry = await heading.evaluate((element) => {
        const range = document.createRange();
        range.selectNodeContents(element);
        return {
          width: element.getBoundingClientRect().width,
          text: range.getBoundingClientRect().width,
        };
      });
      expect(geometry.width).toBeGreaterThan(0);
      expect(geometry.width).toBeGreaterThanOrEqual(geometry.text - 1);
      await expect(heading).toBeInViewport({ ratio: 1 });
      const controls = region.locator("header button");
      expect(await controls.count()).toBeGreaterThanOrEqual(2);
      for (const button of await controls.all())
        await expect(button).toBeInViewport({ ratio: 1 });
      await heading.focus();
      for (let step = 0; step < 8; step++) {
        await page.keyboard.press("Shift+Tab");
        const focus = await focusedGeometry(page);
        expect(focus.withinOverlay, JSON.stringify(focus)).toBe(true);
        expect(focus.name).not.toBe("SKILL.md");
        expect(focus.width, JSON.stringify(focus)).toBeGreaterThan(0);
        expect(focus.height, JSON.stringify(focus)).toBeGreaterThan(0);
      }
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test(`${app}: table preview retains a real row of capacity and visible keyboard targets`, async ({
    browser,
  }) => {
    const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
    try {
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await openTriple(page, base, "artifact-table-preview", "");
      const table = page.getByRole("region", {
        name: "Table preview",
        exact: true,
      });
      const cell = page.getByRole("button", {
        name: "View cell: row 1, column 3",
        exact: true,
      });
      const capacity = await table.evaluate((element) => element.clientHeight);
      expect(capacity).toBeGreaterThanOrEqual(
        (await cell.boundingBox())!.height,
      );
      for (const direction of ["Tab", "Shift+Tab"]) {
        await table.focus();
        for (let step = 0; step < 10; step++) {
          await page.keyboard.press(direction);
          const focus = await focusedGeometry(page);
          expect(focus.width, JSON.stringify(focus)).toBeGreaterThan(0);
          expect(focus.height, JSON.stringify(focus)).toBeGreaterThan(0);
        }
      }
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test(`${app}: model picker reverse wrap reveals the real last favorite`, async ({
    browser,
  }) => {
    const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
    try {
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await openTriple(
        page,
        base,
        "model-favorites",
        "favorite-without-selecting",
      );
      const picker = page.getByRole("dialog", {
        name: "Choose a model",
        exact: true,
      });
      const favorites = picker.getByRole("button", {
        name: /^(?:Favorite|Unfavorite) /,
      });
      expect(await favorites.count()).toBeGreaterThan(1);
      const lastFavorite = favorites.last();
      // Native focus starts at the picker boundary; ReKa/Radix performs the wrap.
      await picker.getByRole("button").first().focus();
      await page.keyboard.press("Shift+Tab");
      await expect(lastFavorite).toBeFocused();
      await expect(lastFavorite).toBeInViewport({ ratio: 1 });
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}
