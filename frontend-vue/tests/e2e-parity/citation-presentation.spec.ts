import { expect, test } from "./support/test";
import { PARITY_CONTEXT_OPTIONS } from "./support/context-options";
import {
  DEFAULT_DIMENSION,
  PARITY_SCENARIOS,
  runScenario,
} from "./support/scenarios";
import { waitForDomQuiet, waitForFiniteAnimations } from "./support/settle";

for (const rootPx of [16, 32]) {
  test(`citation source panel retains React presentation at root ${rootPx}`, async ({
    browser,
  }, testInfo) => {
    const original = PARITY_SCENARIOS.find(
      (item) => item.id === "workspace-changes",
    )!;
    const scenario = {
      ...original,
      settle: [
        { kind: "visible" as const, target: { text: "Used 2 sources" } },
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
                    "The two references agree. [citation:First source](https://example.com/first) [citation:Second source](https://example.com/second)",
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
          id: "citations",
          steps: [],
        });
        await page.evaluate((px) => {
          document.documentElement.style.fontSize = `${px}px`;
        }, rootPx);
        const panel = page.locator("details").filter({
          has: page.locator("summary", { hasText: "Used 2 sources" }),
        });
        await panel.locator("summary").click();
        await expect(panel.locator("li")).toHaveCount(2);
        await page.mouse.move(0, 0);
        await page.evaluate(() => document.fonts.ready);
        await waitForFiniteAnimations(page);
        await waitForDomQuiet(page);
        const presentation = await panel.evaluate((element) => {
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = 1;
          const context = canvas.getContext("2d")!;
          const color = (value: string) => {
            context.clearRect(0, 0, 1, 1);
            context.fillStyle = value;
            context.fillRect(0, 0, 1, 1);
            return [...context.getImageData(0, 0, 1, 1).data];
          };
          const style = (node: Element) => {
            const css = getComputedStyle(node);
            const rect = node.getBoundingClientRect();
            return {
              width: rect.width,
              height: rect.height,
              color: color(css.color),
              fontWeight: css.fontWeight,
              fontSize: css.fontSize,
              borderColor: color(css.borderTopColor),
              marginTop: css.marginTop,
              overflowY: css.overflowY,
              overscrollBehavior: css.overscrollBehavior,
              flexShrink: css.flexShrink,
            };
          };
          return {
            panel: style(element),
            summary: style(element.querySelector("summary")!.lastElementChild!),
            list: style(element.querySelector("ol")!),
            indices: Array.from(element.querySelectorAll("li > span")).map(
              style,
            ),
            titles: Array.from(
              element.querySelectorAll(
                "a > span:first-child > span:first-child",
              ),
            ).map(style),
            icons: Array.from(element.querySelectorAll("svg")).map(style),
          };
        });
        rows.push({ app, presentation });
        await testInfo.attach(`${app}-citations`, {
          body: await panel.screenshot(),
          contentType: "image/png",
        });
      } finally {
        await context.close();
      }
    }
    await testInfo.attach("citation-measurements", {
      body: JSON.stringify(rows, null, 2),
      contentType: "application/json",
    });
    expect(rows[1]!.presentation).toEqual(rows[0]!.presentation);
  });
}
