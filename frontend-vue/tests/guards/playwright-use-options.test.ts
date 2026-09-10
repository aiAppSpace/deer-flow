/*
  【文件职责】     挡住写进 Playwright `use` 顶层、但那一版根本不认识的选项。
  【架构位置】     门禁测试
  【主要导出】     无
  【依赖关系】     根目录的 playwright 配置 · tests 下每个 spec 里的 test.use()
  【边界与注意】   这类错**没有任何运行时信号**：Playwright 不会对 `use` 里多出来的键
                   报错，它只是不生效。2026-09-11 实测（探针 spec，about:blank +
                   `matchMedia("(prefers-reduced-motion: reduce)").matches`）：

                     test.use({ reducedMotion: "reduce" })                  → false
                     test.use({ contextOptions: { reducedMotion: "reduce" }}) → true

                   本仓两处这么写过：对照取样的 use、以及视觉基线的 seed spec。
                   对照那处没造成后果，因为 diff.spec.ts 是自己 `browser.newContext()`
                   开 context 的，而 newContext **认识** `reducedMotion`——
                   同一份常量在两个口子上形状不同，正是最容易看走眼的地方。
                   tests/e2e/reduced-motion.spec.ts 更早就撞见过，当时归因成
                   「describe 级选项没传下去」，没找到真正的原因。

                   **判据是类型，不是名单**：从 Playwright 自己的 `PlaywrightTestOptions`
                   / `PlaywrightWorkerOptions` 声明里取合法键，所以升级 Playwright、
                   哪天 `reducedMotion` 真的进了 use 顶层，这道门禁自己就松开了。
*/

import { createRequire } from "node:module";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const require = createRequire(import.meta.url);

/*
  从**装着的那一份**类型声明里取，不是从写死的路径——pnpm 把包放在
  .pnpm/<name>@<version>/ 下面，写死路径升一次版就断。
*/
const PLAYWRIGHT_TEST_TYPES = join(
  dirname(require.resolve("playwright/package.json")),
  "types/test.d.ts",
);

/** Playwright 类型声明里 `use` 收得下的键。 */
function legalUseKeys(): Set<string> {
  const types = readFileSync(PLAYWRIGHT_TEST_TYPES, "utf8");
  const keys = new Set<string>();
  for (const block of ["PlaywrightTestOptions", "PlaywrightWorkerOptions"]) {
    const start = types.indexOf(`export interface ${block} {`);
    expect(start, `${block} 在 Playwright 类型里找不到了`).toBeGreaterThan(-1);
    // 接口体到第一处顶格 `}` 为止。
    const end = types.indexOf("\n}", start);
    for (const match of types
      .slice(start, end)
      .matchAll(/^ {2}([A-Za-z_$][\w$]*)(\??):/gm)) {
      keys.add(match[1]!);
    }
  }
  return keys;
}

/** 每个 `use: {…}` / `test.use({…})` 字面量的**顶层**键。 */
function topLevelUseKeys(source: string): string[] {
  const keys: string[] = [];
  for (const match of source.matchAll(/(?:^|[.\s])use:?\s*\(?\s*\{/g)) {
    let depth = 0;
    let index = match.index! + match[0].length - 1;
    for (; index < source.length; index += 1) {
      const char = source[index];
      if (char === "{") depth += 1;
      else if (char === "}") {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    const body = source.slice(match.index! + match[0].length, index);
    let nesting = 0;
    for (const line of body.split("\n")) {
      const key =
        nesting === 0 ? /^\s{0,4}([A-Za-z_$][\w$]*)\s*:/.exec(line) : null;
      if (key) keys.push(key[1]!);
      for (const char of line) {
        if (char === "{" || char === "[") nesting += 1;
        if (char === "}" || char === "]") nesting -= 1;
      }
    }
  }
  return keys;
}

/*
  扫的是源文本，不是 AST——所以本文件头里那两行反例会被自己数进去。
  排除自己，比为了一条注释去接一整个解析器划算。
*/
function sourcesWithUse(): { file: string; source: string }[] {
  const files: string[] = readdirSync(repoRoot)
    .filter((name) => /^playwright.*\.config\.ts$/.test(name))
    .map((name) => join(repoRoot, name));
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".spec.ts") || entry.name.endsWith(".ts"))
        files.push(full);
    }
  };
  walk(join(repoRoot, "tests"));
  return files
    .filter((file) => file !== fileURLToPath(import.meta.url))
    .map((file) => ({ file, source: readFileSync(file, "utf8") }))
    .filter(({ source }) => /\buse:?\s*\(?\s*\{/.test(source));
}

describe("Playwright 的 use 只收它认识的键", () => {
  it("没有哪个 use 顶层键是 Playwright 不认识的", () => {
    const legal = legalUseKeys();
    expect(legal.has("colorScheme"), "取键失败：连 colorScheme 都没读到").toBe(
      true,
    );
    const strays: string[] = [];
    for (const { file, source } of sourcesWithUse()) {
      for (const key of topLevelUseKeys(source)) {
        if (!legal.has(key)) {
          strays.push(`${file.slice(repoRoot.length)} → use.${key}`);
        }
      }
    }
    expect(
      strays,
      "这些键会被 Playwright 安静忽略；多半该进 contextOptions",
    ).toEqual([]);
  });
});
