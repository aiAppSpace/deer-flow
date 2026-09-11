import { describe, expect, vi, test } from "vitest";
import {
  QueryClient,
  QueryObserver,
  type InfiniteData,
} from "@tanstack/vue-query";

import {
  STOP_THREAD_FINALIZATION_REFETCH_DELAY_MS,
  invalidateStoppedThreadCaches,
  removeDeletedThreadCaches,
  stopThreadAndInvalidateCaches,
} from "@/core/threads/cache-invalidation";
import {
  INFINITE_THREADS_PAGE_SIZE,
  INFINITE_THREADS_QUERY_KEY_PREFIX,
  fetchInfiniteThreadsPage,
  filterInfiniteThreadsCache,
  getInfiniteThreadsNextPageParam,
  mapInfiniteThreadsCache,
  upsertThreadInInfiniteCache,
} from "@/core/threads/infinite";
import type { AgentThread } from "@/core/threads/types";

// Issue #3482: the sidebar and /workspace/chats list used to be capped at
// 50 threads because `useThreads()` exits as soon as `threads.length >=
// params.limit`.  These pure helpers back the `useInfiniteThreads()`
// pagination logic and the mirrored cache writes that keep rename / delete
// / stream-finish in sync with both the legacy array cache and the new
// infinite cache.

function makeThread(
  id: string,
  title = `Title ${id}`,
  metadata: Record<string, unknown> = {},
): AgentThread {
  return {
    thread_id: id,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    metadata,
    status: "idle",
    values: { title },
  } as unknown as AgentThread;
}

function makePage(start: number, size: number): AgentThread[] {
  return Array.from({ length: size }, (_, i) => makeThread(`t-${start + i}`));
}

function makeInfiniteData(pages: AgentThread[][]): InfiniteData<AgentThread[]> {
  return {
    pages,
    pageParams: pages.map((_, i) => i * INFINITE_THREADS_PAGE_SIZE),
  };
}

describe("getInfiniteThreadsNextPageParam", () => {
  test("returns next offset when the last page is full", () => {
    const page1 = makePage(0, INFINITE_THREADS_PAGE_SIZE);
    expect(getInfiniteThreadsNextPageParam(page1, [page1])).toBe(
      INFINITE_THREADS_PAGE_SIZE,
    );
  });

  test("returns next offset across multiple full pages", () => {
    const page1 = makePage(0, INFINITE_THREADS_PAGE_SIZE);
    const page2 = makePage(
      INFINITE_THREADS_PAGE_SIZE,
      INFINITE_THREADS_PAGE_SIZE,
    );
    expect(getInfiniteThreadsNextPageParam(page2, [page1, page2])).toBe(
      INFINITE_THREADS_PAGE_SIZE * 2,
    );
  });

  test("returns undefined when the last page is short (end of list)", () => {
    const page1 = makePage(0, INFINITE_THREADS_PAGE_SIZE);
    const page2 = makePage(INFINITE_THREADS_PAGE_SIZE, 10);
    expect(
      getInfiniteThreadsNextPageParam(page2, [page1, page2]),
    ).toBeUndefined();
  });

  test("returns undefined when the last page is empty", () => {
    const page1 = makePage(0, INFINITE_THREADS_PAGE_SIZE);
    expect(getInfiniteThreadsNextPageParam([], [page1, []])).toBeUndefined();
  });

  test("respects a custom page size", () => {
    const page1 = makePage(0, 5);
    expect(getInfiniteThreadsNextPageParam(page1, [page1], 5)).toBe(5);
    expect(getInfiniteThreadsNextPageParam(page1, [page1], 10)).toBeUndefined();
  });
});

