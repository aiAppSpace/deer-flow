<!--
  【文件职责】     Command 单个可执行项。
  【架构位置】     L2
  【主要导出】     CommandItem 组件
  【依赖关系】     Reka ListboxItem · cn
  【边界与注意】   高亮态用 data-highlighted，不要再自己维护 aria-selected。

                   class 串逐条对着上游 `ui/command.tsx:159` 的 CommandItem
                   （Reka 的 `data-highlighted` 对应 cmdk 的 `data-[selected=true]`）。
                   本仓原来只抄了一半，差出来的是：
                   - `gap-3 px-3 py-2 rounded-md` 而上游是 `gap-2 px-2 py-1.5
                     rounded-sm`——模型选择器每项因此高 4px、加上 CommandList
                     多出来的 `p-2`，整个对话框比上游高 23.9px、居中之后又上移
                     12px（台账上 agent-chat 那五行）；
                   - 少了 `data-[highlighted]:text-accent-foreground`，高亮项只换底色
                     不换字色；
                   - 少了那组 `[&_svg]` 合同（默认 16px、不吃指针、不收缩、
                     没写颜色的图标走 muted）——**与 wave 75 在三份 dropdown
                     primitive 上拆出来的是同一条**：图标没有默认尺寸，
                     每个调用点就得自己写一遍。
-->

<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import {
  ListboxItem,
  type ListboxItemEmits,
  type ListboxItemProps,
  useForwardProps,
} from "reka-ui";

import { cn } from "@/lib/utils";

const props = defineProps<
  ListboxItemProps & { class?: HTMLAttributes["class"] }
>();
const emits = defineEmits<ListboxItemEmits>();

const forwarded = useForwardProps(props);
const delegated = computed(() => {
  const { class: _class, ...rest } = forwarded.value;
  void _class;
  return rest;
});
</script>

<template>
  <ListboxItem
    data-slot="command-item"
    v-bind="delegated"
    :class="
      cn(
        `data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4`,
        props.class,
      )
    "
    @select="emits('select', $event)"
  >
    <slot />
  </ListboxItem>
</template>
