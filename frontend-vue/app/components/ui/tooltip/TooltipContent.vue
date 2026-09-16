<!--
  【文件职责】     Tooltip 内容层。
  【架构位置】     L2
  【主要导出】     TooltipContent 组件
  【依赖关系】     Reka TooltipContent/Portal · cn
  【边界与注意】   **Reka 那个 `role="tooltip"` 的播报节点带着 `aria-hidden="true"`，
                   等于不在可访问性树里**（wave 215 实测）。它内部调的是
                   `VisuallyHidden`，而那颗 primitive 的 `feature` 默认是
                   `"focusable"`，那一档就会写 `aria-hidden="true"`
                   （`reka-ui/dist/VisuallyHidden/VisuallyHidden.js:28`），
                   而 Tooltip 调用它时**没有覆盖 `feature`**
                   （`Tooltip/TooltipContentImpl.js:134`）。
                   Radix 那一侧的 `VisuallyHidden` 不写 `aria-hidden`，
                   于是上游有一个真的 `tooltip` 节点、本仓一个都没有——
                   对照台账 `branch-thread#turn-actions` 上
                   `ariaOnlyReact: - tooltip "Branch conversation"` / `"分叉"` 就是它。
                   探针读数：本仓 `[role=tooltip]` **存在、文本也对**，
                   但 `aria-hidden="true"`，所以 Playwright 的可访问性快照里没有它。

                   **所以这里自己补一个可达的播报节点**，形状照 Radix
                   （`aria-label || children`，视觉隐藏、不占布局）。
                   够不着 reka 内部那颗，只能在这一层补——补在这一层是对的：
                   调用点有几十个，让每个调用点自己想起来是不可能的。

                   同时**把算好的文本显式传给 `aria-label`**：reka 那颗节点的文本是
                   `props.ariaLabel || currentElement.textContent` 现算的，而触发器的
                   `aria-describedby` 指向的正是它——不传的话它会把我们新补的这份
                   一起算进去，读屏器就会把同一句话念两遍。
-->

<script setup lang="ts">
import { computed, useSlots, type HTMLAttributes, type VNode } from "vue";
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

/** 与 Radix / Next 播报节点相同的视觉隐藏样式：不占布局、不进屏幕。 */
const HIDDEN_STYLE =
  "position:absolute;border:0;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;word-wrap:normal";

const slots = useSlots();

/** 插槽里的纯文本。图标之类的非文本子节点不参与，与可访问名的算法一致。 */
function textOfNodes(nodes: unknown): string {
  if (typeof nodes === "string") return nodes;
  if (Array.isArray(nodes))
    return nodes.map((node) => textOfNodes(node)).join("");
  if (nodes && typeof nodes === "object" && "children" in nodes)
    return textOfNodes((nodes as VNode).children);
  return "";
}

const announced = computed(() => {
  const explicit = props.ariaLabel?.trim();
  if (explicit) return explicit;
  return textOfNodes(slots.default?.()).replace(/\s+/g, " ").trim();
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
      :aria-label="announced || undefined"
      @escape-key-down="emits('escapeKeyDown', $event)"
      @pointer-down-outside="emits('pointerDownOutside', $event)"
    >
      <slot />
      <!-- 见文件头：reka 自己那颗播报节点是 aria-hidden 的，这一颗才进可访问性树。 -->
      <span v-if="announced" role="tooltip" :style="HIDDEN_STYLE">{{
        announced
      }}</span>
    </TooltipContent>
  </TooltipPortal>
</template>
