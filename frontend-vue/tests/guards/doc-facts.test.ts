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
import { readPlanDoc } from "../../scripts/lib/plan-docs.mjs";
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
/*
  仓库根 `docs/plans/` 那三份计划文档里的**台账读数**。

  为什么要单独守这一处：两份历史快照（`vue-parity-handoff.md` 的「历史快照」节、
  `vue-parity-open-accounts.md` 的「收工时的门禁读数」节）都自带「数字已过期」
  并把读者指向冷启动文档——**于是全仓唯一活着的台账读数只写在那两个地方**，
  而此前 `doc-facts` 的扫描面止于 `frontend-vue/`，够不到它们。
  第十九轮实测的偏差：冷启动文档两处写 `138 个场景-维度`（实际 140）、
  一处写 `129 个场景-维度里仍有 110 个是 desktop`（实际 140 里 118），
  交接文档写 `138 个场景-维度`。第十八轮把场景-维度从 138 加到 140 时，
  没有任何门禁会因为文档没跟而变红。

  判据用**全称**而不是 `toContain`：`toContain` 只证明「至少有一处写对了」，
  证不了「没有第二处还是旧的」——冷启动文档正好有两处写同一个数。
  为此必须同时断言**匹配到的处数不为 0**：全称量词在空集上恒真，
  改了措辞让正则一处都匹配不上，这条用例会静默变成永远绿的。

  **全称判据的代价，写明白省得下一个人困惑**：冷启动文档里从此**不能**再写出
  「<旧数> 个场景-维度」这样的历史值——正则不区分「现状」和「引述」，会把它判红。
  要讲某个数以前是错的，绕开这几个词组（本文档第十九轮那段就是这么写的）。
  这是刻意的取舍：宁可措辞受限，也不要一个能被「我这是在引述」绕过去的门禁。

  `parityTests` 那一条的量法另外核过一遍：
  `npx playwright test -c playwright.parity.config.ts --list` 报 `Total: 148 tests`，
  与 `场景-维度 140 + 固定 8` 相等——不是推导和散文互相印证的自洽错误。
*/
type PlanClaim = {
  /** 文档里的写法，捕获组 1 是那个数。 */
  pattern: RegExp;
  /** 这个数从签入产物怎么算出来。 */
  actual: (m: LedgerMeasures) => number;
  label: string;
};

type LedgerMeasures = {
  scenarioDimensions: number;
  uniqueRows: number;
  multiset: number;
  desktopDimensions: number;
  nonDesktopFamilies: string[];
  i18nKeys: number;
  i18nUnused: number;
  parityTests: number;
  distinctRows: number;
};

/*
  `PARITY_FIXED_SPECS` 那几份 spec 里的固定用例数（**不随场景目录变**的那些）。
  为什么是 9 而三份文件只有 8 个 `test(` 调用点：`topology.spec` 最后那个包在
  一个两项的 `for` 里（vue / react 各一条）。下面那条用例钉住「调用点还是 8 个」
  ——有人加一条用例，调用点数变了就红，逼着这个常量和文档一起跟进。
  **不去解析循环**：解析比硬编码更脆，而硬编码配一条调用点断言，
  失效时会明确报出来。

  **加新 spec 要同时改三处**：这张表、这个常量、下面那条调用点断言。
  第二十四轮加 `sidebar-collapsed-affordance.spec.ts` 时走的就是这条
  （8 → 9 / 7 → 8 个调用点）。
*/
const PARITY_FIXED_SPECS = [
  "diff",
  "topology",
  "sidebar-collapsed-affordance",
] as const;
const PARITY_FIXED_TESTS = 9;

