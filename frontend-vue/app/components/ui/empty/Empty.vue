<!--
  【文件职责】     空状态容器。
  【架构位置】     L2 primitive
  【主要导出】     Empty
  【依赖关系】     lib/utils(cn)
  【边界与注意】   基类照抄上游 `ui/empty.tsx`；`data-slot` 是契约的一部分。
-->
<script setup lang="ts">
import { cn } from "@/lib/utils";
const props = defineProps<{ class?: string }>();
</script>
<template>
  <div
    data-slot="empty"
    :class="
      cn(
        'flex min-w-0 flex-1 flex-col items-center justify-center gap-6 rounded-lg border-dashed p-6 text-center text-balance md:p-12',
        props.class,
      )
    "
  >
    <slot />
  </div>
</template>
