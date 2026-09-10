<script setup lang="ts">
/*
  【文件职责】     为独立产物视窗提供无 workspace 控件的整窗外壳。
  【架构位置】     L3
  【主要导出】     viewer layout
  【依赖关系】     WorkspaceToaster · workspace-shell/toast
  【边界与注意】   **故意不挂在 workspace 之下**：这条路由是用户从产物面板另开的一扇
                   窗，要的是内容本身，不是侧栏、会话列表和设置入口。

                   **和 showcase 长得像，但不合并。** 两者的演化方向不同——showcase
                   是公开只读案例、以后可能加导航或版权尾栏；这里是单文件视窗、
                   以后可能加打印样式或窗口尺寸记忆。绑在一起的话，其中一个的改动
                   会无声地改掉另一个。

                   toast viewport 要挂：markdown 预览下面那块引用来源面板
                   （CitationSourcesPanel）调 `useWorkspaceToast()`，
                   没有 owner 时它一挂上就抛错——showcase 那层踩过同一个坑。
*/
import { onUnmounted } from "vue";

import WorkspaceToaster from "@/components/workspace/WorkspaceToaster.vue";
import { provideWorkspaceToast } from "@/core/workspace-shell/toast";

const toast = provideWorkspaceToast();
onUnmounted(() => toast.clear());
</script>

<template>
  <div class="bg-background text-foreground h-screen overflow-hidden">
    <main class="size-full">
      <slot />
    </main>
    <WorkspaceToaster />
  </div>
</template>
