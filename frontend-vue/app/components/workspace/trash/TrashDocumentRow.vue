<script setup lang="ts">
import { computed, ref, onBeforeUnmount } from "vue";
import { Loader, RotateCcw, Trash2 } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTrashMutations } from "@/composables/useTrash";
import { useProjects } from "@/composables/useProjects";
import {
  RestoreConflictError,
  TrashNotFoundError,
  type TrashDocument,
} from "@/core/trash";
import {
  artifactFileIcon,
  formatArtifactBytes,
} from "@/core/artifacts/display";
import { useWorkspaceToast } from "@/core/workspace-shell/toast";
import { isRequestAborted } from "@/core/api/cancellation";
const props = defineProps<{ document: TrashDocument; retentionDays: number }>();
const emit = defineEmits<{ purge: [document: TrashDocument] }>();
const { $i18n } = useNuxtApp();
const toast = useWorkspaceToast();
const { restore } = useTrashMutations();
const pickerOpen = ref(false);
const projects = useProjects("active", { enabled: pickerOpen });
const activeProjects = computed(
  () =>
    projects.data.value?.filter((project) => project.status === "active") ?? [],
);
const daysLeft = computed(() =>
  Math.max(
    0,
    Math.ceil(
      (new Date(props.document.trashed_at).getTime() +
        props.retentionDays * 86_400_000 -
        Date.now()) /
        86_400_000,
    ),
  ),
);
let mounted = true;
onBeforeUnmount(() => {
  mounted = false;
});
async function restoreInto(projectId?: string) {
  if (restore.isPending.value) return;
  const documentId = props.document.id;
  try {
    const result = await restore.mutateAsync({
      documentId,
      ...(projectId === undefined ? {} : { projectId }),
    });
    if (!mounted || props.document.id !== documentId) return;
    toast.success(
      result.outcome === "merged"
        ? $i18n.t.value.trash.restoreMergedToast(result.document.name)
        : $i18n.t.value.trash.restoredToast(result.document.name),
    );
    pickerOpen.value = false;
  } catch (error) {
    if (isRequestAborted(error)) return;
    if (!mounted) return;
    if (error instanceof RestoreConflictError)
      toast.error($i18n.t.value.trash.restoreConflict);
    else if (error instanceof TrashNotFoundError && projectId === undefined)
      pickerOpen.value = true;
    else
      toast.error(
        error instanceof Error
          ? error.message
          : $i18n.t.value.trash.restoreFailed,
      );
  }
}
</script>
<template>
  <li
    class="flex flex-wrap items-center gap-3 rounded-md border p-3"
    :data-trash-document-id="document.id"
  >
    <component :is="artifactFileIcon(document.name)" class="size-5 shrink-0" />
    <div class="flex min-w-0 flex-1 flex-col gap-0.5">
      <span class="truncate text-sm font-medium">{{ document.name }}</span>
      <div class="text-muted-foreground text-xs">
        {{
          $i18n.t.value.trash.originProject(
            document.trash_origin?.project_name ??
              $i18n.t.value.trash.unknownProject,
          )
        }}
        · {{ formatArtifactBytes(document.size_bytes) }} ·
        {{ $i18n.t.value.trash.retentionLeft(daysLeft) }}
      </div>
    </div>
    <div class="flex max-w-full min-w-0 shrink-0 flex-wrap items-center gap-1">
      <Button
        variant="outline"
        size="sm"
        class="h-auto min-h-8 max-w-full [overflow-wrap:anywhere] whitespace-normal"
        :disabled="restore.isPending.value"
        @click="restoreInto()"
        ><RotateCcw class="size-4" />{{ $i18n.t.value.trash.restore }}</Button
      ><Button
        variant="ghost"
        size="sm"
        class="h-auto min-h-8 max-w-full [overflow-wrap:anywhere] whitespace-normal"
        @click="emit('purge', document)"
        ><Trash2 class="size-4" />{{
          $i18n.t.value.trash.deletePermanently
        }}</Button
      >
    </div>
    <Dialog v-model:open="pickerOpen"
      ><DialogContent
        class="sm:max-w-[425px]"
        :close-label="$i18n.t.value.primitives.close"
        ><DialogHeader
          ><DialogTitle>{{
            $i18n.t.value.trash.restorePickProjectTitle
          }}</DialogTitle
          ><DialogDescription>{{
            $i18n.t.value.trash.restorePickProjectHint
          }}</DialogDescription></DialogHeader
        >
        <div class="flex max-h-80 flex-col gap-1 overflow-auto">
          <p
            v-if="projects.isLoading.value"
            class="text-muted-foreground flex items-center gap-2 p-2 text-sm"
          >
            <Loader class="size-4 animate-spin" />{{
              $i18n.t.value.common.loading
            }}
          </p>
          <div v-else-if="projects.isError.value" role="alert">
            {{ $i18n.t.value.trash.restoreFailed
            }}<Button variant="ghost" @click="projects.refetch()">{{
              $i18n.t.value.trash.retry
            }}</Button>
          </div>
          <p
            v-else-if="activeProjects.length === 0"
            class="text-muted-foreground p-2 text-sm"
          >
            {{ $i18n.t.value.projects.empty }}
          </p>
          <Button
            v-for="project in activeProjects"
            :key="project.id"
            variant="ghost"
            class="justify-start"
            :disabled="restore.isPending.value"
            @click="restoreInto(project.id)"
            ><span class="truncate">{{ project.name }}</span></Button
          >
        </div>
        <DialogFooter
          ><Button variant="outline" @click="pickerOpen = false">{{
            $i18n.t.value.common.cancel
          }}</Button></DialogFooter
        ></DialogContent
      ></Dialog
    >
  </li>
</template>
