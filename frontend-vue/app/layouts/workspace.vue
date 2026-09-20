<script setup lang="ts">
/*
  【文件职责】     组合 workspace 侧栏、主内容与全局设置面板。
  【架构位置】     L3 application shell
  【主要导出】     默认 workspace layout
  【依赖关系】     ThreadSidebar · SettingsDialog · auth middleware
  【边界与注意】   DeerFlow 路由壳，不属于 L2。
*/
import { onUnmounted } from "vue";

import CommandPalette from "@/components/workspace/CommandPalette.vue";
import GatewayStatusBanner from "@/components/workspace/GatewayStatusBanner.vue";
import ModelLoadErrorBanner from "@/components/workspace/ModelLoadErrorBanner.vue";
import ThreadSidebar from "@/components/workspace/ThreadSidebar.vue";
import WorkspaceToaster from "@/components/workspace/WorkspaceToaster.vue";
import SettingsDialog from "@/components/workspace/settings/SettingsDialog.vue";
import { provideWorkspaceToast } from "@/core/workspace-shell/toast";

const toast = provideWorkspaceToast();
onUnmounted(() => toast.clear());
</script>

<template>
  <div class="bg-background text-foreground flex h-screen overflow-hidden">
    <ThreadSidebar />
    <main class="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <GatewayStatusBanner />
      <!-- 与上游 workspace-content.tsx 的顺序一致：Gateway 那条在上面。 -->
      <ModelLoadErrorBanner />
      <!--
        **内容区要有一个滚动口，不能是 `overflow-hidden`。**

        上游没有这一层：`SidebarInset` 不裁、`SidebarProvider` 也不裁，页面比视口高
        的时候**整页滚**（第五十二轮实测：`scheduled-tasks` 在 16px 下
        `docScrollable=1086`、32px 下 `4376`，滚到底之后末尾那颗控件
        `y 4403 → 27`、`inView false → true`）。本仓这一层原来写死 `overflow-hidden`，
        而上面 `main` 与根节点也各裁一次——**三层都不滚**，于是
        `scheduled-tasks` 的表单从「Prompt」那一行往下**一个像素都够不到**，
        `docScrollable` 恒为 0。⚠ 这不是 200% 文本才有的问题：**基线字号下就已经
        裁掉 1086px**，放大只是把它放大到 4375px。

        改成 `overflow-y-auto` 而不是照搬上游的「三层都不裁 + 侧栏 fixed + 占位 div」：
        判据是**渲染与行为一致，不是源码字面一致**。这一层是内容区、侧栏在它外面，
        所以滚起来的表现与上游相同——内容与页头一起走、侧栏钉住；而上游那套要求把
        侧栏从 `md:static` 改成 `fixed` 再补一个占位 div，动的是 58 个取样终态里
        **每一个**都画着的那根柱子，为了 2 个终态去动它不划算。
        ⚠ 残差是「滚动条挂在谁身上」（上游是 document、本仓是这一层）——
        **翻案判据**：哪天量到「滚动条位置/键盘滚动/滚动锚定」这三者任一有用户
        可感的差别，就回来照上游那套改。

        ⚠ **写 `overflow-y-auto` 不等于「横向没有滚动口」**：CSS 规定一轴不是
        `visible` 时，另一轴的 `visible` 会**计算成 `auto`**，所以这一层的
        `overflow-x` 实际也是 `auto`。这里仍然写 `overflow-y-auto` 而不是
        `overflow-auto`，是因为**意图**只有纵向——横向一旦真的溢出，
        `narrow-screen-overflow.spec.ts` 会把这一层当成一个**没登记的横滚容器**
        报出来（它的判据正是 `overflowX ∈ {auto,scroll}` 且 `scrollWidth > clientWidth`），
        那是**想要的**：横向溢出应该被看见并还掉，而不是被 `overflow-x: hidden` 盖住。
      -->
      <div class="relative min-h-0 flex-1 overflow-y-auto">
        <slot />
      </div>
    </main>
    <CommandPalette />
    <SettingsDialog />
    <WorkspaceToaster />
  </div>
</template>
