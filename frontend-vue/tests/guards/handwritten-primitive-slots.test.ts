/*
  【文件职责】     `data-slot` 里属于 primitive 的那些值，不许在 `app/components/ui/`
                   之外被手写出来。
  【架构位置】     门禁测试
  【主要导出】     无；Vitest 用例
  【依赖关系】     app/components/ui/**（slot 的声明方）· app/components/** · app/pages/**
  【边界与注意】   这是 `primitive-marker-classes` 的孪生：那条守的是**标记类**
                   （`peer/menu-button`），这条守的是**身份属性**（`data-slot`）。
                   两者都在答同一个问题——「谁在扮演那颗 primitive」——
                   只是扮演的方式有两种，而侧栏这一片两种都用过。

                   **为什么要有它（2026-09-12 第十二轮量出来的）**：
                   `ThreadSidebar.vue` 把侧栏那四颗菜单键摊平成了裸 `<a>`，
                   自己写上 `data-slot="sidebar-menu-button"` + 一串手抄的类。
                   逐 token 比下来，抄漏的是 `w-full` / `overflow-hidden` /
                   `outline-hidden ring-sidebar-ring focus-visible:ring-2`（**键盘焦点环**）/
                   `hover:text-sidebar-accent-foreground` / `active:*` /
                   `[&>span:last-child]:truncate`（**长标题不再截断**）/
                   `transition-[width,height,padding]`，
                   以及最关键的一条：`data-[active=true]:font-medium` 被抄成了
                   **无条件** `font-medium`（新建对话那颗），另外三颗干脆没有。
                   于是「当前这一项加粗」这件事，本仓是**反着**的。

                   **为什么台账没报**：`sidebar` 场景停在 `/workspace/chats/new`，
                   那一屏新建对话正好激活，本仓无条件的 500 与上游激活态的 500 撞上；
                   其余三行两边都不激活、都是 400。**四个锚点全对上，四颗按钮全抄漏。**
                   要让它现形得换一条路径（`agent-create-name-step`，见那个场景的注释）——
                   也就是说这类缺陷**长在哪里、哪里就得恰好有个锚点**，
                   与 `handwritten-variant-colors` 补的是同一个洞。

                   **判据为什么是「不许手写」而不是「必须抄全」**：
                   后者听起来更宽容，实际更糟——它把「抄一份」正当化，
                   然后要求每次改 primitive 的人同时去改所有抄本，
                   而这道守卫只在**下一次**跑的时候才告诉他漏了哪份。
                   不许手写则把漂移变成不可能。代价是零：写不了 `data-slot`
                   的地方就是该用 primitive 的地方。

                   **零豁免。** 这不是运气：`data-slot` 只有 primitive 自己该写，
                   而 `ui/` 里没有对应 primitive 的 slot 名（`input-group-*`、
                   `suggestions-list`、`ambilight`、`skeleton-*-message`……）
                   天然不在集合里——本仓没有那颗 primitive 时，手写是唯一的路。
                   哪天补上了那颗 primitive，这道门会当场把调用点报出来，
                   那正是要的行为。

                   **`data-sidebar` 不在这条判据里**：`ThreadSidebar.vue` 的外壳
                   （header / content / footer / rail）在 `ui/sidebar` 里**没有** primitive，
                   它们只能手写，而手写就得带上 `data-sidebar`——兄弟选择器按它定位。
                   那几处的类串比对由 wave 74 的判词管着，见 `primitive-marker-classes`。

                   注释先剥掉（坑 202 的第五次），并且只认**属性位**的 `data-slot`：
                   `[data-slot="scroll-area-viewport"]` 这种是**选择器**，是在「用」
                   别人的身份标签，不是在声明自己是谁。
*/

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const appDir = fileURLToPath(new URL("../../app", import.meta.url));
const uiDir = join(appDir, "components/ui");

/** 属性位的 `data-slot="x"`：前面必须是空白或 `:`（绑定），不能是 `[`（选择器）。 */
const SLOT_ATTR = /[\s:]data-slot="([a-z0-9-]+)"/g;

/** 注释剥成等长空白：行号不漂，剩下的才是真的模板。 */
function strip(source: string): string {
  const blank = (match: string) => match.replaceAll(/[^\n]/g, " ");
  return source
    .replaceAll(/<!--[\s\S]*?-->/g, blank)
    .replaceAll(/\/\*[\s\S]*?\*\//g, blank);
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith(".vue") || full.endsWith(".ts")) out.push(full);
  }
  return out;
}

/** `ui/` 里被声明出来的 slot 名——它们是 primitive 的身份标签。 */
function primitiveSlots(): Set<string> {
  const slots = new Set<string>();
  for (const file of walk(uiDir))
    for (const match of strip(readFileSync(file, "utf8")).matchAll(SLOT_ATTR))
      slots.add(match[1]!);
  return slots;
}

/** `ui/` 之外，属性位上写出来的 slot 名 → `文件:行`。 */
function handwritten(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const file of walk(appDir)) {
    if (file.startsWith(`${uiDir}/`)) continue;
    const source = strip(readFileSync(file, "utf8"));
    for (const match of source.matchAll(SLOT_ATTR)) {
      const line = source.slice(0, match.index).split("\n").length;
      const at = `${relative(appDir, file)}:${line}`;
      found.set(match[1]!, [...(found.get(match[1]!) ?? []), at]);
    }
  }
  return found;
}

describe("primitive 的 data-slot 只属于 primitive", () => {
  const slots = primitiveSlots();
  const mine = handwritten();

  /* 形状断言：正则写坏、目录写错都会让下面那条静默全绿（坑 176/195）。 */
  it("两头都扫到了东西", () => {
    expect(slots.size).toBeGreaterThan(50);
    expect(slots.has("sidebar-menu-button")).toBe(true);
    expect(slots.has("skeleton")).toBe(true);
    // 调用点确实也在写 data-slot，只是写的都是 ui/ 没有的那些。
    expect(mine.size).toBeGreaterThan(3);
  });

  it("选择器里的 `[data-slot=…]` 不算声明", () => {
    // 这两处是**用**别人的身份标签定位滚动父级，不是在扮演它。
    expect(mine.has("scroll-area-viewport")).toBe(false);
  });

  it("`ui/` 之外没有人手写 primitive 的 data-slot", () => {
    const offenders = [...mine]
      .filter(([slot]) => slots.has(slot))
      .flatMap(([slot, at]) => at.map((where) => `${where} → ${slot}`))
      .sort();
    expect(
      offenders,
      "写下 primitive 的 `data-slot` = 在扮演那颗 primitive，" +
        "而手抄的类串永远只抄一部分（第十二轮实测：侧栏菜单键抄漏了键盘焦点环、" +
        "长标题截断，还把「当前项加粗」抄成了无条件加粗）。" +
        "改成用那颗 primitive（`as-child` 套到链接上，样式留在调用点的 class）。",
    ).toEqual([]);
  });
});
