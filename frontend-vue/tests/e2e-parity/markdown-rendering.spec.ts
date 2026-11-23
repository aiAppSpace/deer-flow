import { createServer, type ServerResponse } from "node:http";

import { expect, test, type Locator, type Page } from "./support/test";
import katex from "katex";

import { mockLangGraphAPI } from "../e2e/utils/mock-api";
import { PARITY_CONTEXT_OPTIONS } from "./support/context-options";
import { runScenario, type ParityScenario } from "./support/scenarios";
import { waitForDomQuiet, waitForFiniteAnimations } from "./support/settle";

const APPS = [
  ["react", process.env.E2E_REACT_APP_URL ?? "http://localhost:3116"],
  ["vue", process.env.E2E_APP_URL ?? "http://localhost:3115"],
] as const;
const THREAD_ID = "00000000-0000-0000-0000-000000004681";
const RUN_ID = "00000000-0000-0000-0000-000000004682";
const CODE = 'const answer = 42;\nconsole.log("markdown parity", answer);';
const EQUATION = `\\sum_{i=1}^{40} x_i = ${Array.from({ length: 28 }, (_, index) => `a_{${index + 1}}`).join(" + ")}`;
const EXPECTED_EQUATION_HTML = katex.renderToString(EQUATION, {
  displayMode: true,
  output: "html",
  throwOnError: true,
});
const CONTENT = [
  "## Markdown presentation",
  "A paragraph with **strong text**, *emphasis* and `inline code`.",
  `\`\`\`ts\n${CODE}\n\`\`\``,
  "| Name | Value |\n| --- | --- |\n| DeerFlow | 42 |",
  `$$\n${EQUATION}\n$$`,
  "Markdown presentation complete.",
].join("\n\n");

