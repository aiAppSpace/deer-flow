import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";

import { useThreads } from "@/composables/useThreads";
import { INFINITE_THREADS_QUERY_KEY_PREFIX } from "@/core/threads/infinite";
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
    values: { title: id, messages: [] },
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

  /*
    **归档会 `resetQueries` 这个 key**（core/threads/archive.ts：成员关系变了、
    旧的分页偏移作废，reset 而不是 invalidate 是对的）。这一条钉的是 reset 之后
    列表**还会自己回来**。

    此前不会：列表是 `enabled: false` 的手动查询，探针实测 Vue Query 5 对这种查询
    `resetQueries` **把数据清空而且不重取**——归档一条会话，侧栏当场空了，
    直到换路由或手动刷新。现有 e2e 没有在归档之后看侧栏，所以门禁全绿。
  */
  it("列表被 resetQueries 清空之后会自己重新取回来", async () => {
    searchThreadsByArchive.mockReset().mockResolvedValue([thread("t-1")]);
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
    expect(threads!.threads).toHaveLength(1);

    await queryClient.resetQueries({
      queryKey: INFINITE_THREADS_QUERY_KEY_PREFIX,
    });
    await flushPromises();

    expect(searchThreadsByArchive.mock.calls.length).toBeGreaterThan(1);
    expect(threads!.threads).toHaveLength(1);

    wrapper.unmount();
    queryClient.clear();
  });

  /*
    改名的三步（cancel 在途 → 本地写 → 让服务端那份收敛）。**第三步是这一轮补的**：
    此前改完只写本地缓存，服务端把标题规范化过、或者别的设备并发改过名时永远收不回来。
    上游 `useRenameThread`（frontend/src/core/threads/hooks.ts:3310）三步都做。

    **断言落在「有没有再问一次后端」上，不落在「调了几次 invalidateQueries」上。**
    第一版就是钉的调用次数，绿得很顺——而真实行为一点没变：本仓的列表查询是
    `enabled: false` 的手动查询，`invalidateQueries` 只把它标脏，没有观察者会去重取。
    对照台账那一行 `requestsOnlyReact: POST /api/threads/search` 一行没动，
    是它把这条假绿量出来的。
  */
  it("改名之后要 cancel 在途列表、写本地缓存、再向后端要一次", async () => {
    /*
      第二次搜索**故意返回一个不同的标题**：服务端把标题规范化过（trim / 截断）
      就是这个形状。收敛到它，才说明这一步真的以服务端为准，
      而不是在重复一遍本地写进去的字符串。
    */
    const serverTitle = "Renamed title (server)";
    searchThreadsByArchive
      .mockReset()
      .mockResolvedValueOnce([thread("t-1")])
      .mockResolvedValue([
        { ...thread("t-1"), values: { title: serverTitle, messages: [] } },
      ]);
    apiClient.threads.updateState.mockReset().mockResolvedValue(undefined);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const cancelled: unknown[][] = [];
    const invalidated: unknown[][] = [];
    vi.spyOn(queryClient, "cancelQueries").mockImplementation(
      (async (filters?: { queryKey?: unknown[] }) => {
        cancelled.push(filters?.queryKey ?? []);
      }) as never,
    );
    vi.spyOn(queryClient, "invalidateQueries").mockImplementation(
      (async (filters?: { queryKey?: unknown[] }) => {
        invalidated.push(filters?.queryKey ?? []);
      }) as never,
    );

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

    const titleNow = () =>
      threads!.threads.find((row) => row.thread_id === "t-1")?.values.title;

    await threads!.rename("t-1", "Renamed title");

    expect(apiClient.threads.updateState).toHaveBeenCalledWith("t-1", {
      values: { title: "Renamed title" },
    });
    // 在途的列表请求先掐掉，否则它回来时会把旧标题写回缓存。
    expect(cancelled).toEqual([["threads", "searchInfinite"]]);
    /*
      重取**没有被 await**（对话框不等网络就关），所以这一刻界面上是本地写的那个
      ——这一行钉的就是第 2 步。
    */
    expect(titleNow()).toBe("Renamed title");

    await flushPromises();

    // 真的又问了一次后端，而且收敛到了服务端返回的那一份：第 3 步的机器证据。
    expect(searchThreadsByArchive).toHaveBeenCalledTimes(2);
    expect(titleNow()).toBe(serverTitle);
    /*
      项目页那张 REST 列表是普通 enabled 查询，失效就够。

      **单条线程的元数据查询也要失效**（wave 216）：`useThreadMetadata` 持有
      同一条线程的 `values.title`，改完名不让它重读，那份缓存就留着旧标题。
      在此之前本仓根本没有这个查询，于是全仓对 `["thread","metadata",id]` 的
      三处失效（归档、移到项目、run 结束）**都是空操作**——对照台账
      `thread-title-sync` 上那条 `requestsOnlyReact: GET /langgraph/threads/{id}`
      就是这个缺口。
    */
    expect(invalidated).toEqual([
      ["projects", "threads"],
      ["thread", "metadata", "t-1"],
    ]);

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
