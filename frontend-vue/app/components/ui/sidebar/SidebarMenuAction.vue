<!--
  【文件职责】     菜单项右侧那颗绝对定位的动作键。
  【架构位置】     L2 primitive
  【主要导出】     SidebarMenuAction
  【依赖关系】     reka-ui(Primitive) · lib/utils(cn)
  【边界与注意】   靠三样东西定位与显隐，缺一不可：
                   父级 `SidebarMenuItem` 的 `relative` + `group/menu-item`、
                   同级 `SidebarMenuButton` 的 `peer/menu-button` 与 `data-size`、
                   自身的 `data-sidebar="menu-action"`（菜单键用它 `pr-8` 让位）。
                   `after:-inset-2` 是**移动端的点击热区**，不是装饰，别删。
-->
<script setup lang="ts">
import { Primitive } from "reka-ui";

import { cn } from "@/lib/utils";

const props = withDefaults(
  defineProps<{ asChild?: boolean; showOnHover?: boolean; class?: string }>(),
  { asChild: false, showOnHover: false },
);
</script>

<template>
  <Primitive
    :as="props.asChild ? undefined : 'button'"
    :as-child="props.asChild"
    data-slot="sidebar-menu-action"
    data-sidebar="menu-action"
    :class="
      cn(
        'text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground peer-hover/menu-button:text-sidebar-accent-foreground absolute top-1.5 right-1 flex aspect-square w-5 items-center justify-center rounded-md p-0 outline-hidden transition-transform focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0',
        'after:absolute after:-inset-2 md:after:hidden',
        'peer-data-[size=sm]/menu-button:top-1',
        'peer-data-[size=default]/menu-button:top-1.5',
        'peer-data-[size=lg]/menu-button:top-2.5',
        'group-data-[collapsible=icon]:hidden',
        props.showOnHover &&
          'peer-data-[active=true]/menu-button:text-sidebar-accent-foreground group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 data-[state=open]:opacity-100 md:opacity-0',
        props.class,
      )
    "
  >
    <slot />
  </Primitive>
</template>
