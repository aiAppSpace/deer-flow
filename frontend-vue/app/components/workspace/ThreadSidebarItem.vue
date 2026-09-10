<!--
  【文件职责】     侧栏里的一条会话行：链接 + 渠道图标/徽标 + 固定标记 + 操作菜单。
  【架构位置】     L3 product UI
  【主要导出】     默认 ThreadSidebarItem 组件
  【依赖关系】     ui/sidebar(MenuItem/MenuButton) · ThreadChannelIcon/Badge · ThreadActionsMenu
  【边界与注意】   **从 `ThreadSidebar.vue` 的内联标记抽出来的**，一字不改地保留原有取舍：

                   标题包在 `min-w-0 truncate` 的 span 里、链接本身是 `h-8 ... p-2 pr-8` 的行。
                   这不是随手写的——此前标题是链接的裸文本、操作菜单是同一行的 flex 兄弟，
                   于是「会话标题」这个可视元素量出来是整行（撑满 203px、高 32px、前景色），
                   而 React 那份是文字宽度、20px 高、muted 色。对照台账上就差在这里。

                   抽出来的原因是**项目分组也要渲染会话行**：再复制一份标记，
                   上面那段取舍就会在两处各漂各的。
-->
<script setup lang="ts">
import { Pin } from "lucide-vue-next";

import ThreadActionsMenu from "@/components/workspace/ThreadActionsMenu.vue";
import ThreadChannelBadge from "@/components/workspace/ThreadChannelBadge.vue";
import ThreadChannelIcon from "@/components/workspace/ThreadChannelIcon.vue";
import { SidebarMenuItem } from "@/components/ui/sidebar";
import { channelSourceOfThread, pathOfThread } from "@/core/threads/utils";
import type { AgentThread } from "@/core/threads/types";

const props = defineProps<{
  thread: AgentThread;
  title: string;
  isActive: boolean;
  pinned: boolean;
  deleting: boolean;
}>();

defineEmits<{
  rename: [];
  togglePin: [];
  delete: [];
  newProjectForThread: [];
  moveToProject: [projectId: string | null];
}>();
</script>

<template>
  <SidebarMenuItem>
    <NuxtLink
      data-slot="sidebar-menu-button"
      data-sidebar="menu-button"
      :to="pathOfThread(props.thread)"
      :data-active="props.isActive"
      class="text-muted-foreground hover:bg-sidebar-accent data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground peer/menu-button flex h-8 w-full min-w-0 items-center gap-2 overflow-hidden rounded-md p-2 pr-8 text-left text-sm whitespace-nowrap"
    >
      <ThreadChannelIcon :source="channelSourceOfThread(props.thread)" />
      <Pin
        v-if="props.pinned"
        aria-hidden="true"
        class="text-muted-foreground size-3.5 shrink-0"
      />
      <span class="min-w-0 truncate">{{ props.title }}</span>
      <ThreadChannelBadge
        :source="channelSourceOfThread(props.thread)"
        class="ml-auto h-5 max-w-14 shrink-0 px-1.5 text-[10px]"
      />
    </NuxtLink>
    <ThreadActionsMenu
      :thread="props.thread"
      :pinned="props.pinned"
      :deleting="props.deleting"
      @rename="$emit('rename')"
      @toggle-pin="$emit('togglePin')"
      @delete="$emit('delete')"
      @new-project-for-thread="$emit('newProjectForThread')"
      @move-to-project="$emit('moveToProject', $event)"
    />
  </SidebarMenuItem>
</template>
