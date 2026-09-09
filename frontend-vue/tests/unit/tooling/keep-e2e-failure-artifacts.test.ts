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
