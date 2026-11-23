import { readFileSync } from "node:fs";

import { expect, test } from "./support/test";

import { PARITY_CONTEXT_OPTIONS } from "./support/context-options";
import {
  DEFAULT_DIMENSION,
  PARITY_SCENARIOS,
  runScenario,
  scenarioStates,
} from "./support/scenarios";
import { waitForDomQuiet, waitForFiniteAnimations } from "./support/settle";

for (const [app, environment, fallback] of [
  ["react", "E2E_REACT_APP_URL", "http://localhost:3116"],
  ["vue", "E2E_APP_URL", "http://localhost:3115"],
] as const) {
  for (const format of ["JSON", "Markdown"] as const) {
    test(`${app}: actual ${format} export removes context and preserves literal fenced markers`, async ({
      browser,
    }, testInfo) => {
      const original = PARITY_SCENARIOS.find(
        (scenario) => scenario.id === "agent-chat",
      )!;
      const scenario = {
        ...original,
        mock: {
          ...original.mock,
          threads: original.mock!.threads!.map((thread) => ({
            ...thread,
            messages: [
              {
                type: "human" as const,
                id: "context-request",
                content: [
                  '<project id="private" name="Private project">private-instructions</project>',
                  '<documents count="1" shown="1">private-shelf-path</documents>',
                  "PARITY-AGENT-QUESTION",
                ].join("\n"),
              },
              {
                type: "ai" as const,
                id: "context-answer",
                content: [
                  "PARITY-AGENT-ANSWER",
                  "",
                  "```",
                  "```xml",
                  "<memory>literal-memory</memory>",
                  "<project>literal-project</project>",
                  "<think>literal-think</think>",
                  "```",
                  "<memory>private-memory-payload</memory>",
                ].join("\n"),
              },
            ],
          })),
        },
      };
      const state = scenarioStates(scenario).find(
        (item) => item.id === "completed-turn",
      )!;
      const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
      try {
        const page = await context.newPage();
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await runScenario(
          page,
          process.env[environment] ?? fallback,
          scenario,
          DEFAULT_DIMENSION,
          state,
        );
        await waitForFiniteAnimations(page);
        await waitForDomQuiet(page);
        const code = page.locator("pre").filter({ hasText: "literal-memory" });
        await expect(code).toContainText("<memory>literal-memory</memory>");
        await expect(code).toContainText("<project>literal-project</project>");
        await expect(code).toContainText("<think>literal-think</think>");
        await page
          .locator("main > header")
          .getByRole("button", { name: "Export", exact: true })
          .click();
        const pending = page.waitForEvent("download");
        await page
          .getByRole("menuitem", { name: `Export as ${format}`, exact: true })
          .click();
        const download = await pending;
        expect(download.suggestedFilename()).toBe(
          `Agent thread.${format === "JSON" ? "json" : "md"}`,
        );
        const raw = readFileSync((await download.path())!, "utf8");
        const transcript =
          format === "JSON"
            ? (JSON.parse(raw).messages as { content: string }[])
                .map((message) => message.content)
                .join("\n")
            : raw;
        expect(transcript).toContain("PARITY-AGENT-QUESTION");
        expect(transcript).toContain("PARITY-AGENT-ANSWER");
        expect(transcript).toContain("<memory>literal-memory</memory>");
        expect(transcript).toContain("<project>literal-project</project>");
        expect(transcript).toContain("<think>literal-think</think>");
        for (const secret of [
          "Private project",
          "private-instructions",
          "private-shelf-path",
          "private-memory-payload",
        ])
          expect(transcript).not.toContain(secret);
        await testInfo.attach(`${app}-${format.toLowerCase()}-download`, {
          body: raw,
          contentType: format === "JSON" ? "application/json" : "text/markdown",
        });
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    });
  }
}

for (const archived of [false, true]) {
  for (const [width, height, rootPx] of [
    [1280, 800, 16],
    [375, 812, 16],
    [360, 360, 32],
  ] as const) {
    test(`Agent header, toolbar and active-thread data agree at ${width}/${rootPx}, archived=${archived}`, async ({
      browser,
    }, testInfo) => {
      const original = PARITY_SCENARIOS.find(
        (scenario) => scenario.id === "agent-chat",
      )!;
      const scenario = archived
        ? {
            ...original,
            mock: {
              ...original.mock,
              threads: original.mock!.threads!.map((thread) => ({
                ...thread,
                metadata: { ...thread.metadata, deerflow_archived: true },
              })),
            },
          }
        : original;
      const state = scenarioStates(scenario).find(
        (item) => item.id === "completed-turn",
      )!;
      const measurements: Array<{
        app: string;
        controls: Array<{
          name: string;
          x: number;
          y: number;
          width: number;
          height: number;
          paddingLeft: string;
          paddingRight: string;
        }>;
      }> = [];
      const exports: unknown[] = [];
      for (const [app, base] of [
        ["react", process.env.E2E_REACT_APP_URL ?? "http://localhost:3116"],
        ["vue", process.env.E2E_APP_URL ?? "http://localhost:3115"],
      ] as const) {
        const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
        try {
          const page = await context.newPage();
          const errors: string[] = [];
          page.on("pageerror", (error) => errors.push(error.message));
          await runScenario(page, base, scenario, DEFAULT_DIMENSION, state);
          await page.setViewportSize({ width, height });
          await page.addStyleTag({
            content: `html{font-size:${rootPx}px!important}`,
          });
          await page.evaluate(() => document.fonts.ready.then(() => undefined));
          await waitForFiniteAnimations(page);
          await waitForDomQuiet(page);
          const header = page.locator("main > header");
          await expect(
            header.getByText("Agent thread", { exact: true }),
          ).toBeVisible();
          const restore = header.getByRole("button", {
            name: "Restore chat",
            exact: true,
          });
          await expect(restore).toHaveCount(archived ? 1 : 0);
          const controls = await page.evaluate(() => {
            const elements = [
              ...document.querySelectorAll<HTMLElement>("main > header button"),
              ...[
                "mention-button",
                "add-attachments-button",
                "voice-input-button",
                "polish-input-button",
              ].map((id) =>
                document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!,
              ),
            ];
            return elements.map((element) => {
              const rect = element.getBoundingClientRect();
              const style = getComputedStyle(element);
              return {
                name:
                  element.getAttribute("aria-label") ??
                  element.textContent?.trim() ??
                  "",
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
                paddingLeft: style.paddingLeft,
                paddingRight: style.paddingRight,
              };
            });
          });
          measurements.push({ app, controls });
          await testInfo.attach(`${app}-header-layout`, {
            body: await page.screenshot(),
            contentType: "image/png",
          });
          if (width === 1280) {
            await header
              .getByRole("button", { name: "Export", exact: true })
              .click();
            const pending = page.waitForEvent("download");
            await page
              .getByRole("menuitem", { name: "Export as JSON", exact: true })
              .click();
            const download = await pending;
            expect(download.suggestedFilename()).toBe("Agent thread.json");
            const data = JSON.parse(
              readFileSync((await download.path())!, "utf8"),
            );
            const { exported_at, ...transcript } = data;
            expect(new Date(exported_at).toISOString()).toBe(exported_at);
            expect(transcript.title).toBe("Agent thread");
            exports.push(transcript);
          }
          if (archived) {
            await restore.click();
            await expect(restore).toHaveCount(0);
            await page.reload();
            await expect(
              header.getByText("Agent thread", { exact: true }),
            ).toBeVisible();
            await expect(restore).toHaveCount(0);
          }
          expect(errors).toEqual([]);
        } finally {
          await context.close();
        }
      }
      expect(measurements).toHaveLength(2);
      expect(measurements[1]!.controls.map((item) => item.name)).toEqual(
        measurements[0]!.controls.map((item) => item.name),
      );
      measurements[0]!.controls.forEach((react, index) => {
        const vue = measurements[1]!.controls[index]!;
        for (const key of ["x", "y", "width", "height"] as const)
          expect(vue[key], `${react.name}: ${key}`).toBeCloseTo(react[key], 0);
        expect(vue.paddingLeft, react.name).toBe(react.paddingLeft);
        expect(vue.paddingRight, react.name).toBe(react.paddingRight);
      });
      if (width === 1280) {
        expect(exports).toHaveLength(2);
        expect(exports[1]).toEqual(exports[0]);
      }
    });
  }
}
