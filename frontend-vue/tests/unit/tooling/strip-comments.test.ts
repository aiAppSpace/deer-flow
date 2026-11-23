/*
  【文件职责】     验证共享注释词法扫描器不会把正则内容误当字符串或注释。
  【架构位置】     工程扫描器单元测试
  【主要导出】     无；Vitest cases
  【依赖关系】     scripts/lib/strip-comments.mjs · node:fs
  【边界与注意】   保留真实代码引用、字符串和位置；不缩扫描范围或添加豁免。
*/
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { stripComments } from "../../../scripts/lib/strip-comments.mjs";

const js = ["line", "block"];
const sibling = ["frontend", "src", "real.ts"].join("/");

function expectTrailingCommentsRemoved(code: string) {
  const source = `${code}\n/* removed ${sibling} */\n// removed ${sibling}\nconst keep = "${sibling}";`;
  const stripped = stripComments(source, js);
  expect(stripped.startsWith(code)).toBe(true);
  expect(stripped.match(/removed/g)).toBeNull();
  expect(stripped).toContain(`const keep = "${sibling}";`);
  expect(stripped.length).toBe(source.length);
}

describe("source comment lexical boundaries", () => {
  it.each([
    String.raw`const expression = /["']/g;`,
    String.raw`const expression = /"quoted'/;`,
    String.raw`const expression = /<MessageList\b[\s\S]*?:class="([^"]+)"/;`,
    String.raw`const expression = /[/*"']/;`,
    String.raw`const expression = /[\]"'/]/;`,
    String.raw`const expression = /https?:\/\/[^/]+\/"'/giu;`,
    String.raw`const expression = /\\\/"'/;`,
    String.raw`const expression = /\/*literal\*\//;`,
  ])("preserves regular expression %s and removes real comments", (code) => {
    expectTrailingCommentsRemoved(code);
  });

  it("preserves the historical MessageList regexp fixture's tokens and positions", () => {
    const source = readFileSync(
      new URL(
        "./fixtures/message-list-class-regex.fixture.ts",
        import.meta.url,
      ),
      "utf8",
    );
    const stripped = stripComments(source, js);
    expect(stripped).toContain(
      String.raw`/<MessageList\b[\s\S]*?:class="([^"]+)"/`,
    );
    expect(stripped).not.toContain(["frontend", "src", "app"].join("/"));
    expect(stripped).toContain("SAVE_HINT_STORAGE_KEY");
    expect(stripped.length).toBe(source.length);
    for (const token of ["export const binding", "SAVE_HINT_STORAGE_KEY"])
      expect(stripped.indexOf(token)).toBe(source.indexOf(token));
  });

  it.each([
    String.raw`const ratio = total / "/* literal */" / scale;`,
    String.raw`const ratio = compute() / "/* literal */" / scale;`,
    String.raw`const ratio = values[0] / "/* literal */" / scale;`,
    String.raw`const ratio = 8 / "/* literal */" / scale;`,
    String.raw`const ratio = count++ / "/* literal */" / scale;`,
    String.raw`const ratio = ({ n: 8 }) / "/* literal */" / scale;`,
    String.raw`const ratio = { n: 8 } / "/* literal */" / scale;`,
    String.raw`const ratio = function () {} / "/* literal */" / scale;`,
    String.raw`const ratio = class {} / "/* literal */" / scale;`,
    String.raw`const ratio = object.if() / "/* literal */" / scale;`,
  ])("keeps division operands and their string literals: %s", (code) => {
    expectTrailingCommentsRemoved(code);
  });

  it.each([
    String.raw`if (ready) /["']/g.test(value);`,
    String.raw`while (ready) /["']/g.test(value);`,
    String.raw`for await (const item of items) /["']/g.test(item);`,
    String.raw`function test(value) { return /["']/g.test(value); }`,
    String.raw`if (ready) {} /["']/g.test(value);`,
    String.raw`const test = (value) => /["']/g.test(value);`,
    String.raw`const test = value ? /["']/g : /["']/;`,
  ])(
    "recognizes expression starts after control flow/operators: %s",
    (code) => {
      expectTrailingCommentsRemoved(code);
    },
  );

  it("preserves quoted comment syntax and escaped quote boundaries", () => {
    const code =
      String.raw`const values = ["/* keep */ // keep", 'it\'s /* keep */', ` +
      "`/* template text */ // keep`];";
    expectTrailingCommentsRemoved(code);
  });

  it("lexes template interpolation code while preserving literal template text", () => {
    const source =
      "const value = `/* text */ ${ /[\"']/g.test(input) /* removed */ ? `// nested` : '/* string */' }`; // removed";
    const stripped = stripComments(source, js);
    expect(stripped).toContain("`/* text */ ${ /[\"']/g.test(input)");
    expect(stripped).toContain("`// nested`");
    expect(stripped).toContain("'/* string */'");
    expect(stripped).not.toContain("removed");
  });

  it("keeps line terminators, source length and all code token columns", () => {
    const source =
      'const a = 1; /* removed\r\nnext */ const b = 2; // gone\r\nconst c = "/* literal */";';
    const stripped = stripComments(source, js);
    expect(stripped.length).toBe(source.length);
    expect([...stripped.matchAll(/\r\n/g)].map((match) => match.index)).toEqual(
      [...source.matchAll(/\r\n/g)].map((match) => match.index),
    );
    for (const token of ["const a", "const b", "const c", '"/* literal */"'])
      expect(stripped.indexOf(token)).toBe(source.indexOf(token));
    expect(stripped).not.toMatch(/removed|next|gone/);
  });

  it("preserves HTML tags/attributes and only removes selected HTML comments", () => {
    const source =
      '<template><p title="<!-- literal -->">x</p><!-- removed --><p>y</p></template>';
    const stripped = stripComments(source, ["line", "block", "html"]);
    expect(stripped).toContain('title="<!-- literal -->"');
    expect(stripped).toContain("x</p>");
    expect(stripped).toContain("<p>y</p></template>");
    expect(stripped).not.toContain("removed");
    expect(stripped.length).toBe(source.length);
  });

  it("preserves hash markers in strings and strips hash comments without JS regex rules", () => {
    const source =
      'url = "https://host/#anchor" # removed\nratio = count // 2 # removed\n';
    expect(stripComments(source, ["hash"])).toBe(
      'url = "https://host/#anchor"          \nratio = count // 2          \n',
    );
  });

  it("does not remove unselected comment styles or comment-like JSON string data", () => {
    const source = '{ "path": "/* literal */", "url": "https://host/#x" }';
    expect(stripComments(source, [])).toBe(source);
    expect(stripComments("/* keep */\n// removed\n", ["line"])).toBe(
      "/* keep */\n          \n",
    );
    expect(stripComments("/* removed */\n// keep\n", ["block"])).toBe(
      "             \n// keep\n",
    );
  });
});

