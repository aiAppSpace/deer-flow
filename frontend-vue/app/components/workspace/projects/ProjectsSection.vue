<!--
  【文件职责】     侧栏的项目区：标题栏（分组切换 + 新建）、分组列表、新建对话框。
  【架构位置】     L3 product UI
  【主要导出】     默认 ProjectsSection 组件
  【依赖关系】     composables/useProjects · composables/useThreads · core/settings/local ·
                   ui/sidebar · ui/dialog · ./ProjectThreadGroup · ./ArchivedProjectsGroup
  【边界与注意】   **分组是在客户端做的**：用已经取回的无限会话页按 `projectIdOfThread` 归位，
                   不为分组另发请求——项目内会话另有 `/api/projects/{id}/threads`，
                   那是项目详情页用的，侧栏用它会把一次侧栏渲染变成 N+1 次请求。

                   **路径上的活动会话即使超出显示上限也要参与分组**。否则一个正在看的
                   已归属会话会在平铺列表（被截断）和项目分组（没进来）里**都不出现**，
                   看起来就像会话丢了。这条与 `ThreadSidebar.vue` 的 `sidebarThreads` 同源。

                   `recentThreadId` 语义留给行组件；这里只负责把**全局最近**那条传下去，
                   不是分组内第一条——两者在跨项目时会给出不同的高亮。
-->
<script setup lang="ts">
import { FolderTree, List, Plus } from "lucide-vue-next";
import { computed, ref } from "vue";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
} from "@/components/ui/sidebar";
import ArchivedProjectsGroup from "@/components/workspace/projects/ArchivedProjectsGroup.vue";
import ProjectThreadGroup from "@/components/workspace/projects/ProjectThreadGroup.vue";
import { useProjectMutations, useProjects } from "@/composables/useProjects";
import { useThreads } from "@/composables/useThreads";
import { getLocalSettings, saveLocalSettings } from "@/core/settings/local";
import { useWorkspaceToast } from "@/core/workspace-shell/toast";
import { projectIdOfThread } from "@/core/threads/utils";
import type { AgentThread } from "@/core/threads/types";

const props = defineProps<{
  currentPath: string;
  activeThreadId: string | null;
  titleOf: (thread: AgentThread) => string;
  isActivePath: (path: string) => boolean;
  deletingThreadId: string | null;
}>();

const emit = defineEmits<{
  renameThread: [threadId: string];
  togglePinThread: [thread: AgentThread];
  deleteThread: [thread: AgentThread];
}>();

const { $i18n } = useNuxtApp();
const toast = useWorkspaceToast();
const threads = useThreads();
const { create } = useProjectMutations();

const displayMode = ref(getLocalSettings().projects.displayMode);
const groupByProject = computed(() => displayMode.value === "grouped");

function toggleDisplayMode() {
  const next = groupByProject.value ? "flat" : "grouped";
  displayMode.value = next;
  const settings = getLocalSettings();
  saveLocalSettings({
    ...settings,
    projects: { ...settings.projects, displayMode: next },
  });
}

const { data: activeProjects } = useProjects("active");
const { data: archivedProjects } = useProjects("archived");

/*
  与 ThreadSidebar 的 `sidebarThreads` 同一条规则：路径上的活动会话即使
  超出显示上限也要进来，否则它在平铺列表和项目分组里都不出现。
*/
const partitionableThreads = computed<readonly AgentThread[]>(() => {
  const activeId = props.activeThreadId;
  const displayed = threads.displayedThreads;
  if (!activeId || displayed.some((t) => t.thread_id === activeId)) {
    return displayed;
  }
  const active = threads.threads.find((t) => t.thread_id === activeId);
  return active ? [...displayed, active] : displayed;
});

const threadsByProject = computed(() => {
  const grouped = new Map<string, AgentThread[]>();
  for (const thread of partitionableThreads.value) {
    const projectId = projectIdOfThread(thread);
    if (projectId === null) continue;
    const bucket = grouped.get(projectId);
    if (bucket) bucket.push(thread);
    else grouped.set(projectId, [thread]);
  }
  return grouped;
});

