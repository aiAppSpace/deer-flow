<!--
  【文件职责】     「新建项目并把当前会话移进去」的对话框。
  【架构位置】     L3 product UI
  【主要导出】     默认 ProjectMoveDialog 组件
  【依赖关系】     ui/dialog · composables/useProjects · core/workspace-shell/toast
  【边界与注意】   **必须挂在会话的下拉菜单外面**（与 DropdownMenu 同级），
                   菜单一关就卸载，挂在里面的话对话框还没打开就没了。

                   创建与移动是**两步、各自报错**：项目建出来了但移动失败时，
                   项目是真的建成了——这时候报「创建失败」会让人以为白做了，
                   所以两步用两条不同的提示。

                   关闭时清空输入：留着上次的名字，下次打开会让人以为是草稿。
-->
<script setup lang="ts">
import { computed, ref, watch } from "vue";

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
  useMoveThreadToProject,
  useProjectMutations,
} from "@/composables/useProjects";
import { useWorkspaceToast } from "@/core/workspace-shell/toast";

const props = defineProps<{ threadId: string | null }>();
const emit = defineEmits<{ close: [] }>();

const { $i18n } = useNuxtApp();
const toast = useWorkspaceToast();
const { create } = useProjectMutations();
const moveToProject = useMoveThreadToProject();

const name = ref("");
const isCreating = computed(() => create.isPending.value);
const open = computed({
  get: () => props.threadId !== null,
  set: (value: boolean) => {
    if (!value) emit("close");
  },
});

watch(open, (isOpen) => {
  if (!isOpen) name.value = "";
});

function onKeydown(event: KeyboardEvent) {
  if (event.key !== "Enter" || event.isComposing) return;
  event.preventDefault();
  void submit();
}

async function submit() {
  const trimmed = name.value.trim();
  const threadId = props.threadId;
  if (!trimmed || !threadId || isCreating.value) return;

  let project: Awaited<ReturnType<typeof create.mutateAsync>>;
  try {
    project = await create.mutateAsync({ name: trimmed });
  } catch (error) {
    toast.error(
      error instanceof Error && error.message
        ? error.message
        : $i18n.t.value.projects.createFailed,
    );
    return;
  }

  emit("close");
  try {
    await moveToProject.mutateAsync({ threadId, projectId: project.id });
  } catch (error) {
    // 项目已经建成了，别报「创建失败」。
    toast.error(
      error instanceof Error && error.message
        ? error.message
        : $i18n.t.value.projects.moveFailed,
    );
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      class="sm:max-w-[425px]"
      :close-label="$i18n.t.value.primitives.close"
    >
      <DialogHeader>
        <DialogTitle>{{ $i18n.t.value.projects.newProject }}</DialogTitle>
      </DialogHeader>
      <div class="py-4">
        <Input
          v-model="name"
          :placeholder="$i18n.t.value.projects.namePlaceholder"
          @keydown="onKeydown"
        />
      </div>
      <DialogFooter>
        <Button variant="outline" @click="emit('close')">
          {{ $i18n.t.value.common.cancel }}
        </Button>
        <Button :disabled="!name.trim() || isCreating" @click="submit">
          {{ $i18n.t.value.projects.create }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
