#!/usr/bin/env node
// Prove install/build/test independence in an isolated source copy.
// The active checkout and its React directory are never moved or linked.
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { CROSS_APP_BY_DESIGN, KINDS } from "./lib/cross-app-by-design.mjs";
import { createStandaloneWorkspace } from "./lib/standalone-workspace.mjs";

const source = fileURLToPath(new URL("../../", import.meta.url));
const workspace = createStandaloneWorkspace(source);
const ROOT = join(workspace.root, "frontend-vue") + sep;
const withE2e = process.argv.includes("--with-e2e");
let failureEvidence;
let commandNumber = 0;
function evidenceDirectory() {
  if (failureEvidence) return failureEvidence;
  const parent = join(source, "frontend-vue/.cache/standalone-failures");
  mkdirSync(parent, { recursive: true });
  failureEvidence = mkdtempSync(join(parent, "run-"));
  console.error(`Standalone failure evidence: ${failureEvidence}`);
  return failureEvidence;
}

function preserveFailure(name, contents) {
  writeFileSync(join(evidenceDirectory(), name), contents, "utf8");
}

process.on("exit", () => workspace.dispose());
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => process.exit(130));
}

function run(command, args, options = {}) {
  const number = ++commandNumber;
  try {
    const stdout = execFileSync(command, args, {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
      ...options,
    });
    return { code: 0, stdout };
  } catch (error) {
    const stdout = `${error.stdout ?? ""}${error.stderr ?? ""}`;
    preserveFailure(`command-${number}.log`, stdout);
    return {
      code: error.status ?? 1,
      stdout,
    };
  }
}

const entries = Object.entries(CROSS_APP_BY_DESIGN);
const unknown = entries.filter(([, value]) => !KINDS.includes(value.kind));
if (unknown.length > 0) {
  console.error(
    `表里有没分类的条目：${unknown.map(([file]) => file).join(", ")}`,
  );
  process.exit(1);
}

const scripts = entries.filter(([, v]) => v.kind === "script").map(([f]) => f);
const tests = entries.filter(([, v]) => v.kind === "test").map(([f]) => f);
const data = entries.filter(([, v]) => v.kind === "data").map(([f]) => f);
const e2e = entries.filter(([, v]) => v.kind === "e2e").map(([f]) => f);

const results = [];

const missing = entries
  .map(([file]) => file)
  .filter((file) => !existsSync(join(ROOT, file)));
if (missing.length > 0) {
  console.error(
    `表里点名的文件不存在（改名了还是删了？）：\n  ${missing.join("\n  ")}`,
  );
  process.exit(1);
}

console.log(`Isolated standalone workspace: ${workspace.root}`);
console.log("React is absent from the copy; the active checkout is untouched.");

