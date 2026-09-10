<!--
  【文件职责】     列表项描述。
  【架构位置】     L2
  【主要导出】     ItemDescription 组件
  【依赖关系】     lib/utils(cn)
  【边界与注意】   是 `<p>` 而不是 div，字号 `text-sm`——手写行常写成 `text-xs` 的 div，
                   对照台账上量到过 `fontSize React=14px Vue=12px`。
                   `line-clamp-2` 是默认值，调用点可以覆盖成别的行数。
-->

<script setup lang="ts">
import { computed } from "vue";

import { cn } from "@/lib/utils";

const props = withDefaults(defineProps<{ class?: string }>(), { class: "" });
const classes = computed(() =>
  cn(
    "text-muted-foreground line-clamp-2 text-sm leading-normal font-normal text-balance",
    "[&>a:hover]:text-primary [&>a]:underline [&>a]:underline-offset-4",
    props.class,
  ),
);
</script>

<template>
  <p data-slot="item-description" :class="classes"><slot /></p>
</template>
