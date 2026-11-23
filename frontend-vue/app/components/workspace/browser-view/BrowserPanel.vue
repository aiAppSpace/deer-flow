<script setup lang="ts">
import { useMutation } from "@tanstack/vue-query";
import {
  ArrowLeft,
  ArrowRight,
  Globe,
  Loader2,
  Monitor,
  Radio,
  X,
} from "lucide-vue-next";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

import { Button } from "@/components/ui/button";
import { ConversationEmptyState } from "@/components/ui/conversation";
import { Input } from "@/components/ui/input";
import { resolveArtifactURL } from "@/core/artifacts/utils";
import type { BrowserViewFrame } from "@/core/browser/frame";
import {
  mapBrowserPoint,
  browserWheelPixels,
  normalizeBrowserWheel,
  type BrowserNormalizedPoint,
} from "@/core/browser/geometry";
import { useWorkspaceToast } from "@/core/workspace-shell/toast";
import { isImeComposing } from "@/core/input/ime";
import { decideBrowserKeyInput } from "@/core/browser/keyboard";
import type { BrowserInputEvent } from "@/core/browser/protocol";

import { navigateBrowser } from "./browser-api";
import { useBrowserStream } from "./useBrowserStream";

const LIVE_NAV_SPINNER_MS = 1200;

const props = defineProps<{
  threadId: string;
  active: boolean;
  frame?: BrowserViewFrame | null;
}>();
const emit = defineEmits<{
  close: [];
  frame: [frame: BrowserViewFrame];
}>();
const { $i18n } = useNuxtApp();
const toast = useWorkspaceToast();

const requestedLive = ref(true);
const threadId = computed(() => props.threadId);
const streamEnabled = computed(() => props.active && requestedLive.value);
const localFrame = ref<BrowserViewFrame | null>(null);
const staticFrame = computed(() => localFrame.value ?? props.frame ?? null);
const lastLiveUrl = ref<string | null>(null);
const liveFallback = ref<{ frameUrl: string; url?: string } | null>(null);
const seedUrl = computed(
  () =>
    lastLiveUrl.value ??
    liveFallback.value?.url ??
    staticFrame.value?.url ??
    undefined,
);
const stream = useBrowserStream(threadId, streamEnabled, seedUrl, {
  onNavigationRejected(rejectedUrl, message) {
    stopNavSpinner();
    toast.error(
      message?.replace(/^Error:\s*/i, "") ??
        $i18n.t.value.browser.navigationRejected(rejectedUrl),
    );
  },
  onReconnectExhausted() {
    requestedLive.value = false;
    stopNavSpinner();
  },
});
const url = ref("");
const editingUrl = ref(false);
const surface = ref<HTMLImageElement | null>(null);
const stage = ref<HTMLElement | null>(null);
const browserPanel = ref<HTMLElement | null>(null);
const liveNavigating = ref(false);
let navSpinnerTimer: ReturnType<typeof setTimeout> | null = null;
let restController: AbortController | null = null;
let restGeneration = 0;
let wheelFrame: number | null = null;
let pendingWheel: {
  dx: number;
  dy: number;
  point: BrowserNormalizedPoint | null;
} | null = null;

const restMutation = useMutation({
  mutationFn: async (variables: {
    threadId: string;
    url: string;
    signal: AbortSignal;
  }) =>
    navigateBrowser(variables.threadId, variables.url, {
      signal: variables.signal,
    }),
});

const liveActive = computed(
  () => requestedLive.value && stream.status.value === "open",
);
const liveConnecting = computed(
  () => requestedLive.value && stream.status.value === "connecting",
);
const liveLabel = computed(() =>
  requestedLive.value && stream.status.value !== "open"
    ? "…"
    : $i18n.t.value.browser.live,
);
const navigating = computed(
  () => liveNavigating.value || restMutation.isPending.value,
);
const displayFrameUrl = computed(() => {
  const screenshot = staticFrame.value?.screenshot;
  const imageUrl = screenshot
    ? resolveArtifactURL(screenshot, props.threadId)
    : null;
  return requestedLive.value
    ? (stream.frameUrl.value ?? liveFallback.value?.frameUrl ?? imageUrl)
    : (liveFallback.value?.frameUrl ?? imageUrl);
});
const frameAlt = computed(
  () => staticFrame.value?.title ?? $i18n.t.value.browser.panelTitle,
);

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    target.matches("input, textarea, select, [contenteditable=true]")
  );
}

function normalizeTarget(value: string): string | null {
  const target = value.trim();
  if (!target) return null;
  return /^https?:\/\//i.test(target) ? target : `https://${target}`;
}

function stopNavSpinner() {
  if (navSpinnerTimer !== null) {
    clearTimeout(navSpinnerTimer);
    navSpinnerTimer = null;
  }
  liveNavigating.value = false;
}

function startNavSpinner() {
  if (navSpinnerTimer !== null) clearTimeout(navSpinnerTimer);
  liveNavigating.value = true;
  navSpinnerTimer = setTimeout(() => {
    navSpinnerTimer = null;
    liveNavigating.value = false;
  }, LIVE_NAV_SPINNER_MS);
}

