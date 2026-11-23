import { QueryClient, useQuery, VueQueryPlugin } from "@tanstack/vue-query";
import { mount, flushPromises } from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  fetch: vi.fn(() => new Promise<Response>(() => undefined)),
}));
vi.mock("@/core/api/fetcher", () => ({ fetch: mocks.fetch }));
const session = ref({ tag: "authenticated", user: { id: "alice" } });
vi.mock("@/composables/useSettingsPermissions", () => ({
  useSettingsPermissions: () => ({ session, authDisabled: false }),
}));
import UserPreferencesBoundary from "@/core/settings/UserPreferencesBoundary.vue";
import { stopUserPreferences } from "@/core/settings/user-preferences";
import {
  captureWorkspaceQueryOwner,
  resetWorkspaceQueries,
} from "@/core/auth/workspace-queries";
afterEach(() => {
  stopUserPreferences();
  vi.restoreAllMocks();
});
describe("account workspace query boundary", () => {
  it("unmounts private consumers, cancels every old query and never revives ignored-abort results", async () => {
    session.value = { tag: "authenticated", user: { id: "alice" } };
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    for (const key of [
      ["memory"],
      ["projects"],
      ["models"],
      ["channels"],
      ["features"],
    ])
      client.setQueryData(key, "alice-private");
    const pending: Array<{
      account: string;
      signal: AbortSignal;
      resolve: (value: string) => void;
    }> = [];
    const Consumer = defineComponent({
      setup() {
        const result = useQuery({
          queryKey: ["memory"],
          queryFn: ({ signal }) =>
            new Promise<string>((resolve) => {
              pending.push({ account: session.value.user.id, signal, resolve });
            }),
        });
        return () => h("output", result.data.value ?? "loading");
      },
    });
    const wrapper = mount(UserPreferencesBoundary, {
      slots: { default: () => h(Consumer) },
      global: { plugins: [[VueQueryPlugin, { queryClient: client }]] },
    });
    await flushPromises();
    expect(wrapper.text()).toBe("alice-private");
    expect(pending[0]?.account).toBe("alice");
    session.value = { tag: "authenticated", user: { id: "bob" } };
    await flushPromises();
    expect(pending[0]?.signal.aborted).toBe(true);
    expect(wrapper.text()).toBe("loading");
    for (const key of [["projects"], ["models"], ["channels"], ["features"]])
      expect(client.getQueryData(key)).toBeUndefined();
    expect(pending[1]?.account).toBe("bob");
    pending[0]!.resolve("alice-late-private");
    await flushPromises();
    expect(wrapper.text()).toBe("loading");
    expect(client.getQueryData(["memory"])).toBeUndefined();
    pending[1]!.resolve("bob-private");
    await flushPromises();
    expect(wrapper.text()).toBe("bob-private");
    wrapper.unmount();
    client.clear();
  });
  it("invalidates mutation ownership synchronously before query cancellation completes", async () => {
    const client = new QueryClient();
    let complete!: () => void;
    vi.spyOn(client, "cancelQueries").mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          complete = resolve;
        }),
    );
    const alice = captureWorkspaceQueryOwner(client);
    expect(alice()).toBe(true);
    const reset = resetWorkspaceQueries(client);
    expect(alice()).toBe(false);
    const bob = captureWorkspaceQueryOwner(client);
    expect(bob()).toBe(true);
    complete();
    await reset;
    expect(alice()).toBe(false);
    expect(bob()).toBe(true);
  });
  it("clears cache data even when no feature query exists", async () => {
    const client = new QueryClient();
    client.setQueryData(["project-documents", "a"], { private: "alice" });
    await resetWorkspaceQueries(client);
    expect(client.getQueryCache().getAll()).toHaveLength(0);
  });
});
