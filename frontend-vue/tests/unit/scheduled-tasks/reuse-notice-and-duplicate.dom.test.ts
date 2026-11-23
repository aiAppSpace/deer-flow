import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { mount, flushPromises } from "@vue/test-utils";
import { ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Form from "@/components/workspace/scheduled-tasks/ScheduledTaskFormDialog.vue";
import Schedule from "@/components/workspace/scheduled-tasks/ScheduledTaskScheduleInput.vue";
import { enUS } from "@/core/i18n/locales/en-US";
import {
  createWorkspaceToastStore,
  workspaceToastKey,
} from "@/core/workspace-shell/toast";
import { task } from "./fixtures";
const api = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn() }));
vi.mock("@/core/scheduled-tasks/api", async (original) => ({
  ...(await original<typeof import("@/core/scheduled-tasks/api")>()),
  createScheduledTask: api.create,
  updateScheduledTask: api.update,
}));
vi.mock("@/composables/useWorkspaceFeatures", () => ({
  useAgentsApiEnabled: () => ({
    loaded: ref(true),
    agentsApiEnabled: ref(false),
  }),
}));
vi.mock("@/composables/useAgents", () => ({
  useAgents: () => ({ agents: ref([]) }),
}));
// These contracts exercise reuse/duplicate submission and exact schedule values,
// not the host ICU inventory. Reka constructs closed Select items as well: using
// every system zone made each mount build hundreds of unrelated item consumers.
// Keep real scheduling/conversion functions and the zones used by these cases.
vi.mock("@/core/scheduled-tasks/schedule", async (original) => ({
  ...(await original<typeof import("@/core/scheduled-tasks/schedule")>()),
  timezoneOptions: () => ["UTC", "America/New_York"],
}));
const wrappers: ReturnType<typeof mount>[] = [];
const queryClients: QueryClient[] = [];
const toast = createWorkspaceToastStore();
beforeEach(() => {
  vi.clearAllMocks();
  toast.clear();
  api.create.mockResolvedValue(task());
  api.update.mockResolvedValue(task());
  vi.stubGlobal("useNuxtApp", () => ({
    $i18n: { t: ref(enUS), locale: ref("en-US") },
  }));
});
afterEach(async () => {
  wrappers.splice(0).forEach((w) => w.unmount());
  queryClients.splice(0).forEach((client) => client.clear());
  await flushPromises();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});
