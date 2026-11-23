import { test, expect } from "./support/test";
import { PARITY_CONTEXT_OPTIONS } from "./support/context-options";
import {
  PARITY_SCENARIOS,
  DEFAULT_DIMENSION,
  runScenario,
  scenarioStates,
} from "./support/scenarios";
import { waitForDomQuiet, waitForFiniteAnimations } from "./support/settle";

// Controlled HTTP failure is separate from the real filechooser and native focus.
for (const app of ["react", "vue"] as const) {
  for (const entry of ["chooser", "programmatic"] as const) {
    test(`${app}: Memory ${entry} pending failure retry retains ownership`, async ({
      browser,
    }) => {
      const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
      let release!: () => void;
      const pending = new Promise<void>((resolve) => {
        release = resolve;
      });
      try {
        const page = await context.newPage();
        const errors: string[] = [];
        const payloads: unknown[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
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
          id: "import-retry-owner",
          steps: [],
        });
        await page.route("**/api/memory/import", async (route) => {
          expect(route.request().method()).toBe("POST");
          payloads.push(route.request().postDataJSON());
          if (payloads.length === 1) {
            await pending;
            await route.fulfill({
              status: 503,
              contentType: "application/json",
              body: JSON.stringify({
                detail: "Memory retry ownership failure",
              }),
            });
          } else await route.fallback();
        });
        const parent = page.getByRole("dialog", {
          name: "Settings",
          exact: true,
        });
        const importButton = parent.getByRole("button", {
          name: "Import memory",
          exact: true,
        });
        const opener =
          entry === "chooser"
            ? importButton
            : parent.getByRole("button", { name: "Memory", exact: true });
        // Keep the actual owners before the nested modal hides its parent from
        // role queries. Pending state must inspect these same connected nodes.
        const parentNode = await parent.elementHandle();
        const importButtonNode = await importButton.elementHandle();
        const input = parent.locator('input[type="file"]');
        const inputNode = await input.elementHandle();
        const file = {
          name: selection.file.name,
          mimeType: selection.file.mimeType,
          buffer: Buffer.from(selection.file.base64, "base64"),
        };
        if (entry === "chooser") {
          const chooserPromise = page.waitForEvent("filechooser");
          await importButton.click();
          const chooser = await chooserPromise;
          await expect(opener).toBeFocused();
          await chooser.setFiles(file);
        } else {
          await expect(opener).toBeFocused();
          await input.setInputFiles(file);
        }
        const child = page.getByRole("dialog", {
          name: "Import memory?",
          exact: true,
        });
        await expect(child).toBeVisible();
        const childNode = await child.elementHandle();
        await waitForFiniteAnimations(page);
        await child
          .getByRole("button", { name: "Import", exact: true })
          .click();
        await expect.poll(() => payloads.length).toBe(1);
        await expect
          .poll(async () => ({
            parentHidden: await parentNode!.getAttribute("aria-hidden"),
            button: await importButtonNode!.evaluate((node) => ({
              connected: node.isConnected,
              disabled: node.matches(":disabled"),
            })),
          }))
          .toEqual({
            parentHidden: "true",
            button: { connected: true, disabled: true },
          });
        await expect(
          child.getByRole("button", { name: "Cancel", exact: true }),
        ).toBeDisabled();
        release();
        await expect(
          page.getByText("Memory retry ownership failure", { exact: true }),
        ).toBeVisible();
        await expect(
          child.getByRole("button", { name: "Import", exact: true }),
        ).toBeEnabled();
        expect(await childNode!.evaluate((node) => node.isConnected)).toBe(
          true,
        );
        await expect(child).toContainText(selection.file.name);
        await child
          .getByRole("button", { name: "Import", exact: true })
          .click();
        await expect(child).toHaveCount(0);
        expect(await childNode!.evaluate((node) => node.isConnected)).toBe(
          false,
        );
        await waitForFiniteAnimations(page);
        await waitForDomQuiet(page);
        expect(payloads).toHaveLength(2);
        expect(payloads[1]).toEqual(payloads[0]);
        expect(payloads[0]).toMatchObject({
          user: { cognitiveStyle: { summary: "", updatedAt: "" } },
        });
        await expect(parent).toBeVisible();
        await expect(parent).not.toHaveAttribute("aria-hidden", "true");
        await expect(opener).toBeFocused();
        expect(await inputNode!.evaluate((node) => node.isConnected)).toBe(
          true,
        );
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
        release();
        await context.close();
      }
    });
  }
}
