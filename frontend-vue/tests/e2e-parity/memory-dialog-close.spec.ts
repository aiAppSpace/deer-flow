import { test, expect } from "./support/test";
import { PARITY_CONTEXT_OPTIONS } from "./support/context-options";
import {
  PARITY_SCENARIOS,
  DEFAULT_DIMENSION,
  runScenario,
  scenarioStates,
} from "./support/scenarios";
import { waitForDomQuiet, waitForFiniteAnimations } from "./support/settle";

// Both entry paths are intentional: direct input preserves the Memory navigation
// opener; the real chooser starts from Import memory. Neither may return to BODY.
for (const app of ["react", "vue"] as const) {
  for (const entry of ["chooser", "programmatic"] as const) {
    for (const terminal of ["confirm", "cancel", "escape"] as const) {
      test(`${app}: Memory ${entry} ${terminal} returns its nested opener`, async ({
        browser,
      }) => {
        const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
        try {
          const page = await context.newPage();
          const errors: string[] = [];
          const imports: string[] = [];
          page.on("pageerror", (error) => errors.push(error.message));
          page.on("request", (request) => {
            if (new URL(request.url()).pathname === "/api/memory/import")
              imports.push(request.method());
          });
          const scenario = PARITY_SCENARIOS.find(
            (row) => row.id === "settings-memory-import",
          )!;
          const state = scenarioStates(scenario).find(
            (row) => row.id === "legacy-confirmation",
          )!;
          const selection = state.steps.find(
            (step) => step.kind === "set-input-files",
          );
          if (!selection || selection.kind !== "set-input-files")
            throw new Error("Missing shared Memory fixture");
          const base =
            app === "react"
              ? process.env.E2E_REACT_APP_URL
              : process.env.E2E_APP_URL;
          if (!base) throw new Error(`Missing ${app} URL`);
          await runScenario(page, base, scenario, DEFAULT_DIMENSION, {
            id: "close-owner",
            steps: [],
          });
          const parent = page.getByRole("dialog", {
            name: "Settings",
            exact: true,
          });
          const opener = parent.getByRole("button", {
            name: entry === "chooser" ? "Import memory" : "Memory",
            exact: true,
          });
          const input = parent.locator('input[type="file"]');
          const inputNode = await input.elementHandle();
          const payload = {
            name: selection.file.name,
            mimeType: selection.file.mimeType,
            buffer: Buffer.from(selection.file.base64, "base64"),
          };
          if (entry === "chooser") {
            const selected = page.waitForEvent("filechooser");
            await opener.click();
            const chooser = await selected;
            await expect(opener).toBeFocused();
            await chooser.setFiles(payload);
          } else {
            await expect(opener).toBeFocused();
            await input.setInputFiles(payload);
          }
          const child = page.getByRole("dialog", {
            name: "Import memory?",
            exact: true,
          });
          await expect(child).toBeVisible();
          const childNode = await child.elementHandle();
          await waitForFiniteAnimations(page);
          if (terminal === "escape") await page.keyboard.press("Escape");
          else
            await child
              .getByRole("button", {
                name: terminal === "confirm" ? "Import" : "Cancel",
                exact: true,
              })
              .click();
          await expect(child).toHaveCount(0);
          expect(await childNode!.evaluate((node) => node.isConnected)).toBe(
            false,
          );
          await waitForFiniteAnimations(page);
          await waitForDomQuiet(page);
          await expect(parent).toBeVisible();
          await expect(parent).not.toHaveAttribute("aria-hidden", "true");
          await expect(page.getByRole("dialog")).toHaveCount(1);
          await expect(opener).toBeFocused();
          expect(await inputNode!.evaluate((node) => node.isConnected)).toBe(
            true,
          );
          expect(imports).toEqual(terminal === "confirm" ? ["POST"] : []);
          await page.keyboard.press("Tab");
          await expect(opener).not.toBeFocused();
          expect(
            await parent.evaluate((node) =>
              node.contains(document.activeElement),
            ),
          ).toBe(true);
          await page.keyboard.press("Shift+Tab");
          await expect(opener).toBeFocused();
          expect(errors).toEqual([]);
        } finally {
          await context.close();
        }
      });
    }
  }
}
