<!--
  【文件职责】     列表项的正文列：标题 + 描述，撑满剩余宽度。
  【架构位置】     L2
  【主要导出】     ItemContent 组件
  【依赖关系】     lib/utils(cn)
  【边界与注意】   `flex-1` 是它与手写行最大的差别——描述因此铺满整行，
                   而不是缩到内容宽度。`[&+[data-slot=item-content]]:flex-none`
                   让第二列（如果有）不再抢空间。
-->

<script setup lang="ts">
import { computed } from "vue";

import { cn } from "@/lib/utils";

const props = withDefaults(defineProps<{ class?: string }>(), { class: "" });
const classes = computed(() =>
  cn(
    "flex flex-1 flex-col gap-1 [&+[data-slot=item-content]]:flex-none",
    props.class,
  ),
);
</script>

<template>
  <div data-slot="item-content" :class="classes"><slot /></div>
</template>
