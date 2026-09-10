<!--
  【文件职责】     会话操作菜单里的「移动到项目」子菜单。
  【架构位置】     L3 product UI
  【主要导出】     默认 MoveToProjectMenu 组件
  【依赖关系】     ui/dropdown-menu · composables/useProjects · core/threads/utils
  【边界与注意】   **纯展示，自己不持有 mutation。** 这个子菜单会随下拉菜单一起卸载，
                   把 mutation 放在这里，失败回调会跟着组件一起没掉，错误就静默了
                   ——移动动作由常驻的会话行持有，这里只 emit。

                   **「新建项目」也只 emit，不在这里开对话框**：对话框必须挂在
                   下拉菜单**外面**，否则菜单一关它就被卸载了。

                   已经在当前项目里的那一项**点了不发请求**（与自身相同直接返回），
                   否则每次点开菜单点一下就白发一次移动请求。
-->
<script setup lang="ts">
import { Check, FolderInput, FolderMinus, Plus } from "lucide-vue-next";
import { computed } from "vue";

import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { useProjects } from "@/composables/useProjects";
import { projectIdOfThread } from "@/core/threads/utils";
import type { AgentThread } from "@/core/threads/types";

const props = defineProps<{ thread: AgentThread }>();
const emit = defineEmits<{
  newProject: [];
  moveProject: [projectId: string | null];
}>();

const { $i18n } = useNuxtApp();
const { data: projects } = useProjects("active");

const currentProjectId = computed(() => projectIdOfThread(props.thread));

function handleMove(projectId: string | null) {
  if (projectId === currentProjectId.value) return;
  emit("moveProject", projectId);
}
</script>

<template>
  <DropdownMenuSub>
    <DropdownMenuSubTrigger>
      <FolderInput class="text-muted-foreground" />
      <span>{{ $i18n.t.value.projects.moveToProject }}</span>
    </DropdownMenuSubTrigger>
    <DropdownMenuSubContent class="w-56">
      <DropdownMenuItem
        v-for="project in projects ?? []"
        :key="project.id"
        @select="handleMove(project.id)"
      >
        <Check
          v-if="project.id === currentProjectId"
          class="text-muted-foreground"
        />
        <span v-else aria-hidden="true" class="size-4 shrink-0" />
        <span class="truncate">{{ project.name }}</span>
      </DropdownMenuItem>
      <DropdownMenuSeparator v-if="(projects?.length ?? 0) > 0" />
      <DropdownMenuItem @select="emit('newProject')">
        <Plus class="text-muted-foreground" />
        <span>{{ $i18n.t.value.projects.newProject }}…</span>
      </DropdownMenuItem>
      <DropdownMenuItem
        v-if="currentProjectId !== null"
        @select="handleMove(null)"
      >
        <FolderMinus class="text-muted-foreground" />
        <span>{{ $i18n.t.value.projects.removeFromProject }}</span>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem disabled>
        <span class="text-xs">{{
          $i18n.t.value.projects.moveToProjectHint
        }}</span>
      </DropdownMenuItem>
    </DropdownMenuSubContent>
  </DropdownMenuSub>
</template>
