<!--
  【文件职责】     侧栏菜单键：普通按钮，或用 `asChild` 把样式套到链接上；
                   收起成图标条时用 `tooltip` 把名字说出来。
  【架构位置】     L2 primitive
  【主要导出】     SidebarMenuButton
  【依赖关系】     ./menu-button-variants · ../tooltip · reka-ui(Primitive) · lib/utils(cn)
  【边界与注意】   `asChild` 用 reka 的 `Primitive as-child` 实现——上游用的是 radix `Slot`，
                   两边都是「把属性与样式合并到唯一子元素上」，这是本仓移植 primitive 的既定做法。

                   `data-size` / `data-active` **必须原样输出**：动作键靠
                   `peer-data-[size=…]/menu-button` 定位，高亮靠 `data-[active=true]`，
                   只写 class 不写这两个属性会让它们同时失效。

                   ~~**没有移植上游的 `tooltip` 参数**：上游在侧栏收成图标条时用它显示名字，
                   而本仓的侧栏外壳（ThreadSidebarShell）没有图标条形态，
                   传进来也没有触发条件。要加图标条时连这个参数一起补。~~
                   **⚠️ 这段理由从收起态做出来的那一轮起就是假的，第二十四轮推翻并补上了 `tooltip`。**
                   `ThreadSidebarShell.vue` 的外壳写着 `props.collapsed ? 'w-12' : 'w-64'`
                   ——48px 的图标条就是图标条形态。「传进来也没有触发条件」因此不成立：
                   本仓当时给那四颗导航键打的是**原生 `title`**
                   （`ThreadSidebar.vue` 的 `:title="collapsed ? … : undefined"`），
                   于是收起之后本仓弹一个原生气泡、上游**什么都没有**（实测，见提交说明）。
                   **留原文是因为它解释了那四个 `title` 是怎么来的。**

                   **`tooltipHidden` 是本仓多出来的一个参数，不是随手加的。**
                   上游在这里读 `useSidebar().state`（`sidebar.tsx:518` 的
                   `hidden={state !== "collapsed" || isMobile}`）自己判断收没收起，
                   而本仓的 `useWorkspaceSidebar` 在 `@/composables` 下，
                   **L2 禁止 import 它**（`tests/architecture.test.ts` 的 `l2ForbiddenImports`）。
                   所以收没收起由调用方传进来，其余结构逐条照抄上游：
                   **没传 `tooltip` 就是一颗光按钮**（上游 `if (!tooltip) return button`）、
                   传了就包一层 Tooltip，内容 `side="right" align="center"`，
                   并且靠 **`hidden` 而不是 `v-if`** 关掉——两边在展开态也都带着这层包装，
                   换成 `v-if` 会让展开态凭空多出一处结构差异。

                   **`delay-duration="0"` 是照抄上游、不是随手填的。** 上游这一层有
                   两套延迟：`workspace/tooltip.tsx` 那个包装是 500ms，而**侧栏这一支是 0**
                   ——`ui/tooltip.tsx` 的默认值就是 0，`ui/sidebar.tsx` 的 `SidebarProvider`
                   还另外写了一遍 `<TooltipProvider delayDuration={0}>`。本仓
                   `ui/tooltip/TooltipProvider.vue` 的默认值是 **500**（对应上游那套 500 的用法），
                   所以这里必须显式压回 0，否则同一颗键在两个应用里一个立刻弹、一个等半秒。
                   **不要改全局默认**：那会把上游确实是 500ms 的那几处也一起改掉。

                   两个分支共用同一份 `buttonProps`：要复用的是**属性集合**，
                   把 `<Primitive>` 抄两遍才是这个仓库一直在修的那种漂移。

                   **但 `data-slot` / `data-sidebar` 必须留在模板里当字面量，不要收进
                   `buttonProps`。** 它们是这颗 primitive 的**身份**，而仓里有两把尺子
                   靠**源文本**认这个身份：`tests/guards/handwritten-primitive-slots.test.ts`
                   从 `ui/` 的源码里收「哪些 slot 名是 primitive 声明的」，
                   再查调用点有没有手抄；`tests/unit/workspace-shell/sidebar-skeleton.test.ts`
                   查「骨架用的每个 slot 都由对应 primitive 带上」。
                   第二十四轮收进对象之后**渲染结果照样有、源文本里没有了**，两条同时红
                   ——这正是仓里记了三次的「换尺子不换判词」那个形状（坑 131）。
                   当时的选择是**把身份写回字面量**而不是改尺子：
                   收进对象只省两行，而代价是那条「primitive 的 slot 只属于 primitive」
                   的判据**对这颗 primitive 整个失效**，且失效时没有任何迹象。
-->
<script setup lang="ts">
import { computed } from "vue";
import { Primitive } from "reka-ui";

import { cn } from "@/lib/utils";

import { Tooltip, TooltipContent, TooltipTrigger } from "../tooltip";
import {
  sidebarMenuButtonVariants,
  type SidebarMenuButtonVariants,
} from "./menu-button-variants";

const props = withDefaults(
  defineProps<{
    asChild?: boolean;
    isActive?: boolean;
    variant?: SidebarMenuButtonVariants["variant"];
    size?: SidebarMenuButtonVariants["size"];
    /** 收起成图标条时显示的名字。不传就没有这层包装（同上游 `if (!tooltip) return button`）。 */
    tooltip?: string;
    /** 上游读 `state !== "collapsed" || isMobile`；见文件头，这里由调用方传。 */
    tooltipHidden?: boolean;
    class?: string;
  }>(),
  {
    asChild: false,
    isActive: false,
    variant: "default",
    size: "default",
    tooltip: undefined,
    tooltipHidden: false,
    class: undefined,
  },
);

const buttonProps = computed(() => ({
  as: props.asChild ? undefined : "button",
  asChild: props.asChild,
  "data-size": props.size,
  "data-active": props.isActive,
  class: cn(
    sidebarMenuButtonVariants({ variant: props.variant, size: props.size }),
    props.class,
  ),
}));
</script>

<template>
  <Tooltip v-if="props.tooltip" :delay-duration="0">
    <TooltipTrigger as-child>
      <Primitive
        v-bind="buttonProps"
        data-slot="sidebar-menu-button"
        data-sidebar="menu-button"
        ><slot
      /></Primitive>
    </TooltipTrigger>
    <TooltipContent side="right" align="center" :hidden="props.tooltipHidden">{{
      props.tooltip
    }}</TooltipContent>
  </Tooltip>
  <Primitive
    v-else
    v-bind="buttonProps"
    data-slot="sidebar-menu-button"
    data-sidebar="menu-button"
    ><slot
  /></Primitive>
</template>
