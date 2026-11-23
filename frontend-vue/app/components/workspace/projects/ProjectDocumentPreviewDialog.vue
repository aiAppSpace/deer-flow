<script setup lang="ts">
import { computed, shallowRef, ref, watch } from "vue";
import { Loader, FileText } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ArtifactPreview from "@/components/workspace/artifacts/ArtifactPreview.vue";
import {
  fetchProjectDocumentPreview,
  urlOfProjectDocumentContent,
  type ProjectDocument,
  type ProjectDocumentPreview,
} from "@/core/projects";
import { classifyArtifact, getTabularDelimiter } from "@/core/artifacts/policy";
import { formatArtifactBytes } from "@/core/artifacts/display";
const props = defineProps<{
  projectId: string;
  document: ProjectDocument | null;
}>();
const emit = defineEmits<{ close: [] }>();
const { $i18n } = useNuxtApp();
const preview = shallowRef<ProjectDocumentPreview | null>(null);
const failed = ref(false);
watch(
  () => [props.projectId, props.document?.id] as const,
  async ([projectId, documentId], _old, onCleanup) => {
    const controller = new AbortController();
    let current = true;
    onCleanup(() => {
      current = false;
      controller.abort();
    });
    preview.value = null;
    failed.value = false;
    if (!documentId) return;
    try {
      const result = await fetchProjectDocumentPreview(projectId, documentId, {
        signal: controller.signal,
      });
      if (current) preview.value = result;
    } catch {
      if (current) failed.value = true;
    }
  },
  { immediate: true },
);
const policy = computed(() => classifyArtifact(props.document?.name ?? ""));
const previewable = computed(
  () =>
    policy.value.kind === "text" &&
    (policy.value.language === "markdown" ||
      policy.value.language === "html" ||
      getTabularDelimiter(policy.value.language) !== null),
);
const contentUrl = computed(() =>
  props.document
    ? urlOfProjectDocumentContent(props.projectId, props.document.id)
    : "",
);
const downloadUrl = computed(() =>
  props.document
    ? urlOfProjectDocumentContent(props.projectId, props.document.id, {
        download: true,
      })
    : "",
);
</script>
<template>
  <Dialog
    :open="document !== null"
    @update:open="
      (open) => {
        if (!open) emit('close');
      }
    "
  >
    <DialogContent
      class="flex h-[70vh] flex-col sm:max-w-[720px]"
      :close-label="$i18n.t.value.primitives.close"
    >
      <DialogHeader
        ><DialogTitle class="truncate">{{
          document?.name
        }}</DialogTitle></DialogHeader
      >
      <div
        v-if="preview?.kind === 'text' && preview.truncated"
        class="border-border bg-muted/40 flex shrink-0 items-center justify-between gap-3 rounded-md border px-4 py-2 text-sm"
        data-testid="project-document-preview-truncated"
      >
        <span class="text-muted-foreground">{{
          $i18n.t.value.artifactPreview.limited(
            formatArtifactBytes(preview.previewBytes) ?? "1 MiB",
            formatArtifactBytes(preview.totalBytes),
          )
        }}</span>
        <Button size="sm" variant="outline" as-child
          ><a :href="contentUrl" target="_blank" rel="noopener noreferrer">{{
            $i18n.t.value.artifactPreview.loadFullFile
          }}</a></Button
        >
      </div>
      <div class="min-h-0 flex-1 overflow-auto rounded-md border">
        <div
          v-if="failed"
          class="text-muted-foreground p-4 text-sm"
          role="alert"
        >
          {{ $i18n.t.value.projects.documentsLoadFailed }}
        </div>
        <div
          v-else-if="preview === null"
          class="text-muted-foreground flex items-center gap-2 p-4 text-sm"
        >
          <Loader class="size-4 animate-spin" />{{
            $i18n.t.value.common.loading
          }}
        </div>
        <iframe
          v-else-if="preview.kind === 'binary'"
          class="size-full border-0"
          sandbox=""
          :src="contentUrl"
          :title="document?.name"
          data-testid="project-document-preview-frame"
        />
        <div v-else-if="preview.kind === 'pdf'" class="flex size-full flex-col">
          <div
            class="flex shrink-0 items-center justify-end gap-1 border-b px-2 py-1"
          >
            <Button variant="ghost" size="sm" as-child
              ><a
                :href="contentUrl"
                target="_blank"
                rel="noopener noreferrer"
                data-testid="project-document-preview-open-tab"
                >{{ $i18n.t.value.common.openInNewWindow }}</a
              ></Button
            >
            <Button variant="ghost" size="sm" as-child
              ><a
                :href="downloadUrl"
                target="_blank"
                rel="noopener noreferrer"
                >{{ $i18n.t.value.common.download }}</a
              ></Button
            >
          </div>
          <iframe
            class="min-h-0 flex-1 border-0"
            :src="contentUrl"
            :title="document?.name"
            data-testid="project-document-preview-frame"
          />
        </div>
        <div
          v-else-if="preview.kind === 'unsupported'"
          class="flex size-full items-center justify-center p-6"
        >
          <div class="flex max-w-sm flex-col items-center gap-4 text-center">
            <FileText class="text-muted-foreground size-12" />
            <p class="text-muted-foreground text-sm">
              {{ $i18n.t.value.projects.previewUnsupported }}
            </p>
            <Button as-child
              ><a
                :href="downloadUrl"
                target="_blank"
                rel="noopener noreferrer"
                >{{ $i18n.t.value.common.download }}</a
              ></Button
            >
          </div>
        </div>
        <ArtifactPreview
          v-else-if="previewable"
          :policy="policy"
          :filename="document?.name ?? ''"
          :content="preview.content"
          view-mode="preview"
          :html-preview-allowed="!preview.truncated"
          :truncated="preview.truncated"
          :identity="`${projectId}:${document?.id}`"
        />
        <pre v-else class="p-4 text-xs whitespace-pre-wrap">{{
          preview.content
        }}</pre>
      </div>
    </DialogContent>
  </Dialog>
</template>
