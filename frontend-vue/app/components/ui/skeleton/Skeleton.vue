<!--
  【文件职责】     内容到达前占位的灰块。
  【架构位置】     L2 primitive
  【主要导出】     默认 Skeleton 组件
  【依赖关系】     @/lib/utils
  【边界与注意】   类名与 `data-slot` 逐字照抄上游 `frontend/src/components/ui/skeleton.tsx`
                   （`bg-accent animate-pulse rounded-md`）。`animate-pulse` 是 Tailwind
                   自带的无限动画，已在 baseline/looping-animations.json 里声明为
                   `always`——脉动本身就是「内容还没到」的表达，冻住它会让界面撒谎。
-->
<script setup lang="ts">
import { cn } from "@/lib/utils";

const props = defineProps<{ class?: string }>();
</script>

<template>
  <div
    data-slot="skeleton"
    :class="cn('bg-accent animate-pulse rounded-md', props.class)"
  />
</template>
