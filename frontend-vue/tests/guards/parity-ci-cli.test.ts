import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  collectSpecFiles,
  EXPLICIT_GROUPS,
  filePattern,
  GROUPS,
  planGroups,
  runGroup,
} from "../../scripts/parity-ci.mjs";

const workspace = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const playwright = createRequire(import.meta.url).resolve("@playwright/test");
const fixtures: string[] = [];
afterEach(() =>
  fixtures
    .splice(0)
    .forEach((path) => rmSync(path, { recursive: true, force: true })),
);

function fixture(files: string[]) {
  const root = realpathSync(
    mkdtempSync(join(tmpdir(), "deerflow parity [CLI]-")),
  );
  fixtures.push(root);
  const suite = join(root, "tests/e2e-parity");
  for (const file of files) {
    const destination = join(suite, file);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(
      destination,
      `import { test } from ${JSON.stringify(playwright)};\ntest(${JSON.stringify(file)}, () => {});\n`,
    );
  }
  const config = join(root, "playwright.config.cjs");
  writeFileSync(
    config,
    'module.exports = { testDir: "./tests/e2e-parity", workers: 1 };\n',
  );
  return { root, suite, config };
}

function collect(config: string, pattern?: string) {
  const child = spawnSync(
    process.platform === "win32" ? "python" : "python3",
    [
      "../scripts/pnpm.py",
      "--dir",
      "frontend-vue",
      "exec",
      "playwright",
      "test",
      "-c",
      config,
      "--list",
      "--reporter=json",
      ...(pattern ? [pattern] : []),
    ],
    { cwd: workspace, encoding: "utf8", timeout: 20_000 },
  );
  if (child.error) throw child.error;
  const report = JSON.parse(child.stdout) as { suites: Suite[] };
  function titles(suites: Suite[]): string[] {
    return suites.flatMap((suite) => [
      ...(suite.specs ?? []).map((spec) => spec.title),
      ...titles(suite.suites ?? []),
    ]);
  }
  return {
    status: child.status,
    titles: titles(report.suites).sort(),
    stderr: child.stderr,
  };
}
type Suite = { specs?: { title: string }[]; suites?: Suite[] };

describe("installed Playwright CLI file ownership", () => {
  it("collects each nested real file in exactly one actual runner group", () => {
    const { root, suite, config } = fixture([
      ...Object.values(EXPLICIT_GROUPS).flat(),
      "nested/new.spec.ts",
      "a.b.spec.ts",
      "nested/diff.spec.ts",
      "other/diff.spec.ts",
      "nested/tests/e2e-parity/diff.spec.ts",
    ]);
    const files = collectSpecFiles(suite);
    const selected: string[] = [];
    for (const group of GROUPS) {
      let filter: string | undefined;
      const run = vi
        .fn()
        .mockImplementation((_command: string, args: string[]) => {
          if (args.includes("playwright.parity.config.ts"))
            filter = args.at(-1);
          return { status: 0 };
        });
      expect(runGroup(group, { cwd: root, env: {}, run })).toBe(0);
      expect(filter).toBeTypeOf("string");
      const result = collect(config, filter);
      expect(result.status, result.stderr).toBe(0);
      expect(result.titles).toEqual([...planGroups(files)[group]!].sort());
      selected.push(...result.titles);
    }
    expect(selected.sort()).toEqual(files);
    expect(new Set(selected).size).toBe(selected.length);
  }, 45_000);

  it("rejects a case-only filename mismatch that a plain CLI string accepts", () => {
    // One actual uppercase file works even on case-insensitive macOS filesystems.
    // The logical inventory describes the lowercase file the ledger owns.
    const { suite, config } = fixture(["Diff.spec.ts"]);
    const logical = [...Object.values(EXPLICIT_GROUPS).flat(), "new.spec.ts"];
    const pattern = filePattern("ledger", logical, suite);
    expect(collect(config, pattern)).toMatchObject({
      status: 0,
      titles: ["Diff.spec.ts"],
    });
    expect(collect(config, `/${pattern}/`)).toMatchObject({
      status: 1,
      titles: [],
    });
  }, 30_000);
});
