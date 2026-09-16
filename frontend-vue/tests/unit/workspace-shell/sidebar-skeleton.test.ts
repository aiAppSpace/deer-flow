/*
  侧栏骨架的结构合同。这些差异**台账一条都照不到**——`data-slot` 不进可访问性树，
  footer 的高度差也不在任何几何锚点上（锚点是两条导航链接，它们在 content 顶部，
  footer 变高只压缩 content，链接的 y 不动）。所以判据只能写在这里。

  钉的是「上游有、本仓也得有」的那几处，不是逐字复制 class 串：class 串会随
  tailwind 版本和设计调整变，而这几条是结构。
*/

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/*
  骨架分散在**四份文件**里，这份合同要把它们一起读。

  - wave 148：外壳（窄屏 Sheet / 宽屏版面块）拆成 `ThreadSidebarShell.vue`，
    `data-slot="sidebar-inner"` 跟着它走；
  - wave 214：导航组与「最近的对话」组各自拆成组件，理由是**查询的归属**
    （见那两份文件的头注释），组/组标题/组内容那三颗 slot 跟着搬了过去。

  只读其中一两份，搬走的那几条会**静默失守**——这正是 wave 214 当场撞到的：
  拆完这条用例立刻报红，报的就是 `sidebar-group` / `-label` / `-content`。
*/
const source = [
  "app/components/workspace/ThreadSidebarShell.vue",
  "app/components/workspace/ThreadSidebar.vue",
  "app/components/workspace/WorkspaceNavChatList.vue",
  "app/components/workspace/RecentChatList.vue",
]
  .map((file) => readFileSync(resolve(process.cwd(), file), "utf8"))
  .join("\n");

