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

import { existsSync, readFileSync, readdirSync } from "node:fs";
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

  真跑那一遍的是 `make standalone-sim`（不进 verify：它动文件系统。
  **2026-09-16 第二十七轮起它进了 CI** 的 verify job——在此之前它不在任何
  自动入口里，于是从 2026-09-12 起红了二十多轮没人看见）。
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
/*
  第六条：**打开设置对话框只有一个入口。**

  对话框是缩放着进场的（`data-[state=open]:zoom-in-95` + `duration-200`）。
  wave 200 实测：进场那 ~170ms 里，框里第一个可点元素的 x 从 **119.2 走到 98.0**
  （21.2px），框宽 1107 → 1152。**在这段里量一次坐标再按下去就点偏了**，
  而报出来是 30 秒后的 `locator.click: Test timeout`，call log 停在「done scrolling」
  ——指不出真正的原因（wave 199 那轮循环里 `integrations.spec.ts:461` 就这么红过）。

  `openSettingsDialog` 在导航之后**按真实时间间隔等它停稳**再返回。
  「开完记得等一下」如果只写在注释里，是一条要靠人记住的规矩，忘一次就回到偶发红；
  收成唯一入口之后这里零豁免地拦住绕过它的写法。**扫之前先剥注释**（坑 305）。
*/
describe("打开设置对话框只有一个入口", () => {
  const specs = readdirSync(join(makefileDir, "tests/e2e")).filter((name) =>
    name.endsWith(".spec.ts"),
  );

  it("形状先断言：确实扫到了 spec 文件", () => {
    expect(specs.length).toBeGreaterThan(20);
  });

  it("没有任何 spec 自己 goto 一个 ?settings= 深链", () => {
    const offenders: string[] = [];
    for (const name of specs) {
      const source = readFileSync(join(makefileDir, "tests/e2e", name), "utf8");
      source.split("\n").forEach((line, index) => {
        const code = line.replace(/\/\/.*$/, "");
        if (/goto\(/.test(code) && /[?&]settings=/.test(code)) {
          offenders.push(`${name}:${index + 1}`);
        }
      });
    }
    expect(
      offenders,
      "这些地方绕过了 openSettingsDialog：对话框还在缩放进场时点里面的东西会点偏",
    ).toEqual([]);
  });

  it("助手本身在，且确实等停稳", () => {
    const helper = readFileSync(
      join(makefileDir, "tests/support/settings-dialog.ts"),
      "utf8",
    );
    expect(helper).toContain("settledBox");
  });
});

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
/*
  第三条底座一致性：**起真 Gateway 的 CI job，装配步骤必须一致。**

  第十九轮实测到的偏差：`frontend-vue-verify.yml` 里 `external-gates` 装的是
  `uv sync --group dev --extra browser` + `playwright install --with-deps chromium`
  （绿），而 `real-backend` 只有 `uv sync --group dev`（红）。Gateway 启动时按仓库根
  `config.yaml` 加载浏览器工具，缺 Playwright 直接
  `RuntimeError: Failed to load configuration during gateway startup`，
  于是 `make e2e-backend` 在 CI 上**至少从 2026-09-09 起一直红**。

  它躲过每一轮的原因很具体：**本机的 backend venv 里装着 playwright**，
  所以每一轮跑 `make e2e-backend` 都是 22 passed。
  「本机绿」和「这条门禁有效」是两件事，而它们长得一模一样。

  判据钉的不是版本号也不是步骤的措辞，是**「需要真 Gateway 的 job，装配步骤是同一份」**
  ——照 LOCKSTEP 那条的思路，只在真正分叉的那一刻红。
*/
const ciRoot = fileURLToPath(new URL("../../../.github/", import.meta.url));
const WORKFLOW_DIR = "workflows";
/**
 * 至少要在的那份工作流。
 *
 * **不写成「只读这一份」**：第三十七轮把对照套件放进了
 * `frontend-vue-parity.yml`（它的 `paths:` 必须含 `frontend/**`，塞进 verify
 * 那份会让每个 React 提交白跑三条 job）。如果这条守卫继续只读 verify 那一份，
 * 新 job 就是**这条判据够不着的地方**——而它起的正是真 Gateway。
 * 一条只覆盖旧文件的守卫和没有守卫长得一模一样。
 */
const REQUIRED_WORKFLOW = "frontend-vue-verify.yml";

/** 跑这些 target 的 job 要起真的 Gateway。 */
const NEEDS_GATEWAY = [
  "e2e-backend",
  "e2e-external",
  "e2e-browser",
  // 也起 replay Gateway（playwright.parity.config.ts 的 servers[0]）。
  "e2e-parity",
  "e2e-parity-auth",
];
/** 起真 Gateway 就必须有的两行。 */
const GATEWAY_SETUP = [
  "uv sync --group dev --extra browser",
  "uv run playwright install --with-deps chromium",
];

/**
 * 跑这些 target 的 job 必须把 `PARITY_REQUIRE_REACT=1` 打开。
 *
 * 缺了它，`../frontend` 一旦不在 checkout 里，四份 spec 的
 * `test.skip(!reactAppPresent)` 会让整组跳过、退出 0——CI 一片绿而一条都没量。
 * 理由全文在 tests/e2e-parity/support/react-preview.ts 的注释里。
 */
const NEEDS_REACT_REQUIRED = ["e2e-parity", "e2e-parity-auth"];
const REACT_REQUIRED_LINE = 'PARITY_REQUIRE_REACT: "1"';

/** 按两格缩进的 `<name>:` 切 job。 */
function workflowJobs(text: string): Map<string, string> {
  const lines = text.split("\n");
  const jobs = new Map<string, string>();
  let name: string | null = null;
  let buffer: string[] = [];
  for (const line of lines) {
    const header = /^ {2}([a-z][a-z0-9-]*):\s*$/.exec(line);
    if (header) {
      if (name) jobs.set(name, buffer.join("\n"));
      name = header[1]!;
      buffer = [];
    } else if (name) buffer.push(line);
  }
  if (name) jobs.set(name, buffer.join("\n"));
  // `on:` 下的 `push:` / `pull_request:` 也是两格缩进，按「有 steps」筛掉。
  return new Map([...jobs].filter(([, body]) => body.includes("steps:")));
}

/**
 * `.github/workflows/` 下每一份工作流里的每一个 job，键是 `文件名 / job 名`。
 *
 * **扫整个目录而不是点名文件**：点名的那一刻，下一份工作流就自动落在判据之外。
 */
function allWorkflowJobs(): Map<string, string> {
  const dir = join(ciRoot, WORKFLOW_DIR);
  const files = readdirSync(dir).filter(
    (name) => name.endsWith(".yml") || name.endsWith(".yaml"),
  );
  if (!files.includes(REQUIRED_WORKFLOW))
    throw new Error(
      `.github 在 checkout 里，但 ${REQUIRED_WORKFLOW} 不在——工作流被挪了，跟进这条断言`,
    );
  const jobs = new Map<string, string>();
  for (const file of files)
    for (const [name, body] of workflowJobs(
      readFileSync(join(dir, file), "utf8"),
    ))
      jobs.set(`${file} / ${name}`, body);
  return jobs;
}

describe("起真 Gateway 的 CI job 装配一致", () => {
  // `.github` 整个不在（本模块被单独移走）→ 明确跳过。
  const jobs = existsSync(ciRoot) ? allWorkflowJobs() : null;

  /** 跑了 `targets` 里任意一个 target 的 job。 */
  function jobsRunning(targets: readonly string[]) {
    return [...jobs!].filter(([, body]) =>
      targets.some((target) => body.includes(`make ${target}`)),
    );
  }

  it("形状先断言：切得出 job，而且真有 job 需要 Gateway", () => {
    if (jobs === null) return;
    expect(jobs.size).toBeGreaterThan(2);
    // 空集上恒真：切 job 的正则失效会让下面那些条静默全绿。
    expect(jobsRunning(NEEDS_GATEWAY).length).toBeGreaterThan(1);
    expect(jobsRunning(NEEDS_REACT_REQUIRED).length).toBeGreaterThan(0);
  });

  it("每个需要 Gateway 的 job 都装了浏览器依赖", () => {
    if (jobs === null) return;
    const missing: string[] = [];
    for (const [name, body] of jobsRunning(NEEDS_GATEWAY))
      for (const line of GATEWAY_SETUP)
        if (!body.includes(line)) missing.push(`${name} 缺：${line}`);
    expect(
      missing,
      "这个 job 会起真的 Gateway，而 Gateway 启动要 Playwright——" +
        "缺了它整条 job 红，而本机因为 venv 里装着而照旧绿。",
    ).toEqual([]);
  });

  /*
    对照套件这一条与上面那条是同一个形状的判据，只是失败方向相反：
    上面那条缺了会**红**，这一条缺了会**绿**——绿在一条什么都没量的运行上。
    后者更难发现，所以它必须由机器守着。
  */
  it("跑对照套件的 job 都要求兄弟应用真的在场", () => {
    if (jobs === null) return;
    const running = jobsRunning(NEEDS_REACT_REQUIRED);
    // job 级找不到就去它所在的文件级 `env:` 里找（本仓写在文件级，两个 job 共用）。
    const dir = join(ciRoot, WORKFLOW_DIR);
    const missing = running
      .filter(([name, body]) => {
        if (body.includes(REACT_REQUIRED_LINE)) return false;
        const file = name.split(" / ")[0]!;
        return !readFileSync(join(dir, file), "utf8").includes(
          REACT_REQUIRED_LINE,
        );
      })
      .map(([name]) => `${name} 缺：${REACT_REQUIRED_LINE}`);
    expect(
      missing,
      "没有它，`../frontend` 不在 checkout 里时四份 spec 整组 skip、退出 0——" +
        "一条量不到任何东西的绿，而它和真绿长得一模一样。",
    ).toEqual([]);
  });
});