/** 全部读数只从签入基线算，一个字都不从散文里读。 */
function measureLedger(): LedgerMeasures {
  const entries = JSON.parse(read("baseline/parity-diff.json"))
    .entries as Record<string, Record<string, unknown>>;
  const rows: string[] = [];
  for (const [key, lanes] of Object.entries(entries)) {
    for (const [lane, value] of Object.entries(lanes)) {
      if (Array.isArray(value))
        for (const row of value) rows.push(`${key}·${lane}:${row}`);
    }
  }
  /*
    **不同的差异条目**：按 `(档, 行文本)` 去重，而不是按 `场景/档/行`。
    两者都对，但回答的是不同问题——`uniqueRows` 数的是「有多少个
    场景-维度×档×行 的坑」（同一处差异投影几次就数几次），
    这个数的是「还有多少件事要判或要修」。
    2026-09-16 实测：159 vs **41**，差了将近四倍，而此前所有散文只写前者，
    读的人（多半是模型）会把它当成「还有 159 件事」。
  */
  const distinct = new Set<string>();
  for (const [, lanes] of Object.entries(entries))
    for (const [lane, value] of Object.entries(lanes))
      if (Array.isArray(value))
        for (const row of value) distinct.add(`${lane}\u0000${row}`);

  const keys = Object.keys(entries);
  const i18n = JSON.parse(read("baseline/i18n-keys.json")) as {
    total: number;
    unusedTotal: number;
  };
  return {
    distinctRows: distinct.size,
    i18nKeys: i18n.total,
    i18nUnused: i18n.unusedTotal,
    // e2e-parity 的用例数**是算得出来的**，不是只能跑出来的：
    // `scenarios.spec` 每个场景-维度一条，另加两份 spec 里的固定用例。
    parityTests: keys.length + PARITY_FIXED_TESTS,
    scenarioDimensions: keys.length,
    uniqueRows: new Set(rows).size,
    multiset: rows.length,
    desktopDimensions: keys.filter((k) => k.includes("/desktop/")).length,
    // 键形是 `场景[#终态]/断点/主题/语言`；按**场景族**去重（去掉 `#终态`）。
    nonDesktopFamilies: [
      ...new Set(
        keys
          .filter((k) => !k.includes("/desktop/"))
          .map((k) => k.split("/")[0]!.split("#")[0]!),
      ),
    ].sort(),
  };
}

const PLAN_CLAIMS: PlanClaim[] = [
  { pattern: /(\d+) 唯一行/g, actual: (m) => m.uniqueRows, label: "唯一行" },
  { pattern: /(\d+) 多重集/g, actual: (m) => m.multiset, label: "多重集" },
  {
    pattern: /(\d+) *个? *场景-维度/g,
    actual: (m) => m.scenarioDimensions,
    label: "场景-维度",
  },
  {
    pattern: /(\d+) 个是 desktop/g,
    actual: (m) => m.desktopDimensions,
    label: "desktop 档",
  },
  /*
    **`N 条不同的差异` 这个措辞保留给台账总数**，因为这条是全称判据：
    文档里每一处这样写的都会被拿去和实测总数比。
    分组计数（某一笔账占几条）请写 **`N 条差异条目`**，否则会撞上这条断言
    ——2026-09-16 实测撞过一次：给账 F / G 写「8 条不同的差异」「12 条不同的差异」
    当场红，而它们说的是分组不是总数。
  */
  {
    pattern: /(\d+) 条不同的差异/g,
    actual: (m) => m.distinctRows,
    label: "不同的差异条数（这个措辞保留给总数；分组请写「N 条差异条目」）",
  },
  { pattern: /词典 (\d+) key/g, actual: (m) => m.i18nKeys, label: "词典 key" },
  {
    pattern: /词典 \d+ key \/ (\d+) unused/g,
    actual: (m) => m.i18nUnused,
    label: "词典 unused",
  },
  {
    pattern: /e2e-parity[^\n]*?\*\*(\d+) passed\*\*/g,
    actual: (m) => m.parityTests,
    label: "e2e-parity 用例数",
  },
];

/*
  交接文档整篇有大量**历史**读数（`137 → 154 唯一行`、`131 → 133 场景-维度`），
  不能整篇扫。活着的那段是开头那个 blockquote，按**结构**取（连续的 `>` 行），
  不按行号取——行号会随每一轮追加而漂。
*/
function leadBlockquote(doc: string): string {
  const lines = doc.split("\n");
  const start = lines.findIndex((l) => l.startsWith(">"));
  if (start < 0) return "";
  let end = start;
  while (
    end < lines.length &&
    (lines[end]!.startsWith(">") || lines[end]!.trim() === "")
  )
    end += 1;
  return lines.slice(start, end).join("\n");
}

