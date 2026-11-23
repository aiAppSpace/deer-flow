import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { mount } from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";
import { beforeEach, expect, it, vi } from "vitest";
import {
  useControlSubagentBatch,
  useRetrySubagentBatchItem,
} from "@/composables/useSubagentBatches";
import { subagentBatchKeys } from "@/core/subagent-batches";
const api = vi.hoisted(() => ({
  controlSubagentBatch: vi.fn(),
  retrySubagentBatchItem: vi.fn(),
}));
vi.mock("@/core/subagent-batches/api", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  ...api,
}));
beforeEach(() => Object.values(api).forEach((fn) => fn.mockReset()));
it("binds control dispatch and invalidation to the clicked thread even if the route changes before execution", async () => {
  let settle!: () => void;
  api.controlSubagentBatch.mockReturnValue(
    new Promise<void>((resolve) => {
      settle = resolve;
    }),
  );
  const thread = ref("A");
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, "invalidateQueries");
  let mutation!: ReturnType<typeof useControlSubagentBatch>;
  const wrapper = mount(
    defineComponent({
      setup() {
        mutation = useControlSubagentBatch(thread);
        return () => h("div");
      },
    }),
    { global: { plugins: [[VueQueryPlugin, { queryClient: client }]] } },
  );
  const pending = mutation.mutateAsync({ batchId: "batch-A", action: "pause" });
  thread.value = "B";
  await vi.waitFor(() => expect(api.controlSubagentBatch).toHaveBeenCalled());
  settle();
  await pending;
  expect(api.controlSubagentBatch).toHaveBeenCalledWith(
    "A",
    "batch-A",
    "pause",
    { signal: expect.any(AbortSignal) },
  );
  expect(invalidate).toHaveBeenCalledWith({
    queryKey: subagentBatchKeys.list("A"),
  });
  expect(invalidate).not.toHaveBeenCalledWith({
    queryKey: subagentBatchKeys.list("B"),
  });
  wrapper.unmount();
});
it("retires a retry against its captured batch and refreshes both original owners", async () => {
  let settle!: () => void;
  api.retrySubagentBatchItem.mockReturnValue(
    new Promise<void>((resolve) => {
      settle = resolve;
    }),
  );
  const thread = ref("A");
  const batch = ref("batch-A");
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, "invalidateQueries");
  let mutation!: ReturnType<typeof useRetrySubagentBatchItem>;
  const wrapper = mount(
    defineComponent({
      setup() {
        mutation = useRetrySubagentBatchItem(thread, batch);
        return () => h("div");
      },
    }),
    { global: { plugins: [[VueQueryPlugin, { queryClient: client }]] } },
  );
  const pending = mutation.mutateAsync("item-A");
  thread.value = "B";
  batch.value = "batch-B";
  await vi.waitFor(() => expect(api.retrySubagentBatchItem).toHaveBeenCalled());
  settle();
  await pending;
  expect(api.retrySubagentBatchItem).toHaveBeenCalledWith(
    "A",
    "batch-A",
    "item-A",
    { signal: expect.any(AbortSignal) },
  );
  expect(invalidate).toHaveBeenCalledWith({
    queryKey: subagentBatchKeys.list("A"),
  });
  expect(invalidate).toHaveBeenCalledWith({
    queryKey: subagentBatchKeys.items("A", "batch-A"),
  });
  wrapper.unmount();
});
it("cancels control I/O on disposal and suppresses a late success in the new account cache", async () => {
  let finish!: () => void;
  api.controlSubagentBatch.mockReturnValue(
    new Promise<void>((resolve) => {
      finish = resolve;
    }),
  );
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, "invalidateQueries");
  let mutation!: ReturnType<typeof useControlSubagentBatch>;
  const wrapper = mount(
    defineComponent({
      setup() {
        mutation = useControlSubagentBatch("A");
        return () => h("div");
      },
    }),
    {
      global: { plugins: [[VueQueryPlugin, { queryClient: client }]] },
    },
  );
  const settled = mutation
    .mutateAsync({ batchId: "batch-A", action: "cancel" })
    .catch((error: unknown) => error);
  await vi.waitFor(() =>
    expect(api.controlSubagentBatch).toHaveBeenCalledOnce(),
  );
  const signal = api.controlSubagentBatch.mock.calls[0]![3]
    ?.signal as AbortSignal;
  wrapper.unmount();
  expect(signal).toBeInstanceOf(AbortSignal);
  expect(signal.aborted).toBe(true);
  finish();
  expect(await settled).toMatchObject({ name: "AbortError" });
  expect(invalidate).not.toHaveBeenCalled();
});
