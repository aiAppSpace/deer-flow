<script setup lang="ts">
import { computed, ref, onBeforeUnmount } from "vue";
import {
  Archive,
  FileText,
  Loader,
  Paperclip,
  Trash2,
  Upload,
} from "lucide-vue-next";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ProjectDocumentPreviewDialog from "./ProjectDocumentPreviewDialog.vue";
import ProjectDocumentAttachDialog from "./ProjectDocumentAttachDialog.vue";
import ProjectConversationFiles from "./ProjectConversationFiles.vue";
import {
  useInfiniteProjectDocuments,
  useProjectsConfig,
  useProjectDocumentMutations,
} from "@/composables/useProjectDocuments";
import {
  PROJECTS_CONFIG_DEFAULT,
  urlOfProjectDocumentContent,
  type Project,
  type ProjectThread,
  type ProjectDocument,
} from "@/core/projects";
import {
  artifactFileIcon,
  formatArtifactBytes,
} from "@/core/artifacts/display";
import { formatTimeAgo } from "@/core/utils/datetime";
import { useWorkspaceToast } from "@/core/workspace-shell/toast";
import { isRequestAborted } from "@/core/api/cancellation";
const props = defineProps<{
  project: Project;
  threads: readonly ProjectThread[];
}>();
const { $i18n } = useNuxtApp();
const toast = useWorkspaceToast();
const projectId = props.project.id;
const query = useInfiniteProjectDocuments(projectId);
const config = useProjectsConfig();
const { upload, remove } = useProjectDocumentMutations(projectId);
const documents = computed(
  () => query.data.value?.pages.flatMap((page) => page.documents) ?? [],
);
const total = computed(() => query.data.value?.pages.at(-1)?.total ?? 0);
const retention = computed(
  () =>
    config.data.value?.trash_retention_days ??
    PROJECTS_CONFIG_DEFAULT.trash_retention_days,
);
const archived = computed(() => props.project.status === "archived");
const fileInput = ref<HTMLInputElement | null>(null);
const dragging = ref(false);
const uploading = ref(false);
const previewDoc = ref<ProjectDocument | null>(null);
const attachDoc = ref<ProjectDocument | null>(null);
const trashDoc = ref<ProjectDocument | null>(null);
let mounted = true;
onBeforeUnmount(() => {
  mounted = false;
});
function provenance(document: ProjectDocument) {
  if (!document.source_thread_id || !document.source_kind) return null;
  const thread = props.threads.find(
    (item) => item.thread_id === document.source_thread_id,
  );
  return $i18n.t.value.projects.documentFromThread(
    thread?.display_name?.trim() || $i18n.t.value.projects.untitled,
    document.source_kind === "upload"
      ? $i18n.t.value.projects.documentKindUpload
      : $i18n.t.value.projects.documentKindOutput,
  );
}
async function uploadFiles(files: readonly File[]) {
  if (archived.value || uploading.value || files.length === 0) return;
  uploading.value = true;
  try {
    for (const file of files) {
      if (!mounted || archived.value) break;
      try {
        await upload.mutateAsync({ file });
      } catch (error) {
        if (isRequestAborted(error)) return;
        if (mounted)
          toast.error(
            error instanceof Error
              ? error.message
              : $i18n.t.value.projects.uploadDocumentFailed,
          );
      }
    }
  } finally {
    if (mounted) uploading.value = false;
  }
}
function onFiles(event: Event) {
  const target = event.target as HTMLInputElement;
  const files = Array.from(target.files ?? []);
  target.value = "";
  void uploadFiles(files);
}
function onDragOver(event: DragEvent) {
  if (!archived.value) {
    event.preventDefault();
    dragging.value = true;
  }
}
function onDrop(event: DragEvent) {
  if (archived.value) return;
  event.preventDefault();
  dragging.value = false;
  void uploadFiles(Array.from(event.dataTransfer?.files ?? []));
}
async function trash() {
  const snapshot = trashDoc.value;
  if (!snapshot || archived.value || remove.isPending.value) return;
  try {
    await remove.mutateAsync(snapshot.id);
    if (mounted && trashDoc.value === snapshot) trashDoc.value = null;
  } catch (error) {
    if (isRequestAborted(error)) return;
    if (mounted)
      toast.error(
        error instanceof Error
          ? error.message
          : $i18n.t.value.projects.deleteDocumentFailed,
      );
  }
}
</script>
<template>
  <section class="flex flex-col gap-6">
    <div
      v-if="archived"
      role="status"
      class="text-muted-foreground flex items-center gap-2 rounded-md border border-dashed p-3 text-sm"
      data-testid="project-documents-archived-banner"
    >
      <Archive class="size-4 shrink-0" />{{
        $i18n.t.value.projects.archivedDocumentsBanner
      }}
    </div>
    <div
      class="flex flex-col gap-3 rounded-lg"
      :class="{
        'outline-primary outline-2 outline-dashed': dragging && !archived,
      }"
      data-testid="project-documents-shelf"
      @dragover="onDragOver"
      @dragleave="dragging = false"
      @drop="onDrop"
    >
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex flex-col">
          <h2 class="text-muted-foreground text-sm font-medium">
            {{ $i18n.t.value.projects.documentsShelf }}
          </h2>
          <p v-if="!archived" class="text-muted-foreground text-xs">
            {{ $i18n.t.value.projects.documentsShelfHint }}
          </p>
        </div>
        <div class="flex max-w-full min-w-0 flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            class="h-auto min-h-8 max-w-full [overflow-wrap:anywhere] whitespace-normal"
            as-child
            ><NuxtLink to="/workspace/trash"
              ><Trash2 class="size-4" />{{
                $i18n.t.value.projects.viewTrash
              }}</NuxtLink
            ></Button
          ><template v-if="!archived"
            ><input
              ref="fileInput"
              type="file"
              multiple
              class="hidden"
              data-testid="project-documents-upload-input"
              @change="onFiles"
            /><Button
              variant="outline"
              size="sm"
              class="h-auto min-h-8 max-w-full [overflow-wrap:anywhere] whitespace-normal"
              :disabled="uploading"
              @click="fileInput?.click()"
              ><Loader v-if="uploading" class="size-4 animate-spin" /><Upload
                v-else
                class="size-4"
              />{{
                uploading
                  ? $i18n.t.value.projects.uploadingDocuments
                  : $i18n.t.value.projects.uploadDocuments
              }}</Button
            ></template
          >
        </div>
      </div>
      <div
        v-if="query.isError.value"
        role="alert"
        class="p-4 text-center text-sm"
      >
        <p>{{ $i18n.t.value.projects.documentsLoadFailed }}</p>
        <Button variant="outline" size="sm" @click="query.refetch()">{{
          $i18n.t.value.trash.retry
        }}</Button>
      </div>
      <Empty
        v-else-if="!query.isLoading.value && documents.length === 0"
        class="border py-12"
        ><EmptyHeader
          ><EmptyMedia variant="icon"><FileText /></EmptyMedia
          ><EmptyTitle>{{
            $i18n.t.value.projects.documentsEmptyTitle
          }}</EmptyTitle
          ><EmptyDescription>{{
            $i18n.t.value.projects.documentsEmptyHint
          }}</EmptyDescription
          ><EmptyDescription>{{
            $i18n.t.value.projects.interimMemoryNotice
          }}</EmptyDescription></EmptyHeader
        ></Empty
      >
      <ul v-else class="flex w-full flex-col gap-2">
        <li
          v-for="document in documents"
          :key="document.id"
          class="flex flex-wrap items-center gap-3 rounded-md border p-3"
          :data-document-id="document.id"
        >
          <component
            :is="artifactFileIcon(document.name)"
            class="size-5 shrink-0"
          />
          <div
            v-if="document.content_missing"
            class="flex min-w-0 flex-1 items-center gap-2"
          >
            <span class="truncate text-sm">{{ document.name }}</span
            ><Badge variant="destructive" data-testid="content-missing-badge">{{
              $i18n.t.value.projects.contentMissing
            }}</Badge>
          </div>
          <div v-else class="flex min-w-0 flex-1 flex-col gap-0.5">
            <div class="flex min-w-0 flex-wrap items-center gap-2">
              <span class="truncate text-sm font-medium">{{
                document.name
              }}</span
              ><Badge
                v-if="provenance(document)"
                variant="secondary"
                class="max-w-full shrink-0 [overflow-wrap:anywhere] whitespace-normal"
                >{{ provenance(document) }}</Badge
              >
            </div>
            <div class="text-muted-foreground text-xs">
              {{ formatArtifactBytes(document.size_bytes) }} ·
              {{ formatTimeAgo(document.updated_at, $i18n.locale.value) }}
            </div>
          </div>
          <div
            class="flex max-w-full min-w-0 shrink-0 flex-wrap items-center gap-1"
          >
            <template v-if="!document.content_missing"
              ><Button
                variant="ghost"
                size="sm"
                class="h-auto min-h-8 max-w-full [overflow-wrap:anywhere] whitespace-normal"
                @click="previewDoc = document"
                >{{ $i18n.t.value.common.preview }}</Button
              ><Button
                variant="ghost"
                size="sm"
                class="h-auto min-h-8 max-w-full [overflow-wrap:anywhere] whitespace-normal"
                as-child
                ><a
                  :href="
                    urlOfProjectDocumentContent(projectId, document.id, {
                      download: true,
                    })
                  "
                  target="_blank"
                  rel="noopener noreferrer"
                  >{{ $i18n.t.value.common.download }}</a
                ></Button
              ><Button
                variant="ghost"
                size="sm"
                class="h-auto min-h-8 max-w-full [overflow-wrap:anywhere] whitespace-normal"
                @click="attachDoc = document"
                ><Paperclip class="size-4" />{{
                  $i18n.t.value.projects.attachToThread
                }}</Button
              ></template
            ><Button
              v-if="!archived"
              variant="ghost"
              size="sm"
              class="h-auto min-h-8 max-w-full [overflow-wrap:anywhere] whitespace-normal"
              @click="trashDoc = document"
              ><Trash2 class="size-4" />{{
                $i18n.t.value.projects.moveDocumentToTrash
              }}</Button
            >
          </div>
        </li>
      </ul>
      <div
        v-if="!query.isError.value && documents.length > 0"
        class="flex flex-col items-center gap-1"
      >
        <p class="text-muted-foreground text-xs">
          {{ $i18n.t.value.common.showingOf(documents.length, total) }}
        </p>
        <Button
          v-if="query.hasNextPage.value"
          variant="ghost"
          size="sm"
          :disabled="query.isFetchingNextPage.value"
          class="text-xs"
          data-testid="project-documents-load-more"
          @click="query.fetchNextPage()"
          >{{
            query.isFetchingNextPage.value
              ? $i18n.t.value.chats.loadingMore
              : $i18n.t.value.common.loadMore
          }}</Button
        >
      </div>
    </div>
    <div role="none" class="bg-border h-px w-full shrink-0" />
    <ProjectConversationFiles :project="project" />
    <ProjectDocumentPreviewDialog
      :project-id="projectId"
      :document="previewDoc"
      @close="previewDoc = null"
    />
    <ProjectDocumentAttachDialog
      :project-id="projectId"
      :document="attachDoc"
      @close="attachDoc = null"
    />
    <Dialog
      :open="trashDoc !== null"
      @update:open="
        (open) => {
          if (!open) trashDoc = null;
        }
      "
      ><DialogContent
        class="sm:max-w-[425px]"
        :close-label="$i18n.t.value.primitives.close"
        ><DialogHeader
          ><DialogTitle>{{
            $i18n.t.value.projects.moveDocumentToTrashTitle
          }}</DialogTitle
          ><DialogDescription>{{
            $i18n.t.value.projects.moveDocumentToTrashConfirm(
              trashDoc?.name ?? "",
              retention,
            )
          }}</DialogDescription></DialogHeader
        ><DialogFooter
          ><Button variant="outline" @click="trashDoc = null">{{
            $i18n.t.value.common.cancel
          }}</Button
          ><Button
            variant="destructive"
            :disabled="remove.isPending.value || archived"
            @click="trash"
            >{{ $i18n.t.value.projects.moveDocumentToTrash }}</Button
          ></DialogFooter
        ></DialogContent
      ></Dialog
    >
  </section>
</template>
