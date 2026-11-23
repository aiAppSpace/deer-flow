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
const STATES = [
  "capability-center#directory",
  "mcp-settings#edit-personal",
  "skills-settings#builtin",
  "bookmark-plugin#library",
  "bookmark-plugin#unknown-page",
  "integrations#install",
  "business-plugins#configuration",
  "bookmark-plugin#directory-discovery-error",
  "skill-export#manifest",
  "skill-export#download",
  "skill-export#stale-content",
  "skill-export#blocked",
  "knowledge-scope#file-selection",
  "knowledge-scope#agent-file-selection",
];

for (const [app, base] of APPS)
  for (const key of STATES)
    test(`${app}: ${key} retains desktop controls and fits a narrow container with enlarged text`, async ({
      browser,
    }) => {
      test.setTimeout(120_000);
      const [id, stateId] = key.split("#");
      const scenario = PARITY_SCENARIOS.find((entry) => entry.id === id)!;
      const state = scenarioStates(scenario).find(
        (entry) => entry.id === stateId,
      )!;
      expect(scenario.backend).toBe("mock");
      const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
      const page = await context.newPage();
      const unmatched: string[] = [];
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.route("**/api/**", async (route) => {
        const request = route.request();
        unmatched.push(
          `${request.method()} ${new URL(request.url()).pathname}`,
        );
        await route.abort("blockedbyclient");
      });
      try {
        await runScenario(
          page,
          base,
          scenario,
          DEFAULT_DIMENSION,
          state,
          30_000,
        );
        await waitForFiniteAnimations(page);
        await waitForDomQuiet(page);
        const mcpEditor = page.getByRole("dialog").locator("textarea");
        const originalMcpValue =
          id === "mcp-settings" ? await mcpEditor.inputValue() : undefined;
        const originalMcpEditor =
          id === "mcp-settings" ? await mcpEditor.elementHandle() : null;
        if (id === "capability-center") {
          const tabs = page
            .getByRole("tab", { name: "Tools & integrations", exact: true })
            .locator("..");
          const box = (await tabs.boundingBox())!;
          expect(box.width).toBeCloseTo(377.828125, 1);
          expect(box.height).toBe(36);
          for (const button of await page
            .getByRole("group", { name: "All categories", exact: true })
            .getByRole("button")
            .all())
            expect((await button.boundingBox())!.height).toBe(32);
        }
        if (id === "mcp-settings") {
          const picker = page
            .getByRole("dialog")
            .getByRole("button", { name: "Upload plugin icon", exact: true });
          const box = (await picker.boundingBox())!;
          expect(box.width).toBe(64);
          expect(box.height).toBe(64);
          expect(
            (await page
              .getByRole("button", { name: "Choose image", exact: true })
              .boundingBox())!.height,
          ).toBe(32);
          expect((await mcpEditor.boundingBox())!.height).toBe(384);
        }
        const dialogsBefore = await page
          .locator('[role="dialog"],[role="alertdialog"]')
          .count();
        await page.setViewportSize({ width: 360, height: 800 });
        const fontStyle = await page.addStyleTag({
          content: "html{font-size:32px!important}",
        });
        await waitForFiniteAnimations(page);
        await waitForDomQuiet(page);
        expect(
          await page.locator('[role="dialog"],[role="alertdialog"]').count(),
        ).toBe(dialogsBefore);
        const survey = await page.evaluate(surveyReflow, 24);
        expect(survey.width).toBe(360);
        expect(survey.rootPx).toBe(32);
        expect(survey.documentOverflowX).toBe(0);
        expect(survey.nonDeliberateHorizontalScrollers).toEqual([]);
        expect(survey.lostControls).toEqual([]);
        expect(survey.unreachableClips).toEqual([]);
        if (originalMcpValue !== undefined) {
          const dialog = page.getByRole("dialog");
          for (const [width, height, rootPx] of [
            [360, 360, 32],
            [1280, 240, 32],
            [1280, 800, 16],
            [360, 800, 32],
            [1280, 800, 16],
          ] as const) {
            await page.setViewportSize({ width, height });
            await fontStyle.evaluate((style, px) => {
              style.textContent = `html{font-size:${px}px!important}`;
            }, rootPx);
            await waitForFiniteAnimations(page);
            await waitForDomQuiet(page);
            expect(await dialog.count()).toBe(dialogsBefore);
            expect(
              await mcpEditor.evaluate(
                (editor, initial) => editor === initial,
                originalMcpEditor,
              ),
            ).toBe(true);
            await expect(mcpEditor).toHaveValue(originalMcpValue);

            if (height < 800) {
              const previousTop = await dialog.evaluate(
                (element) => element.scrollTop,
              );
              const box = (await dialog.boundingBox())!;
              await page.mouse.move(box.x + 8, box.y + box.height / 2);
              await page.mouse.wheel(0, previousTop > 0 ? -1000 : 1000);
              await expect
                .poll(() => dialog.evaluate((element) => element.scrollTop))
                .not.toBe(previousTop);
            }

            await mcpEditor.focus();
            await page.keyboard.press("Shift+Tab");
            await page.keyboard.press("Tab");
            await expect(mcpEditor).toBeFocused();
            await expect(mcpEditor).toBeInViewport({ ratio: 1 });
            const capacity = await mcpEditor.evaluate((editor) => {
              const host = editor.closest('[role="dialog"]') as HTMLElement;
              const style = getComputedStyle(host);
              return {
                height: editor.getBoundingClientRect().height,
                available:
                  host.clientHeight -
                  parseFloat(style.paddingTop) -
                  parseFloat(style.paddingBottom),
                overflowY: getComputedStyle(editor).overflowY,
                scrollHeight: editor.scrollHeight,
                clientHeight: editor.clientHeight,
              };
            });
            expect(capacity.height).toBeLessThanOrEqual(
              capacity.available + 0.5,
            );
            expect(capacity.overflowY).toBe("auto");
            if (rootPx === 16) expect(capacity.height).toBe(384);
            if (height < 800) {
              expect(capacity.scrollHeight).toBeGreaterThan(
                capacity.clientHeight,
              );
              const previousTop = await mcpEditor.evaluate(
                (editor) => editor.scrollTop,
              );
              await mcpEditor.hover();
              await page.mouse.wheel(0, previousTop > 0 ? -1000 : 1000);
              await expect
                .poll(() => mcpEditor.evaluate((editor) => editor.scrollTop))
                .not.toBe(previousTop);
              await page.keyboard.press("ControlOrMeta+A");
              await page.keyboard.press("ArrowRight");
              await expect
                .poll(() =>
                  mcpEditor.evaluate(
                    (editor) => (editor as HTMLTextAreaElement).selectionStart,
                  ),
                )
                .toBe(originalMcpValue.length);
              await page.keyboard.insertText(" ");
              await expect(mcpEditor).toHaveValue(`${originalMcpValue} `);
              await page.keyboard.press("Backspace");
              await expect(mcpEditor).toHaveValue(originalMcpValue);
            }
            const resizedSurvey = await page.evaluate(surveyReflow, 24);
            expect(resizedSurvey.width).toBe(width);
            expect(resizedSurvey.rootPx).toBe(rootPx);
            expect(resizedSurvey.documentOverflowX).toBe(0);
            expect(resizedSurvey.nonDeliberateHorizontalScrollers).toEqual([]);
            expect(resizedSurvey.lostControls).toEqual([]);
            expect(resizedSurvey.unreachableClips).toEqual([]);
          }
        }
        expect(unmatched, `${key}: all APIs mocked`).toEqual([]);
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    });
