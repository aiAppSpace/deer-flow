/*
  【文件职责】     以 Vue Query 持有线程最终 token usage snapshot。
  【架构位置】     L3 Vue Query adapter
  【主要导出】     useThreadTokenUsage
  【依赖关系】     core/threads/api · token-usage
  【边界与注意】   placeholder 只能留在同一 thread；跨路由不得闪回上一线程 usage。

                   **`queryFn` 自己挡空 threadId，不能只靠 `enabled`。**
                   `refetch()` 按 TanStack 的设计就是**绕过 `enabled`** 的强制取数，
                   而本仓 run 落定之后正有一处这样的调用（`AgentChat` 的
                   `refreshPostRun`）。原来这里写的是 `fetchThreadTokenUsage(threadId.value!)`
                   ——那个 `!` 等于在说「enabled 保证非空」，而这条保证对 `refetch()`
                   不成立：实测发出过 `GET /api/threads/null/token-usage`，
                   字面量 `null` 直接拼进了 URL（wave 216 对照尺子量到）。
*/

import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { useQuery } from "@tanstack/vue-query";

import { fetchThreadTokenUsage } from "@/core/threads/api";
import {
  retainThreadTokenUsagePlaceholder,
  threadTokenUsageQueryKey,
} from "@/core/threads/token-usage";

/** Vue Query owner for the persisted per-thread token usage snapshot. */
export function useThreadTokenUsage(
  threadIdInput: MaybeRefOrGetter<string | null | undefined>,
  options: { enabled?: MaybeRefOrGetter<boolean> } = {},
) {
  const threadId = computed(() => toValue(threadIdInput) ?? null);
  const query = useQuery({
    queryKey: computed(() => threadTokenUsageQueryKey(threadId.value)),
    queryFn: () => {
      const id = threadId.value;
      // 见文件头：refetch() 绕过 enabled，空 id 必须在这里挡住。
      if (!id) return null;
      return fetchThreadTokenUsage(id);
    },
    enabled: computed(
      () => Boolean(threadId.value) && toValue(options.enabled ?? true),
    ),
    placeholderData: (previous) =>
      retainThreadTokenUsagePlaceholder(previous, threadId.value),
  });

  return {
    ...query,
    // TanStack may retain the previous observer result for one render while a
    // reactive query key changes. Guard the consumer as well as placeholderData
    // so a late/malformed response can never display another thread's usage.
    usage: computed(
      () =>
        retainThreadTokenUsagePlaceholder(query.data.value, threadId.value) ??
        null,
    ),
  };
}
