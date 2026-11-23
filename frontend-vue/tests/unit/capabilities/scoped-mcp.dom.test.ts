import { flushPromises, mount } from "@vue/test-utils";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { computed, defineComponent, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  user: { value: null as unknown },
  fetch: vi.fn(),
}));
vi.mock("@/composables/useCapabilities", () => ({
  useCapabilityUser: () => computed(() => mock.user.value),
}));
vi.mock("@/core/api/fetcher", () => ({ fetch: mock.fetch }));
vi.mock("@/core/config", () => ({ getBackendBaseURL: () => "" }));
import { useScopedMCPConfig } from "@/composables/useScopedMCPConfig";
const scope = ref<"user" | "deployment">("user");
const identity = ref({ id: "a", system_role: "admin" });
const cleanup: (() => void)[] = [];
function setup() {
  mock.user = identity;
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  let state!: ReturnType<typeof useScopedMCPConfig>;
  const wrapper = mount(
    defineComponent({
      setup() {
        state = useScopedMCPConfig(scope);
        return () => null;
      },
    }),
    { global: { plugins: [[VueQueryPlugin, { queryClient: client }]] } },
  );
  cleanup.push(() => {
    wrapper.unmount();
    client.clear();
  });
  return { state, client };
}
beforeEach(() => {
  scope.value = "user";
  identity.value = { id: "a", system_role: "admin" };
  mock.fetch
    .mockReset()
    .mockImplementation(async () => Response.json({ mcp_servers: {} }));
});
afterEach(() => cleanup.splice(0).forEach((fn) => fn()));
describe("scoped MCP ownership", () => {
  it("uses personal routes for targeted updates and invalidates capability state only after success", async () => {
    const { state, client } = setup();
    await flushPromises();
    const invalidation = vi.spyOn(client, "invalidateQueries");
    await state.mutation.mutateAsync({
      operation: "toggle",
      serverName: "search",
      enabled: false,
    });
    const call = mock.fetch.mock.calls.find(
      ([, init]) => init?.method === "PATCH",
    )!;
    expect(call[0]).toBe("/api/mcp/personal/config");
    expect(JSON.parse(call[1].body)).toEqual({
      server_name: "search",
      enabled: false,
    });
    expect(invalidation).toHaveBeenCalledWith({ queryKey: ["capabilities"] });
  });
  it("does not query or mutate deployment config for a member", async () => {
    identity.value = { id: "member", system_role: "user" };
    scope.value = "deployment";
    const { state } = setup();
    await flushPromises();
    expect(mock.fetch).not.toHaveBeenCalled();
    await expect(
      state.mutation.mutateAsync({ operation: "delete", serverName: "shared" }),
    ).rejects.toThrow("Admin");
    expect(mock.fetch).not.toHaveBeenCalled();
  });
  it("aborts an old mutation on account and scope change even when transport ignores abort", async () => {
    let release!: (value: Response) => void;
    let signal!: AbortSignal;
    mock.fetch.mockImplementation(async (_url, init) => {
      if (init?.method) {
        signal = init.signal;
        return new Promise<Response>((resolve) => {
          release = resolve;
        });
      }
      return Response.json({ mcp_servers: {} });
    });
    const { state, client } = setup();
    await flushPromises();
    const pending = state.mutation.mutateAsync({
      operation: "create",
      servers: { private: { enabled: true, description: "Private server" } },
    });
    await flushPromises();
    identity.value = { id: "b", system_role: "admin" };
    scope.value = "deployment";
    await flushPromises();
    expect(signal.aborted).toBe(true);
    release(Response.json({ mcp_servers: { private: { enabled: true } } }));
    await pending;
    expect(client.getQueryData(["mcpConfig", "deployment", "b"])).toEqual({
      mcp_servers: {},
    });
    expect(client.getQueryData(["mcpConfig", "user", "a"])).toEqual({
      mcp_servers: {},
    });
  });
});
