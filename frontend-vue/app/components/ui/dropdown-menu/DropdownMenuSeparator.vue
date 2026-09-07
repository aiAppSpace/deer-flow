<!--
  【文件职责】     DropdownMenu 分隔线。
  【架构位置】     L2
  【主要导出】     DropdownMenuSeparator 组件
  【依赖关系】     Reka DropdownMenuSeparator · cn
  【边界与注意】   语义 separator，不可聚焦。
-->

<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import {
  DropdownMenuSeparator,
  type DropdownMenuSeparatorProps,
  useForwardProps,
} from "reka-ui";

import { cn } from "@/lib/utils";

const props = defineProps<
  DropdownMenuSeparatorProps & { class?: HTMLAttributes["class"] }
>();
const forwarded = useForwardProps(props);
const delegated = computed(() => {
  const { class: _class, ...rest } = forwarded.value;
  void _class;
  return rest;
});
</script>

<template>
  <DropdownMenuSeparator
    data-slot="dropdown-menu-separator"
    v-bind="delegated"
    :class="cn('bg-border -mx-1 my-1 h-px', props.class)"
  />
</template>
