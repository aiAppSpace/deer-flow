/*
  【文件职责】     钉住「失败现场归档」的两条判据：**只收这一次的**、**目录形状不变**。
  【架构位置】     单元测试
  【依赖关系】     scripts/keep-e2e-failure-artifacts.mjs
  【边界与注意】   这里不测「跑命令」那一层（那是 spawn），只测**挑哪些目录**——
                   因为出错的方式恰恰在这里：不按时间筛，就会把别的套件上一次红
                   留下的目录也算成「这一次的失败现场」，工具自己说了假话。
*/

import { describe, expect, it } from "vitest";

import {
  archiveStampFrom,
  collectFailureArtifactDirs,
  collectSuiteReportFiles,
} from "../../../scripts/keep-e2e-failure-artifacts.mjs";

type Entry = { name: string; isDirectory: () => boolean };

function dirent(name: string, isDirectory = true): Entry {
  return { name, isDirectory: () => isDirectory };
}

/** 一份假的 test-results/：套件目录 → 用例目录，外加每个用例目录的 mtime。 */
function fakeTree(
  layout: Record<string, Record<string, number>>,
  root = "/results",
) {
  const readDir = (path: string) => {
    if (path === root) return Object.keys(layout).map((name) => dirent(name));
    const suite = path.slice(root.length + 1);
    return Object.keys(layout[suite] ?? {}).map((name) => dirent(name));
  };
  const modifiedAt = (path: string) => {
    const [suite, testCase] = path.slice(root.length + 1).split("/");
    return layout[suite!]?.[testCase!] ?? 0;
  };
  return { readDir, modifiedAt, exists: () => true };
}

describe("失败现场归档：挑哪些目录", () => {
  it("只收这一次运行之后写出来的", () => {
    const tree = fakeTree({
      e2e: { "case-now": 2_000 },
      "e2e-protocol": { "case-from-last-time": 500 },
    });
    expect(
      collectFailureArtifactDirs(1_000, "/results", tree),
      "上一次红留下的目录不该算进这一次",
    ).toEqual([{ suite: "e2e", testCase: "case-now" }]);
  });

  it("since 为 0 时收全部——这是「归档我手上这些」的用法", () => {
    const tree = fakeTree({
      e2e: { a: 10 },
      "e2e-infra": { b: 20 },
    });
    expect(collectFailureArtifactDirs(0, "/results", tree)).toEqual([
      { suite: "e2e", testCase: "a" },
      { suite: "e2e-infra", testCase: "b" },
    ]);
  });

  it("不把归档目录自己再归档一次", () => {
    const tree = fakeTree({
      failures: { "2026-01-01T00-00-00-000Z": 9_999 },
      e2e: { a: 9_999 },
    });
    expect(collectFailureArtifactDirs(0, "/results", tree)).toEqual([
      { suite: "e2e", testCase: "a" },
    ]);
  });

  it("套件目录下的文件不当成用例目录", () => {
    const root = "/results";
    const readDir = (path: string) =>
      path === root
        ? [dirent("e2e")]
        : [dirent(".last-run.json", false), dirent("case", true)];
    expect(
      collectFailureArtifactDirs(0, root, {
        readDir,
        modifiedAt: () => 1,
        exists: () => true,
      }),
    ).toEqual([{ suite: "e2e", testCase: "case" }]);
  });
});

describe("失败现场归档：目录名", () => {
  it("用 UTC 且不含冒号——排序即时间序，且在所有文件系统上都是合法名字", () => {
    const stamp = archiveStampFrom(new Date("2026-09-09T06:52:20.272Z"));
    expect(stamp).toBe("2026-09-09T06-52-20-272Z");
    expect(stamp).not.toContain(":");
  });

  it("时间序 == 字典序", () => {
    const earlier = archiveStampFrom(new Date("2026-09-09T06:52:20.272Z"));
    const later = archiveStampFrom(new Date("2026-09-09T07:00:00.000Z"));
    expect([later, earlier].sort()).toEqual([earlier, later]);
  });
});

/*
  套件根上的报告文件也要留住：`tests/e2e-parity/diff.spec.ts` 把这一次实测的台账
  写在套件 outputDir 的根上，它不在任何用例目录里，而 Playwright 下一次开跑先清
  `outputDir`。
  实测丢过一份——隔一轮回头想对比"修完还剩哪些差异"，已经没了。
*/
describe("失败现场归档：套件自己写的报告", () => {
  /** 同一棵假树，但这一层看的是**文件**不是目录。 */
  function fakeTreeWithFiles(
    layout: Record<string, Record<string, { mtime: number; dir: boolean }>>,
    root = "/results",
  ) {
    const readDir = (path: string) => {
      if (path === root)
        return Object.keys(layout).map((name) => dirent(name, true));
      const suite = path.slice(root.length + 1);
      return Object.entries(layout[suite] ?? {}).map(([name, meta]) =>
        dirent(name, meta.dir),
      );
    };
    const modifiedAt = (path: string) => {
      const [suite, entry] = path.slice(root.length + 1).split("/");
      return layout[suite!]?.[entry!]?.mtime ?? 0;
    };
    return { readDir, modifiedAt, exists: () => true };
  }

  it("收这一次写出来的报告，不收用例目录", () => {
    const tree = fakeTreeWithFiles({
      "e2e-parity": {
        "report.json": { mtime: 2_000, dir: false },
        "diff-chromium": { mtime: 2_000, dir: true },
      },
    });
    expect(collectSuiteReportFiles(1_000, "/results", tree)).toEqual([
      { suite: "e2e-parity", file: "report.json" },
    ]);
  });

  it("上一次运行留下的报告不算这一次的", () => {
    const tree = fakeTreeWithFiles({
      "e2e-parity": { "report.json": { mtime: 500, dir: false } },
    });
    expect(collectSuiteReportFiles(1_000, "/results", tree)).toEqual([]);
  });

  it("failures/ 目录本身不进扫描面——否则归档会自己套自己", () => {
    const tree = fakeTreeWithFiles({
      failures: { "old.json": { mtime: 9_000, dir: false } },
      "e2e-parity": { "report.json": { mtime: 9_000, dir: false } },
    });
    expect(collectSuiteReportFiles(0, "/results", tree)).toEqual([
      { suite: "e2e-parity", file: "report.json" },
    ]);
  });
});
