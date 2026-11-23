import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { mount, flushPromises } from "@vue/test-utils";
import { reactive, ref, defineComponent } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Page from "@/pages/workspace/scheduled-tasks.vue";
import { enUS } from "@/core/i18n/locales/en-US";
import { task } from "./fixtures";
const api = vi.hoisted(() => ({
  list: vi.fn(),
  thread: vi.fn(),
  feature: vi.fn(),
}));
vi.mock("@/core/scheduled-tasks/api", async (original) => ({
  ...(await original<typeof import("@/core/scheduled-tasks/api")>()),
  fetchScheduledTasks: api.list,
  fetchThreadScheduledTasks: api.thread,
}));
vi.mock("@/core/features/api", async (original) => ({
  ...(await original<typeof import("@/core/features/api")>()),
  fetchScheduledTasksFeature: api.feature,
}));
const route = reactive({
  path: "/workspace/scheduled-tasks",
  query: {} as Record<string, string>,
});
const replace = vi.fn(async (value) => {
  route.query = value.query;
});
const wrappers: ReturnType<typeof mount>[] = [];
const Detail = defineComponent({
  props: ["task"],
  emits: ["duplicate", "edit", "deleted"],
  template: '<article data-testid="detail-stub">{{task.title}}</article>',
});
beforeEach(() => {
  route.query = {};
  vi.clearAllMocks();
  api.list.mockResolvedValue([
    task(),
    task({ id: "paused", title: "Paused task", status: "paused" }),
    task({ id: "finished", title: "Done task", status: "completed" }),
  ]);
  api.thread.mockResolvedValue([]);
  api.feature.mockResolvedValue({
    available: true,
    running: true,
    toolEnabled: true,
    minIntervalSeconds: 60,
  });
  vi.stubGlobal("useNuxtApp", () => ({
    $i18n: { t: ref(enUS), locale: ref("en-US") },
  }));
  vi.stubGlobal("definePageMeta", vi.fn());
  vi.stubGlobal("useHead", vi.fn());
  vi.stubGlobal("useRoute", () => route);
  vi.stubGlobal("useRouter", () => ({ replace }));
});
afterEach(() => {
  wrappers.splice(0).forEach((w) => w.unmount());
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});
async function create() {
  const wrapper = mount(Page, {
    attachTo: document.body,
    global: {
      plugins: [
        [
          VueQueryPlugin,
          {
            queryClient: new QueryClient({
              defaultOptions: { queries: { retry: false } },
            }),
          },
        ],
      ],
      stubs: {
        WorkspaceContainer: { template: "<main><slot /></main>" },
        ScheduledTaskFormDialog: true,
        ScheduledTaskDetail: Detail,
      },
    },
  });
  wrappers.push(wrapper);
  await flushPromises();
  return wrapper;
}
describe("actual scheduled task route filters and deep links", () => {
  it("exposes one checked radio and changes the selected detail after filtering", async () => {
    const wrapper = await create();
    const tabs = wrapper.findAll('[data-slot="toggle-group-item"]');
    expect(
      tabs.filter((t) => t.attributes("aria-checked") === "true"),
    ).toHaveLength(1);
    expect(tabs.every((t) => t.attributes("role") === "radio")).toBe(true);
    expect(tabs.every((t) => t.attributes("aria-pressed") === undefined)).toBe(
      true,
    );
    await tabs
      .find((t) => t.text().includes(enUS.scheduledTasks.page.tabs.paused))!
      .trigger("click");
    await flushPromises();
    expect(wrapper.get("[data-testid=detail-stub]").text()).toBe("Paused task");
    expect(wrapper.findAll("[data-task-id]")).toHaveLength(1);
  });
  it("searches without losing the selected task until the user changes filters", async () => {
    const wrapper = await create();
    await wrapper.get("input[type=search]").setValue("done");
    await flushPromises();
    expect(wrapper.get("[data-testid=detail-stub]").text()).toBe("Done task");
    expect(wrapper.get("input").attributes("aria-label")).toBe(
      enUS.scheduledTasks.page.search,
    );
  });
  it("pins explicit deep links and reports a missing task instead of silently selecting another", async () => {
    route.query = { task_id: "missing" };
    const wrapper = await create();
    expect(
      wrapper.get("[data-testid=scheduled-task-link-missing]").text(),
    ).toContain(enUS.scheduledTasks.apiErrors.taskNotFound);
    expect(wrapper.find("[data-testid=detail-stub]").exists()).toBe(false);
  });
  it("excludes run-only relationships from the thread-owned task list", async () => {
    route.query = { thread_id: "chat" };
    api.thread.mockResolvedValue([
      task({ id: "owned", title: "Owned", thread_relation: "origin" }),
      task({ id: "run-only", thread_relation: "run" }),
    ]);
    const wrapper = await create();
    expect(
      wrapper
        .findAll("[data-task-id]")
        .map((e) => e.attributes("data-task-id")),
    ).toEqual(["owned"]);
    await wrapper
      .get("[data-testid=scheduled-task-thread-filter] button")
      .trigger("click");
    expect(replace).toHaveBeenCalledWith({ path: route.path, query: {} });
  });
  it("distinguishes unavailable persistence and stopped execution", async () => {
    api.feature.mockResolvedValue({
      available: false,
      running: false,
      toolEnabled: false,
      minIntervalSeconds: 60,
    });
    const wrapper = await create();
    expect(
      wrapper.find("[data-testid=scheduled-tasks-unavailable]").exists(),
    ).toBe(true);
    expect(wrapper.find("[data-testid=scheduled-task-new]").exists()).toBe(
      false,
    );
    wrapper.unmount();
    api.feature.mockResolvedValue({
      available: true,
      running: false,
      toolEnabled: false,
      minIntervalSeconds: 60,
    });
    const stopped = await create();
    expect(stopped.find("[data-testid=scheduler-off-notice]").exists()).toBe(
      true,
    );
    expect(
      stopped.get("[data-testid=scheduled-task-new]").attributes("disabled"),
    ).toBeDefined();
    expect(stopped.get("h1").text()).toBe(enUS.sidebar.scheduledTasks);
  });
  it("opens duplicate and edit as current form-dialog requests", async () => {
    const wrapper = await create();
    const detail = wrapper.findComponent(Detail);
    detail.vm.$emit("duplicate", task());
    await flushPromises();
    expect(
      wrapper
        .findComponent({ name: "ScheduledTaskFormDialog" })
        .props("request"),
    ).toMatchObject({ mode: "duplicate", task: { id: "task-1" } });
    detail.vm.$emit("edit", task(), "goal");
    await flushPromises();
    expect(
      wrapper
        .findComponent({ name: "ScheduledTaskFormDialog" })
        .props("request"),
    ).toMatchObject({ mode: "edit", focus: "goal" });
  });
});
