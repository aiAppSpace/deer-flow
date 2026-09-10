<!--
  【文件职责】     侧栏里的一个分组容器。
  【架构位置】     L2 primitive
  【主要导出】     SidebarGroup
  【依赖关系】     lib/utils(cn)
  【边界与注意】   `data-slot` / `data-sidebar` 两个属性是**契约的一部分**：
                   同目录其它 primitive 的选择器（如 menu-action 的 `peer-data-[size=…]`）
                   与上游样式表都按它们定位，不能只留 class。
-->
<script setup lang="ts">
import { cn } from "@/lib/utils";

const props = defineProps<{ class?: string }>();
</script>

<template>
  <div
    data-slot="sidebar-group"
    data-sidebar="group"
    :class="cn('relative flex w-full min-w-0 flex-col p-2', props.class)"
  >
    <slot />
  </div>
</template>
