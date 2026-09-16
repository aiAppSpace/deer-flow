<!--
  【文件职责】     以一个 splitpanes 组承载聊天区与 artifacts/sidecar/browser 共用右侧面板。
  【架构位置】     L3 workspace layout
  【主要导出】     WorkspacePanels
  【依赖关系】     splitpanes · useMediaQuery；面板业务开关仍由 AgentChat 的唯一状态路径拥有
  【边界与注意】   使用 splitpanes 原生 width/keyboard/ARIA 行为；只在真实 release 后持久化或折叠。
                   **窄屏是另一套实现，不是同一套加几条媒体查询。** React 在 isMobile
                   分支把整个分栏换成 Sheet（frontend/src/components/workspace/chats/chat-box.tsx），
                   而 Sheet 是真模态：面板之外的内容会被整体标成不可达。原来 Vue 只是把
                   侧栏 fixed 铺满屏幕，读屏器仍然能从"抽屉"里走回背后的对话——实测窄屏
                   取样时 React 的树里只有面板，Vue 的树里整页都在。
-->

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { Pane, Splitpanes, type SplitpanesResizedPayload } from "splitpanes";

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
}>();
const emit = defineEmits<{
  "update:panelSize": [value: number];
  collapse: [];
}>();

const MIN_OPEN_SIZE = 20;
const MAX_OPEN_SIZE = 72;
const COLLAPSE_THRESHOLD = 8;

const root = ref<HTMLElement | null>(null);
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
  props.open ? clampOpenSize(props.panelSize) : 0,
);
const mainSize = computed(() => 100 - sideSize.value);

function clampOpenSize(value: number) {
  return Math.max(MIN_OPEN_SIZE, Math.min(MAX_OPEN_SIZE, value));
}

function sidePaneSize(payload: { panes: { size: number }[] }) {
  return payload.panes[1]?.size ?? 0;
}

function onResized(payload: SplitpanesResizedPayload) {
  // Registration and prop changes also emit `resized`; only a user event owns
  // a new persisted size or a collapse decision.
  if (!payload.event) return;
  const finalSize = sidePaneSize(payload);
  if (finalSize < COLLAPSE_THRESHOLD) emit("collapse");
  else emit("update:panelSize", clampOpenSize(finalSize));
}

/*
  splitpanes 是在挂载后用 createElement 直接插入 splitter 的，模板上没有它，
  aria-disabled 只能在这里补。React 那边由 react-resizable-panels 自己写
  （dist 里的 `"aria-disabled": n || void 0`），语义一致：关着的分隔线是 disabled，
  不是消失。

  **`tabindex` 也在这里同步，理由是关着的时候它是一个「看不见、也按不动、
  却照样占一个 Tab 停靠点」的元素。** 下面那条 `.workspace-panels--closed`
  的样式把它设成 `opacity: 0; pointer-events: none`——鼠标用户完全感知不到它，
  而 splitpanes 给的 `tabindex="0"` 让纯键盘用户照样会 Tab 进来，落在一个
  没有焦点环、也没有任何可见反馈的地方（WCAG 2.4.7 焦点可见）。
  **wave 96 给对照加上「能不能 tab 到」那一档才量出来**：本仓每一屏都多出一个
  `div(separator)` 停靠点，而上游只在面板真的展开时才渲染 resizable-handle。

  开着的时候不动它：那时它可见、可拖，`keyboard-step` 也让方向键能调宽度，
  本来就该在 Tab 序里。
*/
function syncSplitterDisabled() {
  const splitter = root.value?.querySelector(".splitpanes__splitter");
  if (!splitter) return;
  if (props.open) {
    splitter.removeAttribute("aria-disabled");
    splitter.setAttribute("tabindex", "0");
  } else {
    splitter.setAttribute("aria-disabled", "true");
    splitter.setAttribute("tabindex", "-1");
  }
}
onMounted(async () => {
  await nextTick();
  syncSplitterDisabled();
});
watch(() => props.open, syncSplitterDisabled, { flush: "post" });

watch(
  () => props.open,
  async (open) => {
    if (open) return;
    const active = document.activeElement;
    if (
      !(active instanceof HTMLElement) ||
      !panelRegion.value?.contains(active)
    ) {
      return;
    }
    await nextTick();
    mainRegion.value?.focus({ preventScroll: true });
  },
);
</script>

