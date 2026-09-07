<!--
  【文件职责】     DropdownMenu 单选项，自带选中指示位。
  【架构位置】     L2
  【主要导出】     DropdownMenuRadioItem 组件
  【依赖关系】     Reka DropdownMenuRadioItem/ItemIndicator · cn
  【边界与注意】   指示位固定占位，选中与否都不改变文本起点。
-->

<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import {
  DropdownMenuItemIndicator,
  DropdownMenuRadioItem,
  type DropdownMenuRadioItemEmits,
  type DropdownMenuRadioItemProps,
  useForwardProps,
} from "reka-ui";
import { Circle } from "lucide-vue-next";

import { cn } from "@/lib/utils";

const props = defineProps<
  DropdownMenuRadioItemProps & { class?: HTMLAttributes["class"] }
>();
const emits = defineEmits<DropdownMenuRadioItemEmits>();

const forwarded = useForwardProps(props);
const delegated = computed(() => {
  const { class: _class, ...rest } = forwarded.value;
  void _class;
  return rest;
});
</script>

<template>
  <DropdownMenuRadioItem
    data-slot="dropdown-menu-radio-item"
    v-bind="delegated"
    :class="
      cn(
        `hover:bg-accent focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4`,
        props.class,
      )
    "
    @select="emits('select', $event)"
  >
    <!--
      **选中标记是一颗填色的小圆点，不是对勾。**
      上游 ui/dropdown-menu.tsx:136 是
      `<CircleIcon className="size-2 fill-current" />`（8px 实心圆），
      外面那层是 `absolute left-2 flex size-3.5`。
      本仓原来画的是 `<Check :size="14" />`——**14px 的对勾**，
      外层也差一档（`left-1.5` / `size-4`）。
      单选组用圆点、多选用对勾是这套 primitive 的既定分工，
      画成对勾会让单选看起来像可以多选。
      `icon-parity` 的尺寸档报的「Circle：React 8px ↔ Vue 15/16px」就是这一处：
      本仓的 `Circle` 只用在别处，这颗指示器压根没用它。
    -->
    <span
      class="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center"
    >
      <DropdownMenuItemIndicator>
        <Circle class="size-2 fill-current" aria-hidden="true" />
      </DropdownMenuItemIndicator>
    </span>
    <slot />
  </DropdownMenuRadioItem>
</template>
