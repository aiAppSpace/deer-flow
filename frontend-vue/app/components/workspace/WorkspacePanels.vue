<!--
  Shared workspace presentation: stable chat tree, desktop exit/pinning, and
  the mobile Sheet. Business open/session/draft admission belongs to callers;
  the L2 native resizable primitive owns geometry and gesture resources.
-->

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { GripVertical } from "lucide-vue-next";
import {
  ResizablePanels,
  type ResizableLayoutEvent,
  type ResizablePanel,
} from "@/components/ui/resizable";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useMediaQuery } from "@/composables/useMediaQuery";

const props = defineProps<{
  open: boolean;
  panelSize: number;
  panelLabel?: string;
  /** 窄屏抽屉的说明，只给读屏器。React 的 SheetDescription 是常量文案。 */
  panelDescription?: string;
  /** artifacts 面板要多一层内边距；sidecar / browser 面板不要。 */
  panelPadded?: boolean;
  /** Presentation identity only; business admission remains with the caller. */
  panelKey?: string | null;
  /** Retire an outgoing presentation immediately when its conversation changes. */
  ownerKey?: string;
}>();
const emit = defineEmits<{
  "update:panelSize": [value: number];
  collapse: [];
}>();

const MIN_OPEN_SIZE = 20;
const MAX_OPEN_SIZE = 70;
const PANEL_TRANSITION_MS = 280;

const mainRegion = ref<HTMLElement | null>(null);
const panelRegion = ref<HTMLElement | null>(null);

/*
  地标还是对话框，取决于断点。

  React 用两套实现：宽屏是 `<aside id="artifacts">`，**没有 role**，所以读屏器
  听到的是一个 complementary 地标，聊天区依然可达；窄屏才换成 Sheet，也就是一个
  真的模态 dialog（frontend/src/components/workspace/chats/chat-box.tsx 的
  `if (isMobile)` 分支）。两边给的语义不同不是疏忽——宽屏面板是并排的第二栏，
  把它报成 dialog 等于告诉用户「其余内容现在不可用」，而它明明可用。

  断点用 JS 判定而不是只靠 CSS：两边是**两棵不同的树**，媒体查询换不了树。
  **首帧就要是真值**——晚一帧等于在窄屏上先把桌面那棵树整个挂一次再扔掉，
  连同它的副作用；判据写在 `useMediaQuery.ts` 的文件头。
*/
const NARROW_QUERY = "(max-width: 767px)";
const isNarrow = useMediaQuery(NARROW_QUERY);

const sideSize = computed(() =>
  props.open && !isNarrow.value ? clampOpenSize(props.panelSize) : 0,
);
const mainSize = computed(() => 100 - sideSize.value);
const paneSizes = computed(() => [mainSize.value, sideSize.value]);
const panes: readonly ResizablePanel[] = [
  { id: "main", minSize: 30, class: "workspace-panels__main-pane" },
  {
    id: "side",
    minSize: MIN_OPEN_SIZE,
    maxSize: MAX_OPEN_SIZE,
    collapsible: true,
    collapsedSize: 0,
    class: "workspace-panels__side-pane",
  },
];
const currentPanel = computed(() =>
  props.open ? (props.panelKey ?? "panel") : null,
);
const renderedPanel = ref<string | null>(currentPanel.value);
const renderedPadded = ref(props.panelPadded);
const renderedLabel = ref(props.panelLabel);
const animating = ref(false);
const pinnedContentWidth = ref<string | null>(null);
let lastPositiveSize = clampOpenSize(props.panelSize);
let presentationRevision = 0;
let exitRevision = 0;
let disposed = false;
let transitionTimer: ReturnType<typeof setTimeout> | undefined;
let exitTimer: ReturnType<typeof setTimeout> | undefined;

function finishSizeTransition() {
  clearTimeout(transitionTimer);
  transitionTimer = undefined;
  animating.value = false;
  pinnedContentWidth.value = null;
}

function cancelExit() {
  exitRevision++;
  clearTimeout(exitTimer);
  exitTimer = undefined;
}

