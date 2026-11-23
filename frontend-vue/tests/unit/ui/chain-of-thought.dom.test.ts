/*
  【文件职责】     钉住 ChainOfThought 三个 primitive 的形状与**默认值**。
  【架构位置】     测试
  【主要导出】     无
  【依赖关系】     ui/chain-of-thought · ui/effects/FlipDisplay · ui/effects/Shimmer
  【边界与注意】   primitive 的默认值是台账看不见的一类差异：调用点一次都不传
                   `status`，于是「complete → text-muted-foreground」这条默认决定了
                   卡片里每一行文字的颜色。同理默认图标是 Dot 且**由 Step 自己补
                   size-4**，而外部传进来的图标不补尺寸——上游靠 Button 的
                   `[&_svg:not([class*='size-'])]:size-4` 才把它压到 16px，本组件
                   多补一个 size 类会让那条规则失效。
*/

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { defineComponent, h } from "vue";

import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtStep,
} from "@/components/ui/chain-of-thought";
import FlipDisplay from "@/components/ui/effects/FlipDisplay.vue";
import Shimmer from "@/components/ui/effects/Shimmer.vue";

describe("ChainOfThoughtStep", () => {
  it("defaults to the muted 'complete' status and a size-4 dot icon", () => {
    const wrapper = mount(ChainOfThoughtStep, {
      slots: { label: "Research the market" },
    });

    expect(wrapper.classes()).toContain("text-muted-foreground");
    expect(wrapper.classes()).toContain("flex");
    expect(wrapper.classes()).toContain("gap-2");
    expect(wrapper.classes()).toContain("text-sm");
    const icon = wrapper.get("svg");
    expect(icon.classes()).toContain("size-4");
    expect(icon.classes()).toContain("lucide-dot");
    // 竖直连接线恒在，上游没有条件。
    expect(wrapper.find(".bg-border.absolute.top-7").exists()).toBe(true);
    // label 永远包一层 div，即使内容为空。
    expect(wrapper.get(".flex-1.space-y-2.overflow-hidden > div").text()).toBe(
      "Research the market",
    );
  });

  it("maps the other two statuses to their own foreground", () => {
    const active = mount(ChainOfThoughtStep, {
      props: { status: "active" },
      slots: { label: "x" },
    });
    expect(active.classes()).toContain("text-foreground");
    const pending = mount(ChainOfThoughtStep, {
      props: { status: "pending" },
      slots: { label: "x" },
    });
    expect(pending.classes()).toContain("text-muted-foreground/50");
  });

  /*
    外部图标原样渲染：既不补 size 类，也不套一层带尺寸的壳。Vue 的插槽模型本身就
    不允许父组件给插槽内容加 class，所以真正会回归的写法是"包一层"——而包一层同样
    会让 Button 的 `[&_svg:not([class*='size-'])]:size-4` 选不中里面的 svg
    （规则选的是 svg 自己），图标从 16px 变回 lucide 默认的 24px。所以这里连
    **父节点**一起钉：svg 必须直接挂在图标格子上。
  */
  it("renders a supplied icon bare, with no size class and no wrapper", () => {
    const wrapper = mount(ChainOfThoughtStep, {
      slots: {
        icon: () => h("svg", { class: "lucide-clipboard-list" }),
        label: "x",
      },
    });
    const icon = wrapper.get("svg");
    expect(icon.classes()).toContain("lucide-clipboard-list");
    expect(icon.classes().some((name) => name.startsWith("size-"))).toBe(false);
    const slotHost = icon.element.parentElement!;
    expect([...slotHost.classList].sort()).toEqual(["mt-0.5", "relative"]);
  });

  it("only renders the description row when a description is given", () => {
    expect(
      mount(ChainOfThoughtStep, { slots: { label: "x" } })
        .find(".text-muted-foreground.text-xs")
        .exists(),
    ).toBe(false);
    expect(
      mount(ChainOfThoughtStep, {
        slots: { label: "x", description: "why" },
      })
        .get(".text-muted-foreground.text-xs")
        .text(),
    ).toBe("why");
  });
});

describe("ChainOfThought container", () => {
  const host = (open: boolean) =>
    defineComponent({
      setup() {
        return () =>
          h(ChainOfThought, { open, class: "rounded-lg border" }, () => [
            h(ChainOfThoughtContent, { class: "px-4 pb-4" }, () => "panel"),
          ]);
      },
    });

  it("keeps not-prose and merges the caller's classes", () => {
    const wrapper = mount(host(false));
    const root = wrapper.get("div");
    expect(root.classes()).toContain("not-prose");
    expect(root.classes()).toContain("rounded-lg");
  });

  /*
    折叠时元素留在 DOM 里、带 `hidden`（display:none）、**子内容不渲染**；展开才有
    内容。这正是上游 radix 的形状，而它在 reka 这边来自 unmountOnHide 的**默认值**
    ——传 false 反而会得到 `hidden="until-found"`（元素仍有盒子）。理由写在
    Collapsible.vue 的文件头。
  */
  it("hides the closed panel and drops its content", () => {
    const closed = mount(host(false));
    const panel = closed.get('[data-slot="collapsible-content"]');
    expect(panel.attributes("hidden")).toBeDefined();
    expect(panel.attributes("data-state")).toBe("closed");
    expect(closed.text()).not.toContain("panel");

    const open = mount(host(true));
    const openPanel = open.get('[data-slot="collapsible-content"]');
    expect(openPanel.attributes("hidden")).toBeUndefined();
    expect(openPanel.text()).toBe("panel");
    expect(openPanel.classes()).toContain("px-4");
    expect(openPanel.classes()).toContain("mt-2");
    expect(openPanel.classes()).toContain("space-y-3");
  });

  it("refuses to render content outside a ChainOfThought", () => {
    expect(() => mount(ChainOfThoughtContent)).toThrow(
      /must be used within ChainOfThought/,
    );
  });
});

