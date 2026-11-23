import { readFile } from "node:fs/promises";
import type { BrowserContext, Locator, Page } from "@playwright/test";

import { expect, test } from "./support/test";
import { PARITY_CONTEXT_OPTIONS } from "./support/context-options";
import {
  DEFAULT_DIMENSION,
  PARITY_SCENARIOS,
  runScenario,
} from "./support/scenarios";

const firstTable = "| City | Weather |\n| --- | --- |\n| Shanghai | Sunny |";
const secondTable =
  '| City | Weather |\n| --- | --- |\n| **北京,西城** | cloud "two" |';
const expectedCopies = {
  Markdown: '| City | Weather |\n| --- | --- |\n| 北京,西城 | cloud "two" |',
  CSV: 'City,Weather\n"北京,西城","cloud ""two"""',
  TSV: 'City\tWeather\n北京,西城\tcloud "two"',
};

function tableScenario() {
  const original = PARITY_SCENARIOS.find(
    (item) => item.id === "workspace-changes",
  )!;
  return {
    ...original,
    settle: [
      {
        kind: "visible" as const,
        target: { selector: "[data-streamdown=table-wrapper]" },
      },
    ],
    mock: {
      ...original.mock,
      threads: original.mock!.threads!.map((thread) => ({
        ...thread,
        messages: thread.messages!.map((message) =>
          typeof message === "object" &&
          message !== null &&
          "type" in message &&
          message.type === "ai"
            ? {
                ...message,
                content: `${firstTable}\n\nSecond result:\n\n${secondTable}`,
              }
            : message,
        ),
      })),
    },
  };
}

async function observeClipboard(context: BrowserContext) {
  // Observe application payloads without reading or writing the host clipboard.
  await context.addInitScript(() => {
    const copies: Record<string, string>[] = [];
    Reflect.set(window, "__tableCopies", copies);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        async write(items: ClipboardItem[]) {
          if (Reflect.get(window, "__rejectTableCopy"))
            throw new DOMException("Test denial", "NotAllowedError");
          for (const item of items) {
            const result: Record<string, string> = {};
            for (const type of item.types)
              result[type] = await (await item.getType(type)).text();
            copies.push(result);
          }
        },
        async writeText(text: string) {
          copies.push({ "text/plain": text });
        },
      },
    });
  });
}

