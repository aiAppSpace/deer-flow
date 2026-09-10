<!--
  【文件职责】     侧栏里的一个项目分组：项目链接 + 可折叠的成员会话列表。
  【架构位置】     L3 product UI
  【主要导出】     默认 ProjectThreadGroup 组件
  【依赖关系】     ui/sidebar · ui/collapsible · ThreadSidebarItem · core/threads/thread-branch-tree
  【边界与注意】   **默认展开**（与归档分组的默认收起相反）。
                   会话先过 `flattenThreadBranches` 再渲染：分支会话要缩进挂在父会话下面，
                   而那个函数保证畸形谱系不会让任何一条会话消失。
                   折叠触发器的 `aria-label` 用项目名——一屏里可能有多个分组，
                   都叫「展开」的话读屏用户分不出是哪一个。
-->
<script setup lang="ts">
import { ChevronRight, Folder } from "lucide-vue-next";
import { computed, ref } from "vue";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import ThreadSidebarItem from "@/components/workspace/ThreadSidebarItem.vue";
import type { Project } from "@/core/projects";
import { flattenThreadBranches } from "@/core/threads/thread-branch-tree";
import type { AgentThread } from "@/core/threads/types";

const props = defineProps<{
  project: Project;
  threads: readonly AgentThread[];
  currentPath: string;
  titleOf: (thread: AgentThread) => string;
  isActivePath: (path: string) => boolean;
  isPinned: (thread: AgentThread) => boolean;
  deletingThreadId: string | null;
}>();

const emit = defineEmits<{
  renameThread: [threadId: string];
  togglePinThread: [thread: AgentThread];
  deleteThread: [thread: AgentThread];
}>();

const open = ref(true);
const href = computed(() => `/workspace/projects/${props.project.id}`);
const branchEntries = computed(() => flattenThreadBranches([...props.threads]));
</script>

<template>
  <Collapsible v-model:open="open">
    <SidebarMenuItem>
      <SidebarMenuButton as-child :is-active="props.currentPath === href">
        <NuxtLink :to="href" :title="props.project.name">
          <Folder />
          <span class="min-w-0 truncate">{{ props.project.name }}</span>
        </NuxtLink>
      </SidebarMenuButton>
      <CollapsibleTrigger as-child>
        <SidebarMenuAction
          :aria-label="props.project.name"
          class="[&>svg]:transition-transform [&[data-state=open]>svg]:rotate-90"
        >
          <ChevronRight />
        </SidebarMenuAction>
      </CollapsibleTrigger>
    </SidebarMenuItem>
    <CollapsibleContent>
      <SidebarMenu class="border-sidebar-border ml-4 border-l pl-2">
        <ThreadSidebarItem
          v-for="entry in branchEntries"
          :key="entry.thread.thread_id"
          :thread="entry.thread"
          :title="props.titleOf(entry.thread)"
          :is-active="
            props.isActivePath(`/workspace/chats/${entry.thread.thread_id}`)
          "
          :pinned="props.isPinned(entry.thread)"
          :deleting="props.deletingThreadId === entry.thread.thread_id"
          @rename="emit('renameThread', entry.thread.thread_id)"
          @toggle-pin="emit('togglePinThread', entry.thread)"
          @delete="emit('deleteThread', entry.thread)"
        />
      </SidebarMenu>
    </CollapsibleContent>
  </Collapsible>
</template>
