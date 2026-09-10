import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";

import { useThreads } from "@/composables/useThreads";
import type { AgentThread } from "@/core/threads/types";

const apiClient = vi.hoisted(() => ({
  threads: {
    search: vi.fn(),
    delete: vi.fn(),
    updateState: vi.fn(),
  },
}));
vi.mock("@/core/api/api-client", () => ({ getAPIClient: () => apiClient }));

/*
  列表这条路径走的是 **Gateway 原生的 `POST /api/threads/search`**
  （`searchThreadsByArchive`），不是 SDK 的那个 `threads.search`——
  因为只有原生那条认 `archived`，而 `useThreads` 默认就带上它。

  这几条用例原来打的是 `apiClient.threads.search`。那是**另一条分支**：
  `archived` 为 undefined 时才走。默认值改成 `false` 之后它在生产里到不了，
  于是这些用例覆盖的是一段不会执行的代码，而且照样全绿。
*/
const searchThreadsByArchive = vi.hoisted(() => vi.fn());
vi.mock("@/core/threads/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/core/threads/api")>()),
  searchThreadsByArchive,
}));

function thread(id: string, sidecar = false): AgentThread {
  return {
    thread_id: id,
    created_at: "2026-08-21T00:00:00Z",
    updated_at: "2026-08-21T00:00:00Z",
    status: "idle",
    metadata: sidecar
      ? { deerflow_sidecar: true, parent_thread_id: "main" }
      : {},
    values: { title: id },
    interrupts: {},
  };
}

describe("useThreads server-state owner", () => {
  /*
    短页 = 没有下一页。这一条钉的是 `getNextPageParam` 的**实参个数**：把函数直接
    交给 Vue Query，它会多传 `lastPageParam`，那个值会落进 `pageSize` 形参，于是
    「本页不满」的判断永远为假、`hasMore` 永远为真——列表每次加载完都会再多问一页。
  */
  it("stops paginating once the backend returns a short page", async () => {
    searchThreadsByArchive
      .mockReset()
      .mockResolvedValue([thread("only-1"), thread("only-2")]);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    let threads: ReturnType<typeof useThreads> | undefined;
    const wrapper = mount(
      defineComponent({
        setup() {
          threads = useThreads();
          return () => h("div");
        },
      }),
      { global: { plugins: [[VueQueryPlugin, { queryClient }]] } },
    );

    await threads!.loadInitial();
    await flushPromises();

    expect(searchThreadsByArchive).toHaveBeenCalledTimes(1);
    // 返回值是 reactive(...)，ref 已经解包，所以直接读属性。
    expect(threads!.hasMore).toBe(false);
    await threads!.loadMore();
    await flushPromises();
    expect(searchThreadsByArchive).toHaveBeenCalledTimes(1);
    wrapper.unmount();
    queryClient.clear();
  });

  it("filters sidecars and advances the second request by raw backend rows", async () => {
    const rawFirstPage = [
      thread("main-1"),
      ...Array.from({ length: 49 }, (_, index) =>
        thread(`side-${index}`, true),
      ),
    ];
    searchThreadsByArchive
      .mockReset()
      .mockResolvedValueOnce(rawFirstPage)
      .mockResolvedValueOnce([thread("main-2")]);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    let threads: ReturnType<typeof useThreads> | undefined;
    const wrapper = mount(
      defineComponent({
        setup() {
          threads = useThreads();
          return () => h("div");
        },
      }),
      { global: { plugins: [[VueQueryPlugin, { queryClient }]] } },
    );

    await threads!.loadInitial();
    await flushPromises();

    expect(searchThreadsByArchive).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ offset: 50, limit: 49 }),
    );
    expect(threads!.displayedThreads.map((item) => item.thread_id)).toEqual([
      "main-1",
      "main-2",
    ]);
    expect(
      threads!.displayedThreads.some(
        (item) => item.metadata?.deerflow_sidecar === true,
      ),
    ).toBe(false);

    wrapper.unmount();
    queryClient.clear();
  });

  /*
    Gateway 的语义是「omitted includes all」
    （backend/app/gateway/routers/threads.py:459）——**不传不是"只要活跃的"，
    是"连已归档的一起给"**。侧栏、聊天页、项目分区此前都不传，于是归档过的会话
    还留在列表里。上游在每个调用点各写一次 `archived: false`。
  */
  it("默认只要活跃会话，并且把 archived: false 真的发出去", async () => {
    searchThreadsByArchive.mockReset().mockResolvedValue([thread("only-1")]);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    let threads: ReturnType<typeof useThreads> | undefined;
    const wrapper = mount(
      defineComponent({
        setup() {
          threads = useThreads();
          return () => h("div");
        },
      }),
      { global: { plugins: [[VueQueryPlugin, { queryClient }]] } },
    );

    await threads!.loadInitial();
    await flushPromises();

    expect(searchThreadsByArchive).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ archived: false }),
    );
    wrapper.unmount();
    queryClient.clear();
  });

  /*
    三个主列表消费者（侧栏 / 聊天页 / 项目分区）必须落在**同一个 query key** 上：
    `archived` 进 key，谁漏传谁就拿到另一份缓存——多打一次网络，而且 AgentChat 的
    upsert 落不进侧栏那份。默认值就是用来保证这件事的。
  */
  it("不传和显式传 false 是同一份缓存", async () => {
    searchThreadsByArchive.mockReset().mockResolvedValue([thread("only-1")]);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    let implicit: ReturnType<typeof useThreads> | undefined;
    let explicit: ReturnType<typeof useThreads> | undefined;
    const wrapper = mount(
      defineComponent({
        setup() {
          implicit = useThreads();
          explicit = useThreads({ archived: false });
          return () => h("div");
        },
      }),
      { global: { plugins: [[VueQueryPlugin, { queryClient }]] } },
    );

    await implicit!.loadInitial();
    await flushPromises();

    expect(
      searchThreadsByArchive,
      "同一个 key 只该取一次；取两次说明两个消费者各有一份缓存",
    ).toHaveBeenCalledTimes(1);
    expect(explicit!.threads.map((item) => item.thread_id)).toEqual(["only-1"]);
    wrapper.unmount();
    queryClient.clear();
  });
});
