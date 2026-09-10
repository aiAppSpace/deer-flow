<!--
  【文件职责】     侧栏菜单键：普通按钮，或用 `asChild` 把样式套到链接上。
  【架构位置】     L2 primitive
  【主要导出】     SidebarMenuButton
  【依赖关系】     ./menu-button-variants · reka-ui(Primitive) · lib/utils(cn)
  【边界与注意】   `asChild` 用 reka 的 `Primitive as-child` 实现——上游用的是 radix `Slot`，
                   两边都是「把属性与样式合并到唯一子元素上」，这是本仓移植 primitive 的既定做法。

                   `data-size` / `data-active` **必须原样输出**：动作键靠
                   `peer-data-[size=…]/menu-button` 定位，高亮靠 `data-[active=true]`，
                   只写 class 不写这两个属性会让它们同时失效。

                   **没有移植上游的 `tooltip` 参数**：上游在侧栏收成图标条时用它显示名字，
                   而本仓的侧栏外壳（ThreadSidebarShell）没有图标条形态，
                   传进来也没有触发条件。要加图标条时连这个参数一起补。
-->
<script setup lang="ts">
import { Primitive } from "reka-ui";

import { cn } from "@/lib/utils";

import {
  sidebarMenuButtonVariants,
  type SidebarMenuButtonVariants,
} from "./menu-button-variants";

const props = withDefaults(
  defineProps<{
    asChild?: boolean;
    isActive?: boolean;
    variant?: SidebarMenuButtonVariants["variant"];
    size?: SidebarMenuButtonVariants["size"];
    class?: string;
  }>(),
  { asChild: false, isActive: false, variant: "default", size: "default" },
);
</script>

<template>
  <Primitive
    :as="props.asChild ? undefined : 'button'"
    :as-child="props.asChild"
    data-slot="sidebar-menu-button"
    data-sidebar="menu-button"
    :data-size="props.size"
    :data-active="props.isActive"
    :class="
      cn(
        sidebarMenuButtonVariants({
          variant: props.variant,
          size: props.size,
        }),
        props.class,
      )
    "
  >
    <slot />
  </Primitive>
</template>
