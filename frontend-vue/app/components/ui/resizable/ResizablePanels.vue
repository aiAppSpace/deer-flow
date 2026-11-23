<!--
  【文件职责】     水平多面板 primitive：原生指针捕获、键盘尺寸调整和实例资源清理。
  【架构位置】     L2
  【主要导出】     ResizablePanels
  【依赖关系】     Vue、通用 class 工具、同目录布局策略与类型。
  【边界与注意】   调用方拥有呈现、业务身份和持久化；取消手势不发提交事件。
-->
<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  useId,
  watch,
  type HTMLAttributes,
} from "vue";

import { cn } from "@/lib/utils";

import { declaredLayout, paneRange, resizeLayout, sameLayout } from "./layout";
import type { ResizableLayoutEvent, ResizablePanel } from "./types";

const props = withDefaults(
  defineProps<{
    panels: readonly ResizablePanel[];
    sizes: readonly number[];
    disabled?: boolean;
    ownerKey: string;
    keyboardStep?: number;
    class?: HTMLAttributes["class"];
    handleClass?: HTMLAttributes["class"];
  }>(),
  {
    disabled: false,
    keyboardStep: 5,
    class: undefined,
    handleClass: undefined,
  },
);
const emit = defineEmits<{
  resize: [payload: ResizableLayoutEvent];
  resized: [payload: ResizableLayoutEvent];
}>();

const group = ref<HTMLElement | null>(null);
const id = useId();
const paneId = (panel: ResizablePanel) => `${id}-pane-${panel.id}`;
const layout = ref(declaredLayout(props.panels, props.sizes));
const expanded = new Map<string, number>();
let mounted = false;
let ownerRevision = 0;
interface Gesture {
  pointerId: number;
  divider: number;
  element: HTMLElement;
  document: Document;
  window: Window;
  startX: number;
  width: number;
  initial: number[];
  ownerKey: string;
  ownerRevision: number;
  changed: boolean;
}
const gesture = shallowRef<Gesture | null>(null);
const ranges = computed(() =>
  props.panels.map((_, index) => paneRange(props.panels, index)),
);

function retireGesture() {
  const current = gesture.value;
  if (!current) return;
  // Clear the transaction before release; lostpointercapture may fire synchronously.
  gesture.value = null;
  current.window.removeEventListener("blur", cancelGesture);
  current.document.removeEventListener("visibilitychange", onVisibilityChange);
  if (current.element.hasPointerCapture(current.pointerId))
    current.element.releasePointerCapture(current.pointerId);
}
function cancelGesture() {
  retireGesture();
}
function onVisibilityChange() {
  if (gesture.value?.document.visibilityState === "hidden") retireGesture();
}
function valid(current: Gesture) {
  return (
    mounted &&
    gesture.value === current &&
    !props.disabled &&
    props.ownerKey === current.ownerKey &&
    ownerRevision === current.ownerRevision
  );
}
function rememberExpanded() {
  props.panels.forEach((panel, index) => {
    if (
      layout.value[index]! >= (panel.minSize ?? 0) &&
      layout.value[index]! > (panel.collapsedSize ?? 0)
    )
      expanded.set(panel.id, layout.value[index]!);
  });
}
function payload(event: PointerEvent | KeyboardEvent): ResizableLayoutEvent {
  return {
    event,
    panes: props.panels.map((panel, index) => ({
      id: panel.id,
      size: layout.value[index]!,
    })),
  };
}

watch(
  () => props.ownerKey,
  () => {
    ownerRevision++;
    retireGesture();
    expanded.clear();
    layout.value = declaredLayout(props.panels, props.sizes);
  },
  { flush: "sync" },
);
watch(
  () => props.disabled,
  (disabled) => {
    if (!disabled) return;
    ownerRevision++;
    retireGesture();
    layout.value = declaredLayout(props.panels, props.sizes);
  },
  { flush: "sync" },
);
watch(
  () => props.sizes,
  (sizes) => {
    const declared = declaredLayout(props.panels, sizes);
    if (sameLayout(declared, layout.value)) return; // A caller may echo a native preview.
    ownerRevision++;
    retireGesture();
    layout.value = declared;
  },
  { deep: true, flush: "sync" },
);
watch(
  () =>
    props.panels.map(
      ({ id: key, minSize, maxSize, collapsible, collapsedSize }) => [
        key,
        minSize,
        maxSize,
        collapsible,
        collapsedSize,
      ],
    ),
  (next, previous) => {
    if (
      next.length === previous.length &&
      next.every((values, index) =>
        values.every((value, field) => value === previous[index]?.[field]),
      )
    )
      return;
    ownerRevision++;
    retireGesture();
    layout.value = declaredLayout(props.panels, props.sizes);
  },
  { deep: true, flush: "sync" },
);

