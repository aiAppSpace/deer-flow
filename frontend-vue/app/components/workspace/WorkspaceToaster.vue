<script setup lang="ts">
import { Button } from "@/components/ui/button";
// The shell renders its injected toast owner; native focus returns to the entry control.

import {
  onBeforeUnmount,
  onMounted,
  onUnmounted,
  ref,
  watch,
  watchEffect,
} from "vue";
import { CircleCheck, Info, OctagonX, TriangleAlert } from "lucide-vue-next";

import {
  useWorkspaceToast,
  type WorkspaceToastKind,
} from "@/core/workspace-shell/toast";

const toast = useWorkspaceToast();
const list = ref<HTMLOListElement | null>(null);
const expanded = ref(false);
const interacting = ref(false);
const hidden = ref(false);
watchEffect(() =>
  toast.setPaused(expanded.value || interacting.value || hidden.value),
);
let focusWithin = false;
let shortcutVisit = false;
let lastFocusedElement: HTMLElement | null = null;
function clearFocusOwner() {
  focusWithin = false;
  shortcutVisit = false;
  lastFocusedElement = null;
}
function restoreFocus() {
  const previous = lastFocusedElement;
  clearFocusOwner();
  if (previous?.isConnected) {
    previous.focus();
    previous.scrollIntoView({ block: "nearest" });
  }
}
function onFocusIn(event: FocusEvent) {
  if (focusWithin) return;
  focusWithin = true;
  lastFocusedElement =
    event.relatedTarget instanceof HTMLElement ? event.relatedTarget : null;
}
function onFocusOut(event: FocusEvent) {
  if (
    focusWithin &&
    !(
      event.relatedTarget instanceof Node &&
      list.value?.contains(event.relatedTarget)
    )
  )
    clearFocusOwner();
}
watch(list, (value, previous) => {
  if (!value && previous) {
    expanded.value = false;
    interacting.value = false;
  }
});
watch(toast.toasts, (items) => {
  // Restore before Vue removes a focused viewport and the browser blurs it.
  if (items.length === 0) restoreFocus();
  if (items.length <= 1) expanded.value = false;
});
function onVisibilityChange() {
  hidden.value = document.hidden;
}

/*
  逐颗照抄上游 `ui/sonner.tsx:19` 传给 `<Toaster>` 的那份 `icons`：
  success→CircleCheckIcon、info→InfoIcon、warning→TriangleAlertIcon、
  error→OctagonXIcon，全是 `className="size-4"`（sonner 的 `[data-icon]` 槽位
  本身就是 16×16）。plain toast(message) 没有图标。**loading 那一颗够不着**——本仓的 toast store 没有 loading
  这一档（上游那颗只在 `toast.promise` 里用，DeerFlow 一处都没有调）。
*/
const KIND_ICON: Partial<Record<WorkspaceToastKind, typeof Info>> = {
  success: CircleCheck,
  info: Info,
  warning: TriangleAlert,
  error: OctagonX,
};

/** sonner 的默认热键：altKey + KeyT，可访问名里的 `alt+T` 就是它。 */
// A shortcut visit returns to its entry; ordinary Tab keeps native navigation.
function leavesNotificationOnTab(event: KeyboardEvent, root: HTMLElement) {
  const view = root.ownerDocument.defaultView;
  const target = event.target;
  if (
    !view ||
    event.defaultPrevented ||
    event.key !== "Tab" ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    !(target instanceof view.HTMLElement) ||
    !root.contains(target) ||
    root.ownerDocument.activeElement !== target
  )
    return false;
  const stops = Array.from(
    root.querySelectorAll<HTMLElement>(
      "button,a[href],input,select,textarea,[tabindex]",
    ),
  )
    .filter((node) => {
      if (
        node.tabIndex < 0 ||
        (node as HTMLButtonElement).disabled ||
        node.hidden
      )
        return false;
      for (
        let current: HTMLElement | null = node;
        current;
        current = current.parentElement
      ) {
        const style = view.getComputedStyle(current);
        if (
          current.hidden ||
          current.inert ||
          style.display === "none" ||
          style.visibility === "hidden"
        )
          return false;
        if (current === root) return true;
      }
      return false;
    })
    .sort(
      (left, right) =>
        (left.tabIndex || Infinity) - (right.tabIndex || Infinity),
    );
  return target === root
    ? event.shiftKey || stops.length === 0
    : target === (event.shiftKey ? stops[0] : stops.at(-1));
}

