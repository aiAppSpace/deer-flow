import { createHash } from "node:crypto";
import { expect, test, type Locator } from "./support/test";

import { PARITY_CONTEXT_OPTIONS } from "./support/context-options";
import { runScenario, type ParityScenario } from "./support/scenarios";

const APPS = [
  ["react", process.env.E2E_REACT_APP_URL ?? "http://localhost:3116"],
  ["vue", process.env.E2E_APP_URL ?? "http://localhost:3115"],
] as const;
const THREAD_ID = "00000000-0000-0000-0000-000000004371";
const INITIAL_SHA = "a".repeat(64);
const SAVED_SHA = "b".repeat(64);
const LONG_TEXT = "long_segment_".repeat(60);
const FILES = [
  {
    name: "analysis.css",
    contentType: "text/css",
    source: `/* editor contract */\n.editor {\n  color: #123456;\n  content: "parity";\n}\n/* ${LONG_TEXT} */`,
  },
  {
    name: "analysis.html",
    contentType: "text/html",
    source: `<!doctype html>\n<html lang="en">\n<body><strong class="editor">parity</strong></body>\n</html>\n<!-- ${LONG_TEXT} -->`,
  },
  {
    name: "analysis.py",
    contentType: "text/x-python",
    source: `# editor contract\ndef total(rows):\n    text = "parity"\n    return sum(rows) + 42\n# ${LONG_TEXT}`,
  },
  {
    name: "analysis.js",
    contentType: "text/javascript",
    source: `// editor contract\nexport function total(rows) {\n  const text = "parity";\n  return rows.length + 42;\n}\n// ${LONG_TEXT}`,
  },
  {
    name: "analysis.json",
    contentType: "application/json",
    source: `{\n  "label": "parity",\n  "enabled": true,\n  "count": 42,\n  "long": "${LONG_TEXT}"\n}`,
  },
  {
    name: "analysis.md",
    contentType: "text/markdown",
    source: `# Editor contract\n**parity** and \`total(rows)\` with [link](https://example.test).\n> quoted source\n<!-- ${LONG_TEXT} -->`,
  },
  {
    name: "analysis.txt",
    contentType: "text/plain",
    source: `editor contract\nplain parity notes\n${LONG_TEXT}`,
  },
] as const;

type FileFixture = (typeof FILES)[number];

function scenarioFor(file: FileFixture): ParityScenario {
  const path = `/mnt/user-data/outputs/${file.name}`;
  return {
    id: "code-editor-public-artifact",
    title: "Inspect and edit a generated source file",
    backend: "mock",
    path: `/workspace/chats/${THREAD_ID}`,
    mock: {
      threads: [
        {
          thread_id: THREAD_ID,
          title: "Code editor contract",
          artifacts: [path],
          messages: [
            {
              id: "editor-human",
              type: "human",
              content: "Create an analysis file",
            },
            {
              id: "editor-ai",
              type: "ai",
              content: "Created the analysis file.",
            },
          ],
        },
      ],
    },
    routes: [
      {
        pattern: `**/api/threads/${THREAD_ID}/artifacts/**`,
        contentType: file.contentType,
        headers: { ETag: `"${INITIAL_SHA}"` },
        json: file.source,
      },
    ],
    settle: [{ kind: "visible", target: { testId: "artifact-trigger" } }],
    steps: [
      { kind: "click", target: { testId: "artifact-trigger" } },
      { kind: "click", target: { text: file.name, exact: true } },
      { kind: "visible", target: { selector: "#artifacts" } },
    ],
  };
}

async function documentText(editor: Locator) {
  return editor
    .locator(".cm-line")
    .evaluateAll((lines) =>
      lines.map((line) => line.textContent ?? "").join("\n"),
    );
}

