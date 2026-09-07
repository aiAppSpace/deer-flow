<!--
  【文件职责】     单个 tab 面板。
  【架构位置】     L2
  【主要导出】     TabsContent 组件
  【依赖关系】     Reka TabsContent · cn
  【边界与注意】   面板由 aria-labelledby 指回触发器，不要另加 aria-label。
-->

<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { TabsContent, type TabsContentProps, useForwardProps } from "reka-ui";

import { cn } from "@/lib/utils";

const props = defineProps<
  TabsContentProps & { class?: HTMLAttributes["class"] }
>();
const forwarded = useForwardProps(props);
const delegated = computed(() => {
  const { class: _class, ...rest } = forwarded.value;
  void _class;
  return rest;
});
</script>

<template>
  <TabsContent
    data-slot="tabs-content"
    v-bind="delegated"
    :class="cn('flex-1 outline-none', props.class)"
  >
    <slot />
  </TabsContent>
</template>
