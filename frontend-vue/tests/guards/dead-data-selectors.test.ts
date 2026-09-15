/*
  【文件职责】     钉住「`ui/` 里写出来的 `data-[X]:` 选择器，X 真的会出现在 DOM 上」。
  【架构位置】     门禁测试
  【主要导出】     无；Vitest 用例
  【依赖关系】     app/components/ui/** · node_modules/reka-ui/dist（运行时属性的另一个来源）
  【边界与注意】   **一条写着却永远不成立的选择器，比没写更糟**：它让下一个人以为
                   这件事有人管。2026-09-12 第十五轮实测到一条真的——
                   三颗 dropdown primitive 的基类里都带着 `data-[inset]:pl-8`
                   （基类逐字照上游，`primitive-base-classes` 还盯着），
                   而本仓**没有任何出口能把 `data-inset` 打上去**：
                   `inset` 是 shadcn 层的 prop（`ui/dropdown-menu.tsx:74/156/212`），
                   reka 没有这个概念。补上那个 prop 之后这条才活。

                   **判据的两个来源缺一不可**：一个 `data-X` 可能由本仓的包装层写出来
                   （`data-slot` / `data-variant` / `data-size` …），也可能由 reka 在
                   **运行时**打上（`data-state` / `data-disabled` / `data-highlighted` /
                   `data-orientation` / `data-placeholder`）。只查前者会把后面这五个
                   全报成死选择器——那正是第一版量法犯的错（第十四轮的教训：
                   **正则看不见的那一半会被当成 0**）。所以第二个来源直接去
                   `node_modules/reka-ui/dist` 里查，而不是维护一张手抄的名单。

                   **唯一的豁免 `collapsible` 是 wave 74 判过的分歧**：
                   而本仓的侧栏收起态不是 `data-collapsible` 而是
                   `useWorkspaceSidebar` 自己的 `collapsed` ref（外壳在
                   `ThreadSidebarShell.vue`，不在 `ui/` 里）。基类照抄上游，
                   这些选择器因此恒不成立——已量过并写下判词，不是新债。

                   **第十九轮收紧了这条豁免的范围。** 在那之前它按**属性名**在
                   整棵 `ui/` 树上生效，而写下的理由只说了侧栏 cva 里「那两条」；
                   实测是 **6 处、跨 3 个文件**——`SidebarGroupLabel.vue`（收起时
                   把分组标题 `-mt-8 opacity-0` 藏掉）和 `SidebarMenuAction.vue`
                   （收起时 `hidden`）理由里一个字都没提，却一样被放过。
                   **豁免说的是 A，放过的是 A+B+C**。现在按「文件 → 处数」钉死：
                   多一处就红，逼着写清那一处为什么也该豁免。

                   **它盖住的那笔账，第二十轮在真实栈上量完了**：两边的收起机制
                   确实不同（上游 `data-collapsible=icon` + CSS，本仓
                   `collapsed` ref + `v-if="sidebarExpanded"`），**但可观察结果相同**
                   ——收起时两边的分组标题都从 DOM 里消失，四颗导航键的可访问名
                   逐字相同。`sidebar.tsx:415` 那两条 `opacity-0` 在这个应用里
                   走不到。场景 `sidebar-collapsed` 已经把这一态接进取样面，0 行。
*/

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const uiDir = fileURLToPath(
  new URL("../../app/components/ui", import.meta.url),
);
const rekaDist = fileURLToPath(
  new URL("../../node_modules/reka-ui/dist", import.meta.url),
);

/**
 * X → 为什么这一条注定不成立，**以及它到底盖住哪几处**。
 *
 * `sites` 是 `ui/` 下的相对路径 → 剥掉注释之后 `data-[X` 的处数，必须逐字相等：
 * 只写理由不写范围，下一个人会把豁免读成「这个属性名整棵树随便写」
 * （第十九轮实测就是这样：理由说「那两条」，实际放过 6 处、跨 3 个文件）。
 */
