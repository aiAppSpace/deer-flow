/*
  【文件职责】     跑一条 e2e 命令；它失败时把失败现场从 `test-results/` 里另存一份。
                   同时**独占**：同一个仓下不许有第二轮 e2e 同时在跑。
  【架构位置】     构建脚本（不进产物）
  【主要导出】     collectFailureArtifactDirs · collectSuiteReportFiles ·
                   archiveFailureArtifacts · acquireRunLock
  【依赖关系】     只用 node 内置模块
  【边界与注意】   **为什么要独占**：wave 202 实测，两轮 `make e2e-parity` 撞在一起会
                   **互相拆台**，而且两个方向都走这个文件里的代码——
                   ① 后开的那轮启动时 Playwright 清空 `test-results/<套件>/`，
                      先开的那轮正在录的 trace 当场 ENOENT；
                   ② 先结束的那轮 `archiveFailureArtifacts` 用 `renameSync`
                      把失败目录**搬走**，后开的那轮 artifacts 被抽走，同样 ENOENT。
                   两种都表现为 `ENOENT` + 180s 超时，长得像回归；共用 Gateway 的套件
                   还会互相污染种子数据（那一轮 topology 的种子会话被播种了两遍，
                   4 条断言收到 8 条）。**判断它们不是回归花了两轮、25 分钟。**
                   所以这里 fail fast，不排队等——静默等 14 分钟比报错更糟。

                   **Playwright 每次运行都会先清空 `outputDir`。** wave 197 实测：
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
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TEST_RESULTS = join(ROOT, "test-results");
const ARCHIVE_ROOT = join(TEST_RESULTS, "failures");

/**
 * 独占锁的位置。放在 `test-results/` **根上**而不是某个套件目录里：
 * `outputDir` 是 `test-results/<套件>`（见 tests/support/playwright-factory.ts），
 * Playwright 只清它自己那一层，所以这个文件活得过任何一轮运行。
 */
export const RUN_LOCK_PATH = join(TEST_RESULTS, ".e2e-run.lock");

/** 归档保留多少次运行。老的整批删掉——留着的意义是「最近查过的那几次」。 */
export const ARCHIVE_KEEP_RUNS = 20;

/**
 * Playwright 只给失败用例留产物，所以「用例目录还在」就是「这条用例失败过」。
 *
 * **`since` 不是防御性的**：`test-results/` 下同时躺着**别的套件**上一次红留下的
 * 目录（它们要等那个套件自己再跑一次才会被清掉）。不按时间筛的话，
 * 「失败现场已另存」这句话就把上一次、上上次的东西也算进来了——工具自己说了假话。
 */
/**
 * @param {number} [since]
 * @param {string} [testResultsDir]
 * @param {{
 *   readDir?: (path: string, options?: unknown) => { name: string; isDirectory(): boolean }[],
 *   modifiedAt?: (path: string) => number,
 *   exists?: (path: string) => boolean,
 * }} [io] 注入点要的是这三个小函数，不是 node fs 的完整签名。
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

/**
 * 套件目录**根上**那些文件——用例产物之外，套件自己写出来的报告。
 *
 * 对照套件的 `diff.spec.ts` 把这一次实测的台账写在
 * `test-results/e2e-parity/report.json`，而它既不在任何用例目录里、
 * 又活不过下一次运行（Playwright 开跑先清 `outputDir`）。
 * 实测丢过一份：为了对比"修完之后还剩哪些差异"，隔了一轮再回头找，已经没了。
 *
 * 与用例目录不同，这些**复制**而不是搬走：套件文档里写着它在那个路径上，
 * 搬走会让同一次会话里后面的步骤扑空。反正下一次运行会清掉。
 */
/**
 * @param {number} [since]
 * @param {string} [testResultsDir]
 * @param {{
 *   readDir?: (path: string, options?: unknown) => { name: string; isDirectory(): boolean }[],
 *   modifiedAt?: (path: string) => number,
 *   exists?: (path: string) => boolean,
 * }} [io]
 */
