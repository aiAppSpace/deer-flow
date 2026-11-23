<script setup lang="ts">
import { computed, ref, onBeforeUnmount } from "vue";
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
import {
  useInfiniteProjectThreadFiles,
  useProjectDocumentMutations,
} from "@/composables/useProjectDocuments";
import type { Project, ProjectThreadFile } from "@/core/projects";
import {
  artifactFileIcon,
  formatArtifactBytes,
} from "@/core/artifacts/display";
import { resolveArtifactOpenURL } from "@/core/artifacts/viewer";
import { pathOfThread } from "@/core/threads/utils";
import { formatTimeAgo } from "@/core/utils/datetime";
import { useWorkspaceToast } from "@/core/workspace-shell/toast";
import { isRequestAborted } from "@/core/api/cancellation";
const props = defineProps<{ project: Project }>();
const { $i18n } = useNuxtApp();
const toast = useWorkspaceToast();
const projectId = props.project.id;
const query = useInfiniteProjectThreadFiles(projectId, { file_limit: 200 });
const { promote } = useProjectDocumentMutations(projectId);
const groups = computed(
  () => query.data.value?.pages.flatMap((page) => page.groups) ?? [],
);
const archived = computed(() => props.project.status === "archived");
const selected = ref<{ threadId: string; file: ProjectThreadFile } | null>(
  null,
);
const shelfName = ref("");
let mounted = true;
onBeforeUnmount(() => {
  mounted = false;
});
function choose(threadId: string, file: ProjectThreadFile) {
  selected.value = { threadId, file };
  shelfName.value = file.name;
}
function previewUrl(threadId: string, file: ProjectThreadFile) {
  return resolveArtifactOpenURL({
    threadId,
    filepath: `/mnt/user-data/${file.kind === "upload" ? "uploads" : "outputs"}/${file.name}`,
  });
}
async function save() {
  const snapshot = selected.value;
  const name = shelfName.value.trim();
  if (!snapshot || !name || archived.value || promote.isPending.value) return;
  try {
    const result = await promote.mutateAsync({
      thread_id: snapshot.threadId,
      kind: snapshot.file.kind,
      name: snapshot.file.name,
      ...(name !== snapshot.file.name ? { shelf_name: name } : {}),
    });
    if (!mounted || selected.value !== snapshot) return;
    toast.success($i18n.t.value.projects.savedToProject(result.document.name));
    selected.value = null;
  } catch (error) {
    if (isRequestAborted(error)) return;
    if (mounted)
      toast.error(
        error instanceof Error
          ? error.message
          : $i18n.t.value.projects.saveToProjectFailed,
      );
  }
}
</script>
<template>
  <div class="flex flex-col gap-3" data-testid="project-thread-files">
    <h2 class="text-muted-foreground text-sm font-medium">
      {{ $i18n.t.value.projects.conversationFiles }}
    </h2>
    <div
      v-if="query.isError.value"
      role="alert"
      class="p-4 text-center text-sm"
    >
      <p>{{ $i18n.t.value.projects.threadFilesLoadFailed }}</p>
      <Button variant="outline" size="sm" @click="query.refetch()">{{
        $i18n.t.value.trash.retry
      }}</Button>
    </div>
    <p
      v-else-if="!query.isLoading.value && groups.length === 0"
      class="text-muted-foreground p-4 text-sm"
    >
      {{ $i18n.t.value.projects.conversationFilesEmpty }}
    </p>
    <div v-else class="flex flex-col gap-4">
      <div
        v-for="group in groups"
        :key="group.thread_id"
        class="flex flex-col gap-1"
      >
        <div class="text-sm font-medium">
          {{ group.display_name?.trim() || $i18n.t.value.projects.untitled }}
        </div>
        <ul class="flex w-full flex-col gap-1">
          <li
            v-for="file in group.files"
            :key="`${file.kind}:${file.name}`"
            class="flex flex-wrap items-center gap-3 rounded-md border p-2"
          >
            <component
              :is="artifactFileIcon(file.name)"
              class="size-5 shrink-0"
            />
            <div class="flex min-w-0 flex-1 flex-col">
              <span class="truncate text-sm">{{ file.name }}</span
              ><span class="text-muted-foreground text-xs"
                >{{ formatArtifactBytes(file.size_bytes) }} ·
                {{ formatTimeAgo(file.modified_at, $i18n.locale.value) }}</span
              >
            </div>
            <div
              class="flex max-w-full min-w-0 shrink-0 flex-wrap items-center gap-1"
            >
              <Button
                variant="ghost"
                size="sm"
                class="h-auto min-h-8 max-w-full [overflow-wrap:anywhere] whitespace-normal"
                as-child
                ><a
                  :href="previewUrl(group.thread_id, file)"
                  target="_blank"
                  rel="noopener noreferrer"
                  >{{ $i18n.t.value.common.preview }}</a
                ></Button
              ><Button
                v-if="!archived"
                variant="ghost"
                size="sm"
                class="h-auto min-h-8 max-w-full [overflow-wrap:anywhere] whitespace-normal"
                @click="choose(group.thread_id, file)"
                >{{ $i18n.t.value.projects.saveToProject }}</Button
              >
            </div>
          </li>
        </ul>
        <p
          v-if="group.truncated"
          class="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs"
          role="status"
          data-testid="thread-files-truncated"
        >
          {{ $i18n.t.value.projects.threadFilesTruncated(group.files.length)
          }}<NuxtLink
            :to="pathOfThread(group.thread_id)"
            class="underline underline-offset-4"
            >{{ $i18n.t.value.projects.threadFilesBrowseInThread }}</NuxtLink
          >
        </p>
      </div>
    </div>
    <Button
      v-if="query.hasNextPage.value"
      variant="ghost"
      size="sm"
      class="self-center text-xs"
      :disabled="query.isFetchingNextPage.value"
      data-testid="project-thread-files-load-more"
      @click="query.fetchNextPage()"
      >{{
        query.isFetchingNextPage.value
          ? $i18n.t.value.chats.loadingMore
          : $i18n.t.value.common.loadMore
      }}</Button
    >
    <Dialog
      :open="selected !== null"
      @update:open="
        (open) => {
          if (!open) selected = null;
        }
      "
    >
      <DialogContent
        class="sm:max-w-[425px]"
        :close-label="$i18n.t.value.primitives.close"
      >
        <DialogHeader
          ><DialogTitle>{{ $i18n.t.value.projects.saveToProject }}</DialogTitle
          ><DialogDescription>{{
            selected?.file.name
          }}</DialogDescription></DialogHeader
        >
        <div class="flex flex-col gap-2">
          <label
            for="project-shelf-name"
            class="text-muted-foreground text-xs"
            >{{ $i18n.t.value.projects.shelfNameLabel }}</label
          ><Input
            id="project-shelf-name"
            v-model="shelfName"
            @keydown.enter="save"
          />
        </div>
        <DialogFooter
          ><Button variant="outline" @click="selected = null">{{
            $i18n.t.value.common.cancel
          }}</Button
          ><Button
            :disabled="!shelfName.trim() || promote.isPending.value || archived"
            @click="save"
            >{{ $i18n.t.value.projects.saveToProject }}</Button
          ></DialogFooter
        >
      </DialogContent>
    </Dialog>
  </div>
</template>
