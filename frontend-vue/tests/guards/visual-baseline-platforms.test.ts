/*
  Product screenshot baseline platforms must match mandatory CI execution.
  Linux baselines use the pinned native ARM64 Playwright image on
  ubuntu-24.04-arm, or the identical image and native ARM64 architecture.
  Regeneration requires real content readiness, visual review of every PNG,
  and a complete replay without --update-snapshots. Darwin baselines remain
  separate; platform names never get copied or renamed as a substitute.
  Every platform must cover the same screenshot case names.
*/

import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../", import.meta.url));
const workflow = fileURLToPath(
  new URL(
    "../../../.github/workflows/frontend-vue-verify.yml",
    import.meta.url,
  ),
);

/** `<case>-<project>-<platform>.png` —— Playwright 的快照命名。 */
const SNAPSHOT = /^(.+)-([a-z]+)-(darwin|linux|win32)\.png$/;

function snapshotDirs(directory: string): string[] {
  return readdirSync(`${root}${directory}`, { withFileTypes: true }).flatMap(
    (entry) => {
      if (!entry.isDirectory()) return [];
      const path = `${directory}/${entry.name}`;
      return entry.name.endsWith(".spec.ts-snapshots")
        ? [path]
        : snapshotDirs(path);
    },
  );
}

const baselines = snapshotDirs("tests/e2e-visual").flatMap((directory) =>
  readdirSync(`${root}${directory}`).flatMap((file) => {
    const match = SNAPSHOT.exec(file);
    return match ? [{ directory, case: match[1]!, platform: match[3]! }] : [];
  }),
);

const platforms = [...new Set(baselines.map((it) => it.platform))].sort();

/**
 * CI 是否真的运行产品截图。
 *
 * 只认没有被注释掉的 `make e2e-visual`——现在的 workflow 注释里就提到了这个
 * 命令名，按裸字符串匹配会一直假红。
 */
const runsInCI = readFileSync(workflow, "utf8")
  .split("\n")
  .filter((line) => !/^\s*#/.test(line))
  .some((line) => /\bmake\s+e2e-visual\b/.test(line));

describe("视觉基线与 CI 的平台一致性", () => {
  it("至少有一份基线，否则这条 guard 自己是空转的", () => {
    expect(baselines.length).toBeGreaterThan(0);
    expect(platforms.length).toBeGreaterThan(0);
  });

  it("有 -linux 基线，当且仅当 CI 跑 make e2e-visual", () => {
    expect(
      { linuxBaselines: platforms.includes("linux"), runsInCI },
      platforms.includes("linux")
        ? "签入了 -linux 基线就必须同时把 make e2e-visual 接进 frontend-vue-verify.yml，否则基线白签"
        : "CI 要跑 make e2e-visual 就必须先有 -linux 基线，否则每次都是 missing snapshot，门禁常红",
    ).toEqual({ linuxBaselines: runsInCI, runsInCI });
  });

  it("每个平台的基线覆盖同一组用例", () => {
    const byPlatform = new Map<string, Set<string>>();
    for (const baseline of baselines) {
      const key = `${baseline.directory}::${baseline.platform}`;
      (byPlatform.get(key) ?? byPlatform.set(key, new Set()).get(key)!).add(
        baseline.case,
      );
    }
    const perDirectory = new Map<string, Map<string, string[]>>();
    for (const [key, cases] of byPlatform) {
      const [directory, platform] = key.split("::") as [string, string];
      const entry =
        perDirectory.get(directory) ??
        perDirectory.set(directory, new Map()).get(directory)!;
      entry.set(platform, [...cases].sort());
    }
    for (const [directory, entry] of perDirectory) {
      const [reference, ...rest] = [...entry.entries()];
      for (const [platform, cases] of rest) {
        expect(
          cases,
          `${directory} 的 ${platform} 基线与 ${reference![0]} 不是同一组用例；` +
            `少的那几张在对应平台上是 missing snapshot，而在本机全绿`,
        ).toEqual(reference![1]);
      }
    }
  });
});
