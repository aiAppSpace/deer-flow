<!--
  【文件职责】     侧栏的外壳：窄屏是一个真正的模态抽屉，宽屏是版面里的一块。
  【架构位置】     L3
  【主要导出】     ThreadSidebarShell 组件
  【依赖关系】     ui/sheet（reka DialogRoot/DialogContent）
  【边界与注意】   **形状照上游 `ui/sidebar.tsx` 的 `Sidebar`**：它在 `isMobile`
                   那一支里返回的是 `<Sheet><SheetContent …><SheetHeader className="sr-only">
                   <SheetTitle>Sidebar</SheetTitle><SheetDescription>Displays the mobile
                   sidebar.</SheetDescription></SheetHeader><div className="flex h-full
                   w-full flex-col">{children}</div></SheetContent></Sheet>`，
                   宽屏那一支才是版面里的一块。

                   **为什么要有这个组件**（wave 148）：本仓原来只有**一个**元素，
                   靠 `:role="mobileOpen ? 'dialog' : undefined"` 这类三元表达式在
                   两种形态之间切，模态语义则是手写的四件套——`aria-modal="true"`、
                   一个 `keydown` 里的 Tab 陷阱、一个 window 上的 Escape 分支、
                   一颗 `fixed inset-0` 的背景按钮。

                   wave 147 把移动端抽屉第一次挂进对照取样面，量出 30 行差异，
                   同一处根因：**上游的抽屉是 Radix Dialog，它给兄弟节点打
                   `aria-hidden`，本仓这一套没有**——于是抽屉打开时，读屏器仍然
                   能走到背后那一整页（composer、欢迎语、每一颗按钮）。
                   `aria-modal="true"` 只是一个**声明**，靠 AT 自己认；
                   `aria-hidden` 是**事实**，谁都绕不过去。两者上游都有。

                   换成 primitive 之后这四件套全部由 reka 的
                   `DialogContentModal` 承担（它内部就是 `useHideOthers` +
                   `FocusScope` + `DismissableLayer`），本仓不再自己写一份。

                   **`[&>button]:hidden` 是上游同一处的写法**：`SheetContent` 恒定
                   渲染一颗关闭按钮，而抽屉里已经有 `SidebarTrigger` 了，
                   两颗同功能的按钮会让读屏器听到两次。
-->

<script setup lang="ts">
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const props = defineProps<{
  /** 窄屏：走 Sheet 那一支。 */
  narrow: boolean;
  /** 窄屏抽屉的开合。宽屏时无意义。 */
  open: boolean;
  /** 宽屏的收起态。 */
  collapsed: boolean;
  /** 抽屉的可访问名与说明，走 `primitives.*`（英文，与上游逐字相同）。 */
  title: string;
  description: string;
  closeLabel: string;
}>();
const emit = defineEmits<{ "update:open": [boolean] }>();
</script>

<template>
  <Sheet
    v-if="props.narrow"
    :open="props.open"
    @update:open="emit('update:open', $event)"
  >
    <SheetContent
      side="left"
      :close-label="props.closeLabel"
      class="bg-sidebar text-sidebar-foreground border-sidebar-border w-72 gap-0 border-r p-0 [&>button]:hidden"
    >
      <SheetHeader class="sr-only">
        <SheetTitle>{{ props.title }}</SheetTitle>
        <SheetDescription>{{ props.description }}</SheetDescription>
      </SheetHeader>
      <div
        id="workspace-sidebar"
        data-slot="sidebar-inner"
        data-sidebar="sidebar"
        data-mobile="true"
        class="flex h-full w-full flex-col"
      >
        <slot />
      </div>
    </SheetContent>
  </Sheet>
  <!--
    宽屏那一支的类串与 wave 148 之前**逐字相同**（去掉的只有 `mobileOpen` 那两个
    三元分支）：这一轮改的是窄屏的模态语义，不该顺手动到桌面版面。
  -->
  <div
    v-else
    id="workspace-sidebar"
    data-slot="sidebar-inner"
    data-sidebar="sidebar"
    class="border-sidebar-border bg-sidebar text-sidebar-foreground fixed inset-y-0 left-0 z-50 flex h-screen shrink-0 -translate-x-full flex-col border-r transition-[width,transform] duration-200 md:static md:translate-x-0"
    :class="props.collapsed ? 'w-12' : 'w-64'"
  >
    <slot />
  </div>
</template>
