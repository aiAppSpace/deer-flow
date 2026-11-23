import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  usage: vi.fn(),
  threads: vi.fn(),
  changes: vi.fn(),
}));
vi.mock("@/core/threads/api", () => ({
  fetchThreadTokenUsage: api.usage,
  patchThreadMetadata: vi.fn(),
}));
vi.mock("@/core/api/api-client", () => ({
  getAPIClient: () => ({ threads: {} }),
}));
vi.mock("@/core/threads/infinite", async (original) => ({
  ...(await original<typeof import("@/core/threads/infinite")>()),
  fetchInfiniteThreadsPage: api.threads,
}));
vi.mock("@/core/workspace-changes/api", () => ({
  fetchWorkspaceChanges: api.changes,
}));
vi.mock("@/core/auth/auth-disabled-user", () => ({
  isAuthDisabledMode: () => false,
}));
vi.mock("@/core/settings/user-preferences", () => ({
  startUserPreferences: () => Object.assign(vi.fn(), { activate: vi.fn() }),
}));
import { useThreadTokenUsage } from "@/composables/useThreadTokenUsage";
import { useThreads } from "@/composables/useThreads";
import { useWorkspaceChanges } from "@/composables/useWorkspaceChanges";
import UserPreferencesBoundary from "@/core/settings/UserPreferencesBoundary.vue";

const wrappers: VueWrapper[] = [];
const clients: QueryClient[] = [];
function client() {
  const result = new QueryClient({
    defaultOptions: {
      queries: {
        // Exercise every deliberate exception against the React focus default.
        refetchOnWindowFocus: true,
        retry: (count, error) => count < 3 && error instanceof TypeError,
      },
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
        return () => h("output");
      },
    }),
    { global: { plugins: [[VueQueryPlugin, { queryClient }]] } },
  );
  wrappers.push(wrapper);
  return { owner, wrapper, queryClient };
}
function visibility(state: "hidden" | "visible") {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: state,
  });
  document.dispatchEvent(new Event("visibilitychange", { bubbles: true }));
}
function focus() {
  visibility("hidden");
  visibility("visible");
}
beforeEach(() => {
  vi.clearAllMocks();
  visibility("visible");
  api.usage.mockResolvedValue({ thread_id: "thread-a", total_input_tokens: 1 });
  api.threads.mockResolvedValue([]);
  api.changes.mockResolvedValue({ summary: { id: "summary" } });
});
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  clients.splice(0).forEach((queryClient) => queryClient.clear());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("explicit query policies remain independent of global focus defaults", () => {
  it("token usage does not refetch on focus and retains the same-thread placeholder fence", async () => {
    const thread = ref("thread-a");
    const { owner } = observe(() => useThreadTokenUsage(thread));
    await vi.waitFor(() =>
      expect(owner.usage.value?.thread_id).toBe("thread-a"),
    );
    focus();
    await flushPromises();
    expect(api.usage).toHaveBeenCalledTimes(1);
    api.usage.mockReturnValue(new Promise(() => undefined));
    thread.value = "thread-b";
    await flushPromises();
    expect(owner.usage.value).toBeNull();
    expect(api.usage).toHaveBeenCalledTimes(2);
  });
  it("token usage never retries even transient transport failures", async () => {
    api.usage.mockRejectedValue(new TypeError("connection reset"));
    const { owner } = observe(() => useThreadTokenUsage("thread-a"));
    await vi.waitFor(() => expect(owner.fetchStatus.value).toBe("idle"));
    expect(owner.isError.value).toBe(true);
    expect(api.usage).toHaveBeenCalledTimes(1);
  });
  it("infinite thread lists do not refetch pages on native focus", async () => {
    observe(useThreads);
    await vi.waitFor(() => expect(api.threads).toHaveBeenCalledTimes(1));
    await flushPromises();
    focus();
    await flushPromises();
    expect(api.threads).toHaveBeenCalledTimes(1);
  });
  it("workspace changes shares its five-minute freshness across remounts and does not refresh on focus", async () => {
    const queryClient = client();
    const factory = () =>
      useWorkspaceChanges({
        threadId: "thread-a",
        runId: "run-a",
        includeFiles: true,
        includeDiff: false,
        enabled: true,
      });
    const first = observe(factory, queryClient);
    await vi.waitFor(() => expect(first.owner.data.value).toBeDefined());
    const fetchedAt = Date.now();
    first.wrapper.unmount();
    observe(factory, queryClient);
    await flushPromises();
    expect(api.changes).toHaveBeenCalledTimes(1);
    focus();
    await flushPromises();
    expect(api.changes).toHaveBeenCalledTimes(1);
    vi.spyOn(Date, "now").mockReturnValue(fetchedAt + 5 * 60 * 1000 + 1);
    observe(factory, queryClient);
    await vi.waitFor(() => expect(api.changes).toHaveBeenCalledTimes(2));
  });
  it("the actual workspace session owner throttles visibility refreshes for sixty seconds", async () => {
    const now = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(now);
    const fetch = vi.fn(async () =>
      Response.json({
        id: "owner-a",
        email: "owner@example.test",
        system_role: "admin",
        needs_setup: false,
      }),
    );
    vi.stubGlobal("fetch", fetch);
    const queryClient = client();
    const wrapper = mount(UserPreferencesBoundary, {
      slots: { default: "workspace" },
      global: { plugins: [[VueQueryPlugin, { queryClient }]] },
    });
    wrappers.push(wrapper);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    await flushPromises();
    focus();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    await flushPromises();
    focus();
    await flushPromises();
    expect(fetch).toHaveBeenCalledTimes(2);
    clock.mockReturnValue(now + 59_999);
    focus();
    await flushPromises();
    expect(fetch).toHaveBeenCalledTimes(2);
    clock.mockReturnValue(now + 60_000);
    focus();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));
    wrapper.unmount();
    focus();
    await flushPromises();
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