try {
  const prerequisites = [
    ["git", ["init", "--quiet"], { cwd: workspace.root }],
    ["git", ["add", "-A"], { cwd: workspace.root }],
    [
      process.env.PYTHON ?? "python3",
      [
        "../scripts/pnpm.py",
        "--dir",
        "frontend-vue",
        "install",
        "--frozen-lockfile",
        "--offline",
      ],
      {},
    ],
    ["make", ["build"], {}],
  ];
  if (withE2e)
    prerequisites.push([
      "uv",
      ["sync", "--frozen", "--offline", "--group", "dev", "--extra", "browser"],
      { cwd: join(workspace.root, "backend") },
    ]);
  for (const [command, args, options] of prerequisites) {
    console.log(`Standalone prerequisite: ${command} ${args.join(" ")}`);
    const result = run(command, args, options);
    if (result.code !== 0)
      throw new Error(`${command} exited ${result.code}\n${result.stdout}`);
  }
  // ── script：缺席时必须 exit 0 ──────────────────────────────────────────
  for (const file of scripts) {
    const { code, stdout } = run("node", [file]);
    results.push({
      file,
      kind: "script",
      ok: code === 0,
      detail: code === 0 ? stdout.trim().split("\n")[0] : `exit ${code}`,
    });
  }

  const outDir = mkdtempSync(join(tmpdir(), "standalone-sim-"));
  const outFile = join(outDir, "vitest.json");
  const vitest = run(process.env.PYTHON ?? "python3", [
    "../scripts/pnpm.py",
    "--dir",
    "frontend-vue",
    "exec",
    "vitest",
    "run",
    "--reporter=default",
    "--reporter=json",
    `--outputFile=${outFile}`,
  ]);

  let report = null;
  try {
    report = JSON.parse(readFileSync(outFile, "utf8"));
  } catch {
    report = null;
  }
  if (report !== null && vitest.code !== 0) {
    console.error(vitest.stdout);
    preserveFailure("vitest.json", JSON.stringify(report, null, 2));
    for (const suite of report.testResults ?? []) {
      const messages = (suite.assertionResults ?? []).flatMap(
        (assertion) => assertion.failureMessages ?? [],
      );
      if (suite.message) messages.unshift(suite.message);
      if (messages.length > 0)
        console.error(`${suite.name}\n${messages.join("\n")}`);
    }
  }
  rmSync(outDir, { recursive: true, force: true });

  if (report === null) {
    results.push({
      file: "（整套 vitest）",
      kind: "test",
      ok: false,
      detail: `整套没跑起来：exit ${vitest.code}，vitest 没产出报告——看上面的输出`,
    });
    for (const file of tests) {
      results.push({
        file,
        kind: "test",
        ok: false,
        detail: "整套没跑起来，这一条没被执行（不是它自己红）",
      });
    }
    if (vitest.code !== 0) console.log(vitest.stdout);
  } else {
    const totals = report.testResults ?? [];
    const failedSuites = totals
      .filter((suite) =>
        (suite.assertionResults ?? []).some((c) => c.status === "failed"),
      )
      .map((suite) =>
        suite.name.startsWith(ROOT)
          ? suite.name.slice(ROOT.length)
          : suite.name,
      );
    results.push({
      file: "（整套 vitest）",
      kind: "test",
      ok: vitest.code === 0 && failedSuites.length === 0,
      detail:
        vitest.code === 0 && failedSuites.length === 0
          ? `兄弟应用不在时整套仍全绿（${totals.length} 个文件）`
          : `整套红了：exit ${vitest.code}${failedSuites.length ? `，红的文件 ${failedSuites.slice(0, 5).join("、")}` : ""}`,
    });
    // 【坑】只看 vitest 的退出码不够：一个文件**根本没被收集**时退出码可以是 0。
    // 所以逐个文件在报告里找它，找不到就算红。
    const byFile = new Map();
    for (const suite of report.testResults ?? []) {
      const relative = suite.name.startsWith(ROOT)
        ? suite.name.slice(ROOT.length)
        : suite.name;
      byFile.set(relative, suite);
    }
    for (const file of tests) {
      const suite = byFile.get(file);
      if (suite === undefined) {
        results.push({
          file,
          kind: "test",
          ok: false,
          detail: "vitest 报告里没有这个文件——它没被收集",
        });
        continue;
      }
      const cases = suite.assertionResults ?? [];
      const failed = cases.filter((c) => c.status === "failed").length;
      const skipped = cases.filter(
        (c) =>
          c.status === "pending" ||
          c.status === "skipped" ||
          c.status === "todo",
      ).length;
      const passed = cases.length - failed - skipped;
      const ok = suite.status !== "failed" && failed === 0;
      results.push({
        file,
        kind: "test",
        ok,
        detail:
          !ok && cases.length === 0
            ? "整个文件没跑起来——收集阶段就炸了（一条用例都没注册）"
            : `${passed} 过 / ${skipped} 跳过 / ${failed} 红`,
      });
    }
  }

  // ── Cross-app collection only; never count missing React as parity PASS. ──
  const parityConfigs = readdirSync(ROOT)
    .filter((name) => /^playwright\.parity(?:-[\w-]+)?\.config\.ts$/.test(name))
    .sort();
  const parityCollection = withE2e
    ? parityConfigs.map((config) => ({
        config,
        result: run(
          process.env.PYTHON ?? "python3",
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
          ],
          { env: { ...process.env, PARITY_REQUIRE_REACT: "0" } },
        ),
      }))
    : [];
  for (const file of e2e) {
    if (!withE2e) {
      results.push({
        file,
        kind: "e2e",
        ok: true,
        skipped: true,
        detail:
          "要跑加 --with-e2e（连 e2e-mock / e2e-backend 一起，十分钟量级）",
      });
      continue;
    }
    const failures = parityCollection.filter(({ result }) => result.code !== 0);
    results.push({
      file,
      kind: "e2e",
      ok: parityConfigs.length > 0 && failures.length === 0,
      detail:
        parityConfigs.length > 0 && failures.length === 0
          ? `${parityConfigs.length} 个跨应用套件在 React 缺席时可收集；双端执行 UNRUN（不计为 parity PASS）`
          : `parity collection failed: ${failures.map(({ config, result }) => `${config} exit ${result.code}`).join(", ") || "no configs found"}`,
    });
  }

  if (withE2e) {
    for (const target of ["e2e-mock", "e2e-backend"]) {
      const suite = run("make", [target]);
      results.push({
        file: `（make ${target}）`,
        kind: "e2e",
        ok: suite.code === 0,
        detail:
          suite.code === 0
            ? `兄弟应用不在时 ${target} 仍全绿`
            : `${target} exit ${suite.code}——看上面的输出`,
      });
      if (suite.code !== 0) console.log(suite.stdout);
    }
  }
} finally {
  const testResults = join(ROOT, "test-results");
  if (results.some((row) => !row.ok) && existsSync(testResults))
    cpSync(testResults, join(evidenceDirectory(), "test-results"), {
      recursive: true,
    });
  workspace.dispose();
}

const EXECUTABLE_EXTENSIONS = new Set([
  ".ts",
  ".mts",
  ".cts",
  ".js",
  ".mjs",
  ".cjs",
  ".tsx",
  ".jsx",
  ".vue",
  ".py",
  ".sh",
]);
for (const file of data) {
  const extension = file.slice(file.lastIndexOf("."));
  const executable = EXECUTABLE_EXTENSIONS.has(extension);
  results.push({
    file,
    kind: "data",
    ok: !executable,
    skipped: !executable,
    detail: executable
      ? `标成了 data，但 ${extension} 是可执行源码——它会被整个实验跳过。改成 test/script，或者说明它为什么不会被执行`
      : "纯数据，没有可执行行为",
  });
}

const order = { script: 0, test: 1, e2e: 2, data: 3 };
results.sort(
  (a, b) => order[a.kind] - order[b.kind] || a.file.localeCompare(b.file),
);

console.log("兄弟应用缺席时，表里每一条的实际表现：\n");
for (const row of results) {
  const mark = row.skipped ? "–" : row.ok ? "✓" : "✗";
  console.log(
    `  ${mark} [${row.kind.padEnd(6)}] ${row.file}\n        ${row.detail}`,
  );
}

const failures = results.filter((row) => !row.ok);
console.log("");
console.log(
  `  跑过 ${results.filter((r) => !r.skipped).length} 条，` +
    `未跑 ${results.filter((r) => r.skipped).length} 条，` +
    `红 ${failures.length} 条。`,
);
console.log("Isolated copy removed; the active checkout was never moved.");
process.exitCode = failures.length > 0 ? 1 : 0;
