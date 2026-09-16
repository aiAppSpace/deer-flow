<!--
  【文件职责】     建议 chip 行的外壳：横向滚动容器 + 换行的列表格。
  【架构位置】     L2
  【主要导出】     Suggestions 组件
  【依赖关系】     ui/scroll-area · lib/utils(cn)
  【边界与注意】   **这一层是照上游 `ai-elements/suggestion.tsx` 的 `Suggestions` 补的，
                   此前本仓整层没有。** wave 98 当时判「不跟」，理由是「它永远不会真的
                   滚动」（内容 `flex-wrap`、横向滚动条 `hidden`）——**那条判词
                   2026-09-16 作废**：最终目标是两边在功能/体验/交互逻辑/界面上完全一致，
                   而这一层在 React 里是一个**可 Tab 到的滚动区**
                   （`ui/scroll-area` 的 viewport 带 `tabindex`），本仓没有它就少一个
                   tab 落点——对照台账上它是 `tabbablesOnlyReact: div[scroll-area-viewport]`
                   那一族（64 个投影里的一部分）。

                   **只负责结构，不接管子项的入场动画。** 上游用 `Children.map` 给每个
                   子节点套一层带 `animationDelay` 的 `<span>`；Vue 里对应物只有 VNode
                   手术（`v-for` 会塌成 Fragment，插槽里还可能有注释节点），
                   那种聪明写法坏起来是静默的。改为把两个常数做成单一出处
                   （`./stagger` 的 `suggestionEntranceDelay`），调用点各自套 `<span>`
                   ——结构与上游同构，常数只有一份。
-->

<script setup lang="ts">
import { computed } from "vue";

import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

/*
  **`class` 与其余属性都落在内层列表 div 上，不落在滚动壳上。**
  上游的 `Suggestions` 把 `className` 交给内层
  （`cn("flex w-full flex-wrap items-center gap-2", className)`），
  滚动壳自己只有固定的两个类——API 名字看着像给壳的，实际不是。
  照着它来，否则同一串 `min-h-16 justify-center px-4` 会落到另一层上，
  几何当场分叉。

  `inheritAttrs: false` 是为了让 `data-testid` 这类透传属性跟着 `class` 一起
  落到列表 div：本仓的调用点原来就把 testid 挂在那一层。
*/
defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<{ class?: string }>(), { class: "" });

const listClasses = computed(() =>
  cn("flex w-full flex-wrap items-center gap-2", props.class),
);
</script>

<template>
  <!--
    `orientation="both"` + 横向那根 `hidden`，逐字对上游：它的 `ScrollArea`
    包装默认渲染竖向 `ScrollBar`，`Suggestions` 另外加一根
    `<ScrollBar className="hidden" orientation="horizontal" />`。
  -->
  <ScrollArea
    data-slot="suggestions"
    orientation="both"
    class="overflow-x-auto whitespace-normal"
    horizontal-scrollbar-class="hidden"
  >
    <div data-slot="suggestions-list" v-bind="$attrs" :class="listClasses">
      <slot />
    </div>
  </ScrollArea>
</template>