// React chat-box.tsx holds the final content width while only the outer pane
// animates. Keep that presentation separate from open/active/session owners.
watch(
  [
    () => props.open,
    isNarrow,
    () => props.ownerKey,
    currentPanel,
    () => props.panelSize,
    () => props.panelPadded,
    () => props.panelLabel,
  ],
  (
    [open, narrow, owner, panel, size, padded, label],
    [previousOpen, previousNarrow, previousOwner, previousPanel, previousSize],
  ) => {
    const ownerChanged = owner !== previousOwner;
    const layoutChanged = open !== previousOpen || narrow !== previousNarrow;
    if (ownerChanged || layoutChanged) presentationRevision++;
    if (size !== previousSize) lastPositiveSize = clampOpenSize(size);
    if (ownerChanged) {
      finishSizeTransition();
      cancelExit();
      renderedPanel.value = panel;
      renderedPadded.value = padded;
      renderedLabel.value = label;
      return;
    }
    if (panel !== null) {
      cancelExit();
      renderedPanel.value = panel;
      renderedPadded.value = padded;
      renderedLabel.value = label;
    } else if (previousPanel !== null) {
      cancelExit();
      const revision = exitRevision;
      exitTimer = setTimeout(() => {
        if (disposed || revision !== exitRevision || props.open) return;
        renderedPanel.value = null;
        exitTimer = undefined;
      }, PANEL_TRANSITION_MS);
    }
    if (narrow) {
      finishSizeTransition();
      return;
    }
    if (!layoutChanged) return;
    finishSizeTransition();
    if (open) lastPositiveSize = clampOpenSize(size);
    pinnedContentWidth.value = `${lastPositiveSize}cqw`;
    animating.value = true;
    const revision = presentationRevision;
    transitionTimer = setTimeout(() => {
      if (!disposed && revision === presentationRevision)
        finishSizeTransition();
    }, PANEL_TRANSITION_MS);
  },
);

onBeforeUnmount(() => {
  disposed = true;
  presentationRevision++;
  finishSizeTransition();
  cancelExit();
});

function clampOpenSize(value: number) {
  return Math.max(MIN_OPEN_SIZE, Math.min(MAX_OPEN_SIZE, value));
}

function sidePaneSize(payload: { panes: { size: number }[] }) {
  return payload.panes[1]?.size ?? 0;
}

function onResize(payload: ResizableLayoutEvent) {
  if (!payload.event || !props.open || isNarrow.value) return;
  finishSizeTransition();
  const size = sidePaneSize(payload);
  if (size > 0) lastPositiveSize = clampOpenSize(size);
}

function onResized(payload: ResizableLayoutEvent) {
  // Only a live native transaction can persist or collapse. Programmatic size
  // changes and canceled/retired gestures never emit this completion event.
  if (!payload.event || !props.open || isNarrow.value) return;
  const finalSize = sidePaneSize(payload);
  if (finalSize === 0) {
    emit("update:panelSize", lastPositiveSize);
    emit("collapse");
  } else {
    lastPositiveSize = clampOpenSize(finalSize);
    emit("update:panelSize", lastPositiveSize);
  }
}

function keepNarrowPanelFocusVisible(event: FocusEvent) {
  if (event.target instanceof HTMLElement)
    event.target.scrollIntoView({ block: "nearest" });
}

// Run after this close's DOM patch, before callers' nextTick continuations.
// There is no asynchronous close callback left to steal a reopened panel's
// focus; the details owner can still restore its explicit origin afterwards.
watch(
  [() => props.open, isNarrow, () => props.ownerKey],
  ([open, narrow, owner], [, , previousOwner]) => {
    if (disposed || open || narrow || owner !== previousOwner) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement && panelRegion.value?.contains(active))
      mainRegion.value?.focus({ preventScroll: true });
  },
  { flush: "post" },
);

/*
  React 的 Radix Sheet 打开后把焦点停在 Content 容器，而不是第一个可聚焦控件。
  这里显式复现同一落点：否则 Reka 会聚焦面板头部的 Close，并立即展开它的
  Tooltip，导致窄屏初始状态既多一块浮层，也跳过标题与说明。
*/
function focusNarrowPanelItself(event: Event) {
  event.preventDefault();
  const panel = event.currentTarget;
  if (panel instanceof HTMLElement) panel.focus({ preventScroll: true });
}
</script>

