import { focusManager, QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AgentWelcome from "@/components/chat/AgentWelcome.vue";
import { useAgents } from "@/composables/useAgents";
import { useChatAgent } from "@/composables/useChatAgent";
import { agentKeys } from "@/core/agents/query-keys";
import type { Agent } from "@/core/agents/types";

const api = vi.hoisted(() => ({
  get: vi.fn(),
  list: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  importPackage: vi.fn(),
}));
vi.mock("@/core/agents/api", () => ({
  getAgent: api.get,
  listAgents: api.list,
  updateAgent: api.update,
  deleteAgent: api.remove,
  importAgentPackage: api.importPackage,
}));

const original: Agent = {
  name: "reviewer",
  display_name: "Original reviewer",
  description: "Reviews code",
  model: "original-model",
  tool_groups: null,
  skills: null,
};
const cleanups: (() => void)[] = [];

function setup({ bootstrap = false, consumers = 1 } = {}) {
  // The hook's public focus contract must also hold for an independent client.
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
    },
  });
  const creating = ref(bootstrap);
  const userId = ref("alice");
  const count = ref(consumers);
  const states: ReturnType<typeof useChatAgent>[] = [];
  let catalog!: ReturnType<typeof useAgents>;
  const Detail = defineComponent({
    setup() {
      const state = useChatAgent({
        agentName: "reviewer",
        userId,
        demo: false,
        bootstrap: creating,
        queryClient,
      });
      states.push(state);
      const { agent, resolved } = state;
      return () =>
        h("article", [
          h(AgentWelcome, { agent: agent.value, agentName: "reviewer" }),
          h(
            "output",
            { "data-resolved": resolved.value },
            agent.value?.model ?? "",
          ),
        ]);
    },
  });
  const Host = defineComponent({
    setup() {
      catalog = useAgents({ enabled: false });
      return () =>
        h(
          "section",
          Array.from({ length: count.value }, (_, key) => h(Detail, { key })),
        );
    },
  });
  const wrapper = mount(Host, {
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  });
  cleanups.push(() => {
    wrapper.unmount();
    queryClient.clear();
  });
  return { wrapper, queryClient, catalog, creating, userId, count, states };
}

beforeEach(() => {
  vi.resetAllMocks();
  api.get.mockResolvedValue(original);
  api.list.mockResolvedValue([original]);
});
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  focusManager.setFocused(undefined);
});

