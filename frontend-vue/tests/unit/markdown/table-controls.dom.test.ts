import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import StreamMarkdown from "@/components/markdown/StreamMarkdown.vue";
import MessageMarkdown from "@/components/chat/MessageMarkdown.vue";
import { richContentComponents } from "@/components/markdown/components";
import { enUS } from "@/core/i18n/locales/en-US";
import { appRemarkPlugins } from "@/core/markdown/plugins";

const writeText = vi.fn();

beforeEach(() => {
  document.body.innerHTML = "";
  writeText.mockReset().mockResolvedValue(undefined);
  vi.stubGlobal("useNuxtApp", () => ({ $i18n: { t: { value: enUS } } }));
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("markdown table controls", () => {
  it("uses the React message-rendering plugin chain by default", async () => {
    const wrapper = mount(MessageMarkdown, {
      props: {
        content: "| City | Weather |\n| --- | --- |\n| Shanghai | Sunny |",
        components: richContentComponents as unknown as Record<string, unknown>,
      },
    });

    await flushPromises();

    expect(wrapper.find("table").exists()).toBe(true);
    expect(wrapper.find('[title="Copy table"]').exists()).toBe(true);
  });

  it("disables table actions while the assistant response is streaming", async () => {
    const wrapper = mount(MessageMarkdown, {
      props: {
        content: "| City | Weather |\n| --- | --- |\n| Shanghai | Sunny |",
        streaming: true,
        components: richContentComponents as unknown as Record<string, unknown>,
      },
    });

    await flushPromises();

    expect(wrapper.get('[title="Copy table"]').attributes("disabled")).toBe("");
    expect(wrapper.get('[title="Download table"]').attributes("disabled")).toBe(
      "",
    );
    expect(
      wrapper.get('[title="View fullscreen"]').attributes("disabled"),
    ).toBe("");
  });

  it("matches Streamdown copy/download/fullscreen actions", async () => {
    const wrapper = mount(StreamMarkdown, {
      attachTo: document.body,
      props: {
        content: "| City | Weather |\n| --- | --- |\n| Shanghai | Sunny |",
        remarkPlugins: appRemarkPlugins,
        rehypePlugins: [], // 消息路径的同步 rehype 链现在是空的：KaTeX 由 core/markdown/math.ts 按内容加载。
        components: richContentComponents as unknown as Record<string, unknown>,
      },
    });

    expect(wrapper.find('[title="Copy table"]').exists()).toBe(true);
    expect(wrapper.find('[title="Download table"]').exists()).toBe(true);
    expect(wrapper.find('[title="View fullscreen"]').exists()).toBe(true);

    // 复制/下载现在是 DropdownMenu：菜单项 portal 到 body，且只响应 select，
    // 所以断言从 wrapper 子树移到 document。
    await wrapper.get('[title="Copy table"]').trigger("click");
    await flushPromises();
    document
      .querySelector<HTMLElement>('[title="Copy table as Markdown"]')!
      .click();
    await flushPromises();
    expect(writeText).toHaveBeenCalledWith(
      "| City | Weather |\n| --- | --- |\n| Shanghai | Sunny |",
    );

    await wrapper.get('[title="View fullscreen"]').trigger("click");
    await flushPromises();
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.body.textContent).toContain("Shanghai");
    wrapper.unmount();
  });
});
