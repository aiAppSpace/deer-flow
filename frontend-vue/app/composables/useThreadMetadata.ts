/*
  【文件职责】     单条线程的元数据（`GET /threads/{id}`）查询，兼线程存在性探测。
  【架构位置】     L3 Vue adapter
  【主要导出】     useThreadMetadata
  【依赖关系】     core/api/api-client · core/threads/thread-presence · AgentChat
  【边界与注意】   ① **这一层此前是缺的，而好几处代码已经按它存在来写了。**
                   `core/threads/archive.ts`、`composables/useProjects.ts` 的移到项目、
                   `core/threads/cache-invalidation.ts` 三处都在
                   cancel / setQueriesData / invalidateQueries
                   `["thread","metadata",threadId]`——而**没有任何查询拥有这个 key**，
                   于是那三处**全是空操作**（wave 216 逐处核过）。
                   本仓原来是在 `AgentChat` 的 `onMounted` 里命令式打一次
                   `threads.get()`：取数是对的，但命令式的一次性请求
                   **没有 key、失效不到、也重取不了**。

                   对照台账 `thread-title-sync` 上那条
                   `requestsOnlyReact: GET /api/langgraph/threads/{id}` 就是这个缺口：
                   上游改名后失效 `useThreadMetadata` 因而重读那条线程，本仓无从重读。

                   ② **跟随当前路由线程，不是只探首次挂载那一条。**
                   原来那次探测用的是 `initialRouteThreadId`（setup 里取一次），
                   而 `AgentChat` 在切线程时**并不重建**（页面没有 `:key`）——
                   于是切到另一条线程之后 `threadPresence` 还停在上一条的判定上，
                   切到一条已被删除的线程不会被退回新会话。改成查询之后按 key 隔离，
                   这件事自然就对了。

                   ③ **403/404 归一成 `null`，其余错误照抛。**
                   判据在 `thread-presence.ts`：两者一视同仁是为了不泄漏
                   「这个 id 存在但不属于你」；而网络抖动 / 5xx **不算** missing，
                   否则一次瞬时 500 就把用户踢回新会话。于是这里
                   `data === null` 表示 missing、有值表示 present、`error` 表示 unknown。

                   ④ `retry: false` 与上游 `useThreadMetadata` 相同：这是一次存在性
                   探测，自动重试会把「确实没有」拖成好几秒的不确定态。
*/

import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { useQuery } from "@tanstack/vue-query";

import { getAPIClient } from "@/core/api/api-client";
import { threadMetadataQueryKey } from "@/core/threads/metadata";
import { isThreadMissingError } from "@/core/threads/thread-presence";
import type { AgentThread } from "@/core/threads/types";

export function useThreadMetadata(
  threadId: MaybeRefOrGetter<string | null>,
  options: { enabled?: MaybeRefOrGetter<boolean> } = {},
) {
  const apiClient = getAPIClient();
  const id = computed(() => toValue(threadId));

  return useQuery<AgentThread | null>({
    queryKey: computed(() => threadMetadataQueryKey(id.value)),
    queryFn: async () => {
      const value = id.value;
      if (!value) return null;
      try {
        return await apiClient.threads.get(value);
      } catch (error) {
        if (isThreadMissingError(error)) return null;
        throw error;
      }
    },
    enabled: computed(
      () => Boolean(id.value) && (toValue(options.enabled) ?? true),
    ),
    retry: false,
    refetchOnWindowFocus: false,
  });
}