describe("计划文档里的台账读数和签入基线一致", () => {
  const measures = measureLedger();

  // 先钉住量法本身：这四个数必须都是正的，否则下面的全称断言在退化的读数上照样绿。
  it("量法本身有效", () => {
    expect(measures.scenarioDimensions).toBeGreaterThan(0);
    expect(measures.uniqueRows).toBeGreaterThan(0);
    expect(measures.multiset).toBeGreaterThanOrEqual(measures.uniqueRows);
    expect(measures.desktopDimensions).toBeGreaterThan(0);
    expect(measures.nonDesktopFamilies.length).toBeGreaterThan(0);
    expect(measures.i18nKeys).toBeGreaterThan(0);
    // 不同条数必然 ≤ 投影去重数；相等就说明去重键写错了。
    expect(measures.distinctRows).toBeGreaterThan(0);
    expect(measures.distinctRows).toBeLessThan(measures.uniqueRows);
    expect(measures.parityTests).toBeGreaterThan(measures.scenarioDimensions);
  });

  it("e2e-parity 的固定用例数常量还对得上调用点", () => {
    const sites = PARITY_FIXED_SPECS.reduce(
      (n, f) =>
        n +
        (read(`tests/e2e-parity/${f}.spec.ts`).match(/^\s*test\(/gm) ?? [])
          .length,
      0,
    );
    // 8 个调用点 → 9 条用例（topology 最后一个包在两项 for 里）。
    expect({ 调用点: sites, 常量: PARITY_FIXED_TESTS }).toEqual({
      调用点: 8,
      常量: 9,
    });
  });

  const SCOPES = [
    ["vue-parity-cold-start.md", (d: string) => d],
    ["vue-parity-handoff.md", leadBlockquote],
  ] as const;

  /** 每一类断言在整组文档里命中了几处。 */
  const hits = new Map(PLAN_CLAIMS.map((c) => [c.label, 0]));

  for (const [name, scope] of SCOPES) {
    it(`${name} 里每一处台账数字都是实测值`, () => {
      const doc = readPlanDoc(name);
      // `../docs/plans` 整个不在 checkout 里（模块被单独移走）→ 明确跳过。
      if (doc === null) return;
      const text = scope(doc);
      const wrong: string[] = [];
      let matched = 0;
      for (const claim of PLAN_CLAIMS) {
        for (const m of text.matchAll(claim.pattern)) {
          matched += 1;
          hits.set(claim.label, (hits.get(claim.label) ?? 0) + 1);
          const want = claim.actual(measures);
          if (Number(m[1]) !== want)
            wrong.push(`${claim.label}: 文档 ${m[1]} ≠ 实测 ${want}`);
        }
      }
      // 空集上恒真的陷阱：措辞一改，上面的循环一次都不跑，而这条用例仍然绿。
      expect({ doc: name, matched: matched > 0 }).toEqual({
        doc: name,
        matched: true,
      });
      expect(wrong).toEqual([]);
    });
  }

  /*
    上面那条 `matched > 0` 只关到**聚合层**：七类断言里有一类的措辞被改掉，
    总数仍然大于 0，那一类就**静默失守**——和它守得好好的长得一模一样。
    这条按类关：每一类都必须在这组文档里至少命中一处。
    （放在最后是因为它读的是上面两条填的计数；vitest 在一个 describe 内按序跑。）
  */
  /*
    **禁措辞，而不是比数值。**

    2026-09-16 体检实测：冷启动文档里「台账当前是多少」同时有三个数——
    开头那处 `159 唯一行 / 179 多重集 / 142 个场景-维度`（真，有上面那套断言守着）、
    棘轮那一节的 `202 行 / 90 样本`、「别忘了的三件事」的 `95 行 / 73 个取样点`。
    后两个都是十几轮前的旧数，而且**换了个措辞就绕过了上面所有正则**——
    门禁全绿，假数原地躺着。同一条棘轮的参照点被同时抬高和压低，
    新窗口拿哪个当基准，「涨了还是减了」的方向判断都会反过来。

    值比对只有在「每轮都记得更新这一处措辞」时才成立，而这次红的根因正是没人更新。
    所以这条钉的是**写法**：活读数只许用受控措辞（`N 唯一行` / `N 多重集` /
    `N 个场景-维度` / `N 条不同的差异`），`N 行 / N 样本`、`N 行 / N 个取样点`
    这两种旧写法在这两个扫描面里**一律非法**，除非紧邻显式的 wave / 轮次戳
    （历史记录要能留下来）。

    **它是「零命中才算绿」，和上面那套「至少命中一处」相反**，所以**不能挂进 `hits`**
    （挂进去会因为永远 0 命中而恒红）。为此下面配了一条自反测试：
    示例串写在**测试文件里**，不能写进被扫的那两份 md——否则守卫会把自己的
    说明文字报成违规（记忆 `deerflow-guard-strip-comments`，已踩四次）。
  */
  const STALE_LEDGER = /(\d+)\s*行\s*\/\s*(\d+)\s*个?\s*(?:样本|取样点)/g;
  /** 紧邻的轮次戳：往前看 26 个字符够覆盖「（wave 200 实测 」「（**wave 101 时是 」。 */
  const STAMP = /wave\s*\d+|第[一二三四五六七八九十百]+轮/;

  /** 返回违规片段；带轮次戳的放行。 */
  function staleLedgerHits(text: string): string[] {
    const out: string[] = [];
    for (const m of text.matchAll(STALE_LEDGER)) {
      const before = text.slice(Math.max(0, m.index - 26), m.index);
      if (!STAMP.test(before)) out.push(m[0]);
    }
    return out;
  }

  it("禁措辞这条判据自己会响（自反测试）", () => {
    expect(staleLedgerHits("台账当前是 95 行 / 73 个取样点")).toEqual([
      "95 行 / 73 个取样点",
    ]);
    expect(staleLedgerHits("parity-diff.json 当前 202 行 / 90 样本")).toEqual([
      "202 行 / 90 样本",
    ]);
    // 带戳的历史记录必须放行，否则没人能写变更史。
    expect(staleLedgerHits("（wave 200 实测 103 行 / 95 个取样点）")).toEqual(
      [],
    );
    expect(staleLedgerHits("第二十轮收工时 187 行 / 87 样本")).toEqual([]);
  });

  it("活读数不许用绕过受控措辞的旧写法", () => {
    const cold = readPlanDoc("vue-parity-cold-start.md");
    if (cold === null) return;
    const handoff = readPlanDoc("vue-parity-handoff.md");
    const offenders = [
      ...staleLedgerHits(cold).map((h) => `cold-start: ${h}`),
      ...(handoff ? staleLedgerHits(leadBlockquote(handoff)) : []).map(
        (h) => `handoff 活跃块: ${h}`,
      ),
    ];
    expect(
      offenders,
      "台账的活读数只许用 `N 唯一行` / `N 多重集` / `N 个场景-维度` / " +
        "`N 条不同的差异` 这一套受控措辞（它们有值比对守着）。" +
        "`N 行 / N 样本`、`N 行 / N 个取样点` 是没人守得到的旧写法——" +
        "要写变更史就在前面加 `wave N` 或 `第N轮` 的戳。",
    ).toEqual([]);
  });

  it("七类断言都还有活的命中点（逐类，不是总数）", () => {
    if (readPlanDoc("vue-parity-cold-start.md") === null) return;
    const dead = [...hits].filter(([, n]) => n === 0).map(([label]) => label);
    expect(
      dead,
      "这一类在两份文档里一处都没命中——要么那句话被改写了（跟进正则），" +
        "要么那个读数被删了（删掉这一类）。**别让它留在表里空转。**",
    ).toEqual([]);
  });

  /*
    光钉数字不够：`140 个里 118 个 desktop` 对了，而后面那份**族名单**还是旧的，
    这条用例照样绿——第十九轮实测就是这样，名单漏了 `artifact-preview`、
    `project-detail`、`scheduled-tasks` 三族。一道只守住一半的门禁，读起来
    和守全了一模一样。名单按结构取（`非 desktop 的 N 族逐字是：` 到句号），
    不按行号取。
  */
  it("冷启动文档列的非 desktop 场景族就是基线里的那几族", () => {
    const doc = readPlanDoc("vue-parity-cold-start.md");
    if (doc === null) return;
    const m = /非 desktop 的 (\d+) 族逐字是：([\s\S]*?)。/.exec(doc);
    // 措辞被改掉 → 这里必须红，而不是静默跳过。
    expect({ 找到名单: m !== null }).toEqual({ 找到名单: true });
    const listed = [...m![2]!.matchAll(/`([a-z0-9-]+)`/g)]
      .map((x) => x[1]!)
      .sort();
    expect({
      族数: Number(m![1]),
      名单: listed,
    }).toEqual({
      族数: measures.nonDesktopFamilies.length,
      名单: measures.nonDesktopFamilies,
    });
  });
});
