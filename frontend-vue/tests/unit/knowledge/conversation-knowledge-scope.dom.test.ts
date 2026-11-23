import { flushPromises, mount } from "@vue/test-utils";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { computed, defineComponent, h, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import KnowledgeScopeSelector from "@/components/workspace/KnowledgeScopeSelector.vue";
import { useConversationKnowledgeScope } from "@/composables/useConversationKnowledgeScope";
import type { Agent } from "@/core/agents/types";
import { enUS } from "@/core/i18n";

const selected = (id: string) => ({
  version: 1 as const,
  mode: "selected" as const,
  dataset_ids: [id],
  display: { datasets: [{ id, name: `Base ${id}` }] },
});
const definition = (id = "policy"): Agent => ({
  name: "researcher",
  description: "",
  model: null,
  tool_groups: ["knowledge"],
  skills: null,
  knowledge_scope: selected(id),
});
const cleanups: (() => void)[] = [];
function setup(custom = true) {
  const agent = ref<Agent | null>(null);
  const agentName = ref<string | null>(custom ? "researcher" : null);
  const userId = ref("alice");
  const threadId = ref<string | null>(null);
  const conversationId = computed(() => threadId.value ?? "draft-a");
  const isNewConversation = computed(() => threadId.value === null);
  const visible = ref(true);
  let owner!: ReturnType<typeof useConversationKnowledgeScope>;
  const Host = defineComponent({
    setup() {
      owner = useConversationKnowledgeScope({
        agent,
        agentName,
        userId,
        conversationId,
        isNewConversation,
        visible,
      });
      return () =>
        owner.selection.value
          ? h(KnowledgeScopeSelector, {
              agentName: agentName.value ?? "lead_agent",
              selection: owner.selection.value,
              onChange: (value) => {
                owner.selection.value = value;
              },
            })
          : null;
    },
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = mount(Host, {
    global: { plugins: [[VueQueryPlugin, { queryClient: client }]] },
  });
  cleanups.push(() => {
    wrapper.unmount();
    client.clear();
  });
  return { agent, agentName, userId, threadId, visible, owner, wrapper };
}
beforeEach(() =>
  vi.stubGlobal("useNuxtApp", () => ({
    $i18n: { t: computed(() => enUS), locale: ref("en-US") },
  })),
);
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  vi.unstubAllGlobals();
});

describe("conversation knowledge default ownership", () => {
  it("inherits a late Agent definition and retains the current turn's explicit opt-out", async () => {
    const state = setup();
    expect(state.owner.snapshot.value).toBeNull();
    state.agent.value = definition();
    await flushPromises();
    expect(
      state.wrapper
        .get('[data-testid="knowledge-scope-trigger"]')
        .attributes("aria-label"),
    ).toBe("Knowledge · 1 base");
    expect(state.owner.snapshot.value?.dataset_ids).toEqual(["policy"]);
    state.owner.selection.value = { mode: "disabled" };
    state.agent.value = definition("changed-default");
    await flushPromises();
    expect(state.owner.snapshot.value).toEqual({
      version: 1,
      mode: "disabled",
    });
    expect(
      state.wrapper
        .get('[data-testid="knowledge-scope-trigger"]')
        .attributes("aria-label"),
    ).toBe(enUS.knowledge.scope.buttonDisabled);
  });

  it("preserves the submitted draft on adoption, and resets on conversation, Agent or account changes", async () => {
    const state = setup();
    state.agent.value = definition();
    state.owner.selection.value = { mode: "disabled" };
    state.threadId.value = "saved-thread";
    await flushPromises();
    expect(state.owner.snapshot.value?.mode).toBe("disabled");
    state.threadId.value = "other-history";
    expect(state.owner.snapshot.value?.dataset_ids).toEqual(["policy"]);
    state.owner.selection.value = { mode: "disabled" };
    state.userId.value = "bob";
    state.agent.value = null;
    expect(state.owner.snapshot.value).toBeNull();
    state.agent.value = definition("bob-private");
    expect(state.owner.snapshot.value?.dataset_ids).toEqual(["bob-private"]);
    state.agentName.value = "different-agent";
    expect(state.owner.snapshot.value).toBeNull();
    state.agent.value = { ...definition("different"), name: "different-agent" };
    expect(state.owner.snapshot.value?.dataset_ids).toEqual(["different"]);
  });

  it("does not send knowledge for an Agent without the knowledge tool group", () => {
    const state = setup();
    state.agent.value = { ...definition(), tool_groups: [] };
    expect(state.owner.agentKnowledgeEnabled.value).toBe(false);
    expect(state.owner.snapshot.value).toBeNull();
    state.agent.value = { ...definition(), tool_groups: null };
    expect(state.owner.agentKnowledgeEnabled.value).toBe(true);
    expect(state.owner.snapshot.value?.dataset_ids).toEqual(["policy"]);
  });

  it("clears ordinary-chat choices when the feature disappears and retains custom-Agent overrides", () => {
    const ordinary = setup(false);
    ordinary.owner.selection.value = { mode: "disabled" };
    ordinary.visible.value = false;
    expect(ordinary.owner.snapshot.value).toBeNull();
    ordinary.visible.value = true;
    expect(ordinary.owner.selection.value).toEqual({ mode: "all" });
    const custom = setup();
    custom.agent.value = definition();
    custom.owner.selection.value = { mode: "disabled" };
    custom.visible.value = false;
    custom.visible.value = true;
    expect(custom.owner.snapshot.value?.mode).toBe("disabled");
  });
});
