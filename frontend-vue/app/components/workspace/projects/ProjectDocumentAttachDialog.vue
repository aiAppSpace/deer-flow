<script setup lang="ts">
import { computed, onBeforeUnmount } from "vue";
import { Loader } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useThreads } from "@/composables/useThreads";
import { useProjectDocumentMutations } from "@/composables/useProjectDocuments";
import type { ProjectDocument } from "@/core/projects";
import { isRequestAborted } from "@/core/api/cancellation";
import { stageProjectAttachment } from "@/core/projects/composer-attach";
import {
  isThreadArchived,
  pathOfThread,
  titleOfThread,
} from "@/core/threads/utils";
import type { AgentThread } from "@/core/threads/types";
import { useWorkspaceToast } from "@/core/workspace-shell/toast";
const props = defineProps<{
  projectId: string;
  document: ProjectDocument | null;
}>();
const emit = defineEmits<{ close: [] }>();
const { $i18n } = useNuxtApp();
const router = useRouter();
const toast = useWorkspaceToast();
// Parent keys this section on the project id; every operation retains its source owner.
const projectId = props.projectId;
const { attach } = useProjectDocumentMutations(projectId);
const threads = useThreads({
  archived: false,
  enabled: () => props.document !== null,
});
const writableThreads = computed(() =>
  threads.threads.filter((thread) => !isThreadArchived(thread)),
);
let mounted = true;
onBeforeUnmount(() => {
  mounted = false;
});
async function choose(thread: AgentThread) {
  const document = props.document;
  if (!document || attach.isPending.value || isThreadArchived(thread)) return;
  const threadId = thread.thread_id;
  try {
    const result = await attach.mutateAsync({
      documentId: document.id,
      threadId,
    });
    stageProjectAttachment(threadId, result);
    if (!mounted || props.document?.id !== document.id) return;
    toast.success($i18n.t.value.projects.attachedToThread(result.filename));
    emit("close");
    await router.push(pathOfThread(thread));
  } catch (error) {
    if (isRequestAborted(error)) return;
    if (mounted)
      toast.error(
        error instanceof Error
          ? error.message
          : $i18n.t.value.projects.attachFailed,
      );
  }
}
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
      class="sm:max-w-[425px]"
      :close-label="$i18n.t.value.primitives.close"
    >
      <DialogHeader
        ><DialogTitle>{{
          $i18n.t.value.projects.attachDialogTitle
        }}</DialogTitle
        ><DialogDescription>{{
          $i18n.t.value.projects.attachDialogHint
        }}</DialogDescription></DialogHeader
      >
      <div class="flex max-h-80 flex-col gap-1 overflow-auto">
        <div
          v-if="threads.loading"
          class="text-muted-foreground flex items-center gap-2 p-2 text-sm"
        >
          <Loader class="size-4 animate-spin" />{{
            $i18n.t.value.common.loading
          }}
        </div>
        <div
          v-else-if="threads.error"
          role="alert"
          class="text-muted-foreground p-2 text-sm"
        >
          {{ $i18n.t.value.projects.attachFailed
          }}<Button variant="ghost" @click="threads.loadInitial(true)">{{
            $i18n.t.value.trash.retry
          }}</Button>
        </div>
        <p
          v-else-if="writableThreads.length === 0"
          class="text-muted-foreground p-2 text-sm"
        >
          {{ $i18n.t.value.projects.attachNoThreads }}
        </p>
        <Button
          v-for="thread in writableThreads"
          :key="thread.thread_id"
          variant="ghost"
          class="justify-start"
          :disabled="attach.isPending.value"
          @click="choose(thread)"
          ><span class="truncate">{{
            titleOfThread(thread, $i18n.t.value.pages.untitled)
          }}</span></Button
        >
        <Button
          v-if="threads.hasMore"
          variant="ghost"
          size="sm"
          class="self-center text-xs"
          :disabled="threads.loadingMore"
          data-testid="attach-thread-load-more"
          @click="threads.loadMore()"
          >{{
            threads.loadingMore
              ? $i18n.t.value.chats.loadingMore
              : $i18n.t.value.common.loadMore
          }}</Button
        >
      </div>
      <DialogFooter
        ><Button variant="outline" @click="emit('close')">{{
          $i18n.t.value.common.cancel
        }}</Button></DialogFooter
      >
    </DialogContent>
  </Dialog>
</template>
