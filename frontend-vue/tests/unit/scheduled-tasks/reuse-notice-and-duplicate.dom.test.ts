/*
  【文件职责】     钉住复用会话的提醒条何时出现，以及详情里的「复制」入口。
  【架构位置】     Vue DOM test
  【主要导出】     无；Vitest cases
  【依赖关系】     ScheduledTaskForm · ScheduledTaskDetail
  【边界与注意】   提醒条**只在复用会话模式下**出现：那是唯一一种会让上下文
                   一次比一次长的模式。恒常显示的话它会变成背景噪音，
                   而这句话恰恰需要被读到。
*/

import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

import ScheduledTaskDetail from "@/components/workspace/scheduled-tasks/ScheduledTaskDetail.vue";
import ScheduledTaskForm from "@/components/workspace/scheduled-tasks/ScheduledTaskForm.vue";
import { createScheduledTaskDraft } from "@/core/scheduled-tasks/form";
import { enUS } from "@/core/i18n/locales/en-US";
import type { ScheduledTask } from "@/core/scheduled-tasks/types";

const labels = enUS.scheduledTasks;

beforeEach(() => {
  vi.stubGlobal("useNuxtApp", () => ({
    $i18n: { t: ref(enUS), locale: ref("en-US") },
  }));
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function mountForm(contextMode: "fresh_thread_per_run" | "reuse_thread") {
  return mount(ScheduledTaskForm, {
    props: {
      draft: { ...createScheduledTaskDraft(), contextMode },
      pending: false,
      error: null,
    } as never,
  });
}

const notice = (wrapper: ReturnType<typeof mountForm>) =>
  wrapper.find('[data-testid="scheduled-task-reuse-notice"]');

describe("复用会话的提醒条", () => {
  it("每次新开会话时不出现", () => {
    const wrapper = mountForm("fresh_thread_per_run");
    expect(notice(wrapper).exists()).toBe(false);
    wrapper.unmount();
  });

  it("复用同一条会话时出现，标题和说明都在", () => {
    const wrapper = mountForm("reuse_thread");
    expect(notice(wrapper).text()).toContain(labels.context.reuseNoticeTitle);
    expect(notice(wrapper).text()).toContain(
      labels.context.reuseNoticeDescription,
    );
    wrapper.unmount();
  });
});

function task(): ScheduledTask {
  return {
    id: "task-1",
    title: "Daily digest",
    prompt: "Summarise",
    context_mode: "reuse_thread",
    thread_id: "thread-9",
    schedule_type: "cron",
    schedule_spec: { cron: "0 9 * * *" },
    timezone: "UTC",
    status: "active",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  } as unknown as ScheduledTask;
}

describe("详情里的「复制」", () => {
  it("点了只发事件，由页面决定怎么预填", () => {
    const wrapper = mount(ScheduledTaskDetail, {
      props: {
        task: task(),
        editDraft: createScheduledTaskDraft(),
        runs: [],
        runsHasMore: false,
        runsLoadingMore: false,
        editing: false,
        updatePending: false,
      } as never,
    });
    const button = wrapper.get('[data-testid="scheduled-task-duplicate"]');
    expect(button.text()).toContain(labels.actions.duplicate);
    button.trigger("click");
    expect(wrapper.emitted("duplicate")).toHaveLength(1);
    wrapper.unmount();
  });
});
