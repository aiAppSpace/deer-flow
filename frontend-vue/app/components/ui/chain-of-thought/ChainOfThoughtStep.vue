<!--
  【文件职责】     思维链的一步：左侧图标与竖直连接线，右侧标签、描述与自定义内容。
  【架构位置】     L2
  【主要导出】     ChainOfThoughtStep 组件
  【依赖关系】     lucide-vue-next Dot · @/lib/utils
  【边界与注意】   两个默认值是行为，不是装饰，改掉它们会静默改变所有调用点：

                   1. `status` 默认 `complete`，而 complete 的样式是
                      `text-muted-foreground`。上游 SubtaskCard 一次都没传过 status，
                      所以卡片里每一步、包括折叠头那行任务描述，都是 muted 灰
                      （对照台账上 `color React=rgba(115,115,115) Vue=rgba(10,10,10)`
                      就是这一处：本仓此前用的是 `font-medium` 的正文色）。
                   2. 没给 icon 时落到 lucide `Dot` 并且**由本组件补 `size-4`**；
                      给了 icon 就原样渲染、不补尺寸。上游写的是
                      `isValidElement(Icon) ? Icon : <Icon className="size-4"/>`。
                      SubtaskCard 传进来的 ClipboardList 因此没有 size 类，靠 Button
                      的 `[&_svg:not([class*='size-'])]:size-4` 才变成 16px。

                   竖直连接线（`top-7 bottom-0`）在两边都量不到高度：图标格子只有
                   16~18px 高，top:28px 之后 bottom:0 得到负高度。它是上游为更长的
                   步骤行留的，照抄是为了 DOM 逐行一致，不是因为这里看得见它。
-->
<script setup lang="ts">
import { computed, useSlots } from "vue";
import { Dot } from "lucide-vue-next";

import { cn } from "@/lib/utils";

const props = withDefaults(
  defineProps<{ status?: "complete" | "active" | "pending"; class?: string }>(),
  { status: "complete" },
);
const slots = useSlots();

const statusStyles = {
  complete: "text-muted-foreground",
  active: "text-foreground",
  pending: "text-muted-foreground/50",
} as const;

const classes = computed(() =>
  cn(
    "flex gap-2 text-sm",
    statusStyles[props.status],
    "fade-in-0 slide-in-from-top-2 animate-in",
    props.class,
  ),
);
</script>

<template>
  <div :class="classes">
    <div class="relative mt-0.5">
      <slot name="icon">
        <Dot class="size-4" />
      </slot>
      <div class="bg-border absolute top-7 bottom-0 left-1/2 -mx-px w-px" />
    </div>
    <div class="min-w-0 flex-1 space-y-2 overflow-hidden wrap-anywhere">
      <div
        class="max-w-full min-w-0 [overflow-wrap:anywhere] whitespace-normal"
      >
        <slot name="label" />
      </div>
      <div v-if="slots.description" class="text-muted-foreground text-xs">
        <slot name="description" />
      </div>
      <slot />
    </div>
  </div>
</template>
