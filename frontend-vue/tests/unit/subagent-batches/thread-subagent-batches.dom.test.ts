/*
  【文件职责】     守住批次抽屉的可见行为，重点是**两个能力各管什么**。
  【架构位置】     测试
  【依赖关系】     ThreadSubagentBatches.vue · composables/useWorkspaceFeatures · core/subagent-batches
  【边界与注意】   「有存储」和「worker 在跑」是两件事，四种组合各有各的正确行为，
                   所以四种都要有样本——合成一个布尔来测，等于把这个设计测没了。

                   Sheet 的内容 portal 到 body，断言走 `document.body`。
*/

import { flushPromises, mount } from "@vue/test-utils";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

const api = vi.hoisted(() => ({
  list: vi.fn(),
  items: vi.fn(),
  control: vi.fn(),
  retry: vi.fn(),
}));
vi.mock("@/core/subagent-batches/api", async (loadOriginal) => {
  const actual =
    await loadOriginal<typeof import("@/core/subagent-batches/api")>();
  return {
    ...actual,
    fetchSubagentBatches: api.list,
    fetchSubagentBatchItems: api.items,
    controlSubagentBatch: api.control,
    retrySubagentBatchItem: api.retry,
  };
});

const features = vi.hoisted(() => ({
  capability: undefined as unknown as {
    value: {
      repositoryAvailable: boolean;
      workerRunning: boolean;
      maxRunning: number;
    };
  },
}));
vi.mock("@/composables/useWorkspaceFeatures", async () => {
  const { ref: makeRef } = await import("vue");
  features.capability = makeRef({
    repositoryAvailable: true,
    workerRunning: true,
    maxRunning: 4,
  });
  return {
    useSubagentBatchesCapability: () => ({
      loaded: makeRef(true),
      capability: features.capability,
      refresh: vi.fn(),
    }),
  };
});

import ThreadSubagentBatches from "@/components/workspace/ThreadSubagentBatches.vue";
import { enUS } from "@/core/i18n/locales/en-US";
import type {
  SubagentBatch,
  SubagentBatchCounts,
} from "@/core/subagent-batches";
import {
  createWorkspaceToastStore,
  workspaceToastKey,
} from "@/core/workspace-shell/toast";

let toastStore = createWorkspaceToastStore();

function counts(overrides: Partial<SubagentBatchCounts> = {}) {
  return {
    pending: 0,
    queued: 0,
    leased: 0,
    running: 0,
    succeeded: 0,
    failed: 0,
    cancelled: 0,
    ...overrides,
  };
}

function batch(overrides: Partial<SubagentBatch> = {}): SubagentBatch {
  return {
    id: "b1",
    title: "Research 40 papers",
    subagent_type: "researcher",
    status: "running",
    total_items: 10,
    max_live_items: 5,
    max_running_items: 2,
    max_attempts: 3,
    counts: counts({ succeeded: 3, running: 2 }),
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    completed_at: null,
    ...overrides,
  };
}

