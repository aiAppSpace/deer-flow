/*
  【文件职责】     消息行编辑事务、复制反馈及其会话生命周期。
  【架构位置】     L3 composable
  【主要导出】     useMessageTurnActions
  【依赖关系】     Vue · core/messages · clipboard
  【边界与注意】   不持有 run；提交交给宿主，晚返回只更新发起时的 editor/owner。
*/
import {
  computed,
  nextTick,
  onUnmounted,
  ref,
  watch,
  type ComponentPublicInstance,
} from "vue";

import { writeTextToClipboard } from "@/core/clipboard";
import { getMessageCopyData } from "@/core/messages/utils";
import type { Message } from "@/core/types/message";

type EditSubmission = (
  messageId: string,
  text: string,
  messageIds: string[],
) => boolean | undefined | Promise<boolean | undefined>;

export function useMessageTurnActions(options: {
  owner: () => readonly [string | null | undefined, string | undefined];
  submit: () => EditSubmission | undefined;
  groupIds: (index: number) => string[];
  onBeginEdit: (message: Message, messageIds: string[]) => void;
  notifyError: (message: string) => void;
  copyFailed: () => string;
}) {
  const editState = ref<{
    messageId: string;
    text: string;
    original: string;
    messageIds: string[];
    pending: boolean;
  } | null>(null);
  const editTextarea = ref<ComponentPublicInstance | null>(null);
  const copiedMessage = ref<string | null>(null);
  const actionError = ref("");
  let generation = 0;
  let disposed = false;
  let copyTimer: ReturnType<typeof setTimeout> | undefined;

  function retire() {
    generation += 1;
    editState.value = null;
    copiedMessage.value = null;
    actionError.value = "";
    clearTimeout(copyTimer);
    copyTimer = undefined;
  }
  watch(options.owner, retire, { flush: "sync" });
  onUnmounted(() => {
    disposed = true;
    retire();
  });

  const editSubmitDisabled = computed(() => {
    const state = editState.value;
    if (!state || state.pending || !options.submit()) return true;
    const draft = state.text.trim();
    return draft.length === 0 || draft === state.original.trim();
  });

  function setEditTextarea(value: Element | ComponentPublicInstance | null) {
    editTextarea.value = value && "$el" in value ? value : null;
  }
  async function beginEdit(message: Message, groupIndex: number) {
    if (!message.id || editState.value?.pending || disposed) return;
    const original = getMessageCopyData(message) ?? "";
    editState.value = {
      messageId: message.id,
      text: original,
      original,
      messageIds: options.groupIds(groupIndex),
      pending: false,
    };
    const state = editState.value;
    options.onBeginEdit(message, state.messageIds);
    await nextTick();
    if (editState.value === state && !disposed) editTextarea.value?.$el.focus();
  }
  function cancelEdit() {
    if (!editState.value?.pending) editState.value = null;
  }
  async function updateAndRerun() {
    const state = editState.value;
    const submit = options.submit();
    if (!state || !submit || editSubmitDisabled.value || disposed) return;
    state.pending = true;
    try {
      const accepted = await submit(
        state.messageId,
        state.text.trim(),
        state.messageIds,
      );
      if (editState.value === state && accepted !== false)
        editState.value = null;
    } catch (error) {
      if (editState.value === state)
        options.notifyError(
          error instanceof Error ? error.message : String(error),
        );
    } finally {
      if (editState.value === state) state.pending = false;
    }
  }
  function onEditKeydown(event: KeyboardEvent) {
    if (editState.value?.pending) return;
    if (event.key === "Escape") {
      event.preventDefault();
      cancelEdit();
    }
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void updateAndRerun();
    }
  }
  async function copyMessage(key: string, value: string | null) {
    if (!value || disposed) return;
    const owner = generation;
    actionError.value = "";
    const copied = await writeTextToClipboard(value);
    if (disposed || generation !== owner) return;
    if (!copied) {
      actionError.value = options.copyFailed();
      return;
    }
    copiedMessage.value = key;
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => {
      if (generation === owner && copiedMessage.value === key)
        copiedMessage.value = null;
      copyTimer = undefined;
    }, 2_000);
  }

  return {
    editState,
    editSubmitDisabled,
    setEditTextarea,
    beginEdit,
    cancelEdit,
    updateAndRerun,
    onEditKeydown,
    copiedMessage,
    actionError,
    copyMessage,
  };
}
