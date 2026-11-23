<script setup lang="ts">
import {
  defaultRangeExtractor,
  elementScroll,
  useVirtualizer,
  type Range,
  type VirtualizerOptions,
} from "@tanstack/vue-virtual";
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import type { MessageGroup } from "@/core/messages/utils";

const props = withDefaults(
  defineProps<{
    groups: readonly MessageGroup[];
    streaming: boolean;
    scrollElement: HTMLElement | null;
    followingTail: boolean;
    active?: boolean;
    ownerKey?: string | null;
    contentElement?: HTMLElement | null;
    initialScroll?: "smooth" | "instant";
    resizeScroll?: "smooth" | "instant";
  }>(),
  {
    active: true,
    ownerKey: undefined,
    contentElement: undefined,
    initialScroll: "smooth",
    resizeScroll: "smooth",
  },
);
const emit = defineEmits<{
  activeGroupChange: [index: number];
  readingIntent: [];
}>();
defineSlots<{
  default(props: { group: MessageGroup; index: number }): unknown;
}>();
const root = ref<HTMLElement | null>(null);
const margin = ref(0);
const virtualized = computed(() => props.groups.length >= 60);
function key(index: number) {
  const group = props.groups[index];
  return (
    group?.id ??
    group?.messages.find((message) => message.id)?.id ??
    `${group?.type ?? "message"}:${index}`
  );
}
let lastPosition:
  | { viewport: HTMLElement; top: number; height: number; capacity: number }
  | undefined;
function rememberPosition(viewport: HTMLElement | null) {
  lastPosition = viewport
    ? {
        viewport,
        top: viewport.scrollTop,
        height: viewport.scrollHeight,
        capacity: viewport.clientHeight,
      }
    : undefined;
}
const scrollVirtualizer: VirtualizerOptions<
  HTMLElement,
  Element
>["scrollToFn"] = (offset, options, instance) => {
  // Preserve the library's adjustments, behavior and instance. Internal row
  // measurement and anchor reconciliation use this same public write port.
  elementScroll(offset, options, instance);
  rememberPosition(instance.scrollElement);
};
const virtualizer = useVirtualizer(
  computed(() => ({
    count: props.groups.length,
    getScrollElement: () => props.scrollElement,
    scrollToFn: scrollVirtualizer,
    getItemKey: key,
    estimateSize: () => 176,
    overscan: 8,
    scrollMargin: margin.value,
    rangeExtractor(range: Range) {
      const indexes = defaultRangeExtractor(range);
      const active = props.streaming ? props.groups.length - 1 : -1;
      if (active >= 0 && !indexes.includes(active)) indexes.push(active);
      return indexes.sort((a, b) => a - b);
    },
  })),
);
const rows = computed(() => virtualizer.value.getVirtualItems());
const height = computed(() => virtualizer.value.getTotalSize());
let settleFrame: number | undefined;
let activeFrame: number | undefined;
let followAnimationFrame: number | undefined;
let retainFollowUntil = 0;
let lastTick: number | undefined;
let velocity = 0;
let accumulated = 0;
let positionRevision = 0;
let initialMeasured = false;
let contentResizeObserver: ResizeObserver | undefined;
let observedContent: HTMLElement | null | undefined;
let observedRevision = -1;
let historyAnchor: { scrollHeight: number; scrollTop: number } | undefined;
let lastActive = -1;
let mounted = false;
let mouseDown = false;
function onMouseDown() {
  mouseDown = true;
}
function onMouseUp() {
  mouseDown = false;
}
function isSelecting(viewport: HTMLElement) {
  if (!mouseDown) return false;
  const selection = window.getSelection();
  if (!selection?.rangeCount) return false;
  const common = selection.getRangeAt(0).commonAncestorContainer;
  return common.contains(viewport) || viewport.contains(common);
}
function writeTail(viewport: HTMLElement, top: number) {
  viewport.scrollTop = top;
  rememberPosition(viewport);
}
function onViewportScroll() {
  const viewport = props.scrollElement;
  if (!viewport) return;
  const previous = lastPosition;
  rememberPosition(viewport);
  // Browser focus/scrollIntoView and native scrolling can move the viewport
  // without a wheel or key event. Own writes are recorded synchronously so a
  // coalesced own + external scroll still compares against the actual position.
  // Read current geometry here: layout clamps can precede ResizeObserver.
  if (
    previous?.viewport === viewport &&
    previous.height === viewport.scrollHeight &&
    previous.capacity === viewport.clientHeight &&
    previous.top !== viewport.scrollTop &&
    (isSelecting(viewport) ||
      (props.followingTail && viewport.scrollTop < previous.top))
  )
    emit("readingIntent");
  scheduleActive();
}
let revision = 0;
let anchor:
  { key: string | number | bigint; viewportOffset: number } | undefined;

