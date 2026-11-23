<!--
  【文件职责】     DropdownMenu 分组标题。
  【架构位置】     L2
  【主要导出】     DropdownMenuLabel 组件
  【依赖关系】     Reka DropdownMenuLabel · cn
  【边界与注意】   inset 由 shadcn 层提供，只在启用时输出 data-inset。
                   按属性存在匹配的选择器不能接收 data-inset="false"。
-->

<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import {
  DropdownMenuLabel,
  type DropdownMenuLabelProps,
  useForwardProps,
} from "reka-ui";

import { cn } from "@/lib/utils";

const props = defineProps<
  DropdownMenuLabelProps & { class?: HTMLAttributes["class"]; inset?: boolean }
>();
const forwarded = useForwardProps(props);
const delegated = computed(() => {
  const { class: _class, inset: _inset, ...rest } = forwarded.value;
  void _class;
  void _inset;
  return rest;
});
</script>

<template>
  <DropdownMenuLabel
    data-slot="dropdown-menu-label"
    :data-inset="props.inset || undefined"
    v-bind="delegated"
    :class="
      cn('px-2 py-1.5 text-sm font-medium data-[inset]:pl-8', props.class)
    "
  >
    <slot />
  </DropdownMenuLabel>
</template>