function onPointerDown(event: PointerEvent, divider: number) {
  if (
    !mounted ||
    props.disabled ||
    event.defaultPrevented ||
    event.button !== 0 ||
    event.isPrimary === false ||
    gesture.value
  )
    return;
  const element = event.currentTarget;
  if (!(element instanceof HTMLElement) || !group.value) return;
  const document = element.ownerDocument,
    window = document.defaultView;
  if (!window || typeof element.setPointerCapture !== "function") return;
  // Panels share the space remaining after the handles, matching CSS flex-grow.
  const width = Array.from(group.value.children)
    .filter((child) => child.hasAttribute("data-panel"))
    .reduce((sum, child) => sum + child.getBoundingClientRect().width, 0);
  if (width <= 0) return;
  element.setPointerCapture(event.pointerId);
  gesture.value = {
    pointerId: event.pointerId,
    divider,
    element,
    document,
    window,
    startX: event.clientX,
    width,
    initial: [...layout.value],
    ownerKey: props.ownerKey,
    ownerRevision,
    changed: false,
  };
  window.addEventListener("blur", cancelGesture);
  document.addEventListener("visibilitychange", onVisibilityChange);
  rememberExpanded();
  event.preventDefault();
  element.focus({ preventScroll: true });
}
function onPointerMove(event: PointerEvent) {
  const current = gesture.value;
  if (!current || event.pointerId !== current.pointerId || !valid(current))
    return;
  event.preventDefault();
  const next = resizeLayout(
    current.initial,
    layout.value,
    props.panels,
    current.divider,
    ((event.clientX - current.startX) / current.width) * 100,
    false,
  );
  if (sameLayout(next, layout.value)) return;
  layout.value = next;
  current.changed = true;
  rememberExpanded();
  emit("resize", payload(event));
  // No writes after emitting: the caller may synchronously retire or unmount us.
}
function onPointerUp(event: PointerEvent) {
  const current = gesture.value;
  if (!current || event.pointerId !== current.pointerId || !valid(current))
    return;
  onPointerMove(event);
  if (!valid(current)) return;
  const changed = current.changed;
  const result = payload(event);
  retireGesture();
  if (
    changed &&
    mounted &&
    !props.disabled &&
    props.ownerKey === current.ownerKey &&
    ownerRevision === current.ownerRevision
  )
    emit("resized", result);
}
function onPointerCancel(event: PointerEvent) {
  if (event.pointerId === gesture.value?.pointerId) retireGesture();
}

function onKeyDown(event: KeyboardEvent, divider: number) {
  if (
    !mounted ||
    props.disabled ||
    event.defaultPrevented ||
    event.target !== event.currentTarget ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.isComposing
  )
    return;
  if (event.key === "F6") {
    event.preventDefault();
    const handles = group.value?.querySelectorAll<HTMLElement>(
      ":scope > [data-resize-handle]",
    );
    if (handles?.length)
      handles[
        (divider + (event.shiftKey ? -1 : 1) + handles.length) % handles.length
      ]?.focus();
    return;
  }
  let delta: number;
  switch (event.key) {
    case "ArrowLeft":
      delta = -props.keyboardStep;
      break;
    case "ArrowRight":
      delta = props.keyboardStep;
      break;
    case "Home":
      delta = -100;
      break;
    case "End":
      delta = 100;
      break;
    case "Enter": {
      const panel = props.panels[divider]!;
      if (!panel.collapsible) return;
      const collapsed = panel.collapsedSize ?? 0;
      delta =
        (layout.value[divider] === collapsed
          ? (expanded.get(panel.id) ?? panel.minSize ?? 0)
          : collapsed) - layout.value[divider]!;
      break;
    }
    default:
      return;
  }
  event.preventDefault();
  retireGesture();
  const ownerKey = props.ownerKey;
  const revision = ownerRevision;
  const next = resizeLayout(
    layout.value,
    layout.value,
    props.panels,
    divider,
    delta,
    true,
  );
  if (sameLayout(next, layout.value)) return;
  layout.value = next;
  rememberExpanded();
  const result = payload(event);
  emit("resize", result);
  if (
    mounted &&
    !props.disabled &&
    props.ownerKey === ownerKey &&
    ownerRevision === revision
  )
    emit("resized", result);
}

onMounted(() => {
  mounted = true;
});
onBeforeUnmount(() => {
  mounted = false;
  ownerRevision++;
  retireGesture();
});
</script>

<template>
  <div
    ref="group"
    data-panel-group
    data-panel-group-direction="horizontal"
    data-slot="resizable-panel-group"
    :class="cn('flex h-full w-full min-w-0', props.class)"
    :style="{ userSelect: gesture ? 'none' : undefined }"
  >
    <template v-for="(panel, index) in props.panels" :key="panel.id">
      <div
        :id="paneId(panel)"
        data-panel
        data-slot="resizable-panel"
        :data-panel-id="panel.id"
        :data-panel-size="layout[index]"
        :class="cn('min-h-0 min-w-0 overflow-hidden', panel.class)"
        :style="{ flexBasis: '0px', flexGrow: layout[index], flexShrink: 1 }"
      >
        <slot
          :id="panel.id"
          :name="panel.id"
          :index="index"
          :size="layout[index]"
        />
      </div>
      <div
        v-if="index < props.panels.length - 1"
        data-resize-handle
        data-slot="resizable-handle"
        :data-state="gesture?.divider === index ? 'drag' : 'inactive'"
        :data-disabled="props.disabled ? '' : undefined"
        role="separator"
        aria-orientation="vertical"
        :aria-controls="paneId(panel)"
        :aria-disabled="props.disabled ? true : undefined"
        :aria-valuemin="ranges[index]?.min"
        :aria-valuemax="ranges[index]?.max"
        :aria-valuenow="layout[index]"
        :tabindex="props.disabled ? -1 : 0"
        :class="
          cn(
            'bg-border focus-visible:ring-ring relative flex w-px shrink-0 touch-none items-center justify-center after:absolute after:inset-y-0 after:left-1/2 after:w-4 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:outline-hidden',
            props.handleClass,
          )
        "
        :style="{ cursor: props.disabled ? 'not-allowed' : 'col-resize' }"
        @pointerdown="onPointerDown($event, index)"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerCancel"
        @lostpointercapture="onPointerCancel"
        @keydown="onKeyDown($event, index)"
      >
        <slot
          :id="panel.id"
          name="handle"
          :index="index"
          :disabled="props.disabled"
          :state="gesture?.divider === index ? 'drag' : 'inactive'"
        />
      </div>
    </template>
  </div>
</template>
