<!--
  【文件职责】     分组标题。
  【架构位置】     L2 primitive
  【主要导出】     SidebarGroupLabel
  【依赖关系】     lib/utils(cn)
  【边界与注意】   **侧栏收成图标条时靠 `group-data-[collapsible=icon]` 把自己收起来**
                   （`-mt-8` + `opacity-0`），所以它必须在带 `data-collapsible` 的祖先里，
                   否则收起状态下标题会突兀地留在图标条上。
-->
<script setup lang="ts">
import { cn } from "@/lib/utils";

const props = defineProps<{ class?: string }>();
</script>

<template>
  <div
    data-slot="sidebar-group-label"
    data-sidebar="group-label"
    :class="
      cn(
        'text-sidebar-foreground/70 ring-sidebar-ring flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium outline-hidden transition-[margin,opacity] duration-200 ease-linear focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0',
        'group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0',
        props.class,
      )
    "
  >
    <slot />
  </div>
</template>
