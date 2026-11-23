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
    <!--
      移动抽屉宽度受视口限制，并保留随文字缩放的遮罩关闭区域。
      18rem 在空间充足时保持原宽，避免大字号下抽屉和其菜单越过屏幕。
    -->
    <!--
      data-sidebar/data-slot/data-mobile 标记属于 Sheet 面板本身。
      workspace-sidebar 仍标记内层导航容器，供当前产品测试定位。
    -->
    <SheetContent
      side="left"
      :close-label="props.closeLabel"
      data-sidebar="sidebar"
      data-slot="sidebar"
      data-mobile="true"
      class="bg-sidebar text-sidebar-foreground border-sidebar-border w-[min(18rem,calc(100vw-3rem))] gap-0 border-r p-0 [&>button]:hidden"
    >
      <SheetHeader class="sr-only">
        <SheetTitle>{{ props.title }}</SheetTitle>
        <SheetDescription>{{ props.description }}</SheetDescription>
      </SheetHeader>
      <div
        id="workspace-sidebar"
        class="flex h-full w-full flex-col overflow-y-auto"
      >
        <slot />
      </div>
    </SheetContent>
  </Sheet>
  <!--
    定位、宽度和边框归外壳，原生滚动归不带定位/transform 的内层。
    rail 虽是 slot 后代，绝对定位仍以外壳为 containing block，与 React 一致；
    其贴边点击区域不会成为内层的横向滚动内容，也不需要裁切隐藏。
    低容量时内层仍可整壳滚动，导航主体至少容纳一个现有 h-8 菜单行。
    与 React 的 hidden md:block 外壳一致，CSS 在断点变化时立即隐藏桌面分支；
    matchMedia change 回调更新 narrow 之前，也不能让屏外导航仍参与焦点和可访问树。
  -->
  <div
    v-else
    data-slot="sidebar-container"
    class="border-sidebar-border text-sidebar-foreground fixed inset-y-0 left-0 z-50 hidden h-screen shrink-0 -translate-x-full border-r transition-[width,transform] duration-200 md:relative md:flex md:translate-x-0"
    :class="props.collapsed ? 'w-12' : 'w-64'"
  >
    <div
      id="workspace-sidebar"
      data-slot="sidebar-inner"
      data-sidebar="sidebar"
      class="bg-sidebar flex h-full w-full flex-col overflow-y-auto"
    >
      <slot />
    </div>
  </div>
</template>
