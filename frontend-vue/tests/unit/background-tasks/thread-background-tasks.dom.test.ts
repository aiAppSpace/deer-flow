/*
  【文件职责】     守住后台任务抽屉的可见行为：能力开关、活跃计数、分段、取消、详情。
  【架构位置】     测试
  【依赖关系】     ThreadBackgroundTasks.vue · composables/useWorkspaceFeatures · core/background-tasks
  【边界与注意】   能力没开时**整块不渲染**，不是渲染一个禁用的键——这一条单独有用例，
                   因为它是这个组件唯一的「什么都不画」分支，坏掉之后老 Gateway 上
                   会多出一个点开必报错的入口。

                   Sheet 的内容 portal 到 body，所以断言走 `document.body`。
*/

import { flushPromises, mount } from "@vue/test-utils";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

const api = vi.hoisted(() => ({
  list: vi.fn(),
  detail: vi.fn(),
  cancel: vi.fn(),
}));
vi.mock("@/core/background-tasks/api", () => ({
  fetchBackgroundTasks: api.list,
  fetchBackgroundTask: api.detail,
  cancelBackgroundTask: api.cancel,
}));

/*
  替身必须给**真的 ref**：模板里 `v-if="mcpTasksEnabled"` 对一个 `{ value: false }`
  普通对象恒为真（对象是 truthy），于是「能力没开」这条永远测不出来。
*/
const features = vi.hoisted(() => ({
  enabled: undefined as unknown as { value: boolean },
}));
vi.mock("@/composables/useWorkspaceFeatures", async () => {
  const { ref } = await import("vue");
  features.enabled = ref(true);
  return {
    useMcpTasksEnabled: () => ({
      loaded: ref(true),
      mcpTasksEnabled: features.enabled,
      refresh: vi.fn(),
    }),
  };
});

import ThreadBackgroundTasks from "@/components/workspace/ThreadBackgroundTasks.vue";
import { enUS } from "@/core/i18n/locales/en-US";
import type { BackgroundTask } from "@/core/background-tasks";
import {
  createWorkspaceToastStore,
  workspaceToastKey,
} from "@/core/workspace-shell/toast";

let toastStore = createWorkspaceToastStore();

function task(overrides: Partial<BackgroundTask> = {}): BackgroundTask {
  return {
    task_id: "task-1",
    task_name: "Deep research",
    status: "working",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    error: null,
    tracking_degraded: false,
    cancel_requested: false,
    ...overrides,
  };
}

