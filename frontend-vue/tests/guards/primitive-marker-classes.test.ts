/*
  【文件职责】     primitive 自己定义的那些 `peer/x` / `group/x` 标记类，
                   不许在 `app/components/ui/` 之外被手写出来。
  【架构位置】     门禁测试
  【主要导出】     无；Vitest cases
  【依赖关系】     app/components/ui/**（标记的定义方）· app/components/** · app/pages/**
  【边界与注意】   写下 `peer/menu-button` 等于宣称「我就是那颗 SidebarMenuButton」——
                   而**手抄的类串永远只抄了一部分**。实测就是这么坏的：
                   `ThreadSidebarItem.vue` 抄了 `data-[active=true]` 的背景色与前景色，
                   漏掉同一串里的 `data-[active=true]:font-medium`，于是**当前这条会话
                   在侧栏里不加粗**，而上游加粗。对照台账 `thread-title-sync` 上
                   `text:Renamed title fontWeight React=500 Vue=400` 报的就是它，
                   一起漏掉的还有键盘焦点环、`hover:text-*`、`active:*` 与过渡。

                   **判据是「标记类」而不是「整串基类」**，因为标记类是**兄弟
                   primitive 靠它定位**的那一个（`peer-data-[size=…]/menu-button`、
                   `group-has-data-[sidebar=menu-action]/menu-item`）：写下它的人一定
                   是在扮演那颗 primitive，没有第二种解释。整串基类比对是另一条守卫
                   （primitive-base-classes）的活，那条看的是 `ui/` 内部。

                   **引用不算定义**：`group-hover/menu-item:` / `peer-data-[…]/menu-button:`
                   这类是**用**别人的标记，形状上也不同（`group` 后面不是 `/`），
                   正则天然不收。

                   **双向**：`ALLOWED` 里有、实际没有的条目同样报错——过期豁免会被
                   下一个读者当成「这里还有活没干」（同 handwritten-button 的坑 186）。

                   **扫之前先剥注释**（坑 202 的第四次）：这条守卫写完当天就把
                   `WorkspaceChannelsList.vue` 头注释里那句「还留着一条死类
                   `group/menu-item`」报成了违规——说明文字被当成代码。
*/

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const appDir = fileURLToPath(new URL("../../app", import.meta.url));
const uiDir = join(appDir, "components/ui");

/**
 * 文件 → [标记类, 为什么这一处必须手写]。
 *
 * 加一条之前先回上游看那一处：上游走 primitive 的，本仓也要走。
 */
const ALLOWED: Record<string, [string, string][]> = {
  "components/workspace/ThreadSidebar.vue": [
    ["group/menu-item", "footer 那颗设置键的 li：与下面那颗按钮同一处例外。"],
    [
      "peer/menu-button",
      '上游是 `<DropdownMenuTrigger asChild><SidebarMenuButton size="lg">`，' +
        "而本仓的收起态不是 `data-collapsible=icon` 而是自己的 `collapsed` ref，" +
        "cva 里那两条 `group-data-[collapsible=icon]:*!` 永远不成立。" +
        "理由与实测数字写在该文件那段注释里（wave 74：React 32×32 / padding 0，" +
        "本仓当时 31×48 / padding 8）。",
    ],
  ],
};

const MARKER = /(?:peer|group)\/[a-z0-9-]+/g;

/** 注释剥成等长空白：行号不漂，剩下的才是真的类串。 */
function strip(source: string): string {
  const blank = (match: string) => match.replaceAll(/[^\n]/g, " ");
  return source
    .replaceAll(/<!--[\s\S]*?-->/g, blank)
    .replaceAll(/\/\*[\s\S]*?\*\//g, blank);
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (full.endsWith(".vue") || full.endsWith(".ts")) out.push(full);
  }
  return out;
}

/** `ui/` 里出现过的标记类——它们是 primitive 的身份标签。 */
function primitiveMarkers(): Set<string> {
  const markers = new Set<string>();
  for (const file of walk(uiDir)) {
    for (const match of strip(readFileSync(file, "utf8")).matchAll(MARKER)) {
      markers.add(match[0]);
    }
  }
  return markers;
}

describe("primitive 的标记类只属于 primitive", () => {
  const markers = primitiveMarkers();

  it("扫到了标记，也扫到了调用点（两边空掉时不能假绿）", () => {
    // 正则写坏、目录写错都会让下面那条用例静默全绿。
    expect(markers.size).toBeGreaterThan(3);
    expect(markers.has("peer/menu-button")).toBe(true);
  });

  it("`ui/` 之外没有人手写 primitive 的标记类", () => {
    const offenders: string[] = [];
    const seen = new Set<string>();
    for (const file of walk(appDir)) {
      if (file.startsWith(`${uiDir}/`)) continue;
      const key = relative(appDir, file);
      const allowed = new Set((ALLOWED[key] ?? []).map(([marker]) => marker));
      for (const match of strip(readFileSync(file, "utf8")).matchAll(MARKER)) {
        const marker = match[0];
        if (!markers.has(marker)) continue;
        seen.add(`${key} → ${marker}`);
        if (!allowed.has(marker)) offenders.push(`${key} → ${marker}`);
      }
    }
    expect(
      offenders,
      "手写 primitive 的标记类 = 手抄了它的基类，而手抄永远只抄一部分。" +
        "改成用那颗 primitive（`as-child` 套到链接/按钮上）；" +
        "确实非手写不可就进 ALLOWED，并写清上游那一处是什么。",
    ).toEqual([]);

    // 反向：过期豁免同样报错。
    const stale: string[] = [];
    for (const [key, entries] of Object.entries(ALLOWED)) {
      for (const [marker] of entries) {
        if (!seen.has(`${key} → ${marker}`)) stale.push(`${key} → ${marker}`);
      }
    }
    expect(stale, "ALLOWED 里的条目已经不存在了，删掉它").toEqual([]);
  });
});