async function rendering(editor: Locator) {
  return editor.evaluate((content) => {
    const root = content.closest(".cm-editor")!;
    const scroller = root.querySelector(".cm-scroller")!;
    const firstLine = content.querySelector(".cm-line")!;
    const rootBox = root.getBoundingClientRect();
    const contentBox = content.getBoundingClientRect();
    const lineBox = firstLine.getBoundingClientRect();
    const styleOf = (element: Element) => {
      const style = getComputedStyle(element);
      return {
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        lineHeight: style.lineHeight,
        fontWeight: style.fontWeight,
        letterSpacing: style.letterSpacing,
        tabSize: style.tabSize,
        whiteSpace: style.whiteSpace,
        color: style.color,
        backgroundColor: style.backgroundColor,
        caretColor: style.caretColor,
        padding: [
          style.paddingTop,
          style.paddingRight,
          style.paddingBottom,
          style.paddingLeft,
        ],
      };
    };
    return {
      content: styleOf(content),
      firstLine: styleOf(firstLine),
      scroller: styleOf(scroller),
      lineHeight: lineBox.height,
      contentTop: contentBox.top - rootBox.top,
      firstLineTop: lineBox.top - contentBox.top,
      firstLineLeft: lineBox.left - rootBox.left,
      tokens: [...content.querySelectorAll(".cm-line span[class]")].map(
        (token) => ({
          text: token.textContent,
          color: getComputedStyle(token).color,
          fontStyle: getComputedStyle(token).fontStyle,
          fontWeight: getComputedStyle(token).fontWeight,
          textDecoration: getComputedStyle(token).textDecorationLine,
        }),
      ),
    };
  });
}

async function replaceDocument(editor: Locator, mod: string, value: string) {
  await editor.click();
  await editor.press(`${mod}+a`);
  await editor.page().keyboard.insertText(value);
  await expect.poll(() => documentText(editor)).toBe(value);
}

async function selectionAndCaret(editor: Locator, mod: string) {
  const page = editor.page();
  await editor.press(`${mod}+a`);
  await page.keyboard.press("ArrowLeft");
  // The cursor and selection layers are measured after native key events,
  // rather than consulting either implementation's theme or editor state.
  const cm = editor.page().locator("#artifacts .cm-editor");
  await expect(cm.locator(".cm-cursor").first()).toBeAttached();
  const cursor = await cm
    .locator(".cm-cursor")
    .first()
    .evaluate((node) => {
      const style = getComputedStyle(node);
      return {
        borderLeftColor: style.borderLeftColor,
        borderLeftWidth: style.borderLeftWidth,
        height: node.getBoundingClientRect().height,
      };
    });
  await page.keyboard.press("Shift+ArrowRight");
  await expect
    .poll(() => page.evaluate(() => getSelection()?.toString().length))
    .toBe(1);
  await expect(cm.locator(".cm-selectionBackground").first()).toBeAttached();
  const selection = await cm
    .locator(".cm-selectionBackground")
    .evaluateAll((nodes) =>
      nodes.map((node) => ({
        backgroundColor: getComputedStyle(node).backgroundColor,
        height: node.getBoundingClientRect().height,
        width: node.getBoundingClientRect().width,
      })),
    );
  expect(selection.length).toBeGreaterThan(0);
  expect(selection[0]!.width).toBeGreaterThan(0);
  await page.keyboard.press("ArrowLeft");
  return { cursor, selection };
}

async function keyboardContract(editor: Locator, mod: string) {
  const page = editor.page();
  await replaceDocument(editor, mod, "alpha");
  await editor.press("Tab");
  await expect(editor).toBeFocused();
  await expect.poll(() => documentText(editor)).toMatch(/^\s+alpha$/);
  const indented = await documentText(editor);
  await editor.press("Shift+Tab");
  await expect.poll(() => documentText(editor)).toBe("alpha");
  await editor.press("Tab");
  await editor.press(`${mod}+z`);
  await expect.poll(() => documentText(editor)).toBe("alpha");
  // CM's default redo is Mod-Y; macOS overrides it with Mod-Shift-Z.
  // Ctrl-Shift-Z is an additional Linux binding, not the Windows binding
  // used by Playwright's Desktop Chrome context on this host.
  await editor.press(mod === "Meta" ? "Meta+Shift+z" : "Control+y");
  await expect.poll(() => documentText(editor)).toBe(indented);
  await editor.press(`${mod}+z`);
  await expect.poll(() => documentText(editor)).toBe("alpha");

  await replaceDocument(editor, mod, "call");
  await editor.pressSequentially("(");
  await expect.poll(() => documentText(editor)).toBe("call()");
  const caretOffset = await editor.evaluate((content) => {
    const selection = getSelection()!;
    const before = document.createRange();
    before.setStart(content, 0);
    before.setEnd(selection.anchorNode!, selection.anchorOffset);
    return before.toString().length;
  });
  expect(caretOffset).toBe(5);
  await page.keyboard.press("Backspace");
  await expect.poll(() => documentText(editor)).toBe("call");
  return { indented, caretOffset };
}

