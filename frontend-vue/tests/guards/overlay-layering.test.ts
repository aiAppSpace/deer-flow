/*
  【文件职责】     portal 浮层的层级只有两档，且哪一档归谁是写死的。
  【架构位置】     守卫
  【主要导出】     无；vitest 用例
  【依赖关系】     app/components/ui/**（渲染 reka `*Portal` 的组件）
  【边界与注意】   `ARCHITECTURE.md:102` 写着一句当规则用的话：

                     所有 portal 浮层共用 `z-80` 一层，谁后打开谁在上；
                     只有 tooltip 用 `z-90`。

                   **wave 154 实测：这句话是真的，而守着它的机器是 0 台**
                   （全仓提到 `z-80` 的只有一条 e2e 注释，在解释「本仓 z-80、
                   React z-50 是有意不同」，不是守卫）。与 wave 153 那条
                   「`ui/` 是唯一的交互控件底座」同一形状：**正确但没人守的规则，
                   和错的规则只差一次改动**。

                   层级一旦被谁悄悄抬高，症状是「某个浮层盖住了它不该盖的东西」
                   ——而那种缺陷在对照台账上**几乎照不出来**：几何档量的是锚点自己的
                   盒子，`hit` 档只在锚点中心取一次，两个应用各自内部一致时都是 0 行。

                   **判据为什么不写成「`ui/` 里的 z 值集合 == {80, 90}」**：
                   实测 `ToggleGroupItem.vue` 有两处 `z-10`，那是同组按钮之间的
                   层叠、**不是 portal 浮层**。写成值集合就得配一张豁免表，
                   而需要豁免表说明判据选错了（坑 180）。所以扫描面按**行为**收口：
                   「渲染了 reka `*Portal` 的组件」。

                   两个方向都查：portal 组件必须落在正确的那一档（正向），
                   `z-90` 在整个 `ui/` 里只能是 tooltip（反向）。
                   只查正向的话，别的组件偷偷用 `z-90` 是看不见的。
*/

import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { stripComments } from "../../scripts/lib/strip-comments.mjs";

const uiDir = fileURLToPath(
  new URL("../../app/components/ui", import.meta.url),
);

/** tooltip 那一档的唯一持有者。文档里点名的就是它。 */
const TOOLTIP = "tooltip/TooltipContent.vue";

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (extname(full) === ".vue") out.push(full);
  }
  return out;
}

/** 剥掉注释再看——否则解释这条规则的文字会被算成违规（坑 202）。 */
function codeOf(file: string): string {
  return stripComments(readFileSync(file, "utf8"), ["line", "block", "html"]);
}

const Z_CLASS = /(?<![\w-])z-\[?(\d+)\]?/g;
/** reka 的 portal 组件名都是 `<XxxPortal>`。 */
const PORTAL_TAG = /<([A-Z][A-Za-z]*Portal)\b/;

const files = walk(uiDir).map((file) => ({
  rel: relative(uiDir, file),
  code: codeOf(file),
}));

const portals = files.filter((file) => PORTAL_TAG.test(file.code));
const zValues = (code: string) =>
  [...new Set([...code.matchAll(Z_CLASS)].map((match) => match[1]!))].sort();

describe("portal 浮层的层级只有两档", () => {
  it("扫描面不是空的（尺子先量自己）", () => {
    /*
      正则或路径写坏会让下面两条静默全绿（坑 131）。
      实测 wave 154：8 份组件渲染 Portal。阈值留一点余量。
    */
    expect(files.length).toBeGreaterThan(60);
    expect(portals.length).toBeGreaterThanOrEqual(8);
    expect(portals.map((file) => file.rel)).toContain(TOOLTIP);
  });

  it("每个 portal 组件恰好一个层级，tooltip 是 90、其余是 80", () => {
    const wrong = portals
      .map((file) => ({ rel: file.rel, z: zValues(file.code) }))
      .filter(
        (row) =>
          row.z.length !== 1 ||
          row.z[0] !== (row.rel === TOOLTIP ? "90" : "80"),
      );
    expect(
      wrong,
      "portal 浮层共用 z-80 一层（谁后打开谁在上），只有 tooltip 用 z-90——" +
        "见 ARCHITECTURE.md 的「模态语义与层级」。要改层级就先改那句话。",
    ).toEqual([]);
  });

  it("反方向：`z-90` 在整个 ui/ 里只能是 tooltip", () => {
    /*
      只查正向的话，别的组件偷偷抬到 `z-90` 是看不见的——而那正是这条规则
      会被破坏的方式：某个浮层被别的盖住了，就地抬一档最省事。
    */
    const holders = files
      .filter((file) => zValues(file.code).includes("90"))
      .map((file) => file.rel);
    expect(holders).toEqual([TOOLTIP]);
  });
});
