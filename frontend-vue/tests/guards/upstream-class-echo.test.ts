/*
  【文件职责】     钉住几处「照抄上游 class 串」的可感知细节。
  【架构位置】     守卫
  【主要导出】     无；vitest 用例
  【依赖关系】     app/components/**
  【边界与注意】   这一份收的是**没有别的守卫盯着**的那几条：它们既不是图标、
                   也不是可访问名，改掉之后 aria 快照、对照台账、几何档、
                   单测一样都不会红——wave 72 的负向验证当场撞出两处假绿
                   （TodoList 的行高与光标、sidebar rail 的光标方向）。

                   **钉源码串而不是渲染读数**，因为这几处要么挂在很重的组件上
                   （ThreadSidebar），要么只在某个状态下才出现。代价写在这里：
                   它只保证「没人手滑删掉」，不保证「渲染出来真是那样」——
                   后者要靠 parity 探针（坑 204）。

                   **每一条都先剥注释再找**（坑 202）：这一节的说明文字里
                   逐字引用着要找的那些 class 名，不剥的话把 class 从元素上删掉、
                   断言照样绿。wave 72 在另一份守卫里刚踩过这一次。
*/

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const appDir = fileURLToPath(new URL("../../app", import.meta.url));

function stripped(relativePath: string): string {
  return readFileSync(`${appDir}/${relativePath}`, "utf8")
    .replaceAll(/<!--[\s\S]*?-->/g, "")
    .replaceAll(/\/\*[\s\S]*?\*\//g, "");
}

/** 找到含有 `needle` 的那一个开标签，返回它的静态 class 串。 */
function classOfTagContaining(source: string, needle: string): string {
  const tag = new RegExp(
    `<[a-zA-Z][^>]*${needle.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^>]*>`,
    "s",
  ).exec(source)?.[0];
  expect(tag, `找不到含 ${needle} 的标签`).toBeDefined();
  return /\bclass="([^"]*)"/.exec(tag!)?.[1] ?? "";
}

