<!--
  【文件职责】     DropdownMenu 子菜单触发器。
  【架构位置】     L2
  【主要导出】     DropdownMenuSubTrigger 组件
  【依赖关系】     Reka DropdownMenuSubTrigger · lucide ChevronRight · cn
  【边界与注意】   末尾那个箭头由 primitive 自己渲染并 aria-hidden：它是"这里还有
                   一层"的视觉提示，展开状态由 primitive 写在 aria-expanded 上，
                   让箭头进可访问名只会让读屏器多念一个字符。
-->

<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { ChevronRight } from "lucide-vue-next";
import {
  DropdownMenuSubTrigger,
  useForwardProps,
  type DropdownMenuSubTriggerProps,
} from "reka-ui";

import { cn } from "@/lib/utils";

const props = defineProps<
  DropdownMenuSubTriggerProps & {
    class?: HTMLAttributes["class"];
    inset?: boolean;
  }
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
  <DropdownMenuSubTrigger
    data-slot="dropdown-menu-sub-trigger"
    :data-inset="props.inset || undefined"
    v-bind="delegated"
    :class="
      cn(
        `hover:bg-accent focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4`,
        props.class,
      )
    "
  >
    <slot />
    <ChevronRight aria-hidden="true" class="ml-auto size-4" />
  </DropdownMenuSubTrigger>
</template>
