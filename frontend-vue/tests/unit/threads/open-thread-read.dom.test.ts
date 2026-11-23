import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { mount, flushPromises } from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/core/api/fetcher", () => ({ fetch: mocks.fetch }));
vi.mock("@/core/config", () => ({ getBackendBaseURL: () => "" }));
const session = ref({ tag: "authenticated", user: { id: "alice" } });
const available = ref(true);
vi.mock("@/composables/useSettingsPermissions", () => ({
  useSettingsPermissions: () => ({ authDisabled: false, session }),
}));
vi.mock("@/composables/useSchedulerFeatures", () => ({
  useThreadActivityFeature: () => ({ available }),
}));
import { useMarkOpenThreadRead } from "@/composables/useThreadActivity";

const cleanups: Array<() => void> = [];
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  session.value = { tag: "authenticated", user: { id: "alice" } };
  available.value = true;
  mocks.fetch
    .mockReset()
    .mockImplementation(
      async () =>
        new Response(JSON.stringify({ unread: false, read_version: 1 })),
    );
});
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  vi.useRealTimers();
});
function host(unread: boolean | null = true) {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false } },
  });
  const threadId = ref<string | null>("thread-a");
  const enabled = ref(false);
  client.setQueryData(
    ["threads", "search"],
    [{ thread_id: "thread-a", unread }],
  );
  let mark!: () => void;
  const wrapper = mount(
    defineComponent({
      setup() {
        mark = useMarkOpenThreadRead(threadId, { enabled });
        return () => h("div");
      },
    }),
    { global: { plugins: [[VueQueryPlugin, { queryClient: client }]] } },
  );
  cleanups.push(() => {
    wrapper.unmount();
    client.clear();
  });
  return { client, threadId, enabled, mark, wrapper };
}
async function advance(ms = 1000) {
  await flushPromises();
  await vi.advanceTimersByTimeAsync(ms);
  await flushPromises();
}
describe("open conversation read synchronization", () => {
  it("waits for metadata, debounces once and clears the cached unread flag", async () => {
    const state = host();
    await advance();
    expect(mocks.fetch).not.toHaveBeenCalled();
    state.enabled.value = true;
    await advance(999);
    expect(mocks.fetch).not.toHaveBeenCalled();
    await advance(1);
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(String(mocks.fetch.mock.calls[0]![0])).toBe(
      "/api/threads/thread-a/read",
    );
    expect(state.client.getQueryData(["threads", "search"])).toEqual([
      { thread_id: "thread-a", unread: false },
    ]);
    document.dispatchEvent(new Event("visibilitychange"));
    state.mark();
    await advance();
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });
  it("marks the still-open thread again when the activity-refreshed list becomes unread", async () => {
    const state = host(false);
    state.enabled.value = true;
    await advance();
    expect(mocks.fetch).not.toHaveBeenCalled();
    state.client.setQueryData(
      ["threads", "search"],
      [{ thread_id: "thread-a", unread: true }],
    );
    await advance();
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });
  it("cancels leaving-thread and disabled-capability timers", async () => {
    const state = host();
    state.enabled.value = true;
    await advance(500);
    state.threadId.value = null;
    await advance();
    expect(mocks.fetch).not.toHaveBeenCalled();
    state.threadId.value = "thread-a";
    await advance(500);
    available.value = false;
    await advance();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("restarts the debounce for a new account even when the route id is identical", async () => {
    const state = host();
    state.enabled.value = true;
    await advance(500);
    session.value = { tag: "authenticated", user: { id: "bob" } };
    await advance(500);
    expect(mocks.fetch).not.toHaveBeenCalled();
    await advance(500);
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });
  it("does not send after unmount or after a newer cache already marked it read", async () => {
    const state = host();
    state.enabled.value = true;
    await advance(500);
    state.client.setQueryData(
      ["threads", "search"],
      [{ thread_id: "thread-a", unread: false }],
    );
    await advance();
    expect(mocks.fetch).not.toHaveBeenCalled();
    state.client.setQueryData(
      ["threads", "search"],
      [{ thread_id: "thread-a", unread: true }],
    );
    await advance(500);
    cleanups.pop()!();
    await advance();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});
