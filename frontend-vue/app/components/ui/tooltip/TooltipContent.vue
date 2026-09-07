<!--
  【文件职责】     Tooltip 内容层。
  【架构位置】     L2
  【主要导出】     TooltipContent 组件
  【依赖关系】     Reka TooltipContent/Portal · cn
  【边界与注意】   Reka 会把内容同时投影到一个 role="tooltip" 的隐藏节点上供读屏器读取，
                   可见节点本身是 aria-hidden——不要再手写 role="tooltip"。
-->

<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import {
  TooltipContent,
  TooltipPortal,
  type TooltipContentEmits,
  type TooltipContentProps,
  useForwardProps,
} from "reka-ui";

import { cn } from "@/lib/utils";

/*
  内容 portal 到 body，组件根是 Portal 而不是内容元素。不关掉 attribute 继承，
  调用方传的 data-testid / aria-label / id 会落到 Portal 上——那是一个不渲染
  任何 DOM 的包装组件，属性直接消失，而且没有任何报错。
*/
defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<TooltipContentProps & { class?: HTMLAttributes["class"] }>(),
  {
    sideOffset: 4,
    class: undefined,
  },
);
const emits = defineEmits<TooltipContentEmits>();

const forwarded = useForwardProps(props);
const delegated = computed(() => {
  const { class: _class, ...rest } = forwarded.value;
  void _class;
  return rest;
});
</script>

<template>
  <TooltipPortal>
    <TooltipContent
      data-slot="tooltip-content"
      v-bind="{ ...$attrs, ...delegated }"
      :class="
        cn(
          'animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 bg-foreground text-background dark:text-foreground z-90 w-fit origin-(--reka-tooltip-content-transform-origin) rounded-md border px-3 py-1.5 text-xs text-balance shadow-xs dark:border-white/18 dark:bg-[#050504]',
          props.class,
        )
      "
      @escape-key-down="emits('escapeKeyDown', $event)"
      @pointer-down-outside="emits('pointerDownOutside', $event)"
    >
      <slot />
    </TooltipContent>
  </TooltipPortal>
</template>