beforeEach(() => {
  toastStore = createWorkspaceToastStore();
  features.capability.value = {
    repositoryAvailable: true,
    workerRunning: true,
    maxRunning: 4,
  };
  api.list.mockReset();
  api.items.mockReset();
  api.control.mockReset();
  api.retry.mockReset();
  api.items.mockResolvedValue([]);
  vi.stubGlobal("useNuxtApp", () => ({
    $i18n: { t: ref(enUS), locale: ref("en-US") },
  }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

function mountBatches() {
  return mount(ThreadSubagentBatches, {
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
    '[data-testid="subagent-batches-trigger"]',
  );

async function openDrawer(wrapper: ReturnType<typeof mountBatches>) {
  trigger()!.click();
  await flushPromises();
  await wrapper.vm.$nextTick();
}

const buttonWithText = (text: string) =>
  [...document.body.querySelectorAll("button")].find((button) =>
    button.textContent?.includes(text),
  );

describe("ThreadSubagentBatches：两个能力各管什么", () => {
  it("没有存储时整块不渲染，也不问 Gateway", async () => {
    features.capability.value = {
      repositoryAvailable: false,
      workerRunning: false,
      maxRunning: 0,
    };
    api.list.mockResolvedValue([]);
    const wrapper = mountBatches();
    await flushPromises();
    expect(trigger()).toBeNull();
    expect(api.list).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  /*
    worker 在跑但没有存储，是后端可能报出来的组合（worker 起来了、仓库还没就绪）。
    这时候画出入口，用户点开只会看到一个永远读不到数据的抽屉——`enabled` 已经
    把请求挡住了，但那只是不发请求，入口该不该出是另一件事。
  */
  it("worker 在跑但没有存储：仍然不渲染", async () => {
    features.capability.value = {
      repositoryAvailable: false,
      workerRunning: true,
      maxRunning: 4,
    };
    api.list.mockResolvedValue([]);
    const wrapper = mountBatches();
    await flushPromises();
    expect(trigger()).toBeNull();
    expect(api.list).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("有存储、worker 停了、但有历史批次：照样渲染，并说明 worker 不可用", async () => {
    features.capability.value = {
      repositoryAvailable: true,
      workerRunning: false,
      maxRunning: 0,
    };
    api.list.mockResolvedValue([batch({ status: "paused" })]);
    const wrapper = mountBatches();
    await flushPromises();
    expect(trigger()).not.toBeNull();
    await openDrawer(wrapper);
    expect(document.body.textContent).toContain(
      enUS.subagentBatches.workerUnavailable,
    );
    // 控制键还在，但点不动——批次还在那儿，只是现在推不动它。
    const resume = buttonWithText(enUS.subagentBatches.resume)!;
    expect(resume.hasAttribute("disabled")).toBe(true);
    wrapper.unmount();
  });

  it("有存储、worker 停了、一条历史都没有：不渲染", async () => {
    features.capability.value = {
      repositoryAvailable: true,
      workerRunning: false,
      maxRunning: 0,
    };
    api.list.mockResolvedValue([]);
    const wrapper = mountBatches();
    await flushPromises();
    // 一个空抽屉加一句「worker 没跑」对用户没有用。
    expect(trigger()).toBeNull();
    wrapper.unmount();
  });
});

describe("ThreadSubagentBatches", () => {
  it("徽章只数活跃批次", async () => {
    api.list.mockResolvedValue([
      batch({ id: "a", status: "running" }),
      batch({ id: "b", status: "paused" }),
      batch({ id: "c", status: "completed" }),
    ]);
    const wrapper = mountBatches();
    await flushPromises();
    expect(trigger()!.textContent).toContain("2");
    wrapper.unmount();
  });

  it("进度把失败和取消也算成跑完了", async () => {
    api.list.mockResolvedValue([
      batch({
        total_items: 10,
        counts: counts({ succeeded: 3, failed: 2, cancelled: 1, running: 4 }),
      }),
    ]);
    const wrapper = mountBatches();
    await flushPromises();
    await openDrawer(wrapper);
    expect(document.body.textContent).toContain(
      enUS.subagentBatches.progress(6, 10),
    );
    const indicator = document.body.querySelector<HTMLElement>(
      '[data-slot="progress-indicator"]',
    )!;
    expect(indicator.style.transform).toBe("translateX(-40%)");
    wrapper.unmount();
  });

  it.each([
    ["running", enUS.subagentBatches.pause, enUS.subagentBatches.resume],
    ["queued", enUS.subagentBatches.pause, enUS.subagentBatches.resume],
    ["paused", enUS.subagentBatches.resume, enUS.subagentBatches.pause],
  ])("%s 状态只给一颗控制键", async (status, shown, hidden) => {
    api.list.mockResolvedValue([
      batch({ status: status as SubagentBatch["status"] }),
    ]);
    const wrapper = mountBatches();
    await flushPromises();
    await openDrawer(wrapper);
    expect(buttonWithText(shown)).toBeDefined();
    expect(buttonWithText(hidden)).toBeUndefined();
    wrapper.unmount();
  });

  it("终态不给暂停/恢复/取消，但导出还在", async () => {
    api.list.mockResolvedValue([batch({ status: "completed" })]);
    const wrapper = mountBatches();
    await flushPromises();
    await openDrawer(wrapper);
    for (const label of [
      enUS.subagentBatches.pause,
      enUS.subagentBatches.resume,
      enUS.subagentBatches.cancel,
    ]) {
      expect(buttonWithText(label), label).toBeUndefined();
    }
    // 导出读的是已经落盘的结果，与 worker 无关。
    const link = [...document.body.querySelectorAll("a")].find((anchor) =>
      anchor.textContent?.includes(enUS.subagentBatches.exportResults),
    )!;
    expect(link.getAttribute("href")).toContain(
      "/subagent-batches/b1/results.jsonl",
    );
    expect(link.hasAttribute("download")).toBe(true);
    wrapper.unmount();
  });

  it("点暂停发的是 pause，失败弹提示", async () => {
    api.list.mockResolvedValue([batch({ status: "running" })]);
    api.control.mockRejectedValue(new Error("worker gone"));
    const wrapper = mountBatches();
    await flushPromises();
    await openDrawer(wrapper);
    buttonWithText(enUS.subagentBatches.pause)!.click();
    await flushPromises();
    expect(api.control).toHaveBeenCalledWith("thread-1", "b1", "pause");
    expect(toastStore.toasts.value.at(-1)?.message).toBe("worker gone");
    wrapper.unmount();
  });

  it("条目只在展开后才请求", async () => {
    api.list.mockResolvedValue([batch()]);
    api.items.mockResolvedValue([
      {
        id: "i1",
        batch_id: "b1",
        item_key: "paper-7",
        position: 7,
        status: "failed",
        attempt: 1,
        model_name: null,
        result_preview: null,
        result_truncated: false,
        error: "timed out",
        stop_reason: null,
        token_usage: null,
        started_at: null,
        completed_at: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ]);
    const wrapper = mountBatches();
    await flushPromises();
    await openDrawer(wrapper);
    expect(api.items).not.toHaveBeenCalled();

    buttonWithText(enUS.subagentBatches.viewItems)!.click();
    await flushPromises();
    await wrapper.vm.$nextTick();
    expect(api.items).toHaveBeenCalled();
    expect(document.body.textContent).toContain("paper-7");
    expect(document.body.textContent).toContain("timed out");
    // 只有失败的条目给重试。
    expect(buttonWithText(enUS.subagentBatches.retryItem)).toBeDefined();
    wrapper.unmount();
  });
});
