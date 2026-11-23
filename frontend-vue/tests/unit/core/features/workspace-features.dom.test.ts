import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/core/api/fetcher", () => ({ fetch: vi.fn() }));
vi.mock("@/core/config", () => ({ getBackendBaseURL: () => "" }));

import { fetch } from "@/core/api/fetcher";
import {
  useAgentsApiEnabled,
  useBrowserControlEnabled,
  useConversationReferencesCapability,
  useKnowledgeBaseEnabled,
  useMcpTasksEnabled,
  useSubagentBatchesCapability,
} from "@/composables/useWorkspaceFeatures";
import {
  useScheduledTasksFeature,
  useThreadActivityFeature,
} from "@/composables/useSchedulerFeatures";
import { FEATURES_QUERY_KEYS } from "@/core/features/query-keys";
import { resetWorkspaceQueries } from "@/core/auth/workspace-queries";

const mockedFetch = vi.mocked(fetch);
const wrappers: VueWrapper[] = [];
const clients: QueryClient[] = [];
function client() {
  const result = new QueryClient({
    defaultOptions: {
      queries: { retry: 3, gcTime: Infinity, refetchOnWindowFocus: false },
    },
  });
  clients.push(result);
  return result;
}
function observe<T>(factory: () => T, queryClient = client()) {
  let owner!: T;
  const wrapper = mount(
    defineComponent({
      setup() {
        owner = factory();
        return () => h("div");
      },
    }),
    {
      global: { plugins: [[VueQueryPlugin, { queryClient }]] },
    },
  );
  wrappers.push(wrapper);
  return { owner, wrapper, queryClient };
}
function response(feature: Record<string, unknown> = {}) {
  return new Response(
    JSON.stringify({ agents_api: { enabled: true }, ...feature }),
  );
}

beforeEach(() => {
  mockedFetch.mockReset();
  window.localStorage.clear();
});
afterEach(() => {
  for (const wrapper of wrappers.splice(0)) wrapper.unmount();
  for (const queryClient of clients.splice(0)) queryClient.clear();
});

