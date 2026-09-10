<!--
  【文件职责】     侧栏菜单列表。
  【架构位置】     L2 primitive
  【主要导出】     SidebarMenu
  【依赖关系】     lib/utils(cn)
  【边界与注意】   是 `<ul>`，子项必须是 `SidebarMenuItem`（`<li>`）——中间夹别的元素
                   会让可访问性树里出现一个没有 listitem 的 list。
-->
<script setup lang="ts">
import { cn } from "@/lib/utils";

const props = defineProps<{ class?: string }>();
</script>

<template>
  <ul
    data-slot="sidebar-menu"
    data-sidebar="menu"
    :class="cn('flex w-full min-w-0 flex-col gap-1', props.class)"
  >
    <slot />
  </ul>
</template>
