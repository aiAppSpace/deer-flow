<!--
  【文件职责】     侧栏底部的「已归档」分组，内含各归档项目。
  【架构位置】     L3 product UI
  【主要导出】     默认 ArchivedProjectsGroup 组件
  【依赖关系】     ui/sidebar · ui/collapsible · ./ProjectThreadGroup
  【边界与注意】   **默认收起**——与项目分组的默认展开相反。归档区平时不该占版面，
                   但也不能藏起来：它仍然渲染在列表末尾，展开后每个归档项目
                   复用同一个 ProjectThreadGroup，行为与活跃项目一致。
-->
<script setup lang="ts">
import { Archive, ChevronRight } from "lucide-vue-next";
import { ref } from "vue";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import ProjectThreadGroup from "@/components/workspace/projects/ProjectThreadGroup.vue";
import type { Project } from "@/core/projects";
import type { AgentThread } from "@/core/threads/types";

const props = defineProps<{
  label: string;
  projects: readonly Project[];
  threadsByProject: ReadonlyMap<string, readonly AgentThread[]>;
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

const open = ref(false);
</script>

<template>
  <Collapsible v-model:open="open">
    <SidebarMenuItem>
      <CollapsibleTrigger as-child>
        <SidebarMenuButton>
          <Archive />
          <span class="min-w-0 truncate">{{ props.label }}</span>
          <ChevronRight
            class="ml-auto transition-transform [[data-state=open]>&]:rotate-90"
          />
        </SidebarMenuButton>
      </CollapsibleTrigger>
    </SidebarMenuItem>
    <CollapsibleContent>
      <SidebarMenu class="border-sidebar-border ml-4 border-l pl-2">
        <ProjectThreadGroup
          v-for="project in props.projects"
          :key="project.id"
          :project="project"
          :threads="props.threadsByProject.get(project.id) ?? []"
          :current-path="props.currentPath"
          :title-of="props.titleOf"
          :is-active-path="props.isActivePath"
          :is-pinned="props.isPinned"
          :deleting-thread-id="props.deletingThreadId"
          @rename-thread="emit('renameThread', $event)"
          @toggle-pin-thread="emit('togglePinThread', $event)"
          @delete-thread="emit('deleteThread', $event)"
        />
      </SidebarMenu>
    </CollapsibleContent>
  </Collapsible>
</template>
