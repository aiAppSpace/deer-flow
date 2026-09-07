<!--
  【文件职责】     HoverCard 内容层。
  【架构位置】     L2
  【主要导出】     HoverCardContent 组件
  【依赖关系】     Reka HoverCardContent/Portal · cn
  【边界与注意】   统一 z-index 与弹层配色；调用方只覆盖宽度这类布局值。
-->

<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import {
  HoverCardContent,
  HoverCardPortal,
  type HoverCardContentProps,
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
  defineProps<HoverCardContentProps & { class?: HTMLAttributes["class"] }>(),
  {
    sideOffset: 4,
    class: undefined,
  },
);
const emits = defineEmits<{
  escapeKeyDown: [event: KeyboardEvent];
  pointerDownOutside: [event: CustomEvent];
}>();

const forwarded = useForwardProps(props);
const delegated = computed(() => {
  const { class: _class, ...rest } = forwarded.value;
  void _class;
  return rest;
});
</script>

<template>
  <HoverCardPortal>
    <HoverCardContent
      data-slot="hover-card-content"
      v-bind="{ ...$attrs, ...delegated }"
      :class="
        cn(
          'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-80 w-64 origin-(--reka-hover-card-content-transform-origin) rounded-md border p-4 shadow-md outline-hidden',
          props.class,
        )
      "
      @escape-key-down="emits('escapeKeyDown', $event)"
      @pointer-down-outside="emits('pointerDownOutside', $event)"
    >
      <slot />
    </HoverCardContent>
  </HoverCardPortal>
</template>
