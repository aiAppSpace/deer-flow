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
                   `ui/sidebar` 的 cva 里有 `group-data-[collapsible=icon]:*!`，
                   而本仓的侧栏收起态不是 `data-collapsible` 而是
                   `useWorkspaceSidebar` 自己的 `collapsed` ref（外壳在
                   `ThreadSidebarShell.vue`，不在 `ui/` 里）。基类照抄上游、
                   那两条因此恒不成立——这是**已量过并写下判词**的死类，不是新债。
                   哪天侧栏换成 `data-collapsible`，把这一条从表里删掉。
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

/** X → 为什么这一条注定不成立。加一条之前先确认它**真的**不该成立。 */
const ALLOWED: Record<string, string> = {
  collapsible:
    "wave 74：本仓侧栏的收起态是 `useWorkspaceSidebar` 的 `collapsed` ref，" +
    "不是 `data-collapsible`；外壳在 ThreadSidebarShell.vue，不在 ui/ 里。" +
    "基类照抄上游，那两条 `group-data-[collapsible=icon]:*!` 因此恒不成立。",
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
