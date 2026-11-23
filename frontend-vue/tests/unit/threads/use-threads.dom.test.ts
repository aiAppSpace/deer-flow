import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { defineComponent, h, ref } from "vue";

import { useThreads } from "@/composables/useThreads";
import {
  INFINITE_THREADS_QUERY_KEY_PREFIX,
  mapInfiniteThreadsCache,
  filterInfiniteThreadsCache,
  upsertThreadInInfiniteCache,
} from "@/core/threads/infinite";
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
  it("keeps all-conversation references separate from the sidebar and pages by raw server offsets", async () => {
    const scope = ref<boolean | "all">("all");
    const fullPage = [
      thread("hidden-sidecar", true),
      ...Array.from({ length: 49 }, (_, i) => thread(`visible-${i}`)),
    ];
    apiClient.threads.search
      .mockReset()
      .mockResolvedValueOnce(fullPage)
      .mockResolvedValueOnce([thread("archived-last")])
      .mockResolvedValueOnce([thread("archived-tail")]);
    searchThreadsByArchive
      .mockReset()
      .mockImplementation(async ({ archived }: { archived: boolean }) => [
        thread(archived ? "archive-tab" : "sidebar-only"),
      ]);
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    let references!: ReturnType<typeof useThreads>;
    let sidebar!: ReturnType<typeof useThreads>;
    const wrapper = mount(
      defineComponent({
        setup() {
          references = useThreads({ archived: scope });
          sidebar = useThreads();
          return () => h("div");
        },
      }),
      { global: { plugins: [[VueQueryPlugin, { queryClient: client }]] } },
    );
    try {
      await flushPromises();
      expect(references.threads).toHaveLength(50);
      expect(references.threads.map((row) => row.thread_id)).toContain(
        "archived-last",
      );
      expect(references.threads.map((row) => row.thread_id)).not.toContain(
        "hidden-sidecar",
      );
      expect(sidebar.threads.map((row) => row.thread_id)).toEqual([
        "sidebar-only",
      ]);
      expect(
        apiClient.threads.search.mock.calls.map(([query]) => ({
          offset: query.offset,
          limit: query.limit,
        })),
      ).toEqual([
        { offset: 0, limit: 50 },
        { offset: 50, limit: 1 },
      ]);
      expect(references.hasMore).toBe(true);
      await references.loadMore();
      await flushPromises();
      expect(apiClient.threads.search).toHaveBeenLastCalledWith(
        expect.objectContaining({ offset: 51, limit: 50 }),
      );
      expect(references.threads).toHaveLength(51);
      expect(references.hasMore).toBe(false);
      scope.value = true;
      await flushPromises();
      expect(references.threads.map((row) => row.thread_id)).toEqual([
        "archive-tab",
      ]);
      expect(sidebar.threads.map((row) => row.thread_id)).toEqual([
        "sidebar-only",
      ]);
      expect(searchThreadsByArchive).toHaveBeenCalledWith(
        expect.objectContaining({ archived: true }),
      );
    } finally {
      wrapper.unmount();
      client.clear();
    }
  });
  it.each([
    ["all", "map"],
    ["all", "filter"],
    ["all", "upsert"],
    [false, "map"],
    [false, "filter"],
    [true, "map"],
    [true, "filter"],
  ] as const)(
    "retains raw cursor and exhaustion after %s scope %s cache mutation",
    async (scope, operation) => {
      const raw = [
        thread("hidden", true),
        ...Array.from({ length: 52 }, (_, index) => thread(`row-${index}`)),
      ];
      const search = vi.fn(
        async ({ offset, limit }: { offset: number; limit: number }) =>
          raw.slice(offset, offset + limit),
      );
      apiClient.threads.search.mockReset().mockImplementation(search);
      searchThreadsByArchive.mockReset().mockImplementation(search);
      const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      let owner!: ReturnType<typeof useThreads>;
      const wrapper = mount(
        defineComponent({
          setup() {
            owner = useThreads({ archived: scope });
            return () => h("div");
          },
        }),
        { global: { plugins: [[VueQueryPlugin, { queryClient: client }]] } },
      );
      const mutate = () => {
        if (operation === "upsert") {
          upsertThreadInInfiniteCache(client, {
            ...thread("row-0"),
            metadata: { edited: true },
          });
        } else {
          client.setQueriesData(
            { queryKey: INFINITE_THREADS_QUERY_KEY_PREFIX },
            (data: Parameters<typeof mapInfiniteThreadsCache>[0]) =>
              operation === "map"
                ? mapInfiniteThreadsCache(data, (row) => ({
                    ...row,
                    metadata: { ...row.metadata, edited: true },
                  }))
                : filterInfiniteThreadsCache(
                    data,
                    (row) => row.thread_id !== "row-0",
                  ),
          );
        }
      };
      try {
        await flushPromises();
        expect(owner.threads).toHaveLength(50);
        expect(
          search.mock.calls.map(([request]) => [request.offset, request.limit]),
        ).toEqual([
          [0, 50],
          [50, 1],
        ]);
        mutate();
        await flushPromises();
        if (operation === "filter") expect(owner.threads).toHaveLength(49);
        else
          expect(
            owner.threads.find((row) => row.thread_id === "row-0")?.metadata
              .edited,
          ).toBe(true);
        expect(owner.hasMore).toBe(true);
        await owner.loadMore();
        await flushPromises();
        expect(search).toHaveBeenLastCalledWith(
          expect.objectContaining({ offset: 51, limit: 50 }),
        );
        expect(owner.threads.map((row) => row.thread_id)).toContain("row-51");
        expect(owner.hasMore).toBe(false);
        mutate();
        client.setQueriesData(
          { queryKey: INFINITE_THREADS_QUERY_KEY_PREFIX },
          (data: Parameters<typeof filterInfiniteThreadsCache>[0]) =>
            filterInfiniteThreadsCache(
              data,
              (row) => row.thread_id !== "row-51",
            ),
        );
        await flushPromises();
        expect(owner.hasMore).toBe(false);
        await owner.loadMore();
        expect(search).toHaveBeenCalledTimes(3);
      } finally {
        wrapper.unmount();
        client.clear();
      }
    },
  );

  it("keeps all, active and archived cursor owners independent after local removal", async () => {
    const rows = (scope: string) => [
      thread(`${scope}-sidecar`, true),
      ...Array.from({ length: 52 }, (_, index) => thread(`${scope}-${index}`)),
    ];
    const allRows = rows("all");
    const activeRows = rows("active");
    const archivedRows = rows("archived");
    apiClient.threads.search
      .mockReset()
      .mockImplementation(
        async ({ offset, limit }: { offset: number; limit: number }) =>
          allRows.slice(offset, offset + limit),
      );
    searchThreadsByArchive
      .mockReset()
      .mockImplementation(
        async ({
          archived,
          offset,
          limit,
        }: {
          archived: boolean;
          offset: number;
          limit: number;
        }) =>
          (archived ? archivedRows : activeRows).slice(offset, offset + limit),
      );
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const owners: ReturnType<typeof useThreads>[] = [];
    const wrapper = mount(
      defineComponent({
        setup() {
          owners.push(
            useThreads({ archived: "all" }),
            useThreads(),
            useThreads({ archived: true }),
          );
          return () => h("div");
        },
      }),
      { global: { plugins: [[VueQueryPlugin, { queryClient: client }]] } },
    );
    try {
      await flushPromises();
      const allKey = client
        .getQueryCache()
        .findAll({ queryKey: INFINITE_THREADS_QUERY_KEY_PREFIX })
        .find(
          (query) =>
            (query.queryKey[2] as { archived?: boolean }).archived ===
            undefined,
        )!.queryKey;
      client.setQueryData(
        allKey,
        (data: Parameters<typeof filterInfiniteThreadsCache>[0]) =>
          filterInfiniteThreadsCache(data, (row) => row.thread_id !== "all-0"),
      );
      await flushPromises();
      expect(owners.map((owner) => owner.threads.length)).toEqual([49, 50, 50]);
      await Promise.all(owners.map((owner) => owner.loadMore()));
      await flushPromises();
      expect(apiClient.threads.search).toHaveBeenLastCalledWith(
        expect.objectContaining({ offset: 51 }),
      );
      expect(searchThreadsByArchive).toHaveBeenCalledWith(
        expect.objectContaining({ archived: false, offset: 51 }),
      );
      expect(searchThreadsByArchive).toHaveBeenCalledWith(
        expect.objectContaining({ archived: true, offset: 51 }),
      );
      expect(owners.map((owner) => owner.threads.length)).toEqual([51, 52, 52]);
      expect(owners.map((owner) => owner.hasMore)).toEqual([
        false,
        false,
        false,
      ]);
      for (const [index, scope] of ["all", "active", "archived"].entries())
        expect(
          owners[index]!.threads.every((row) =>
            row.thread_id.startsWith(`${scope}-`),
          ),
        ).toBe(true);
    } finally {
      wrapper.unmount();
      client.clear();
    }
  });

  it("does not invent more server rows when local inserts fill an exhausted first page", async () => {
    apiClient.threads.search.mockReset().mockResolvedValue([thread("last")]);
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    let owner!: ReturnType<typeof useThreads>;
    const wrapper = mount(
      defineComponent({
        setup() {
          owner = useThreads({ archived: "all" });
          return () => h("div");
        },
      }),
      { global: { plugins: [[VueQueryPlugin, { queryClient: client }]] } },
    );
    try {
      await flushPromises();
      expect(owner.hasMore).toBe(false);
      for (let index = 0; index < 50; index++)
        upsertThreadInInfiniteCache(client, thread(`local-${index}`));
      await flushPromises();
      expect(owner.threads).toHaveLength(51);
      expect(owner.hasMore).toBe(false);
      await owner.loadMore();
      expect(apiClient.threads.search).toHaveBeenCalledTimes(1);
    } finally {
      wrapper.unmount();
      client.clear();
    }
  });

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

  // Detail snapshots cannot seed a filtered list. The current chat owns its
  // detail query independently, including when no sidebar query is enabled.
  it("列表首取在飞时详情更新不猜测成员关系，也不再发一次搜索", async () => {
    searchThreadsByArchive
      .mockReset()
      .mockReturnValue(new Promise<AgentThread[]>(() => {}));
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

    await flushPromises();
    expect(
      searchThreadsByArchive,
      "前提：首取必须已经发出且仍在飞，否则这条用例量的是另一个窗口",
    ).toHaveBeenCalledTimes(1);

    threads!.upsert(thread("already-on-the-server"));
    await flushPromises();

    expect(
      searchThreadsByArchive,
      "多出来的那一次就是空缓存上那次多余的 invalidateQueries",
    ).toHaveBeenCalledTimes(1);
    expect(
      threads!.threads.map((item) => item.thread_id),
      "详情到达不代表已确认当前过滤列表的成员关系",
    ).toEqual([]);

    wrapper.unmount();
    queryClient.clear();
  });
});

