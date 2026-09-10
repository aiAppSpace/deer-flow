<!--
  【文件职责】     列表项右侧的操作区。
  【架构位置】     L2
  【主要导出】     ItemActions 组件
  【依赖关系】     lib/utils(cn)
  【边界与注意】   只负责横排与间距；不 shrink-0——上游没有，加了会在窄屏挤走正文。
-->

<script setup lang="ts">
import { computed } from "vue";

import { cn } from "@/lib/utils";

const props = withDefaults(defineProps<{ class?: string }>(), { class: "" });
const classes = computed(() => cn("flex items-center gap-2", props.class));
</script>

<template>
  <div data-slot="item-actions" :class="classes"><slot /></div>
</template>
