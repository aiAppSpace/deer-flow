<!--
  【文件职责】     Alert 的标题行。
  【架构位置】     L2
  【主要导出】     AlertTitle 组件
  【依赖关系】     cn
  【边界与注意】   固定落在第二列，第一列留给可选图标。
-->

<script setup lang="ts">
import type { HTMLAttributes } from "vue";

import { cn } from "@/lib/utils";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
</script>

<template>
  <div
    data-slot="alert-title"
    :class="
      cn(
        'col-start-2 line-clamp-1 min-h-4 min-w-0 font-medium tracking-tight',
        props.class,
      )
    "
  >
    <slot />
  </div>
</template>