const hasAnyProject = computed(
  () =>
    (activeProjects.value?.length ?? 0) > 0 ||
    (archivedProjects.value?.length ?? 0) > 0,
);

const createDialogOpen = ref(false);
const createName = ref("");
const isCreating = computed(() => create.isPending.value);

/** 输入法组合中按下的 Enter 是在选字，不是提交。 */
function onNameKeydown(event: KeyboardEvent) {
  if (event.key !== "Enter" || event.isComposing) return;
  event.preventDefault();
  void submitCreate();
}

async function submitCreate() {
  const name = createName.value.trim();
  if (!name || isCreating.value) return;
  try {
    await create.mutateAsync({ name });
    createDialogOpen.value = false;
    createName.value = "";
  } catch (error) {
    toast.error(
      error instanceof Error && error.message
        ? error.message
        : $i18n.t.value.projects.createFailed,
    );
  }
}
</script>

<template>
  <SidebarGroup>
    <SidebarGroupLabel class="justify-between pr-1">
      <span>{{ $i18n.t.value.projects.title }}</span>
      <span class="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          class="size-5 [&>svg]:size-3.5"
          :title="
            groupByProject
              ? $i18n.t.value.projects.switchToFlat
              : $i18n.t.value.projects.switchToGrouped
          "
          :aria-label="
            groupByProject
              ? $i18n.t.value.projects.switchToFlat
              : $i18n.t.value.projects.switchToGrouped
          "
          data-testid="projects-display-mode-toggle"
          @click="toggleDisplayMode"
        >
          <FolderTree v-if="groupByProject" />
          <List v-else />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          class="size-5 [&>svg]:size-3.5"
          :title="$i18n.t.value.projects.newProject"
          :aria-label="$i18n.t.value.projects.newProject"
          data-testid="projects-new-project-button"
          @click="createDialogOpen = true"
        >
          <Plus />
        </Button>
      </span>
    </SidebarGroupLabel>

    <SidebarGroupContent
      v-if="groupByProject && hasAnyProject"
      class="group-data-[collapsible=icon]:pointer-events-none group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0"
    >
      <SidebarMenu>
        <ProjectThreadGroup
          v-for="project in activeProjects ?? []"
          :key="project.id"
          :project="project"
          :threads="threadsByProject.get(project.id) ?? []"
          :current-path="props.currentPath"
          :title-of="props.titleOf"
          :is-active-path="props.isActivePath"
          :is-pinned="threads.isPinned"
          :deleting-thread-id="props.deletingThreadId"
          @rename-thread="emit('renameThread', $event)"
          @toggle-pin-thread="emit('togglePinThread', $event)"
          @delete-thread="emit('deleteThread', $event)"
        />
        <ArchivedProjectsGroup
          v-if="(archivedProjects?.length ?? 0) > 0"
          :label="$i18n.t.value.projects.archived"
          :projects="archivedProjects ?? []"
          :threads-by-project="threadsByProject"
          :current-path="props.currentPath"
          :title-of="props.titleOf"
          :is-active-path="props.isActivePath"
          :is-pinned="threads.isPinned"
          :deleting-thread-id="props.deletingThreadId"
          @rename-thread="emit('renameThread', $event)"
          @toggle-pin-thread="emit('togglePinThread', $event)"
          @delete-thread="emit('deleteThread', $event)"
        />
      </SidebarMenu>
    </SidebarGroupContent>

    <Dialog v-model:open="createDialogOpen">
      <DialogContent
        class="sm:max-w-[425px]"
        :close-label="$i18n.t.value.primitives.close"
      >
        <DialogHeader>
          <DialogTitle>{{ $i18n.t.value.projects.newProject }}</DialogTitle>
        </DialogHeader>
        <div class="py-4">
          <Input
            v-model="createName"
            :placeholder="$i18n.t.value.projects.namePlaceholder"
            @keydown="onNameKeydown"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" @click="createDialogOpen = false">
            {{ $i18n.t.value.common.cancel }}
          </Button>
          <Button
            :disabled="!createName.trim() || isCreating"
            @click="submitCreate"
          >
            {{ $i18n.t.value.projects.create }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </SidebarGroup>
</template>
