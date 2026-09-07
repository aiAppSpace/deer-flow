<!--
  【文件职责】     DropdownMenu 子菜单内容层。
  【架构位置】     L2
  【主要导出】     DropdownMenuSubContent 组件
  【依赖关系】     Reka DropdownMenuSubContent · cn
  【边界与注意】   **子菜单内容不 portal，这一条与 DropdownMenuContent 相反。**
                   上游 shadcn 的 `dropdown-menu.tsx` 里，`DropdownMenuContent` 包了
                   `DropdownMenuPrimitive.Portal`，而 `DropdownMenuSubContent` **没有**
                   ——子菜单渲染在父菜单的子树里，靠 popper 定位。

                   本仓此前照着 Content 那一条也包了 Portal，理由写的是「同样 portal
                   到 body」——**那是抄来的假设，不是量出来的**。后果是子菜单内容被
                   挂到 body 末尾，可访问性树里读起来是这样：

                       上游：… Export ▸ → [Export as Markdown, Export as JSON] → 分隔线 → Delete
                       本仓：… Export ▸ → 分隔线 → Delete            （整个父菜单读完）
                             …（页面末尾）Export 子菜单的两项

                   也就是**子菜单的两项与打开它的那颗触发器被拆开了**。
                   wave 95 给对照加了「公共节点相对顺序」这一档才量出来——
                   aria 那一档按多重集比，顺序天然测不出来（天生看不见的第④类）。

                   `inheritAttrs: false` 留着：调用方的 data-testid 要落在内容元素上。
-->

<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import {
  DropdownMenuSubContent,
  useForwardProps,
  type DropdownMenuSubContentProps,
} from "reka-ui";

import { cn } from "@/lib/utils";

defineOptions({ inheritAttrs: false });

const props = defineProps<
  DropdownMenuSubContentProps & { class?: HTMLAttributes["class"] }
>();

const forwarded = useForwardProps(props);
const delegated = computed(() => {
  const { class: _class, ...rest } = forwarded.value;
  void _class;
  return rest;
});
</script>

<template>
  <DropdownMenuSubContent
    data-slot="dropdown-menu-sub-content"
    v-bind="{ ...$attrs, ...delegated }"
    :class="
      cn(
        'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-80 min-w-32 origin-(--reka-dropdown-menu-content-transform-origin) overflow-hidden rounded-md border p-1 shadow-lg',
        props.class,
      )
    "
  >
    <slot />
  </DropdownMenuSubContent>
</template>
