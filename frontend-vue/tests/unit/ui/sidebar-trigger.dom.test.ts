/*
  SidebarTrigger 的合同。这个 primitive 是从**三份**手搓副本合并出来的
  （AgentChat / WorkspaceContainer / ThreadSidebar），所以这里钉的重点不是"能渲染"，
  而是那三份当初各自跑偏的地方：盒子尺寸、图标随开合态切换、data-slot 归谁。
*/

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import SidebarTrigger from "@/components/ui/sidebar/SidebarTrigger.vue";

/** 坑 58：.dom.test.ts 里 import.meta.url 不是 file: URL，读源码走 cwd。 */
const readSource = (relative: string) =>
  readFileSync(resolve(process.cwd(), relative), "utf8");

/** 先剥注释再比对：坑 59——锚点串往往也躺在解释它的注释里，会把守卫钉成假绿。 */
const stripComments = (source: string) =>
  source.replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

describe("SidebarTrigger", () => {
  it("keeps the upstream 28px ghost icon button contract", () => {
    const wrapper = mount(SidebarTrigger, { props: { open: true } });

    expect(wrapper.attributes("data-sidebar")).toBe("trigger");
    expect(wrapper.attributes("data-variant")).toBe("ghost");
    expect(wrapper.attributes("data-size")).toBe("icon");
    expect(wrapper.attributes("type")).toBe("button");
  });

  /*
    坑 62 那一类：两层组件都写了 data-slot 时，留在 DOM 上的是**外层**那个。
    上游靠 `{...props}` 展开在 `data-slot="button"` 之后拿到同样的结果，React probe
    实测该按钮是 sidebar-trigger。Vue 这边靠 fallthrough attrs 在根元素上后来居上——
    机制不同、结果必须相同，所以单独钉一条，而不是"按直觉认为里层赢"。
  */
  it("lets the trigger's own data-slot win over the Button primitive's", () => {
    const wrapper = mount(SidebarTrigger, { props: { open: true } });

    expect(wrapper.attributes("data-slot")).toBe("sidebar-trigger");
  });

  /*
    坑 60：cva 只拼接不合并。size:"icon" 给的是 size-9，上游用 size-7 覆盖它。
    如果哪天 SidebarTrigger 绕开 cn() 直接拼串，两条都会留在 class 里，
    赢家由样式表顺序决定——这里钉的就是"合并真的发生了"。
  */
  it("merges size-7 over the icon size instead of keeping both", () => {
    const classes = mount(SidebarTrigger, {
      props: { open: true },
    }).classes();

    expect(classes).toContain("size-7");
    expect(classes).not.toContain("size-9");
    expect(classes).toContain("opacity-50");
  });

  it("keeps caller classes alongside the primitive's own", () => {
    const classes = mount(SidebarTrigger, {
      props: { open: true, class: "md:hidden" },
    }).classes();

    expect(classes).toContain("md:hidden");
    expect(classes).toContain("size-7");
  });

  /*
    三份手搓副本里，两份**根本拿不到开合态**，于是各自写死了一个图标
    （Menu / ChevronRight），只有 ThreadSidebar 那份会切。图标随 open 切换是
    上游行为，这条同时也是"共享状态真的接到了 primitive 上"的判据。
  */
  it("swaps the icon with the open state", () => {
    const opened = mount(SidebarTrigger, { props: { open: true } });
    const closed = mount(SidebarTrigger, { props: { open: false } });

    expect(opened.find("svg").classes()).toContain("lucide-panel-left-close");
    expect(closed.find("svg").classes()).toContain("lucide-panel-left-open");
  });

  /*
    图标尺寸靠 Button base 的 [&_svg:not([class*='size-'])]:size-4 用 CSS 压到 16，
    不写 :size。happy-dom 不算 computed style，所以这里只能钉"没有写死尺寸"——
    真正的 16×16 由 e2e 几何 probe 给（实测两边都是 16）。
  */
  it("leaves the icon unsized so the Button base rule applies", () => {
    const svg = mount(SidebarTrigger, { props: { open: true } }).find("svg");

    expect(svg.attributes("width")).toBe("24");
    expect(svg.classes().some((name) => name.startsWith("size-"))).toBe(false);
  });
});

