<!--
  【文件职责】     Select 触发器：显示当前值并承载 combobox 语义。
  【架构位置】     L2
  【主要导出】     SelectTrigger 组件
  【依赖关系】     Reka SelectTrigger/SelectIcon · cn
  【边界与注意】   可访问名字由调用方通过 aria-label 或关联 label 提供。

                   尺寸走 `size` prop + `data-size` 属性，默认 `default`（h-9）、
                   另有 `sm`（h-8），与 React 的同名件一致；宽度默认 `w-fit`，要撑满
                   由调用方传 `class="w-full"`——原来这里写死 `w-full`，于是 React 上
                   一个贴着内容宽的下拉，在 Vue 上会占满整行。
-->

<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import {
  SelectIcon,
  SelectTrigger,
  type SelectTriggerProps,
  useForwardProps,
} from "reka-ui";
import { ChevronDown } from "lucide-vue-next";

import { cn } from "@/lib/utils";

const props = withDefaults(
  defineProps<
    SelectTriggerProps & {
      class?: HTMLAttributes["class"];
      size?: "sm" | "default";
    }
  >(),
  { size: "default" },
);
const forwarded = useForwardProps(props);
const delegated = computed(() => {
  const { class: _class, size: _size, ...rest } = forwarded.value;
  void _class;
  void _size;
  return rest;
});
</script>

<template>
  <SelectTrigger
    data-slot="select-trigger"
    :data-size="props.size"
    v-bind="delegated"
    :class="
      cn(
        `border-input data-[placeholder]:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 dark:hover:bg-input/50 flex w-fit max-w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:min-w-0 *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4`,
        props.class,
      )
    "
  >
    <slot />
    <SelectIcon as-child>
      <ChevronDown class="size-4 opacity-50" />
    </SelectIcon>
  </SelectTrigger>
</template>
