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
  **基类逐字照上游 `ui/scroll-area.tsx`。**

  这里曾经多一颗 `overflow-hidden`，而且它**真的承重**：对 grid/flex 子项，
  `overflow` 非 `visible` 会把「自动最小尺寸」从 min-content 变成 0，这一层
  因此能缩到内容宽度以下。2026-09-17 第三十七轮按「上游没有」把它删掉，
  `tests/e2e/integrations.spec.ts` 的「设置面板在 375px/360px 屏上装得进对话框」
  当场从 `panelOverflow: 0` 变成 `4`，只好原样按回来。

  **它守的不是自己，是集成面板那个 0 余量**——同一颗遮挡还让本仓比上游多缩 4px，
  于是对照台账在 `integrations` mobile 上稳定报出 5 行宽度 Δ4.1/4.2。
  **「窄屏不溢出」和那 5 行是同一件事的两面**：上游让内容撑破格子，本仓把它裁掉，
  两种坏法各自自洽。

  第三十八轮量到了那个 0 余量本身（探针：逐层 `width:min-content`）：

      面板 min-content 286.2  vs  375px 屏上的格子 293      → 只剩 6.8px
      承重链 card 252.2 → card-content 250.2 → 授权盒 218.2 → 192.2

  链尾是 `IntegrationsSettings.vue` 里那句 scope 说明**嵌着的字面量**
  `calendar:calendar.free_busy:read.`——冒号和点在词中不给换行机会，
  它自己就是一个 192.2px 宽的「单词」。**两个应用的这条链逐层同值**，
  所以这从来不是「本仓没对齐」，是两边共有的一处窄屏缺陷。

  给那句说明（以及状态格里同病的 `break-words`）换成 `wrap-anywhere` 之后：

      面板 min-content 240.5；375px 余量 52.5、360px 37.5、340px 17.5
      两个应用在 375/360/340/320 四档上**逐值相同**

  余量够了，这颗遮挡就不再承重，于是删掉，基类回到与上游一字不差。
  `tests/guards/primitive-base-classes.test.ts` 里那条 `ScrollArea` 声明
  同轮删除——它自己写的翻案判据就是这一条。

  ⚠ **要再动这颗类，先把上面那串余量重新量一遍**：它是被 min-content 撑着的，
  文案一变就会缩水。320px 上两边仍然一起溢出 3px（同值，不是对照问题）。

  下面这几条是第三十七轮逐字对齐过的：此前本仓是 `p-0.5` +
  `data-[orientation=vertical]:w-2`（内边距 2px、条宽 8px、没有那道透明左/上边框），
  上游是 `p-px` + `w-2.5` + `border-l border-l-transparent`（1px / 10px / 有边框）。
  **滚动条是用户看得见的东西**，10px 与 8px 是实打实的视觉差。
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
