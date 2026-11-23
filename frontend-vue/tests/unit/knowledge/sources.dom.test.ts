import {
  DOMWrapper,
  flushPromises,
  mount,
  type VueWrapper,
} from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";
import { afterEach, describe, expect, it } from "vitest";
import KnowledgeCitationLink from "@/components/chat/KnowledgeCitationLink.vue";
import KnowledgeSourcesPanel from "@/components/chat/KnowledgeSourcesPanel.vue";
import KnowledgeScopeSummary from "@/components/chat/KnowledgeScopeSummary.vue";
import { provideKnowledgeSources } from "@/components/chat/knowledge-sources-context";
import type { Message } from "@/core/types/message";

const id = "0123456789abcdef0123456789abcdef-1";
const href = `#knowledge-${id}`;
const source = {
  id,
  provider: "ragflow",
  document_name: "Manual.pdf",
  dataset_name: "Engineering",
  text: "Limit: 42.\n<script>unsafe</script>",
  truncated: true,
  pages: [3],
};
const messages = [
  {
    type: "tool",
    name: "knowledge_search",
    content: "retrieved",
    tool_call_id: "call",
    artifact: { knowledge_sources: { version: 1, sources: [source] } },
  },
] as unknown as Message[];
let wrapper: VueWrapper;
afterEach(() => {
  wrapper?.unmount();
  document.body.innerHTML = "";
});

describe("knowledge source display", () => {
  it("opens trusted persisted tool evidence as inert text and loses access when conversations change", async () => {
    const items = ref<Message[]>(JSON.parse(JSON.stringify(messages)));
    wrapper = mount(
      defineComponent({
        setup() {
          provideKnowledgeSources(items);
          return () =>
            h("div", [
              h(KnowledgeCitationLink, { href }, () => "1"),
              h(KnowledgeSourcesPanel, { content: `[citation:1](${href})` }),
            ]);
        },
      }),
      { attachTo: document.body },
    );
    expect(
      wrapper.findAll('button[aria-label="View source: Manual.pdf"]'),
    ).toHaveLength(2);
    await wrapper.findAll("button")[0]!.trigger("click");
    await flushPromises();
    const dialog = new DOMWrapper(document.body).get('[role="dialog"]');
    expect(dialog.text()).toContain("Pages 3");
    expect(dialog.text()).toContain("Limit: 42.");
    expect(dialog.find("script").exists()).toBe(false);
    items.value = [];
    await flushPromises();
    expect(
      wrapper.find('button[aria-label="View source: Manual.pdf"]').exists(),
    ).toBe(false);
    expect(
      wrapper
        .find(
          '[title="Source evidence is unavailable in the loaded conversation."]',
        )
        .exists(),
    ).toBe(true);
  });
  it("summarizes the exact persisted human snapshot rather than live scope", () => {
    wrapper = mount(KnowledgeScopeSummary, {
      props: {
        additionalKwargs: {
          knowledge_scope: {
            version: 1,
            mode: "selected",
            dataset_ids: ["base"],
            document_filters: [{ dataset_id: "base", document_ids: ["doc"] }],
            display: {
              datasets: [
                {
                  id: "base",
                  name: "Policies",
                  documents: [{ id: "doc", name: "Guide.pdf" }],
                },
              ],
            },
          },
        },
      },
    });
    expect(
      wrapper.get('[data-testid="message-knowledge-scope"]').text(),
    ).toContain("Policies · Guide.pdf");
  });
});
