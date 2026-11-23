import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, expect, it } from "vitest";

import MessageList from "@/components/chat/MessageList.vue";
import type { ScheduledTaskEvent } from "@/core/scheduled-tasks/events";
import {
  createWorkspaceToastStore,
  workspaceToastKey,
} from "@/core/workspace-shell/toast";

const wrappers: ReturnType<typeof mount>[] = [];
const clients: QueryClient[] = [];
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  clients.splice(0).forEach((client) => client.clear());
});

const event: ScheduledTaskEvent = {
  id: "paused-event",
  task_id: "schedule",
  event: "task_stopped",
  reason_code: "agent_stop",
  task_title: "Daily review",
  stop_condition: null,
  run_thread_id: null,
  run_number: null,
  run_status: null,
  max_runs: null,
  end_at: null,
  schedule_type: null,
  after_run_id: null,
  created_at: "2026-10-10T00:00:00Z",
};

it("retires only empty timeline gutters while preserving the physical owner through content transitions", async () => {
  const queryClient = new QueryClient();
  clients.push(queryClient);
  const wrapper = mount(MessageList, {
    attachTo: document.body,
    props: {
      messages: [],
      streaming: false,
      loading: false,
      threadId: "empty-layout",
    },
    global: {
      plugins: [[VueQueryPlugin, { queryClient }]],
      provide: { [workspaceToastKey as symbol]: createWorkspaceToastStore() },
      stubs: {
        NuxtLink: {
          props: ["to"],
          template: '<a :href="to"><slot /></a>',
        },
      },
    },
  });
  wrappers.push(wrapper);
  const viewport = wrapper.get('[role="log"] > div').element;
  const content = wrapper.get('[data-testid="message-list-content"]');
  const expectGutters = (present: boolean) => {
    expect(content.classes().includes("pt-8")).toBe(present);
    expect((content.element as HTMLElement).style.paddingBottom).toBe(
      present ? "calc(var(--spacing) * 12 + 24px)" : "",
    );
    expect(wrapper.get('[role="log"] > div').element).toBe(viewport);
    expect(viewport.classList.contains("overflow-y-auto")).toBe(true);
    expect(viewport.hasAttribute("tabindex")).toBe(false);
  };
  expectGutters(false);
  await wrapper.setProps({
    messages: [{ id: "human", type: "human", content: "A real message" }],
  });
  await flushPromises();
  expect(content.text()).toContain("A real message");
  expectGutters(true);

  await wrapper.setProps({ messages: [], streaming: true });
  expect(wrapper.find('[role="status"]').exists()).toBe(true);
  expectGutters(true);
  await wrapper.setProps({ streaming: false, hasMoreHistory: true });
  expect(wrapper.find('[data-testid="load-earlier-messages"]').exists()).toBe(
    true,
  );
  expectGutters(true);
  await wrapper.setProps({ hasMoreHistory: false, historyLoadingMore: true });
  expect(
    wrapper.get('[data-testid="load-earlier-messages"]').attributes("disabled"),
  ).toBeDefined();
  expectGutters(true);
  await wrapper.setProps({ historyLoadingMore: false, loading: true });
  expect(wrapper.find('[role="status"]').exists()).toBe(true);
  expectGutters(true);
  await wrapper.setProps({ loading: false, scheduledEvents: [event] });
  expect(content.text()).toContain("Daily review");
  expectGutters(true);
  await wrapper.setProps({ scheduledEvents: [] });
  expectGutters(false);
});