describe("侧栏触发器的唯一实现", () => {
  /*
    本轮的正题就是"三份手搓副本合一"。合完之后如果没有守卫，下一个人照样会在
    第四个页面里再手搓一颗——那正是这三份的来历。所以钉的是**结构**：
    data-sidebar="trigger" 只允许出现在 L2 primitive 里，产品层一律走组件。
  */
  it("keeps data-sidebar='trigger' inside the L2 primitive only", () => {
    const productFiles = [
      "app/components/chat/AgentChat.vue",
      "app/components/workspace/WorkspaceContainer.vue",
      "app/components/workspace/ThreadSidebar.vue",
    ];

    for (const file of productFiles) {
      expect(stripComments(readSource(file)), file).not.toContain(
        'data-sidebar="trigger"',
      );
      expect(readSource(file), file).toContain("SidebarTrigger");
    }

    expect(
      stripComments(readSource("app/components/ui/sidebar/SidebarTrigger.vue")),
    ).toContain('data-sidebar="trigger"');
  });

  /*
    另外两处触发器此前只发全局事件、拿不到开合态。这条钉的是它们现在确实从
    共享状态里取 open——只钉模板里传了 :open 是不够的，传一个字面量 false
    同样能过，所以连 useWorkspaceSidebar 一起钉。
  */
  /*
    每一处都从共享状态取，**而且取的是与自己语境匹配的那一份**。

    此前这条守卫要求三处**都**传 `:open="sidebarOpen"`——那正好把一个缺陷钉住了：
    带 `md:hidden` 的两处只在窄屏出现，而窄屏抽屉的开合是 `mobileOpen`，
    传桌面的 `open` 会让图标恒定且指反（抽屉关着，按钮画着「收起」）。
    上游同一处是 `isMobile ? openMobile : open`（wave 36 两边同改，sidebar.tsx:261）。

    本仓把这个选择留在调用点：class 已经写死语境的（`md:hidden`）直接传 mobileOpen，
    没写死的（侧栏自己的头部，桌面与抽屉里都渲染）才问一次 `isNarrow`。
  */
  it("feeds every trigger from the state that matches its own context", () => {
    for (const [file, expected] of [
      // 都带 md:hidden：只在窄屏出现。
      ["app/components/chat/AgentChat.vue", ':open="sidebarMobileOpen"'],
      [
        "app/components/workspace/WorkspaceContainer.vue",
        ':open="sidebarMobileOpen"',
      ],
      [
        "app/components/workspace/extensions/PluginPage.vue",
        ':open="mobileOpen"',
      ],
      [
        "app/components/workspace/capabilities/CapabilityCenter.vue",
        ':open="mobileOpen"',
      ],
      // 侧栏自己的头部：桌面与抽屉里都渲染，所以要问视口。
      [
        "app/components/workspace/ThreadSidebar.vue",
        ':open="isNarrow ? mobileOpen : sidebarOpen"',
      ],
    ] as const) {
      const source = stripComments(readSource(file));
      expect(source, file).toContain("useWorkspaceSidebar()");
      expect(source, file).toContain(expected);
    }
  });

  /* 两个图标各对一个状态，别把判据写反了。 */
  it("shows the collapse icon only while the sidebar is open", () => {
    expect(
      mount(SidebarTrigger, { props: { open: true } })
        .find(".lucide-panel-left-close")
        .exists(),
    ).toBe(true);
    expect(
      mount(SidebarTrigger, { props: { open: false } })
        .find(".lucide-panel-left-open")
        .exists(),
    ).toBe(true);
  });
});
