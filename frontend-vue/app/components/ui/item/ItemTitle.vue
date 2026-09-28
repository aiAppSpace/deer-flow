<!--
  【文件职责】     列表项标题。
  【架构位置】     L2
  【主要导出】     ItemTitle 组件
  【依赖关系】     lib/utils(cn)
  【边界与注意】   `w-fit`：标题只占自己那么宽，右边留给同一行的徽标。
-->

<script setup lang="ts">
import { computed } from "vue";

import { cn } from "@/lib/utils";

const props = withDefaults(defineProps<{ class?: string }>(), { class: "" });
const classes = computed(() =>
  cn(
    "flex w-fit max-w-full min-w-0 items-center gap-2 text-sm leading-snug font-medium max-[361px]:w-full max-[361px]:flex-wrap wrap-anywhere",
    props.class,
  ),
);
</script>

<template>
  <div data-slot="item-title" :class="classes"><slot /></div>
</template>
