<!--
  【文件职责】     空状态的头部（图标 + 标题 + 描述）。
  【架构位置】     L2 primitive
  【主要导出】     EmptyHeader
  【依赖关系】     lib/utils(cn)
  【边界与注意】   `max-w-sm` 承重：不限宽的话长标题会撑满整屏。
-->
<script setup lang="ts">
import { cn } from "@/lib/utils";
const props = defineProps<{ class?: string }>();
</script>
<template>
  <div
    data-slot="empty-header"
    :class="
      cn('flex max-w-sm flex-col items-center gap-2 text-center', props.class)
    "
  >
    <slot />
  </div>
</template>
