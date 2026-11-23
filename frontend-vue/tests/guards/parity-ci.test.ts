import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  realpathSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  collectSpecFiles,
  EXPLICIT_GROUPS,
  filePattern,
  GROUPS,
  parseArguments,
  planGroups,
  runGroup,
} from "../../scripts/parity-ci.mjs";

const files = [
  ...Object.values(EXPLICIT_GROUPS).flat(),
  "nested/new.spec.ts",
  "a.b.spec.ts",
  "nested/diff.spec.ts",
  "other/diff.spec.ts",
  "nested/tests/e2e-parity/diff.spec.ts",
  "Diff.spec.ts",
];
const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

function fixture() {
  const cwd = mkdtempSync(join(tmpdir(), "deerflow-ci-groups-"));
  directories.push(cwd);
  for (const file of files) {
    const path = join(cwd, "tests/e2e-parity", file);
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, "");
  }
  return realpathSync(cwd);
}

describe("whole-file CI partition", () => {
  it("assigns every existing and future spec exactly once", () => {
    const groups = planGroups(files);
    expect(Object.keys(groups)).toEqual(GROUPS);
    const union = Object.values(groups).flat();
    expect(new Set(union).size).toBe(union.length);
    expect([...union].sort()).toEqual([...files].sort());
    expect(groups.interactions).toEqual([
      "nested/new.spec.ts",
      "a.b.spec.ts",
      "nested/diff.spec.ts",
      "other/diff.spec.ts",
      "nested/tests/e2e-parity/diff.spec.ts",
      "Diff.spec.ts",
    ]);
  });

  it("rejects missing, empty or duplicate inventories and unknown groups", () => {
    expect(() => planGroups([])).toThrow();
    expect(() => planGroups([...files, files[0]!])).toThrow();
    expect(() => planGroups(files.slice(1))).toThrow();
    expect(() => filePattern("typo", files)).toThrow();
    expect(() => filePattern("__proto__", files)).toThrow();
  });

  it("matches only selected whole files, including Windows nested paths", () => {
    for (const group of GROUPS) {
      const pattern = new RegExp(
        filePattern(group, files, "/checkout/tests/e2e-parity"),
      );
      for (const file of files)
        expect(pattern.test(`/checkout/tests/e2e-parity/${file}`)).toBe(
          planGroups(files)[group]!.includes(file),
        );
    }
    const windowsPattern = new RegExp(
      filePattern(
        "interactions",
        files,
        String.raw`C:\checkout\tests\e2e-parity`,
      ),
    );
    expect(
      windowsPattern.test(
        String.raw`C:\checkout\tests\e2e-parity\nested\new.spec.ts`,
      ),
    ).toBe(true);
    const pattern = new RegExp(
      filePattern("interactions", files, "/checkout/tests/e2e-parity"),
    );
    for (const file of [
      "aXb.spec.ts",
      "prefixa.b.spec.ts",
      "a.b.spec.ts.backup",
    ])
      expect(pattern.test(`/checkout/tests/e2e-parity/${file}`)).toBe(false);
  });

  it("binds the actual suite root and preserves exactly one owner for repeated basenames", () => {
    for (const root of [
      "/checkout with [brackets]/tests/e2e-parity",
      String.raw`C:\checkout with [brackets]\tests\e2e-parity`,
      String.raw`\\server\share\tests\e2e-parity`,
    ]) {
      const separator = root.includes("\\") ? "\\" : "/";
      for (const file of files) {
        const absolute = root + separator + file.replaceAll("/", separator);
        const owners = GROUPS.filter((group) =>
          new RegExp(filePattern(group, files, root)).test(absolute),
        );
        expect(owners).toEqual([
          Object.keys(planGroups(files)).find((group) =>
            planGroups(files)[group]!.includes(file),
          ),
        ]);
        expect(
          GROUPS.filter((group) =>
            new RegExp(filePattern(group, files, root + separator)).test(
              absolute,
            ),
          ),
        ).toEqual(owners);
        for (const group of GROUPS)
          expect(
            new RegExp(filePattern(group, files, root)).test(
              "wrong" + absolute,
            ),
          ).toBe(false);
      }
    }
  });

  it("covers the current inventory without overlapping any spec", () => {
    const directory = fileURLToPath(new URL("../e2e-parity/", import.meta.url));
    const actual = collectSpecFiles(directory);
    const groups = planGroups(actual);
    expect(Object.values(groups).flat().sort()).toEqual(actual);
    for (const file of actual)
      expect(
        GROUPS.filter((group) =>
          new RegExp(filePattern(group, actual, resolve(directory))).test(
            join(directory, file),
          ),
        ),
      ).toHaveLength(1);
  });

  it("does not accept user filters or extra CLI options in a formal group", () => {
    expect(parseArguments(["--matrix"])).toEqual({ matrix: true });
    expect(parseArguments(["--group", "ledger"])).toEqual({ group: "ledger" });
    for (const args of [
      [],
      ["--group"],
      ["--group", "typo"],
      ["--group", "ledger", "--grep", "one"],
      ["--matrix", "--update-snapshots"],
    ])
      expect(() => parseArguments(args)).toThrow();
  });

  it.each([
    "PARITY_ONLY",
    "PARITY_ACCEPT",
    "PARITY_ACCEPT_GROW",
    "E2E_ALLOW_CONCURRENT",
  ])("rejects %s before any command", (name) => {
    const run = vi.fn();
    expect(() =>
      runGroup("ledger", { cwd: fixture(), env: { [name]: "1" }, run }),
    ).toThrow(name);
    expect(run).not.toHaveBeenCalled();
  });

  it("preserves the original wrappers, config, React requirement and child failure", () => {
    const run = vi
      .fn()
      .mockReturnValueOnce({ status: 0 })
      .mockReturnValueOnce({ status: 42 });
    const cwd = fixture();
    expect(runGroup("ledger", { cwd, env: {}, run })).toBe(42);
    expect(run.mock.calls[0]!.slice(0, 2)).toEqual([
      "make",
      ["--no-print-directory", "e2e-preflight"],
    ]);
    const [, argv, options] = run.mock.calls[1]!;
    expect(argv).toEqual([
      "scripts/keep-e2e-failure-artifacts.mjs",
      "--",
      process.execPath,
      "scripts/with-loopback-no-proxy.mjs",
      "--",
      "python3",
      "../scripts/pnpm.py",
      "--dir",
      "frontend-vue",
      "exec",
      "playwright",
      "test",
      "-c",
      "playwright.parity.config.ts",
      `/${filePattern("ledger", files, join(cwd, "tests/e2e-parity"))}/`,
    ]);
    expect(options.env.PARITY_REQUIRE_REACT).toBe("1");
  });

  it("failed preflight never starts Playwright", () => {
    const run = vi.fn().mockReturnValue({ status: 17 });
    expect(runGroup("ledger", { cwd: fixture(), env: {}, run })).toBe(17);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("binds a checkout alias to the same real workspace as the pnpm runner", () => {
    const cwd = fixture();
    const alias = join(cwd, "checkout-link");
    symlinkSync(cwd, alias, "junction");
    const run = vi.fn().mockReturnValue({ status: 0 });
    expect(runGroup("ledger", { cwd: alias, env: {}, run })).toBe(0);
    for (const [, , options] of run.mock.calls) expect(options.cwd).toBe(cwd);
    expect(run.mock.calls[1]![1].at(-1)).toBe(
      `/${filePattern("ledger", files, join(cwd, "tests/e2e-parity"))}/`,
    );
  });

  it("a signalled child cannot become a passing group", () => {
    const run = vi
      .fn()
      .mockReturnValueOnce({ status: 0 })
      .mockReturnValueOnce({ status: null, signal: "SIGTERM" });
    expect(runGroup("ledger", { cwd: fixture(), env: {}, run })).toBe(1);
  });
});
