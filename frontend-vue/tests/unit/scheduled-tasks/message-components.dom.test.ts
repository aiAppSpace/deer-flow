import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { mount, flushPromises } from "@vue/test-utils";
import { defineComponent, ref, type Component } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ScheduledTaskCard from "@/components/workspace/messages/ScheduledTaskCard.vue";
import ScheduledRunPrompt from "@/components/workspace/messages/ScheduledRunPrompt.vue";
import ScheduledTaskEventLine from "@/components/workspace/messages/ScheduledTaskEventLine.vue";
import ThreadScheduledTasksButton from "@/components/workspace/ThreadScheduledTasksButton.vue";
import ChannelScheduledUpdates from "@/components/workspace/channels/ChannelScheduledUpdates.vue";
import MessageList from "@/components/chat/MessageList.vue";
import { enUS } from "@/core/i18n/locales/en-US";
import { GatewayResponseError } from "@/core/api/errors";
import { resetWorkspaceQueries } from "@/core/auth/workspace-queries";
import { scheduledOriginOf } from "@/core/scheduled-tasks/messages";
import { parseScheduleToolResult } from "@/core/scheduled-tasks/tool-result";
import type { ScheduledTaskEvent } from "@/core/scheduled-tasks/events";
import {
  createWorkspaceToastStore,
  workspaceToastKey,
} from "@/core/workspace-shell/toast";
import { loadScheduledThread } from "../helpers/scheduled-fixtures";
import { task } from "./fixtures";
const api = vi.hoisted(() => ({
  detail: vi.fn(),
  thread: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  trigger: vi.fn(),
}));
vi.mock("@/core/scheduled-tasks/api", async (original) => ({
  ...(await original<typeof import("@/core/scheduled-tasks/api")>()),
  fetchScheduledTask: api.detail,
  fetchThreadScheduledTasks: api.thread,
  pauseScheduledTask: api.pause,
  resumeScheduledTask: api.resume,
  triggerScheduledTask: api.trigger,
}));
vi.mock("@/composables/useSchedulerFeatures", () => ({
  useScheduledTasksFeature: () => ({
    available: ref(true),
    running: ref(true),
    toolEnabled: ref(true),
    isLoading: ref(false),
  }),
}));
const toast = createWorkspaceToastStore();
const wrappers: ReturnType<typeof mount>[] = [];
const clients: QueryClient[] = [];
const link = defineComponent({
  props: ["to"],
  template: '<a :href="to"><slot /></a>',
});
function host(component: Component, props: Record<string, unknown>) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  clients.push(client);
  const wrapper = mount(component, {
    props,
    attachTo: document.body,
    global: {
      plugins: [[VueQueryPlugin, { queryClient: client }]],
      provide: { [workspaceToastKey as symbol]: toast },
      stubs: {
        NuxtLink: link,
        // Scheduled-message behavior owns the list; renderer behavior has its own tests.
        MessageMarkdown: {
          props: ["content"],
          template: '<div data-testid="markdown">{{ content }}</div>',
        },
        WorkspaceChangesBadge: true,
        SubtaskCard: true,
      },
    },
  });
  wrappers.push(wrapper);
  return { wrapper, client };
}
function result(action = "create") {
  return parseScheduleToolResult(
    JSON.stringify({
      action,
      display: "card",
      task: {
        id: "task-1",
        title: "Daily digest",
        status: "enabled",
        schedule_type: "cron",
        schedule_spec: { cron: "0 9 * * *" },
        timezone: "UTC",
        prompt: "Summarize updates",
        context_mode: "fresh_thread_per_run",
      },
    }),
  )!;
}
const event: ScheduledTaskEvent = {
  id: "event-hidden",
  task_id: "task-1",
  task_title: "Daily digest",
  event: "task_finished",
  reason_code: "max_runs",
  stop_condition: null,
  run_thread_id: null,
  run_number: 3,
  run_status: "success",
  max_runs: 3,
  end_at: null,
  schedule_type: "cron",
  after_run_id: null,
  created_at: "2030-01-01T09:00:00Z",
};
beforeEach(() => {
  vi.clearAllMocks();
  toast.clear();
  api.detail.mockResolvedValue(task());
  api.thread.mockResolvedValue([]);
  api.pause.mockResolvedValue(task({ status: "paused" }));
  api.resume.mockResolvedValue(task());
  api.trigger.mockResolvedValue({
    outcome: "started",
    thread_id: "trial-thread",
  });
  vi.stubGlobal("useNuxtApp", () => ({
    $i18n: { t: ref(enUS), locale: ref("en-US") },
  }));
});
afterEach(() => {
  wrappers.splice(0).forEach((w) => w.unmount());
  clients.splice(0).forEach((c) => c.clear());
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});
describe("scheduled chat product surfaces", () => {
  it("replaces a saved card with a deleted snapshot on definitive 404 and stops polling", async () => {
    api.detail.mockRejectedValue(
      new GatewayResponseError("missing", 404, { detail: "missing" }, ""),
    );
    const { wrapper } = host(ScheduledTaskCard, { result: result() });
    await flushPromises();
    expect(
      wrapper.get("[data-testid=scheduled-task-card]").attributes("data-state"),
    ).toBe("deleted");
    expect(wrapper.text()).toContain(enUS.scheduledTasks.card.deleted);
    expect(wrapper.find("button").exists()).toBe(false);
  });
  it("renders a tool delete without fetching a deleted task", async () => {
    const { wrapper } = host(ScheduledTaskCard, { result: result("delete") });
    await flushPromises();
    expect(wrapper.text()).toContain("Daily digest");
    expect(api.detail).not.toHaveBeenCalled();
  });
  it("keeps a paused trial actionable and links its actual run thread", async () => {
    api.detail.mockResolvedValue(
      task({ status: "paused", assistant_id: "analyst" }),
    );
    const { wrapper } = host(ScheduledTaskCard, { result: result() });
    await flushPromises();
    await wrapper
      .findAll("button")
      .find((b) => b.text() === enUS.scheduledTasks.actions.runNow)!
      .trigger("click");
    await flushPromises();
    expect(api.trigger).toHaveBeenCalledWith("task-1");
    expect(
      wrapper
        .get("[data-testid=scheduled-task-card-trial] a")
        .attributes("href"),
    ).toContain("trial-thread");
  });
  it("keeps exhausted resume visible with the backend reason and task renewal link", async () => {
    api.detail.mockResolvedValue(task({ status: "paused" }));
    api.resume.mockRejectedValue(
      new GatewayResponseError(
        "cap",
        409,
        {
          detail: {
            code: "limits_exhausted",
            params: { max_runs: 3, limit: "max_runs" },
          },
        },
        "",
      ),
    );
    const { wrapper } = host(ScheduledTaskCard, { result: result() });
    await flushPromises();
    await wrapper
      .findAll("button")
      .find((b) => b.text() === enUS.scheduledTasks.actions.resume)!
      .trigger("click");
    await flushPromises();
    expect(wrapper.get("[role=alert]").text()).toContain(
      enUS.scheduledTasks.apiErrors.limitsExhaustedRuns.replace(
        "{max_runs}",
        "3",
      ),
    );
    expect(wrapper.get("[role=alert] a").attributes("href")).toBe(
      "/workspace/scheduled-tasks?task_id=task-1",
    );
  });
  it("suppresses old-account action feedback on late completion", async () => {
    let complete!: (value: ReturnType<typeof task>) => void;
    api.pause.mockImplementation(
      () => new Promise((done) => (complete = done)),
    );
    const { wrapper, client } = host(ScheduledTaskCard, { result: result() });
    await flushPromises();
    await wrapper
      .findAll("button")
      .find((b) => b.text() === enUS.scheduledTasks.actions.pause)!
      .trigger("click");
    await flushPromises();
    await resetWorkspaceQueries(client);
    complete(task({ status: "paused" }));
    await flushPromises();
    expect(toast.toasts.value).toHaveLength(0);
  });
  it("renders the structured scheduled origin read-only with expandable instructions and notes", async () => {
    const fixture = loadScheduledThread("minute-run");
    const human = fixture.messages.find((m) => m.type === "human")!;
    const origin = scheduledOriginOf(human)!;
    const { wrapper } = host(ScheduledRunPrompt, { origin });
    expect(
      wrapper.find("[data-testid=scheduled-run-instructions]").exists(),
    ).toBe(false);
    await wrapper.get("button").trigger("click");
    await flushPromises();
    expect(wrapper.get("[data-testid=scheduled-run-instructions]").text()).toBe(
      origin.instructions,
    );
    expect(wrapper.find("textarea").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("deerflow_scheduled_origin");
  });
  it("keeps a deleted task lifecycle event as a readable immutable history line", () => {
    const { wrapper } = host(ScheduledTaskEventLine, { event });
    expect(wrapper.get("[role=note]").text()).toContain("Daily digest");
    expect(
      wrapper
        .get("[data-testid=scheduled-task-event-action]")
        .attributes("href"),
    ).toContain("task-1");
    expect(wrapper.text()).not.toContain("event-hidden");
    expect(wrapper.find("time").attributes("datetime")).toBe(event.created_at);
  });
  it("links run-only associations to their task and owned multiple schedules to thread filtering", async () => {
    api.thread.mockResolvedValue([task({ thread_relation: "run" })]);
    const { wrapper } = host(ThreadScheduledTasksButton, {
      threadId: "thread-A",
    });
    await flushPromises();
    expect(wrapper.get("a").attributes("href")).toBe(
      "/workspace/scheduled-tasks?task_id=task-1",
    );
    api.thread.mockResolvedValue([task(), task({ id: "task-2" })]);
    await wrapper.setProps({ threadId: "thread-B" });
    await flushPromises();
    expect(wrapper.get("a").attributes("href")).toBe(
      "/workspace/scheduled-tasks?thread_id=thread-B",
    );
    expect(wrapper.get("a").text()).toContain("2");
  });
  it("renders chat origin instead of launch payload and measured event rows in the actual message list", async () => {
    const fixture = loadScheduledThread("minute-run");
    const { wrapper } = host(MessageList, {
      messages: fixture.messages,
      rawMessages: fixture.messages,
      streaming: false,
      loading: false,
      threadId: fixture.thread_id,
      interactive: true,
      scheduledEvents: [event],
    });
    expect(wrapper.find("[data-testid=markdown]").exists()).toBe(true);
    await flushPromises();
    expect(wrapper.find("[data-testid=scheduled-run-prompt]").exists()).toBe(
      true,
    );
    expect(
      wrapper.find("[data-testid=scheduled-task-event-line]").exists(),
    ).toBe(true);
    expect(wrapper.find("[data-testid=edit-message]").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("deerflow_scheduled_origin");
  });
});
describe("channel proactive schedule capability notice", () => {
  it.each([
    [undefined, true, null],
    [false, true, enUS.channels.scheduledUpdates.unsupported],
    [true, true, enUS.channels.scheduledUpdates.supported],
    [true, false, enUS.channels.scheduledUpdates.supportedAfterConnect],
  ])(
    "renders only a discovered boolean capability %s connected=%s",
    (flag, connected, text) => {
      const { wrapper } = host(ChannelScheduledUpdates, {
        provider: { proactive_notifications: flag },
        connected,
      });
      expect(
        wrapper.find("[data-testid=channel-scheduled-updates]").exists(),
      ).toBe(text !== null);
      if (text) expect(wrapper.text()).toBe(text);
    },
  );
});
