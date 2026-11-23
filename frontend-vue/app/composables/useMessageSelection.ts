/*
  【文件职责】     消息选区引用、工具条定位与监听器/observer 生命周期。
  【架构位置】     L3 composable
  【主要导出】     useMessageSelection · SelectionPayload
  【依赖关系】     Vue · core/messages
  【边界与注意】   只接受同一 assistant 回合的浏览器选区；切会话/身份退休旧引用。
*/
import { nextTick, onMounted, onUnmounted, ref, watch } from "vue";

import type { MessageGroup } from "@/core/messages/utils";
import type { Message } from "@/core/types/message";

export type SelectionPayload = {
  message: Message;
  selectedText: string;
  displayIndex: number;
};
type SelectionToolbarState = SelectionPayload & {
  x: number;
  y: number;
  placement: "top" | "bottom";
};

const MARGIN = 8;
const ESTIMATED_HEIGHT = 48;

export function useMessageSelection(options: {
  owner: () => readonly [string | null | undefined, string | undefined];
  enabled: () => boolean;
  groups: () => readonly MessageGroup[];
  crossedMessages: () => void;
  dispatch: (action: "ask" | "add", payload: SelectionPayload) => void;
}) {
  const selection = ref<SelectionToolbarState | null>(null);
  const selectionToolbarElement = ref<HTMLElement | null>(null);
  let observer: ResizeObserver | undefined;
  let disposed = false;

  function clearSelection() {
    observer?.disconnect();
    observer = undefined;
    selection.value = null;
  }
  watch(options.owner, clearSelection, { flush: "sync" });

  function onSelection(event: MouseEvent, index: number) {
    if (!options.enabled() || disposed) return;
    const group = options.groups()[index];
    if (group?.type !== "assistant") return;
    const message = group.messages[0];
    if (!message || message.type !== "ai") return;
    const domSelection = globalThis.getSelection?.();
    const selectedText = domSelection?.toString().trim() ?? "";
    if (
      !domSelection ||
      domSelection.isCollapsed ||
      !selectedText ||
      domSelection.rangeCount === 0
    ) {
      clearSelection();
      return;
    }
    const { anchorNode, focusNode } = domSelection;
    if (!anchorNode || !focusNode) return;
    const turn = event.currentTarget as HTMLElement | null;
    if (!turn?.contains(anchorNode)) return;
    if (!turn.contains(focusNode)) {
      options.crossedMessages();
      clearSelection();
      return;
    }
    const rect = domSelection.getRangeAt(0).getBoundingClientRect();
    const fitsAbove = rect.top - MARGIN - ESTIMATED_HEIGHT >= 0;
    selection.value = {
      message,
      selectedText,
      displayIndex: index + 1,
      x: rect.left + rect.width / 2,
      y: fitsAbove ? rect.top - MARGIN : rect.bottom + MARGIN,
      placement: fitsAbove ? "top" : "bottom",
    };
  }
  function positionSelectionToolbar() {
    const toolbar = selectionToolbarElement.value;
    const current = selection.value;
    if (!toolbar || !current || disposed) return;
    const width = toolbar.offsetWidth;
    const height = toolbar.offsetHeight;
    const maxLeft = Math.max(MARGIN, globalThis.innerWidth - width - MARGIN);
    const maxTop = Math.max(MARGIN, globalThis.innerHeight - height - MARGIN);
    const preferredLeft = current.x - width / 2;
    const preferredTop =
      current.placement === "top" ? current.y - height : current.y;
    toolbar.style.left = `${Math.min(Math.max(preferredLeft, MARGIN), maxLeft)}px`;
    toolbar.style.top = `${Math.min(Math.max(preferredTop, MARGIN), maxTop)}px`;
  }
  watch(selection, async (current) => {
    observer?.disconnect();
    observer = undefined;
    if (!current) return;
    await nextTick();
    if (disposed || selection.value !== current) return;
    positionSelectionToolbar();
    const toolbar = selectionToolbarElement.value;
    if (toolbar && "ResizeObserver" in globalThis) {
      observer = new ResizeObserver(positionSelectionToolbar);
      observer.observe(toolbar);
    }
  });
  function dispatchSelection(action: "ask" | "add") {
    const current = selection.value;
    if (!current || disposed) return;
    options.dispatch(action, {
      message: current.message,
      selectedText: current.selectedText,
      displayIndex: current.displayIndex,
    });
    clearSelection();
    globalThis.getSelection?.()?.removeAllRanges();
  }
  function onKey(event: KeyboardEvent) {
    if (event.key === "Escape") clearSelection();
  }
  function onScroll() {
    if (selection.value) clearSelection();
  }
  onMounted(() => {
    globalThis.addEventListener("keydown", onKey);
    globalThis.addEventListener("scroll", onScroll, true);
    globalThis.addEventListener("resize", positionSelectionToolbar);
  });
  onUnmounted(() => {
    disposed = true;
    clearSelection();
    globalThis.removeEventListener("keydown", onKey);
    globalThis.removeEventListener("scroll", onScroll, true);
    globalThis.removeEventListener("resize", positionSelectionToolbar);
  });
  return {
    selection,
    selectionToolbarMargin: MARGIN,
    selectionToolbarElement,
    onSelection,
    dispatchSelection,
  };
}
