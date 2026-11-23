import { readFile } from "node:fs/promises";

import { expect, test, type Download } from "./support/test";

import { enUS } from "../../app/core/i18n/locales/en-US";
import { zhCN } from "../../app/core/i18n/locales/zh-CN";
import { PARITY_CONTEXT_OPTIONS } from "./support/context-options";
import {
  PARITY_SCENARIOS,
  runScenario,
  scenarioStates,
} from "./support/scenarios";

const REPORT_ID = "fe3f7974-1bcb-4a01-a950-79673baafefd";
const scenario = PARITY_SCENARIOS.find(
  (item) => item.id === `showcase-${REPORT_ID}`,
)!;
const preview = scenarioStates(scenario).find(
  (item) => item.id === "report-preview",
)!;
const base = process.env.E2E_REACT_APP_URL ?? "http://localhost:3116";

async function bytes(download: Download) {
  expect(await download.failure()).toBeNull();
  const stream = await download.createReadStream();
  expect(stream).not.toBeNull();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

for (const locale of ["en-US", "zh-CN"] as const)
  for (const viewport of ["desktop", "mobile"] as const)
    test(`react: Mermaid fullscreen owns focus, Escape, pan and downloads ${locale}/${viewport}`, async ({
      browser,
    }, testInfo) => {
      const context = await browser.newContext({
        ...PARITY_CONTEXT_OPTIONS,
        permissions: ["clipboard-read", "clipboard-write"],
      });
      const page = await context.newPage();
      const t = locale === "zh-CN" ? zhCN : enUS;
      try {
        const report = await readFile(
          new URL(
            `../../public/demo/threads/${REPORT_ID}/user-data/outputs/research_deerflow_20260201.md`,
            import.meta.url,
          ),
          "utf8",
        );
        const source = report.match(/```mermaid\r?\n([\s\S]*?)```/)![1]!;
        await runScenario(
          page,
          base,
          scenario,
          { locale, viewport, theme: viewport === "mobile" ? "dark" : "light" },
          preview,
        );
        const chart = page.getByRole("img", {
          name: "Mermaid chart",
          exact: true,
        });
        await expect(chart).toHaveCount(1);
        const chartBlock = page
          .locator('[data-streamdown="mermaid-block"]')
          .filter({ has: chart });
        await expect(chartBlock).toHaveCount(1);
        const trigger = chartBlock.getByTitle(t.markdown.viewFullscreen, {
          exact: true,
        });
        await trigger.click();
        const fullscreen = page.getByRole("dialog", {
          name: t.markdown.viewFullscreen,
          exact: true,
        });
        await expect(fullscreen).toBeVisible();
        const close = fullscreen.getByTitle(t.markdown.exitFullscreen, {
          exact: true,
        });
        await expect(close).toBeFocused();
        await expect(
          fullscreen.getByRole("img", { name: "Mermaid chart", exact: true }),
        ).toBeVisible();
        for (const title of [
          "Zoom in",
          "Zoom out",
          "Reset zoom and pan",
          t.markdown.exitFullscreen,
        ]) {
          await page.keyboard.press("Tab");
          await expect(
            fullscreen.getByTitle(title, { exact: true }),
          ).toBeFocused();
        }
        await page.keyboard.press("Shift+Tab");
        await expect(
          fullscreen.getByTitle("Reset zoom and pan", { exact: true }),
        ).toBeFocused();
        await page.keyboard.press("Tab");
        await expect(close).toBeFocused();

        const application = fullscreen.getByRole("application");
        const before = await application.evaluate(
          (element) => element.style.transform,
        );
        await fullscreen.getByTitle("Zoom in", { exact: true }).click();
        await expect(application).not.toHaveCSS(
          "transform",
          "matrix(1, 0, 0, 1, 0, 0)",
        );
        await fullscreen
          .getByTitle("Reset zoom and pan", { exact: true })
          .click();
        await expect
          .poll(() =>
            application.evaluate((element) => element.style.transform),
          )
          .toBe(before);
        const box = await application.boundingBox();
        expect(box).not.toBeNull();
        await page.mouse.move(
          box!.x + box!.width / 2,
          box!.y + box!.height / 2,
        );
        await page.mouse.wheel(0, -50);
        await expect
          .poll(() =>
            application.evaluate((element) => element.style.transform),
          )
          .not.toBe(before);
        await fullscreen
          .getByTitle("Reset zoom and pan", { exact: true })
          .click();
        await expect
          .poll(() =>
            application.evaluate((element) => element.style.transform),
          )
          .toBe(before);
        await page.mouse.move(
          box!.x + box!.width / 2,
          box!.y + box!.height / 2,
        );
        await page.mouse.down();
        await page.mouse.move(
          box!.x + box!.width / 2 + 16,
          box!.y + box!.height / 2 + 12,
          { steps: 3 },
        );
        await page.mouse.up();
        await expect
          .poll(() =>
            application.evaluate((element) => element.style.transform),
          )
          .toContain("translate(16px, 12px)");
        await testInfo.attach(`mermaid-fullscreen-${locale}-${viewport}`, {
          body: await page.screenshot(),
          contentType: "image/png",
        });

        await page.keyboard.press("Escape");
        await expect(fullscreen).toHaveCount(0);
        await expect(trigger).toBeFocused();
        await expect(chart).toHaveCount(1);
        if (viewport === "mobile")
          await expect(
            page.locator('[data-slot="sheet-content"]'),
          ).toBeVisible();
        await chartBlock
          .getByTitle(t.markdown.copyCode, { exact: true })
          .click();
        await expect
          .poll(() => page.evaluate(() => navigator.clipboard.readText()))
          .toBe(source);
        for (const [format, title] of [
          ["mmd", t.markdown.downloadDiagramAsMmd],
          ["svg", t.markdown.downloadDiagramAsSvg],
          ["png", t.markdown.downloadDiagramAsPng],
        ] as const) {
          await chartBlock
            .getByTitle(t.markdown.downloadDiagram, { exact: true })
            .click();
          const [download] = await Promise.all([
            page.waitForEvent("download"),
            page.getByTitle(title, { exact: true }).click(),
          ]);
          expect(download.suggestedFilename()).toBe(`diagram.${format}`);
          const result = await bytes(download);
          if (format === "mmd") expect(result.toString("utf8")).toBe(source);
          if (format === "svg") {
            expect(result.toString("utf8")).toContain("<svg");
            expect(result.toString("utf8")).toContain("Coordinator");
          }
          if (format === "png")
            expect(result.subarray(0, 8)).toEqual(
              Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
            );
        }
        await page
          .getByRole("button", {
            name: t.clipboard.copyToClipboard,
            exact: true,
          })
          .last()
          .click();
        await expect
          .poll(() => page.evaluate(() => navigator.clipboard.readText()))
          .toBe(report);
        if (viewport === "mobile") {
          await page.keyboard.press("Escape");
          await expect(page.locator('[data-slot="sheet-content"]')).toHaveCount(
            0,
          );
        }
      } finally {
        await context.close();
      }
    });
