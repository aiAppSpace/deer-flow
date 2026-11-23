import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({
  start: vi.fn(() => Object.assign(vi.fn(), { activate: vi.fn() })),
}));
vi.mock("@/core/auth/auth-disabled-user", () => ({
  isAuthDisabledMode: () => true,
}));
vi.mock("@/core/settings/user-preferences", () => ({
  startUserPreferences: calls.start,
}));
import UserPreferencesBoundary from "@/core/settings/UserPreferencesBoundary.vue";
import { AUTH_SESSION_QUERY_KEY } from "@/core/auth/session-query";
import { resetWorkspaceQueries } from "@/core/auth/workspace-queries";

const user = {
  id: "alice",
  email: "alice@test.local",
  system_role: "user",
  needs_setup: false,
};
const clients: QueryClient[] = [];
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
});
afterEach(() => {
  clients.forEach((client) => client.clear());
  clients.length = 0;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function client() {
  const value = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  clients.push(value);
  return value;
}
describe("live identity inside an initially auth-disabled workspace", () => {
  it("refreshes the one session on visibility, starts real account preferences and preserves that identity while retiring private queries", async () => {
    const fetch = vi.fn(async () => Response.json(user));
    vi.stubGlobal("fetch", fetch);
    const queryClient = client();
    queryClient.setQueryData(["memory"], "default-private-data");
    const wrapper = mount(UserPreferencesBoundary, {
      slots: { default: "workspace" },
      global: { plugins: [[VueQueryPlugin, { queryClient }]] },
    });
    await flushPromises();
    expect(fetch).not.toHaveBeenCalled();
    expect(calls.start).not.toHaveBeenCalled();
    document.dispatchEvent(new Event("visibilitychange"));
    await flushPromises();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(calls.start).toHaveBeenCalledWith("alice", expect.any(Object));
    expect(queryClient.getQueryData(AUTH_SESSION_QUERY_KEY)).toMatchObject({
      tag: "authenticated",
      user,
    });
    expect(queryClient.getQueryData(["memory"])).toBeUndefined();
    expect(wrapper.text()).toBe("workspace");
    document.dispatchEvent(new Event("visibilitychange"));
    await flushPromises();
    expect(fetch).toHaveBeenCalledTimes(1);
    wrapper.unmount();
    document.dispatchEvent(new Event("visibilitychange"));
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("preserves mounted workspace state and the preference owner across a transient HTTP refresh failure", async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 503 }));
    vi.stubGlobal("fetch", fetch);
    const queryClient = client();
    queryClient.setQueryData(AUTH_SESSION_QUERY_KEY, {
      tag: "authenticated",
      user,
    });
    queryClient.setQueryData(["memory"], "alice-private-data");
    const wrapper = mount(UserPreferencesBoundary, {
      slots: { default: '<input aria-label="draft" value="keep-draft" />' },
      global: { plugins: [[VueQueryPlugin, { queryClient }]] },
    });
    try {
      await flushPromises();
      const draft = wrapper.get("input").element;
      expect(calls.start).toHaveBeenCalledTimes(1);
      expect(calls.start).toHaveBeenCalledWith("alice", expect.any(Object));
      const stop = calls.start.mock.results[0]!.value;
      document.dispatchEvent(new Event("visibilitychange"));
      await flushPromises();
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(queryClient.getQueryData(AUTH_SESSION_QUERY_KEY)).toMatchObject({
        tag: "authenticated",
        user,
      });
      expect(queryClient.getQueryData(["memory"])).toBe("alice-private-data");
      expect(wrapper.get("input").element).toBe(draft);
      expect(calls.start).toHaveBeenCalledTimes(1);
      expect(stop).not.toHaveBeenCalled();
    } finally {
      wrapper.unmount();
    }
  });

  it("keeps the new account session through an explicit workspace reset", async () => {
    const queryClient = client();
    queryClient.setQueryData(AUTH_SESSION_QUERY_KEY, {
      tag: "authenticated",
      user,
    });
    queryClient.setQueryData(["projects"], "old-account-data");
    await resetWorkspaceQueries(queryClient);
    expect(queryClient.getQueryData(AUTH_SESSION_QUERY_KEY)).toMatchObject({
      user,
    });
    expect(queryClient.getQueryData(["projects"])).toBeUndefined();
  });
});
