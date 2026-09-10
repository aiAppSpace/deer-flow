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
                   上游这条路由**原本没挂 Toaster**，于是同一个复制动作在那边毫无
                   反馈；2026-09-10 两边同改，上游补上 `<Toaster position="top-center" />`。

                   **这一层不许出现 landmark。** 上游 `app/artifacts/view/layout.tsx`
                   只有 provider，不产出任何元素；本仓原来在外层包了
                   `<main class="size-full">`，一处写法造成三种偏差，全被对照台账量到：

                     · 视窗里每个节点的深度都比上游多一层（heading / link / url 全中）；
                     · 多出一个 `main:` landmark；
                     · ArtifactViewer 自己的 `<header>` 落进了这个 `<main>` 里，
                       按 HTML 规范就**不再是 banner**——上游那边它是。

                   留下的这层 `<div>` 不进可访问性树（没有 role），三条都不会回来。
                   **不能干脆去掉它**：Nuxt 的 layout 必须单根（布局过渡要求），
                   `vue/no-multiple-template-root` 就是守这一条的。

                   `<main>` 由内容自己出：ArtifactViewer 里有一个（与上游同位置），
                   目标解析不出来时由 `pages/artifacts/view.vue` 给。
*/
import { onUnmounted } from "vue";

import WorkspaceToaster from "@/components/workspace/WorkspaceToaster.vue";
import { provideWorkspaceToast } from "@/core/workspace-shell/toast";

const toast = provideWorkspaceToast();
onUnmounted(() => toast.clear());
</script>

<template>
  <div class="bg-background text-foreground h-screen overflow-hidden">
    <slot />
    <WorkspaceToaster />
  </div>
</template>
