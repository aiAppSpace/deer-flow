/*
  【文件职责】     钉住「构建产物预算的桶」与「chunk 命名规则」一一对应。
  【架构位置】     门禁测试
  【主要导出】     无
  【依赖关系】     config/client-chunk-file-name.ts · scripts/asset-budget.mjs
  【边界与注意】   **这里钉的是对应关系，不是字节数。** 字节数在
                   `scripts/asset-budget.mjs` 里，改它要写实测值和日期。

                   **为什么不钉「每个 vendor-X chunk 里真的有 X」**：做不到，
                   wave 66 实测过两轮。chunk 名字由 `clientChunkFileName` 决定，
                   判据是**chunk 里任意一个模块 id 命中**；Rollup 把 vendor 与
                   产品代码 co-locate，于是名字只取自其中一个模块。
                   收窄种子之前（带着 lucide/cva/clsx/tailwind-merge）24 个
                   `vendor-ui` chunk 里最大的两个一个匹配包都不含；收窄成
                   `reka-ui|splitpanes` 之后剩 10 个，**仍有 4 个两个标记都搜不到**。
                   **所以「桶 = 谁的字节」这个说法从来就立不住**，
                   asset-budget.mjs 的注释已经改掉。

                   **能钉的是这条**：预算里出现的每个桶，命名规则里必须有它；
                   命名规则里产出的每个 `vendor-*` 名字，预算里必须有它。
                   一个桶悄悄消失（比如有人改了正则、再也没有 chunk 叫这个名字）时，
                   它的预算会**永远是绿的**——那正是最难发现的一种失效：
                   `0 chunks raw 0 KiB` 恒小于任何预算（同线索 176）。
*/

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { clientChunkFileName } from "../../config/client-chunk-file-name";

const read = (rel: string) =>
  readFileSync(fileURLToPath(new URL(`../../${rel}`, import.meta.url)), "utf8");

const nuxtConfig = read("config/client-chunk-file-name.ts");
const budgetScript = read("scripts/asset-budget.mjs");

/** `clientChunkFileName` 会产出的每个 `vendor-*` 名字。 */
function namedBuckets(): string[] {
  return [
    ...new Set(
      [
        ...nuxtConfig.matchAll(/"_nuxt\/(vendor-[a-z0-9-]+)-\[hash\]\.js"/g),
      ].map((match) => match[1] as string),
    ),
  ].sort();
}

/** `scripts/asset-budget.mjs` 的 `budgets` 里出现的每个桶。 */
function budgetedBuckets(): string[] {
  const block = /const budgets = \{([\s\S]*?)\n\};/.exec(budgetScript);
  if (!block) throw new Error("asset-budget.mjs 里找不到 budgets 定义");
  return [
    ...new Set(
      [...block[1]!.matchAll(/^\s*"(vendor-[a-z0-9-]+)":/gm)].map(
        (match) => match[1] as string,
      ),
    ),
  ].sort();
}

describe("构建产物预算的桶与 chunk 命名规则", () => {
  const named = namedBuckets();
  const budgeted = budgetedBuckets();

  /*
    **不是「数一数够不够多」，是「有没有漏解析」。** 第一版的正则写成
    `vendor-[a-z-]+`——不匹配数字，于是 **`vendor-i18n` 两边一起被漏掉**，
    集合照样相等、门禁照样绿。**一个漏解析的条目和一个不存在的条目长得一模一样**
    （线索 176）。所以这里拿一个**独立口径**去对：数一数源文件里出现过多少个
    `_nuxt/vendor-` 与多少行 `"vendor-…":`，必须与解析出来的条数相等。
  */
  it("形状先断言：没有条目被正则悄悄漏掉", () => {
    const namedOccurrences = (nuxtConfig.match(/"_nuxt\/vendor-/g) ?? [])
      .length;
    expect(named.length, "命名规则里有 vendor-* 没被解析出来").toBe(
      namedOccurrences,
    );

    const budgetBlock = /const budgets = \{([\s\S]*?)\n\};/.exec(budgetScript);
    const budgetOccurrences = (budgetBlock?.[1]?.match(/^\s*"vendor-/gm) ?? [])
      .length;
    expect(budgeted.length, "预算里有 vendor-* 没被解析出来").toBe(
      budgetOccurrences,
    );

    // 一个必然存在的哨兵：正则整体失灵时上面两条会同为 0 而相等。
    expect(named).toContain("vendor-i18n");
    expect(budgeted).toContain("vendor-i18n");
  });

  it("逐个一一对应", () => {
    expect(
      budgeted,
      "命名规则会产出的桶与预算里的桶必须逐字相同——" +
        "少一个桶时它的预算恒绿（0 chunks 小于任何数字），是最难发现的失效",
    ).toEqual(named);
  });

  it("vendor-ui 的种子保持收窄，别再放回那几个到处都在的工具包", () => {
    /*
      lucide-vue-next / class-variance-authority / clsx / tailwind-merge
      几乎每个组件都 import，把它们当种子会让任何产品 chunk 都被叫成 vendor-ui
      ——wave 66 之前就是这样，于是 asset-budget 长期红着而红的原因和注释对不上。
    */
    for (const prefix of [
      "/repo/node_modules/",
      "/repo/node_modules/.pnpm/reka-ui@2.10.1/node_modules/",
    ]) {
      expect(
        clientChunkFileName({
          name: "product",
          moduleIds: [`${prefix}reka-ui/dist/index.js`],
        }),
      ).toBe("_nuxt/vendor-ui-[hash].js");
    }
    for (const seed of [
      "lucide-vue-next",
      "class-variance-authority",
      "clsx",
      "tailwind-merge",
      "splitpanes",
      "reka-ui-extra",
    ]) {
      expect(
        clientChunkFileName({
          name: "product",
          moduleIds: [
            `/repo/node_modules/.pnpm/package@1/node_modules/${seed}/index.js`,
          ],
        }),
        `${seed} 不该再作为 vendor-ui 的种子`,
      ).toBe("_nuxt/product-[hash].js");
    }
  });
});
