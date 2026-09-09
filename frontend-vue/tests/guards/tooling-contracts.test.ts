/*
  【文件职责】     钉住工程底座里两条「错了很难看出来」的一致性：成组依赖的版本、
                   以及 Makefile 的 `.PHONY` 与实际 target 一一对应。
  【架构位置】     门禁测试
  【主要导出】     无
  【依赖关系】     package.json · Makefile
  【边界与注意】   **起因是一次真实的两小时弯路**（wave 63/64）：想给本仓量一次行覆盖率，
                   裸跑 `pnpm add -Dw @vitest/coverage-v8` 装到了 **5.0.0**，
                   而本仓的 vitest 是 **4.1.10**。报出来的是

                       AssertionError: coverageFilesDirectory is required

                   ——它出现在**每一个 worker** 上、一次 251 个未处理错误、
                   summary 是 `0/14416 statements`，而且三个 project（node / dom /
                   nuxt）全都一样。**看起来像「这套三-project 配置不支持覆盖率」，
                   实际是 v5 的 provider 在跟 v4 的核心说话。**
                   换成同一条 range 之后一次就过，`vitest.config.ts` 一个字都不用改。

                   **所以这里钉的不是「版本号是多少」，是「这两条 range 逐字相同」。**
                   钉具体版本号会让每次升级都要改守卫（`e2e-suite-contract.test.ts`
                   文件头点名的反模式）；钉「相同」只在真正出事的那一刻红——
                   有人只升其中一个，或者裸 `pnpm add` 抓了 latest。

                   **只钉 major/minor 层面的搭配**：pnpm 在同一条 caret range 里
                   把两者解析到差一个 patch（实测 vitest 4.1.10 + coverage 4.1.11）
                   是正常的，也实测能跑。真正会炸的是跨大版本。
*/

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  CROSS_APP_BY_DESIGN,
  KINDS,
} from "../../scripts/lib/cross-app-by-design.mjs";

const packageJson = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../../package.json", import.meta.url)),
    "utf8",
  ),
) as { devDependencies?: Record<string, string> };

const dev = packageJson.devDependencies ?? {};

/** 必须共用同一条 range 的成组依赖。 */
const LOCKSTEP: [string, string][] = [["vitest", "@vitest/coverage-v8"]];

describe("成组依赖的版本必须一起升", () => {
  it("形状先断言：清单非空，且这些包都还在 devDependencies 里", () => {
    // 清单清空时上面两个 for 都不进循环，断言全部落空却照样绿——
    // 这正是线索 176 说的「算出来的 0 和没算的 0 长得一模一样」。
    expect(LOCKSTEP.length).toBeGreaterThan(0);
    expect(Object.keys(dev).length).toBeGreaterThan(5);
    for (const group of LOCKSTEP) {
      for (const name of group) {
        expect(dev[name], `${name} 不在 devDependencies 里`).toBeDefined();
      }
    }
  });

  it("同组的 range 逐字相同", () => {
    for (const [left, right] of LOCKSTEP) {
      expect(
        dev[right],
        `${right} 与 ${left} 的 range 必须逐字相同——` +
          "版本错配时 vitest 报的是 `coverageFilesDirectory is required`，" +
          "看不出是版本问题。裸 `pnpm add` 会抓 latest，要写死 range。",
      ).toBe(dev[left]);
    }
  });
});

/*
  `.PHONY` 与实际 target 必须一一对应。

  两边都会单向烂掉，而且都不报错：
  - 声明了却没有对应 target —— 真去跑那一条时 make 报 "No rule to make target"，
    但只有跑它的人才会发现；
  - 有 target 却没声明 —— 目录里正好有个同名文件时 make 会**什么都不做**，
    这一条最阴，因为它「成功」了。

  wave 60 手工量过一次（53 : 53 全对），但**没有留下门禁**；wave 64 变异实测：
  把 `coverage:` 改名成 `coverageX:` 而 `.PHONY` 不动，当时一条用例都不红。
*/
const makefileDir = fileURLToPath(new URL("../../", import.meta.url));
const makefile = readFileSync(join(makefileDir, "Makefile"), "utf8");

