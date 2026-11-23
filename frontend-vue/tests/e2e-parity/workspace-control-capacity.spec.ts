import { expect, test, type Page } from "./support/test";

import { PARITY_CONTEXT_OPTIONS } from "./support/context-options";
import { surveyReflow } from "./support/reflow-survey";
import {
  DEFAULT_DIMENSION,
  PARITY_SCENARIOS,
  runScenario,
  scenarioStates,
} from "./support/scenarios";
import { waitForDomQuiet, waitForFiniteAnimations } from "./support/settle";

async function reach(page: Page, base: string, key: string) {
  const [id, stateId] = key.split("#");
  const scenario = PARITY_SCENARIOS.find((entry) => entry.id === id)!;
  const state = scenarioStates(scenario).find((entry) => entry.id === stateId)!;
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

async function completeSurvey(page: Page) {
  const survey = await page.evaluate(surveyReflow, 24);
  expect(survey.documentOverflowX).toBeLessThanOrEqual(1);
  expect(survey.nonDeliberateHorizontalScrollers).toEqual([]);
  expect(survey.lostControls).toEqual([]);
  expect(survey.unreachableClips).toEqual([]);
}

for (const [app, base] of [
  ["vue", process.env.E2E_APP_URL ?? "http://localhost:3115"],
  ["react", process.env.E2E_REACT_APP_URL ?? "http://localhost:3116"],
] as const) {
  test(`${app}: MCP and icon editors retain their complete controls at low capacity`, async ({
    browser,
  }) => {
    for (const key of [
      "mcp-settings#edit-personal",
      "mcp-settings#edit-platform",
      "mcp-settings#add-personal",
      "plugin-icons#uploaded-preview",
      "plugin-icons#invalid-upload-preserves-icon",
      "plugin-icons#editor",
      "plugin-icons#unknown-name-no-impersonation",
    ]) {
      const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
      const page = await context.newPage();
      try {
        await reach(page, base, key);
        const dialog = page.getByRole("dialog").filter({
          has: page.getByRole("textbox", {
            name: "MCP server JSON definition",
          }),
        });
        await expect(dialog).toHaveCount(1);
        const capacity = await dialog.evaluate((element) => ({
          overflow: getComputedStyle(element).overflowY,
          client: element.clientHeight,
          content: element.scrollHeight,
        }));
        expect(capacity.overflow).toBe("auto");
        expect(capacity.content).toBeGreaterThan(capacity.client);
        for (const name of ["Upload plugin icon", "Choose image", "Cancel"]) {
          const control = dialog.getByRole("button", { name, exact: true });
          await control.focus();
          await page.keyboard.press("Shift+Tab");
          await page.keyboard.press("Tab");
          await expect(control).toBeFocused();
          await expect(control).toBeInViewport({ ratio: 1 });
        }
        await completeSurvey(page);
      } finally {
        await context.close();
      }
    }
  });

  test(`${app}: mobile sidebar retains one complete native navigation row`, async ({
    browser,
  }) => {
    const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
    const page = await context.newPage();
    try {
      await reach(page, base, "thread-title-sync#mobile-drawer");
      const sidebar = page.locator('[data-slot="sidebar"][data-mobile=true]');
      for (const name of [
        "Chats",
        "Agents",
        "Scheduled tasks",
        "Capability Center",
        "Renamed title",
      ]) {
        const link = sidebar.getByRole("link", { name, exact: true });
        await link.focus();
        await page.keyboard.press("Shift+Tab");
        await page.keyboard.press("Tab");
        await expect(link).toBeFocused();
        await expect(link).toBeInViewport({ ratio: 1 });
      }
      const capacity = await sidebar
        .locator('[data-slot="sidebar-content"]')
        .evaluate((element) => ({
          height: element.clientHeight,
          row: element.querySelector("a")!.getBoundingClientRect().height,
        }))
        .then(({ height, row }) => ({ height, row }));
      expect(capacity.height).toBeGreaterThanOrEqual(capacity.row);
      await completeSurvey(page);
    } finally {
      await context.close();
    }
  });

  test(`${app}: workspace changes keeps its complete file action reachable`, async ({
    browser,
  }) => {
    const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
    const page = await context.newPage();
    try {
      await reach(page, base, "workspace-changes#changes-panel");
      const dialog = page.getByRole("dialog");
      const action = dialog
        .locator('[data-slot="collapsible-trigger"]')
        .first();
      await expect(action).toHaveCount(1);
      await action.focus();
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Tab");
      await expect(action).toBeFocused();
      await expect(action).toBeInViewport({ ratio: 1 });
      await completeSurvey(page);
    } finally {
      await context.close();
    }
  });

  test(`${app}: project instructions keeps a bounded editable field and native text scrolling`, async ({
    browser,
  }) => {
    for (const key of [
      "project-workflows#instructions-over-limit",
      "project-workflows#instructions-saved",
    ]) {
      const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
      const page = await context.newPage();
      try {
        await reach(page, base, key);
        const input = page.locator("#project-instructions-input");
        const geometry = await input.evaluate((element) => ({
          height: element.getBoundingClientRect().height,
          panel: element.closest('[role="tabpanel"]')!.clientHeight,
        }));
        expect(geometry.height).toBeGreaterThan(0);
        expect(geometry.height).toBeLessThanOrEqual(geometry.panel);
        await input.focus();
        await page.keyboard.press("Shift+Tab");
        await page.keyboard.press("Tab");
        await expect(input).toBeFocused();
        // Native text focus reveals the caret, not necessarily the field's
        // complete border box. Pan its real panel through the visible label;
        // the entire field must still fit simultaneously in that scrollport.
        const pan = await input.evaluate((element) => {
          const field = element.getBoundingClientRect();
          const panel = element.closest('[role="tabpanel"]')!;
          const port = panel.getBoundingClientRect();
          return (field.top + field.bottom - port.top - port.bottom) / 2;
        });
        await page.locator('label[for="project-instructions-input"]').hover();
        await page.mouse.wheel(0, pan);
        await expect(input).toBeInViewport({ ratio: 1 });
        const original = await input.inputValue();
        const edited = `${original}\n${"Native editable line\n".repeat(80)}`;
        await input.fill(edited);
        await expect(input).toHaveValue(edited);
        await page.keyboard.press("ArrowLeft");
        await expect
          .poll(() => input.evaluate((element) => element.scrollTop))
          .toBeGreaterThan(0);
        await expect(input).toBeFocused();
        await completeSurvey(page);
      } finally {
        await context.close();
      }
    }
  });
}