function mountForm(
  request: import("@/core/scheduled-tasks/form-state").TaskFormRequest,
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  queryClients.push(queryClient);
  const wrapper = mount(Form, {
    attachTo: document.body,
    props: { request, toolEnabled: true, minIntervalSeconds: 1 },
    global: {
      plugins: [
        [
          VueQueryPlugin,
          {
            queryClient,
          },
        ],
      ],
      provide: { [workspaceToastKey as symbol]: toast },
    },
  });
  wrappers.push(wrapper);
  return wrapper;
}
const bodyText = () => document.body.textContent ?? "";
async function submit() {
  Array.from(document.querySelectorAll<HTMLButtonElement>("button"))
    .find(
      (button) => button.textContent?.trim() === enUS.scheduledTasks.form.save,
    )!
    .click();
  await flushPromises();
}
describe("current form dialog actual consumer", () => {
  it("shows reuse warnings only in the advanced reused context", async () => {
    const wrapper = mountForm({
      mode: "edit",
      task: task({ context_mode: "reuse_thread", thread_id: "thread" }),
    });
    await flushPromises();
    expect(bodyText()).toContain(enUS.scheduledTasks.form.reuseNoticeTitle);
    expect(bodyText()).toContain(
      enUS.scheduledTasks.form.reuseNoticeDescription,
    );
    wrapper.unmount();
    mountForm({ mode: "create" });
    await flushPromises();
    expect(bodyText()).not.toContain(enUS.scheduledTasks.form.reuseNoticeTitle);
  });
  it("sends no PATCH for an unchanged form including once seconds", async () => {
    const wrapper = mountForm({
      mode: "edit",
      task: task({
        schedule_type: "once",
        schedule_spec: { run_at: "2030-01-01T09:00:43Z" },
      }),
    });
    await flushPromises();
    await submit();
    expect(api.update).not.toHaveBeenCalled();
    expect(wrapper.emitted("update:open")).toEqual([[false]]);
  });
  it("sends only the changed title and preserves the source assistant", async () => {
    mountForm({ mode: "edit", task: task({ assistant_id: "analyst" }) });
    await flushPromises();
    const input = document.querySelector<HTMLInputElement>(
      'input[id$="-title"]',
    )!;
    input.value = "Renamed";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await submit();
    expect(api.update).toHaveBeenCalledWith("task-1", { title: "Renamed" });
  });
  it("blocks a reused goal at the actual form submit boundary", async () => {
    mountForm({
      mode: "edit",
      task: task({
        context_mode: "reuse_thread",
        thread_id: "thread",
        goal_objective: "Find it",
      }),
    });
    await flushPromises();
    await submit();
    expect(api.update).not.toHaveBeenCalled();
    expect(bodyText()).toContain(enUS.scheduledTasks.form.goalNeedsFresh);
  });
  it("duplicates full agent, limits and stop rule rather than the retired short draft", async () => {
    mountForm({
      mode: "duplicate",
      task: task({
        assistant_id: "analyst",
        goal_objective: "Find it",
        stop_condition: "Published",
        max_runs: 5,
      }),
    });
    await flushPromises();
    const button = Array.from(
      document.querySelectorAll<HTMLButtonElement>("button"),
    ).find(
      (button) =>
        button.textContent?.trim() === enUS.scheduledTasks.form.create,
    )!;
    button.click();
    await flushPromises();
    expect(api.create).toHaveBeenCalledWith(
      expect.objectContaining({
        assistant_id: "analyst",
        goal_objective: "Find it",
        stop_condition: "Published",
        max_runs: 5,
        title: "Daily digest (copy)",
      }),
    );
  });
});
describe("schedule input retains unedited exact values", () => {
  it("preserves the later DST fold and seconds until wall time is actually changed", async () => {
    const wrapper = mount(Schedule, {
      props: {
        initial: {
          schedule_type: "once",
          schedule_spec: { run_at: "2030-11-03T06:30:45.123Z" },
          timezone: "America/New_York",
        },
      },
      attachTo: document.body,
    });
    wrappers.push(wrapper);
    await flushPromises();
    expect(wrapper.emitted("change")?.at(-1)?.[0]).toMatchObject({
      schedule_spec: { run_at: "2030-11-03T06:30:45.123Z" },
    });
    await wrapper
      .get("input[type=datetime-local]")
      .setValue("2030-11-03T01:31");
    expect(wrapper.emitted("change")?.at(-1)?.[0]).not.toMatchObject({
      schedule_spec: { run_at: "2030-11-03T06:30:45.123Z" },
    });
    await wrapper
      .get("input[type=datetime-local]")
      .setValue("2030-11-03T01:30");
    expect(wrapper.emitted("change")?.at(-1)?.[0]).toMatchObject({
      schedule_spec: { run_at: "2030-11-03T06:30:45.123Z" },
    });
  });
  it("preserves 91 original seconds and applies the discovered floor after editing", async () => {
    const wrapper = mount(Schedule, {
      props: {
        initial: {
          schedule_type: "interval",
          schedule_spec: { every_seconds: 91 },
          timezone: "UTC",
        },
        minIntervalSeconds: 120,
      },
      attachTo: document.body,
    });
    wrappers.push(wrapper);
    await flushPromises();
    expect(wrapper.emitted("change")?.at(-1)?.[0]).toMatchObject({
      schedule_spec: { every_seconds: 91 },
    });
    await wrapper.get("input[type=number]").setValue("92");
    await wrapper.get("input[type=number]").trigger("blur");
    expect(wrapper.emitted("change")?.at(-1)?.[0]).toMatchObject({
      schedule_spec: { every_seconds: 120 },
    });
  });
});
