<!--
  【文件职责】     列表项左侧的图标/图片位。
  【架构位置】     L2
  【主要导出】     ItemMedia 组件
  【依赖关系】     ./variants · lib/utils(cn)
  【边界与注意】   有描述时它靠 `group-has-[[data-slot=item-description]]/item:self-start`
                   顶到上边——这条依赖 Item 上的 `group/item`，两处是一对。
-->

<script setup lang="ts">
import { computed } from "vue";

import { cn } from "@/lib/utils";

import { itemMediaVariants, type ItemMediaVariants } from "./variants";

const props = withDefaults(
  defineProps<{ variant?: ItemMediaVariants["variant"]; class?: string }>(),
  { variant: "default", class: "" },
);

const classes = computed(() =>
  cn(itemMediaVariants({ variant: props.variant }), props.class),
);
</script>

<template>
  <div data-slot="item-media" :data-variant="variant" :class="classes">
    <slot />
  </div>
</template>
