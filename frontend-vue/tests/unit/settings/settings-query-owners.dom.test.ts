/*
  【文件职责】     固定Memory/Skills/MCP 的唯一 Vue Query owner、权限与精确 mutation。
  【架构位置】     Vue composable DOM test
  【主要导出】     无；Vitest cases
  【依赖关系】     useMemory · useSkillSettings · useScopedMCPConfig · Vue Query
  【边界与注意】   不做 optimistic 成功；成功响应与 authoritative re-read 才更新同一 key。
*/

import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useScopedMCPConfig } from "@/composables/useScopedMCPConfig";
import { useMemory } from "@/composables/useMemory";
import { useSkillSettings } from "@/composables/useSkillSettings";
import {
  SKILLS_QUERY_KEY,
  useSkillsCatalog,
} from "@/composables/useSkillsCatalog";
import { MEMORY_QUERY_KEY } from "@/core/memory/query-keys";
import type { UserMemory } from "@/core/memory/types";

const memoryApi = vi.hoisted(() => ({
  loadMemory: vi.fn(),
  clearMemory: vi.fn(),
  createMemoryFact: vi.fn(),
  deleteMemoryFact: vi.fn(),
  importMemory: vi.fn(),
  updateMemoryFact: vi.fn(),
}));
const skillsApi = vi.hoisted(() => ({
  loadSkills: vi.fn(),
  enableSkill: vi.fn(),
}));
const mcpUser = ref({ id: "settings-owner", system_role: "admin" });
vi.mock("@/composables/useCapabilities", () => ({
  useCapabilityUser: () => mcpUser,
}));

const mcpApi = vi.hoisted(() => ({
  loadMCPConfig: vi.fn(),
  updateMCPServerState: vi.fn(),
}));

vi.mock("@/core/memory/api", () => memoryApi);
vi.mock("@/core/skills/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/core/skills/api")>()),
  loadSkills: skillsApi.loadSkills,
  enableSkill: skillsApi.enableSkill,
}));
vi.mock("@/core/mcp/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/core/mcp/api")>()),
  loadMCPConfig: mcpApi.loadMCPConfig,
  updateMCPServerState: mcpApi.updateMCPServerState,
}));

const memory: UserMemory = {
  version: "2.0",
  lastUpdated: "2026-08-22",
  user: {
    workContext: { summary: "", updatedAt: "" },
    personalContext: { summary: "", updatedAt: "" },
    topOfMind: { summary: "", updatedAt: "" },
    cognitiveStyle: { summary: "", updatedAt: "" },
  },
  history: {
    recentMonths: { summary: "", updatedAt: "" },
    earlierContext: { summary: "", updatedAt: "" },
    longTermBackground: { summary: "", updatedAt: "" },
  },
  facts: [],
};

function host(setupOwner: () => unknown) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  let owner: unknown;
  const Host = defineComponent({
    setup() {
      owner = setupOwner();
      return () => h("div");
    },
  });
  const wrapper = mount(Host, {
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  });
  return {
    get owner() {
      return owner;
    },
    queryClient,
    wrapper,
  };
}

afterEach(() => vi.clearAllMocks());

