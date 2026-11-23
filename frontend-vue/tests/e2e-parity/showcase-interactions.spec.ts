import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import {
  expect,
  test,
  type Download,
  type Page,
  type Request,
} from "./support/test";

import { enUS } from "../../app/core/i18n/locales/en-US";
import { zhCN } from "../../app/core/i18n/locales/zh-CN";
import { PARITY_CONTEXT_OPTIONS } from "./support/context-options";
import {
  PARITY_SCENARIOS,
  runScenario,
  scenarioStates,
  type ParityDimension,
} from "./support/scenarios";

const APPS = [
  ["vue", process.env.E2E_APP_URL ?? "http://localhost:3115"],
  ["react", process.env.E2E_REACT_APP_URL ?? "http://localhost:3116"],
] as const;
const REPORT_ID = "fe3f7974-1bcb-4a01-a950-79673baafefd";
const REPORT_NAME = "research_deerflow_20260201.md";
const REPORT_PATH = `user-data/outputs/${REPORT_NAME}`;
const REPORT_TITLE = "Deer-Flow Research and Analysis";
const PREVIEW_CASES = [
  ["showcase-public-thread", "doraemon-moe-comic.jpg", "image"],
  ["showcase-7cfa5f8f-a2f8-47ad-acbd-da7137baf990", "index.html", "html"],
  ["showcase-7cfa5f8f-a2f8-47ad-acbd-da7137baf990", "style.css", "code"],
  ["showcase-7cfa5f8f-a2f8-47ad-acbd-da7137baf990", "script.js", "code"],
  [
    "showcase-ad76c455-5bf9-4335-8517-fc03834ab828",
    "survival_overview.png",
    "image",
  ],
  [
    "showcase-ad76c455-5bf9-4335-8517-fc03834ab828",
    "titanic_summary.txt",
    "code",
  ],
  [
    "showcase-4f3e55ee-f853-43db-bfb3-7d1a411f03cb",
    "darcy-proposal-video.mp4",
    "video",
  ],
] as const;
const reportScenario = PARITY_SCENARIOS.find(
  (scenario) => scenario.id === `showcase-${REPORT_ID}`,
)!;
const reportPreview = scenarioStates(reportScenario).find(
  (state) => state.id === "report-preview",
)!;
const digest = (value: Buffer) =>
  createHash("sha256").update(value).digest("hex");

function mutationOf(request: Request): string | null {
  const path = new URL(request.url()).pathname;
  const method = request.method();
  if (
    !path.includes("/api/") ||
    !["POST", "PUT", "PATCH", "DELETE"].includes(method)
  )
    return null;
  // The public static protocol serves search/history reads using POST, just
  // like LangGraph. They cannot create/update a thread; run and other writes
  // remain forbidden and are observed without any request interception here.
  if (
    method === "POST" &&
    (/^\/mock\/api\/threads\/search$/.test(path) ||
      /^\/mock\/api\/threads\/[^/]+\/history$/.test(path))
  )
    return null;
  return `${method} ${path}`;
}

async function downloadBytes(download: Download): Promise<Buffer> {
  expect(await download.failure()).toBeNull();
  const stream = await download.createReadStream();
  expect(
    stream,
    "the real browser download has readable contents",
  ).not.toBeNull();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function clickDownload(page: Page, click: () => Promise<unknown>) {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    click(),
  ]);
  return download;
}

