/*
  【文件职责】     05 A7 / A8：停止与 gap 之后的缓存失效与延迟补刀。
  【架构位置】     L3
  【主要导出】     THREAD_CACHE_KEYS · invalidateStoppedThreadCaches
                   STOP_THREAD_FINALIZATION_REFETCH_DELAY_MS
                   stopThreadAndInvalidateCaches · createGapRecoveryReset
  【依赖关系】     @tanstack/vue-query（QueryClient）· ./history · ./token-usage · ./infinite
  【边界与注意】   **A8 的「4 类缓存」不是 4 次调用。** 05 A8 数的是语义类别
                   （当前 thread、thread history、token usage、侧栏/搜索），
                   落到 key 上是 6 个：侧栏那一类拆成 `threads/search` 与
                   `threads/searchInfinite` 两份缓存，「当前 thread」拆成
                   `thread/{id}`（run 列表）与 `thread/metadata/{id}`。
                   把它写成 `THREAD_CACHE_KEYS` 一张表，是为了让「有没有漏一类」
                   变成可断言的事实而不是要人去数 `invalidateQueries` 调用。

                   **延迟补刀那一次不能省**（A8 后半句）：stop 是 abort 加
                   fire-and-forget cancel，后端很可能在这之后才把标题定稿。
                   只失效一次的表现是「停止后标题停在 New chat，刷新才变」——
                   一个不会有人报的 bug。

                   `createGapRecoveryReset` 是 A7 的**清空**那一半。它不直接改
                   任何状态，只返回一份「该清哪些」的描述，由
                   `useThreadStream` 执行——A7 要清的乐观 / 瞬态 / subtask 状态
                   分属三个不同的宿主（本地 ref、瞬态桥、tasks context），
                   写成一个函数去 mutate 它们等于把三处生命周期焊死在 core 里。
                   本地化警告文案同理走 `notify` 端口，不在 core 里选 toast 实现。
*/

import type { InfiniteData, QueryClient } from "@tanstack/vue-query";

import { threadHistoryQueryKey } from "./history";
import {
  filterInfiniteThreadsCache,
  INFINITE_THREADS_QUERY_KEY_PREFIX,
} from "./infinite";
import type { AgentThread } from "./types";
import { threadTokenUsageQueryKey } from "./token-usage";

/**
 * 05 A8 点名的全部缓存类别。`threadScoped` 的那几个需要 threadId，
 * `global` 的两个在没有 threadId 时也要失效（新建 thread 的第一次停止）。
 */
export const THREAD_CACHE_KEYS = {
  global: (): readonly (readonly unknown[])[] => [
    ["threads", "search"],
    [...INFINITE_THREADS_QUERY_KEY_PREFIX],
  ],
  threadScoped: (threadId: string): readonly (readonly unknown[])[] => [
    ["thread", threadId],
    [...threadHistoryQueryKey(threadId)],
    ["thread", "metadata", threadId],
    [...threadTokenUsageQueryKey(threadId)],
  ],
} as const;

export function invalidateStoppedThreadCaches(
  queryClient: QueryClient,
  threadId: string | null | undefined,
) {
  invalidateThreadCaches(queryClient, threadId);
}

/** Invalidate every cache that can retain thread-derived server state. */
export function invalidateThreadCaches(
  queryClient: QueryClient,
  threadId: string | null | undefined,
) {
  for (const queryKey of THREAD_CACHE_KEYS.global()) {
    void queryClient.invalidateQueries({ queryKey });
  }
  if (!threadId) {
    return;
  }
  restartThreadScopedQueries(
    queryClient,
    THREAD_CACHE_KEYS.threadScoped(threadId),
  );
}

