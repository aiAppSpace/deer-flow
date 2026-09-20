<!--
  【文件职责】     DropdownMenu 内容层：portal、定位、方向键与 Escape。
  【架构位置】     L2
  【主要导出】     DropdownMenuContent 组件
  【依赖关系】     Reka DropdownMenuContent/Portal · cn
  【边界与注意】   统一 z-index 与弹层配色；调用方只覆盖宽度这类布局值。

                   三条来自上游 `ui/dropdown-menu.tsx:38` 的合同，本仓原来一条都没有：
                   ① **`max-h-(--reka-dropdown-menu-content-available-height)`
                   + `overflow-y-auto`**——不写这两条，比视口高的菜单**滚不动**，
                   底下几项永远够不着（实测本仓 max-height 恒为 `none`，
                   上游同一屏是 507px / 735px）。Reka 与 Radix 一样把
                   `--reka-popper-available-height` 转写成这个带命名空间的变量
                   （reka-ui/dist/DropdownMenu/DropdownMenuContent.js 的 style）。
                   ② `origin-(--reka-dropdown-menu-content-transform-origin)`
                   + zoom/slide 那四条：上游的菜单是从触发器那一侧展开的，
                   本仓只有淡入。
                   `z-80` 是本仓自己的一层统一（上游 `z-50`），有意保留。

                   ③ **横向那一半是第五十六轮补的，上游同一处同改**：
                   `max-w-(--reka-dropdown-menu-content-available-width)`
                   + `min-w-[min(8rem,var(…available-width,8rem))]`。
                   只有 ① 那条竖的时候，菜单**横着**照样能比屏幕宽：
                   实测 200% 文本 / 375px 视口下这颗会话 ⋯ 菜单是 **384px**，
                   摆在 x=-46，左边整整切掉 46px。

                   ⚠ **`min-w` 那一半不能省。** `min-w-32` = 8rem 在 200% 下是
                   **256px**，它是个 rem 下限，会把 `max-w` 顶回去——
                   只加 `max-w` 时量到的是 256（而不是可用的 210）。
                   改完两应用逐字相同：基线 `[59,314 192x243]`（一格没动）、
                   200% `[0,209 210x603]`（归位）。

                   ⚠ **同一个 clamp 不要加到 `DropdownMenuSubContent` 上**
                   （第五十六轮试过并撤回）：子菜单那一侧两个 primitive 算出来的
                   available-width 不一样（本仓 375 / 上游 174），
                   加上去会把上游基线的子菜单夹到 129px、条目换行，
                   **为修 200% 弄坏基线**。判词与读数在 open-accounts 第五十六轮。
-->

<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import {
  DropdownMenuContent,
  DropdownMenuPortal,
  type DropdownMenuContentEmits,
  type DropdownMenuContentProps,
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
  defineProps<DropdownMenuContentProps & { class?: HTMLAttributes["class"] }>(),
  {
    sideOffset: 4,
    class: undefined,
  },
);
const emits = defineEmits<DropdownMenuContentEmits>();

const forwarded = useForwardProps(props);
const delegated = computed(() => {
  const { class: _class, ...rest } = forwarded.value;
  void _class;
  return rest;
});
</script>

<template>
  <DropdownMenuPortal>
    <DropdownMenuContent
      data-slot="dropdown-menu-content"
      v-bind="{ ...$attrs, ...delegated }"
      :class="
        cn(
          'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-80 max-h-(--reka-dropdown-menu-content-available-height) max-w-(--reka-dropdown-menu-content-available-width) min-w-[min(8rem,var(--reka-dropdown-menu-content-available-width,8rem))] origin-(--reka-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border p-1 shadow-md',
          props.class,
        )
      "
      @escape-key-down="emits('escapeKeyDown', $event)"
      @pointer-down-outside="emits('pointerDownOutside', $event)"
      @focus-outside="emits('focusOutside', $event)"
      @interact-outside="emits('interactOutside', $event)"
      @close-auto-focus="emits('closeAutoFocus', $event)"
    >
      <slot />
    </DropdownMenuContent>
  </DropdownMenuPortal>
</template>
