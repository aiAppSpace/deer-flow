import { mount, flushPromises } from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";
import { describe, expect, it } from "vitest";
import MarkdownLink from "@/components/chat/MarkdownLink.vue";
import { provideKnowledgeSources } from "@/components/chat/knowledge-sources-context";
import type { Message } from "@/core/types/message";

describe("message Markdown knowledge destinations", () => {
  it("uses native tool evidence through the shared link and revokes it on conversation change", async () => {
    const id = "0123456789abcdef0123456789abcdef-1";
    const messages = ref([
      {
        type: "tool",
        name: "knowledge_search",
        tool_call_id: "tool",
        content: "retrieved",
        artifact: {
          knowledge_sources: {
            version: 1,
            sources: [
              {
                id,
                provider: "ragflow",
                document_name: "Manual.pdf",
                dataset_name: "Engineering",
                text: "42",
                truncated: false,
                pages: [],
              },
            ],
          },
        },
      },
    ] as unknown as Message[]);
    const wrapper = mount(
      defineComponent({
        setup() {
          provideKnowledgeSources(messages);
          return () =>
            h(
              MarkdownLink,
              { href: `#user-content-knowledge-${id}` },
              () => "citation:1",
            );
        },
      }),
    );
    expect(
      wrapper.get('button[aria-label="View source: Manual.pdf"]').text(),
    ).toBe("1");
    expect(wrapper.find("a").exists()).toBe(false);
    messages.value = [];
    await flushPromises();
    expect(wrapper.find("button").exists()).toBe(false);
    expect(wrapper.text()).toBe("1");
    wrapper.unmount();
  });
});
