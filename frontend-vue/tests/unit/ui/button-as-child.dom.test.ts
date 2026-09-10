/*
  【文件职责】     钉住 Button 的 `asChild`：样式与属性合并到唯一子元素上，不套壳。
  【架构位置】     单元测试（dom）
  【依赖关系】     app/components/ui/button
  【边界与注意】   门禁 `as-child-is-supported` 是**结构**判据（模板根是不是原生元素），
                   它证明不了渲染结果。这里补上行为那一半：真挂载、真看 DOM。

                   为什么值得两条一起写：Button 此前没有 `asChild`，
                   `<Button as-child><a/></Button>` 渲染成 `<button><a/></button>`
                   ——**页面上看着还行**，出错的地方在可访问性树和几何上：
                   两个可聚焦控件、按钮里套交互内容（HTML 不允许）、
                   样式全落在外层那个 button 上。是对照台账量出来的，不是看出来的。
*/

import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { h } from "vue";

import { Button } from "@/components/ui/button";

describe("Button 的 asChild", () => {
  it("默认渲染成 button，属性合同不变", () => {
    const wrapper = mount(Button, {
      props: { variant: "outline", size: "sm" },
      slots: { default: () => "Go" },
    });
    const root = wrapper.element as HTMLElement;

    expect(root.tagName).toBe("BUTTON");
    expect(root.dataset.slot).toBe("button");
    expect(root.dataset.variant).toBe("outline");
    expect(root.dataset.size).toBe("sm");
    expect(root.getAttribute("type")).toBe("button");
  });

  it("asChild 时唯一的元素就是那个子元素，没有外层 button", () => {
    const wrapper = mount(Button, {
      props: { variant: "outline", size: "sm", asChild: true },
      slots: { default: () => h("a", { href: "/x" }, "Download") },
    });
    const root = wrapper.element as HTMLElement;

    expect(root.tagName, "根就是 <a>，不是 <button>").toBe("A");
    expect(wrapper.find("button").exists(), "不许再有一个 button").toBe(false);
    expect(root.getAttribute("href")).toBe("/x");
  });

  it("asChild 时样式与 data-* 合并到子元素上", () => {
    const wrapper = mount(Button, {
      props: { variant: "outline", size: "sm", asChild: true },
      slots: { default: () => h("a", { href: "/x" }, "Download") },
    });
    const root = wrapper.element as HTMLElement;

    expect(root.dataset.slot).toBe("button");
    expect(root.dataset.variant).toBe("outline");
    expect(root.dataset.size).toBe("sm");
    // 具体类名跟着 variants 走，这里只钉「按钮的样式真的到了这个 <a> 身上」。
    expect(root.className).toContain("inline-flex");
  });

  it("asChild 时不把 type 转发到子元素上", () => {
    // `type` 是 <button> 的属性；套到 <a> 上没有意义，上游的 Slot 也不会带过去。
    const wrapper = mount(Button, {
      props: { asChild: true },
      slots: { default: () => h("a", { href: "/x" }, "Download") },
    });

    expect((wrapper.element as HTMLElement).hasAttribute("type")).toBe(false);
  });
});
