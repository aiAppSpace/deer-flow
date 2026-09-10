<!--
  【文件职责】     一条 0–100 的进度条。
  【架构位置】     L2 primitive
  【主要导出】     默认 Progress 组件
  【依赖关系】     Reka ProgressRoot/ProgressIndicator · @/lib/utils
  【边界与注意】   类名与 `data-slot` 逐字照抄上游 `frontend/src/components/ui/progress.tsx`。

                   **走 Reka 的 ProgressRoot，不是两个 div。** 手搓那版拿不到
                   `role="progressbar"` 与 `aria-valuenow/valuemin/valuemax`——
                   读屏器听到的会是一个没有语义的方块，而这条进度条恰恰是
                   「这批任务跑到哪了」的唯一读数。

                   位移用 `translateX(-(100 - value)%)` 而不是改宽度：与上游同一
                   写法，动画走 transform 不触发布局重排。
-->
<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { ProgressIndicator, ProgressRoot } from "reka-ui";

import { cn } from "@/lib/utils";

const props = withDefaults(
  defineProps<{
    /** 0–100。`null` 表示进度未知（Reka 会据此标成 indeterminate）。 */
    modelValue?: number | null;
    class?: HTMLAttributes["class"];
  }>(),
  { modelValue: 0, class: undefined },
);

const offset = computed(() => 100 - (props.modelValue ?? 0));
</script>

<template>
  <ProgressRoot
    data-slot="progress"
    :model-value="modelValue"
    :class="
      cn(
        'bg-primary/20 relative h-2 w-full overflow-hidden rounded-full',
        props.class,
      )
    "
  >
    <ProgressIndicator
      data-slot="progress-indicator"
      class="bg-primary h-full w-full flex-1 transition-all"
      :style="{ transform: `translateX(-${offset}%)` }"
    />
  </ProgressRoot>
</template>