describe("standalone scanner code/comment classification", () => {
  it("ignores regex-following comment references while real import references still block", () => {
    const temporary = mkdtempSync(join(tmpdir(), "standalone-comments-"));
    const root = join(temporary, "frontend-vue");
    const scripts = join(root, "scripts");
    const library = join(scripts, "lib");
    mkdirSync(library, { recursive: true });
    copyFileSync(
      new URL("../../../scripts/standalone-check.mjs", import.meta.url),
      join(scripts, "standalone-check.mjs"),
    );
    copyFileSync(
      new URL("../../../scripts/lib/strip-comments.mjs", import.meta.url),
      join(library, "strip-comments.mjs"),
    );
    // The isolated fixture has no declared cross-app tools or exemptions.
    writeFileSync(
      join(library, "cross-app-by-design.mjs"),
      "export const CROSS_APP_BY_DESIGN = {};\n",
    );
    const source = `${String.raw`const binding = /<MessageList\b[\s\S]*?:class="([^"]+)"/;`}\n/* ${sibling} */\n`;
    const fixture = join(root, "fixture.ts");
    const scan = () =>
      spawnSync(
        process.execPath,
        [join(scripts, "standalone-check.mjs"), "--json"],
        { cwd: root, encoding: "utf8" },
      );
    try {
      writeFileSync(fixture, source);
      expect(
        spawnSync("git", ["init", "--quiet"], { cwd: temporary }).status,
      ).toBe(0);
      expect(spawnSync("git", ["add", "-A"], { cwd: temporary }).status).toBe(
        0,
      );
      const commentsOnly = scan();
      expect(commentsOnly.status, commentsOnly.stderr).toBe(0);
      expect(JSON.parse(commentsOnly.stdout)).toMatchObject({
        blocking: 0,
        blockingFiles: 0,
        staleDeclarations: [],
      });
      writeFileSync(fixture, source + `import value from "../${sibling}";\n`);
      const realReference = scan();
      expect(realReference.status, realReference.stderr).toBe(1);
      expect(JSON.parse(realReference.stdout)).toMatchObject({
        blocking: 1,
        blockingFiles: 1,
        rows: [{ file: "fixture.ts", line: 3, hits: 1 }],
      });
    } finally {
      rmSync(temporary, { recursive: true, force: true });
    }
  });
});
