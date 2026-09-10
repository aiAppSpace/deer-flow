<!--
  【文件职责】     空状态的操作区。
  【架构位置】     L2 primitive
  【主要导出】     EmptyContent
  【依赖关系】     lib/utils(cn)
  【边界与注意】   基类照抄上游。
-->
<script setup lang="ts">
import { cn } from "@/lib/utils";
const props = defineProps<{ class?: string }>();
</script>
<template>
  <div
    data-slot="empty-content"
    :class="
      cn(
        'flex w-full max-w-sm min-w-0 flex-col items-center gap-4 text-sm text-balance',
        props.class,
      )
    "
  >
    <slot />
  </div>
</template>
