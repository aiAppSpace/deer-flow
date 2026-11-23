<!--
  【文件职责】     侧栏菜单键：普通按钮，或用 `asChild` 把样式套到链接上；
  【架构位置】     L2 primitive
  【主要导出】     SidebarMenuButton
  【依赖关系】     ./menu-button-variants · ../tooltip · reka-ui(Primitive) · lib/utils(cn)
  【边界与注意】   asChild 合并属性到唯一子元素；data-size/data-active 保留 primitive 状态。
                   tooltipHidden 由调用方提供，L2 不读取工作区状态；侧栏 tooltip 延迟显式设为 0。
                   两个渲染分支共享 buttonProps，身份标记在模板中声明。
-->
<script setup lang="ts">
import { computed } from "vue";
import { Primitive } from "reka-ui";

import { cn } from "@/lib/utils";

import { Tooltip, TooltipContent, TooltipTrigger } from "../tooltip";
import {
  sidebarMenuButtonVariants,
  type SidebarMenuButtonVariants,
} from "./menu-button-variants";

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    asChild?: boolean;
    isActive?: boolean;
    variant?: SidebarMenuButtonVariants["variant"];
    size?: SidebarMenuButtonVariants["size"];
    /** 收起成图标条时显示的名字。不传就没有这层包装（同上游 `if (!tooltip) return button`）。 */
    tooltip?: string;
    /** 上游读 `state !== "collapsed" || isMobile`；见文件头，这里由调用方传。 */
    tooltipHidden?: boolean;
    class?: string;
  }>(),
  {
    asChild: false,
    isActive: false,
    variant: "default",
    size: "default",
    tooltip: undefined,
    tooltipHidden: false,
    class: undefined,
  },
);

const buttonProps = computed(() => ({
  as: props.asChild ? undefined : "button",
  asChild: props.asChild,
  "data-size": props.size,
  "data-active": props.isActive,
  class: cn(
    sidebarMenuButtonVariants({ variant: props.variant, size: props.size }),
    props.class,
  ),
}));
</script>

<template>
  <Tooltip v-if="props.tooltip" :delay-duration="0">
    <TooltipTrigger as-child>
      <Primitive
        data-slot="sidebar-menu-button"
        data-sidebar="menu-button"
        v-bind="{ ...buttonProps, ...$attrs }"
        ><slot
      /></Primitive>
    </TooltipTrigger>
    <TooltipContent side="right" align="center" :hidden="props.tooltipHidden">{{
      props.tooltip
    }}</TooltipContent>
  </Tooltip>
  <Primitive
    v-else
    data-slot="sidebar-menu-button"
    data-sidebar="menu-button"
    v-bind="{ ...buttonProps, ...$attrs }"
    ><slot
  /></Primitive>
</template>
