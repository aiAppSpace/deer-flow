/*
  【文件职责】     菜单项里的图标不许自己写尺寸。
  【架构位置】     门禁测试
  【主要导出】     无
  【依赖关系】     app/components/**（不含 ui/）
  【边界与注意】   `DropdownMenuItem` 的基类里有
                   `[&_svg:not([class*='size-'])]:size-4`——**16px 是默认值**。
                   调用点再写 `:size="14"` 不是「明确一下」，而是把它覆盖成小 2px。

                   这是历史遗留的形状：wave 75 把 `size-4` 补进 primitive 之前，
                   每个调用点确实得自己写；补完之后那些 `:size` 就成了主动覆盖。
                   2026-09-10 清掉 `ThreadActionsMenu.vue` 里最后 8 处。

                   `icon-parity.mjs` 看不见这一类：它只报「两边完全不相交」的尺寸，
                   而 14 和 16 在全仓都用得到。

                   触发键上的 `:size` 不在此列——那不是菜单项。
*/

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const componentsDir = fileURLToPath(
  new URL("../../app/components", import.meta.url),
);

/** 这些标签的**直接内容**里，图标应当继承 primitive 的默认尺寸。 */
const MENU_ITEM_TAGS = [
  "DropdownMenuItem",
  "DropdownMenuSubTrigger",
  "DropdownMenuRadioItem",
  "DropdownMenuCheckboxItem",
] as const;

function sfcsUnder(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      // primitive 自己的实现不在此列。
      if (entry === "ui") continue;
      found.push(...sfcsUnder(full));
    } else if (entry.endsWith(".vue")) {
      found.push(full);
    }
  }
  return found;
}

const files = sfcsUnder(componentsDir);

describe("菜单项里的图标尺寸", () => {
  it("扫描面里确实有 SFC", () => {
    expect(files.length).toBeGreaterThanOrEqual(50);
  });

  it("没有哪个菜单项里的图标自己写死了尺寸", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      const template = /<template>([\s\S]*)<\/template>/.exec(source)?.[1];
      if (!template) continue;
      const markup = template.replaceAll(/<!--[\s\S]*?-->/g, "");
      for (const tag of MENU_ITEM_TAGS) {
        for (const open of markup.matchAll(new RegExp(`<${tag}\\b`, "g"))) {
          const close = markup.indexOf(`</${tag}>`, open.index);
          if (close < 0) continue;
          const block = markup.slice(open.index, close);
          for (const hit of block.matchAll(/:size="(\d+)"/g)) {
            offenders.push(
              `${file.slice(componentsDir.length + 1)} <${tag}> :size="${hit[1]}"`,
            );
          }
        }
      }
    }
    expect(
      [...new Set(offenders)].sort(),
      "DropdownMenuItem 的基类已经给了 size-4（16px）；调用点再写 :size 是把它" +
        "覆盖成别的值。要改尺寸就改 primitive，不要在调用点各写各的。",
    ).toEqual([]);
  });
});