function frame(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/** Register first: real controlled mocks/SSE overrides have higher priority. */
async function observeRuntime(page: Page) {
  const unmatched: string[] = [];
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.route("**/api/**", (route) => {
    unmatched.push(
      `${route.request().method()} ${new URL(route.request().url()).pathname}`,
    );
    return route.abort("failed");
  });
  return {
    assertClean() {
      expect(
        unmatched,
        "all API requests must have an explicit controlled owner",
      ).toEqual([]);
      expect(
        pageErrors,
        "the actual consumer must not emit an uncaught page error",
      ).toEqual([]);
    },
  };
}

/** Actual streamed bytes stay open until the test observes the loading UI. */
async function heldMessageStream(
  options: { content?: string; reasoning?: string } = {},
) {
  const content = options.content ?? CONTENT;
  const additionalKwargs =
    options.reasoning === undefined
      ? {}
      : { reasoning_content: options.reasoning };
  const responses = new Set<ServerResponse>();
  let inputs: unknown[] = [];
  const finalMessage = {
    type: "ai",
    id: "markdown-stream-ai",
    content,
    additional_kwargs: additionalKwargs,
  };
  const server = createServer((request, response) => {
    response.writeHead(200, {
      "Access-Control-Allow-Origin": request.headers.origin ?? "*",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Expose-Headers": "Content-Location",
      "Cache-Control": "no-cache",
      "Content-Type": "text/event-stream",
      "Content-Location": `/api/threads/${THREAD_ID}/runs/${RUN_ID}`,
    });
    responses.add(response);
    response.on("close", () => responses.delete(response));
    response.write(frame("metadata", { run_id: RUN_ID, thread_id: THREAD_ID }));
    response.write(frame("values", { messages: inputs }));
    response.write(
      frame("messages", [
        {
          content,
          additional_kwargs: additionalKwargs,
          response_metadata: {},
          type: "AIMessageChunk",
          name: null,
          id: finalMessage.id,
          tool_calls: [],
          invalid_tool_calls: [],
          usage_metadata: null,
          tool_call_chunks: [],
          chunk_position: null,
        },
        {},
      ]),
    );
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  if (address === null || typeof address === "string")
    throw new Error("Missing stream listener");
  return {
    url: `http://127.0.0.1:${address.port}/runs/stream`,
    setInputs(body: unknown) {
      const input =
        typeof body === "object" && body !== null
          ? Reflect.get(body, "input")
          : null;
      const messages =
        typeof input === "object" && input !== null
          ? Reflect.get(input, "messages")
          : null;
      if (!Array.isArray(messages) || messages.length === 0)
        throw new Error("Missing actual run input");
      inputs = messages;
    },
    messages: () => [...inputs, finalMessage],
    finish() {
      expect(responses.size).toBe(1);
      for (const response of responses) {
        response.end(
          frame("values", { messages: [...inputs, finalMessage] }) +
            frame("end", {}),
        );
      }
    },
    async close() {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}

async function styleOf(locator: Locator, pseudo?: string) {
  return locator.evaluate((element, pseudoElement) => {
    const style = getComputedStyle(element, pseudoElement);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d");
    if (context === null)
      throw new Error("Missing color normalization context");
    const color = (value: string) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = value;
      context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data];
    };
    return {
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      fontStyle: style.fontStyle,
      lineHeight: style.lineHeight,
      color: color(style.color),
      backgroundColor: color(style.backgroundColor),
      borderColor: color(style.borderTopColor),
      borderRadius: style.borderRadius,
      padding: [
        style.paddingTop,
        style.paddingRight,
        style.paddingBottom,
        style.paddingLeft,
      ],
      margin: [
        style.marginTop,
        style.marginRight,
        style.marginBottom,
        style.marginLeft,
      ],
      overflowX: style.overflowX,
      maxWidth: style.maxWidth,
      whiteSpace: style.whiteSpace,
    };
  }, pseudo);
}

async function richRendering(root: Locator) {
  const equation = root.locator(".katex-display");
  await expect(equation).toBeVisible();
  await expect(
    root.locator("p").filter({ hasText: /^A paragraph/ }),
  ).toHaveText("A paragraph with strong text, emphasis and inline code.");
  await expect(root.locator('[data-streamdown="strong"]')).toHaveText(
    "strong text",
  );
  await expect(root.locator("em")).toHaveText("emphasis");
  await expect(root.locator("tbody td")).toHaveText(["DeerFlow", "42"]);
  // Both consumers deliberately use KaTeX HTML output, without MathML annotation.
  // Compare the complete rendered equation with an independent input rendering.
  const expectedEquationText = await equation.evaluate((_element, html) => {
    const template = document.createElement("template");
    template.innerHTML = html;
    return template.content.querySelector(".katex-html")!.textContent!;
  }, EXPECTED_EQUATION_HTML);
  await expect(root.locator(".katex-error")).toHaveCount(0);
  await expect(equation.locator(".katex-html")).toHaveText(
    expectedEquationText,
  );
  await expect(
    root.getByText("Markdown presentation complete.", { exact: true }),
  ).toBeVisible();
  const display = await equation.evaluate((element) => ({
    width: element.clientWidth,
    scrollWidth: element.scrollWidth,
    overflow: getComputedStyle(element).overflowX,
  }));
  expect(display.width).toBeGreaterThan(0);
  expect(display.scrollWidth).toBeGreaterThan(display.width);
  expect(display.overflow).toBe("auto");
  const scrollbarHeight = await equation.evaluate(
    (element) => getComputedStyle(element, "::-webkit-scrollbar").height,
  );
  expect(scrollbarHeight).toBe("6px");
  await equation.evaluate((element) => {
    element.scrollLeft = 0;
  });
  await equation.hover();
  await equation.page().mouse.wheel(160, 0);
  await expect
    .poll(() => equation.evaluate((element) => element.scrollLeft))
    .toBeGreaterThan(0);
  const heading = await styleOf(root.locator("h2"));
  expect(heading.lineHeight).toBe("32px");
  return {
    heading,
    paragraph: await styleOf(
      root.locator("p").filter({ hasText: /^A paragraph/ }),
    ),
    strong: await styleOf(root.locator('[data-streamdown="strong"]')),
    emphasis: await styleOf(root.locator("em")),
    table: await styleOf(root.locator("table")),
    tableHead: await styleOf(root.locator("th").first()),
    tableCell: await styleOf(root.locator("td").first()),
    equation: await styleOf(equation),
    equationContent: await styleOf(equation.locator(":scope > .katex")),
    equationScrollbarHeight: scrollbarHeight,
    equationScrollbarThumb: await styleOf(
      equation,
      "::-webkit-scrollbar-thumb",
    ),
  };
}

async function settledCode(root: Locator) {
  const block = root.locator('[data-streamdown="code-block"]');
  await expect(block).toBeVisible();
  // Shiki renders block line spans: innerText preserves their visible line breaks.
  await expect(block.locator("pre code")).toContainText(CODE, {
    useInnerText: true,
  });
  await expect(
    block.locator('[data-streamdown="code-block-copy-button"]'),
  ).toBeEnabled();
  await expect
    .poll(() =>
      block
        .locator("code span")
        .filter({ hasText: /^const$/ })
        .count(),
    )
    .toBe(1);
  return {
    block: await styleOf(block),
    header: await styleOf(
      block.locator('[data-streamdown="code-block-header"]'),
    ),
    body: await styleOf(block.locator('[data-streamdown="code-block-body"]')),
    code: await styleOf(block.locator("pre code")),
    keyword: await styleOf(
      block.locator("code span").filter({ hasText: /^const$/ }),
    ),
    inline: await styleOf(root.locator('[data-streamdown="inline-code"]')),
  };
}

for (const theme of ["light", "dark"] as const) {
  for (const width of [360, 1280]) {
    test(`${theme}/${width}: real message code and math keep presentation through streaming completion`, async ({
      browser,
    }, testInfo) => {
      const samples = [];
      for (const [app, base] of APPS) {
        const context = await browser.newContext({
          ...PARITY_CONTEXT_OPTIONS,
          reducedMotion: "no-preference",
          viewport: { width, height: 900 },
        });
        const page = await context.newPage();
        const stream = await heldMessageStream();
        try {
          const runtime = await observeRuntime(page);
          const controller = mockLangGraphAPI(page, {
            threads: [
              {
                thread_id: THREAD_ID,
                title: "Markdown rendering",
                messages: [],
              },
            ],
          });
          await page.addInitScript(
            (value) => localStorage.setItem("theme", value),
            theme,
          );
          await page.route(
            `**/api/langgraph/threads/${THREAD_ID}/runs/stream`,
            (route) => {
              expect(route.request().method()).toBe("POST");
              stream.setInputs(route.request().postDataJSON());
              return route.continue({ url: stream.url });
            },
          );
          await page.goto(`${base}/workspace/chats/${THREAD_ID}`);
          const input = page.getByRole("textbox", {
            name: /how can i assist you/i,
          });
          await input.fill("Show the markdown presentation");
          await input.press("Enter");
          const root = page.getByTestId("main-message-list");
          const block = root.locator('[data-streaming-code-block="true"]');
          await expect(block).toBeVisible();
          await expect(block.locator("code")).toContainText(CODE);
          await expect(block.locator("button")).toHaveCount(0);
          const rich = await richRendering(root);
          await waitForFiniteAnimations(page);
          const streaming = {
            block: await styleOf(block),
            pre: await styleOf(block.locator("pre")),
            code: await styleOf(block.locator("code")),
            inline: await styleOf(
              root.locator('[data-streaming-inline-code="true"]'),
            ),
          };
          expect(streaming.pre.fontSize).toBe("12px");
          expect(streaming.code.fontSize).toBe("12px");
          expect(streaming.inline.fontSize).toBe("14px");
          controller.upsertThread({
            thread_id: THREAD_ID,
            title: "Markdown rendering",
            messages: stream.messages(),
          });
          stream.finish();
          await expect(block).toHaveCount(0);
          const completed = await settledCode(root);
          expect(completed.body.fontSize).toBe("14px");
          const completedRich = await richRendering(root);
          // While running, assistant text belongs to the muted, small processing
          // step; completion moves it into the full-size answer. Compare both
          // stages across applications below, and pin this actual transition.
          expect(rich.paragraph.fontSize).toBe("14px");
          expect(rich.paragraph.lineHeight).toBe("20px");
          expect(completedRich.paragraph.fontSize).toBe("16px");
          expect(completedRich.paragraph.lineHeight).toBe("24px");
          expect(completedRich.paragraph.color).not.toEqual(
            rich.paragraph.color,
          );
          await waitForDomQuiet(page);
          runtime.assertClean();
          samples.push({ app, streaming, rich, completed, completedRich });
        } finally {
          try {
            await context.close();
          } finally {
            await stream.close();
          }
        }
      }
      await testInfo.attach("computed-message-presentation", {
        body: JSON.stringify(samples, null, 2),
        contentType: "application/json",
      });
      expect(samples[1]?.streaming).toEqual(samples[0]?.streaming);
      expect(samples[1]?.rich).toEqual(samples[0]?.rich);
      expect(samples[1]?.completed).toEqual(samples[0]?.completed);
      expect(samples[1]?.completedRich).toEqual(samples[0]?.completedRich);
    });
  }

  test(`${theme}: actual Markdown artifact preview inherits the same code, table and math presentation`, async ({
    browser,
  }, testInfo) => {
    const samples = [];
    const scenario: ParityScenario = {
      id: "markdown-artifact-rendering",
      title: "Markdown artifact presentation",
      backend: "mock",
      path: `/workspace/chats/${THREAD_ID}`,
      mock: {
        threads: [
          {
            thread_id: THREAD_ID,
            title: "Markdown artifact",
            artifacts: ["/mnt/user-data/outputs/presentation.md"],
            messages: [
              {
                type: "ai",
                id: "artifact-render-ai",
                content: "Created the presentation.",
              },
            ],
          },
        ],
      },
      routes: [
        {
          pattern: "**/api/threads/*/artifacts/**",
          contentType: "text/markdown",
          headers: { ETag: `"${"a".repeat(64)}"` },
          json: CONTENT,
        },
      ],
      settle: [{ kind: "visible", target: { testId: "artifact-trigger" } }],
      steps: [
        { kind: "click", target: { testId: "artifact-trigger" } },
        { kind: "click", target: { text: "presentation.md", exact: true } },
        { kind: "visible", target: { selector: "#artifacts" } },
      ],
    };
    for (const [app, base] of APPS) {
      const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
      const page = await context.newPage();
      const runtime = await observeRuntime(page);
      try {
        await runScenario(page, base, scenario, {
          viewport: "desktop",
          theme,
          locale: "en-US",
        });
        const root = page.locator("#artifacts");
        samples.push({
          app,
          rich: await richRendering(root),
          code: await settledCode(root),
        });
        runtime.assertClean();
      } finally {
        await context.close();
      }
    }
    await testInfo.attach("computed-artifact-presentation", {
      body: JSON.stringify(samples, null, 2),
      contentType: "application/json",
    });
    expect(samples[1]?.rich).toEqual(samples[0]?.rich);
    expect(samples[1]?.code).toEqual(samples[0]?.code);
  });

  test(`${theme}: truncated text and tabular artifacts retain the same native source typography`, async ({
    browser,
  }, testInfo) => {
    for (const extension of ["js", "csv"] as const) {
      const filename = `truncated-presentation.${extension}`;
      const prefix =
        extension === "js"
          ? 'const marker = "TRUNCATED_SOURCE_MARKER";\nconst literal = "<script>literal source</script>";\n' +
            "long source ".repeat(40)
          : 'marker,note\nTRUNCATED_SOURCE_MARKER,"<script>literal source</script>"\nrow,"' +
            "long source ".repeat(40) +
            '"';
      const scenario: ParityScenario = {
        id: `markdown-truncated-${extension}`,
        title: "Truncated artifact native text",
        backend: "mock",
        path: `/workspace/chats/${THREAD_ID}`,
        mock: {
          threads: [
            {
              thread_id: THREAD_ID,
              title: "Truncated artifact",
              artifacts: [`/mnt/user-data/outputs/${filename}`],
              messages: [
                {
                  type: "ai",
                  id: "truncated-artifact-ai",
                  content: "Created the large artifact.",
                },
              ],
            },
          ],
        },
        routes: [
          {
            pattern: "**/api/threads/*/artifacts/**",
            contentType: extension === "csv" ? "text/csv" : "text/javascript",
            status: 206,
            headers: {
              ETag: `"${"a".repeat(64)}"`,
              "Content-Range": `bytes 0-${Buffer.byteLength(prefix) - 1}/2000000`,
            },
            json: prefix,
          },
        ],
        settle: [{ kind: "visible", target: { testId: "artifact-trigger" } }],
        steps: [
          { kind: "click", target: { testId: "artifact-trigger" } },
          { kind: "click", target: { text: filename, exact: true } },
          { kind: "visible", target: { selector: "#artifacts" } },
          ...(extension === "csv"
            ? [
                {
                  kind: "click" as const,
                  target: {
                    role: "radio" as const,
                    name: "View source",
                    exact: true,
                  },
                },
              ]
            : []),
        ],
      };
      const samples = [];
      for (const [app, base] of APPS) {
        const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
        const page = await context.newPage();
        const runtime = await observeRuntime(page);
        const ranges: string[] = [];
        page.on("request", (request) => {
          if (
            request
              .url()
              .includes(`/artifacts/mnt/user-data/outputs/${filename}`)
          ) {
            const range = request.headers().range;
            if (range !== undefined) ranges.push(range);
          }
        });
        try {
          await runScenario(page, base, scenario, {
            viewport: "desktop",
            theme,
            locale: "en-US",
          });
          const root = page.locator("#artifacts");
          await expect(
            root.getByRole("button", { name: "Load full file", exact: true }),
          ).toBeVisible();
          const pre = root.locator("pre");
          await expect(pre).toBeVisible();
          expect(await pre.textContent()).toBe(prefix);
          await expect(root.locator(".cm-editor")).toHaveCount(0);
          await expect(pre.locator("script")).toHaveCount(0);
          expect(ranges.some((range) => range.startsWith("bytes=0-"))).toBe(
            true,
          );
          const style = await styleOf(pre);
          expect(style.fontSize).toBe("14px");
          expect(style.lineHeight).toBe("20px");
          expect(style.padding).toEqual(["16px", "16px", "16px", "16px"]);
          expect(style.overflowX).toBe("auto");
          expect(style.whiteSpace).toBe("pre-wrap");
          samples.push({ app, style });
          runtime.assertClean();
        } finally {
          await context.close();
        }
      }
      await testInfo.attach(`computed-truncated-${extension}-presentation`, {
        body: JSON.stringify(samples, null, 2),
        contentType: "application/json",
      });
      expect(samples[1]?.style).toEqual(samples[0]?.style);
    }
  });
}

for (const reasoningFormat of ["metadata", "inline"] as const) {
  test(`${reasoningFormat}: a real streamed reasoning-bearing answer preserves its bubble and literal code`, async ({
    browser,
  }, testInfo) => {
    const answer = "PARITY-REASONED-ANSWER";
    const literal = "<think>literal-reasoning-tag</think>";
    const reasoning = "PARITY-REAL-REASONING";
    const content = `${answer}\n\n\`\`\`xml\n${literal}\n\`\`\``;
    const samples = [];
    for (const [app, base] of APPS) {
      const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
      const stream = await heldMessageStream(
        reasoningFormat === "metadata"
          ? { content, reasoning }
          : { content: `<think>${reasoning}</think>${content}` },
      );
      try {
        const page = await context.newPage();
        const runtime = await observeRuntime(page);
        const controller = mockLangGraphAPI(page, {
          threads: [
            { thread_id: THREAD_ID, title: "Reasoned answer", messages: [] },
          ],
        });
        await page.route(
          `**/api/langgraph/threads/${THREAD_ID}/runs/stream`,
          (route) => {
            expect(route.request().method()).toBe("POST");
            stream.setInputs(route.request().postDataJSON());
            return route.continue({ url: stream.url });
          },
        );
        await page.goto(`${base}/workspace/chats/${THREAD_ID}`);
        const input = page.getByRole("textbox", {
          name: /how can i assist you/i,
        });
        await input.fill("Explain the answer and show the literal tag");
        await input.press("Enter");
        const root = page.getByTestId("main-message-list");
        const paragraph = root
          .locator("p")
          .filter({ hasText: new RegExp(`^${answer}$`) });
        await expect(paragraph).toBeVisible();
        await expect(root.locator("pre code")).toContainText(literal);
        await expect(root.getByText(reasoning, { exact: true })).toBeVisible();
        const during = await styleOf(paragraph);
        expect(during.fontSize).toBe("16px");
        expect(during.lineHeight).toBe("24px");
        controller.upsertThread({
          thread_id: THREAD_ID,
          title: "Reasoned answer",
          messages: stream.messages(),
        });
        stream.finish();
        await expect(
          root.locator('[data-streaming-code-block="true"]'),
        ).toHaveCount(0);
        await expect(root.locator("pre code")).toContainText(literal);
        await expect(paragraph).toBeVisible();
        const after = await styleOf(paragraph);
        expect(after.fontSize).toBe("16px");
        expect(after.lineHeight).toBe("24px");
        runtime.assertClean();
        samples.push({ app, during, after });
      } finally {
        try {
          await context.close();
        } finally {
          await stream.close();
        }
      }
    }
    expect(samples[1]?.during).toEqual(samples[0]?.during);
    expect(samples[1]?.after).toEqual(samples[0]?.after);
    await testInfo.attach("reasoned-answer-presentation", {
      body: JSON.stringify(samples, null, 2),
      contentType: "application/json",
    });
  });
}