<template>
  <div ref="root" class="size-full min-h-0 min-w-0 overflow-hidden">
    <Splitpanes
      class="workspace-panels size-full min-h-0 min-w-0"
      :class="{ 'workspace-panels--closed': !open }"
      :push-other-panes="false"
      :maximize-panes="false"
      :keyboard-step="2"
      @resized="onResized"
    >
      <Pane :size="mainSize" min-size="28" class="workspace-panels__main-pane">
        <div
          id="chat"
          ref="mainRegion"
          tabindex="-1"
          class="relative size-full min-h-0 min-w-0"
        >
          <slot name="main" />
        </div>
      </Pane>
      <Pane
        :size="sideSize"
        min-size="0"
        :max-size="MAX_OPEN_SIZE"
        class="workspace-panels__side-pane"
      >
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
          class="size-full min-h-0 min-w-0 overflow-hidden"
          :class="open ? '' : 'pointer-events-none'"
          @keydown.esc="emit('collapse')"
        >
          <div
            v-show="open"
            class="ml-auto h-full min-w-0 overflow-hidden"
            :class="panelPadded ? 'p-4' : 'p-0'"
          >
            <slot name="panel" />
          </div>
        </aside>
      </Pane>
    </Splitpanes>
  </div>
  <!--
    窄屏的面板是一个真 Sheet，而不是铺满屏幕的同一个 aside。**主区不换树**：
    `isNarrow` 只有在水合之后才为真，把整棵树换掉会让聊天区连同它的 query 一起重挂载
    ——实测多打一次 `/api/skills`。所以这里只换面板：宽屏渲染 aside，窄屏渲染 Sheet，
    splitpanes 的骨架两边共用（窄屏由下面的样式把分隔线与侧栏收成 0）。
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
    >
      <!-- 标题与说明只给读屏器，与 React 的 sr-only SheetHeader 一致。 -->
      <SheetHeader class="sr-only">
        <SheetTitle>{{ panelLabel }}</SheetTitle>
        <SheetDescription>{{ panelDescription }}</SheetDescription>
      </SheetHeader>
      <div class="min-h-0 flex-1 p-3 pt-10">
        <slot name="panel" />
      </div>
    </SheetContent>
  </Sheet>
</template>

<style scoped>
.workspace-panels :deep(.splitpanes__pane) {
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}

.workspace-panels :deep(.splitpanes__splitter) {
  position: relative;
  z-index: 20;
  width: 1px;
  min-width: 1px;
  /*
    这条 1px 线用**背景色**画，不是 `border-left`——上游
    `ui/resizable.tsx` 的 handle 是 `bg-border w-px`。
    两种画法在屏幕上分不出来（`box-sizing: border-box`，1px 的左边框正好占满
    1px 的盒子），但**计算样式分得出来**：wave 146 第一次把这颗分隔条挂进取样面，
    几何档当场报 `background React=rgba(232,229,222,255) Vue=rgba(0,0,0,0)`。
    与其在台账里留一条「看着像差异、其实不是」的账（那种账会让人不再相信这份清单），
    不如把画法对齐——用户看到的东西一个像素都没变。
  */
  background: var(--border);
  opacity: 0.33;
  transition: opacity 200ms ease-out;
}

.workspace-panels :deep(.splitpanes__splitter::after) {
  position: absolute;
  inset-block: 0;
  left: -8px;
  width: 16px;
  content: "";
}

.workspace-panels :deep(.splitpanes__splitter:hover),
.workspace-panels :deep(.splitpanes__splitter:focus-visible) {
  opacity: 1;
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

/*
  关着的时候只是**看不见**，不是不存在：React 的 ResizableHandle 在右侧面板关闭时
  传 disabled，元素照样留在树里，读屏器听到的是一个 disabled 的 separator
  （frontend/src/components/workspace/chats/chat-box.tsx）。visibility: hidden 会把它
  整个从可访问性树里摘掉，于是「这里有一条可以拖的分隔线、现在不能拖」这句话没人说得出来。
*/
.workspace-panels--closed :deep(.splitpanes__splitter) {
  pointer-events: none;
  opacity: 0;
}

/* 窄屏没有分栏可言：分隔线不渲染，侧栏收成 0，面板由 Sheet 承担。 */
@media (max-width: 767px) {
  .workspace-panels__main-pane {
    width: 100% !important;
  }

  .workspace-panels :deep(.splitpanes__splitter) {
    display: none;
  }

  .workspace-panels__side-pane {
    width: 0 !important;
  }
}

@media (prefers-reduced-motion: reduce) {
  .workspace-panels :deep(.splitpanes__pane),
  .workspace-panels :deep(.splitpanes__splitter) {
    transition: none;
  }
}
</style>
