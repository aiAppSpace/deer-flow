import { expect, test } from "./support/test";

import { enUS } from "../../app/core/i18n/locales/en-US";
import { PARITY_CONTEXT_OPTIONS } from "./support/context-options";
import {
  DEFAULT_DIMENSION,
  PARITY_SCENARIOS,
  runScenario,
  scenarioStates,
} from "./support/scenarios";

const scenario = PARITY_SCENARIOS.find(
  (item) => item.id === "knowledge-scope",
)!;
const names = [
  enUS.knowledge.scope.allDatasets,
  enUS.knowledge.scope.selectedDatasets,
  enUS.knowledge.scope.disabled,
] as const;

for (const [app, base] of [
  ["react", process.env.E2E_REACT_APP_URL ?? "http://localhost:3116"],
  ["vue", process.env.E2E_APP_URL ?? "http://localhost:3115"],
] as const)
  for (const stateId of [
    "all",
    "file-selection",
    "agent-file-selection",
    "catalog-error",
  ])
    test(`${app}: knowledge radio boundary preserves native selection in ${stateId}`, async ({
      browser,
    }) => {
      const state = scenarioStates(scenario).find(
        (item) => item.id === stateId,
      )!;
      const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
      try {
        const page = await context.newPage();
        await runScenario(page, base, scenario, DEFAULT_DIMENSION, state);
        const dialog = page.getByRole("dialog");
        const close = dialog.getByRole("button", {
          name: enUS.primitives.close,
          exact: true,
        });
        const radio = (index: number) =>
          dialog.getByRole("radio", { name: names[index]!, exact: true });
        const trigger = page.getByTestId("knowledge-scope-trigger");
        if (stateId === "all") {
          // Assert mount and each reopen before any click changes selection.
          await expect(radio(0)).toBeChecked();
          await expect(radio(0)).toBeFocused();
          for (const key of ["Enter", "Space"]) {
            await page.keyboard.press("Escape");
            await expect(dialog).toHaveCount(0);
            await expect(trigger).toBeFocused();
            await page.keyboard.press(key);
            await expect(dialog).toBeVisible();
            await expect(radio(0)).toBeChecked();
            await expect(radio(0)).toBeFocused();
          }
        }
        await radio(1).click();
        for (const [selected, arrow] of [
          [1, null],
          [2, "ArrowRight"],
          [1, "ArrowLeft"],
          [0, "ArrowLeft"],
        ] as const) {
          if (arrow) await page.keyboard.press(arrow);
          await expect(radio(selected)).toBeChecked();
          await expect(radio(selected)).toBeFocused();
          await page.keyboard.press("Shift+Tab");
          await expect(close).toBeFocused();
          await page.keyboard.press("Tab");
          await expect(radio(selected)).toBeFocused();
          for (const other of [0, 1, 2].filter((index) => index !== selected))
            await expect(radio(other)).not.toBeChecked();
        }
        await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0);
        await expect(trigger).toBeFocused();
        await expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
        await expect(trigger).toHaveAttribute("aria-expanded", "false");
        // Both native activation keys must reopen the same owned dialog and
        // return focus to the same trigger after explicit dismissal.
        for (const key of ["Enter", "Space"]) {
          await page.keyboard.press(key);
          await expect(dialog).toBeVisible();
          await expect(trigger).toHaveAttribute("aria-expanded", "true");
          await expect(trigger).toHaveAttribute(
            "aria-controls",
            (await dialog.getAttribute("id"))!,
          );
          await page.keyboard.press("Escape");
          await expect(dialog).toHaveCount(0);
          await expect(trigger).toBeFocused();
        }
      } finally {
        await context.close();
      }
    });