const ALLOWED: Record<string, { why: string; sites: Record<string, number> }> =
  {
    collapsible: {
      why:
        "wave 74：本仓侧栏的收起态是 `useWorkspaceSidebar` 的 `collapsed` ref，" +
        "不是 `data-collapsible`；外壳在 ThreadSidebarShell.vue，不在 ui/ 里。" +
        "基类照抄上游，`group-data-[collapsible=icon]:*` 因此恒不成立。",
      sites: {
        "sidebar/SidebarGroupLabel.vue": 2,
        "sidebar/SidebarMenuAction.vue": 1,
        "sidebar/menu-button-variants.ts": 3,
      },
    },
  };

function strip(source: string): string {
  const blank = (match: string) => match.replaceAll(/[^\n]/g, " ");
  return source
    .replaceAll(/<!--[\s\S]*?-->/g, blank)
    .replaceAll(/\/\*[\s\S]*?\*\//g, blank);
}

function walk(dir: string, exts: string[], out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, exts, out);
    else if (exts.some((ext) => entry.endsWith(ext))) out.push(full);
  }
  return out;
}

const uiSource = walk(uiDir, [".vue", ".ts"])
  .map((file) => strip(readFileSync(file, "utf8")))
  .join("\n");
const rekaSource = existsSync(rekaDist)
  ? walk(rekaDist, [".js"])
      .map((file) => readFileSync(file, "utf8"))
      .join("\n")
  : "";

/** 类串里被选择的 `data-[X]` / `data-[X=…]`。 */
const selected = new Set(
  [...uiSource.matchAll(/data-\[([a-z][a-z0-9-]*)[\]=]/g)].map((m) => m[1]!),
);
/** 本仓包装层自己写出来的 `data-X=`。 */
const emitted = new Set(
  [...uiSource.matchAll(/(?<![-\w])(?::)?data-([a-z][a-z0-9-]*)\s*=/g)].map(
    (m) => m[1]!,
  ),
);

describe("ui/ 里没有写着却永远不成立的 data 选择器", () => {
  /* 形状断言：任一来源读空都会让下面那条变成一片假红或假绿（坑 176/195）。 */
  it("三个来源都真的读到了东西", () => {
    expect(selected.size).toBeGreaterThan(8);
    expect(emitted.has("slot")).toBe(true);
    // reka 的产物没读到的话，`data-state` 这类会被整片报成死选择器。
    expect(rekaSource.length).toBeGreaterThan(100_000);
    expect(rekaSource).toContain("data-state");
  });

  it("每一条 data-[X] 都有人把 X 打到 DOM 上", () => {
    const dead = [...selected]
      .filter(
        (name) =>
          !emitted.has(name) &&
          !rekaSource.includes(`data-${name}`) &&
          !(name in ALLOWED),
      )
      .sort();
    expect(
      dead,
      "类串里选了这个 data 属性，而本仓的包装层不写它、reka 运行时也不打它——" +
        "**这条选择器永远不成立**。要么补上写它的出口（同 wave 205 的 `inset`），" +
        "要么进 ALLOWED 并写清为什么它注定不成立。",
    ).toEqual([]);
  });

  it("豁免盖住的处数就是表里写的那几处", () => {
    for (const [name, entry] of Object.entries(ALLOWED)) {
      const actual: Record<string, number> = {};
      for (const file of walk(uiDir, [".vue", ".ts"])) {
        const hits = [
          ...strip(readFileSync(file, "utf8")).matchAll(
            new RegExp(`data-\\[${name}[\\]=]`, "g"),
          ),
        ].length;
        if (hits) actual[file.slice(uiDir.length + 1)] = hits;
      }
      expect(
        actual,
        `豁免 \`${name}\` 写的范围和实际对不上。多出来的那几处**没有被任何理由` +
          "覆盖**——要么补进 sites 并说清它为什么也该豁免，要么把那处选择器修活。",
      ).toEqual(entry.sites);
    }
  });

  it("ALLOWED 里没有已经不需要的条目（双向）", () => {
    const stale = Object.keys(ALLOWED)
      .filter(
        (name) =>
          !selected.has(name) ||
          emitted.has(name) ||
          rekaSource.includes(`data-${name}`),
      )
      .sort();
    expect(stale, "这一条已经有人打了，或者已经没人选它——从表里删掉").toEqual(
      [],
    );
  });
});
