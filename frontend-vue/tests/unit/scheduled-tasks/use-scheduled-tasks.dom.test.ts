import {
  QueryClient,
  VueQueryPlugin,
  focusManager,
  onlineManager,
} from "@tanstack/vue-query";
import { mount, flushPromises } from "@vue/test-utils";
import { defineComponent, ref, nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  useScheduledTaskRunHistory,
  useScheduledTaskMutations,
} from "@/composables/useScheduledTasks";
import { resetWorkspaceQueries } from "@/core/auth/workspace-queries";
import { scheduledTaskKeys } from "@/core/scheduled-tasks/query-keys";
import { task, run } from "./fixtures";
const api = vi.hoisted(() => ({ runs: vi.fn(), create: vi.fn() }));
vi.mock("@/core/scheduled-tasks/api", async (original) => ({
  ...(await original<typeof import("@/core/scheduled-tasks/api")>()),
  fetchScheduledTaskRuns: api.runs,
  createScheduledTask: api.create,
}));
const wrappers: ReturnType<typeof mount>[] = [];
const clients: QueryClient[] = [];
function host(setup: () => void) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  clients.push(client);
  const wrapper = mount(
    defineComponent({
      setup() {
        setup();
        return () => null;
      },
    }),
    { global: { plugins: [[VueQueryPlugin, { queryClient: client }]] } },
  );
  wrappers.push(wrapper);
  return client;
}
beforeEach(() => {
  vi.clearAllMocks();
  focusManager.setFocused(true);
  onlineManager.setOnline(true);
});
afterEach(() => {
  wrappers.splice(0).forEach((w) => w.unmount());
  clients.splice(0).forEach((c) => c.clear());
  vi.useRealTimers();
  focusManager.setFocused(undefined);
});
describe("page-owned scheduled run history", () => {
  it("requests 51, renders 50 and replaces rather than accumulates older pages", async () => {
    api.runs.mockImplementation((_id, options) =>
      Promise.resolve(
        Array.from({ length: options.offset ? 2 : 51 }, (_, i) =>
          run({ id: `run-${options.offset + i}` }),
        ),
      ),
    );
    let state!: ReturnType<typeof useScheduledTaskRunHistory>;
    host(() => {
      state = useScheduledTaskRunHistory(ref("task"));
    });
    await vi.waitFor(() => expect(state.runs.value).toHaveLength(50));
    expect(api.runs.mock.calls[0]?.[1]).toMatchObject({
      limit: 51,
      offset: 0,
      signal: expect.any(AbortSignal),
    });
    state.older();
    state.older();
    await flushPromises();
    expect(state.page.value).toBe(1);
    expect(state.runs.value.map((r) => r.id)).toEqual(["run-50", "run-51"]);
    expect(state.hasOlder.value).toBe(false);
    state.newer();
    await flushPromises();
    expect(state.runs.value).toHaveLength(50);
  });
  it("resets page and rejects late A results after switching tasks", async () => {
    let resolve!: (value: ReturnType<typeof run>[]) => void;
    api.runs.mockImplementation((id) =>
      id === "A"
        ? new Promise((done) => (resolve = done))
        : Promise.resolve([run({ id: "B-run", task_id: "B" })]),
    );
    const id = ref<string | null>("A");
    let state!: ReturnType<typeof useScheduledTaskRunHistory>;
    host(() => {
      state = useScheduledTaskRunHistory(id);
    });
    id.value = "B";
    await nextTick();
    await vi.waitFor(() => expect(state.runs.value[0]?.id).toBe("B-run"));
    resolve([run({ id: "A-run" })]);
    await flushPromises();
    expect(state.runs.value[0]?.id).toBe("B-run");
    expect(state.page.value).toBe(0);
    expect(api.runs.mock.calls[0]?.[1].signal.aborted).toBe(true);
  });
  it("polls only the visible latest page and stops focus/reconnect refresh on older pages", async () => {
    vi.useFakeTimers();
    api.runs.mockResolvedValue(
      Array.from({ length: 51 }, (_, i) =>
        run({ id: `run-${i}`, status: i === 0 ? "running" : "success" }),
      ),
    );
    let state!: ReturnType<typeof useScheduledTaskRunHistory>;
    host(() => {
      state = useScheduledTaskRunHistory(ref("task"));
    });
    await flushPromises();
    await vi.advanceTimersByTimeAsync(3000);
    expect(api.runs).toHaveBeenCalledTimes(2);
    state.older();
    await flushPromises();
    const calls = api.runs.mock.calls.length;
    await vi.advanceTimersByTimeAsync(30000);
    focusManager.setFocused(false);
    focusManager.setFocused(true);
    onlineManager.setOnline(false);
    onlineManager.setOnline(true);
    await flushPromises();
    expect(api.runs).toHaveBeenCalledTimes(calls);
    expect(api.runs.mock.calls.at(-1)?.[1].offset).toBe(50);
  });
  it("invalidates task summaries when an observed active occurrence reaches a terminal state", async () => {
    api.runs.mockResolvedValue([run({ status: "running" })]);
    let state!: ReturnType<typeof useScheduledTaskRunHistory>;
    const client = host(() => {
      state = useScheduledTaskRunHistory(ref("task"));
    });
    client.setQueryData(scheduledTaskKeys.list(), [task()]);
    await flushPromises();
    api.runs.mockResolvedValue([run({ status: "success" })]);
    await state.refetch();
    await flushPromises();
    expect(client.getQueryState(scheduledTaskKeys.list())?.isInvalidated).toBe(
      true,
    );
  });
  it("stops polling when the history owner unmounts", async () => {
    vi.useFakeTimers();
    api.runs.mockResolvedValue([run()]);
    host(() => {
      useScheduledTaskRunHistory(ref("task"));
    });
    await flushPromises();
    wrappers[0]!.unmount();
    const calls = api.runs.mock.calls.length;
    await vi.advanceTimersByTimeAsync(60000);
    expect(api.runs).toHaveBeenCalledTimes(calls);
  });
  it("does not invalidate new account queries after an old account mutation returns", async () => {
    let resolve!: (value: ReturnType<typeof task>) => void;
    api.create.mockImplementation(
      () => new Promise((done) => (resolve = done)),
    );
    let mutation!: ReturnType<typeof useScheduledTaskMutations>;
    const client = host(() => {
      mutation = useScheduledTaskMutations();
    });
    const pending = mutation.create.mutateAsync({
      title: "old",
      prompt: "Summarize",
      context_mode: "fresh_thread_per_run",
      schedule_type: "cron",
      schedule_spec: { cron: "0 9 * * *" },
      timezone: "UTC",
    });
    await flushPromises();
    await resetWorkspaceQueries(client);
    client.setQueryData(scheduledTaskKeys.list(), [
      task({ id: "new-account" }),
    ]);
    resolve(task());
    await pending;
    expect(client.getQueryState(scheduledTaskKeys.list())?.isInvalidated).toBe(
      false,
    );
  });
});
