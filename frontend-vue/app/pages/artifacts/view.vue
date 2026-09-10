<script setup lang="ts">
/*
  【文件职责】     独立产物视窗路由：解析 query 里的目标，交给阅读器。
  【架构位置】     L4 页面
  【主要导出】     默认页面组件
  【依赖关系】     core/artifacts/viewer · ArtifactViewer
  【边界与注意】   **这条路径本身不标识任何东西**，目标整个在 query 里。
                   所以：
                   - 登录判定不能只看路径。它在 `middleware/auth.global.ts` 里，
                     按 query 指向谁的文件来决定要不要 session；未登录时
                     `buildLoginLocation(to.fullPath)` 会把**完整地址**（含 query）
                     带进回跳，否则登完回到默认工作区，用户再也找不回刚才那份文件。
                   - query 解析不出来时给一句明确的话，而不是空白页或
                     一个装作在加载的转圈。
*/
import { computed } from "vue";

import ArtifactViewer from "@/components/workspace/artifacts/ArtifactViewer.vue";
import {
  artifactViewerTitle,
  parseArtifactViewerQuery,
} from "@/core/artifacts/viewer";

definePageMeta({ layout: "viewer" });

const route = useRoute();
const { $i18n } = useNuxtApp();

const target = computed(() => parseArtifactViewerQuery(route.query));

useHead(() => ({ title: artifactViewerTitle(target.value?.filepath) }));
</script>

<template>
  <ArtifactViewer
    v-if="target"
    :filepath="target.filepath"
    :thread-id="target.threadId"
    :is-mock="target.isMock"
  />
  <!-- 上游这一屏用的是 `<main>`（app/artifacts/view/page.tsx），不是 div。 -->
  <main v-else class="flex h-screen items-center justify-center p-6">
    <p class="text-muted-foreground text-sm">
      {{ $i18n.t.value.artifactPreview.missingTarget }}
    </p>
  </main>
</template>