describe("fetchInfiniteThreadsPage", () => {
  test("fills a visible page while advancing offsets by raw backend rows", async () => {
    const search = vi
      .fn()
      .mockResolvedValueOnce([
        makeThread("sidecar-1", "Sidecar", { deerflow_sidecar: true }),
        makeThread("primary-1"),
      ])
      .mockResolvedValueOnce([makeThread("primary-2")]);

    const page = await fetchInfiniteThreadsPage(
      { threads: { search } },
      { sortBy: "updated_at", sortOrder: "desc" },
      0,
      2,
    );

    expect(page.map((thread) => thread.thread_id)).toEqual([
      "primary-1",
      "primary-2",
    ]);
    expect(search).toHaveBeenNthCalledWith(1, {
      sortBy: "updated_at",
      sortOrder: "desc",
      limit: 2,
      offset: 0,
    });
    expect(search).toHaveBeenNthCalledWith(2, {
      sortBy: "updated_at",
      sortOrder: "desc",
      limit: 1,
      offset: 2,
    });
    expect(getInfiniteThreadsNextPageParam(page, [page], 2)).toBe(3);
  });

  test("keeps sidecar rows when the caller explicitly searches for sidecars", async () => {
    const search = vi.fn().mockResolvedValueOnce([
      makeThread("sidecar-1", "Sidecar", {
        deerflow_sidecar: true,
        parent_thread_id: "parent-1",
      }),
    ]);

    const page = await fetchInfiniteThreadsPage(
      { threads: { search } },
      {
        sortBy: "updated_at",
        sortOrder: "desc",
        metadata: { deerflow_sidecar: true, parent_thread_id: "parent-1" },
      },
      0,
      2,
    );

    expect(page.map((thread) => thread.thread_id)).toEqual(["sidecar-1"]);
    expect(getInfiniteThreadsNextPageParam(page, [page], 2)).toBeUndefined();
  });
});

describe("mapInfiniteThreadsCache", () => {
  test("returns undefined when oldData is undefined", () => {
    expect(mapInfiniteThreadsCache(undefined, (t) => t)).toBeUndefined();
  });

  test("updates the matching thread across multiple pages", () => {
    const page1 = [makeThread("a"), makeThread("b")];
    const page2 = [makeThread("c"), makeThread("d")];
    const data = makeInfiniteData([page1, page2]);

    const updated = mapInfiniteThreadsCache(data, (t) =>
      t.thread_id === "c"
        ? { ...t, values: { ...t.values, title: "renamed" } }
        : t,
    );

    expect(updated?.pages[0]?.[0]?.values?.title).toBe("Title a");
    expect(updated?.pages[1]?.[0]?.thread_id).toBe("c");
    expect(updated?.pages[1]?.[0]?.values?.title).toBe("renamed");
    expect(updated?.pages[1]?.[1]?.values?.title).toBe("Title d");
  });

  test("preserves pageParams", () => {
    const data = makeInfiniteData([[makeThread("a")]]);
    const updated = mapInfiniteThreadsCache(data, (t) => t);
    expect(updated?.pageParams).toEqual(data.pageParams);
  });
});

describe("filterInfiniteThreadsCache", () => {
  test("returns undefined when oldData is undefined", () => {
    expect(filterInfiniteThreadsCache(undefined, () => true)).toBeUndefined();
  });

  test("removes matching threads across all pages", () => {
    const page1 = [makeThread("a"), makeThread("b")];
    const page2 = [makeThread("b"), makeThread("c")];
    const data = makeInfiniteData([page1, page2]);

    const filtered = filterInfiniteThreadsCache(
      data,
      (t) => t.thread_id !== "b",
    );

    expect(filtered?.pages[0]?.map((t) => t.thread_id)).toEqual(["a"]);
    expect(filtered?.pages[1]?.map((t) => t.thread_id)).toEqual(["c"]);
  });

  test("keeps an emptied page as an empty array (does not drop the page)", () => {
    const page1 = [makeThread("a")];
    const page2 = [makeThread("b")];
    const data = makeInfiniteData([page1, page2]);

    const filtered = filterInfiniteThreadsCache(
      data,
      (t) => t.thread_id !== "a",
    );

    expect(filtered?.pages).toHaveLength(2);
    expect(filtered?.pages[0]).toEqual([]);
    expect(filtered?.pages[1]?.[0]?.thread_id).toBe("b");
  });

  test("does not regress next offset when an earlier page has been shrunk by a delete", () => {
    // Simulate two full pages already loaded.
    const page1 = Array.from({ length: 50 }, (_, i) => ({
      thread_id: `a${i}`,
    }));
    const page2 = Array.from({ length: 50 }, (_, i) => ({
      thread_id: `b${i}`,
    }));

    // Offset right after fetching page 2 (this is the value TanStack Query
    // freezes into pageParams).
    const offsetAfterPage2 = getInfiniteThreadsNextPageParam(
      page2 as unknown as AgentThread[],
      [page1, page2] as unknown as AgentThread[][],
    );
    expect(offsetAfterPage2).toBe(100);

    // Now a delete mutation runs filterInfiniteThreadsCache and shrinks
    // page 1 from 50 to 49 entries. TanStack does NOT re-invoke
    // getNextPageParam on cache mutations; the previously-computed offset
    // (100) remains the param for the next fetchNextPage() call, so the
    // helper is consistent with how the library uses its return value.
    const shrunkPage1 = page1.slice(0, 49);
    const recomputed = getInfiniteThreadsNextPageParam(
      page2 as unknown as AgentThread[],
      [shrunkPage1, page2] as unknown as AgentThread[][],
    );
    // We document the recomputed value for completeness, but in practice
    // useDeleteThread invalidates the query in onSettled, so pages are
    // refetched from offset 0 rather than relying on this number.
    expect(recomputed).toBe(99);
  });
});