function declaredPhony(): Set<string> {
  const match = /^\.PHONY:((?:[^\n\\]|\\\n)*)/m.exec(makefile);
  if (!match) throw new Error("Makefile 里找不到 .PHONY");
  return new Set(match[1]!.replace(/\\\n/g, " ").split(/\s+/).filter(Boolean));
}

function realTargets(): Set<string> {
  return new Set(
    [...makefile.matchAll(/^([a-z][a-z0-9-]*):/gm)].map((m) => m[1] as string),
  );
}

describe("Makefile 的 .PHONY 与 target", () => {
  const phony = declaredPhony();
  const targets = realTargets();

  it("形状先断言：两边都不是空的", () => {
    expect(phony.size).toBeGreaterThan(20);
    expect(targets.size).toBeGreaterThan(20);
  });

  it("声明的每一条都有对应 target", () => {
    expect(
      [...phony].filter((name) => !targets.has(name)).sort(),
      ".PHONY 里声明了但 Makefile 里没有这条 target",
    ).toEqual([]);
  });

  it("每一条 target 都被声明", () => {
    expect(
      [...targets].filter((name) => !phony.has(name)).sort(),
      "有 target 没进 .PHONY——同名文件存在时 make 会静默什么都不做",
    ).toEqual([]);
  });
});

/*
  第三条：`CROSS_APP_BY_DESIGN` 的每一条都得说清「兄弟应用缺席时靠什么不红」。

  **起因**：这张表的 `note` 挂了几十轮，**没有任何机器读过它**（线索 183）。
  wave 83 第一次真把 `../frontend` 移走跑了一遍，17 条里当场倒了一条——
  `upstream-key-coverage.test.ts` 写着「整组 skipIf 跳过」，而
  `describe.skipIf` 跳过的是用例、不是收集，工厂函数里那句 readFileSync
  照样执行，`make verify` 当场红。另有一条（`doc-references.test.ts`）
  写着「那一条用例跳过」，实测是**三条**、而且根本不是跳过，是函数体里
  `return` 掉、报绿。

  真跑那一遍的是 `make standalone-sim`（不进 verify：它动文件系统）。
  这里只钉**结构**——每条都分了类、类和路径形状对得上、点名的文件还在——
  这样「新加一条却忘了想清楚缺席怎么办」当场红，而不必等谁去跑 sim。
*/
const CROSS_APP_ROOT = fileURLToPath(new URL("../../", import.meta.url));

describe("跨应用对照工具的登记表", () => {
  const entries = Object.entries(CROSS_APP_BY_DESIGN);

  it("形状先断言：表非空，且每条都有 kind 和 note", () => {
    expect(entries.length).toBeGreaterThan(10);
    expect(
      entries
        .filter(([, value]) => !KINDS.includes(value.kind) || !value.note)
        .map(([file]) => file),
      "有条目没分类或没写理由",
    ).toEqual([]);
  });

  it("kind 和路径形状对得上", () => {
    const expected = (file: string) => {
      if (file.endsWith(".test.ts")) return "test";
      if (file.startsWith("scripts/") && file.endsWith(".mjs")) return "script";
      if (file.endsWith(".json")) return "data";
      return null; // 形状看不出来的（e2e 支持模块）由 note 自己解释
    };
    expect(
      entries
        .filter(([file, value]) => {
          const want = expected(file);
          return want !== null && want !== value.kind;
        })
        .map(([file, value]) => `${file} 标成了 ${value.kind}`),
      "分类和路径形状矛盾",
    ).toEqual([]);
  });

  it("表里点名的文件都还在", () => {
    expect(
      entries
        .map(([file]) => file)
        .filter((file) => !existsSync(join(CROSS_APP_ROOT, file))),
      "登记表指着一个不存在的文件",
    ).toEqual([]);
  });
});

