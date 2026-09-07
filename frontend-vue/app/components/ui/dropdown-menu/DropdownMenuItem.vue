<!--
  【文件职责】     DropdownMenu 单个动作项。
  【架构位置】     L2
  【主要导出】     DropdownMenuItem 组件
  【依赖关系】     Reka DropdownMenuItem · cn
  【边界与注意】   用 @select 而不是 @click：键盘 Enter/Space 只触发 select。
-->

<script setup lang="ts">
/*
  wave 75：class 合同逐条对上上游 `ui/dropdown-menu.tsx`。此前本仓这三份只抄了
  一半，缺的每一条都看得见：

  - `[&_svg:not([class*='size-'])]:size-4` —— **菜单项里的图标没有默认尺寸**，
    于是每个调用点得自己写 `:size="14"`（写出来还比上游的 16px 小 2px），
    漏写的就是 lucide 的默认 24px。
  - `[&_svg:not([class*='text-'])]:text-muted-foreground` —— 上游菜单项里的图标
    是**中灰**的，本仓继承前景色，深一档。
  - `focus:text-accent-foreground` —— 键盘走到某一项时上游连文字也换色。
  - `[&_svg]:pointer-events-none [&_svg]:shrink-0` —— 图标不吃指针、不被文字挤扁。
  - destructive 那一支的三条（`focus:bg-destructive/10` + 深色档 +
    `focus:text-destructive`）与 `*:[svg]:!text-destructive` —— 删除项在悬停/聚焦时
    整行（含图标）变红，本仓只有静息态的文字是红的。
  - `rounded-sm`（本仓写的是 `rounded`）、`text-sm`、`data-[inset]:pl-8`、
    `outline-hidden`（本仓 `outline-none`）。

  `hover:bg-accent` 是本仓多出来的一条，**保留**：Reka 的菜单项只在
  `data-highlighted` 时才 focus，鼠标悬停不触发 focus，而上游 Radix 的
  `focus:` 在鼠标移上去时就成立（它给高亮项打的就是 focus）。

  **菜单项渲染成 `<div>`，不要在调用点传 `as="button"`。**
  reka 的 `Primitive` 默认就是 `div`，与上游 Radix 一致；`as="button"` 是本仓
  七个调用点各自加上去的。后果不是「多个标签名」这么轻——

    `<button>` 的 `width: auto` 解析成 fit-content（表单控件的固有尺寸规则，
    `display: flex` 也改不了它），所以它**不会撑满菜单**。

  wave 145 实测：线程行 ⋯ 菜单的「删除」项 React=182 / Vue=81.8（中文 68），
  而菜单本身两边都是 192。此前是靠在**这份基类里**写 `w-full text-left` 压住的
  ——补偿写在了错的那一层：primitive 为一个调用点的选择买单，而上游同一份基类
  两条都没有。把 `as="button"` 去掉之后，两条补偿一起删。
*/
import { computed, type HTMLAttributes } from "vue";
import {
  DropdownMenuItem,
  type DropdownMenuItemEmits,
  type DropdownMenuItemProps,
  useForwardProps,
} from "reka-ui";

import { cn } from "@/lib/utils";

const props = defineProps<
  DropdownMenuItemProps & {
    class?: HTMLAttributes["class"];
    variant?: "default" | "destructive";
  }
>();
const emits = defineEmits<DropdownMenuItemEmits>();

const forwarded = useForwardProps(props);
const delegated = computed(() => {
  const { class: _class, variant: _variant, ...rest } = forwarded.value;
  void _class;
  void _variant;
  return rest;
});
</script>

<template>
  <DropdownMenuItem
    data-slot="dropdown-menu-item"
    :data-variant="props.variant"
    v-bind="delegated"
    :class="
      cn(
        `hover:bg-accent focus:bg-accent focus:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 dark:data-[variant=destructive]:focus:bg-destructive/20 data-[variant=destructive]:focus:text-destructive data-[variant=destructive]:*:[svg]:!text-destructive [&_svg:not([class*='text-'])]:text-muted-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4`,
        props.class,
      )
    "
    @select="emits('select', $event)"
  >
    <slot />
  </DropdownMenuItem>
</template>