describe("memory query owner", () => {
  it("does not publish a late mutation response after disposal even when transport ignores abort", async () => {
    memoryApi.loadMemory.mockResolvedValue(memory);
    let finish!: (value: UserMemory) => void;
    memoryApi.clearMemory.mockReturnValue(
      new Promise<UserMemory>((resolve) => {
        finish = resolve;
      }),
    );
    const mounted = host(useMemory);
    await flushPromises();
    const owner = mounted.owner as ReturnType<typeof useMemory>;
    const settled = owner.clear.mutateAsync().catch((error: unknown) => error);
    await vi.waitFor(() =>
      expect(memoryApi.clearMemory).toHaveBeenCalledOnce(),
    );
    const signal = memoryApi.clearMemory.mock.calls[0]![0]
      .signal as AbortSignal;
    mounted.wrapper.unmount();
    mounted.queryClient.clear();
    mounted.queryClient.setQueryData(MEMORY_QUERY_KEY, {
      ...memory,
      revision: 2,
    });
    expect(signal.aborted).toBe(true);
    finish({ ...memory, revision: 1 });
    expect(await settled).toMatchObject({ name: "AbortError" });
    expect(mounted.queryClient.getQueryData(MEMORY_QUERY_KEY)).toMatchObject({
      revision: 2,
    });
  });
  it("uses one key, sends explicit zero, preserves response metadata, and aborts on dispose", async () => {
    const querySignal = ref<AbortSignal | null>(null);
    memoryApi.loadMemory.mockImplementation(
      ({ signal }: { signal: AbortSignal }) => {
        querySignal.value = signal;
        return new Promise<UserMemory>(() => undefined);
      },
    );
    memoryApi.updateMemoryFact.mockResolvedValue({
      ...memory,
      revision: 10,
      facts: [
        {
          id: "fact-a",
          content: "fact",
          category: "contract",
          confidence: 0,
          createdAt: "",
          source: "manual",
          revision: 2,
          model: "kept",
        },
      ],
    });
    const mounted = host(() => useMemory());
    await flushPromises();
    const owner = mounted.owner as ReturnType<typeof useMemory>;
    await owner.update.mutateAsync({
      factId: "fact-a",
      input: { confidence: 0 },
    });
    expect(memoryApi.updateMemoryFact).toHaveBeenCalledWith(
      "fact-a",
      { confidence: 0 },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(mounted.queryClient.getQueryData(MEMORY_QUERY_KEY)).toMatchObject({
      revision: 10,
      facts: [{ revision: 2, model: "kept", confidence: 0 }],
    });
    mounted.wrapper.unmount();
    expect(querySignal.value?.aborted).toBe(true);
  });
});

describe("skills settings owner", () => {
  it("shares SKILLS_QUERY_KEY with the composer and blocks non-admin PUT", async () => {
    skillsApi.loadSkills.mockResolvedValue([
      {
        name: "review",
        description: "Review",
        category: "public",
        license: null,
        enabled: true,
        editable: false,
      },
    ]);
    const canManage = ref(false);
    const mounted = host(() => ({
      composer: useSkillsCatalog(),
      settings: useSkillSettings({ canManage }),
    }));
    await flushPromises();
    expect(skillsApi.loadSkills).toHaveBeenCalledTimes(1);
    const owner = mounted.owner as {
      settings: ReturnType<typeof useSkillSettings>;
    };
    await expect(owner.settings.toggle("review", false)).rejects.toMatchObject({
      name: "SettingsPermissionError",
    });
    expect(skillsApi.enableSkill).not.toHaveBeenCalled();
    expect(mounted.queryClient.getQueryData(SKILLS_QUERY_KEY)).toHaveLength(1);
    mounted.wrapper.unmount();
  });

  it("sends one admin PUT and performs an authoritative re-read without optimistic drift", async () => {
    const before = {
      name: "review",
      description: "Review",
      category: "public",
      license: null,
      enabled: true,
      editable: false,
    };
    const after = { ...before, enabled: false };
    skillsApi.loadSkills
      .mockResolvedValueOnce([before])
      .mockResolvedValue([after]);
    skillsApi.enableSkill.mockResolvedValue(after);
    const mounted = host(() => useSkillSettings({ canManage: ref(true) }));
    await flushPromises();
    const owner = mounted.owner as ReturnType<typeof useSkillSettings>;
    const first = owner.toggle("review", false);
    const duplicate = owner.toggle("review", false);
    await first;
    await duplicate;
    expect(skillsApi.enableSkill).toHaveBeenCalledTimes(1);
    expect(skillsApi.enableSkill).toHaveBeenCalledWith(
      "review",
      false,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(skillsApi.loadSkills.mock.calls.length).toBeGreaterThan(1);
    expect(mounted.queryClient.getQueryData(SKILLS_QUERY_KEY)).toEqual([after]);
    mounted.wrapper.unmount();
  });
});

describe("MCP settings owner", () => {
  it("does not GET or PATCH for a known non-admin", async () => {
    mcpUser.value = { id: "settings-member", system_role: "user" };
    const mounted = host(() => useScopedMCPConfig("deployment"));
    await flushPromises();
    expect(mcpApi.loadMCPConfig).not.toHaveBeenCalled();
    const owner = mounted.owner as ReturnType<typeof useScopedMCPConfig>;
    await expect(
      owner.mutation.mutateAsync({
        operation: "toggle",
        serverName: "server-a",
        enabled: false,
      }),
    ).rejects.toThrow("Admin");
    expect(mcpApi.updateMCPServerState).not.toHaveBeenCalled();
    mounted.wrapper.unmount();
  });

  it("sends one scoped admin PATCH and re-reads the real config", async () => {
    const before = {
      mcp_servers: {
        "server-a": { enabled: true, description: "Server A" },
      },
    };
    const after = {
      mcp_servers: {
        "server-a": { enabled: false, description: "Server A" },
      },
    };
    mcpApi.loadMCPConfig.mockResolvedValueOnce(before).mockResolvedValue(after);
    mcpApi.updateMCPServerState.mockResolvedValue(after);
    mcpUser.value = { id: "settings-owner", system_role: "admin" };
    const mounted = host(() => useScopedMCPConfig("deployment"));
    await flushPromises();
    const owner = mounted.owner as ReturnType<typeof useScopedMCPConfig>;
    const first = owner.mutation.mutateAsync({
      operation: "toggle",
      serverName: "server-a",
      enabled: false,
    });
    await first;
    expect(mcpApi.updateMCPServerState).toHaveBeenCalledTimes(1);
    expect(mcpApi.updateMCPServerState).toHaveBeenCalledWith(
      "server-a",
      false,
      expect.objectContaining({
        scope: "deployment",
        signal: expect.any(AbortSignal),
      }),
    );
    expect(mcpApi.loadMCPConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: "deployment",
        signal: expect.any(AbortSignal),
      }),
    );
    expect(mcpApi.loadMCPConfig).toHaveBeenCalledTimes(2);
    expect(
      mounted.queryClient.getQueryData([
        "mcpConfig",
        "deployment",
        "settings-owner",
      ]),
    ).toEqual(after);
    mounted.wrapper.unmount();
  });
});