function captureAnchor(force = false) {
  const viewport = props.scrollElement;
  if (!viewport || (!force && props.followingTail)) return;
  if (!virtualized.value) {
    const top = viewport.getBoundingClientRect().top;
    const first = [
      ...(root.value?.querySelectorAll<HTMLElement>(
        "[data-message-group-index]",
      ) ?? []),
    ].find((row) => row.getBoundingClientRect().bottom >= top);
    if (first)
      anchor = {
        key: key(Number(first.dataset.messageGroupIndex)),
        viewportOffset: first.getBoundingClientRect().top - top,
      };
    return;
  }
  const offset = virtualizer.value.scrollOffset ?? viewport.scrollTop;
  const first = rows.value.find((row) => row.end >= offset);
  if (first) anchor = { key: first.key, viewportOffset: first.start - offset };
}

function captureHistoryAnchor() {
  const viewport = props.scrollElement;
  if (!viewport) return;
  captureAnchor(true);
  historyAnchor = {
    scrollHeight: viewport.scrollHeight,
    scrollTop: viewport.scrollTop,
  };
}
async function completeHistoryLoad() {
  const captured = historyAnchor;
  const viewport = props.scrollElement;
  const owner = revision;
  if (!captured || !viewport) return;
  await nextTick();
  if (
    !mounted ||
    owner !== revision ||
    viewport !== props.scrollElement ||
    historyAnchor !== captured
  )
    return;
  // Long rows and threshold crossings use the measured identity anchor below.
  if (!virtualized.value) {
    viewport.scrollTop =
      captured.scrollTop +
      Math.max(0, viewport.scrollHeight - captured.scrollHeight);
    rememberPosition(viewport);
  }
  if (historyAnchor === captured) historyAnchor = undefined;
}
function stopFollowingTail() {
  // Reading, explicit navigation and tail requests retire every older physical
  // positioning continuation, including a measured jump or history anchor.
  // A parent may handle this same scroll and then capture a history anchor.
  // Accept its current position now so the later listener cannot retire it again.
  rememberPosition(props.scrollElement);
  positionRevision += 1;
  historyAnchor = undefined;
  if (settleFrame !== undefined) cancelAnimationFrame(settleFrame);
  settleFrame = undefined;
  stopFollowAnimation();
}
function stopFollowAnimation() {
  lastTick = undefined;
  velocity = 0;
  accumulated = 0;
  if (followAnimationFrame !== undefined)
    cancelAnimationFrame(followAnimationFrame);
  followAnimationFrame = undefined;
}
function positionInstantly(viewport: HTMLElement) {
  if (virtualized.value && props.groups.length)
    virtualizer.value.scrollToIndex(props.groups.length - 1, { align: "end" });
  writeTail(
    viewport,
    Math.max(0, viewport.scrollHeight - viewport.clientHeight),
  );
}
async function scrollToTail(
  mode: "smooth" | "instant" = "instant",
  automatic = false,
) {
  const viewport = props.scrollElement;
  const owner = revision;
  const request = positionRevision;
  await nextTick();
  if (
    request !== positionRevision ||
    !mounted ||
    owner !== revision ||
    viewport !== props.scrollElement ||
    !viewport ||
    !props.followingTail ||
    props.active === false
  )
    return;
  // Automatic measurements update the target of the existing motion. Explicit
  // submit/append/activation intents may replace it with instant positioning.
  if (automatic && followAnimationFrame !== undefined) return;
  if (!automatic) stopFollowingTail();
  const animationRequest = positionRevision;
  syncMargin();
  const instant = mode === "instant" || virtualized.value;
  if (instant && !isSelecting(viewport)) {
    if (automatic) stopFollowingTail();
    positionInstantly(viewport);
    return;
  }
  retainFollowUntil = performance.now() + 350;
  if (followAnimationFrame !== undefined) return;
  const animate = () => {
    followAnimationFrame = undefined;
    if (
      !mounted ||
      animationRequest !== positionRevision ||
      owner !== revision ||
      viewport !== props.scrollElement ||
      !props.followingTail ||
      props.active === false
    )
      return;
    const tick = performance.now();
    const delta = (tick - (lastTick ?? tick)) / (1000 / 60);
    lastTick = tick;
    // A held text selection pauses motion without accumulating elapsed time.
    // Native selection-edge scrolling is a separate reading intent above.
    if (isSelecting(viewport)) {
      followAnimationFrame = requestAnimationFrame(animate);
      return;
    }
    if (instant) {
      positionInstantly(viewport);
      stopFollowAnimation();
      return;
    }
    const target = Math.max(
      0,
      viewport.scrollHeight - viewport.clientHeight - 1,
    );
    const gap = target - viewport.scrollTop;
    if (gap > 0) {
      // Same physical spring as the React conversation. Accumulation retains
      // subpixel movement when a browser rounds scrollTop feedback.
      velocity = (0.7 * velocity + 0.05 * gap) / 1.25;
      accumulated += velocity * delta;
      const before = viewport.scrollTop;
      writeTail(viewport, before + accumulated);
      if (viewport.scrollTop !== before) accumulated = 0;
    }
    if (tick < retainFollowUntil || viewport.scrollTop < target)
      followAnimationFrame = requestAnimationFrame(animate);
    else stopFollowAnimation();
  };
  followAnimationFrame = requestAnimationFrame(animate);
}