for (const file of FILES)
  for (const theme of ["light", "dark"] as const)
    test(`${file.name}/${theme}: public source and edit match React rendering and native editor commands`, async ({
      browser,
    }, testInfo) => {
      const observed: Record<string, unknown> = {};
      let reactRendering:
        | {
            source: Awaited<ReturnType<typeof rendering>>;
            edit: Awaited<ReturnType<typeof rendering>>;
          }
        | undefined;
      for (const [app, base] of APPS) {
        const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
        const page = await context.newPage();
        const errors: string[] = [];
        const unmatched: string[] = [];
        const puts: unknown[] = [];
        let savedContent: string = file.source;
        let savedSha = INITIAL_SHA;
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("request", (request) => {
          if (
            request.method() === "PUT" &&
            new URL(request.url()).pathname.startsWith(
              `/api/threads/${THREAD_ID}/artifacts/`,
            )
          )
            puts.push(request.postDataJSON());
        });
        await page.route("**/api/**", async (route) => {
          unmatched.push(
            `${route.request().method()} ${new URL(route.request().url()).pathname}`,
          );
          await route.abort("blockedbyclient");
        });
        try {
          await runScenario(page, base, scenarioFor(file), {
            viewport: "desktop",
            locale: "en-US",
            theme,
          });
          const panel = page.locator("#artifacts");
          await expect(
            panel.getByText(file.name, { exact: true }),
          ).toBeVisible();
          if (/\.(md|html)$/.test(file.name)) {
            const source = panel.getByRole("radio", {
              name: "View source",
              exact: true,
            });
            await source.click();
            await expect(source).toBeChecked();
          }
          const editor = panel.locator(".cm-content");
          await expect(editor).toHaveCount(1);
          await expect(editor).toHaveAttribute("contenteditable", "false");
          await expect.poll(() => documentText(editor)).toBe(file.source);
          if (file.name.endsWith(".txt"))
            await expect(editor.locator("span[class]")).toHaveCount(0);
          else
            await expect(editor.locator("span[class]").first()).toBeAttached();
          if (file.name.endsWith(".json"))
            await expect(editor.locator(".cm-matchingBracket")).toHaveText([
              "{",
              "}",
            ]);
          const sourceRendering = await rendering(editor);
          await testInfo.attach(`${app}-source-rendering`, {
            body: JSON.stringify(sourceRendering, null, 2),
            contentType: "application/json",
          });
          if (app === "vue")
            expect(sourceRendering).toEqual(reactRendering!.source);
          if (file.name.endsWith(".txt"))
            expect(sourceRendering.tokens).toEqual([]);
          else {
            expect(sourceRendering.tokens.length).toBeGreaterThan(1);
            expect(
              sourceRendering.tokens.some(
                (token) => token.color !== sourceRendering.content.color,
              ),
            ).toBe(true);
          }
          expect(puts).toEqual([]);

          await page.route(
            `**/api/threads/${THREAD_ID}/artifacts/**`,
            async (route) => {
              if (route.request().method() === "PUT") {
                const body = route.request().postDataJSON() as {
                  content: string;
                  expected_sha256: string;
                };
                expect(body.expected_sha256).toBe(savedSha);
                savedContent = body.content;
                savedSha = SAVED_SHA;
                return route.fulfill({
                  json: {
                    path: `/mnt/user-data/outputs/${file.name}`,
                    sha256: savedSha,
                    size: new TextEncoder().encode(savedContent).byteLength,
                  },
                });
              }
              if (route.request().method() === "GET")
                return route.fulfill({
                  contentType: file.contentType,
                  headers: { ETag: `"${savedSha}"` },
                  body: savedContent,
                });
              return route.fallback();
            },
          );
          await panel
            .getByRole("button", { name: "Edit", exact: true })
            .click();
          await expect(editor).toHaveAttribute("contenteditable", "true");
          await expect(editor).toBeFocused();
          await expect.poll(() => documentText(editor)).toBe(file.source);
          const editRendering = await rendering(editor);
          if (app === "react")
            reactRendering = { source: sourceRendering, edit: editRendering };
          else expect(editRendering).toEqual(reactRendering!.edit);
          const save = panel.getByRole("button", { name: "Save", exact: true });
          await expect(save).toBeDisabled();

          // CodeMirror resolves Mod using the browser platform. The actual
          // trusted key events must use that keymap even with a desktop UA
          // supplied by Playwright on a different host operating system.
          const mod = (await page.evaluate(() =>
            /Mac/.test(navigator.platform),
          ))
            ? "Meta"
            : "Control";
          const selection = await selectionAndCaret(editor, mod);
          const scroller = panel.locator(".cm-scroller");
          const longLine = editor
            .locator(".cm-line")
            .filter({ hasText: LONG_TEXT });
          const longGeometry = await longLine.evaluate((line) => {
            const host = line.closest(".cm-scroller")!;
            const text = document.createRange();
            text.selectNodeContents(line);
            return {
              lineHeight: line.getBoundingClientRect().height,
              textHeight: text.getBoundingClientRect().height,
              textWidth: text.getBoundingClientRect().width,
              clientWidth: host.clientWidth,
              scrollWidth: host.scrollWidth,
              whiteSpace: getComputedStyle(line).whiteSpace,
            };
          });
          expect(longGeometry.whiteSpace).toBe("pre");
          expect(longGeometry.textWidth).toBeGreaterThan(
            longGeometry.clientWidth,
          );
          expect(longGeometry.scrollWidth).toBeGreaterThan(
            longGeometry.clientWidth,
          );
          expect(longGeometry.lineHeight).toBe(editRendering.lineHeight);
          await scroller.hover();
          await page.mouse.wheel(900, 0);
          await expect
            .poll(() => scroller.evaluate((node) => node.scrollLeft))
            .toBeGreaterThan(0);
          await page.mouse.wheel(-10_000, 0);
          await expect
            .poll(() => scroller.evaluate((node) => node.scrollLeft))
            .toBe(0);

          let commands;
          if (/\.(py|js|md)$/.test(file.name)) {
            await editor.click();
            await editor.press(`${mod}+f`);
            const search = panel.locator('.cm-search input[name="search"]');
            await expect(search).toBeFocused();
            // CM's native panel commits on keyup/change, not input alone.
            // Exercise actual typing, including replacing a selected query.
            await search.press(`${mod}+a`);
            await search.pressSequentially("parity");
            await expect(panel.locator(".cm-searchMatch").first()).toHaveText(
              "parity",
            );
            await search.press("Escape");
            await expect(search).toHaveCount(0);
            await expect(editor).toBeFocused();
            await expect.poll(() => documentText(editor)).toBe(file.source);
            commands = await keyboardContract(editor, mod);
          }

          const saved = `${file.source}\neditor_contract_saved`;
          await replaceDocument(editor, mod, saved);
          await expect(save).toBeEnabled();
          await editor.press(`${mod}+s`);
          await expect(save).toBeDisabled();
          expect(puts).toEqual([
            { content: saved, expected_sha256: INITIAL_SHA },
          ]);
          await expect.poll(() => documentText(editor)).toBe(saved);
          await panel
            .getByRole("button", { name: "Exit editing", exact: true })
            .click();
          await expect(editor).toHaveAttribute("contenteditable", "false");
          await expect.poll(() => documentText(editor)).toBe(saved);
          expect(unmatched).toEqual([]);
          expect(errors).toEqual([]);
          observed[app] = {
            sourceRendering,
            editRendering,
            selection,
            commands,
            longLine: {
              lineHeight: longGeometry.lineHeight,
              textHeight: longGeometry.textHeight,
              textWidth: longGeometry.textWidth,
              whiteSpace: longGeometry.whiteSpace,
            },
            puts,
          };
          await testInfo.attach(`${app}-editor-contract`, {
            body: JSON.stringify(observed[app], null, 2),
            contentType: "application/json",
          });
        } finally {
          await context.close();
        }
      }
      expect(observed.vue).toEqual(observed.react);
    });