/** 坑 59：锚点串往往也躺在解释它的注释里，不剥注释会把守卫钉成假绿。 */
const template = source
  .replace(/<!--[\s\S]*?-->/g, "")
  .replace(/\/\*[\s\S]*?\*\//g, "");

/*
  每个骨架 slot 在**渲染结果**里从哪来。

  上游每个骨架 primitive 都同时写 data-slot 与 data-sidebar，本仓此前一个都没有——
  这是合同差异不是渲染差异，但合同差异正是「下一次谁想按 slot 选元素时才发现对不上」
  的那种。

  **第十二轮换了尺子，判词没变。** 原来这一条 grep 的是两份骨架文件的源文本，
  而第十二轮把 group / menu / menu-item / menu-button 四层换回了 `ui/sidebar` 的
  primitive：slot 照样出现在**渲染结果**里，源文本里却没有了，于是这条用例报了
  一次假红（坑 131 的同一形状——尺子测的不是它守的那件事）。

  现在分两类各自比：`ui/sidebar` 里**没有**对应 primitive 的那五颗只能本地写，
  比 literal；有 primitive 的比「那颗组件被用上了」，而且**回头验证那颗 primitive
  自己真的声明了这个 slot**——少了后半句，改错映射这条用例不会响。
  本地写不了那几颗：`handwritten-primitive-slots` 这道门不允许。
*/
const SKELETON_SLOTS: Record<string, string | null> = {
  "sidebar-inner": null,
  "sidebar-header": null,
  "sidebar-content": null,
  "sidebar-footer": null,
  "sidebar-rail": null,
  "sidebar-group": "SidebarGroup",
  "sidebar-group-label": "SidebarGroupLabel",
  "sidebar-group-content": "SidebarGroupContent",
  "sidebar-menu": "SidebarMenu",
  "sidebar-menu-item": "SidebarMenuItem",
  "sidebar-menu-button": "SidebarMenuButton",
};

describe("侧栏骨架与上游 ui/sidebar.tsx 的结构合同", () => {
  it("carries every upstream data-slot the sidebar skeleton defines", () => {
    for (const [slot, primitive] of Object.entries(SKELETON_SLOTS)) {
      if (primitive === null) {
        expect(template, `${slot} 得由骨架自己写`).toContain(
          `data-slot="${slot}"`,
        );
        continue;
      }
      /* `[\s>]` 是必须的：`<SidebarGroup` 会被 `<SidebarGroupLabel` 前缀命中，
         那样组容器整个删掉这一条也不会响。 */
      expect(template, `${slot} 得由 ${primitive} 带上`).toMatch(
        new RegExp(`<${primitive}[\\s>]`),
      );
      const source = readFileSync(
        resolve(process.cwd(), `app/components/ui/sidebar/${primitive}.vue`),
        "utf8",
      );
      expect(source, `${primitive} 自己并没有声明 ${slot}`).toContain(
        `data-slot="${slot}"`,
      );
    }
  });

  /*
    坑 62 的实战：上游 footer 那颗按钮外面还包着 `<DropdownMenuTrigger asChild>`,
    留在 DOM 上的 data-slot 是**最外层**的 dropdown-menu-trigger。给它补一个
    sidebar-menu-button 会把外层盖掉，反而与上游不一致——probe 实测过两边。
  */
  it("leaves the footer trigger's data-slot to the dropdown primitive", () => {
    const at = template.indexOf('data-testid="workspace-nav-menu-trigger"');
    // 只框住这颗 button 自己的开标签，别把外面的 ul / li 一起框进来。
    const button = template.slice(
      template.lastIndexOf("<button", at),
      template.indexOf(">", at),
    );
    expect(button).not.toContain("data-slot=");
    expect(button).toContain('data-sidebar="menu-button"');
    expect(button).toContain('data-size="lg"');
  });

  /*
    收起态那颗触发器只渲染一个 settings 图标，没有名字时读屏器只念得出「按钮」
    （wave 62 用 parity probe 普查出来的三颗无名控件之一）。上游同一处也没有名字
    （workspace-nav-menu.tsx 的 SidebarMenuButton 既不传 tooltip 也没有
    aria-label），**已两边同改**。名字取展开态显示的那一句，可访问名与可见名一致。
  */
  it("names the footer trigger in both sidebar states", () => {
    const at = template.indexOf('data-testid="workspace-nav-menu-trigger"');
    const button = template.slice(
      template.lastIndexOf("<button", at),
      template.indexOf(">", at),
    );
    expect(button).toContain(
      ':aria-label="$i18n.t.value.workspace.settingsAndMore"',
    );
  });

  /*
    上游 SidebarFooter 是独立容器（`flex flex-col gap-2 p-2`），不是给 ul 挂
    mt-auto。此前本仓没有这层，整块 footer 比上游矮 12px（按钮 h-9 对上游
    size="lg" 的 h-12），连带 sidebar-content 高 648 对 660。
  */
  it("wraps the footer menu in its own SidebarFooter container", () => {
    expect(template).toMatch(
      /data-slot="sidebar-footer"[\s\S]{0,200}?class="[^"]*flex flex-col gap-2 p-2/,
    );
    /*
      展开态才是 `h-12 w-full p-2`。wave 74 起收起态换成 `size-8 p-0`
      （上游 cva 的 `group-data-[collapsible=icon]:size-8! / :p-0!`），
      所以这一条只钉展开那一支，尺寸那一档由
      `tests/guards/upstream-class-echo.test.ts` 双向钉。
    */
    expect(template).toContain("h-12 w-full p-2");
    expect(template).not.toContain("h-9 w-full items-center gap-2");
  });

  /*
    上游头部是两层：外层 `flex h-12 flex-col justify-center` 定高，内层
    `flex items-center justify-between gap-2` 贴着最高的 child 走（实测 28）。
    拍平成一层位置仍然对得上——定高由外层给——但"这一行有多高"的信息就没了。
  */
  it("keeps the two-level workspace header upstream uses", () => {
    expect(template).toContain("flex h-12 shrink-0 flex-col justify-center");
    expect(template).toContain("flex items-center justify-between gap-2");
  });

  /*
    展开态**不传任何可见性 class**（上游就是裸的 `<SidebarTrigger />`）。此前本仓
    传 `hidden md:flex`，于是窄屏抽屉里这颗触发器根本不存在——抽屉里没有关闭入口。
    收起态那支照抄上游的 `hidden pl-2 group-hover/workspace-header:block`，
    那个 `block` 会经 twMerge 盖掉 Button 的 inline-flex，看着像笔误但它是上游实际渲染。
  */
  it("gives the header trigger upstream's visibility classes", () => {
    expect(template).toContain(
      'class="hidden pl-2 group-hover/workspace-header:block"',
    );
    expect(template).not.toContain("hidden md:flex");
    expect(template).not.toContain(
      "hidden md:group-hover/workspace-header:flex",
    );
  });

  /*
    rail 是 `sm:flex`（≥640px），窄屏抽屉的分界是 768px，所以 640~767px 这一档
    rail 看得见。此前它调 setCollapsed，在那一档点它会去改**桌面**收起态而不是关掉
    眼前的抽屉；上游 SidebarRail 调的是认窄屏的 toggleSidebar。
  */
  it("routes both the rail and the header trigger through toggleSidebar", () => {
    expect(template).not.toContain("setCollapsed(");
    const rail = template.slice(template.indexOf('data-sidebar="rail"'));
    expect(rail.slice(0, 600)).toContain('@click="toggleSidebar"');
  });

  /** 上游字标用 `ml-2`（外边距），本仓此前是 `px-2`：文字都在 x=16，盒子不同。 */
  it("offsets the wordmark with a margin the way upstream does", () => {
    expect(template).toContain("text-primary ml-2 cursor-default font-serif");
  });
});