describe("feature query ownership", () => {
  it("deduplicates concurrent observers of one flag but rechecks a later mount and other flags", async () => {
    let resolve!: (value: Response) => void;
    mockedFetch.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const queryClient = client();
    const first = observe(useBrowserControlEnabled, queryClient);
    const second = observe(useBrowserControlEnabled, queryClient);
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    expect(first.owner.isLoading.value).toBe(true);
    resolve(response({ browser_control: { enabled: true } }));
    await flushPromises();
    expect(first.owner.browserControlEnabled.value).toBe(true);
    expect(second.owner.loaded.value).toBe(true);
    mockedFetch.mockResolvedValueOnce(
      response({ browser_control: { enabled: false } }),
    );
    observe(useBrowserControlEnabled, queryClient);
    await flushPromises();
    expect(mockedFetch).toHaveBeenCalledTimes(2);
    expect(first.owner.enabled.value).toBe(false);
    mockedFetch.mockResolvedValueOnce(response());
    observe(useAgentsApiEnabled, queryClient);
    await flushPromises();
    expect(mockedFetch).toHaveBeenCalledTimes(3);
    expect(queryClient.getQueryData(FEATURES_QUERY_KEYS.browserControl)).toBe(
      false,
    );
    expect(queryClient.getQueryData(FEATURES_QUERY_KEYS.agentsApi)).toBe(true);
  });

  it("accepts reactive opt-out without public demo requests", async () => {
    const enabled = ref(false);
    const { owner } = observe(() => useBrowserControlEnabled({ enabled }));
    await flushPromises();
    expect(mockedFetch).not.toHaveBeenCalled();
    expect(owner.loaded.value).toBe(false);
    mockedFetch.mockResolvedValueOnce(
      response({ browser_control: { enabled: true } }),
    );
    enabled.value = true;
    await flushPromises();
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    expect(owner.enabled.value).toBe(true);
  });

  it("keeps independent pending/error defaults and does not retry discovery", async () => {
    mockedFetch.mockRejectedValue(new Error("503 offline"));
    const { owner } = observe(() => ({
      agents: useAgentsApiEnabled(),
      browser: useBrowserControlEnabled(),
      mcp: useMcpTasksEnabled(),
      batches: useSubagentBatchesCapability(),
      references: useConversationReferencesCapability(),
      knowledge: useKnowledgeBaseEnabled(),
      schedule: useScheduledTasksFeature(),
      activity: useThreadActivityFeature(),
    }));
    expect(owner.agents.agentsApiEnabled.value).toBe(true);
    expect(owner.schedule.available.value).toBe(true);
    expect(owner.schedule.running.value).toBe(true);
    expect(owner.schedule.toolEnabled.value).toBe(false);
    expect(owner.activity.available.value).toBe(false);
    await flushPromises();
    expect(mockedFetch).toHaveBeenCalledTimes(8);
    expect(owner.agents.loaded.value).toBe(true);
    expect(owner.browser.enabled.value).toBe(false);
    expect(owner.mcp.enabled.value).toBe(false);
    expect(owner.batches.capability.value).toEqual({
      repositoryAvailable: false,
      workerRunning: false,
      maxRunning: 0,
    });
    expect(owner.references.isSuccess.value).toBe(false);
    expect(owner.references.enabled.value).toBe(false);
    expect(owner.references.error.value).toBeInstanceOf(Error);
    expect(owner.knowledge.scopeSelectionEnabled.value).toBe(false);
    expect(owner.schedule.isLoading.value).toBe(false);
    expect(owner.schedule.minIntervalSeconds.value).toBe(60);
    expect(owner.activity.available.value).toBe(false);
  });

  it("retains the agents last definitive answer through a cold-start outage", async () => {
    window.localStorage.setItem("deerflow.features.agents_api", "false");
    mockedFetch.mockRejectedValueOnce(new Error("offline"));
    const { owner } = observe(useAgentsApiEnabled);
    await flushPromises();
    expect(owner.agentsApiEnabled.value).toBe(false);
    mockedFetch.mockResolvedValueOnce(response());
    await owner.refresh();
    expect(owner.agentsApiEnabled.value).toBe(true);
    expect(window.localStorage.getItem("deerflow.features.agents_api")).toBe(
      "true",
    );
  });

  it("distinguishes reference discovery failure from an authoritative disable and allows explicit retry", async () => {
    mockedFetch.mockRejectedValueOnce(new Error("offline"));
    const { owner } = observe(useConversationReferencesCapability);
    await flushPromises();
    expect(owner.isSuccess.value).toBe(false);
    mockedFetch.mockResolvedValueOnce(
      response({
        conversation_references: { enabled: false, max_references: 0 },
      }),
    );
    await owner.refetch();
    expect(owner.isSuccess.value).toBe(true);
    expect(owner.enabled.value).toBe(false);
    expect(owner.error.value).toBeNull();
    mockedFetch.mockResolvedValueOnce(
      response({
        conversation_references: { enabled: true, max_references: 4 },
      }),
    );
    await owner.refetch();
    expect(owner.enabled.value).toBe(true);
    mockedFetch.mockRejectedValueOnce(new Error("refresh failed"));
    await owner.refetch();
    expect(owner.enabled.value).toBe(false);
    expect(owner.isSuccess.value).toBe(false);
    expect(owner.maxReferences.value).toBe(4);
  });

  it("does not share live feature state across QueryClients", async () => {
    mockedFetch.mockResolvedValueOnce(
      response({ browser_control: { enabled: true } }),
    );
    const first = observe(useBrowserControlEnabled);
    await flushPromises();
    mockedFetch.mockRejectedValueOnce(new Error("offline"));
    const second = observe(useBrowserControlEnabled);
    await flushPromises();
    expect(first.owner.enabled.value).toBe(true);
    expect(second.owner.enabled.value).toBe(false);
  });

  it("retains verified browser state on refresh error without changing reference error policy", async () => {
    mockedFetch.mockResolvedValueOnce(
      response({ browser_control: { enabled: true } }),
    );
    const { owner } = observe(useBrowserControlEnabled);
    await flushPromises();
    mockedFetch.mockRejectedValueOnce(new Error("offline"));
    await owner.refetch();
    expect(owner.enabled.value).toBe(true);
    expect(owner.error.value).toBeInstanceOf(Error);
  });

  it("aborts discovery when its final observer is disposed", async () => {
    mockedFetch.mockReturnValueOnce(new Promise(() => {}));
    const { wrapper, queryClient } = observe(useBrowserControlEnabled);
    const signal = mockedFetch.mock.calls[0]?.[1]?.signal;
    wrapper.unmount();
    await flushPromises();
    expect(signal?.aborted).toBe(true);
    expect(
      queryClient.getQueryState(FEATURES_QUERY_KEYS.browserControl)
        ?.fetchStatus,
    ).toBe("idle");
  });

  it("cancels old discovery before resetting feature queries at an account boundary", async () => {
    let resolveOld!: (value: Response) => void;
    mockedFetch.mockReturnValueOnce(
      new Promise((done) => {
        resolveOld = done;
      }),
    );
    const previous = observe(useBrowserControlEnabled);
    const queryClient = previous.queryClient;
    const oldSignal = mockedFetch.mock.calls[0]?.[1]?.signal;
    mockedFetch.mockResolvedValueOnce(
      response({ browser_control: { enabled: false } }),
    );
    // The real account boundary retires private observers and all workspace
    // queries; its mounted component lifecycle is covered by workspace-query-boundary.
    previous.wrapper.unmount();
    await resetWorkspaceQueries(queryClient);
    const { owner } = observe(useBrowserControlEnabled, queryClient);
    expect(oldSignal?.aborted).toBe(true);
    resolveOld(response({ browser_control: { enabled: true } }));
    await flushPromises();
    expect(owner.enabled.value).toBe(false);
    expect(queryClient.getQueryData(FEATURES_QUERY_KEYS.browserControl)).toBe(
      false,
    );
    expect(mockedFetch).toHaveBeenCalledTimes(2);
  });
});
