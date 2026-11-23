<!--
  【文件职责】     单选/多选的分段控件外框。
  【架构位置】     L2
  【主要导出】     ToggleGroup 组件
  【依赖关系】     Reka ToggleGroupRoot · cn
  【边界与注意】   class 合同抄自 shadcn 的 toggle-group（frontend/src/components/ui/
                   toggle-group.tsx）：`data-slot` / `data-variant` / `data-size` /
                   `data-spacing` 都是选择器合同的一部分，子项靠 `data-spacing=0`
                   把自己拼成一条无缝的分段条。

                   组级 variant/size/spacing 通过本层 context 传递，和 React 的样式
                   context 对齐；选择状态仍由 Reka 持有，不包含产品状态。
-->

<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import {
  ToggleGroupRoot,
  type ToggleGroupRootProps,
  useForwardPropsEmits,
} from "reka-ui";

import { cn } from "@/lib/utils";
import { provideToggleGroupStyle } from "./context";

const props = withDefaults(
  defineProps<
    ToggleGroupRootProps & {
      class?: HTMLAttributes["class"];
      variant?: "default" | "outline";
      size?: "default" | "sm" | "lg";
      spacing?: number;
    }
  >(),
  { variant: undefined, size: undefined, spacing: 0, class: undefined },
);
const emits = defineEmits<{ "update:modelValue": [value: unknown] }>();
const delegated = computed(() => {
  const {
    class: _class,
    variant: _variant,
    size: _size,
    spacing: _spacing,
    ...rest
  } = props;
  void _class;
  void _variant;
  void _size;
  void _spacing;
  return rest;
});
const forwarded = useForwardPropsEmits(delegated, emits);
provideToggleGroupStyle(
  computed(() => ({
    variant: props.variant,
    size: props.size,
    spacing: props.spacing,
  })),
);
</script>

<template>
  <ToggleGroupRoot
    v-bind="forwarded"
    data-slot="toggle-group"
    :data-variant="props.variant"
    :data-size="props.size"
    :data-spacing="props.spacing"
    :style="{ '--gap': props.spacing }"
    :class="
      cn(
        'group/toggle-group flex w-fit items-center gap-[--spacing(var(--gap))] rounded-md data-[spacing=default]:data-[variant=outline]:shadow-xs',
        props.class,
      )
    "
  >
    <slot />
  </ToggleGroupRoot>
</template>