describe("upsertThreadInInfiniteCache", () => {
  function seedClient(initial?: InfiniteData<AgentThread[]>): QueryClient {
    const client = new QueryClient();
    if (initial) {
      client.setQueryData([...INFINITE_THREADS_QUERY_KEY_PREFIX, {}], initial);
    }
    return client;
  }

  function readCache(
    client: QueryClient,
  ): InfiniteData<AgentThread[]> | undefined {
    return client.getQueryData([...INFINITE_THREADS_QUERY_KEY_PREFIX, {}]);
  }

  test("no-op when the infinite cache has not been initialised yet", () => {
    const client = seedClient();
    upsertThreadInInfiniteCache(client, makeThread("new"));
    expect(readCache(client)).toBeUndefined();
  });

  test("prepends a brand-new thread to the first page", () => {
    const client = seedClient({
      pages: [[makeThread("a"), makeThread("b")]],
      pageParams: [0],
    });
    upsertThreadInInfiniteCache(client, makeThread("new"));
    const cache = readCache(client);
    expect(cache?.pages[0]?.map((t) => t.thread_id)).toEqual(["new", "a", "b"]);
  });

  test("merges into the existing entry instead of duplicating it", () => {
    const existing = makeThread("a", "Old title");
    const client = seedClient({
      pages: [[existing, makeThread("b")]],
      pageParams: [0],
    });
    // Simulate an onCreated upsert that races with a thread already in cache:
    // the cache copy should win for title/metadata (it represents later state),
    // but no duplicate row should appear.
    upsertThreadInInfiniteCache(client, {
      ...makeThread("a", "New title"),
      status: "busy",
    });
    const cache = readCache(client);
    const ids = cache?.pages[0]?.map((t) => t.thread_id);
    expect(ids).toEqual(["a", "b"]);
    expect(cache?.pages[0]?.[0]?.values.title).toBe("Old title");
  });

  /*
    **插进去之后还要问一次服务端。**

    带 `archived` 过滤的那几份缓存，成员关系是服务端说了算：一条刚建出来的 thread
    身上没有归档元数据（上游同一处的注释）。上游在这里**只失效、不插**；本仓两样
    都做，理由写在 `upsertThreadInInfiniteCache` 上——不插的话 `useThreads.upsert()`
    永远判它是「新行」，这一轮 run 里会一路级联地失效下去
    （单场景实测：只失效那版 React 4 次 / 本仓 6 次；插 + 失效之后 4 : 4）。
  */
  test("插完还会失效带 archived 过滤的那几份，交给服务端确认成员关系", () => {
    const client = new QueryClient();
    const filteredKey = [
      ...INFINITE_THREADS_QUERY_KEY_PREFIX,
      { archived: false },
    ];
    client.setQueryData(filteredKey, {
      pages: [[makeThread("a")]],
      pageParams: [0],
    });
    const invalidate = vi.spyOn(client, "invalidateQueries");

    upsertThreadInInfiniteCache(client, makeThread("new"));

    // 本地立刻可见——不插的话 upsert() 会把它一直当成新行。
    expect(
      client
        .getQueryData<InfiniteData<AgentThread[]>>(filteredKey)
        ?.pages[0]?.map((t) => t.thread_id),
    ).toEqual(["new", "a"]);
    // 同时问一次服务端，且**只问带过滤的那几份**。
    const filteredCalls = invalidate.mock.calls.filter(
      ([filters]) => filters?.predicate,
    );
    expect(filteredCalls).toHaveLength(1);
  });
});