describe("照抄上游的 class 串", () => {
  /*
    上游 todo-list.tsx:45 那一层是
    `bg-accent flex min-h-8 shrink-0 cursor-pointer items-center justify-between
     px-4 text-sm transition-all duration-300 ease-out`。
    本仓原来是 `min-h-9` 且**没有 cursor-pointer**：整条头比上游高 4px，
    鼠标停在上面还是箭头（Tailwind 4 的 preflight 不给按钮小手，坑 206）。
  */
  it("TodoList 的折叠头是 min-h-8 + cursor-pointer + 300ms 过渡", () => {
    const source = stripped("components/workspace/TodoList.vue");
    const header = classOfTagContaining(source, "collapsed = !collapsed").split(
      /\s+/,
    );
    for (const token of [
      "min-h-8",
      "cursor-pointer",
      "transition-all",
      "duration-300",
      "ease-out",
    ]) {
      expect(header, `TodoList 折叠头少了 ${token}`).toContain(token);
    }
    expect(header).not.toContain("min-h-9");
  });

  /*
    上游 ui/sidebar.tsx:301 的 SidebarRail 有两条互斥的光标：展开时
    `cursor-w-resize`（往左＝收起），收起时 `cursor-e-resize`（往右＝展开）。
    本仓原来写死 `cursor-w-resize`——侧栏已经最窄了，鼠标还在说「往左拖」。
    wave 72 探针实测：同一屏 React 是 e-resize、本仓是 w-resize。
  */
  it("侧栏 rail 的光标随收起态翻向", () => {
    const source = stripped("components/workspace/ThreadSidebar.vue");
    const rail = /<button\b[^>]*data-sidebar="rail"[^>]*>/s.exec(source)?.[0];
    expect(rail, "找不到 sidebar rail").toBeDefined();
    expect(rail).toContain("cursor-e-resize");
    expect(rail).toContain("cursor-w-resize");
    // 静态 class 里不许再写死方向，否则动态那条被 twMerge 之外的顺序吃掉。
    expect(/\bclass="([^"]*)"/.exec(rail!)?.[1] ?? "").not.toMatch(
      /cursor-[ew]-resize/,
    );
  });

  /*
    **上游给了图标的按钮，本仓不许只有文字。**

    这一条 `icon-parity` 盯不住：它比的是**全仓的图标集合**与按文件的尺寸，
    而 Bell / Sparkles 在别处也用着，从这两个面板上删掉之后集合一点没变。
    wave 71 在 channels 上撞过同一类（四颗键一颗图标都没有），
    wave 72 在设置面板上又撞到三颗。

    上游出处：notification-settings-page.tsx:71 / :85 各一颗
    `<BellIcon className="mr-2 size-4" />`；skill-settings-page.tsx:95 是
    `<SparklesIcon className="size-4" />`。
  */
  it("设置面板里上游有图标的三颗键都带着图标", () => {
    const notification = stripped(
      "components/workspace/settings/NotificationSettings.vue",
    );
    expect(
      [...notification.matchAll(/<Bell class="mr-2 size-4" \/>/g)],
      "通知设置的两颗键各要一颗 BellIcon",
    ).toHaveLength(2);

    const skills = stripped("components/workspace/settings/SkillSettings.vue");
    expect(skills).toContain('<Sparkles class="size-4" />');
  });

  /*
    **toast 的尺寸逐条抄 sonner 的 CSS**，不是随手挑的 Tailwind 档位。
    出处是 `sonner/dist/index.mjs` 里 `[data-sonner-toast][data-styled=true]`：
    `padding:16px; font-size:13px; gap:6px; align-items:center;
     box-shadow:0 4px 12px rgba(0,0,0,.1); width:var(--width)`（`TOAST_WIDTH=356`），
    外层 `VIEWPORT_OFFSET=24px`、`GAP=14`。
    wave 74 两个应用同屏实测过一次：本仓原来是 420 宽 / `px-4 py-3` / 14px 字 /
    12px 间距 / `items-start` / `shadow-lg` / `top-3` / `gap-2`——**每一条都不一样**。

    错误态**不**染红边框：sonner 不按类型改边框色（那是 `richColors` 的行为，
    上游没开），类型由图标表达。
  */
  it("toast 的尺寸抄的是 sonner 的那一串", () => {
    const source = stripped("components/workspace/WorkspaceToaster.vue");
    const item = classOfTagContaining(
      source,
      'v-for="item in toast.toasts',
    ).split(/\s+/);
    for (const token of [
      "p-4",
      "text-[13px]",
      "gap-1.5",
      "items-center",
      "shadow-[0_4px_12px_rgba(0,0,0,0.1)]",
    ]) {
      expect(item, `toast 少了 ${token}`).toContain(token);
    }
    expect(item).not.toContain("items-start");
    expect(source).not.toContain("border-destructive/40");

    const list = classOfTagContaining(
      source,
      'data-testid="workspace-toaster"',
    ).split(/\s+/);
    expect(list).toContain("w-[min(92vw,356px)]");
    expect(list).toContain("top-6");
    expect(list).toContain("gap-[14px]");

    /* sonner 的 `--toast-icon-margin-start:-3px` / `-end:4px`。 */
    const icon = classOfTagContaining(source, "KIND_ICON[item.kind]").split(
      /\s+/,
    );
    expect(icon).toContain("-ml-[3px]");
    expect(icon).toContain("mr-1");
  });

  /*
    **侧栏底部那颗触发器收起时换尺寸，不是只换内容。**
    上游 SidebarMenuButton 的 cva：base 里 `group-data-[collapsible=icon]:size-8!`，
    lg 档里 `group-data-[collapsible=icon]:p-0!`——收起时是一颗 32×32、内边距 0 的方钮。
    本仓的收起态走自己的 `collapsed` ref，那两条选择器永远不成立。
    wave 74 同屏实测：React 32×32 / padding 0，本仓 31×48 / padding 8，**高出 16px**。
  */
  it("侧栏底部触发器收起态是 32×32、内边距 0", () => {
    const source = stripped("components/workspace/ThreadSidebar.vue");
    const tag =
      /<button\b[^>]*data-testid="workspace-nav-menu-trigger"[^>]*>/s.exec(
        source,
      )?.[0];
    expect(tag, "找不到侧栏底部触发器").toBeDefined();
    // 尺寸走 :class 的两支，不是写死在 class 里。
    expect(/\bclass="([^"]*)"/.exec(tag!)?.[1] ?? "").not.toMatch(
      /\b(h-12|p-2|w-full)\b/,
    );
    expect(tag).toContain("h-12 w-full p-2");
    expect(tag).toContain("size-8 shrink-0 p-0");
  });

  /*
    **图标选得对不对，只有源码看得见。**

    这几条全是 `icon-parity` 的字形/尺寸档报出来、wave 75 逐条回源码核实的真差异。
    它们一样都不进可访问性树（图标是装饰）、也不改几何，
    所以对照台账、`dom-parity`、视觉基线三样全绿——而用户看到的是另一颗图标。

    钉源码而不是渲染：这几处要么在下拉菜单里（要展开才在树上），
    要么在设置面板深处，单独 mount 的成本远大于它挡住的回归。
  */
  it("这几处画的是上游那一颗图标", () => {
    // web_fetch：上游 message-group.tsx:797 是 GlobeIcon(=Globe)，不是 Globe2(=Earth)。
    const toolStep = stripped("components/chat/ProcessingToolStep.vue");
    expect(toolStep).toContain('if (name.value === "web_fetch") return Globe;');
    expect(toolStep).not.toContain("Globe2");

    // 引用面板：上游 citation-sources-panel.tsx:40 是 BookOpenTextIcon，不是 Library。
    const citations = stripped("components/chat/CitationSourcesPanel.vue");
    expect(citations).toContain("<BookOpenText");
    expect(citations).not.toContain("Library");

    // 置顶菜单项按状态换图标（上游 recent-chat-list.tsx:370）。
    const menu = stripped("components/workspace/ThreadActionsMenu.vue");
    expect(menu).toContain("pinned ? PinOff : Pin");

    // 单选指示器是 8px 实心圆点，不是对勾（上游 ui/dropdown-menu.tsx:136）。
    const radio = stripped(
      "components/ui/dropdown-menu/DropdownMenuRadioItem.vue",
    );
    expect(radio).toContain('<Circle class="size-2 fill-current"');
    expect(radio).not.toContain("<Check");

    // 渠道状态是带图标的 Badge（上游 channels-settings-page.tsx:181）。
    const channels = stripped(
      "components/workspace/channels/ChannelConnections.vue",
    );
    expect(channels).toContain("<CircleCheck");
    expect(channels).toContain("<CircleAlert");
    expect(channels).toContain("<Badge");
  });

  /*
    **菜单项里的图标尺寸与颜色归 primitive，不归调用点。**
    上游 `ui/dropdown-menu.tsx` 的三份 cva 都带
    `[&_svg:not([class*='size-'])]:size-4` 与
    `[&_svg:not([class*='text-'])]:text-muted-foreground`。
    本仓此前一条都没有，于是每个调用点自己写 `:size="14"`——比上游小 2px，
    颜色也没变灰。wave 75 补进 primitive 之后，侧栏那六颗改回裸标签。
  */
  it("下拉菜单项自带图标的尺寸与颜色", () => {
    for (const f of [
      "components/ui/dropdown-menu/DropdownMenuItem.vue",
      "components/ui/dropdown-menu/DropdownMenuRadioItem.vue",
      "components/ui/dropdown-menu/DropdownMenuSubTrigger.vue",
    ]) {
      const src = stripped(f);
      expect(src, `${f} 少了图标默认尺寸`).toContain(
        "[&_svg:not([class*='size-'])]:size-4",
      );
      expect(src, `${f} 少了 shrink-0`).toContain("[&_svg]:shrink-0");
    }
    for (const f of [
      "components/ui/dropdown-menu/DropdownMenuItem.vue",
      "components/ui/dropdown-menu/DropdownMenuSubTrigger.vue",
    ]) {
      expect(stripped(f), `${f} 少了图标的 muted 颜色`).toContain(
        "[&_svg:not([class*='text-'])]:text-muted-foreground",
      );
    }
    // 侧栏那六颗不再自己写尺寸。
    expect(stripped("components/workspace/ThreadSidebar.vue")).not.toContain(
      ':size="14"',
    );
  });

  /*
    **wave 76 把几何档接到交互后的锚点上，当场量出来的两处颜色差。**
    对照台账本身就在守它们（重新画上去 `e2e-parity` 会红），
    但那一跑要 3.8 分钟；这两条钉在源码上，改坏时秒级就红。
  */
  it("sidecar 面板根不画底色，推理档位按选中态染色", () => {
    // 上游 sidecar-panel.tsx:527 一条 bg-* 都没有；底色由外层容器给。
    const sidecar = stripped("components/workspace/sidecar/SidecarPanel.vue");
    const root = classOfTagContaining(sidecar, 'data-testid="sidecar-panel"');
    expect(root.split(/\s+/)).not.toContain("bg-background");
    expect(root).not.toMatch(/\bbg-/);

    /*
      上游 input-box.tsx:2597 每一项都传
      `选中 ? "text-accent-foreground" : "text-muted-foreground/65"`
      ——**没选中的几档是暗的**。本仓原来一项都不染，四档看起来一模一样。
    */
    const composer = stripped("components/chat/ChatComposer.vue");
    expect(composer).toContain("selectedReasoningEffort === effort.id");
    expect(composer).toContain("text-muted-foreground/65");
  });

  /*
    **footer 那颗设置键是全仓唯一一处「有判词的手抄 primitive」**（wave 74）：
    上游是 `<DropdownMenuTrigger asChild><SidebarMenuButton size="lg">`，
    而本仓手写一个 `<button>`，理由写在 `ThreadSidebar.vue` 那段注释里
    （坑 62：两层 as-child 之后留在 DOM 上的 `data-slot` 是最外层那个；
    收起态本仓走自己的 `sidebarExpanded` 分支而不是 `data-collapsible`）。

    **手抄就会抄漏，这一处抄漏了 8 条**（2026-09-12 第十七轮量出来）：
    `outline-hidden` / `ring-sidebar-ring` / `focus-visible:ring-2`
    ——**这颗按钮没有键盘焦点环，而上游有**；
    `transition-[width,height,padding]`（展开/收起不过渡）、
    `active:*` 两条、`data-[state=open]:hover:*` 两条。
    与第十二轮修掉的那四颗导航键**同一个根因、同一份 cva**——
    那一轮跳过这一颗是因为 wave 74 的豁免，而**那条豁免说的是
    `peer/menu-button` 与收起态尺寸，不是焦点环**。

    所以这一条把它**逐条对着 cva 比**，只放过下面那几条**在本仓结构下哑掉**的，
    每一条写清为什么哑。判据落在 cva 上而不是一份手抄的期望串：
    primitive 改了变体，这里自己跟着变。
  */
  it("footer 设置键逐条覆盖 SidebarMenuButton 的 cva（除了哑掉的那几条）", () => {
    const cva = stripped("components/ui/sidebar/menu-button-variants.ts");
    const tokens = (pattern: RegExp) =>
      (pattern.exec(cva)?.[1] ?? "").split(/\s+/).filter(Boolean);
    const want = new Set([
      ...tokens(/cva\(\s*\n?\s*"([^"]+)"/),
      ...tokens(/lg:\s*"([^"]+)"/),
      ...tokens(/default:\s*"(hover:bg-sidebar-accent[^"]*)"/),
    ]);

    /** 在本仓这处结构下注定不成立的，逐条写清为什么。 */
    const INERT: Record<string, string> = {
      "[&>svg]:size-4":
        "图标不是 button 的直接子节点（外面还有一层 div），且已显式 :size=16",
      "[&>svg]:shrink-0": "同上，已在图标上显式写 shrink-0",
      "[&>span:last-child]:truncate": "文字 span 也不是直接子节点",
      "data-[active=true]:bg-sidebar-accent": "这颗触发器永远不是「当前项」",
      "data-[active=true]:text-sidebar-accent-foreground": "同上",
      "data-[active=true]:font-medium": "同上",
      "disabled:pointer-events-none": "它从不 disabled",
      "disabled:opacity-50": "同上",
      "aria-disabled:pointer-events-none": "同上",
      "aria-disabled:opacity-50": "同上",
      "group-data-[collapsible=icon]:size-8!":
        "wave 74：本仓收起态走 sidebarExpanded 分支，没有 data-collapsible",
      "group-data-[collapsible=icon]:p-2!": "同上",
      "group-data-[collapsible=icon]:p-0!": "同上",
      "group-has-data-[sidebar=menu-action]/menu-item:pr-8":
        "footer 那个 li 里没有 menu-action",
      "w-full": "只在展开态成立，由 :class 的 sidebarExpanded 分支给",
      "h-12": "同上",
      "p-2": "同上",
      "text-left": "文字那一层 div 自己带",
      "text-sm": "同上",
      flex: "本仓写在静态串里（已有）",
    };

    const source = stripped("components/workspace/ThreadSidebar.vue");
    const at = source.indexOf('data-testid="workspace-nav-menu-trigger"');
    expect(at, "找不到 footer 设置键").toBeGreaterThan(-1);
    const tag = source.slice(
      source.lastIndexOf("<button", at),
      source.indexOf("\n              >", at),
    );
    const mine = new Set(
      [
        ...[...tag.matchAll(/class="([^"]+)"/g)].map((m) => m[1]!),
        ...[...tag.matchAll(/'([^']+)'/g)].map((m) => m[1]!),
      ].flatMap((chunk) => chunk.split(/\s+/)),
    );

    // 形状断言：cva 解析坏了会让下面那条静默全绿（坑 176/195）。
    expect(want.size).toBeGreaterThan(25);
    expect(want.has("focus-visible:ring-2")).toBe(true);

    const missing = [...want]
      .filter((t) => !mine.has(t) && !(t in INERT))
      .sort();
    expect(
      missing,
      "footer 设置键是 wave 74 判过的手抄例外，而手抄永远只抄一部分——" +
        "第十七轮实测它漏掉了键盘焦点环。补上，或者进 INERT 并写清它在本仓为什么哑。",
    ).toEqual([]);

    const stale = Object.keys(INERT)
      .filter((t) => !want.has(t))
      .sort();
    expect(stale, "INERT 里的条目 cva 已经没有了，删掉它").toEqual([]);
  });

  /*
    上游 workspace-nav-chat-list.tsx:56 的禁用「Agents」入口：外层
    `cursor-not-allowed`，按钮 `text-muted-foreground/50` + SidebarMenuButton
    cva 自带的 `aria-disabled:pointer-events-none aria-disabled:opacity-50`。
    本仓原来一条都没有，于是这个点不动的入口**还会跟着鼠标高亮**。

    **第十二轮换了尺子，判词没变。** 那两条 `aria-disabled:*` 原来是从 cva
    **抄**到调用点上的，这条用例也就照着抄本比；现在这一处改走
    `SidebarMenuButton`，抄本没了，再比调用点的 class 串只会比出一个假红
    （坑 131：尺子测的不是它守的那件事）。改成分两头比：
    调用点必须是那颗 primitive 且带着 `text-muted-foreground/50`，
    **而那两条 `aria-disabled:*` 要在 cva 里真的存在**——
    少了后半句，谁把它们从 cva 删掉这条用例都不会响。
  */
  it("禁用的 Agents 入口不高亮、不接指针、半透明", () => {
    /* wave 214：这一组随「谁持有 features 查询」搬进了自己的组件，判词没变。 */
    const source = stripped("components/workspace/WorkspaceNavChatList.vue");
    const at = source.indexOf('aria-describedby="agents-disabled-description"');
    expect(at, "找不到禁用入口").toBeGreaterThan(-1);
    const tag = source.slice(
      source.lastIndexOf("<", at),
      source.indexOf(">", at),
    );
    expect(tag, "禁用入口要走 SidebarMenuButton，不要手写它的类串").toContain(
      "<SidebarMenuButton",
    );
    expect(tag, "半透明那一档是调用点给的").toContain(
      "text-muted-foreground/50",
    );
    expect(source, "外层的 cursor-not-allowed 上游明写在这一层").toContain(
      "cursor-not-allowed",
    );

    const cva = stripped("components/ui/sidebar/menu-button-variants.ts");
    for (const token of [
      "aria-disabled:pointer-events-none",
      "aria-disabled:opacity-50",
    ]) {
      expect(cva, `SidebarMenuButton 的 cva 少了 ${token}`).toContain(token);
    }
  });
});
