/*
  【文件职责】     面包屑的「可链接段」表与真实路由**双向**对账。
  【架构位置】     门禁测试
  【主要导出】     无
  【依赖关系】     app/core/workspace-shell/breadcrumb.ts · app/pages/workspace/
  【边界与注意】   这张表是手写的，而它承诺的是一件**文件系统上的事实**：
                   `/workspace/<段>` 这条路由存不存在。两者一漂，面包屑就把人送去 404
                   ——而 404 页不会让任何测试变红，它只是用户点下去以后的一个惊喜。

                   实测就是这么坏的：`projects` 当初被无条件做成链接，
                   而 `app/pages/workspace/projects/` 下只有 `[id].vue`。
                   对照台账在 `project-detail` 上抓到（上游那一节是
                   `link "Projects" [disabled]`，本仓是带 url 的真链接）。

                   **双向**：表里的段必须有路由（否则送去 404），有 index 路由的段
                   也必须在表里（否则明明能点却被渲染成不可点的当前页）。
                   单向只挡一半，而漏掉的那一半同样是用户看得见的。
*/

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { LINKABLE_SECTIONS } from "@/core/workspace-shell/breadcrumb";

const workspacePages = fileURLToPath(
  new URL("../../app/pages/workspace", import.meta.url),
);

/**
 * `/workspace/<段>` 真的能到达的那些段。Nuxt 两种写法都算：
 * `<段>/index.vue`（目录 + index）和 `<段>.vue`（单文件路由）。
 */
function routableSections(): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(workspacePages, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (existsSync(join(workspacePages, entry.name, "index.vue"))) {
        found.push(entry.name);
      }
    } else if (entry.name.endsWith(".vue") && entry.name !== "index.vue") {
      found.push(entry.name.slice(0, -".vue".length));
    }
  }
  return found.sort();
}

describe("面包屑可链接段与真实路由对账", () => {
  const routable = routableSections();

  it("形状先断言：两边都扫到了东西", () => {
    // 少了这条，`readdirSync` 指错目录就会在空集上恒绿。
    expect(routable.length).toBeGreaterThanOrEqual(3);
    expect(Object.keys(LINKABLE_SECTIONS).length).toBeGreaterThanOrEqual(3);
    // 而且真的存在「有目录、但没有 index 路由」的段——否则这条门禁守的是空气。
    const dirsWithoutIndex = readdirSync(workspacePages, {
      withFileTypes: true,
    })
      .filter(
        (entry) =>
          entry.isDirectory() &&
          !existsSync(join(workspacePages, entry.name, "index.vue")),
      )
      .map((entry) => entry.name);
    expect(dirsWithoutIndex.length).toBeGreaterThanOrEqual(1);
  });

  it("表里的每一段都真的有路由——否则面包屑把人送去 404", () => {
    expect(Object.keys(LINKABLE_SECTIONS).sort()).toEqual(
      Object.keys(LINKABLE_SECTIONS)
        .filter((section) => routable.includes(section))
        .sort(),
    );
  });

  it("有路由的每一段都在表里——否则能点的被渲染成点不动的当前页", () => {
    expect(routable).toEqual(
      routable.filter((section) => section in LINKABLE_SECTIONS),
    );
  });
});
