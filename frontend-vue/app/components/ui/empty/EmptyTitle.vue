<!--
  【文件职责】     空状态标题。
  【架构位置】     L2 primitive
  【主要导出】     EmptyTitle
  【依赖关系】     lib/utils(cn)
  【边界与注意】   上游用的是 `<div>` 不是标题元素——空状态标题不进文档大纲是有意的。
-->
<script setup lang="ts">
import { cn } from "@/lib/utils";
const props = defineProps<{ class?: string }>();
</script>
<template>
  <div
    data-slot="empty-title"
    :class="cn('text-lg font-medium tracking-tight', props.class)"
  >
    <slot />
  </div>
</template>
