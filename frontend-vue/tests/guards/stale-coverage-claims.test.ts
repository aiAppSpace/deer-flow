/*
  【文件职责】     钉住「散文里那句『X 没有任何机器在看』现在还成立吗」。
  【架构位置】     门禁测试
  【主要导出】     无；Vitest 用例
  【依赖关系】     Makefile（verify 的先决条件）· tsconfig.tests.json · app/** tests/** scripts/** packages/**
  【边界与注意】   **一句「这件事没人守」会随着有人给它加了门禁而变假，
                   而没有任何机器在看这件事。** 2026-09-12 第十六轮实测到两处：

                   ① 「`tests/` 整棵树不在 `make typecheck` 里」——这句话被
                      **五个地方**当现在时事实用来支撑设计决定
                      （`message.contract.ts` 为什么住在 `app/`、
                      `parity-ledger-fields` / `ledger.ts` 为什么不写类型断言、
                      `message-content-contract` 为什么把护栏挪走、
                      `scenarios.ts` 那处「没有任何机器说过话」）。
                      **2026-09-11 起它是假的**：`make typecheck-tests`
                      （`vue-tsc -p tsconfig.tests.json`）已经接进 `make verify`。
                      当轮实测：在 `tests/` 里塞一个 `const x: number = "s"`
                      当场报 TS2322。
                   ② `scripts/icon-parity.mjs` 的文件头**专门**标注过
                      「『这是顾问工具，不进任何门禁』那句话从 wave 111 起就是假的，
                      留着的后果是读到它的人会以为这份输出可以忽略」——
                      而 `scripts/lib/cross-app-by-design.mjs` 的登记里原样留着同一句。
                      **改在了发现它的地方，没改到另一处**（第十二、十三轮同一形状）。

                   **判据不是「不许写这句话」，而是「写了就得现在还成立」**：
                   这句话在 2026-09-11 之前是对的，而且是**有用**的——它解释了
                   一个真实的坑。所以这道门把「它还成不成立」**算出来**：
                   `typecheck-tests` 在不在 `verify` 的先决条件里。
                   哪天有人把它从 `verify` 摘掉，这句话重新成立，这道门自己让路。

                   **加一条之前先想清楚「怎么算出它还成不成立」**——
                   算不出来的就不要进这张表，否则它自己就变成下一句没人守的散文。
*/

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../..", import.meta.url));

/** `make verify` 的先决条件列表（`verify: a b c` 那一行，允许续行）。 */
function verifyPrerequisites(): string[] {
  const makefile = readFileSync(join(root, "Makefile"), "utf8");
  const line = /^verify:([^\n]*(?:\\\n[^\n]*)*)/m.exec(makefile);
  return (line?.[1] ?? "").replaceAll("\\\n", " ").trim().split(/\s+/);
}

/**
 * `.github/workflows/` 里所有工作流拼起来的源文本；`.github` 不在时是空串。
 *
 * **拼起来而不是点名一份**：同一个坑第三十七轮踩过——
 * `tooling-contracts.test.ts` 那条只读 `frontend-vue-verify.yml`，
 * 于是新加的 `frontend-vue-parity.yml` 天生在判据之外。
 */
function workflowSources(): string {
  const dir = join(root, "..", ".github", "workflows");
  if (!existsSync(dir)) return "";
  return readdirSync(dir)
    .filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"))
    .map((name) => readFileSync(join(dir, name), "utf8"))
    .join("\n");
}

/**
 * 散文断言 → 它**现在**还成不成立。
 *
 * `pattern` 命中即认为有人写下了这句断言；`stillTrue()` 为假时报错。
 */
