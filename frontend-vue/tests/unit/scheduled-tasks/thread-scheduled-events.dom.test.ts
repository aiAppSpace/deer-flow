import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { mount, flushPromises } from "@vue/test-utils";
import { defineComponent, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  useThreadScheduledTaskEvents,
  useScheduleToolResultRefresh,
} from "@/composables/useThreadScheduledTasks";
import { scheduledTaskKeys } from "@/core/scheduled-tasks/query-keys";
import type { Message } from "@/core/types/message";
import { task } from "./fixtures";
const api = vi.hoisted(() => ({ events: vi.fn(), tasks: vi.fn() }));
vi.mock("@/core/scheduled-tasks/events", async (original) => ({
  ...(await original<typeof import("@/core/scheduled-tasks/events")>()),
  fetchThreadScheduledTaskEvents: api.events,
}));
vi.mock("@/core/scheduled-tasks/api", async (original) => ({
  ...(await original<typeof import("@/core/scheduled-tasks/api")>()),
  fetchThreadScheduledTasks: api.tasks,
}));
vi.mock("@/composables/useSchedulerFeatures", () => ({
  useScheduledTasksFeature: () => ({ available: ref(true) }),
}));
const wrappers: ReturnType<typeof mount>[] = [];
const clients: QueryClient[] = [];
function host(setup: () => void) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  clients.push(client);
  wrappers.push(
    mount(
      defineComponent({
        setup() {
          setup();
          return () => null;
        },
      }),
      { global: { plugins: [[VueQueryPlugin, { queryClient: client }]] } },
    ),
  );
  return client;
}
beforeEach(() => {
  vi.clearAllMocks();
  api.events.mockResolvedValue([{ id: "event-after-delete" }]);
  api.tasks.mockResolvedValue([]);
});
afterEach(() => {
  wrappers.splice(0).forEach((w) => w.unmount());
  clients.splice(0).forEach((c) => c.clear());
});
const card = (id: string, taskId = "task-1") =>
  ({
    id,
    type: "tool",
    name: "schedule_task",
    tool_call_id: id,
    content: JSON.stringify({
      action: "create",
      display: "card",
      task: { id: taskId, title: "Digest" },
    }),
  }) as Message;
describe("thread lifecycle query owner", () => {
  it("loads events independently even when the creating task was deleted", async () => {
    let state!: ReturnType<typeof useThreadScheduledTaskEvents>;
    host(() => {
      state = useThreadScheduledTaskEvents(ref("thread-A"));
    });
    await flushPromises();
    expect(api.events).toHaveBeenCalledWith("thread-A", {
      signal: expect.any(AbortSignal),
    });
    expect(state.data.value).toEqual([{ id: "event-after-delete" }]);
  });
  it("refetches immutable events after a task status/fingerprint change, including deletion", async () => {
    api.tasks.mockResolvedValue([task()]);
    host(() => {
      useThreadScheduledTaskEvents(ref("thread-A"));
    });
    await flushPromises();
    const client = clients[0]!;
    client.setQueryData(scheduledTaskKeys.thread("thread-A"), [
      task({ status: "paused" }),
    ]);
    await flushPromises();
    expect(api.events).toHaveBeenCalledTimes(2);
    client.setQueryData(scheduledTaskKeys.thread("thread-A"), []);
    await flushPromises();
    expect(api.events).toHaveBeenCalledTimes(3);
  });
  it("does not request unsaved threads and fences late thread A history after switching to B", async () => {
    const id = ref<string | null>(null);
    let done!: (value: { id: string }[]) => void;
    api.events.mockImplementation((id) =>
      id === "A"
        ? new Promise((resolve) => (done = resolve))
        : Promise.resolve([{ id: "B-event" }]),
    );
    let state!: ReturnType<typeof useThreadScheduledTaskEvents>;
    host(() => {
      state = useThreadScheduledTaskEvents(id);
    });
    await flushPromises();
    expect(api.events).not.toHaveBeenCalled();
    id.value = "A";
    await flushPromises();
    id.value = "B";
    await flushPromises();
    done([{ id: "A-event" }]);
    await flushPromises();
    expect(state.data.value).toEqual([{ id: "B-event" }]);
    expect(api.events.mock.calls[0]![1].signal.aborted).toBe(true);
  });
  it("seeds persisted tool history without refreshing, then refreshes each newly observed tool result once", async () => {
    const messages = ref<Message[]>([card("saved")]);
    const client = host(() => {
      useScheduleToolResultRefresh(ref("thread-A"), messages);
    });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    await flushPromises();
    expect(invalidate).not.toHaveBeenCalled();
    messages.value = [...messages.value, card("streamed")];
    await flushPromises();
    expect(invalidate.mock.calls.map(([o]) => o?.queryKey)).toEqual([
      scheduledTaskKeys.thread("thread-A"),
      scheduledTaskKeys.list(),
      scheduledTaskKeys.task("task-1"),
    ]);
    messages.value = [...messages.value];
    await flushPromises();
    expect(invalidate).toHaveBeenCalledTimes(3);
  });
});