export function collectSuiteReportFiles(
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
    for (const entry of readDir(suiteDir, { withFileTypes: true })) {
      if (entry.isDirectory()) continue;
      const path = join(suiteDir, entry.name);
      if (modifiedAt(path) < since) continue;
      found.push({ suite: suite.name, file: entry.name });
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
  for (const { suite, file } of collectSuiteReportFiles(since)) {
    const target = join(destination, suite);
    mkdirSync(target, { recursive: true });
    copyFileSync(join(TEST_RESULTS, suite, file), join(target, file));
  }
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

/**
 * 进程还在不在。`EPERM` 算「在」——那是**别的用户**的进程，不是没了；
 * 当成陈旧锁抢过去，就等于允许并发。
 *
 * @param {number} pid
 * @param {(target: number) => void} [kill] 注入点只要「问一下这个 pid 在不在」，
 *   不是 `process.kill` 的全套重载——契约写清楚，调用方才好给桩。
 */
export function processIsAlive(
  pid,
  kill = (target) => process.kill(target, 0),
) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    kill(pid);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

/**
 * 抢独占锁。
 *
 * 用 `wx` 写文件：**创建即互斥**是文件系统给的原子性，不用自己发明协议。
 * 撞上已有锁时才去读它——读到的进程没了（崩溃 / 被 kill -9 留下的陈旧锁）就接管，
 * **只重试一次**：第二次还撞上，说明真有人在同一刻抢到了。
 *
 * 返回 `{ acquired, holder, release }`。`release` 只在**文件里还是自己的 pid** 时才删，
 * 免得删掉接管者的锁。
 */
/**
 * @param {string} [lockPath]
 * @param {{
 *   pid?: number,
 *   command?: string,
 *   startedAt?: string,
 *   ensureDir?: (path: string) => void,
 *   writeExclusive?: (path: string, body: string) => void,
 *   readLock?: (path: string) => string,
 *   removeLock?: (path: string) => void,
 *   isAlive?: (pid: number) => boolean,
 * }} [io]
 * @returns {{ acquired: boolean, holder: { pid?: number, command?: string, startedAt?: string } | null, release?: () => void }}
 */
export function acquireRunLock(
  lockPath = RUN_LOCK_PATH,
  {
    pid = process.pid,
    command = "",
    startedAt = new Date().toISOString(),
    ensureDir = (path) => mkdirSync(path, { recursive: true }),
    writeExclusive = (path, body) => writeFileSync(path, body, { flag: "wx" }),
    readLock = (path) => readFileSync(path, "utf8"),
    removeLock = (path) => rmSync(path, { force: true }),
    isAlive = processIsAlive,
  } = {},
) {
  const mine = { pid, command, startedAt };
  const body = `${JSON.stringify(mine, null, 2)}\n`;

  const readHolder = () => {
    try {
      const parsed = JSON.parse(readLock(lockPath));
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      // 读不出来 / 不是 JSON：半截写坏的锁，没有持有者可言。
      return null;
    }
  };

  const release = () => {
    if (readHolder()?.pid !== pid) return;
    removeLock(lockPath);
  };

  const claim = () => {
    try {
      writeExclusive(lockPath, body);
      return true;
    } catch (error) {
      if (error?.code === "EEXIST") return false;
      throw error;
    }
  };

  ensureDir(dirname(lockPath));
  if (claim()) return { acquired: true, holder: mine, release };

  const holder = readHolder();
  if (holder && isAlive(holder.pid)) return { acquired: false, holder };

  removeLock(lockPath);
  if (claim()) return { acquired: true, holder: mine, release };
  return { acquired: false, holder: readHolder() };
}

/** 撞锁时打给人看的话。要能直接回答「谁占着、从什么时候、我该干嘛」。 */
export function describeLockHolder(holder) {
  const pid = holder?.pid ?? "?";
  const since = holder?.startedAt ?? "?";
  const command = holder?.command ? `\n  跑的是 ${holder.command}` : "";
  return `  持有者 PID ${pid}，从 ${since} 开始${command}`;
}

const CONCURRENCY_HELP = `并发跑会互相拆台，两个方向都实测过：
  · 后开的那轮启动时清空 test-results/<套件>/，先开的那轮 trace 当场 ENOENT；
  · 先结束的那轮把失败目录搬进 failures/，后开的那轮 artifacts 被抽走。
两种都是 ENOENT + 180s 超时，长得像回归；共用 Gateway 的套件还会互相污染种子数据。

等它跑完再来；那个进程其实已经没了的话，删掉锁文件即可。
真要并发：E2E_ALLOW_CONCURRENT=1 make <target>`;

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

  const exclusive = process.env.E2E_ALLOW_CONCURRENT !== "1";
  const lock = exclusive
    ? acquireRunLock(RUN_LOCK_PATH, {
        command: [command, ...args].join(" "),
      })
    : null;
  if (lock && !lock.acquired) {
    console.error(
      `\n另一轮 e2e 正在跑，这一轮不启动。\n\n${describeLockHolder(
        lock.holder,
      )}\n\n${CONCURRENCY_HELP}\n`,
    );
    process.exitCode = 2;
    return;
  }
  // 兜底：异常退出路径也要放锁，否则下一轮会被一把陈旧锁挡住——
  // `processIsAlive` 能救回来，但那要等到有人真撞上才生效。
  if (lock) process.once("exit", lock.release);

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
    lock?.release();
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
