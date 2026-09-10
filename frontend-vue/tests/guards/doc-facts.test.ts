/*
  【文件职责】     守住文档里那些**可核实的数字**与代码实际情况一致。
  【架构位置】     门禁测试
  【主要导出】     无；Vitest cases
  【依赖关系】     I18N_INVENTORY.md · BEHAVIOR_CONTRACTS.md · baseline/*.json ·
                   tests/fixtures/streams/*.sse · i18n source guard · backend source
  【边界与注意】   与 `doc-references.test.ts` 分工：那边管「文档点名的东西存在吗」，
                   这边管「文档说的数字对吗」。两类都是同一种失效——文档在说谎，
                   而读它的人（越来越多是模型）没有第二个信息源可以对照。

                   一次盘点实测出来的偏差：
                   - `I18N_INVENTORY.md` 说 82 个 SFC / 80 个产品 SFC，实际 158 / 156；
                   - 同一份文档说 976 个 key / 160 个 unused，实际 987 / 150；
                   - `BEHAVIOR_CONTRACTS.md` 开头写「A–Q 共 17 组」，实际已经是 A–S 19 组；
                   - `openapi.snapshot.README.md` 说其余 24 个 router 无条件挂载，实际 22。
                   没有一条会让任何门禁变红，因为在此之前没有门禁读过文档。

                   只钉**能从签入产物直接算出来**的数字。测试条数、lint warning 条数
                   这类每次改动都会变的量，正确做法是不写进散文，而不是在这里追着它跑。
*/

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { readBackendSource } from "../../scripts/lib/backend-source.mjs";
import { productVueInventory } from "../../scripts/lib/i18n-source-guard.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

/*
  `make verify` 的**步骤表**。左边是四处散文用的类别名，右边是它真正跑的 target。
  这张表加上下面那条断言，把「verify 到底跑什么」从散文变成数据：
  改 verify 的先决条件而不改这张表 → 红；改了表而四处散文没跟 → 红。

  wave 60 实测的偏差（四处互不相同，且都和 recipe 对不上）：
  - `ARCHITECTURE.md` 写着 `清单`——那是 `collected-check`，`1209651f`
    （2026-08-25 00:11）已经把它从 verify 里删了，而这句话是同一天 12:57 的
    `c6fc60b4` 写下的，**提交说明恰好是「make every documented command and path
    real, and gate it」**——写下那一刻就是错的（同线索 178）；
  - 四处都漏了 `gen-contract-constants-check`；
  - `Makefile` 自己的 help 只列了 5 个，漏掉 i18n / OpenAPI / 契约常量 / 独立性——
    而它们各自在 help 里另有一行，读的人会以为要在 verify 之外单独跑。
*/
const VERIFY_STEPS: Record<string, string[]> = {
  lint: ["lint"],
  格式: ["format-check"],
  类型: ["typecheck", "typecheck-tests", "typecheck-core"],
  单测: ["test"],
  i18n: ["i18n-check", "i18n-source-check"],
  OpenAPI: ["gen-api-types-check"],
  契约常量: ["gen-contract-constants-check"],
  独立性: ["standalone-check"],
  build: ["build"],
};

/** 四处散文各自的写法：`[文件, 那一行必须逐字包含的串]`。 */
const VERIFY_PROSE: [string, string][] = [
  [
    "ARCHITECTURE.md",
    "lint、格式、类型、单测、i18n、OpenAPI、契约常量、独立性、build",
  ],
  [
    "README_zh.md",
    "lint、格式、类型、单测、i18n、OpenAPI、契约常量、独立性、build",
  ],
  [
    "README.md",
    "lint, format, types, unit, i18n, OpenAPI, contracts, standalone, build",
  ],
  ["Makefile", "lint + format + types + unit + i18n + OpenAPI"],
  ["Makefile", "+ contracts + standalone + build"],
];

describe("make verify 的步骤表", () => {
  it("步骤表的并集逐个等于 verify 的先决条件", () => {
    const recipe = /^verify:(.*)$/m.exec(read("Makefile"));
    expect(recipe, "Makefile 里找不到 verify: 这一行").not.toBeNull();
    const actual = (recipe?.[1] ?? "").trim().split(/\s+/).filter(Boolean);
    expect(actual.length).toBeGreaterThan(5);
    const declared = Object.values(VERIFY_STEPS).flat();
    expect([...declared].sort()).toEqual([...actual].sort());
  });

  it("四处散文都按这张表写，一处不落", () => {
    for (const [file, phrase] of VERIFY_PROSE) {
      expect(
        read(file),
        `${file} 里 make verify 的说明与步骤表对不上`,
      ).toContain(phrase);
    }
  });

  it("散文里不许再出现 verify 已经不跑的步骤", () => {
    const gone = ["collected-check", "header-check", "清单"];
    for (const [file] of VERIFY_PROSE) {
      const line = read(file)
        .split("\n")
        .find((l) => l.includes("make verify") && l.includes("#"));
      for (const dead of gone) {
        expect(
          line ?? "",
          `${file}: ${dead} 早就不在 verify 里了`,
        ).not.toContain(dead);
      }
    }
  });
});