function onKeydown(event: KeyboardEvent) {
  if (
    shortcutVisit &&
    list.value &&
    lastFocusedElement?.isConnected &&
    leavesNotificationOnTab(event, list.value)
  ) {
    event.preventDefault();
    restoreFocus();
    return;
  }
  if (!event.defaultPrevented && event.altKey && event.code === "KeyT") {
    expanded.value = true;
    if (list.value && !focusWithin) {
      shortcutVisit = true;
      list.value.focus();
      if (!focusWithin) shortcutVisit = false;
    } else {
      list.value?.focus();
    }
    return;
  }
  if (event.code === "Escape" && list.value?.contains(document.activeElement))
    expanded.value = false;
}

onMounted(() => {
  onVisibilityChange();
  document.addEventListener("keydown", onKeydown);
  document.addEventListener("visibilitychange", onVisibilityChange);
});
onBeforeUnmount(restoreFocus);
onUnmounted(() => {
  document.removeEventListener("keydown", onKeydown);
  document.removeEventListener("visibilitychange", onVisibilityChange);
  toast.setPaused(false);
});
</script>

<template>
  <section
    :aria-label="$i18n.t.value.primitives.notifications"
    tabindex="-1"
    aria-live="polite"
    aria-relevant="additions text"
    aria-atomic="false"
  >
    <ol
      v-if="toast.toasts.value.length"
      ref="list"
      data-testid="workspace-toaster"
      tabindex="-1"
      class="workspace-toaster pointer-events-none fixed inset-x-0 top-6 z-[120] mx-auto flex w-[356px] flex-col gap-[14px] max-[600px]:top-4 max-[600px]:w-[calc(100%-32px)]"
      @focusin="onFocusIn"
      @focusout="onFocusOut"
      @mouseenter="expanded = true"
      @mousemove="expanded = true"
      @mouseleave="!interacting && (expanded = false)"
      @dragend="expanded = false"
      @pointerdown="interacting = true"
      @pointerup="interacting = false"
    >
      <li
        v-for="item in toast.toasts.value"
        :key="item.id"
        tabindex="0"
        class="bg-popover text-popover-foreground border-border pointer-events-auto flex items-center gap-1.5 rounded-lg border p-4 text-[13px] wrap-anywhere shadow-[0_4px_12px_rgba(0,0,0,0.1)] outline-0 focus-visible:shadow-[0_4px_12px_rgba(0,0,0,0.1),0_0_0_2px_rgba(0,0,0,0.2)]"
      >
        <!--
          The permanent live region announces notice text; type icons stay decorative.
        -->
        <component
          :is="KIND_ICON[item.kind]"
          v-if="KIND_ICON[item.kind]"
          class="mr-1 -ml-[3px] size-4 shrink-0"
          aria-hidden="true"
        />
        <div class="flex min-w-0 flex-col gap-0.5">
          <div class="leading-normal font-medium">{{ item.message }}</div>
          <!--
            Description belongs to the same permanent live region as the message.
          -->
          <span
            v-if="item.description"
            class="leading-[1.4] font-normal text-[#3f3f3f] dark:text-[hsl(0_0%_91%)]"
            >{{ item.description }}</span
          >
        </div>
        <!--
          动作键点完**要把这条提示关掉**：留着的话下一次同类操作会出现两条
          一模一样的提示，分不清哪条对应哪次。
        -->
        <Button
          v-if="item.action"
          variant="ghost"
          size="sm"
          class="h-auto shrink-0 px-2 py-1 text-xs"
          @click="
            item.action.onClick();
            toast.dismiss(item.id);
          "
        >
          {{ item.action.label }}
        </Button>
      </li>
    </ol>
  </section>
</template>

<style scoped>
/* Match the installed Sonner viewport font stack without changing page typography. */
.workspace-toaster {
  font-family:
    ui-sans-serif,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    Roboto,
    "Helvetica Neue",
    Arial,
    "Noto Sans",
    sans-serif,
    "Apple Color Emoji",
    "Segoe UI Emoji",
    "Segoe UI Symbol",
    "Noto Color Emoji";
}
</style>
