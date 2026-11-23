/*
  【文件职责】     单个主 thread 的 sidecar 面板开关、引用与共享 thread id。
  【架构位置】     L3（DeerFlow sidecar）
  【主要导出】     useSidecar
  【依赖关系】     core/sidecar · thread submit context · AgentChat
  【边界与注意】   只持有 UI/reference 状态；恢复、创建、run、附件与 HIL
                   全部由 useSidecarSession 的唯一生命周期拥有。
*/

import { reactive, ref, toValue, watch } from "vue";
import type { MaybeRefOrGetter } from "vue";

import type { Message } from "@/core/types/message";
import {
  appendSidecarReference,
  buildMessageSidecarContext,
  getNextSidecarOpenState,
  type SidecarContext,
  type SidecarReferenceStateItem,
} from "@/core/sidecar";
import type { ThreadRunContextInput } from "@/core/threads/submit";

export type SidecarReference = SidecarReferenceStateItem;

export function useSidecar(options: {
  parentThreadId: MaybeRefOrGetter<string | null>;
  ownerKey?: MaybeRefOrGetter<string | undefined>;
  context: MaybeRefOrGetter<ThreadRunContextInput>;
}) {
  const open = ref(false);
  const activeReferences = ref<SidecarReference[]>([]);
  const conversationQuotes = ref<SidecarReference[]>([]);
  const sidecarThreadId = ref<string | null>(null);
  const context = reactive<ThreadRunContextInput>({});
  let referenceId = 0;

  function setContext(next: ThreadRunContextInput) {
    for (const key of Object.keys(context)) {
      Reflect.deleteProperty(context, key);
    }
    Object.assign(context, next);
  }

  watch(
    [() => toValue(options.parentThreadId), () => toValue(options.ownerKey)],
    () => {
      open.value = false;
      activeReferences.value = [];
      conversationQuotes.value = [];
      sidecarThreadId.value = null;
      setContext({ ...toValue(options.context) });
    },
    { immediate: true, flush: "sync" },
  );

  function createReference(nextContext: SidecarContext): SidecarReference {
    referenceId += 1;
    return { id: referenceId, context: nextContext };
  }

  function openContext(nextContext: SidecarContext) {
    const next = getNextSidecarOpenState({
      open: open.value,
      sidecarThreadId: sidecarThreadId.value,
      activeReferences: activeReferences.value,
      nextReference: createReference(nextContext),
    });
    activeReferences.value = next.activeReferences;
    open.value = true;
  }

  function addContextToConversation(nextContext: SidecarContext) {
    conversationQuotes.value = appendSidecarReference(
      conversationQuotes.value,
      createReference(nextContext),
    );
  }

  function fromSelection(
    message: Message,
    selectedText: string,
    displayIndex?: number,
  ) {
    return buildMessageSidecarContext(message, displayIndex, { selectedText });
  }

  function clearConversationQuotes(accepted?: readonly SidecarReference[]) {
    if (!accepted) {
      conversationQuotes.value = [];
      return;
    }
    const acceptedIds = new Set(accepted.map((reference) => reference.id));
    conversationQuotes.value = conversationQuotes.value.filter(
      (reference) => !acceptedIds.has(reference.id),
    );
  }
  function clearActiveReferences(accepted?: SidecarReference[]) {
    if (!accepted) {
      activeReferences.value = [];
      return;
    }
    const acceptedIds = new Set(accepted.map((reference) => reference.id));
    activeReferences.value = activeReferences.value.filter(
      (reference) => !acceptedIds.has(reference.id),
    );
  }
  function close() {
    open.value = false;
  }
  function clearThreadAndClose() {
    clearActiveReferences();
    sidecarThreadId.value = null;
    close();
  }

  return {
    open,
    activeReferences,
    conversationQuotes,
    sidecarThreadId,
    context,
    setContext,
    openContext,
    addContextToConversation,
    fromSelection,
    clearConversationQuotes,
    clearActiveReferences,
    close,
    clearThreadAndClose,
  };
}
