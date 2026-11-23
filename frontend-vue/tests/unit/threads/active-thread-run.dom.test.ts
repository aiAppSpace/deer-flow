import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { mount, flushPromises } from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("@/core/api/api-client", () => ({
  getAPIClient: () => ({ runs: { list: mocks.list } }),
}));
import { useActiveThreadRun } from "@/composables/useActiveThreadRun";

const cleanups: Array<() => void> = [];
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  mocks.list
    .mockReset()
    .mockResolvedValue([{ run_id: "run-a", status: "running" }]);
});
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  vi.useRealTimers();
});
async function settle() {
  for (let i = 0; i < 5; i += 1) {
    await flushPromises();
    await vi.advanceTimersByTimeAsync(0);
  }
}
function host(
  implementation: (handle: {
    threadId: string;
    runId: string;
  }) => Promise<boolean> = async () => true,
) {
  const join = vi.fn(implementation);
  const threadId = ref<string | null>("thread-a");
  const enabled = ref(true);
  const streaming = ref(false);
  const currentRunId = ref<string | null>(null);
  const streamError = ref<unknown>(null);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const wrapper = mount(
    defineComponent({
      setup() {
        useActiveThreadRun({
          threadId,
          enabled,
          streaming,
          currentRunId,
          streamError,
          join,
        });
        return () => h("div");
      },
    }),
    { global: { plugins: [[VueQueryPlugin, { queryClient: client }]] } },
  );
  cleanups.push(() => {
    wrapper.unmount();
    client.clear();
  });
  return {
    threadId,
    enabled,
    streaming,
    currentRunId,
    streamError,
    client,
    wrapper,
    join,
  };
}
describe("server-started active run observation", () => {
  it("discovers and joins the newest active run once without a run creation API", async () => {
    const state = host();
    await settle();
    expect(mocks.list).toHaveBeenCalledExactlyOnceWith("thread-a", {
      signal: expect.any(AbortSignal),
    });
    expect(state.join).toHaveBeenCalledExactlyOnceWith({
      threadId: "thread-a",
      runId: "run-a",
    });
    await state.client.invalidateQueries({ queryKey: ["thread", "thread-a"] });
    await settle();
    expect(state.join).toHaveBeenCalledTimes(1);
  });
  it.each(["success", "error", "timeout", "interrupted"])(
    "does not join terminal %s runs",
    async (status) => {
      mocks.list.mockResolvedValue([{ run_id: "run-a", status }]);
      const state = host();
      await settle();
      expect(state.join).not.toHaveBeenCalled();
    },
  );
  it("retries a failed observer at 1s and 2s and then stops", async () => {
    const state = host(vi.fn(async () => false));
    await settle();
    expect(state.join).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(999);
    expect(state.join).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await settle();
    expect(state.join).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2000);
    await settle();
    expect(state.join).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(10000);
    expect(state.join).toHaveBeenCalledTimes(3);
  });
  it("cancels the old retry when switching conversations", async () => {
    const state = host(vi.fn(async () => false));
    await settle();
    mocks.list.mockResolvedValue([{ run_id: "run-b", status: "pending" }]);
    state.threadId.value = "thread-b";
    await settle();
    await vi.advanceTimersByTimeAsync(1000);
    await settle();
    expect(
      state.join.mock.calls.filter(
        ([handle]) => handle.threadId === "thread-a",
      ),
    ).toHaveLength(1);
    expect(
      state.join.mock.calls.filter(
        ([handle]) => handle.threadId === "thread-b",
      ),
    ).toHaveLength(2);
  });
  it("leaves local streaming runs to their existing owner and does not rejoin after completion", async () => {
    const state = host();
    state.streaming.value = true;
    state.currentRunId.value = "run-a";
    await settle();
    expect(state.join).not.toHaveBeenCalled();
    state.streaming.value = false;
    await settle();
    expect(state.join).not.toHaveBeenCalled();
  });
  it("cancels a queued retry on unmount", async () => {
    const state = host(vi.fn(async () => false));
    await settle();
    cleanups.pop()!();
    await vi.advanceTimersByTimeAsync(10000);
    expect(state.join).toHaveBeenCalledTimes(1);
  });
});
