<!--
  【文件职责】     DropdownMenu 子菜单内容层。
  【架构位置】     L2
  【主要导出】     DropdownMenuSubContent 组件
  【依赖关系】     Reka DropdownMenuSubContent · cn
  【边界与注意】   子菜单保留在父菜单子树中，不额外 portal，以保持触发器与内容的阅读顺序。
                   宽度按视口限制，不能使用两种 primitive 计算不同的 popper available-width。
                   inheritAttrs:false 使调用方属性落到内容元素。
-->

<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import {
  DropdownMenuSubContent,
  useForwardProps,
  type DropdownMenuSubContentProps,
} from "reka-ui";

import { cn } from "@/lib/utils";
import { retainMenuTab } from "./use-menu-tab-stop";

defineOptions({ inheritAttrs: false });

const props = defineProps<
  DropdownMenuSubContentProps & { class?: HTMLAttributes["class"] }
>();

const forwarded = useForwardProps(props);
const delegated = computed(() => {
  const { class: _class, ...rest } = forwarded.value;
  void _class;
  return rest;
});
</script>

<template>
  <DropdownMenuSubContent
    data-slot="dropdown-menu-sub-content"
    v-bind="{ ...$attrs, ...delegated }"
    :class="
      cn(
        'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-80 max-w-[calc(100vw-1rem)] min-w-32 origin-(--reka-dropdown-menu-content-transform-origin) overflow-hidden rounded-md border p-1 shadow-lg',
        props.class,
      )
    "
    @keydown="retainMenuTab"
  >
    <slot />
  </DropdownMenuSubContent>
</template>
