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
      <div class="relative min-h-0 flex-1 overflow-hidden">
        <slot />
      </div>
    </main>
    <CommandPalette />
    <SettingsDialog />
    <WorkspaceToaster />
  </div>
</template>
