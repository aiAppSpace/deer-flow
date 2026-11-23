<script setup lang="ts">
import { computed, ref, onBeforeUnmount } from "vue";
import { Loader, Trash2 } from "lucide-vue-next";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import TrashDocumentRow from "./TrashDocumentRow.vue";
import {
  useInfiniteTrashDocuments,
  useTrashMutations,
} from "@/composables/useTrash";
import { useProjectsConfig } from "@/composables/useProjectDocuments";
import { PROJECTS_CONFIG_DEFAULT } from "@/core/projects";
import type { TrashDocument } from "@/core/trash";
import { useWorkspaceToast } from "@/core/workspace-shell/toast";
import { isRequestAborted } from "@/core/api/cancellation";
const { $i18n } = useNuxtApp();
const toast = useWorkspaceToast();
const query = useInfiniteTrashDocuments();
const { purge, empty } = useTrashMutations();
const config = useProjectsConfig();
const documents = computed(
  () => query.data.value?.pages.flatMap((page) => page.documents) ?? [],
);
const total = computed(() => query.data.value?.pages.at(-1)?.total ?? 0);
const retention = computed(
  () =>
    config.data.value?.trash_retention_days ??
    PROJECTS_CONFIG_DEFAULT.trash_retention_days,
);
const purgeDoc = ref<TrashDocument | null>(null);
const emptyOpen = ref(false);
let mounted = true;
onBeforeUnmount(() => {
  mounted = false;
});
async function purgeOne() {
  const snapshot = purgeDoc.value;
  if (!snapshot || purge.isPending.value) return;
  try {
    await purge.mutateAsync(snapshot.id);
    if (mounted && purgeDoc.value === snapshot) purgeDoc.value = null;
  } catch (error) {
    if (isRequestAborted(error)) return;
    if (mounted)
      toast.error(
        error instanceof Error
          ? error.message
          : $i18n.t.value.trash.purgeFailed,
      );
  }
}
async function emptyAll() {
  if (empty.isPending.value) return;
  try {
    await empty.mutateAsync();
    if (mounted) emptyOpen.value = false;
  } catch (error) {
    if (isRequestAborted(error)) return;
    if (mounted)
      toast.error(
        error instanceof Error
          ? error.message
          : $i18n.t.value.trash.emptyTrashFailed,
      );
  }
}
</script>
<template>
  <div
    class="mx-auto flex w-full max-w-[var(--container-width-md)] flex-col gap-6 p-6 pt-8"
  >
    <header class="flex flex-wrap items-center justify-between gap-2">
      <h1 class="text-lg font-semibold">{{ $i18n.t.value.trash.title }}</h1>
      <Button
        v-if="documents.length > 0"
        variant="destructive"
        data-testid="trash-empty-button"
        size="sm"
        @click="emptyOpen = true"
        ><Trash2 class="size-4" />{{ $i18n.t.value.trash.emptyTrash }}</Button
      >
    </header>
    <div
      v-if="query.isError.value"
      role="alert"
      class="p-4 text-center text-sm"
    >
      <p>{{ $i18n.t.value.trash.loadFailed }}</p>
      <Button variant="outline" size="sm" @click="query.refetch()">{{
        $i18n.t.value.trash.retry
      }}</Button>
    </div>
    <div
      v-else-if="query.isLoading.value"
      class="text-muted-foreground flex items-center justify-center gap-2 py-16 text-sm"
    >
      <Loader class="size-4 animate-spin" />{{ $i18n.t.value.common.loading }}
    </div>
    <Empty v-else-if="documents.length === 0" class="border py-16"
      ><EmptyHeader
        ><EmptyMedia variant="icon"><Trash2 /></EmptyMedia
        ><EmptyTitle>{{ $i18n.t.value.trash.title }}</EmptyTitle
        ><EmptyDescription>{{
          $i18n.t.value.trash.empty
        }}</EmptyDescription></EmptyHeader
      ></Empty
    >
    <ul v-else class="flex w-full flex-col gap-2">
      <TrashDocumentRow
        v-for="document in documents"
        :key="document.id"
        :document="document"
        :retention-days="retention"
        @purge="purgeDoc = $event"
      />
    </ul>
    <div
      v-if="
        !query.isError.value && !query.isLoading.value && documents.length > 0
      "
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
        data-testid="trash-load-more"
        @click="query.fetchNextPage()"
        >{{
          query.isFetchingNextPage.value
            ? $i18n.t.value.chats.loadingMore
            : $i18n.t.value.common.loadMore
        }}</Button
      >
    </div>
    <Dialog
      :open="purgeDoc !== null"
      @update:open="
        (open) => {
          if (!open) purgeDoc = null;
        }
      "
      ><DialogContent
        class="sm:max-w-[425px]"
        :close-label="$i18n.t.value.primitives.close"
        ><DialogHeader
          ><DialogTitle>{{
            $i18n.t.value.trash.deletePermanentlyTitle
          }}</DialogTitle
          ><DialogDescription>{{
            $i18n.t.value.trash.deletePermanentlyConfirm(purgeDoc?.name ?? "")
          }}</DialogDescription></DialogHeader
        ><DialogFooter
          ><Button variant="outline" @click="purgeDoc = null">{{
            $i18n.t.value.common.cancel
          }}</Button
          ><Button
            variant="destructive"
            :disabled="purge.isPending.value"
            @click="purgeOne"
            >{{ $i18n.t.value.trash.deletePermanently }}</Button
          ></DialogFooter
        ></DialogContent
      ></Dialog
    >
    <Dialog v-model:open="emptyOpen"
      ><DialogContent
        class="sm:max-w-[425px]"
        :close-label="$i18n.t.value.primitives.close"
        ><DialogHeader
          ><DialogTitle>{{ $i18n.t.value.trash.emptyTrashTitle }}</DialogTitle
          ><DialogDescription>{{
            $i18n.t.value.trash.emptyTrashConfirm(total)
          }}</DialogDescription></DialogHeader
        ><DialogFooter
          ><Button variant="outline" @click="emptyOpen = false">{{
            $i18n.t.value.common.cancel
          }}</Button
          ><Button
            variant="destructive"
            :disabled="empty.isPending.value"
            @click="emptyAll"
            >{{ $i18n.t.value.trash.emptyTrash }}</Button
          ></DialogFooter
        ></DialogContent
      ></Dialog
    >
  </div>
</template>
