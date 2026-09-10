<!--
  【文件职责】     菜单项容器。
  【架构位置】     L2 primitive
  【主要导出】     SidebarMenuItem
  【依赖关系】     lib/utils(cn)
  【边界与注意】   `group/menu-item` 与 `relative` 都承重：前者让 `SidebarMenuAction`
                   的 hover 显隐生效，后者是那颗绝对定位动作键的定位上下文。
-->
<script setup lang="ts">
import { cn } from "@/lib/utils";

const props = defineProps<{ class?: string }>();
</script>

<template>
  <li
    data-slot="sidebar-menu-item"
    data-sidebar="menu-item"
    :class="cn('group/menu-item relative', props.class)"
  >
    <slot />
  </li>
</template>
