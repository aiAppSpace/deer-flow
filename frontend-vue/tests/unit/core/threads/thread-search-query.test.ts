/*
  会话列表结果的过滤规则。

  **这份文件原来测的是 `buildThreadsSearchQueryOptions`**——那个函数是
  `["threads", "search"]` 这个 key 的唯一生产者，而 `app/` 下零调用点
  （上游同名的 `useThreads` 同样零调用点），2026-09-11 连同 11 处空操作一起删了。
  它的三条用例里：

  - 「refetchInterval 让 IM 建的会话出现在侧栏」测的是一个**从来没有生效过**的
    选项（那个查询谁都没挂）。两个应用的会话列表**都不轮询**——这句产品性质
    此前只有这条用例在「保证」，而它保证的是一段死代码。删掉，不改写：
    要它成立得先真的加轮询，那是产品决定，不是这份文件的事。
  - 另外两条测的是 sidecar 会话进不进主列表，那条规则还活着
    （`filterThreadSearchResults`，被 `infinite.ts` 用着），照原样保留。
*/

import { expect, test } from "vitest";

import { filterThreadSearchResults } from "@/core/threads/thread-search-query";
import type { AgentThread } from "@/core/threads/types";

function makeThread(
  threadId: string,
  metadata: Record<string, unknown> = {},
): AgentThread {
  return {
    thread_id: threadId,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    metadata,
    status: "idle",
    values: { title: threadId, messages: [] },
  } as unknown as AgentThread;
}

test("默认把 sidecar 会话挡在主列表外", () => {
  expect(
    filterThreadSearchResults(
      [
        makeThread("primary-1"),
        makeThread("sidecar-1", { deerflow_sidecar: true }),
        makeThread("primary-2"),
      ],
      {},
    ),
  ).toEqual([makeThread("primary-1"), makeThread("primary-2")]);
});

test("显式按 sidecar 元数据查时不再过滤（找父会话那条路径）", () => {
  const sidecar = makeThread("sidecar-1", {
    deerflow_sidecar: true,
    parent_thread_id: "parent-1",
  });

  expect(
    filterThreadSearchResults([sidecar], {
      metadata: { deerflow_sidecar: true, parent_thread_id: "parent-1" },
    }),
  ).toEqual([sidecar]);
});
