import { expect, test } from "./support/test";
import { PARITY_CONTEXT_OPTIONS } from "./support/context-options";
import {
  DEFAULT_DIMENSION,
  PARITY_SCENARIOS,
  runScenario,
} from "./support/scenarios";
import { waitForDomQuiet, waitForFiniteAnimations } from "./support/settle";

for (const rootPx of [16, 32]) {
  test(`Markdown table controls preserve the rendered React glyphs at root ${rootPx}`, async ({
    browser,
  }, testInfo) => {
    const original = PARITY_SCENARIOS.find(
      (item) => item.id === "workspace-changes",
    )!;
    const scenario = {
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
                  content:
                    "| City | Weather |\n| --- | --- |\n| Shanghai | Sunny |",
                }
              : message,
          ),
        })),
      },
    };
    const rows = [];
    for (const [app, base] of [
      ["react", process.env.E2E_REACT_APP_URL ?? "http://localhost:3116"],
      ["vue", process.env.E2E_APP_URL ?? "http://localhost:3115"],
    ] as const) {
      const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
      try {
        const page = await context.newPage();
        await runScenario(page, base, scenario, DEFAULT_DIMENSION, {
          id: "table",
          steps: [],
        });
        await page.evaluate((px) => {
          document.documentElement.style.fontSize = `${px}px`;
        }, rootPx);
        const table = page.locator('[data-streamdown="table-wrapper"]');
        await expect(table).toBeVisible();
        await expect(table.locator("table")).toContainText("Shanghai");
        await page.evaluate(() => document.fonts.ready);
        await waitForFiniteAnimations(page);
        await waitForDomQuiet(page);
        const controls = await table.locator("button").evaluateAll((buttons) =>
          buttons.map((button) => {
            const svg = button.querySelector("svg");
            if (!svg) throw new Error("Missing real table control glyph");
            const bounds = svg.getBoundingClientRect();
            return {
              label:
                button.getAttribute("aria-label") ??
                button.getAttribute("title"),
              width: bounds.width,
              height: bounds.height,
              viewBox: svg.getAttribute("viewBox"),
              shape: Array.from(svg.children).map((node) =>
                [
                  node.tagName,
                  Array.from(node.attributes)
                    .filter((a) => a.name !== "class")
                    .map((a) => `${a.name}=${a.value}`)
                    .sort()
                    .join(";"),
                ].join(":"),
              ),
            };
          }),
        );
        rows.push({ app, controls });
        await testInfo.attach(`${app}-table`, {
          body: await table.screenshot(),
          contentType: "image/png",
        });
      } finally {
        await context.close();
      }
    }
    await testInfo.attach("table-measurements", {
      body: JSON.stringify(rows, null, 2),
      contentType: "application/json",
    });
    expect(rows[0]!.controls).toHaveLength(3);
    expect(rows[1]!.controls).toEqual(rows[0]!.controls);
  });
}

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
  { width: 360, height: 360 },
]) {
  for (const rootPx of [16, 32]) {
    test(`Markdown fullscreen table retains viewport geometry at ${viewport.width}x${viewport.height} root ${rootPx}`, async ({
      browser,
    }, testInfo) => {
      const original = PARITY_SCENARIOS.find(
        (item) => item.id === "workspace-changes",
      )!;
      const scenario = {
        ...original,
        settle: [{ kind: "visible" as const, target: { selector: "table" } }],
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
                    content:
                      "| City | Weather |\n| --- | --- |\n| Shanghai | Sunny |",
                  }
                : message,
            ),
          })),
        },
      };
      const rows = [];
      for (const [app, base] of [
        ["react", process.env.E2E_REACT_APP_URL ?? "http://localhost:3116"],
        ["vue", process.env.E2E_APP_URL ?? "http://localhost:3115"],
      ] as const) {
        const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
        try {
          const page = await context.newPage();
          await runScenario(page, base, scenario, DEFAULT_DIMENSION, {
            id: "table-fullscreen",
            steps: [],
          });
          await page.setViewportSize(viewport);
          await page.evaluate((px) => {
            document.documentElement.style.fontSize = `${px}px`;
          }, rootPx);
          await page.getByTitle("View fullscreen", { exact: true }).click();
          const dialog = page.getByRole("dialog");
          await expect(dialog.locator("table")).toContainText("Shanghai");
          await page.evaluate(() => document.fonts.ready);
          await waitForFiniteAnimations(page);
          await waitForDomQuiet(page);
          const measured = await dialog.evaluate((host) => {
            const box = (node: Element) => {
              const rect = node.getBoundingClientRect();
              return {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
              };
            };
            const table = host.querySelector("table")!;
            const style = getComputedStyle(host);
            return {
              viewport: box(host),
              padding: [
                style.paddingTop,
                style.paddingRight,
                style.paddingBottom,
                style.paddingLeft,
              ],
              table: box(table),
              buttons: Array.from(host.querySelectorAll("button")).map(
                (button) => ({
                  title: button.title,
                  box: box(button),
                  glyph: box(button.querySelector("svg")!),
                }),
              ),
              cells: Array.from(table.querySelectorAll("th,td")).map(
                (cell) => ({ text: cell.textContent, box: box(cell) }),
              ),
            };
          });
          rows.push({ app, measured });
          await testInfo.attach(`${app}-table-fullscreen`, {
            body: await dialog.screenshot(),
            contentType: "image/png",
          });
          expect
            .soft(measured.viewport, `${app} owns the complete viewport`)
            .toEqual({ x: 0, y: 0, ...viewport });
          expect
            .soft(
              measured.padding,
              `${app} leaves spacing to toolbar/table owners`,
            )
            .toEqual(["0px", "0px", "0px", "0px"]);
        } finally {
          await context.close();
        }
      }
      await testInfo.attach("fullscreen-table-measurements", {
        body: JSON.stringify(rows, null, 2),
        contentType: "application/json",
      });
      expect(rows[1]!.measured).toEqual(rows[0]!.measured);
    });
  }
}
