<!--
  【文件职责】     mermaid 图的缩放/平移容器（上游 streamdown 的 ZoomPan）。
  【架构位置】     L2 —— 通用渲染层组件
  【主要导出】     默认组件
  【依赖关系】     ./MarkdownIcon.vue · @/lib/utils
  【边界与注意】   ① **`role="application"` 必须配上真的能拖。** 这个 role 让读屏器
                   把整块交给应用自己处理按键，用户于是听不到里面的结构。挂着它却
                   不实现拖拽，等于把一块内容从无障碍树里摘出去还什么都不给。
                   所以这个文件里的 pointer 逻辑不是锦上添花，是这个 role 的前提。

                   ② **wheel 必须 `passive: false`**，否则 `preventDefault()` 无效，
                   滚轮缩放会连带把页面也滚走。Vue 的 `@wheel` 修饰符给不出这个选项
                   （`.passive` 只能开不能关），所以这里用 `addEventListener` 手工挂。

                   ③ 拖拽只认主键主指针（`button === 0 && isPrimary`）：右键菜单与
                   多点触控的第二根手指都不该起拖。`setPointerCapture` 让指针移出
                   元素后事件仍然回到这里，否则快速拖动会中途丢失。

                   ④ 拖拽期间 `document.body.style.userSelect = "none"`：不关的话
                   拖过图上的文字会变成选中文本，指针一路拖出去还会选到页面别处。
                   清理必须在同一个 effect 里，组件卸载时也要还原。

                   ⑤ 缩放上下限与步长照抄上游（0.5 / 3 / 0.1）。缩放到边界时对应的
                   按钮 `disabled`——重置按钮**没有** disabled 样式类，上游如此。
-->

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";

import { cn } from "@/lib/utils";

import MarkdownIcon from "./MarkdownIcon.vue";

const props = withDefaults(
  defineProps<{
    class?: string;
    minZoom?: number;
    maxZoom?: number;
    zoomStep?: number;
    showControls?: boolean;
    initialZoom?: number;
    fullscreen?: boolean;
  }>(),
  {
    class: "",
    minZoom: 0.5,
    maxZoom: 3,
    zoomStep: 0.1,
    showControls: true,
    initialZoom: 1,
    fullscreen: false,
  },
);

const container = ref<HTMLElement | null>(null);
const content = ref<HTMLElement | null>(null);

const zoom = ref(props.initialZoom);
const offset = ref({ x: 0, y: 0 });
const dragging = ref(false);
const pointerStart = ref({ x: 0, y: 0 });
const offsetStart = ref({ x: 0, y: 0 });

function zoomBy(delta: number) {
  zoom.value = Math.max(
    props.minZoom,
    Math.min(props.maxZoom, zoom.value + delta),
  );
}

function zoomIn() {
  zoomBy(props.zoomStep);
}

function zoomOut() {
  zoomBy(-props.zoomStep);
}

function reset() {
  zoom.value = props.initialZoom;
  offset.value = { x: 0, y: 0 };
}

function onWheel(event: WheelEvent) {
  event.preventDefault();
  zoomBy(event.deltaY > 0 ? -props.zoomStep : props.zoomStep);
}

function onPointerDown(event: PointerEvent) {
  if (event.button !== 0 || event.isPrimary === false) return;
  dragging.value = true;
  pointerStart.value = { x: event.clientX, y: event.clientY };
  offsetStart.value = offset.value;
  const target = event.currentTarget;
  if (target instanceof HTMLElement) target.setPointerCapture(event.pointerId);
}

function onPointerMove(event: PointerEvent) {
  if (!dragging.value) return;
  event.preventDefault();
  offset.value = {
    x: offsetStart.value.x + (event.clientX - pointerStart.value.x),
    y: offsetStart.value.y + (event.clientY - pointerStart.value.y),
  };
}

function onPointerUp(event: PointerEvent) {
  dragging.value = false;
  const target = event.currentTarget;
  if (target instanceof HTMLElement)
    target.releasePointerCapture(event.pointerId);
}

// 见文件头 ②：`passive: false` 给不出来，只能手挂。
watch(container, (element, previous) => {
  previous?.removeEventListener("wheel", onWheel);
  element?.addEventListener("wheel", onWheel, { passive: false });
});

/** 见文件头 ④：拖拽期间的全局副作用与监听，起止成对。 */
function releaseDragListeners(element: HTMLElement) {
  document.body.style.userSelect = "";
  element.removeEventListener("pointermove", onPointerMove);
  element.removeEventListener("pointerup", onPointerUp);
  element.removeEventListener("pointercancel", onPointerUp);
}

watch([dragging, content], ([active, element], _previous, onCleanup) => {
  if (!active || !element) return;
  document.body.style.userSelect = "none";
  element.addEventListener("pointermove", onPointerMove, { passive: false });
  element.addEventListener("pointerup", onPointerUp);
  element.addEventListener("pointercancel", onPointerUp);
  onCleanup(() => releaseDragListeners(element));
});

onBeforeUnmount(() => {
  container.value?.removeEventListener("wheel", onWheel);
  if (content.value) releaseDragListeners(content.value);
});

const rootClass = computed(() =>
  cn(
    "relative flex flex-col",
    props.fullscreen ? "h-full w-full" : "min-h-28 w-full",
    props.class,
  ),
);

const controlsClass = computed(() =>
  cn(
    "absolute z-10 flex flex-col gap-1 rounded-md border border-border bg-background/80 p-1 supports-[backdrop-filter]:bg-background/70 supports-[backdrop-filter]:backdrop-blur-sm",
    props.fullscreen ? "bottom-4 left-4" : "bottom-2 left-2",
  ),
);

const contentClass = computed(() =>
  cn(
    "flex-1 origin-center transition-transform duration-150 ease-out",
    props.fullscreen
      ? "flex h-full w-full items-center justify-center"
      : "flex w-full items-center justify-center",
  ),
);

const CONTROL_CLASS =
  "flex items-center justify-center rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50";
/** 见文件头 ⑤：重置按钮不带 disabled 变体。 */
const RESET_CLASS =
  "flex items-center justify-center rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";
</script>

<template>
  <div
    ref="container"
    :class="rootClass"
    :style="{ cursor: dragging ? 'grabbing' : 'grab' }"
  >
    <div v-if="props.showControls" :class="controlsClass">
      <button
        :class="CONTROL_CLASS"
        :disabled="zoom >= props.maxZoom"
        :title="$i18n.t.value.primitives.zoomIn"
        type="button"
        @click="zoomIn"
      >
        <MarkdownIcon name="ZoomInIcon" :size="16" />
      </button>
      <button
        :class="CONTROL_CLASS"
        :disabled="zoom <= props.minZoom"
        :title="$i18n.t.value.primitives.zoomOut"
        type="button"
        @click="zoomOut"
      >
        <MarkdownIcon name="ZoomOutIcon" :size="16" />
      </button>
      <button
        :class="RESET_CLASS"
        :title="$i18n.t.value.primitives.resetZoomAndPan"
        type="button"
        @click="reset"
      >
        <MarkdownIcon name="RotateCcwIcon" :size="16" />
      </button>
    </div>
    <div
      ref="content"
      :class="contentClass"
      role="application"
      :style="{
        transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
        transformOrigin: 'center center',
        touchAction: 'none',
        willChange: 'transform',
      }"
      @pointerdown="onPointerDown"
    >
      <slot />
    </div>
  </div>
</template>
