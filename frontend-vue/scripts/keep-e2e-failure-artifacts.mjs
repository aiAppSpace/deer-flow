/*
  【文件职责】     跑一条 e2e 命令；它失败时把失败现场从 `test-results/` 里另存一份。
  【架构位置】     构建脚本（不进产物）
  【主要导出】     collectFailureArtifactDirs · archiveFailureArtifacts
  【依赖关系】     只用 node 内置模块
  【边界与注意】   **Playwright 每次运行都会先清空 `outputDir`。** wave 197 实测：
                   往 `test-results/e2e/` 放一个 marker 文件，跑任意一条用例之后
                   它就没了。而偶发红之后最自然的动作恰恰是**重跑一次看看**——
                   于是 trace / video / 截图在有人看它之前就被自己删掉了。
                   本轮就这么丢过一份：`thread-history` 那次红的 trace，
                   在我为了确认「是不是回归」而重跑两次之后消失。

                   wave 195 修的是「trace 从来没被录过」（`retries: 0` 配
                   `trace: "on-first-retry"`）。**这一条是它的下一段**：录下来了，
                   但活不过下一次运行。两条合起来才谈得上「偶发红可查」。

                   **为什么不按套件名归档**：套件名要从 Makefile 传进来，就多一处
                   会漂的对应关系。这里改成扫「哪些用例目录里有失败产物」，
                   什么套件、什么 config 都不用知道，也就没有漂移面。

                   **只在命令失败时归档**：绿的运行里 `test-results/` 是空的
                   （`preserveOutput` 默认只留失败用例的产物），扫也扫不到东西。
*/

import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TEST_RESULTS = join(ROOT, "test-results");
const ARCHIVE_ROOT = join(TEST_RESULTS, "failures");

/** 归档保留多少次运行。老的整批删掉——留着的意义是「最近查过的那几次」。 */
export const ARCHIVE_KEEP_RUNS = 20;

/**
 * Playwright 只给失败用例留产物，所以「用例目录还在」就是「这条用例失败过」。
 *
 * **`since` 不是防御性的**：`test-results/` 下同时躺着**别的套件**上一次红留下的
 * 目录（它们要等那个套件自己再跑一次才会被清掉）。不按时间筛的话，
 * 「失败现场已另存」这句话就把上一次、上上次的东西也算进来了——工具自己说了假话。
 */
export function collectFailureArtifactDirs(
  since = 0,
  testResultsDir = TEST_RESULTS,
  {
    readDir = readdirSync,
    modifiedAt = (path) => statSync(path).mtimeMs,
    exists = existsSync,
  } = {},
) {
  if (!exists(testResultsDir)) return [];
  const found = [];
  for (const suite of readDir(testResultsDir, { withFileTypes: true })) {
    if (!suite.isDirectory() || suite.name === "failures") continue;
    const suiteDir = join(testResultsDir, suite.name);
    for (const testCase of readDir(suiteDir, { withFileTypes: true })) {
      if (!testCase.isDirectory()) continue;
      const path = join(suiteDir, testCase.name);
      if (modifiedAt(path) < since) continue;
      found.push({ suite: suite.name, testCase: testCase.name });
    }
  }
  return found;
}

/** 归档目录名。用 UTC 是为了排序即时间序，本机时区变了也不会乱。 */
export function archiveStampFrom(date) {
  return date.toISOString().replace(/[:.]/g, "-");
}

export function archiveFailureArtifacts(since = 0, now = new Date()) {
  const dirs = collectFailureArtifactDirs(since);
  if (dirs.length === 0) return null;
  const destination = join(ARCHIVE_ROOT, archiveStampFrom(now));
  for (const { suite, testCase } of dirs) {
    const target = join(destination, suite);
    mkdirSync(target, { recursive: true });
    renameSync(join(TEST_RESULTS, suite, testCase), join(target, testCase));
  }
  pruneArchives();
  return destination;
}

function pruneArchives() {
  if (!existsSync(ARCHIVE_ROOT)) return;
  const runs = readdirSync(ARCHIVE_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  for (const stale of runs.slice(
    0,
    Math.max(0, runs.length - ARCHIVE_KEEP_RUNS),
  )) {
    rmSync(join(ARCHIVE_ROOT, stale), { recursive: true, force: true });
  }
}

function run() {
  const separator = process.argv.indexOf("--");
  const command = separator >= 0 ? process.argv[separator + 1] : undefined;
  const args = separator >= 0 ? process.argv.slice(separator + 2) : [];
  if (!command) {
    console.error(
      "Usage: node scripts/keep-e2e-failure-artifacts.mjs -- <command> [...args]",
    );
    process.exitCode = 2;
    return;
  }
  // 开跑前记一刻：只有这之后写出来的用例目录才算「这一次的失败现场」。
  const startedAt = Date.now();
  const child = spawn(command, args, { stdio: "inherit" });
  const forwardSignal = (signal) => {
    if (!child.killed) child.kill(signal);
  };
  process.once("SIGINT", forwardSignal);
  process.once("SIGTERM", forwardSignal);
  process.once("SIGHUP", forwardSignal);
  child.once("error", (error) => {
    console.error(error);
    process.exitCode = 1;
  });
  child.once("exit", (code) => {
    process.exitCode = code ?? 1;
    if (code === 0) return;
    const archived = archiveFailureArtifacts(startedAt);
    if (archived) {
      console.error(
        `\n失败现场已另存：${archived}\n（下一次运行会清空 test-results/，不另存就没了。）`,
      );
    }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  run();
}
