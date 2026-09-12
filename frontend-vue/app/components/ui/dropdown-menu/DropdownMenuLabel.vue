<!--
  【文件职责】     DropdownMenu 分组标题。
  【架构位置】     L2
  【主要导出】     DropdownMenuLabel 组件
  【依赖关系】     Reka DropdownMenuLabel · cn
  【边界与注意】   非可聚焦项，不参与方向键序列。

                   **基类逐字照上游**（`frontend/src/components/ui/dropdown-menu.tsx:157`）。
                   wave 140 之前这里写的是 `text-muted-foreground px-2 py-1.5 text-xs`
                   ——**把调用点的覆盖烤进了 primitive**，同时丢掉了 `font-medium` 与
                   `data-[inset]:pl-8`。连锁后果是本仓自己的调用点再去补偿：
                   `TokenUsageIndicator.vue` 那两处写着 `text-foreground text-sm font-semibold`，
                   而上游同一处是光秃秃的 `<DropdownMenuLabel>`，于是那两个分组标题
                   **上游是 medium、本仓是 semibold**。

                   **这一类对照台账看不见**：几何档采样 color / fontSize / opacity /
                   命中测试，**没有 font-weight**，aria 树也不带字重。wave 140 一并把
                   `fontWeight` 加进几何档，这一格从此有人守。

                   **`inset` 这个 prop 是 2026-09-12 第十五轮补的**，同族三颗
                   （Label / Item / SubTrigger）一起。此前基类里带着 `data-[inset]:pl-8`
                   却**没有任何出口能把 `data-inset` 打上去**——reka 没有 `inset` 这个
                   概念，它是 shadcn 层的 prop（`ui/dropdown-menu.tsx:74/156/212`），
                   于是那条选择器在本仓是**死的**：写着、永远不成立。

                   **写成 `props.inset || undefined` 而不是 `props.inset`**：
                   Vue 的布尔 prop 不传时会被转成 `false`，而 `data-[inset]:pl-8`
                   编译出来是 `[data-inset]{…}`——**按属性存在匹配**，
                   `data-inset="false"` 照样命中。照直绑的话每一项都会缩进 8。
                   （上游 React 在 `inset={false}` 时确实会打出 `data-inset="false"`
                   并因此缩进，那是它的 quirk；两边调用点都是零消费者，本仓取「不打」。）
-->

<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import {
  DropdownMenuLabel,
  type DropdownMenuLabelProps,
  useForwardProps,
} from "reka-ui";

import { cn } from "@/lib/utils";

const props = defineProps<
  DropdownMenuLabelProps & { class?: HTMLAttributes["class"]; inset?: boolean }
>();
const forwarded = useForwardProps(props);
const delegated = computed(() => {
  const { class: _class, inset: _inset, ...rest } = forwarded.value;
  void _class;
  void _inset;
  return rest;
});
</script>

<template>
  <DropdownMenuLabel
    data-slot="dropdown-menu-label"
    :data-inset="props.inset || undefined"
    v-bind="delegated"
    :class="
      cn('px-2 py-1.5 text-sm font-medium data-[inset]:pl-8', props.class)
    "
  >
    <slot />
  </DropdownMenuLabel>
</template>