it("detail snapshots update existing rows but cannot add membership to either filtered view", async () => {
  searchThreadsByArchive.mockReset().mockResolvedValue([]);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  let current!: ReturnType<typeof useThreads>;
  let archived!: ReturnType<typeof useThreads>;
  const wrapper = mount(
    defineComponent({
      setup() {
        current = useThreads({ enabled: false });
        archived = useThreads({ archived: true, enabled: false });
        return () => h("div");
      },
    }),
    { global: { plugins: [[VueQueryPlugin, { queryClient }]] } },
  );
  try {
    const keys = queryClient
      .getQueryCache()
      .getAll()
      .map((query) => query.queryKey);
    for (const key of keys)
      queryClient.setQueryData(key, {
        pages: [{ threads: [thread("known")], nextOffset: null }],
        pageParams: [0],
      });
    await flushPromises();
    current.upsert({
      ...thread("known"),
      values: { title: "New detail", messages: [] },
    });
    await flushPromises();
    expect(current.threads[0]?.values.title).toBe("New detail");
    expect(archived.threads[0]?.values.title).toBe("New detail");
    current.upsert(thread("unknown"));
    current.upsert(thread("unknown"));
    await flushPromises();
    expect(current.threads.map((row) => row.thread_id)).toEqual(["known"]);
    expect(archived.threads.map((row) => row.thread_id)).toEqual(["known"]);
    expect(searchThreadsByArchive).not.toHaveBeenCalled();
    expect(
      keys.map((key) => queryClient.getQueryState(key)?.isInvalidated),
    ).toEqual([false, false]);
    current.upsertCreated("new-run", "New run");
    expect(current.threads.map((row) => row.thread_id)).toEqual(["known"]);
    expect(archived.threads.map((row) => row.thread_id)).toEqual(["known"]);
    expect(
      keys.map((key) => queryClient.getQueryState(key)?.isInvalidated),
    ).toEqual([true, true]);
  } finally {
    wrapper.unmount();
    queryClient.clear();
  }
});
