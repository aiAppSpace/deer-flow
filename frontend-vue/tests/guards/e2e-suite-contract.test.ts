/*
  【文件职责】     守住 E2E 套件布局：config、testDir、make 目标与 spec 文件四者一一对应。
  【架构位置】     门禁测试
  【主要导出】     无
  【依赖关系】     playwright*.config.ts · Makefile · tests/e2e* 下的套件目录
  【边界与注意】   这里钉的是**结构**，不是数量。原来那份守卫钉的是「m7 恰好 29 文件 169 测试」
                   这类快照数字：加一个用例就得改守卫，于是守卫本身变成了噪音，
                   而真正会出事的「某个 spec 谁都没跑」它反而看不见——因为清单是手写的。
                   现在钉的是：每个 spec 文件恰好被一个 config 的 testDir 覆盖，
                   每个 config 恰好有一个 make 目标。加用例不用动这里，漏跑一定红。
*/

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { mergeLoopbackNoProxy } from "../../scripts/with-loopback-no-proxy.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const makefile = readFileSync(`${root}Makefile`, "utf8");

const configFiles = readdirSync(root).filter(
  (name) => name.startsWith("playwright.") && name.endsWith(".config.ts"),
);

/** config 文件名里的套件标识：playwright.<id>.config.ts；主 config 的 id 是 "config"。 */
function suiteIdOf(configFile: string): string {
  if (configFile === "playwright.config.ts") return "config";
  return configFile.slice("playwright.".length, -".config.ts".length);
}

function testDirOf(configFile: string): string {
  const source = readFileSync(`${root}${configFile}`, "utf8");
  const match = /testDir:\s*"\.\/([^"]+)"/.exec(source);
  if (!match?.[1]) throw new Error(`${configFile} 没有声明 testDir`);
  return match[1];
}

function specFilesBelow(directory: string): string[] {
  return readdirSync(`${root}${directory}`, { withFileTypes: true }).flatMap(
    (entry) => {
      const path = `${directory}/${entry.name}`;
      if (entry.isDirectory()) return specFilesBelow(path);
      return entry.name.endsWith(".spec.ts") ? [path] : [];
    },
  );
}

const suiteDirs = readdirSync(`${root}tests`, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name.startsWith("e2e"))
  .map((entry) => `tests/${entry.name}`);

describe("E2E 套件布局", () => {
  it("每个 config 声明一个存在的 testDir，且各不相同", () => {
    const dirs = configFiles.map(testDirOf);
    expect(new Set(dirs).size).toBe(dirs.length);
    for (const dir of dirs) {
      expect(suiteDirs, `${dir} 不是 tests/e2e* 下的套件目录`).toContain(dir);
    }
  });

  it("每个套件目录恰好被一个 config 覆盖", () => {
    const covered = new Set(configFiles.map(testDirOf));
    const uncovered = suiteDirs.filter((dir) => !covered.has(dir));
    expect(uncovered, "这些目录里的 spec 谁都不会跑").toEqual([]);
  });

  it("每个 spec 文件都落在某个套件目录里", () => {
    const owned = new Set(suiteDirs.flatMap((dir) => specFilesBelow(dir)));
    const all = specFilesBelow("tests").filter(
      (file) => !file.startsWith("tests/parity/"),
    );
    const orphans = all.filter((file) => !owned.has(file));
    expect(
      orphans,
      "这些 spec 不在任何套件目录下，不会被任何 config 收集",
    ).toEqual([]);
  });

  it("每个 config 有一个对应的 make 目标", () => {
    for (const file of configFiles) {
      const id = suiteIdOf(file);
      const target = id === "config" ? "e2e" : `e2e-${id}`;
      expect(makefile, `缺少 make ${target}（对应 ${file}）`).toMatch(
        new RegExp(`^${target.replace(/-/g, "\\-")}:`, "m"),
      );
    }
  });

  it("聚合目标覆盖每一个套件", () => {
    const aggregate = /^e2e-(?:mock|backend):(.*)$/gm;
    const listed = new Set<string>();
    for (const match of makefile.matchAll(aggregate)) {
      for (const name of match[1]!.trim().split(/\s+/)) listed.add(name);
    }
    // 刻意不进聚合入口的四个套件，每个都必须写清为什么：
    //   external —— 需要后端的 browser extra，普通 CI 装不到；
    //   visual   —— 截图基线只有 -darwin，Linux CI 上必然红（见 Makefile 注释）；
    //   parity   —— 需要**兄弟应用** ../frontend 才能跑，而本仓的
    //               install/build/test/e2e 都不依赖它（见 make standalone-check）。
    //               把它放进聚合入口，等于把独立性这条硬要求悄悄降级成建议。
    //   parity-auth —— 同 parity，也要兄弟应用；与 parity 分开只是因为
    //               auth 模式是构建期决定的。⚠ 它 2026-09-09 加进下面这个集合时
    //               没人同步这段注释（当时写着「三个套件」而集合里是四个）——
    //               **加一条就要在这里补一条理由**，这正是这段注释的用途。
    const standalone = new Set(["external", "visual", "parity", "parity-auth"]);
    /*
      反方向（wave 111）：这三个 id 必须真的还是 config。此前只有正方向——
      「非 standalone 的都要进聚合入口」；一个改了名的套件会**同时**从
      `expected` 里消失、又在 `standalone` 里留一条死配置，两头都不红，
      而它从此不进任何聚合入口也没人知道（线索 186 那一类）。
    */
    const suiteIds = new Set(configFiles.map(suiteIdOf));
    expect(
      [...standalone].filter((id) => !suiteIds.has(id)),
      "standalone 里点名的套件已经不存在了：删掉它，或者跟上改名",
    ).toEqual([]);
    const expected = configFiles
      .map(suiteIdOf)
      .filter((id) => !standalone.has(id))
      .map((id) => (id === "config" ? "e2e" : `e2e-${id}`));
    for (const target of expected) {
      expect(listed, `${target} 不在 e2e-mock / e2e-backend 里`).toContain(
        target,
      );
    }
  });
});

describe("本地 Playwright 调用约定", () => {
  it("所有 playwright 调用都走 loopback 代理包装", () => {
    /*
      **先去掉注释行**（坑 202/316 的又一次重演）。这条守卫原来直接扫全文，
      于是 wave 197 在 Makefile 里写下一句「……不能直接写 `playwright test`」的
      注释时它当场红了——报的是「有一条调用没走包装」，而那一行根本不是调用。
      **扫命令的守卫，扫之前一律先剥注释**：不剥的话，误报和漏报都只是时间问题。
    */
    const commands = makefile
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("#"))
      .filter((line) => line.includes("playwright test"));
    expect(commands.length).toBeGreaterThan(0);
    expect(commands.every((line) => line.includes("$(E2E_EXEC)"))).toBe(true);
  });

  it("合并两种 NO_PROXY 拼写且不删掉用户已有的条目", () => {
    const merged = mergeLoopbackNoProxy({
      NO_PROXY: "internal.example,localhost",
      no_proxy: "legacy.example,127.0.0.1",
      HTTPS_PROXY: "http://proxy.example",
    });

    expect(merged.NO_PROXY).toBe(
      "internal.example,localhost,legacy.example,127.0.0.1",
    );
    expect(merged.no_proxy).toBe(merged.NO_PROXY);
    expect(merged.HTTPS_PROXY).toBe("http://proxy.example");
  });
});