for (const [app, base] of APPS)
  test(`${app}: missing WebCrypto and ETag retain the real byte revision through editor save`, async ({
    browser,
  }) => {
    const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await context.addInitScript(() => {
      Object.defineProperty(window.crypto, "subtle", { value: undefined });
    });
    const file = FILES[6];
    let current = `\ufeff${file.source}`;
    const initialSha = createHash("sha256").update(current).digest("hex");
    const scenario = scenarioFor(file);
    scenario.routes = [
      {
        pattern: `**/api/threads/${THREAD_ID}/artifacts/**`,
        contentType: file.contentType,
        json: current,
      },
    ];
    const puts: Array<{ content: string; expected_sha256: string }> = [];
    try {
      await runScenario(page, base, scenario, {
        viewport: "desktop",
        locale: "en-US",
        theme: "light",
      });
      expect(await page.evaluate(() => window.crypto.subtle)).toBeUndefined();
      await page.route(
        `**/api/threads/${THREAD_ID}/artifacts/**`,
        async (route) => {
          if (route.request().method() === "PUT") {
            const body = route.request().postDataJSON() as {
              content: string;
              expected_sha256: string;
            };
            puts.push(body);
            expect(body.expected_sha256).toBe(
              createHash("sha256").update(current).digest("hex"),
            );
            current = body.content;
            return route.fulfill({
              json: {
                path: `/mnt/user-data/outputs/${file.name}`,
                sha256: createHash("sha256").update(current).digest("hex"),
                size: Buffer.byteLength(current),
              },
            });
          }
          return route.fulfill({
            contentType: file.contentType,
            body: current,
          });
        },
      );
      const panel = page.locator("#artifacts");
      const editor = panel.locator(".cm-content");
      await expect.poll(() => documentText(editor)).toBe(file.source);
      await panel.getByRole("button", { name: "Edit", exact: true }).click();
      await expect(editor).toHaveAttribute("contenteditable", "true");
      const mod = (await page.evaluate(() => /Mac/.test(navigator.platform)))
        ? "Meta"
        : "Control";
      const next = `${file.source}\nbyte_revision_saved`;
      await replaceDocument(editor, mod, next);
      const save = panel.getByRole("button", { name: "Save", exact: true });
      await expect(save).toBeEnabled();
      await editor.press(`${mod}+s`);
      await expect(save).toBeDisabled();
      expect(puts).toEqual([{ content: next, expected_sha256: initialSha }]);
      await panel
        .getByRole("button", { name: "Exit editing", exact: true })
        .click();
      await expect(editor).toHaveAttribute("contenteditable", "false");
      await expect.poll(() => documentText(editor)).toBe(next);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

for (const [app, base] of APPS)
  test(`${app}: a partial response to Load full file remains uneditable`, async ({
    browser,
  }) => {
    const context = await browser.newContext(PARITY_CONTEXT_OPTIONS);
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const scenario = scenarioFor(FILES[6]);
    const prefix = "PARTIAL_PREVIEW";
    scenario.routes = [
      {
        pattern: `**/api/threads/${THREAD_ID}/artifacts/**`,
        contentType: "text/plain",
        status: 206,
        headers: {
          "Content-Range": `bytes 0-${prefix.length - 1}/2000000`,
          ETag: `"${INITIAL_SHA}"`,
        },
        json: prefix,
      },
    ];
    try {
      await runScenario(page, base, scenario, {
        viewport: "desktop",
        locale: "en-US",
        theme: "light",
      });
      const panel = page.locator("#artifacts");
      await expect(panel.locator("pre")).toHaveText(prefix);
      await expect(
        panel.getByRole("button", { name: "Edit", exact: true }),
      ).toHaveCount(0);
      let fullReads = 0;
      const partial = "PARTIAL_AFTER_FULL";
      await page.route(`**/api/threads/${THREAD_ID}/artifacts/**`, (route) => {
        expect(route.request().method()).toBe("GET");
        expect(route.request().headers().range).toBeUndefined();
        fullReads++;
        return route.fulfill({
          status: 206,
          contentType: "text/plain",
          headers: {
            "Content-Range": `bytes 0-${partial.length - 1}/2000000`,
            ETag: `"${INITIAL_SHA}"`,
          },
          body: partial,
        });
      });
      await panel
        .getByRole("button", { name: "Load full file", exact: true })
        .click();
      await expect(panel.locator("pre")).toHaveText(partial);
      expect(fullReads).toBe(1);
      await expect(
        panel.getByRole("button", { name: "Load full file", exact: true }),
      ).toBeVisible();
      await expect(
        panel.getByRole("button", { name: "Edit", exact: true }),
      ).toHaveCount(0);
      await expect(
        panel.getByRole("button", { name: "Save", exact: true }),
      ).toHaveCount(0);
      await expect(
        panel.locator('.cm-content[contenteditable="true"]'),
      ).toHaveCount(0);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
