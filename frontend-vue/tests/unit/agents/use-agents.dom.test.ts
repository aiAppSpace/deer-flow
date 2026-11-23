/*
  【文件职责】     固定Agent Vue Query 的 feature gate、single owner 与 mutation cache sync。
  【架构位置】     Vue composable DOM test
  【主要导出】     无；Vitest cases
  【依赖关系】     useAgents · QueryClient · mocked Agent API
  【边界与注意】   disabled 不请求；query retry=false；更新/删除通过同一 query identity 回写并失效。
*/

import { VueQueryPlugin, QueryClient } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useAgents } from "@/composables/useAgents";
import { agentKeys } from "@/core/agents/query-keys";
import type { Agent } from "@/core/agents/types";
import { resetWorkspaceQueries } from "@/core/auth/workspace-queries";

const api = vi.hoisted(() => ({
  list: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  importPackage: vi.fn(),
}));

vi.mock("@/core/agents/api", () => ({
  listAgents: api.list,
  updateAgent: api.update,
  deleteAgent: api.remove,
  importAgentPackage: api.importPackage,
}));

const original: Agent = {
  name: "reviewer",
  description: "Reviews code",
  model: null,
  tool_groups: null,
  skills: null,
};

function harness(initialEnabled = false) {
  const enabled = ref(initialEnabled);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  let owner!: ReturnType<typeof useAgents>;
  const Host = defineComponent({
    setup() {
      owner = useAgents({ enabled });
      return () =>
        h(
          "div",
          owner.agents.value.map((agent) => agent.name),
        );
    },
  });
  const wrapper = mount(Host, {
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  });
  return { enabled, owner, queryClient, wrapper };
}

afterEach(() => vi.clearAllMocks());

describe("useAgents", () => {
  it("does not repopulate the next account cache with a late import", async () => {
    api.list.mockResolvedValue([original]);
    let release!: (value: Agent) => void;
    api.importPackage.mockReturnValueOnce(
      new Promise<Agent>((resolve) => {
        release = resolve;
      }),
    );
    const { owner, queryClient, wrapper } = harness(true);
    await flushPromises();
    const pending = owner.importPackage.mutateAsync({ agentPackage: {} });
    await flushPromises();
    await resetWorkspaceQueries(queryClient);
    queryClient.setQueryData(agentKeys.list(), [
      { ...original, name: "next-account" },
    ]);
    release({ ...original, name: "old-account-import" });
    await pending;
    expect(
      queryClient.getQueryData(agentKeys.detail("old-account-import")),
    ).toBeUndefined();
    expect(queryClient.getQueryData(agentKeys.list())).toEqual([
      { ...original, name: "next-account" },
    ]);
    wrapper.unmount();
  });
  it("only invalidates the catalog after a successful create-only import and preserves existing rows on conflict", async () => {
    api.list.mockResolvedValue([original]);
    const { owner, queryClient, wrapper } = harness(true);
    await flushPromises();
    const conflict = Object.assign(new Error("Already exists"), {
      status: 409,
    });
    api.importPackage.mockRejectedValueOnce(conflict);
    await expect(
      owner.importPackage.mutateAsync({ agentPackage: {}, name: "reviewer" }),
    ).rejects.toBe(conflict);
    expect(queryClient.getQueryData(agentKeys.list())).toEqual([original]);
    expect(api.list).toHaveBeenCalledTimes(1);
    const imported = { ...original, name: "new-reviewer" };
    api.importPackage.mockResolvedValueOnce(imported);
    api.list.mockResolvedValueOnce([original, imported]);
    await owner.importPackage.mutateAsync({
      agentPackage: { version: 1 },
      name: imported.name,
    });
    expect(queryClient.getQueryData(agentKeys.detail(imported.name))).toEqual(
      imported,
    );
    expect(queryClient.getQueryData(agentKeys.list())).toEqual([
      original,
      imported,
    ]);
    wrapper.unmount();
  });
  it("does not request before the feature is ready and performs one list when enabled", async () => {
    api.list.mockResolvedValue([original]);
    const { enabled, wrapper } = harness();
    await flushPromises();
    expect(api.list).not.toHaveBeenCalled();

    enabled.value = true;
    await flushPromises();
    expect(api.list).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain("reviewer");
    wrapper.unmount();
  });

  it("syncs update and delete through the shared list/detail query keys", async () => {
    const updated = { ...original, model: "reasoning" };
    api.list.mockResolvedValue([original]);
    api.update.mockResolvedValue(updated);
    api.remove.mockResolvedValue(undefined);
    const { owner, queryClient, wrapper } = harness(true);
    await flushPromises();

    await owner.update.mutateAsync({
      agent: original,
      request: { model: "reasoning" },
    });
    expect(queryClient.getQueryData(agentKeys.detail("reviewer"))).toEqual(
      updated,
    );

    api.list.mockResolvedValue([]);
    await owner.remove.mutateAsync(updated);
    expect(
      queryClient.getQueryData(agentKeys.detail("reviewer")),
    ).toBeUndefined();
    expect(queryClient.getQueryData(agentKeys.list())).toEqual([]);
    wrapper.unmount();
  });
});