function syncMargin() {
  if (!root.value || !props.scrollElement) return;
  margin.value = Math.max(
    0,
    root.value.getBoundingClientRect().top -
      props.scrollElement.getBoundingClientRect().top +
      props.scrollElement.scrollTop,
  );
}
function alignRow(
  index: number,
  behavior: ScrollBehavior = "auto",
  align: "start" | "center" = "start",
) {
  const viewport = props.scrollElement;
  const row = root.value?.querySelector<HTMLElement>(
    `[data-message-group-index="${index}"]`,
  );
  if (!viewport || !row) return false;
  const rect = row.getBoundingClientRect();
  const padding =
    align === "center"
      ? Math.max(0, (viewport.clientHeight - rect.height) / 2)
      : 16;
  const top =
    viewport.scrollTop +
    rect.top -
    viewport.getBoundingClientRect().top -
    padding;
  viewport.scrollTo({ top: Math.max(0, top), behavior });
  rememberPosition(viewport);
  return true;
}
async function scrollToGroup(
  index: number,
  options: { align?: "start" | "center"; behavior?: ScrollBehavior } = {},
) {
  if (index < 0 || index >= props.groups.length) return;
  const owner = revision;
  stopFollowingTail();
  const token = positionRevision;
  const { align = "start", behavior = "auto" } = options;
  if (settleFrame !== undefined) cancelAnimationFrame(settleFrame);
  if (virtualized.value) {
    virtualizer.value.scrollToIndex(index, {
      align,
      behavior: behavior === "smooth" ? "smooth" : "auto",
    });
  }
  await nextTick();
  // Use the measured row after the estimated virtual window has mounted.
  let attempts = 0;
  const settle = () => {
    if (!mounted || owner !== revision || token !== positionRevision) return;
    const aligned = alignRow(index, attempts === 0 ? behavior : "auto", align);
    if (
      ++attempts < (virtualized.value ? 4 : 2) &&
      (virtualized.value || !aligned)
    )
      settleFrame = requestAnimationFrame(settle);
  };
  settle();
}
function updateActiveGroup() {
  activeFrame = undefined;
  const viewport = props.scrollElement;
  const rendered = root.value?.querySelectorAll<HTMLElement>(
    "[data-message-group-index]",
  );
  if (!viewport || viewport.clientHeight <= 0 || !rendered?.length) return;
  const readingLine = viewport.getBoundingClientRect().top + 96;
  let active = rendered[0]!;
  for (const row of rendered) {
    if (row.getBoundingClientRect().top > readingLine) break;
    active = row;
  }
  const index = Number(active.dataset.messageGroupIndex);
  if (Number.isSafeInteger(index) && index !== lastActive) {
    lastActive = index;
    emit("activeGroupChange", index);
  }
}
function scheduleActive() {
  captureAnchor();
  activeFrame ??= requestAnimationFrame(updateActiveGroup);
}
watch(
  () => props.scrollElement,
  (element, previous) => {
    ++revision;
    anchor = undefined;
    historyAnchor = undefined;
    lastActive = -1;
    if (settleFrame !== undefined) cancelAnimationFrame(settleFrame);
    stopFollowingTail();
    previous?.removeEventListener("scroll", onViewportScroll);
    element?.addEventListener("scroll", onViewportScroll, { passive: true });
    syncMargin();
    observeContent();
  },
  { flush: "post" },
);
watch(
  [() => (props.groups.length ? key(0) : undefined), virtualized],
  async ([first, isVirtual], [previous, wasVirtual]) => {
    const viewport = props.scrollElement;
    if (
      previous === undefined ||
      (first === previous && isVirtual === wasVirtual) ||
      !viewport ||
      props.followingTail
    )
      return;
    const captured = anchor;
    if (!captured) return;
    if (historyAnchor && !isVirtual) return;
    const owner = revision;
    await nextTick();
    if (
      !mounted ||
      owner !== revision ||
      viewport !== props.scrollElement ||
      props.followingTail
    )
      return;
    syncMargin();
    const index = props.groups.findIndex(
      (_, index) => key(index) === captured.key,
    );
    if (index < 0) return;
    const row = root.value?.querySelector<HTMLElement>(
      `[data-message-group-index="${index}"]`,
    );
    const start = isVirtual
      ? virtualizer.value.getOffsetForIndex(index, "start")?.[0]
      : row
        ? viewport.scrollTop +
          row.getBoundingClientRect().top -
          viewport.getBoundingClientRect().top
        : undefined;
    if (start !== undefined) {
      virtualizer.value.scrollToOffset(
        Math.max(0, start - captured.viewportOffset),
      );
    }
  },
);
watch(
  [
    height,
    () => props.groups.length,
    virtualized,
    () => props.followingTail,
    () => props.active,
  ],
  (values, previous) => {
    if (!props.followingTail || props.active === false) {
      // Data/measurement updates while reading must keep an owned history
      // anchor; only a newer explicit positioning intent retires that anchor.
      stopFollowAnimation();
      return;
    }
    if (virtualized.value) void scrollToTail("instant");
    else if (!initialMeasured && values[1] > 0 && previous[1] === 0) {
      // A loaded history can replace an equally sized empty placeholder. That
      // content lifecycle is initial even when no new RO height is delivered.
      initialMeasured = true;
      void scrollToTail(props.initialScroll, true);
    } else if (initialMeasured && values[1] > previous[1])
      void scrollToTail("instant");
    else if (initialMeasured && (!previous[3] || !previous[4]))
      void scrollToTail(props.resizeScroll, true);
  },
  { flush: "post" },
);
watch(
  () => props.streaming,
  (streaming) => {
    if (!streaming && initialMeasured)
      void scrollToTail(props.resizeScroll, true);
  },
  { flush: "post" },
);
function observeContent() {
  const element = props.contentElement ?? root.value;
  const owner = revision;
  if (
    contentResizeObserver &&
    element === observedContent &&
    owner === observedRevision
  )
    return;
  stopFollowingTail();
  contentResizeObserver?.disconnect();
  contentResizeObserver = undefined;
  observedContent = element;
  observedRevision = owner;
  initialMeasured = false;
  if (!element || !("ResizeObserver" in globalThis)) return;
  let previousHeight: number | undefined;
  const observer = new ResizeObserver((entries) => {
    if (!mounted || owner !== revision || contentResizeObserver !== observer)
      return;
    const entry = entries.find((entry) => entry.target === element);
    if (!entry) return;
    const height = entry.contentRect.height;
    const previous = previousHeight;
    previousHeight = height;
    if (!props.groups.length || height <= 0) return;
    const first = !initialMeasured;
    initialMeasured = true;
    if (first || previous === undefined || height >= previous)
      void scrollToTail(first ? props.initialScroll : props.resizeScroll, true);
  });
  contentResizeObserver = observer;
  observer.observe(element);
  if (mounted && virtualized.value) void scrollToTail("instant");
}
watch([() => props.contentElement, root], observeContent, { flush: "post" });
watch(
  () => props.ownerKey,
  () => {
    const owner = ++revision;
    initialMeasured = false;
    anchor = undefined;
    historyAnchor = undefined;
    lastActive = -1;
    if (settleFrame !== undefined) cancelAnimationFrame(settleFrame);
    if (activeFrame !== undefined) cancelAnimationFrame(activeFrame);
    settleFrame = undefined;
    activeFrame = undefined;
    stopFollowingTail();
    void nextTick(() => {
      if (mounted && owner === revision) {
        observeContent();
        scheduleActive();
      }
    });
  },
  { flush: "sync" },
);
watch(rows, scheduleActive, { flush: "post" });
onMounted(() => {
  mounted = true;
  rememberPosition(props.scrollElement);
  syncMargin();
  props.scrollElement?.addEventListener("scroll", onViewportScroll, {
    passive: true,
  });
  window.addEventListener("resize", syncMargin);
  document.addEventListener("mousedown", onMouseDown);
  document.addEventListener("mouseup", onMouseUp);
  document.addEventListener("click", onMouseUp);
  scheduleActive();
  observeContent();
  if (virtualized.value) void scrollToTail("instant");
});
onBeforeUnmount(() => {
  mounted = false;
  revision += 1;
  props.scrollElement?.removeEventListener("scroll", onViewportScroll);
  window.removeEventListener("resize", syncMargin);
  document.removeEventListener("mousedown", onMouseDown);
  document.removeEventListener("mouseup", onMouseUp);
  document.removeEventListener("click", onMouseUp);
  if (settleFrame !== undefined) cancelAnimationFrame(settleFrame);
  if (activeFrame !== undefined) cancelAnimationFrame(activeFrame);
  stopFollowingTail();
  lastPosition = undefined;
  contentResizeObserver?.disconnect();
});
defineExpose({
  scrollToGroup,
  scrollToTail,
  stopFollowingTail,
  captureHistoryAnchor,
  completeHistoryLoad,
});
</script>

<template>
  <div
    ref="root"
    data-testid="message-list"
    :class="virtualized ? 'relative w-full' : 'flex w-full flex-col gap-8'"
    :style="virtualized ? { height: `${height}px` } : undefined"
  >
    <template v-if="!virtualized">
      <div
        v-for="(group, index) in groups"
        :key="key(index)"
        :data-index="index"
        :data-message-group-index="index"
      >
        <slot :group="group" :index="index" />
      </div>
    </template>
    <template v-else>
      <div
        v-for="row in rows"
        :key="String(row.key)"
        :ref="
          (element) => virtualizer.measureElement(element as Element | null)
        "
        :data-index="row.index"
        :data-message-group-index="row.index"
        class="absolute top-0 left-0 w-full pb-8"
        :style="{ transform: `translateY(${row.start - margin}px)` }"
      >
        <slot
          v-if="groups[row.index]"
          :group="groups[row.index]!"
          :index="row.index"
        />
      </div>
    </template>
  </div>
</template>