const CLAIMS: {
  what: string;
  pattern: RegExp;
  /** 允许引用旧说法，但同一份文件里必须出现这个「被谁推翻」的标记。 */
  refuted: RegExp;
  stillTrue: () => boolean;
  fix: string;
}[] = [
  {
    what: "tests/ 不过 typecheck",
    // 「tests/ 整棵树不在 make typecheck 的 include 里」「tests/ 不过 vue-tsc」等
    pattern:
      /`?tests\/`?\s*(整棵树)?\s*(根本)?\s*(不在|不过)[^\n。]{0,24}(typecheck|vue-tsc)/,
    /*
      **引用旧说法是允许的**——这个仓库就是靠「原文写的是 X，而 X 从某天起是假的」
      记住坑的。所以判据不是「不许出现这句话」，而是**「出现了就得在同一份文件里
      写明它被谁推翻」**：这里要求它点名 `typecheck-tests`。
      第一版没有这一半，于是把五处**刚刚改好的**文件全报成了违规。
    */
    refuted: /typecheck-tests/,
    stillTrue: () => !verifyPrerequisites().includes("typecheck-tests"),
    fix:
      "`make typecheck-tests` 已经接进 `make verify`，这句话不再成立。" +
      "把它改成过去时并在同一份文件里点名 `typecheck-tests`（是它推翻的）；" +
      "靠它支撑的那个设计决定要么换一条理由，要么跟着改。",
  },
  {
    what: "对照套件不进 CI / 只在本机跑",
    /*
      README 原话是「a cost decision that has never actually been made ——
      local-only by default, not by design, which means **the ledger that this
      whole effort is measured by is never checked by a machine that isn't this
      laptop**」，`icon-parity` 那一段是「not wired into CI: no existing workflow
      installs both apps' node_modules」。**这两句支撑的是同一个结论**，
      而结论从 2026-09-17 起是假的。

      判据不是「不许提」——这个仓库靠「原文写的是 X，而 X 从某天起是假的」
      记住坑。所以同一份文件里点名那份工作流就放行。
    */
    pattern:
      /(e2e-parity|icon-parity)[^\n]{0,120}(local-only|not wired into CI|只在本机|不进 ?CI|本机门禁)|never checked by a machine that isn't this laptop/,
    refuted: /frontend-vue-parity\.yml/,
    stillTrue: () => !workflowSources().includes("make e2e-parity"),
    fix:
      "`.github/workflows/frontend-vue-parity.yml` 已经在 CI 上跑 `icon-parity`、" +
      "`e2e-parity` 与 `e2e-parity-auth`，这句话不再成立。把它改成过去时" +
      "并在同一份文件里点名 `frontend-vue-parity.yml`（是它推翻的）。" +
      "哪天那份工作流被摘掉，这句话重新成立，这道门自己让路。",
  },
];

const SCANNED = ["app", "tests", "scripts", "packages"];
/*
  模块根的三份文档**也要扫**：第三十七轮那句「台账从没被本机以外的机器量过」
  就写在 `README.md` 里，而 `SCANNED` 只有四个子目录——
  这道门当时够不着最该管的那一处。
*/
const SCANNED_FILES = ["README.md", "README_zh.md", "ARCHITECTURE.md"];
const SKIPPED = new Set(["node_modules", ".nuxt", ".output", "dist"]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIPPED.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(vue|ts|mjs|md)$/.test(full)) out.push(full);
  }
  return out;
}

const files = [
  ...SCANNED.flatMap((dir) => walk(join(root, dir))),
  ...SCANNED_FILES.map((name) => join(root, name)).filter((f) => existsSync(f)),
];

describe("散文里的「没人守」断言现在还成立", () => {
  /* 形状断言：Makefile 解析坏了会让下面那条静默全绿（坑 176/195）。 */
  it("verify 的先决条件解析出来了", () => {
    const steps = verifyPrerequisites();
    expect(steps.length).toBeGreaterThan(5);
    expect(steps).toContain("test");
    expect(files.length).toBeGreaterThan(300);
    // 根文档要真的收进来了，否则新加的那条判据在一个够不着 README 的集合上恒绿。
    expect(
      files.filter((f) => SCANNED_FILES.includes(relative(root, f))),
    ).toHaveLength(SCANNED_FILES.length);
  });

  it.each(CLAIMS)("「$what」", ({ pattern, refuted, stillTrue, fix }) => {
    if (stillTrue()) return; // 还成立，随便写
    const offenders = files
      .filter((file) => {
        const source = readFileSync(file, "utf8");
        return pattern.test(source) && !refuted.test(source);
      })
      .map((file) => relative(root, file))
      .sort();
    expect(offenders, fix).toEqual([]);
  });
});
