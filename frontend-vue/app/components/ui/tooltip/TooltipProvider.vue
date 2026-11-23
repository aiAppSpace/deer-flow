<!--
  【文件职责】     Tooltip 的延迟与分组上下文。
  【架构位置】     L2
  【主要导出】     TooltipProvider 组件
  【依赖关系】     Reka TooltipProvider
  【边界与注意】   与 React 一样，每个 Tooltip.vue 自带独立 provider，默认延迟为 0；
                   显式 hover 延迟由 TooltipRoot 的 delayDuration 提供。
-->

<script setup lang="ts">
import {
  TooltipProvider,
  type TooltipProviderProps,
  useForwardProps,
} from "reka-ui";

const props = withDefaults(defineProps<TooltipProviderProps>(), {
  delayDuration: 0,
});
const forwarded = useForwardProps(props);
</script>

<template>
  <TooltipProvider v-bind="forwarded">
    <slot />
  </TooltipProvider>
</template>
