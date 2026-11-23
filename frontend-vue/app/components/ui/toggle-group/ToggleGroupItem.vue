<!--
  【文件职责】     分段控件里的一格。
  【架构位置】     L2
  【主要导出】     ToggleGroupItem 组件
  【依赖关系】     Reka ToggleGroupItem · cn
  【边界与注意】   **单选模式下这一格是 `role="radio"`，不是按下态按钮。** 这一条是两套
                   primitive 的语义分叉（坑 102）：Radix 的 ToggleGroup 在 type="single"
                   时把子项改写成 `role="radio" + aria-checked` 并显式把 `aria-pressed`
                   抹成 undefined；Reka 的 ToggleGroupItem 恒定走 Toggle，永远是
                   `aria-pressed`。读屏器听到的不是一回事：一个是「三选一，当前是第一项」，
                   一个是「三个各自可以按下的按钮」。

                   Reka 的 Toggle 把 `$attrs` 放在 `mergeProps` 的**最后**，所以这三个
                   属性从外面覆盖得掉——这是能这么修的前提，改 Reka 版本前要重新确认。
                   `aria-pressed` 传 `undefined` 才会被移除：传空串会留下 `aria-pressed=""`。

                   class 合同（含 toggleVariants 的那一长串）抄自 shadcn 的
                   toggle.tsx + toggle-group.tsx。
-->

<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import {
  ToggleGroupItem,
  type ToggleGroupItemProps,
  useForwardProps,
} from "reka-ui";

import { cn } from "@/lib/utils";
import { useToggleGroupStyle } from "./context";

const props = withDefaults(
  defineProps<
    ToggleGroupItemProps & {
      class?: HTMLAttributes["class"];
      variant?: "default" | "outline";
      size?: "default" | "sm" | "lg";
      spacing?: number;
      /** 单选组：渲染成 radio 而不是按下态按钮。 */
      single?: boolean;
      checked?: boolean;
    }
  >(),
  {
    variant: undefined,
    size: undefined,
    spacing: 0,
    single: false,
    checked: undefined,
    class: undefined,
  },
);
const delegated = computed(() => {
  const {
    class: _class,
    variant: _variant,
    size: _size,
    spacing: _spacing,
    single: _single,
    checked: _checked,
    ...rest
  } = props;
  void _class;
  void _variant;
  void _size;
  void _spacing;
  void _single;
  void _checked;
  return rest;
});
const forwarded = useForwardProps(delegated);
const groupStyle = useToggleGroupStyle();
const style = computed(() => ({
  variant: groupStyle?.value.variant ?? props.variant,
  size: groupStyle?.value.size ?? props.size,
  spacing: groupStyle?.value.spacing ?? props.spacing,
}));
const pressedAttributes = computed(() =>
  props.single
    ? { "aria-pressed": undefined }
    : props.checked !== undefined
      ? { "aria-pressed": props.checked }
      : {},
);

const VARIANT_CLASS = {
  default: "bg-transparent",
  outline:
    "border border-input bg-transparent shadow-xs hover:bg-accent hover:text-accent-foreground",
} as const;
const SIZE_CLASS = {
  default: "h-9 px-2 min-w-9",
  sm: "h-8 px-1.5 min-w-8",
  lg: "h-10 px-2.5 min-w-10",
} as const;
</script>

<template>
  <ToggleGroupItem
    v-bind="{ ...forwarded, ...pressedAttributes }"
    data-slot="toggle-group-item"
    :data-variant="style.variant"
    :data-size="style.size"
    :data-spacing="style.spacing"
    :role="props.single ? 'radio' : undefined"
    :aria-checked="props.single ? props.checked : undefined"
    :class="
      cn(
        'hover:bg-muted hover:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-4',
        VARIANT_CLASS[style.variant ?? 'default'],
        SIZE_CLASS[style.size ?? 'default'],
        'w-auto min-w-0 shrink-0 cursor-pointer px-3 focus:z-10 focus-visible:z-10',
        'data-[spacing=0]:rounded-none data-[spacing=0]:shadow-none data-[spacing=0]:first:rounded-l-md data-[spacing=0]:last:rounded-r-md data-[spacing=0]:data-[variant=outline]:border-l-0 data-[spacing=0]:data-[variant=outline]:first:border-l',
        props.class,
      )
    "
  >
    <slot />
  </ToggleGroupItem>
</template>
