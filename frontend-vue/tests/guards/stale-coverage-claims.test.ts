/*
  【文件职责】     用当前 Makefile 与 CI 接线核对「没有门禁覆盖」的文字声明。
  【架构位置】     门禁测试
  【主要导出】     无；Vitest 用例
  【依赖关系】     Makefile、全部工作流、checkout 源码与模块根文档
  【边界与注意】   只登记能从当前接线计算真假的声明；历史引用须注明推翻它的门禁。
                   相邻 .github 不存在时不假定 CI 已接线，不把 standalone 缺席当失败。
*/

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { checkoutFiles } from "../../scripts/lib/checkout-files.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));

/** `make verify` 的先决条件列表（`verify: a b c` 那一行，允许续行）。 */
function verifyPrerequisites(makefile: string): string[] {
  const line = /^verify:([^\n]*)/m.exec(makefile.replace(/\\\r?\n/g, " "));
  const steps = (line?.[1] ?? "").trim().split(/\s+/).filter(Boolean);
  if (!steps.length) throw new Error("make verify 没有可解析的先决条件");
  return steps;
}

/** 读取全部工作流，避免新增 CI 文件落在检查范围之外。 */
function workflowSources(): string {
  const dir = join(root, "..", ".github", "workflows");
  if (!existsSync(dir)) return "";
  return readdirSync(dir)
    .filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"))
    .map((name) => readFileSync(join(dir, name), "utf8"))
    .join("\n");
}

type Coverage = { steps: string[]; workflows: string };

/** 声明为假时，同一文件必须给出可追溯的推翻标记。 */
const CLAIMS: {
  what: string;
  pattern: RegExp;
  /** 允许引用旧说法，但同一份文件里必须出现这个「被谁推翻」的标记。 */
  refuted: RegExp;
  stillTrue: (coverage: Coverage) => boolean;
  fix: string;
}[] = [
  {
    what: "tests/ 不过 typecheck",
    // 「tests/ 整棵树不在 make typecheck 的 include 里」「tests/ 不过 vue-tsc」等
    pattern:
      /`?tests\/`?\s*(整棵树)?\s*(根本)?\s*(不在|不过)[^\n。]{0,24}(typecheck|vue-tsc)/,
    refuted: /typecheck-tests/,
    stillTrue: ({ steps }) => !steps.includes("typecheck-tests"),
    fix:
      "`make typecheck-tests` 已经接进 `make verify`，这句话不再成立。" +
      "把它改成过去时并在同一份文件里点名 `typecheck-tests`（是它推翻的）；" +
      "靠它支撑的那个设计决定要么换一条理由，要么跟着改。",
  },
  {
    what: "对照套件不进 CI / 只在本机跑",
    pattern:
      /(e2e-parity|icon-parity)[^\n]{0,120}(local-only|not wired into CI|只在本机|不进 ?CI|本机门禁)|never checked by a machine that isn't this laptop/,
    refuted: /frontend-vue-parity\.yml/,
    stillTrue: ({ workflows }) => !workflows.includes("make e2e-parity"),
    fix:
      "`.github/workflows/frontend-vue-parity.yml` 已经在 CI 上跑 `icon-parity`、" +
      "`e2e-parity` 与 `e2e-parity-auth`，这句话不再成立。把它改成过去时" +
      "并在同一份文件里点名 `frontend-vue-parity.yml`（是它推翻的）。" +
      "哪天那份工作流被摘掉，这句话重新成立，这道门自己让路。",
  },
];

const SCANNED = [
  "app",
  "config",
  "packages",
  "scripts",
  "server",
  "shared",
  "tests",
];
const REQUIRED_DOCS = ["README.md", "README_zh.md", "ARCHITECTURE.md"];
const checkout = checkoutFiles(["."], { cwd: root });
const files = checkout.filter(
  (file) =>
    (SCANNED.includes(file.split("/")[0]!) &&
      /\.(vue|ts|mts|mjs|md)$/.test(file)) ||
    (!file.includes("/") && file.endsWith(".md")),
);
const makefile = readFileSync(join(root, "Makefile"), "utf8");
const coverage: Coverage = {
  steps: verifyPrerequisites(makefile),
  workflows: workflowSources(),
};

function staleClaims(source: string, current: Coverage): string[] {
  return CLAIMS.filter(
    ({ pattern, refuted, stillTrue }) =>
      !stillTrue(current) && pattern.test(source) && !refuted.test(source),
  ).map(({ what }) => what);
}

describe("散文里的「没人守」断言现在还成立", () => {
  it("verify 引用真实 target，所有源码根和模块根文档实际进入扫描", () => {
    expect(coverage.steps).toContain("test");
    for (const step of coverage.steps)
      expect(makefile, `verify 的先决条件 ${step} 没有定义`).toMatch(
        new RegExp(`^${step}:`, "m"),
      );
    expect(files.length).toBeGreaterThan(0);
    for (const dir of SCANNED)
      expect(
        files.some((file) => file.startsWith(`${dir}/`)),
        dir,
      ).toBe(true);
    expect(files).toEqual(expect.arrayContaining(REQUIRED_DOCS));
    const rootDocs = checkout.filter(
      (file) => !file.includes("/") && file.endsWith(".md"),
    );
    expect(files).toEqual(expect.arrayContaining(rootDocs));
    const sources = checkout.filter(
      (file) =>
        SCANNED.includes(file.split("/")[0]!) &&
        /\.(vue|ts|mts|mjs|md)$/.test(file),
    );
    expect(files).toEqual(expect.arrayContaining(sources));
  });

  it.each(CLAIMS)("「$what」", ({ what, fix }) => {
    const offenders = files
      .filter((file) =>
        staleClaims(readFileSync(join(root, file), "utf8"), coverage).includes(
          what,
        ),
      )
      .sort();
    expect(offenders, fix).toEqual([]);
  });
});

describe("覆盖声明负控", () => {
  it("支持 Makefile 续行，空或缺失 verify 不能成为空扫描通过", () => {
    expect(
      verifyPrerequisites(
        "verify: test \\\n typecheck-tests\ntest:\ntypecheck-tests:\n",
      ),
    ).toEqual(["test", "typecheck-tests"]);
    expect(() => verifyPrerequisites("test:\n")).toThrow("没有可解析");
    expect(() => verifyPrerequisites("verify:   \n")).toThrow("没有可解析");
  });

  it("测试类型检查接线改变会改变判断；历史引用必须指明推翻它的目标", () => {
    const statement = "tests/ 不过 typecheck";
    const enabled = { steps: ["test", "typecheck-tests"], workflows: "" };
    expect(staleClaims(statement, enabled)).toEqual(["tests/ 不过 typecheck"]);
    expect(
      staleClaims(statement + "；现在由 typecheck-tests 覆盖", enabled),
    ).toEqual([]);
    expect(staleClaims(statement, { ...enabled, steps: ["test"] })).toEqual([]);
  });

  it("相邻 CI 缺席与 CI 已接线分别判定，不能靠缺少工作流假定已验收", () => {
    const statement = "e2e-parity local-only";
    const enabled = { steps: ["test"], workflows: "run: make e2e-parity" };
    expect(staleClaims(statement, enabled)).toEqual([
      "对照套件不进 CI / 只在本机跑",
    ]);
    expect(
      staleClaims(statement + "；现见 frontend-vue-parity.yml", enabled),
    ).toEqual([]);
    expect(staleClaims(statement, { ...enabled, workflows: "" })).toEqual([]);
  });
});
