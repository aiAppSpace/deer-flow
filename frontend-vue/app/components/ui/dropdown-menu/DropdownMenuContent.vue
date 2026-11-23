<!--
  【文件职责】     DropdownMenu 内容层：portal、定位、方向键与 Escape。
  【架构位置】     L2
  【主要导出】     DropdownMenuContent 组件
  【依赖关系】     Reka DropdownMenuContent/Portal · cn
  【边界与注意】   内容高度限制为 Reka 的可用高度并保留纵向滚动；动画原点跟随触发器。
                   横向同时限制最大和最小宽度，避免 rem 下限抵消可用宽度上限。
                   子菜单使用自身的视口约束，不套用此处 popper available-width。
-->

<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import {
  DropdownMenuContent,
  DropdownMenuPortal,
  type DropdownMenuContentEmits,
  type DropdownMenuContentProps,
  injectDropdownMenuRootContext,
  useForwardProps,
} from "reka-ui";

import { cn } from "@/lib/utils";
import { retainMenuTab } from "./use-menu-tab-stop";

/*
  内容 portal 到 body，组件根是 Portal 而不是内容元素。不关掉 attribute 继承，
  调用方传的 data-testid / aria-label / id 会落到 Portal 上——那是一个不渲染
  任何 DOM 的包装组件，属性直接消失，而且没有任何报错。
*/
defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<DropdownMenuContentProps & { class?: HTMLAttributes["class"] }>(),
  {
    sideOffset: 4,
    /*
      Keep an already-open menu inside the collision boundary even when a
      low-height/text-zoom reflow moves its trigger partly outside the window.
      `partial` (the primitive default) keeps following that hidden trigger and
      can leave the scroll viewport itself below the screen, so its final items
      remain unreachable even at max scroll.
    */
    sticky: "always",
    collisionPadding: 8,
    // Keep both axes inside the viewport when reflow moves the anchor outside it.
    prioritizePosition: true,
    class: undefined,
  },
);
const emits = defineEmits<
  DropdownMenuContentEmits & { openAutoFocus: [event: Event] }
>();

const forwarded = useForwardProps(props);
const menuRoot = injectDropdownMenuRootContext();
const delegated = computed(() => {
  const { class: _class, ...rest } = forwarded.value;
  void _class;
  // TooltipRoot also owns a generic PopperRoot. A composed tooltip/trigger can
  // register there, so use this menu's existing native trigger as its anchor.
  return {
    ...rest,
    reference: rest.reference ?? menuRoot.triggerElement.value,
  };
});
</script>

<template>
  <DropdownMenuPortal>
    <DropdownMenuContent
      data-slot="dropdown-menu-content"
      v-bind="{ ...$attrs, ...delegated }"
      :class="
        cn(
          'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-80 max-h-(--reka-dropdown-menu-content-available-height) max-w-(--reka-dropdown-menu-content-available-width) min-w-[min(8rem,var(--reka-dropdown-menu-content-available-width,8rem))] origin-(--reka-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border p-1 shadow-md',
          props.class,
        )
      "
      @escape-key-down="emits('escapeKeyDown', $event)"
      @pointer-down-outside="emits('pointerDownOutside', $event)"
      @focus-outside="emits('focusOutside', $event)"
      @interact-outside="emits('interactOutside', $event)"
      @close-auto-focus="emits('closeAutoFocus', $event)"
      @open-auto-focus="emits('openAutoFocus', $event)"
      @keydown="retainMenuTab"
    >
      <slot />
    </DropdownMenuContent>
  </DropdownMenuPortal>
</template>
