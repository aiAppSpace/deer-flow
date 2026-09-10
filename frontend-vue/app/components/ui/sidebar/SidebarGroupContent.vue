<!--
  【文件职责】     分组内容区。
  【架构位置】     L2 primitive
  【主要导出】     SidebarGroupContent
  【依赖关系】     lib/utils(cn)
  【边界与注意】   只负责宽度与字号；收起态的处理留给调用方（不同分组的取舍不同）。
-->
<script setup lang="ts">
import { cn } from "@/lib/utils";

const props = defineProps<{ class?: string }>();
</script>

<template>
  <div
    data-slot="sidebar-group-content"
    data-sidebar="group-content"
    :class="cn('w-full text-sm', props.class)"
  >
    <slot />
  </div>
</template>