<template>
  <div class="size-full min-h-0 min-w-0 overflow-hidden">
    <ResizablePanels
      class="workspace-panels min-h-0"
      :class="{
        'workspace-panels--closed': !open,
        'workspace-panels--animating': animating,
      }"
      :panels="panes"
      :sizes="paneSizes"
      :owner-key="ownerKey ?? ''"
      :disabled="!open || isNarrow"
      :keyboard-step="5"
      handle-class="hidden opacity-33 transition-opacity duration-200 ease-out hover:opacity-100 motion-reduce:transition-none md:flex"
      @resize="onResize"
      @resized="onResized"
    >
      <template #main>
        <div
          id="chat"
          ref="mainRegion"
          tabindex="-1"
          class="relative size-full min-h-0 min-w-0"
        >
          <slot name="main" />
        </div>
      </template>
      <template #side>
        <!--
          id 挂在**共用的**面板容器上，不是挂在 artifacts 的内容组件上。
          React 的 `<aside id="artifacts">` 是右侧栏本身，sidecar 与 browser 渲染在
          同一个 aside 里也照样带着这个 id
          （frontend/src/components/workspace/chats/chat-box.tsx）。挂在内容上的话，
          「右侧栏在哪」这件事会随里面装的是什么而变。
        -->
        <!--
          宽屏的面板**没有 role**：它是并排的第二栏，读屏器听到的是一个 complementary
          地标，聊天区依然可达。报成 dialog 等于告诉用户其余内容现在不可用，而它明明可用。
        -->
        <aside
          v-if="!isNarrow"
          id="artifacts"
          ref="panelRegion"
          :aria-hidden="!open"
          :inert="!open"
          class="size-full min-h-0 min-w-0 overflow-hidden transition-opacity duration-280 ease-out motion-reduce:transition-none"
          :class="open ? 'opacity-100' : 'pointer-events-none opacity-0'"
        >
          <div
            v-if="renderedPanel !== null"
            :key="ownerKey"
            class="ml-auto h-full min-w-0 overflow-hidden"
            :class="renderedPadded ? 'p-4' : 'p-0'"
            :style="
              pinnedContentWidth ? { width: pinnedContentWidth } : undefined
            "
          >
            <slot name="panel" :rendered-panel="renderedPanel" />
          </div>
        </aside>
      </template>
      <template #handle>
        <div
          class="bg-border z-10 flex h-4 w-3 items-center justify-center rounded-xs border"
        >
          <GripVertical class="size-2.5" aria-hidden="true" />
        </div>
      </template>
    </ResizablePanels>
  </div>
  <!--
    窄屏的面板是一个真 Sheet，而不是铺满屏幕的同一个 aside。**主区不换树**：
    断点变化只切换面板宿主：宽屏渲染 aside，窄屏渲染 Sheet。
    主区与分栏骨架始终共用；窄屏将侧栏声明为 0 并取消当前拖动，避免旧 release 关闭 Sheet。
  -->
  <Sheet
    v-if="isNarrow"
    :open="open"
    @update:open="(next: boolean) => next || emit('collapse')"
  >
    <!--
      `[&>button]:hidden` 逐字照抄 React chat-box.tsx：窄屏面板自己带关闭控件，
      primitive 那颗就不该再出现。opt-out 放在与 React 同一层（调用方的 class），
      而不是给 SheetContent 加一个 React 根本没有的开关。
    -->
    <SheetContent
      side="right"
      :close-label="$i18n.t.value.primitives.close"
      class="w-[calc(100vw-1rem)] max-w-none gap-0 p-0 sm:max-w-md [&>button]:hidden"
      @open-auto-focus="focusNarrowPanelItself"
    >
      <!-- 标题与说明只给读屏器，与 React 的 sr-only SheetHeader 一致。 -->
      <SheetHeader class="sr-only">
        <SheetTitle>{{ renderedLabel }}</SheetTitle>
        <SheetDescription>{{ panelDescription }}</SheetDescription>
      </SheetHeader>
      <!--
        三轴回流下（窄宽 + 低高度 + 200% 文本）sidecar / browser 的内容会高于
        Sheet。这里才是三种右栏共享的移动端滚动所有者；让各业务面板各补一根
        滚动条会把关闭键、composer 和浏览器工具条拆成三套不一致的行为。
      -->
      <div
        :key="ownerKey"
        class="min-h-0 flex-1 overflow-y-auto p-3 pt-10"
        @focusin="keepNarrowPanelFocusVisible"
      >
        <slot
          v-if="renderedPanel !== null"
          name="panel"
          :rendered-panel="renderedPanel"
        />
      </div>
    </SheetContent>
  </Sheet>
</template>

<style scoped>
.workspace-panels {
  container-type: inline-size;
}

.workspace-panels :deep([data-panel]) {
  transition: none;
}

.workspace-panels.workspace-panels--animating :deep([data-panel]) {
  transition: flex-grow 280ms ease-out;
}

/* Keep a disabled separator in the desktop accessibility tree. */
.workspace-panels--closed :deep([data-resize-handle]) {
  pointer-events: none;
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .workspace-panels :deep([data-panel]),
  .workspace-panels.workspace-panels--animating :deep([data-panel]) {
    transition: none;
  }
}
</style>
