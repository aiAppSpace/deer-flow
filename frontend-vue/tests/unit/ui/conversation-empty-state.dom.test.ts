/*
  【文件职责】     钉住 ConversationEmptyState primitive 的结构与样式基线。
  【架构位置】     L2 单元测试
  【主要导出】     无；Vitest cases
  【依赖关系】     app/components/ui/conversation
  【边界与注意】   钉的是上游 `ai-elements/conversation.tsx:36` 那一支的**可观察形状**：
                   外层那串类、icon 的 `text-muted-foreground` 包装层、
                   `space-y-1` 里的 `h3` + `p`。三个调用点（sidecar 空态、browser 空态、
                   artifact 空态）靠的都是这一份，改坏一处三处一起坏。

                   `description` 缺省时**整个 `<p>` 都不能在**——上游是
                   `{description && <p>}`，渲染一个空 p 会在可访问性树里多出一个
                   空文本节点。这条要正反两边都断言（坑 57）：只断言「有描述时有 p」
                   的话，把条件写成恒真也照样绿。

                   这里不测默认文案，因为**本仓故意没有默认文案**：上游那两串英文
                   在三个调用点上一次也没被读到，而 `ui/` 在 i18n source guard 的
                   扫描面内（坑 52）。理由写在组件文件头第 ③ 条。
*/

import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import { ConversationEmptyState } from "@/components/ui/conversation";

describe("ConversationEmptyState primitive", () => {
  it("keeps the upstream box, the icon wrapper and the title/description pair", () => {
    const wrapper = mount(ConversationEmptyState, {
      props: { title: "No browser activity yet", description: "Enter a URL." },
      slots: { icon: '<svg data-testid="icon" />' },
    });

    const root = wrapper.get("div");
    const className = root.attributes("class") ?? "";
    for (const token of [
      "flex",
      "size-full",
      "flex-col",
      "items-center",
      "justify-center-safe",
      "overflow-y-auto",
      "gap-3",
      "p-8",
      "text-center",
    ]) {
      expect(className.split(/\s+/), token).toContain(token);
    }

    // icon 外面必须有那一层 text-muted-foreground；上游靠它给图标上色。
    const iconWrapper = wrapper.get('[data-testid="icon"]').element
      .parentElement;
    expect(iconWrapper?.className).toContain("text-muted-foreground");

    const title = wrapper.get("h3");
    expect(title.text()).toBe("No browser activity yet");
    expect(title.attributes("class")).toContain("text-sm");
    expect(title.attributes("class")).toContain("font-medium");

    const description = wrapper.get("p");
    expect(description.text()).toBe("Enter a URL.");
    expect(description.attributes("class")).toContain("text-muted-foreground");
    expect(title.element.parentElement?.className).toContain("space-y-1");
  });

  it("drops the description paragraph entirely when there is none", () => {
    const withDescription = mount(ConversationEmptyState, {
      props: { title: "Ask a follow-up", description: "grounded in the text." },
    });
    expect(withDescription.findAll("p")).toHaveLength(1);

    const withoutDescription = mount(ConversationEmptyState, {
      props: { title: "Ask a follow-up" },
    });
    expect(withoutDescription.findAll("p")).toHaveLength(0);
    expect(withoutDescription.get("h3").text()).toBe("Ask a follow-up");
  });

  it("drops the icon wrapper when no icon slot is given", () => {
    const withIcon = mount(ConversationEmptyState, {
      props: { title: "t" },
      slots: { icon: "<svg />" },
    });
    expect(withIcon.findAll("div")).toHaveLength(3); // root + icon wrapper + space-y-1

    const withoutIcon = mount(ConversationEmptyState, {
      props: { title: "t" },
    });
    expect(withoutIcon.findAll("div")).toHaveLength(2); // root + space-y-1
  });

  it("merges the caller class instead of dropping the baseline", () => {
    const wrapper = mount(ConversationEmptyState, {
      props: { title: "t", class: "absolute inset-0 m-auto h-fit" },
    });
    const className = wrapper.get("div").attributes("class") ?? "";
    expect(className).toContain("absolute");
    expect(className).toContain("m-auto");
    expect(className).toContain("items-center");
    expect(className).toContain("p-8");
  });

  it("has no data-slot: the upstream piece is a bare div", () => {
    const wrapper = mount(ConversationEmptyState, { props: { title: "t" } });
    expect(wrapper.get("div").attributes("data-slot")).toBeUndefined();
  });
});