beforeEach(() => {
  toastStore = createWorkspaceToastStore();
  features.enabled.value = true;
  api.list.mockReset();
  api.detail.mockReset();
  api.cancel.mockReset();
  vi.stubGlobal("useNuxtApp", () => ({
    $i18n: { t: ref(enUS), locale: ref("en-US") },
  }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

function mountTasks() {
  return mount(ThreadBackgroundTasks, {
    props: { threadId: "thread-1" },
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
      provide: { [workspaceToastKey as symbol]: toastStore },
    },
  });
}

const trigger = () =>
  document.body.querySelector<HTMLElement>(
    '[data-testid="background-tasks-trigger"]',
  );

async function openDrawer(wrapper: ReturnType<typeof mountTasks>) {
  trigger()!.click();
  await flushPromises();
  await wrapper.vm.$nextTick();
}

describe("ThreadBackgroundTasks", () => {
  it("能力没开时整块不渲染，也不问 Gateway", async () => {
    features.enabled.value = false;
    api.list.mockResolvedValue([]);
    const wrapper = mountTasks();
    await flushPromises();
    expect(trigger()).toBeNull();
    expect(api.list).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("徽章只数活跃任务，超过 9 显示 9+", async () => {
    api.list.mockResolvedValue([
      task({ task_id: "a", status: "working" }),
      task({ task_id: "b", status: "submitted" }),
      task({ task_id: "c", status: "completed" }),
      task({ task_id: "d", status: "failed" }),
    ]);
    const wrapper = mountTasks();
    await flushPromises();
    // 两条活跃（completed/failed 不算），所以徽章是 2 而不是 4。
    expect(trigger()!.textContent).toContain("2");
    wrapper.unmount();

    api.list.mockResolvedValue(
      Array.from({ length: 12 }, (_, index) =>
        task({ task_id: `t-${index}`, status: "working" }),
      ),
    );
    const many = mountTasks();
    await flushPromises();
    expect(trigger()!.textContent).toContain("9+");
    many.unmount();
  });

  it("活跃与已结束分成两段，已结束那段不给取消入口", async () => {
    api.list.mockResolvedValue([
      task({ task_id: "live", task_name: "Live one", status: "working" }),
      task({ task_id: "done", task_name: "Done one", status: "completed" }),
    ]);
    const wrapper = mountTasks();
    await flushPromises();
    await openDrawer(wrapper);

    const live = document.body.querySelector(
      '[data-testid="background-task-live"]',
    )!;
    const done = document.body.querySelector(
      '[data-testid="background-task-done"]',
    )!;
    expect(live.textContent).toContain("Cancel task");
    expect(done.textContent).not.toContain("Cancel task");
    expect(document.body.textContent).toContain(enUS.backgroundTasks.active);
    expect(document.body.textContent).toContain(enUS.backgroundTasks.recent);
    wrapper.unmount();
  });

  it("一条都没有时给整块空态，不是一片空白", async () => {
    api.list.mockResolvedValue([]);
    const wrapper = mountTasks();
    await flushPromises();
    await openDrawer(wrapper);
    expect(document.body.textContent).toContain(enUS.backgroundTasks.empty);
    expect(document.body.textContent).toContain(enUS.backgroundTasks.emptyHint);
    wrapper.unmount();
  });

  it("加载失败时说清楚并给重试", async () => {
    api.list.mockRejectedValue(new Error("gateway down"));
    const wrapper = mountTasks();
    await flushPromises();
    await openDrawer(wrapper);
    expect(document.body.textContent).toContain(
      enUS.backgroundTasks.loadFailed,
    );
    expect(document.body.textContent).toContain("gateway down");
    wrapper.unmount();
  });

  it("取消成功就地更新那一行，不等下一次轮询", async () => {
    /*
      第一次列表回「运行中」，之后的重取**挂住不返回**。
      这样断言看到的 "Cancelled" 只可能来自取消响应的就地写回——
      让重取正常返回的话，这条用例对「有没有就地写回」是瞎的。
    */
    api.list
      .mockResolvedValueOnce([task({ task_id: "live", status: "working" })])
      .mockReturnValue(new Promise(() => {}));
    api.cancel.mockResolvedValue({
      ...task({ task_id: "live", status: "cancelled" }),
      last_polled_at: null,
      last_poll_error: null,
      last_cancel_error: null,
      cancel_attempt_count: 1,
      notification_status: "none",
      notification_error: null,
      notification_attempt_count: 0,
      result: null,
      result_preview: null,
      result_truncated: false,
      result_artifact: null,
      input_required: null,
    });
    const wrapper = mountTasks();
    await flushPromises();
    await openDrawer(wrapper);

    const cancel = [...document.body.querySelectorAll("button")].find(
      (button) => button.textContent?.includes("Cancel task"),
    )!;
    cancel.click();
    await flushPromises();
    await wrapper.vm.$nextTick();
    expect(api.cancel).toHaveBeenCalledWith("thread-1", "live");
    const card = document.body.querySelector(
      '[data-testid="background-task-live"]',
    )!;
    expect(card.textContent).toContain(enUS.backgroundTasks.status.cancelled);
    wrapper.unmount();
  });

  it("取消失败弹提示，卡片留在原状态", async () => {
    api.list.mockResolvedValue([task({ task_id: "live", status: "working" })]);
    api.cancel.mockRejectedValue(new Error("remote refused"));
    const wrapper = mountTasks();
    await flushPromises();
    await openDrawer(wrapper);

    const cancel = [...document.body.querySelectorAll("button")].find(
      (button) => button.textContent?.includes("Cancel task"),
    )!;
    cancel.click();
    await flushPromises();
    expect(toastStore.toasts.value.at(-1)?.message).toContain("remote refused");
    const card = document.body.querySelector(
      '[data-testid="background-task-live"]',
    )!;
    expect(card.textContent).toContain(enUS.backgroundTasks.status.working);
    wrapper.unmount();
  });

  it("详情只在展开后才请求", async () => {
    api.list.mockResolvedValue([
      task({ task_id: "done", status: "completed" }),
    ]);
    api.detail.mockResolvedValue({
      ...task({ task_id: "done", status: "completed" }),
      last_polled_at: null,
      last_poll_error: null,
      last_cancel_error: null,
      cancel_attempt_count: 0,
      notification_status: "delivered",
      notification_error: null,
      notification_attempt_count: 0,
      result: null,
      result_preview: "42 rows",
      result_truncated: false,
      result_artifact: null,
      input_required: null,
    });
    const wrapper = mountTasks();
    await flushPromises();
    await openDrawer(wrapper);
    expect(api.detail).not.toHaveBeenCalled();

    const view = [...document.body.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("View details"),
    )!;
    view.click();
    await flushPromises();
    await wrapper.vm.$nextTick();
    expect(api.detail).toHaveBeenCalledWith("thread-1", "done");
    expect(document.body.textContent).toContain("42 rows");
    wrapper.unmount();
  });
});
