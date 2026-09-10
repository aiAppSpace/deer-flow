/*
  【文件职责】     `/workspace` 与 `/auth` 下的页面必须显式声明 layout。
  【架构位置】     门禁测试
  【主要导出】     无
  【依赖关系】     app/pages/**
  【边界与注意】   **漏写的后果是服务端渲染 500，而不是「外观不对」。**

                   Nuxt 的默认 layout 是营销页外壳（`app/layouts/default.vue`），
                   那里没有 workspace 的 toast owner。任何调 `useWorkspaceToast()`
                   的组件一挂上就抛 provider 缺失，SSR 阶段直接变成
                   「500 Internal Server Error: Workspace toast owner is not available」。

                   2026-09-10 实测：`/workspace/projects/[id]` 从建出来那天起就是坏的，
                   `make verify` 一路全绿——因为**没有任何测试访问过那条路由**，
                   直到它被加进对照取样面才当场露出来。

                   例外只有三个，都写在下面的 ROOT_LAYOUT_PAGES 里：营销首页和两个
                   M0 视觉夹具，它们要的就是 default。
*/

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const pagesDir = fileURLToPath(new URL("../../app/pages", import.meta.url));

/** 这几页要的就是 default layout。 */
const ROOT_LAYOUT_PAGES = new Set([
  "index.vue",
  "__m0/splitpanes.vue",
  "__m0/visual.vue",
]);

function pagesUnder(dir: string, prefix = ""): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = prefix ? `${prefix}/${entry}` : entry;
    if (statSync(full).isDirectory()) found.push(...pagesUnder(full, rel));
    else if (entry.endsWith(".vue")) found.push(rel);
  }
  return found;
}

const pages = pagesUnder(pagesDir);

describe("页面的 layout 都是显式声明的", () => {
  it("扫描面里确实有页面", () => {
    expect(pages.length).toBeGreaterThanOrEqual(8);
    // 例外名单里的每一条都得真的存在，否则它是过期条目。
    for (const page of ROOT_LAYOUT_PAGES) {
      expect(pages, `${page} 不在 app/pages 下了`).toContain(page);
    }
  });

  it("除三个例外之外，每一页都写了 definePageMeta 的 layout", () => {
    const missing = pages.filter((page) => {
      if (ROOT_LAYOUT_PAGES.has(page)) return false;
      const source = readFileSync(join(pagesDir, page), "utf8");
      return !/definePageMeta\(\{[^}]*layout\s*:/.test(source);
    });
    expect(
      missing.sort(),
      "漏写 layout 的页面会落到营销页外壳上——那里没有 workspace 的 toast owner，" +
        "调 useWorkspaceToast() 的组件一挂上就让 SSR 变成 500。",
    ).toEqual([]);
  });
});