function abortRestNavigation() {
  restGeneration += 1;
  restController?.abort();
  restController = null;
}

async function navigateRest(target: string) {
  abortRestNavigation();
  const generation = restGeneration;
  const controller = new AbortController();
  restController = controller;
  try {
    const result = await restMutation.mutateAsync({
      threadId: props.threadId,
      url: target,
      signal: controller.signal,
    });
    if (
      controller.signal.aborted ||
      generation !== restGeneration ||
      !props.active
    ) {
      return;
    }
    url.value = result.url;
    const nextFrame: BrowserViewFrame | null = result.screenshot
      ? {
          screenshot: result.screenshot,
          url: result.url,
          title: result.title,
        }
      : null;
    if (nextFrame) {
      localFrame.value = nextFrame;
      liveFallback.value = null;
      emit("frame", nextFrame);
    } else toast.warning($i18n.t.value.browser.navigatedNoScreenshot);
  } catch (cause) {
    if (controller.signal.aborted || generation !== restGeneration) return;
    toast.error(cause instanceof Error ? cause.message : String(cause));
  } finally {
    if (generation === restGeneration) restController = null;
  }
}

function navigate() {
  if (!requestedLive.value && navigating.value) return;
  const target = normalizeTarget(url.value);
  if (!target) return;
  url.value = target;
  editingUrl.value = false;
  stream.clearError();
  if (requestedLive.value) {
    const disposition = stream.sendInput({ type: "navigate", url: target });
    if (disposition !== "unavailable") {
      startNavSpinner();
      return;
    }
  }
  requestedLive.value = false;
  void navigateRest(target);
}

function toggleLive() {
  requestedLive.value = !requestedLive.value;
  if (requestedLive.value) stream.clearError();
}

function pointFromEvent(event: { clientX: number; clientY: number }) {
  const image = surface.value;
  if (
    !image ||
    !Number.isFinite(event.clientX) ||
    !Number.isFinite(event.clientY)
  ) {
    return null;
  }
  return mapBrowserPoint({
    clientX: event.clientX,
    clientY: event.clientY,
    rect: image.getBoundingClientRect(),
    naturalWidth: image.naturalWidth,
    naturalHeight: image.naturalHeight,
  });
}

function sendLiveInput(input: BrowserInputEvent): boolean {
  return liveActive.value && stream.sendInput(input) === "sent";
}

function clickFrame(event: MouseEvent) {
  const point = pointFromEvent(event);
  if (!point) return;
  sendLiveInput({ type: "click", ...point });
}

function clearPendingWheel() {
  if (wheelFrame !== null) cancelAnimationFrame(wheelFrame);
  wheelFrame = null;
  pendingWheel = null;
}
watch(
  liveActive,
  (active) => {
    if (!active) clearPendingWheel();
  },
  { flush: "sync" },
);

function onWheel(event: WheelEvent) {
  if (!liveActive.value) return;
  const delta = browserWheelPixels(event);
  event.preventDefault();
  event.stopPropagation();
  const point = pointFromEvent(event) ?? { nx: 0.5, ny: 0.5 };
  if (pendingWheel) {
    pendingWheel.dx += delta.dx;
    pendingWheel.dy += delta.dy;
    if (point) pendingWheel.point = point;
  } else {
    pendingWheel = { ...delta, point };
  }
  if (wheelFrame !== null) return;
  wheelFrame = requestAnimationFrame(() => {
    wheelFrame = null;
    const pending = pendingWheel;
    pendingWheel = null;
    if (!pending) return;
    const delta = normalizeBrowserWheel({
      deltaX: pending.dx,
      deltaY: pending.dy,
      deltaMode: 0,
    });
    if (!delta.dx && !delta.dy) return;
    sendLiveInput({
      type: "wheel",
      dx: delta.dx,
      dy: delta.dy,
      ...(pending.point ?? {}),
    });
  });
}

function onKeydown(event: KeyboardEvent) {
  const input = decideBrowserKeyInput({
    eventType: "keydown",
    live: requestedLive.value,
    editableTarget: isEditableTarget(event.target),
    composing: isImeComposing(event),
    key: event.key,
    metaKey: event.metaKey,
    ctrlKey: event.ctrlKey,
    altKey: event.altKey,
    shiftKey: event.shiftKey,
  });
  if (!input || stream.sendInput(input) !== "sent") return;
  event.preventDefault();
  event.stopPropagation();
}

function sendHistory(type: "back" | "forward") {
  sendLiveInput({ type });
}

function selectUrl(event: FocusEvent) {
  editingUrl.value = true;
  (event.target as HTMLInputElement | null)?.select();
}

function closePanel() {
  requestedLive.value = false;
  abortRestNavigation();
  emit("close");
}

watch(
  () => stream.liveUrl.value,
  (nextUrl) => {
    if (!nextUrl) return;
    lastLiveUrl.value = nextUrl;
    stopNavSpinner();
    if (editingUrl.value) return;
    url.value = nextUrl === "about:blank" ? "" : nextUrl;
  },
);

