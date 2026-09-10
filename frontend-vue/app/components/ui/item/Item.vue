<!--
  【文件职责】     一条列表项的外壳：边框/内距/间距，以及 `group/item` 这个分组锚。
  【架构位置】     L2
  【主要导出】     Item 组件
  【依赖关系】     ./variants · reka-ui(Primitive) · lib/utils(cn)
  【边界与注意】   `asChild` 用 reka 的 `Primitive as-child`，与 ui/button 同一套做法
                   （上游用 radix `Slot`）。

                   `data-variant` / `data-size` **必须原样输出**：`ItemMedia` 靠
                   `group-has-[[data-slot=item-description]]/item:` 找这一层的分组，
                   而调用点与样式表也按 data 属性选择。
-->

<script setup lang="ts">
import { computed } from "vue";
import { Primitive } from "reka-ui";

import { cn } from "@/lib/utils";

import { itemVariants, type ItemVariants } from "./variants";

const props = withDefaults(
  defineProps<{
    variant?: ItemVariants["variant"];
    size?: ItemVariants["size"];
    class?: string;
    asChild?: boolean;
  }>(),
  { variant: "default", size: "default", class: "", asChild: false },
);

const classes = computed(() =>
  cn(itemVariants({ variant: props.variant, size: props.size }), props.class),
);
</script>

<template>
  <Primitive
    :as="props.asChild ? undefined : 'div'"
    :as-child="props.asChild"
    data-slot="item"
    :data-variant="variant"
    :data-size="size"
    :class="classes"
  >
    <slot />
  </Primitive>
</template>