async function openTable(
  page: Page,
  base: string,
  fullscreen: boolean,
): Promise<Locator> {
  await runScenario(page, base, tableScenario(), DEFAULT_DIMENSION, {
    id: "table-actions",
    steps: [],
  });
  const tables = page.locator('[data-streamdown="table-wrapper"]');
  await expect(tables).toHaveCount(2);
  const second = tables.nth(1);
  await expect(second.locator("table")).toContainText("北京,西城");
  if (!fullscreen) return second;
  await second
    .getByRole("button", { name: "View fullscreen", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("table")).toContainText("北京,西城");
  return dialog;
}

for (const [app, base] of [
  ["react", process.env.E2E_REACT_APP_URL ?? "http://localhost:3116"],
  ["vue", process.env.E2E_APP_URL ?? "http://localhost:3115"],
] as const) {
  for (const fullscreen of [false, true]) {
    const mode = fullscreen ? "fullscreen" : "inline";
    test(`${app}: table copy includes text and HTML for every format in ${mode} presentation`, async ({
      browser,
    }, testInfo) => {
      const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
      try {
        await observeClipboard(context);
        const page = await context.newPage();
        const surface = await openTable(page, base, fullscreen);
        await testInfo.attach(`${app}-table-surface`, {
          body: await surface.screenshot(),
          contentType: "image/png",
        });
        const html = await surface
          .locator("table")
          .evaluate((table) => table.outerHTML);
        const actual: Record<string, string>[] = [];
        for (const [format, text] of Object.entries(expectedCopies)) {
          await surface
            .getByRole("button", { name: "Copy table", exact: true })
            .click();
          const option = surface.getByTitle(`Copy table as ${format}`, {
            exact: true,
          });
          await option.click();
          await expect(option).toHaveCount(0);
          await expect
            .poll(() =>
              page.evaluate(
                () =>
                  (Reflect.get(window, "__tableCopies") as unknown[]).length,
              ),
            )
            .toBe(actual.length + 1);
          const copies = await page.evaluate(
            () =>
              Reflect.get(window, "__tableCopies") as Record<string, string>[],
          );
          const copy = copies.at(-1)!;
          expect(copy).toEqual({ "text/plain": text, "text/html": html });
          actual.push(copy);
        }
        await testInfo.attach("clipboard-payloads", {
          body: JSON.stringify(actual, null, 2),
          contentType: "application/json",
        });
      } finally {
        await context.close();
      }
    });

    test(`${app}: ${mode} downloads preserve the selected table and CSV BOM`, async ({
      browser,
    }, testInfo) => {
      const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
      try {
        const page = await context.newPage();
        const surface = await openTable(page, base, fullscreen);
        for (const format of ["CSV", "Markdown"] as const) {
          await surface
            .getByRole("button", { name: "Download table", exact: true })
            .click();
          const pending = page.waitForEvent("download");
          await surface
            .getByTitle(`Download table as ${format}`, { exact: true })
            .click();
          const download = await pending;
          expect(download.suggestedFilename()).toBe(
            format === "CSV" ? "table.csv" : "table.md",
          );
          const path = await download.path();
          expect(path).not.toBeNull();
          const bytes = await readFile(path!);
          const expected =
            (format === "CSV" ? "\uFEFF" : "") + expectedCopies[format];
          expect(bytes.equals(Buffer.from(expected, "utf8"))).toBe(true);
          await testInfo.attach(`${app}-${mode}-${format}`, {
            body: bytes,
            contentType: format === "CSV" ? "text/csv" : "text/markdown",
          });
        }
      } finally {
        await context.close();
      }
    });
  }

  test(`${app}: native table menu Tab order, denied-copy retry and independent owners`, async ({
    browser,
  }, testInfo) => {
    const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
    try {
      await observeClipboard(context);
      const page = await context.newPage();
      const surface = await openTable(page, base, false);
      const trigger = surface.getByRole("button", {
        name: "Copy table",
        exact: true,
      });
      await trigger.focus();
      await page.keyboard.press("Enter");
      for (const name of ["Markdown", "CSV", "TSV"]) {
        await page.keyboard.press("Tab");
        await expect(
          surface.getByTitle(`Copy table as ${name}`, { exact: true }),
        ).toBeFocused();
      }
      await page.evaluate(() => Reflect.set(window, "__rejectTableCopy", true));
      await page.keyboard.press("Enter");
      const tsv = surface.getByTitle("Copy table as TSV", { exact: true });
      await expect(tsv).toBeVisible();
      expect(
        await page.evaluate(() => Reflect.get(window, "__tableCopies")),
      ).toEqual([]);
      await page.evaluate(() =>
        Reflect.set(window, "__rejectTableCopy", false),
      );
      await page.keyboard.press("Enter");
      await expect(tsv).toHaveCount(0);
      await trigger.click();
      const other = page.locator('[data-streamdown="table-wrapper"]').first();
      await other
        .getByRole("button", { name: "Copy table", exact: true })
        .click();
      await expect(
        surface.getByTitle("Copy table as Markdown", { exact: true }),
      ).toHaveCount(0);
      await other.getByTitle("Copy table as Markdown", { exact: true }).click();
      // ClipboardItem.getType()/Blob.text() settle asynchronously even after click.
      // Observe the completed payload without extending the application timeout.
      await expect
        .poll(() =>
          page.evaluate(() =>
            (
              Reflect.get(window, "__tableCopies") as Record<string, string>[]
            ).map((copy) => copy["text/plain"]),
          ),
        )
        .toEqual([expectedCopies.TSV, firstTable]);
      const copies = await page.evaluate(
        () => Reflect.get(window, "__tableCopies") as Record<string, string>[],
      );
      await testInfo.attach("owner-copies", {
        body: JSON.stringify(copies, null, 2),
        contentType: "application/json",
      });
    } finally {
      await context.close();
    }
  });

  test(`${app}: table fullscreen closes from its focused controls and reopens`, async ({
    browser,
  }) => {
    const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
    try {
      const page = await context.newPage();
      const surface = await openTable(page, base, true);
      await surface
        .getByRole("button", { name: "Copy table", exact: true })
        .focus();
      await page.keyboard.press("Escape");
      await expect(surface).toHaveCount(0);
      const second = page.locator('[data-streamdown="table-wrapper"]').nth(1);
      await second
        .getByRole("button", { name: "View fullscreen", exact: true })
        .click();
      const reopened = page.getByRole("dialog");
      await expect(reopened.locator("table")).toContainText("北京,西城");
      await reopened
        .getByRole("button", { name: "Exit fullscreen", exact: true })
        .click();
      await expect(reopened).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
}