describe("chat Agent consumes the shared detail query", () => {
  it("renders a settings mutation from the existing detail key without a second read", async () => {
    const { wrapper, catalog, queryClient } = setup();
    await flushPromises();
    expect(wrapper.text()).toContain("Original reviewer");
    const updated = {
      ...original,
      display_name: "Updated reviewer",
      model: "next-model",
    };
    api.update.mockResolvedValueOnce(updated);
    await catalog.update.mutateAsync({
      agent: original,
      request: { model: "next-model" },
    });
    await flushPromises();
    expect(queryClient.getQueryData(agentKeys.detail("reviewer"))).toEqual(
      updated,
    );
    expect(wrapper.text()).toContain("Updated reviewer");
    expect(wrapper.get("output").text()).toBe("next-model");
    expect(api.get).toHaveBeenCalledTimes(1);
  });

  it("refreshes the mounted detail on focus while preserving its settled content", async () => {
    const { wrapper } = setup();
    await flushPromises();
    focusManager.setFocused(false);
    let finish!: (agent: Agent) => void;
    api.get.mockImplementationOnce(
      () =>
        new Promise<Agent>((resolve) => {
          finish = resolve;
        }),
    );
    focusManager.setFocused(true);
    await flushPromises();
    expect(api.get).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain("Original reviewer");
    expect(wrapper.get("output").attributes("data-resolved")).toBe("true");
    finish({ ...original, display_name: "Edited in another window" });
    await flushPromises();
    expect(wrapper.text()).toContain("Edited in another window");
  });

  it("deduplicates concurrent detail consumers through the canonical query key", async () => {
    const { wrapper, queryClient } = setup({ consumers: 2 });
    await flushPromises();
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(
      queryClient
        .getQueryCache()
        .find({ queryKey: agentKeys.detail("reviewer"), exact: true })
        ?.getObserversCount(),
    ).toBe(2);
    expect(wrapper.findAll("article")).toHaveLength(2);
    expect(wrapper.findAll(".font-bold").map((node) => node.text())).toEqual([
      "Original reviewer",
      "Original reviewer",
    ]);
  });

  it("displays a verified bootstrap cache publication without acquiring its own read", async () => {
    const { wrapper, queryClient } = setup({ bootstrap: true });
    await flushPromises();
    queryClient.setQueryData(agentKeys.detail("reviewer"), original);
    await flushPromises();
    expect(api.get).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("Original reviewer");
    focusManager.setFocused(false);
    focusManager.setFocused(true);
    await queryClient.invalidateQueries({
      queryKey: agentKeys.detail("reviewer"),
      exact: true,
    });
    await flushPromises();
    expect(api.get).not.toHaveBeenCalled();
  });

  it("refetches an explicitly invalidated mounted detail through the same observer", async () => {
    const { wrapper, queryClient } = setup();
    await flushPromises();
    api.get.mockResolvedValueOnce({
      ...original,
      display_name: "Invalidated reviewer",
    });
    await queryClient.invalidateQueries({
      queryKey: agentKeys.detail("reviewer"),
      exact: true,
    });
    await flushPromises();
    expect(api.get).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain("Invalidated reviewer");
  });

  it("retires cached account data synchronously and rejects an A→B→A late response", async () => {
    const { wrapper, userId, states } = setup();
    await flushPromises();
    const pending: { signal: AbortSignal; finish: (agent: Agent) => void }[] =
      [];
    api.get.mockImplementation(
      (_name, options) =>
        new Promise<Agent>((finish) => {
          pending.push({ signal: options.signal, finish });
        }),
    );
    userId.value = "bob";
    expect(states[0]!.agent.value).toBeNull();
    await flushPromises();
    expect(wrapper.text()).not.toContain("Original reviewer");
    userId.value = "alice";
    await flushPromises();
    expect(pending[0]!.signal.aborted).toBe(true);
    pending[1]!.finish({ ...original, display_name: "New Alice reviewer" });
    await flushPromises();
    pending[0]!.finish({ ...original, display_name: "Private Bob reviewer" });
    await flushPromises();
    expect(wrapper.text()).toContain("New Alice reviewer");
    expect(wrapper.text()).not.toContain("Private Bob reviewer");
  });

  it("keeps a shared request alive until the final detail consumer unmounts", async () => {
    let signal!: AbortSignal;
    api.get.mockImplementationOnce((_name, options) => {
      signal = options.signal;
      return new Promise<Agent>(() => undefined);
    });
    const { wrapper, count } = setup({ consumers: 2 });
    count.value = 1;
    await flushPromises();
    expect(signal.aborted).toBe(false);
    expect(api.get).toHaveBeenCalledTimes(1);
    wrapper.unmount();
    expect(signal.aborted).toBe(true);
  });

  it("exposes an unknown initial error while settling the unavailable Agent", async () => {
    const error = Object.assign(new Error("Unknown Gateway failure"), {
      detail: { code: "future_code" },
    });
    api.get.mockRejectedValueOnce(error);
    const { states, wrapper } = setup();
    await flushPromises();
    expect(states[0]!.error.value).toBe(error);
    expect(states[0]!.agent.value).toBeNull();
    expect(states[0]!.resolved.value).toBe(true);
    expect(wrapper.text()).not.toContain("Original reviewer");
    expect(api.get).toHaveBeenCalledTimes(1);
  });

  it("retains settled Agent data when a background focus refresh fails", async () => {
    const { states, wrapper } = setup();
    await flushPromises();
    const error = new Error("Refresh unavailable");
    api.get.mockRejectedValueOnce(error);
    focusManager.setFocused(false);
    focusManager.setFocused(true);
    await flushPromises();
    expect(api.get).toHaveBeenCalledTimes(2);
    expect(states[0]!.error.value).toBe(error);
    expect(states[0]!.resolved.value).toBe(true);
    expect(wrapper.text()).toContain("Original reviewer");
  });
});
