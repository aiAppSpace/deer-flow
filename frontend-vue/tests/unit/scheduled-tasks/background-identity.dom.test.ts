import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { mount, flushPromises } from "@vue/test-utils";
import { defineComponent, ref } from "vue";
import { expect, it, vi } from "vitest";
import { useCancelBackgroundTask } from "@/composables/useBackgroundTasks";
import { backgroundTaskKeys } from "@/core/background-tasks/query-keys";
const mocks = vi.hoisted(() => ({ cancel: vi.fn() }));
vi.mock("@/core/background-tasks", async (original) => ({
  ...(await original<typeof import("@/core/background-tasks")>()),
  cancelBackgroundTask: mocks.cancel,
}));
it("writes late cancellation only to its initiating thread cache", async () => {
  const thread = ref("thread-A");
  let mutation!: ReturnType<typeof useCancelBackgroundTask>;
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = mount(
    defineComponent({
      setup() {
        mutation = useCancelBackgroundTask(thread);
        return () => null;
      },
    }),
    { global: { plugins: [[VueQueryPlugin, { queryClient: client }]] } },
  );
  let complete!: (value: { task_id: string; status: string }) => void;
  mocks.cancel.mockImplementation(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  client.setQueryData(backgroundTaskKeys.list("thread-A"), [
    { task_id: "task", status: "running" },
  ]);
  client.setQueryData(backgroundTaskKeys.list("thread-B"), [
    { task_id: "task", status: "running" },
  ]);
  const pending = mutation.mutateAsync("task");
  thread.value = "thread-B";
  await flushPromises();
  expect(mocks.cancel).toHaveBeenCalledWith("thread-A", "task");
  expect(mutation.variables.value).toBeUndefined();
  complete({ task_id: "task", status: "cancelled" });
  await pending;
  expect(
    client.getQueryData(backgroundTaskKeys.detail("thread-A", "task")),
  ).toMatchObject({ status: "cancelled" });
  expect(
    client.getQueryData(backgroundTaskKeys.detail("thread-B", "task")),
  ).toBeUndefined();
  expect(client.getQueryData(backgroundTaskKeys.list("thread-B"))).toEqual([
    { task_id: "task", status: "running" },
  ]);
  wrapper.unmount();
});

it("suppresses late failure feedback after switching away from its initiating thread", async () => {
  const thread = ref("thread-A"),
    onError = vi.fn();
  let mutation!: ReturnType<typeof useCancelBackgroundTask>;
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = mount(
    defineComponent({
      setup() {
        mutation = useCancelBackgroundTask(thread, { onError });
        return () => null;
      },
    }),
    { global: { plugins: [[VueQueryPlugin, { queryClient: client }]] } },
  );
  let reject!: (error: Error) => void;
  mocks.cancel.mockImplementation(
    () => new Promise((_done, fail) => (reject = fail)),
  );
  const pending = mutation.mutateAsync("task").catch((error) => error);
  await flushPromises();
  thread.value = "thread-B";
  reject(new Error("late failure"));
  await pending;
  expect(onError).not.toHaveBeenCalled();
  wrapper.unmount();
  client.clear();
});