describe("invalidateStoppedThreadCaches", () => {
  /*
    thread 级那几条**是异步的**：要先等在飞的取数被取消掉、`fetchStatus` 回到
    `idle`，`invalidateQueries` 才不会被它吞掉（见 `cache-invalidation.ts` 里
    `restartThreadScopedQueries` 的说明）。所以断言 thread 级 key 的用例都要先
    让出一个宏任务；全局那两条仍然是同步的，「没有 threadId」那条因此不用等。
  */
  const flushThreadScoped = () =>
    new Promise((resolve) => setTimeout(resolve, 0));

  function invalidatedQueryKeys(client: QueryClient) {
    const invalidate = vi.spyOn(client, "invalidateQueries");
    return {
      invalidate,
      queryKeys: () =>
        invalidate.mock.calls.map(([filters]) => filters?.queryKey),
    };
  }

  test("refreshes current thread and sidebar caches after fire-and-forget stop", async () => {
    const client = new QueryClient();
    const { queryKeys } = invalidatedQueryKeys(client);

    invalidateStoppedThreadCaches(client, "thread-1");
    await flushThreadScoped();

    expect(queryKeys()).toContainEqual(INFINITE_THREADS_QUERY_KEY_PREFIX);
    expect(queryKeys()).toContainEqual(["thread", "thread-1"]);
    expect(queryKeys()).toContainEqual(["thread", "metadata", "thread-1"]);
    expect(queryKeys()).toContainEqual(["thread-token-usage", "thread-1"]);
  });

  test("preserves loaded history pages while invalidating", async () => {
    const client = new QueryClient();
    const key = ["thread-messages", "thread-1"] as const;
    const latest = { data: [], has_more: true, next_before_seq: 20 };
    const older = { data: [], has_more: false, next_before_seq: null };
    client.setQueryData(key, {
      pages: [latest, older],
      pageParams: [null, 20],
    });

    invalidateStoppedThreadCaches(client, "thread-1");
    await flushThreadScoped();

    expect(client.getQueryData(key)).toEqual({
      pages: [latest, older],
      pageParams: [null, 20],
    });
  });

  // 上游这条叫「does not refresh per-thread API caches for mock threads」，
  // 判据是 `isMock=true` 时只失效全局那两类。**M4a 删掉了 mock 分支**
  // （`isMock` 在上游 hooks.ts 里出现 23 次，06 §M4a 把它列为「边搬边改」的
  // 理由之一），所以那个入参不存在了，条件也就没有了对象。
  //
  // 换成保留下来的那半条语义：**没有 threadId 时只失效全局两类**。
  // 新建 thread 的第一次停止走的正是这条路径，而它与 mock 分支共用同一个
  // 早退 `return`——删掉 mock 后这个 return 仍然必须在。
  test("只失效全局那一类缓存：thread 还没有 id 时", () => {
    const client = new QueryClient();
    const { queryKeys } = invalidatedQueryKeys(client);

    invalidateStoppedThreadCaches(client, null);

    expect(queryKeys()).toContainEqual(INFINITE_THREADS_QUERY_KEY_PREFIX);
    expect(queryKeys()).not.toContainEqual(["thread", "thread-1"]);
    expect(queryKeys()).not.toContainEqual(["thread", "metadata", "thread-1"]);
    expect(queryKeys()).not.toContainEqual(["thread-token-usage", "thread-1"]);
  });

  // A8 数的是**语义类别**（当前 thread / history / token usage / 侧栏搜索），
  // 落到 key 上是 6 个。这条守的是「有没有漏一类」——上游没有对应用例，
  // 因为上游把这 6 个 key 直接写死在函数体里，数不出来。
  test("A8 的四类缓存展开成五个 key，一个都不能少", async () => {
    const client = new QueryClient();
    const { queryKeys } = invalidatedQueryKeys(client);

    invalidateStoppedThreadCaches(client, "thread-1");
    await flushThreadScoped();

    expect(queryKeys()).toEqual([
      [...INFINITE_THREADS_QUERY_KEY_PREFIX],
      ["thread", "thread-1"],
      ["thread-messages", "thread-1"],
      ["thread", "metadata", "thread-1"],
      ["thread-token-usage", "thread-1"],
    ]);
  });

  /*
    **失效不许被在飞的那次取数吞掉。**

    这条守的是一个只在「新建 thread 的第一个回合」上才成立的条件：thread 级查询
    还没有任何数据（`state.data === undefined`），而 TanStack Query 的
    `cancelRefetch` 只在**已经有数据**时才会去取消并重取；没有数据时它直接复用
    在飞的那次 promise。于是「run 结束了，去把 thread 级缓存刷一遍」这句话
    **一次网络请求都不会产生**，页面停在那次取数带回来的、run 之前的世界。

    真实症状：侧边会话发出第一条消息后关掉再打开，消息列表整个是空的
    （`sidecar-chat.spec.ts` 里约 1/40 复现，wave 196）。

    这里用普通 `QueryObserver` 而不是无限查询：踩中的分支在 `Query.fetch` 里，
    与分页行为无关，用最小的查询形状反而更能说明是哪一处。
  */
  test("在飞的首次取数不许吞掉失效", async () => {
    const client = new QueryClient();
    const queryKey = ["thread-messages", "thread-1"];
    let releaseFirstFetch: () => void = () => {};
    let calls = 0;
    const queryFn = vi.fn(async () => {
      calls += 1;
      if (calls === 1) {
        // run 开始之前发出的那次：它看到的世界里这条 thread 还没有任何消息。
        await new Promise<void>((resolve) => {
          releaseFirstFetch = resolve;
        });
        return { rows: [] };
      }
      return { rows: ["run 之后的消息"] };
    });

    const observer = new QueryObserver(client, { queryKey, queryFn });
    const unsubscribe = observer.subscribe(() => {});
    await vi.waitFor(() => expect(queryFn).toHaveBeenCalledTimes(1));

    invalidateStoppedThreadCaches(client, "thread-1");
    releaseFirstFetch();

    try {
      await vi.waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));
      expect(client.getQueryData(queryKey)).toEqual({
        rows: ["run 之后的消息"],
      });
    } finally {
      unsubscribe();
    }
  });

  test("wraps SDK stop and refreshes caches after it resolves", async () => {
    const client = new QueryClient();
    const stop = vi.fn(() => Promise.resolve());
    const { queryKeys } = invalidatedQueryKeys(client);

    await stopThreadAndInvalidateCaches(client, stop, "thread-1");
    await flushThreadScoped();

    expect(stop).toHaveBeenCalledTimes(1);
    expect(queryKeys()).toContainEqual(["thread", "metadata", "thread-1"]);
  });

  test("still refreshes caches when SDK stop rejects", async () => {
    const client = new QueryClient();
    const stop = vi.fn(async () => {
      throw new Error("cancel failed");
    });
    const { queryKeys } = invalidatedQueryKeys(client);

    await expect(
      stopThreadAndInvalidateCaches(client, stop, "thread-1"),
    ).rejects.toThrow("cancel failed");
    await flushThreadScoped();

    expect(queryKeys()).toContainEqual(INFINITE_THREADS_QUERY_KEY_PREFIX);
    expect(queryKeys()).toContainEqual(["thread", "metadata", "thread-1"]);
  });

  test("schedules sidebar refetch even if stopped thread id is not known", async () => {
    vi.useFakeTimers();

    const client = new QueryClient();
    const { queryKeys } = invalidatedQueryKeys(client);

    try {
      await stopThreadAndInvalidateCaches(
        client,
        () => Promise.resolve(),
        null,
      );

      /* 数的是侧栏那张列表被失效了几次（真实 key，不是那个没人拥有的死键）。 */
      const countListInvalidations = () =>
        queryKeys().filter(
          (queryKey) =>
            queryKey?.length === 2 &&
            queryKey[0] === INFINITE_THREADS_QUERY_KEY_PREFIX[0] &&
            queryKey[1] === INFINITE_THREADS_QUERY_KEY_PREFIX[1],
        ).length;

      expect(countListInvalidations()).toBe(1);

      await vi.advanceTimersByTimeAsync(
        STOP_THREAD_FINALIZATION_REFETCH_DELAY_MS,
      );

      expect(countListInvalidations()).toBe(2);
      expect(queryKeys()).not.toContainEqual(["thread", null]);
    } finally {
      client.clear();
      vi.useRealTimers();
    }
  });

  test("scheduled refetch lets sidebar receive delayed backend title finalization", async () => {
    vi.useFakeTimers();

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    let finalized = false;
    let fetchCount = 0;
    /*
      观察的是**真实那个 key**（`["threads","searchInfinite", …]`）。
      原来这里挂的是 `["threads","search"]`——本仓没有任何查询拥有它，
      于是这条用例自己造了一个生产里不存在的拥有者，测的是一段到不了的代码。
    */
    const listKey = [...INFINITE_THREADS_QUERY_KEY_PREFIX, "all"] as const;
    const observer = new QueryObserver<AgentThread[]>(client, {
      queryKey: listKey,
      queryFn: async () => {
        fetchCount += 1;
        return [
          makeThread(
            "thread-1",
            finalized ? "Generated Title" : "New Conversation",
          ),
        ];
      },
    });
    const unsubscribe = observer.subscribe((result) => {
      void result.status;
    });

    try {
      await observer.refetch();
      expect(
        client.getQueryData<AgentThread[]>(listKey)?.[0]?.values?.title,
      ).toBe("New Conversation");

      await stopThreadAndInvalidateCaches(
        client,
        () => Promise.resolve(),
        "thread-1",
      );
      await Promise.resolve();

      expect(
        client.getQueryData<AgentThread[]>(listKey)?.[0]?.values?.title,
      ).toBe("New Conversation");

      finalized = true;
      await vi.advanceTimersByTimeAsync(
        STOP_THREAD_FINALIZATION_REFETCH_DELAY_MS,
      );

      expect(
        client.getQueryData<AgentThread[]>(listKey)?.[0]?.values?.title,
      ).toBe("Generated Title");
      expect(fetchCount).toBeGreaterThanOrEqual(3);
    } finally {
      unsubscribe();
      client.clear();
      vi.useRealTimers();
    }
  });
});

describe("removeDeletedThreadCaches", () => {
  test("removes only deleted main/sidecar ids from the infinite and scoped caches", () => {
    const client = new QueryClient();
    client.setQueryData([...INFINITE_THREADS_QUERY_KEY_PREFIX, "all"], {
      pages: [[makeThread("main"), makeThread("side"), makeThread("keep")]],
      pageParams: [0],
    });
    client.setQueryData(["thread", "main"], { status: "idle" });
    client.setQueryData(["thread", "keep"], { status: "idle" });

    removeDeletedThreadCaches(client, ["main", "side"]);

    expect(
      client
        .getQueryData<InfiniteData<AgentThread[]>>([
          ...INFINITE_THREADS_QUERY_KEY_PREFIX,
          "all",
        ])
        ?.pages.flat()
        .map((thread) => thread.thread_id),
    ).toEqual(["keep"]);
    expect(client.getQueryData(["thread", "main"])).toBeUndefined();
    expect(client.getQueryData(["thread", "keep"])).toEqual({
      status: "idle",
    });
  });
});
