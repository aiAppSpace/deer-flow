/*
  【文件职责】     持有当前公开 Showcase 的完整只读快照。
  【架构位置】     L3 Vue 生命周期适配
  【主要导出】     useShowcaseThreadState
  【边界与注意】   路由切换同步退役、取消请求；公开读取失败不得回退工作区数据。
*/
import { computed, onMounted, shallowRef, watch, type Ref } from "vue";
import type { AgentThreadState } from "@/core/threads/types";

export function useShowcaseThreadState(
  enabled: Readonly<Ref<boolean>>,
  threadId: Readonly<Ref<string | null>>,
) {
  const snapshot = shallowRef<Partial<AgentThreadState>>({});
  // Public fixtures are browser-owned; keep SSR empty and create the watcher
  // synchronously in the mounted scope so unmount retires its request too.
  onMounted(() => {
    watch(
      [enabled, threadId],
      async ([active, id], _previous, onCleanup) => {
        snapshot.value = {};
        if (!active || !id) return;
        const controller = new AbortController();
        onCleanup(() => controller.abort());
        try {
          const response = await globalThis.fetch(
            `/demo/threads/${encodeURIComponent(id)}/thread.json`,
            { signal: controller.signal },
          );
          if (!response.ok) return;
          const fixture = (await response.json()) as {
            values?: Partial<AgentThreadState>;
          } | null;
          if (controller.signal.aborted) return;
          const values = fixture?.values;
          if (values && typeof values === "object" && !Array.isArray(values)) {
            snapshot.value = values;
          }
        } catch {
          // Keep the new public owner empty. Abort-ignoring transports cannot
          // publish an earlier snapshot or expose the private workspace owner.
        }
      },
      { immediate: true, flush: "sync" },
    );
  });
  return computed(() => snapshot.value);
}