for (const [app, base] of APPS)
  for (const locale of ["en-US", "zh-CN"] as const)
    for (const viewport of ["desktop", "mobile"] as const)
      test(`${app}: public report ${locale}/${viewport} previews, copies, downloads and exports without mutations`, async ({
        browser,
      }) => {
        const dimension: ParityDimension = {
          locale,
          viewport,
          theme: viewport === "mobile" ? "dark" : "light",
        };
        const t = locale === "zh-CN" ? zhCN : enUS;
        const context = await browser.newContext({
          ...PARITY_CONTEXT_OPTIONS,
          permissions: ["clipboard-read", "clipboard-write"],
        });
        const page = await context.newPage();
        const writes: string[] = [];
        page.on("request", (request) => {
          const mutation = mutationOf(request);
          if (mutation) writes.push(mutation);
        });
        try {
          const original = await readFile(
            new URL(
              `../../public/demo/threads/${REPORT_ID}/${REPORT_PATH}`,
              import.meta.url,
            ),
          );
          await runScenario(
            page,
            base,
            reportScenario,
            dimension,
            reportPreview,
          );
          await expect(page.getByRole("table")).toHaveCount(2);
          await expect(
            page
              .getByRole("img", { name: "Mermaid chart", exact: true })
              .first(),
          ).toBeVisible();
          await expect(
            page.locator('[role="img"][aria-label="Mermaid chart"] > svg'),
          ).toHaveCount(1);
          await expect(
            page.getByRole("button", {
              name: t.common.edit,
              exact: true,
            }),
          ).toHaveCount(0);

          await page
            .getByRole("button", {
              name: t.markdown.viewFullscreen,
              exact: true,
            })
            .first()
            .click();
          const exitFullscreen = page.getByRole("button", {
            name: t.markdown.exitFullscreen,
            exact: true,
          });
          await expect(exitFullscreen).toBeVisible();
          await expect(
            page.getByRole("img", {
              name: "Mermaid chart",
              exact: true,
              includeHidden: true,
            }),
          ).toHaveCount(2);
          await page.keyboard.press("Escape");
          await expect(exitFullscreen).toHaveCount(0);
          await expect(
            page.getByRole("img", { name: "Mermaid chart", exact: true }),
          ).toHaveCount(1);

          await page
            .getByRole("button", {
              name: t.clipboard.copyToClipboard,
              exact: true,
            })
            .last()
            .click();
          await expect
            .poll(() => page.evaluate(() => navigator.clipboard.readText()))
            .toBe(original.toString("utf8"));
          await page
            .getByRole("radio", {
              name: t.artifactPreview.viewSource,
              exact: true,
            })
            .click();
          await expect(
            page.getByRole("radio", {
              name: t.artifactPreview.viewSource,
              exact: true,
            }),
          ).toBeChecked();
          await expect(
            page.locator('.cm-content[contenteditable="true"]'),
          ).toHaveCount(0);

          const raw = await clickDownload(page, () =>
            page
              .getByRole("button", { name: t.common.download, exact: true })
              .click(),
          );
          expect(raw.suggestedFilename()).toBe(REPORT_NAME);
          expect(digest(await downloadBytes(raw))).toBe(digest(original));
          await page
            .getByRole("button", { name: t.common.close, exact: true })
            .click();

          const exports: {
            format: string;
            filename: string;
            title: string;
            createdAt: string;
          }[] = [];
          for (const [format, menu] of [
            ["md", t.common.exportAsMarkdown],
            ["json", t.common.exportAsJSON],
          ] as const) {
            await page
              .getByRole("button", { name: t.common.export, exact: true })
              .click();
            const exported = await clickDownload(page, () =>
              page.getByRole("menuitem", { name: menu, exact: true }).click(),
            );
            const content = (await downloadBytes(exported)).toString("utf8");
            expect(content).toContain(
              "Conduct a research on https://github.com/bytedance/deer-flow",
            );
            expect(content).toContain(
              "Great job! Then make a cool webpage according to your report.",
            );
            expect(content).not.toContain("<system-reminder>");
            if (format === "json") {
              const data = JSON.parse(content) as {
                title: string;
                created_at?: string;
                thread_id: string;
                messages: { type: string; content: string }[];
              };
              expect(data.thread_id).toBe(REPORT_ID);
              expect(
                data.messages.filter((message) => message.type === "human"),
              ).toHaveLength(2);
              expect(
                data.messages.some((message) => message.type === "tool"),
              ).toBe(false);
              exports.push({
                format,
                filename: exported.suggestedFilename(),
                title: data.title,
                createdAt: data.created_at ?? "Unknown",
              });
            } else
              exports.push({
                format,
                filename: exported.suggestedFilename(),
                title: content.split("\n")[0]!.replace(/^# /, ""),
                createdAt: content.match(/ · Created (.*)\*/)?.[1] ?? "missing",
              });
          }
          await test.info().attach("public-transcript-export-facts", {
            body: JSON.stringify(exports, null, 2),
            contentType: "application/json",
          });
          expect(exports).toEqual(
            ["md", "json"].map((format) => ({
              format,
              filename: `${REPORT_TITLE}.${format}`,
              title: REPORT_TITLE,
              createdAt: "Unknown",
            })),
          );

          await page.reload();
          await expect(page.getByTestId("main-message-list")).toBeVisible();
          await page.getByText(REPORT_NAME, { exact: true }).first().click();
          await expect(
            page.getByRole("heading", {
              name: "DeerFlow Deep Research Report",
              exact: true,
            }),
          ).toBeVisible();
          for (const name of [
            "Submit",
            t.messages.actions.branch,
            t.messages.actions.regenerate,
          ]) {
            const controls = page.getByRole("button", { name, exact: true });
            for (let index = 0; index < (await controls.count()); index++)
              await expect(controls.nth(index)).toBeDisabled();
          }
          expect(writes).toEqual([]);
        } finally {
          await context.close();
        }
      });

for (const [app, base] of APPS)
  for (const locale of ["en-US", "zh-CN"] as const)
    for (const viewport of ["desktop", "mobile"] as const)
      test(`${app}: public image, chart, webpage, code and video previews stay readonly ${locale}/${viewport}`, async ({
        browser,
      }) => {
        test.setTimeout(180_000);
        const dimension: ParityDimension = {
          locale,
          viewport,
          theme: viewport === "mobile" ? "dark" : "light",
        };
        const t = locale === "zh-CN" ? zhCN : enUS;
        for (const [id, filename, kind] of PREVIEW_CASES) {
          const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
          const page = await context.newPage();
          const writes: string[] = [];
          page.on("request", (request) => {
            const mutation = mutationOf(request);
            if (mutation) writes.push(mutation);
          });
          try {
            const scenario = PARITY_SCENARIOS.find((entry) => entry.id === id)!;
            await runScenario(page, base, scenario, dimension);
            await page.getByText(filename, { exact: true }).first().click();
            const close = page.getByRole("button", {
              name: t.common.close,
              exact: true,
            });
            await expect(close, filename).toBeVisible();
            if (kind === "image") {
              const image = page.locator(`img[src*="${filename}"]`).last();
              await expect(image, filename).toBeVisible();
              await expect
                .poll(() =>
                  image.evaluate(
                    (element) => (element as HTMLImageElement).naturalWidth,
                  ),
                )
                .toBeGreaterThan(0);
            } else if (kind === "video") {
              const video = page.locator("video");
              await expect(video).toBeVisible();
              await expect
                .poll(() =>
                  video.evaluate(
                    (element) => (element as HTMLVideoElement).readyState,
                  ),
                )
                .toBeGreaterThanOrEqual(1);
              expect(
                await video.evaluate(
                  (element) => (element as HTMLVideoElement).currentSrc,
                ),
              ).toContain(filename);
            } else if (kind === "html") {
              await expect(
                page
                  .frameLocator("iframe")
                  .getByRole("heading", { name: "Navigating the Future" }),
              ).toBeVisible();
            } else await expect(page.locator(".cm-editor")).toBeVisible();
            await expect(
              page.getByRole("button", { name: t.common.edit, exact: true }),
            ).toHaveCount(0);
            await expect(
              page.locator('.cm-content[contenteditable="true"]'),
            ).toHaveCount(0);
            expect(writes, filename).toEqual([]);
            await close.click();
          } finally {
            await context.close();
          }
        }
      });
