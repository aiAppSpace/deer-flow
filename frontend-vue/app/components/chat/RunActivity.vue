<script setup lang="ts">
/*
  【文件职责】     在 run 尚无终态 assistant 气泡时显示实时工作状态与墙钟时长。
  【架构位置】     L3 chat UI adapter
  【主要导出】     默认 RunActivity 组件
  【依赖关系】     core/messages/run-duration · ui/effects/Shimmer
  【边界与注意】   后端没有 live start timestamp；中途挂载从当前前端观察时刻计时。

                   「Working」那一段走 Shimmer primitive，不是 `animate-pulse`。
                   上游 `messages/run-duration.tsx:36` 写的是
                   `<Shimmer duration={1}>{t.runDuration.working}</Shimmer>`，
                   本仓此前是一个 `<span class="animate-pulse">`——与 wave 13 的
                   SidebarTrigger、本轮的 ReasoningDisclosure 同一个模式：上游是
                   primitive，本仓抄成了手写代码。差的不只是动画（整块闪烁 vs
                   高光横扫）：Shimmer 渲染的是 `<p>`，可访问性树上多一行
                   `- paragraph:`，而 span 不会。
*/
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { Clock3 } from "lucide-vue-next";

import Shimmer from "@/components/ui/effects/Shimmer.vue";
import { formatRunDuration } from "@/core/messages/run-duration";

const props = defineProps<{ startTime: number | null }>();
const { $i18n } = useNuxtApp();
const elapsed = ref(0);
let timer: ReturnType<typeof setInterval> | undefined;

function updateElapsed() {
  elapsed.value = props.startTime
    ? Math.max(0, Math.floor((Date.now() - props.startTime) / 1_000))
    : 0;
}
function restartTimer() {
  if (timer) clearInterval(timer);
  timer = undefined;
  updateElapsed();
  if (props.startTime !== null) timer = setInterval(updateElapsed, 1_000);
}
const formatted = computed(() =>
  formatRunDuration(elapsed.value, {
    lessThanSecond: $i18n.t.value.runDuration.lessThanSecond,
    hours: $i18n.t.value.runDuration.hours,
    minutes: $i18n.t.value.runDuration.minutes,
    seconds: $i18n.t.value.runDuration.seconds,
    separator: $i18n.t.value.runDuration.separator,
  }),
);

watch(() => props.startTime, restartTimer);
onMounted(restartTimer);
onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
});
</script>

<template>
  <div
    data-testid="run-activity"
    class="text-muted-foreground flex items-center gap-2 text-sm"
  >
    <Clock3 class="size-4" />
    <Shimmer :text="$i18n.t.value.runDuration.working" :duration="1" />
    <span v-if="formatted" aria-hidden="true">({{ formatted }})</span>
  </div>
</template>
