<!--
  【文件职责】     可滚动区域：统一滚动条外观，但保留原生滚动与键盘行为。
  【架构位置】     L2
  【主要导出】     ScrollArea 组件
  【依赖关系】     Reka ScrollAreaRoot/Viewport/Scrollbar/Thumb/Corner · cn
  【边界与注意】   viewport 保持 tabindex 可聚焦：只用滚轮不用键盘的滚动区域，
                   纯键盘用户根本到不了。
-->

<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import {
  ScrollAreaCorner,
  ScrollAreaRoot,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaViewport,
  type ScrollAreaRootProps,
  useForwardProps,
} from "reka-ui";

import { cn } from "@/lib/utils";

const props = withDefaults(
  defineProps<
    ScrollAreaRootProps & {
      class?: HTMLAttributes["class"];
      viewportClass?: HTMLAttributes["class"];
      orientation?: "vertical" | "horizontal" | "both";
      /*
        **上游把 `ScrollBar` 单独导出，调用方自己渲染、自己给类**
        （`ui/scroll-area.tsx` 的 `export { ScrollArea, ScrollBar }`，
        `ai-elements/suggestion.tsx` 就是这么写 `<ScrollBar className="hidden"
        orientation="horizontal" />` 的）。本仓这一层把两根滚动条都渲染在里面，
        所以那个能力要以 prop 的形式给出来——否则调用方只能在外面用后代选择器
        去够它，那是打补丁。

        **按方向分开两个 prop**：`hidden` 这种类只该落在其中一根上。
      */
      scrollbarClass?: HTMLAttributes["class"];
      horizontalScrollbarClass?: HTMLAttributes["class"];
    }
  >(),
  {
    type: "hover",
    orientation: "vertical",
    class: undefined,
    viewportClass: undefined,
    scrollbarClass: undefined,
    horizontalScrollbarClass: undefined,
  },
);

const forwarded = useForwardProps(props);
const delegated = computed(() => {
  const {
    class: _class,
    viewportClass: _viewportClass,
    orientation: _orientation,
    scrollbarClass: _scrollbarClass,
    horizontalScrollbarClass: _horizontalScrollbarClass,
    ...rest
  } = forwarded.value;
  void _class;
  void _viewportClass;
  void _orientation;
  void _scrollbarClass;
  void _horizontalScrollbarClass;
  return rest;
});
/*
  **基类逐字照上游 `ui/scroll-area.tsx`。** 2026-09-17 第三十七轮逐字对过一遍：
  此前本仓是 `p-0.5` + `data-[orientation=vertical]:w-2`（内边距 2px、条宽 8px、
  没有那道透明左/上边框），上游是 `p-px` + `w-2.5` + `border-l border-l-transparent`
  （1px / 10px / 有边框）。**滚动条是用户看得见的东西**，10px 与 8px 是实打实的视觉差。

  它此前躲过门禁，是因为 `tests/guards/primitive-base-classes.test.ts` 给
  `ScrollArea` 挂了豁免（理由：根元素类串差一个 `overflow-hidden`，但那些屏上
  台账是 0 行，判据取渲染一致）。**那条豁免自己写了翻案判据**——
  「哪天台账在 ScrollArea 所在的屏上报出几何差异，就回来逐字对一遍」——
  而 A 组那 5 行几何差异正出在设置对话框，那一屏就是 ScrollArea。条件满足，
  于是回来对了这一遍。
*/
const SCROLLBAR_BASE = "flex touch-none p-px transition-colors select-none";
const verticalScrollbarClass = computed(() =>
  cn(
    SCROLLBAR_BASE,
    "h-full w-2.5 border-l border-l-transparent",
    props.scrollbarClass,
  ),
);
const horizontalScrollbarClass = computed(() =>
  cn(
    SCROLLBAR_BASE,
    "h-2.5 flex-col border-t border-t-transparent",
    props.scrollbarClass,
    props.horizontalScrollbarClass,
  ),
);
</script>

<template>
  <ScrollAreaRoot
    data-slot="scroll-area"
    v-bind="delegated"
    :class="cn('relative', props.class)"
  >
    <ScrollAreaViewport
      data-slot="scroll-area-viewport"
      :class="
        cn(
          'focus-visible:ring-ring/50 size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:outline-1',
          props.viewportClass,
        )
      "
    >
      <slot />
    </ScrollAreaViewport>
    <ScrollAreaScrollbar
      v-if="props.orientation !== 'horizontal'"
      data-slot="scroll-area-scrollbar"
      orientation="vertical"
      :class="verticalScrollbarClass"
    >
      <ScrollAreaThumb class="bg-border relative flex-1 rounded-full" />
    </ScrollAreaScrollbar>
    <ScrollAreaScrollbar
      v-if="props.orientation !== 'vertical'"
      data-slot="scroll-area-scrollbar"
      orientation="horizontal"
      :class="horizontalScrollbarClass"
    >
      <ScrollAreaThumb class="bg-border relative flex-1 rounded-full" />
    </ScrollAreaScrollbar>
    <ScrollAreaCorner />
  </ScrollAreaRoot>
</template>