/*
  第五条：**每一次真跑用例，都要经过会保存失败现场的那个包装器。**

  **起因是一次真实的证据丢失**（wave 197）：`thread-history` 那条偶发红留下了
  trace，而我为了确认「是不是本轮回归」重跑了两次——Playwright **每次运行都会先
  清空 `outputDir`**，那份 trace 就没了。实测过：往 `test-results/e2e/` 放一个
  marker 文件，随便跑一条用例之后它就不在了。

  **这条和 wave 195 那条是一件事的两段**：那次修的是「`retries: 0` 配
  `trace: "on-first-retry"` 等于从来不录」，这次是「录下来了，但活不过下一次运行」。
  偶发红之后最自然的动作恰恰就是重跑——两条都不修，现场必然在被人看之前消失。

  守的是形状而不是某个具体命令：Makefile 里**除了 `E2E_RUN` 自己那一行和只列用例
  的 `--list`**，不许再出现别的 `playwright test`。**扫之前要先去掉注释行**
  （坑 202/316：注释里出现的字样会让这类扫描白扫或误报）。
*/
describe("跑用例必须经过保存失败现场的包装器", () => {
  const WRAPPER = "scripts/keep-e2e-failure-artifacts.mjs";
  const commandLines = makefile
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("#"));
  // 字面量 `playwright test` 只该出现在两处：`E2E_RUN` 的定义，和只列用例的
  // `--list`。真正跑用例的 target 行里出现的是展开前的 `$(E2E_RUN)`。
  const invocations = commandLines.filter((line) =>
    line.includes("playwright test"),
  );
  const wrapped = commandLines.filter((line) => line.includes("$(E2E_RUN)"));

  it("形状先断言：两边都扫到了东西", () => {
    expect(
      invocations.length,
      "一条 playwright 调用都没扫到——这条守卫在空转",
    ).toBeGreaterThanOrEqual(2);
    expect(
      wrapped.length,
      "一条 $(E2E_RUN) 都没扫到——这条守卫在空转",
    ).toBeGreaterThanOrEqual(3);
  });

  it("包装器脚本存在", () => {
    expect(existsSync(join(makefileDir, WRAPPER))).toBe(true);
  });

  it("除了包装器定义与 --list，没有别的地方直接跑 playwright", () => {
    expect(
      invocations.filter(
        (line) =>
          !line.includes(WRAPPER) &&
          !line.includes("--list") &&
          !line.includes("$(E2E_RUN)"),
      ),
      "这一行绕过了 E2E_RUN：它失败时 test-results/ 里的 trace 会被下一次运行清掉",
    ).toEqual([]);
  });

  it("E2E_RUN 的定义确实指向包装器", () => {
    const definition = commandLines.find((line) =>
      /^E2E_RUN\s*=/.test(line.trim()),
    );
    expect(definition, "Makefile 里找不到 E2E_RUN 的定义").toBeDefined();
    expect(definition).toContain(WRAPPER);
    expect(definition).toContain("playwright test");
  });
});

describe("Playwright 的录制策略与重试次数不许自相矛盾", () => {
  /*
    `on-first-retry` / `on-all-retries` 只在**重试**时录。本仓 `retries: 0`，
    所以这两种模式等于「永不录制」——而它是**静默**的：跑一万次也不会有人发现
    trace 目录一直是空的，直到某天真出了一次偶发红、现场却只有一张截图。

    wave 195 就是这么卡住的：一条 1/15 左右的偶发失败，连跑 14 次没能复现，
    而唯一的现场没有网络与 DOM 时间线。
  */
  const factory = readFileSync(
    fileURLToPath(new URL("../support/playwright-factory.ts", import.meta.url)),
    "utf8",
  );

  function valueOf(key: string): string | null {
    const match = new RegExp(`(?:^|\\n)\\s*${key}:\\s*([^,\\n]+),`).exec(
      factory.replaceAll(/\/\*[\s\S]*?\*\//g, ""),
    );
    return match ? match[1]!.trim() : null;
  }

  it("读得到 retries 与 trace 两项", () => {
    // 少了这一条，改名之后下面那条会在 null 上恒真。
    expect(valueOf("retries")).not.toBeNull();
    expect(valueOf("trace")).not.toBeNull();
  });

  it("retries 为 0 时，trace 不许用只在重试时才录的模式", () => {
    const retries = Number(valueOf("retries"));
    const trace = valueOf("trace")!.replaceAll('"', "");
    if (retries === 0) {
      expect(
        ["on-first-retry", "on-all-retries"].includes(trace),
        `retries=0 而 trace=${trace}：这个组合永远不会录下任何 trace。` +
          `要么把 retries 调大，要么用 retain-on-failure。`,
      ).toBe(false);
    }
  });
});