/**
 * thread 级缓存的失效**必须先取消在飞的那一次**，否则会被它整个吞掉。
 *
 * TanStack Query 里 `invalidateQueries` 默认带 `cancelRefetch: true`，但那个开关
 * 在 `query.fetch` 里有一处**只对已经有数据的查询生效**的前提：
 *
 *     if (fetchStatus !== "idle" && retryer.status() !== "rejected") {
 *       if (state.data !== undefined && fetchOptions?.cancelRefetch) {
 *         this.cancel({ silent: true });   // 取消在飞的那次，重新取
 *       } else if (this.#retryer) {
 *         return this.#retryer.promise;    // ← 复用在飞的那次
 *       }
 *     }
 *
 * 一条**新建的 thread**，它的每一个 thread 级查询都还是第一次取数，`state.data`
 * 是 `undefined`——于是走下面那条，失效被在飞的取数吃掉，**不产生重取**。而那次
 * 取数是在 run 开始之前发出的，它带回来的是 run 之前的世界：历史是空的、标题还是
 * New chat、run 列表里什么都没有。之后没有任何机制会补上这一次（查询的宿主一直
 * 挂着不会重新 mount，`staleTime` 只影响下一次取数的时机）。
 *
 * 最短的一条路径是侧边会话：`POST /threads` 建线程 → threadId 就位 → thread 级
 * 查询立刻发出 → 紧接着 run 开跑 → run 结束时它们还在飞。实测
 * `sidecar-chat.spec.ts` 的「creates a hidden sidecar thread」约 1/40 复现，
 * 症状是侧边会话关掉再打开后消息列表整个是空的。
 *
 * **取消是异步的，所以失效也变成异步的**：`Query.cancel` 要等在飞的那次真正
 * settle、`fetchStatus` 回到 `idle`，紧跟着同步调 `invalidateQueries` 仍然会撞上
 * 上面那个分支。取消全部排在一起等一次，是为了让失效顺序仍然等于
 * `THREAD_CACHE_KEYS.threadScoped` 的顺序——那张表本身是被断言的。
 *
 * `cancelQueries` 对 idle 的查询是空操作，所以正常情况下这里不多花任何代价——
 * 只有「失效发生时确实还有一次取数在飞」这一种情况才会真的取消并重取，
 * 而那正是唯一会出问题的情况。`revert: true`（默认）保证取消不会丢掉已加载的页。
 */
function restartThreadScopedQueries(
  queryClient: QueryClient,
  queryKeys: readonly (readonly unknown[])[],
) {
  void Promise.all(
    queryKeys.map((queryKey) => queryClient.cancelQueries({ queryKey })),
  ).then(() => {
    for (const queryKey of queryKeys) {
      void queryClient.invalidateQueries({ queryKey });
    }
  });
}

/** Remove deleted rows and every thread-scoped cache without dropping siblings. */
export function removeDeletedThreadCaches(
  queryClient: QueryClient,
  threadIds: readonly string[],
) {
  const deleted = new Set(threadIds);
  if (deleted.size === 0) return;
  queryClient.setQueriesData(
    { queryKey: ["threads", "search"], exact: false },
    (oldData: AgentThread[] | undefined) =>
      oldData?.filter((thread) => !deleted.has(thread.thread_id)),
  );
  queryClient.setQueriesData(
    { queryKey: [...INFINITE_THREADS_QUERY_KEY_PREFIX], exact: false },
    (oldData: InfiniteData<AgentThread[]> | undefined) =>
      filterInfiniteThreadsCache(
        oldData,
        (thread) => !deleted.has(thread.thread_id),
      ),
  );
  for (const threadId of deleted) {
    for (const queryKey of THREAD_CACHE_KEYS.threadScoped(threadId)) {
      queryClient.removeQueries({ queryKey, exact: true });
    }
  }
}

export const STOP_THREAD_FINALIZATION_REFETCH_DELAY_MS = 1500;

/**
 * stop 之后再安排一次失效（05 A8 后半句）。
 *
 * 返回 timer handle 而不是吞掉它：组件卸载时要能取消，否则一个已经离开的
 * thread 会在 1.5 秒后把当前 thread 的缓存也顺手失效一遍。
 */
export function scheduleStoppedThreadFinalizationRefetch(
  queryClient: QueryClient,
  threadId: string | null | undefined,
): ReturnType<typeof setTimeout> {
  return globalThis.setTimeout(() => {
    invalidateStoppedThreadCaches(queryClient, threadId);
  }, STOP_THREAD_FINALIZATION_REFETCH_DELAY_MS);
}

export async function stopThreadAndInvalidateCaches(
  queryClient: QueryClient,
  stop: () => Promise<void> | void,
  threadId: string | null | undefined,
): Promise<ReturnType<typeof setTimeout>> {
  try {
    await stop();
  } finally {
    invalidateStoppedThreadCaches(queryClient, threadId);
  }
  return scheduleStoppedThreadFinalizationRefetch(queryClient, threadId);
}

/** 05 A7 要清空的三类状态，写成一份描述而不是一串副作用。 */
export interface GapRecoveryReset {
  clearOptimistic: true;
  clearTransientBridge: true;
  clearSubtasks: true;
  /** 本地化恢复警告的字典 key。文案由调用方从 i18n 取，core 不认识语言。 */
  warningKey: "conversation.streamReplayGap";
}

export function createGapRecoveryReset(): GapRecoveryReset {
  return {
    clearOptimistic: true,
    clearTransientBridge: true,
    clearSubtasks: true,
    warningKey: "conversation.streamReplayGap",
  };
}
