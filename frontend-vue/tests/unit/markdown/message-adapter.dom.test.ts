import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";
import { defineComponent, h, markRaw } from "vue";

import MessageMarkdownContent from "@/components/chat/MessageMarkdownContent.vue";
// Preload the real async renderer; assertions must see actual DOM, not an unresolved component.
import "@/components/markdown/StreamMarkdown.vue";

const wrappers: ReturnType<typeof mount>[] = [];
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()));

async function render(content: string, components?: Record<string, unknown>) {
  const wrapper = mount(MessageMarkdownContent, {
    props: { content, components },
  });
  wrappers.push(wrapper);
  await flushPromises();
  return wrapper;
}

describe("message Markdown product adapter defaults", () => {
  it("supplies styled headings, lists, code and real table controls without a caller map", async () => {
    const wrapper = await render(
      "## Evidence\n\n- one\n\n`inline`\n\n```text\nsource\n```\n\n| Name | Value |\n| --- | --- |\n| DeerFlow | 42 |",
    );
    expect(wrapper.get("h2").classes()).toEqual(
      expect.arrayContaining(["text-2xl", "font-semibold"]),
    );
    expect(wrapper.get("ul").classes()).toContain("list-disc");
    expect(wrapper.get('[data-streamdown="inline-code"]').classes()).toContain(
      "font-mono",
    );
    expect(
      wrapper.get('[data-streamdown="code-block"]').attributes("data-language"),
    ).toBe("text");
    expect(wrapper.find('[title="Copy table"]').exists()).toBe(true);
    expect(wrapper.find('[title="Download table"]').exists()).toBe(true);
    expect(wrapper.get("th").classes()).toContain("whitespace-nowrap");
    expect(wrapper.get("td").classes()).toContain("text-sm");
  });

  it("does not invent rich UI for plain text", async () => {
    const wrapper = await render("Only this plain answer.");
    expect(wrapper.text()).toBe("Only this plain answer.");
    expect(wrapper.find("table, pre, img, button, svg").exists()).toBe(false);
    expect(wrapper.find('[data-streamdown="code-block"]').exists()).toBe(false);
  });

  it("keeps caller link/image overrides ahead of defaults while retaining other defaults", async () => {
    const link = markRaw(
      defineComponent({
        inheritAttrs: false,
        setup(_, { attrs, slots }) {
          return () =>
            h(
              "a",
              { href: attrs.href, "data-testid": "caller-link" },
              slots.default?.(),
            );
        },
      }),
    );
    const image = markRaw(
      defineComponent({
        inheritAttrs: false,
        setup(_, { attrs }) {
          return () =>
            h("img", {
              src: attrs.src,
              alt: attrs.alt,
              "data-testid": "caller-image",
            });
        },
      }),
    );
    const wrapper = await render(
      "## Sources\n\n[Source](https://example.test/source)\n\n![Diagram](https://example.test/image.png)",
      { a: link, img: image },
    );
    expect(wrapper.get('[data-testid="caller-link"]').attributes("href")).toBe(
      "https://example.test/source",
    );
    expect(wrapper.get('[data-testid="caller-image"]').attributes("alt")).toBe(
      "Diagram",
    );
    expect(wrapper.get("h2").classes()).toContain("text-2xl");
    expect(wrapper.find('[data-streamdown="link"]').exists()).toBe(false);
    expect(wrapper.find('[data-streamdown="image-wrapper"]').exists()).toBe(
      false,
    );

    await wrapper.setProps({ components: undefined });
    await flushPromises();
    expect(wrapper.find('[data-testid="caller-link"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="caller-image"]').exists()).toBe(false);
    expect(wrapper.get('[data-streamdown="link"]').element.tagName).toBe(
      "BUTTON",
    );
    expect(wrapper.find('[data-streamdown="image-wrapper"]').exists()).toBe(
      true,
    );
  });
});
