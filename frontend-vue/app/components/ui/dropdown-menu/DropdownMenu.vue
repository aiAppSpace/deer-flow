<!--
  【文件职责】     DropdownMenu 根：菜单开合状态与触发器焦点归还。
  【架构位置】     L2
  【主要导出】     DropdownMenu 组件
  【依赖关系】     Reka DropdownMenuRoot
  【边界与注意】   菜单项是 menuitem，不是 button 列表：方向键在项之间移动。
                   Content 与 React Radix 一致消费 Tab；Escape、选择与外部交互
                   仍由原生菜单 owner 处理，非模态模式不改成焦点陷阱。
-->

<script setup lang="ts">
import {
  DropdownMenuRoot,
  useForwardPropsEmits,
  type DropdownMenuRootEmits,
  type DropdownMenuRootProps,
} from "reka-ui";

const props = defineProps<DropdownMenuRootProps>();
const emits = defineEmits<DropdownMenuRootEmits>();
const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <DropdownMenuRoot data-slot="dropdown-menu" v-bind="forwarded">
    <slot />
  </DropdownMenuRoot>
</template>
