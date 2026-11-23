<script setup lang="ts">
import { Archive, RotateCcw, Trash2 } from "lucide-vue-next";
import { computed, ref, watch } from "vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useProjectMutations } from "@/composables/useProjects";
import type { Project } from "@/core/projects";
import { isRequestAborted } from "@/core/api/cancellation";
import { useWorkspaceToast } from "@/core/workspace-shell/toast";
const props = defineProps<{ project: Project }>();
const router = useRouter();
const { $i18n } = useNuxtApp();
const toast = useWorkspaceToast();
const { patch, archive, restore, remove } = useProjectMutations();

const name = ref(props.project.name);
let synced = props.project.name;
watch(
  () => props.project.name,
  (value) => {
    if (name.value === synced) name.value = value;
    synced = value;
  },
);

const isArchived = computed(() => props.project?.status === "archived");
const canSave = computed(
  () =>
    name.value.trim().length > 0 &&
    name.value.trim() !== props.project?.name &&
    !patch.isPending.value,
);
const isDeleteDialogOpen = ref(false);

function messageOf(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

async function handleRename() {
  if (!canSave.value || !props.project) return;
  try {
    await patch.mutateAsync({
      id: props.project.id,
      input: { name: name.value.trim() },
    });
  } catch (error) {
    if (isRequestAborted(error)) return;
    toast.error(messageOf(error, $i18n.t.value.common.renameFailed));
  }
}

function onNameKeydown(event: KeyboardEvent) {
  if (event.key !== "Enter" || event.isComposing) return;
  event.preventDefault();
  void handleRename();
}

async function handleArchiveToggle() {
  if (!props.project) return;
  const run = isArchived.value ? restore : archive;
  const fallback = isArchived.value
    ? $i18n.t.value.projects.restoreFailed
    : $i18n.t.value.projects.archiveFailed;
  try {
    await run.mutateAsync(props.project.id);
  } catch (error) {
    if (isRequestAborted(error)) return;
    toast.error(messageOf(error, fallback));
  }
}

async function handleDelete() {
  if (!props.project) return;
  try {
    await remove.mutateAsync(props.project.id);
    await router.push("/workspace/chats");
  } catch (error) {
    if (isRequestAborted(error)) return;
    toast.error(messageOf(error, $i18n.t.value.projects.deleteFailed));
  }
}
</script>
<template>
  <section class="flex flex-col gap-4">
    <h2 class="text-muted-foreground text-sm font-medium">
      {{ $i18n.t.value.projects.settings }}
    </h2>
    <div class="flex flex-col gap-2">
      <label for="project-name-input" class="text-muted-foreground text-xs">
        {{ $i18n.t.value.projects.namePlaceholder }}
      </label>
      <div class="flex items-center gap-2">
        <Input
          id="project-name-input"
          v-model="name"
          :placeholder="$i18n.t.value.projects.namePlaceholder"
          @keydown="onNameKeydown"
        />
        <Button variant="outline" :disabled="!canSave" @click="handleRename">
          {{ $i18n.t.value.common.save }}
        </Button>
      </div>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        class="h-auto min-h-9 max-w-full whitespace-normal"
        :disabled="archive.isPending.value || restore.isPending.value"
        @click="handleArchiveToggle"
      >
        <component :is="isArchived ? RotateCcw : Archive" />
        {{
          isArchived
            ? $i18n.t.value.projects.restore
            : $i18n.t.value.projects.archive
        }}
      </Button>
      <Button
        variant="destructive"
        class="h-auto min-h-9 max-w-full whitespace-normal"
        @click="isDeleteDialogOpen = true"
      >
        <Trash2 />
        {{ $i18n.t.value.projects.deleteProject }}
      </Button>
    </div>
  </section>
  <Dialog v-model:open="isDeleteDialogOpen">
    <DialogContent
      class="sm:max-w-[425px]"
      :close-label="$i18n.t.value.primitives.close"
    >
      <DialogHeader>
        <DialogTitle>
          {{ $i18n.t.value.projects.deleteProject }}
        </DialogTitle>
        <DialogDescription>
          {{ $i18n.t.value.projects.deleteProjectConfirm }}
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" @click="isDeleteDialogOpen = false">
          {{ $i18n.t.value.common.cancel }}
        </Button>
        <Button
          variant="destructive"
          :disabled="remove.isPending.value"
          @click="handleDelete"
        >
          {{ $i18n.t.value.common.delete }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
