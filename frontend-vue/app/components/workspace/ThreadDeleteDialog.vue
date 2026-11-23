<!--
  【文件职责】     稳定持有会话删除确认、异步删除与失败重试的目标快照。
  【架构位置】     L3 product host
  【主要导出】     默认 ThreadDeleteDialog
  【依赖关系】     useThreads · workspace query owner · ui/dialog
  【边界与注意】   不依赖虚拟列表行存活；删除中禁止关闭，成功后才重置当前会话。
-->
<script setup lang="ts">
import { nextTick, onScopeDispose, ref, watch } from "vue";
import { isNavigationFailure, NavigationFailureType } from "vue-router";
import { useQueryClient } from "@tanstack/vue-query";
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
import { captureWorkspaceQueryOwner } from "@/core/auth/workspace-queries";
import { pathOfThread, titleOfThread } from "@/core/threads/utils";
import type { AgentThread } from "@/core/threads/types";
import { useWorkspaceToast } from "@/core/workspace-shell/toast";
import type { NewChatFocusHandoff } from "@/core/threads/new-chat";

export type ThreadDeleteTarget = {
  thread: AgentThread;
  recentThreadId?: string;
};
const props = defineProps<{ target: ThreadDeleteTarget | null }>();
const emit = defineEmits<{ close: [] }>();
const { $i18n } = useNuxtApp();
const route = useRoute();
const router = useRouter();
const client = useQueryClient();
const threads = useThreads({ enabled: false });
const toast = useWorkspaceToast();
let active = true;
let completed = false;
let completeFocus: (() => void) | undefined;
let stopPending: (() => void) | undefined;
onScopeDispose(() => {
  active = false;
  completeFocus = undefined;
  stopPending?.();
  stopPending = undefined;
});
const pending = ref(false);
const cancel = ref<InstanceType<typeof Button> | null>(null);
function focusCancel() {
  void nextTick(() => {
    if (active && props.target && !completed) cancel.value?.$el?.focus();
  });
}
watch(
  () => props.target,
  (target) => {
    if (target) {
      completed = false;
      completeFocus = undefined;
    }
  },
);
function finishClose(event: Event) {
  if (!completed) return;
  // A successful deletion cannot restore its removed row's trigger.
  event.preventDefault();
  const focus = completeFocus;
  completeFocus = undefined;
  const host = event.target;
  const current = document.activeElement;
  // A newer user interaction outside the closing dialog owns its own focus.
  if (
    current !== document.body &&
    !(host instanceof HTMLElement && host.contains(current))
  )
    return;
  focus?.();
}
function dismiss(open: boolean) {
  if (!open && !pending.value) emit("close");
}
function preventPending(event: Event) {
  if (pending.value) event.preventDefault();
}
async function confirm() {
  if (!props.target || pending.value) return;
  const { thread, recentThreadId } = props.target;
  const ownsWorkspace = captureWorkspaceQueryOwner(client);
  const owns = () => active && ownsWorkspace();
  const routeAtStart = route.fullPath ?? route.path;
  let conversationRetired = false;
  let replacing = false;
  let observedReplacement = false;
  const retireConversation = () => {
    conversationRetired = true;
  };
  const stopRouteWatch = watch(
    () => route.fullPath ?? route.path,
    (next, previous) => {
      // Permit only our single expected commit; keep observing newer routes
      // throughout the await, including leave-and-return to the same URL.
      if (
        replacing &&
        !observedReplacement &&
        previous === routeAtStart &&
        next === nextPath
      ) {
        observedReplacement = true;
        return;
      }
      retireConversation();
    },
    { flush: "sync" },
  );
  globalThis.addEventListener("deerflow:new-chat", retireConversation);
  stopPending = () => {
    stopRouteWatch();
    globalThis.removeEventListener("deerflow:new-chat", retireConversation);
  };
  const agentName =
    typeof route.params.agent_name === "string"
      ? route.params.agent_name
      : null;
  const nextPath = pathOfThread("new", {
    agent_name:
      typeof route.params.agent_name === "string"
        ? route.params.agent_name
        : undefined,
  });
  const current =
    thread.thread_id === route.params.thread_id ||
    pathOfThread(thread) === route.path ||
    (route.path === nextPath && recentThreadId === thread.thread_id);
  pending.value = true;
  try {
    await threads.remove(thread.thread_id);
    if (!owns()) return;
    // A completed delete must not reset a conversation entered while it ran.
    if (
      current &&
      !conversationRetired &&
      (route.fullPath ?? route.path) === routeAtStart
    ) {
      replacing = true;
      const failure = await router.replace(nextPath);
      replacing = false;
      // Vue Router resolves cancelled/aborted navigation rather than throwing.
      // An already-/new duplicate is the intentional same-route draft reset.
      if (
        failure &&
        !(
          routeAtStart === nextPath &&
          isNavigationFailure(failure, NavigationFailureType.duplicated)
        )
      )
        retireConversation();
      await nextTick();
      if (!owns()) return;
      if (!conversationRetired && (route.fullPath ?? route.path) === nextPath) {
        // Navigation retires the previous submission owner. Only now mint the
        // new draft and capture its completion, including a same-/new reset.
        // Our own reset is completion, not a competing new-chat command.
        stopPending();
        stopPending = undefined;
        globalThis.dispatchEvent(
          new CustomEvent<NewChatFocusHandoff>("deerflow:new-chat", {
            detail: {
              agentName,
              claim: (focus) => {
                completeFocus = () => {
                  if (owns() && (route.fullPath ?? route.path) === nextPath)
                    focus();
                };
              },
            },
          }),
        );
      }
    }
    completed = true;
    emit("close");
  } catch (error) {
    if (owns())
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : $i18n.t.value.chats.deleteFailed,
      );
  } finally {
    pending.value = false;
    stopPending?.();
    stopPending = undefined;
    if (owns() && props.target && !completed && !conversationRetired)
      focusCancel();
  }
}
</script>
<template>
  <Dialog :open="target !== null" @update:open="dismiss">
    <DialogContent
      :close-label="$i18n.t.value.primitives.close"
      :show-close="!pending"
      @open-auto-focus="
        $event.preventDefault();
        focusCancel();
      "
      @escape-key-down="preventPending"
      @interact-outside="preventPending"
      @close-auto-focus="finishClose"
    >
      <DialogHeader>
        <DialogTitle>{{ $i18n.t.value.chats.deleteChat }}</DialogTitle>
        <DialogDescription class="break-words">{{
          target
            ? $i18n.t.value.chats.deleteConfirm(
                titleOfThread(target.thread, $i18n.t.value.pages.untitled),
              )
            : ""
        }}</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button
          ref="cancel"
          variant="outline"
          :disabled="pending"
          @click="emit('close')"
          >{{ $i18n.t.value.common.cancel }}</Button
        >
        <Button variant="destructive" :disabled="pending" @click="confirm">{{
          pending ? $i18n.t.value.common.loading : $i18n.t.value.common.delete
        }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