watch([stream.frameUrl, stream.liveUrl], ([frameUrl, liveUrl]) => {
  if (frameUrl)
    liveFallback.value = {
      frameUrl,
      url:
        liveUrl ??
        liveFallback.value?.url ??
        (url.value || staticFrame.value?.url),
    };
});
watch(
  () => staticFrame.value?.screenshot,
  (screenshot, previous) => {
    if (screenshot && screenshot !== previous) liveFallback.value = null;
  },
);
watch(
  [staticFrame, requestedLive],
  ([frame, live]) => {
    if (!live) {
      const nextUrl = liveFallback.value?.url ?? frame?.url;
      if (nextUrl) url.value = nextUrl;
    } else if (frame?.url && !url.value && !stream.liveUrl.value)
      url.value = frame.url;
  },
  { immediate: true },
);

watch(
  () => props.active,
  (active) => {
    if (!active) {
      abortRestNavigation();
      stopNavSpinner();
    }
  },
);

watch(
  () => props.threadId,
  () => {
    abortRestNavigation();
    stopNavSpinner();
    clearPendingWheel();
    localFrame.value = null;
    liveFallback.value = null;
    lastLiveUrl.value = null;
    url.value = props.frame?.url ?? "";
    requestedLive.value = true;
    editingUrl.value = false;
  },
  { flush: "sync" },
);

onMounted(() => {
  stage.value?.addEventListener("wheel", onWheel, { passive: false });
});

onBeforeUnmount(() => {
  stage.value?.removeEventListener("wheel", onWheel);
  abortRestNavigation();
  stopNavSpinner();
  clearPendingWheel();
});
</script>

<template>
  <div
    ref="browserPanel"
    data-testid="browser-panel"
    class="bg-background relative flex size-full flex-col"
    :tabindex="requestedLive ? 0 : undefined"
    @keydown="onKeydown"
  >
    <header
      class="@container flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2"
    >
      <Monitor class="size-4 shrink-0" />
      <span class="shrink-0 text-sm font-medium">
        {{ $i18n.t.value.common.browser }}
      </span>
      <div class="flex shrink-0 items-center">
        <Button
          size="icon-sm"
          variant="ghost"
          class="shrink-0"
          :disabled="!requestedLive"
          :title="$i18n.t.value.browser.back"
          @click="sendHistory('back')"
        >
          <ArrowLeft />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          class="shrink-0"
          :disabled="!requestedLive"
          :title="$i18n.t.value.browser.forward"
          @click="sendHistory('forward')"
        >
          <ArrowRight />
        </Button>
      </div>
      <form
        class="relative flex min-w-0 grow basis-0 items-center @max-[12rem]:basis-full"
        @submit.prevent="navigate"
      >
        <Globe
          class="text-muted-foreground pointer-events-none absolute left-2 size-3.5"
        />
        <Input
          v-model="url"
          :placeholder="$i18n.t.value.browser.urlPlaceholder"
          spellcheck="false"
          autocomplete="off"
          class="h-8 pl-7 text-xs"
          @focus="selectUrl"
          @blur="editingUrl = false"
          @keydown.stop
          @compositionstart.stop
          @compositionend.stop
        />
        <Loader2
          v-if="navigating"
          class="text-muted-foreground absolute right-2 size-3.5 animate-spin"
        />
      </form>
      <Button
        data-testid="browser-mode"
        size="sm"
        :variant="requestedLive ? 'default' : 'ghost'"
        class="shrink-0 gap-1"
        :title="
          requestedLive
            ? $i18n.t.value.browser.stopLiveControl
            : $i18n.t.value.browser.takeLiveControl
        "
        @click="toggleLive"
      >
        <Radio class="size-3.5" />
        {{ liveLabel }}
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        class="shrink-0"
        :aria-label="$i18n.t.value.browser.close"
        @click="closePanel"
      >
        <X />
      </Button>
    </header>

    <main
      class="relative flex min-h-0 grow flex-col overflow-hidden bg-neutral-950"
    >
      <div
        ref="stage"
        data-testid="browser-stage"
        class="relative min-h-0 grow bg-neutral-900"
        @mousedown="browserPanel?.focus({ preventScroll: true })"
      >
        <img
          v-if="displayFrameUrl"
          ref="surface"
          :src="displayFrameUrl"
          :alt="frameAlt"
          draggable="false"
          class="absolute inset-0 size-full cursor-default object-contain object-center"
          @click="clickFrame"
        />
        <ConversationEmptyState
          v-else
          class="absolute inset-0 m-auto h-fit"
          :title="
            requestedLive
              ? $i18n.t.value.browser.connectingFrame
              : $i18n.t.value.browser.noFrame
          "
          :description="
            requestedLive
              ? $i18n.t.value.browser.connectingFrameDescription
              : $i18n.t.value.browser.noFrameDescription
          "
        >
          <template #icon><Monitor /></template>
        </ConversationEmptyState>
        <div
          v-if="(navigating || liveConnecting) && displayFrameUrl"
          class="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-[1px]"
        >
          <Loader2 class="text-muted-foreground size-8 animate-spin" />
        </div>
      </div>
    </main>
  </div>
</template>