describe("FlipDisplay", () => {
  /*
    稳定态是静态样式而不是动画终点：上游 motion 把 `{ y: 2, opacity: 1 }` 落在
    内联 style 上，probe 实测 React 折叠态就是 translateY(2px)。这里用 CSS 类做，
    所以要钉住类名还在——它一旦变成只在动画里出现，减动偏好下那 2px 就没了。
  */
  it("wraps the keyed item in an overflow-hidden window", () => {
    const wrapper = mount(FlipDisplay, {
      props: { uniqueKey: "m1", class: "max-w-[420px] truncate pb-1" },
      slots: { default: "Subtask failed" },
    });
    expect(wrapper.classes()).toEqual(
      expect.arrayContaining([
        "relative",
        "overflow-hidden",
        "truncate",
        "pb-1",
      ]),
    );
    expect(wrapper.get(".flip-display__item").text()).toBe("Subtask failed");
  });

  /*
    这一条读的是 SFC 源码，不是渲染结果——scoped `<style>` 在 happy-dom 里不生效，
    所以「稳定态是静态样式」这条判据没法用挂载后的 computed style 来验。它值得单独
    钉住：把 translateY(2px) 挪进过渡/动画里，页面看起来一样，但减动偏好或动画被
    跳过时那 2px 就没了，而 React 侧 motion 把它写在内联 style 上、始终存在
    （probe 实测 matrix(1,0,0,1,0,2)）。
  */
  it("keeps the settled 2px offset as a static rule, not an animation endpoint", () => {
    // happy-dom 下 import.meta.url 不是 file: URL，所以按仓库根的相对路径读。
    const source = readFileSync(
      resolve(process.cwd(), "app/components/ui/effects/FlipDisplay.vue"),
      "utf8",
    );
    const staticRule = source.match(/\.flip-display__item\s*\{([^}]*)\}/)?.[1];
    expect(staticRule).toBeDefined();
    expect(staticRule).toContain("opacity: 1");
    expect(staticRule).toContain("translateY(2px)");
  });
});

describe("Shimmer", () => {
  it("renders a paragraph whose spread scales with the text length", () => {
    const wrapper = mount(Shimmer, {
      props: { text: "Draft the plan", duration: 3, spread: 3 },
    });
    expect(wrapper.element.tagName).toBe("P");
    expect(wrapper.text()).toBe("Draft the plan");
    const style = wrapper.attributes("style") ?? "";
    expect(style).toContain(`--spread: ${"Draft the plan".length * 3}px`);
    expect(style).toContain("--shimmer-duration: 3s");
    expect(wrapper.classes()).toContain("text-transparent");
    expect(wrapper.classes()).toContain("bg-clip-text");
  });
});

describe("ChainOfThought controlled and initial state", () => {
  const content = () =>
    h(ChainOfThoughtContent, {}, () => "initially open panel");
  it("honors defaultOpen when open is omitted and treats it only as initial state", async () => {
    const wrapper = mount(ChainOfThought, {
      props: { defaultOpen: true },
      slots: { default: content },
    });
    try {
      await wrapper.vm.$nextTick();
      expect(
        wrapper.get('[data-slot="collapsible"]').attributes("data-state"),
      ).toBe("open");
      expect(wrapper.text()).toContain("initially open panel");
      expect(
        wrapper.get('[data-slot="collapsible-content"]').attributes("hidden"),
      ).toBeUndefined();
      await wrapper.setProps({ defaultOpen: false });
      expect(
        wrapper.get('[data-slot="collapsible"]').attributes("data-state"),
      ).toBe("open");
    } finally {
      wrapper.unmount();
    }
  });
  it("lets an explicit open state override defaultOpen and react to controlled changes", async () => {
    const wrapper = mount(ChainOfThought, {
      props: { open: false, defaultOpen: true },
      slots: { default: content },
    });
    try {
      await wrapper.vm.$nextTick();
      expect(
        wrapper.get('[data-slot="collapsible"]').attributes("data-state"),
      ).toBe("closed");
      await wrapper.setProps({ open: true });
      expect(
        wrapper.get('[data-slot="collapsible"]').attributes("data-state"),
      ).toBe("open");
      await wrapper.setProps({ open: false });
      expect(
        wrapper.get('[data-slot="collapsible"]').attributes("data-state"),
      ).toBe("closed");
    } finally {
      wrapper.unmount();
    }
  });
});
