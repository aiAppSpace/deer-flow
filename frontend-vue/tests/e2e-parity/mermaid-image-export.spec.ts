import { expect, test, type Download } from "./support/test";

import { enUS } from "../../app/core/i18n/locales/en-US";
import { zhCN } from "../../app/core/i18n/locales/zh-CN";
import { PARITY_CONTEXT_OPTIONS } from "./support/context-options";
import {
  PARITY_SCENARIOS,
  type ParityScenario,
  runScenario,
  scenarioStates,
} from "./support/scenarios";

const scenario = PARITY_SCENARIOS.find(
  (item) => item.id === "showcase-fe3f7974-1bcb-4a01-a950-79673baafefd",
)!;
const preview = scenarioStates(scenario).find(
  (item) => item.id === "report-preview",
)!;

async function bytes(download: Download) {
  expect(await download.failure()).toBeNull();
  const stream = await download.createReadStream();
  expect(stream).not.toBeNull();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

const unicodeSource =
  'flowchart LR\nA["研究员<br/>Search &amp; Crawling&nbsp;✓"] --> B["完成"]';
const unicodeScenario: ParityScenario = {
  id: "mermaid-export-unicode-regression",
  title: "Mermaid XML export regression",
  backend: "mock",
  path: "/workspace/chats/00000000-0000-0000-0000-000000000001",
  mock: {
    threads: [
      {
        thread_id: "00000000-0000-0000-0000-000000000001",
        title: "Unicode diagram",
        updated_at: "2026-10-24T00:00:00Z",
        messages: [
          { id: "human-diagram", type: "human", content: "Draw a diagram" },
          {
            id: "ai-diagram",
            type: "ai",
            content: "```mermaid\n" + unicodeSource + "\n```",
          },
        ],
      },
    ],
  },
  settle: [{ kind: "visible", target: { role: "img", name: "Mermaid chart" } }],
  steps: [],
};

for (const [app, base] of [
  ["react", process.env.E2E_REACT_APP_URL ?? "http://localhost:3116"],
  ["vue", process.env.E2E_APP_URL ?? "http://localhost:3115"],
] as const) {
  test(`${app}: SVG export retains HTML namespaces, line breaks, entities and Unicode as valid XML`, async ({
    browser,
  }, testInfo) => {
    // Exercise both serializers through their product downloads. Shared parity
    // specs must remain collectable when the React source tree is absent.
    const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
    try {
      const page = await context.newPage();
      await runScenario(page, base, unicodeScenario);
      await page.getByTitle("Download diagram", { exact: true }).click();
      const [download] = await Promise.all([
        page.waitForEvent("download"),
        page.getByTitle("Download diagram as SVG", { exact: true }).click(),
      ]);
      expect(download.suggestedFilename()).toBe("diagram.svg");
      const result = (await bytes(download)).toString("utf8");
      expect(result).toContain('xmlns="http://www.w3.org/2000/svg"');
      expect(result).toMatch(/<br\s*\/>/);
      const parsed = await page.evaluate((svg) => {
        const xml = new DOMParser().parseFromString(svg, "image/svg+xml");
        const label = Array.from(xml.querySelectorAll("p")).find((item) =>
          item.textContent?.includes("研究员"),
        );
        return {
          errors: xml.querySelectorAll("parsererror").length,
          label: label?.textContent,
          namespace: label?.namespaceURI,
        };
      }, result);
      expect(parsed).toEqual({
        errors: 0,
        label: "研究员Search & Crawling\u00a0✓",
        namespace: "http://www.w3.org/1999/xhtml",
      });
      await testInfo.attach(`${app}-unicode.svg`, {
        body: result,
        contentType: "image/svg+xml",
      });
    } finally {
      await context.close();
    }
  });

  for (const locale of ["en-US", "zh-CN"] as const)
    for (const viewport of ["desktop", "mobile"] as const)
      test(`${app}: downloaded Mermaid SVG and PNG decode completely ${locale}/${viewport}`, async ({
        browser,
      }, testInfo) => {
        const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
        try {
          const page = await context.newPage();
          const t = locale === "zh-CN" ? zhCN : enUS;
          await runScenario(
            page,
            base,
            scenario,
            {
              locale,
              viewport,
              theme: viewport === "mobile" ? "dark" : "light",
            },
            preview,
          );
          const chart = page.getByRole("img", {
            name: "Mermaid chart",
            exact: true,
          });
          const block = page
            .locator('[data-streamdown="mermaid-block"]')
            .filter({ has: chart });
          await expect(block).toHaveCount(1);
          const decoded: Record<string, { width: number; height: number }> = {};
          for (const [format, title] of [
            ["svg", t.markdown.downloadDiagramAsSvg],
            ["png", t.markdown.downloadDiagramAsPng],
          ] as const) {
            await block
              .getByTitle(t.markdown.downloadDiagram, { exact: true })
              .click();
            const [download] = await Promise.all([
              page.waitForEvent("download"),
              page.getByTitle(title, { exact: true }).click(),
            ]);
            expect(download.suggestedFilename()).toBe(`diagram.${format}`);
            const data = await bytes(download);
            if (format === "svg") {
              const xml = await page.evaluate((source) => {
                const document = new DOMParser().parseFromString(
                  source,
                  "image/svg+xml",
                );
                return {
                  errors: document.querySelectorAll("parsererror").length,
                  breaks: document.querySelectorAll("foreignObject br").length,
                  text: document.documentElement.textContent,
                };
              }, data.toString("utf8"));
              expect(xml.errors).toBe(0);
              expect(xml.breaks).toBeGreaterThan(0);
              expect(xml.text).toContain("Researcher");
              expect(xml.text).toContain("Web Search & Crawling");
            }
            decoded[format] = await page.evaluate(
              async ({ base64, type }) => {
                const image = new Image();
                image.src = `data:${type};base64,${base64}`;
                await image.decode();
                return {
                  width: image.naturalWidth,
                  height: image.naturalHeight,
                };
              },
              {
                base64: data.toString("base64"),
                type: format === "svg" ? "image/svg+xml" : "image/png",
              },
            );
            expect(decoded[format]!.width).toBeGreaterThan(0);
            expect(decoded[format]!.height).toBeGreaterThan(0);
            await testInfo.attach(`${app}-${locale}-${viewport}.${format}`, {
              body: data,
              contentType: format === "svg" ? "image/svg+xml" : "image/png",
            });
          }
          expect(decoded.png!.width).toBe(decoded.svg!.width * 5);
          expect(decoded.png!.height).toBe(decoded.svg!.height * 5);
        } finally {
          await context.close();
        }
      });
}