describe("文档里的数字和代码一致", () => {
  it("I18N_INVENTORY 的 SFC 数就是 inventory 实际扫到的数", () => {
    const inventory = productVueInventory() as {
      checked: string[];
      excludedTestFixtures: string[];
      unscanned: string[];
    };
    // 那句话说的是「当前 checkout 共有 N 个 Vue SFC」，所以 N 必须来自 checkout，
    // 不能只来自扫描面——`unscanned` 不算进来的话，一个白名单外的 SFC
    // 会让这句话变成假的而这条用例照样绿（wave 84 实测）。
    const total =
      inventory.checked.length +
      inventory.excludedTestFixtures.length +
      inventory.unscanned.length;
    const doc = read("I18N_INVENTORY.md");
    expect(doc).toContain(`当前 checkout 共有 ${total} 个 Vue SFC`);
    expect(doc).toContain(`${inventory.checked.length} 个产品 SFC 全部进入`);
    expect(doc).toContain(
      `${inventory.checked.length} 个产品 SFC 无核心英文硬编码`,
    );
  });

  it("I18N_INVENTORY 的 key/unused 数就是签入基线里的数", () => {
    const baseline = JSON.parse(read("baseline/i18n-keys.json")) as {
      total: number;
      unusedTotal: number;
    };
    const doc = read("I18N_INVENTORY.md");
    expect(doc).toContain(`各有 ${baseline.total} 个完全一致的 leaf key`);
    expect(doc).toContain(`${baseline.unusedTotal} 个已审阅 unused key`);
  });

  it("BEHAVIOR_CONTRACTS 声明的组数就是实际的组数", () => {
    const doc = read("BEHAVIOR_CONTRACTS.md");
    const groups = [...doc.matchAll(/^## ([A-Z])\. /gm)].map((m) => m[1]);
    expect(groups.length).toBeGreaterThan(10);
    const last = groups.at(-1);
    expect(doc).toContain(`全表 **A–${last} 共 ${groups.length} 组**`);
  });

  it("openapi 快照 README 的路径/schema/router 数与签入快照一致", () => {
    const snapshot = JSON.parse(read("baseline/openapi.snapshot.json")) as {
      paths: Record<string, unknown>;
      components: { schemas: Record<string, unknown> };
    };
    const doc = read("baseline/openapi.snapshot.README.md");
    expect(doc).toContain(
      `${Object.keys(snapshot.paths).length} 条路径 / ${
        Object.keys(snapshot.components.schemas).length
      } 个 schema`,
    );

    /*
      router 数只在 backend 也在 checkout 里时校验：本模块必须能独立工作。
      **不要写回 `try { read(…) } catch { return }`**（wave 107）：那样会把
      「后端整个不在」和「那份文件被挪走了」压成一件事，后者也被静默吃掉，
      这条断言从此不再被检查而没有任何征兆。`readBackendSource` 把两者分开。
    */
    const app = readBackendSource("app/gateway/app.py");
    if (app === null) return;
    const all = [...app.matchAll(/^(\s*)app\.include_router\(/gm)];
    const conditional = all.filter((m) => (m[1] ?? "").length > 4).length;
    expect(doc).toContain(
      `其余 ${all.length - conditional} 个 router 无条件挂载`,
    );
  });

  it("tests/unit 下不再有阶段命名目录", () => {
    const dirs = readdirSync(join(ROOT, "tests/unit"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    expect(dirs.length).toBeGreaterThan(10);
    // `wp02`…`wp12` 与 `m7` 已按用途归位；再冒出一个就说明有人照旧习惯建了目录。
    expect(dirs.filter((name) => /^(?:wp\d+|m\d+[ab]?)$/.test(name))).toEqual(
      [],
    );
  });

  it("测试标题里没有阶段前缀", () => {
    const offenders: string[] = [];
    const walk = (rel: string) => {
      for (const entry of readdirSync(join(ROOT, rel), {
        withFileTypes: true,
      })) {
        const child = `${rel}/${entry.name}`;
        if (entry.isDirectory()) walk(child);
        else if (
          child.endsWith(".ts") &&
          /describe\(\s*"(?:WP-\d+|M\d+[ab]?)[\s·]/.test(read(child))
        ) {
          offenders.push(child);
        }
      }
    };
    walk("tests");
    expect(offenders).toEqual([]);
  });

  it("遗留阶段标识清单既没漏项，也没多出新的", () => {
    const doc = read("ARCHITECTURE.md");
    /*
      还剩下的都是**标识符**（页面目录、环境变量、harness 文件、契约常量），
      改它们会波及 Dockerfile / CI / 后端 harness，所以留着并如实列出。
      这里两个方向都查：文档写了的必须真的存在，存在的必须写进文档。
    */
    const survivors = [
      "app/pages/__m0",
      "tests/support/run_m0_gateway.py",
      "tests/support/m0_replay_provider.py",
    ];
    for (const rel of survivors) {
      expect({ rel, exists: existsSync(join(ROOT, rel)) }).toEqual({
        rel,
        exists: true,
      });
      expect(doc).toContain(rel.split("/").pop() as string);
    }
    expect(doc).toContain("NUXT_PUBLIC_M0_TEST_PAGES");
    expect(read("packages/agent-core/src/index.ts")).toContain(
      'AGENT_CORE_CONTRACT_VERSION = "m8"',
    );
    expect(doc).toContain('AGENT_CORE_CONTRACT_VERSION = "m8"');
  });

  it("SSE golden trace 的帧数就是签入文件里的帧数", () => {
    const trace = read("tests/fixtures/streams/deerflow-create.sse");
    // 捕获组与整条正则同生共死：匹配上了就一定有 group 1。
    const events = [...trace.matchAll(/^event: *(\S+)/gm)].map((m) => m[1]!);
    const counts = new Map<string, number>();
    for (const name of events) counts.set(name, (counts.get(name) ?? 0) + 1);
    const doc = read("tests/fixtures/streams/README.md");
    expect(doc).toContain(`${events.length} 个事件帧`);
    for (const [name, count] of counts) {
      expect(doc).toContain(`\`${name}\` ${count}`);
    }
  });
});
