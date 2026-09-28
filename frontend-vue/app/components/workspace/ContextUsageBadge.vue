<script setup lang="ts">
/*
  【文件职责】     展示当前 thread 的上下文窗口占用与常驻占位。
  【架构位置】     L3
  【主要导出】     默认 ContextUsageBadge 组件
  【依赖关系】     thread token usage 派生值 · AgentChat
  【边界与注意】   保留 H7/H8；绑定 DeerFlow token usage 响应。
                   占位态与读数态**都**是 role="status"：React 的占位分支同样带
                   role="status"（frontend/src/components/workspace/context-usage-badge.tsx），
                   少了它，读屏器在「还没有用量数据」这一段时间里根本听不到这个控件存在。
*/
import { computed } from "vue";
import { Gauge } from "lucide-vue-next";

import type { ContextUsage } from "@/core/threads/token-usage";

const props = defineProps<{
  contextUsage: ContextUsage | null;
}>();
const { $i18n } = useNuxtApp();

const formatted = computed(() => {
  const percentage = props.contextUsage?.percentage;
  if (typeof percentage !== "number" || !Number.isFinite(percentage)) {
    return null;
  }
  const clamped = Math.max(0, percentage);
  return Number.isInteger(clamped) ? `${clamped}` : clamped.toFixed(1);
});
</script>

<template>
  <div
    v-if="formatted === null"
    role="status"
    data-context-usage-placeholder="true"
    :aria-label="$i18n.t.value.contextUsage.title"
    :title="$i18n.t.value.contextUsage.title"
    class="text-muted-foreground bg-background/70 flex size-7 shrink-0 items-center justify-center rounded-full border max-[361px]:size-[36px] max-[361px]:[&_svg]:size-[16px]"
  >
    <Gauge :size="14" />
  </div>
  <div
    v-else
    role="status"
    :aria-label="$i18n.t.value.contextUsage.badgeAriaLabel(formatted)"
    class="text-muted-foreground bg-background/70 flex h-auto shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-normal max-[361px]:size-[36px] max-[361px]:justify-center max-[361px]:gap-0 max-[361px]:p-0 max-[361px]:[&_svg]:size-[16px] max-[361px]:[&>span]:hidden"
  >
    <Gauge :size="14" />
    <span>{{ $i18n.t.value.contextUsage.label }}</span>
    <span class="font-mono">{{ formatted }}%</span>
  </div>
</template>
