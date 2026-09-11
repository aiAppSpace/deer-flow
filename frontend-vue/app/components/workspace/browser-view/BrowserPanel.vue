<script setup lang="ts">
/*
  【文件职责】     组合 live WebSocket 与 static REST 的唯一 browser 控制面板，并映射远端输入。
  【架构位置】     L3
  【主要导出】     默认 BrowserPanel 组件
  【依赖关系】     useBrowserStream · browser core · browser API · artifact URL · ui/{button,input,conversation} · Vue Query
  【边界与注意】   模式由连接/REST 结果推导；不向 Gateway 发明 mode/state 字段，不双发 click。

                   头部逐件对着上游 browser-view-panel.tsx:340 摆：Button / Input primitive、
                   前进后退外面那层 `flex shrink-0 items-center`、地址栏的 GlobeIcon、
                   以及两处 Loader2（地址栏右侧 + 舞台遮罩）。原来整条头部是手搓的，
                   实测被撑到 URL 栏只剩 36.6px 宽（上游同一屏是 129.3）——那不是调
                   `flex-1` 能修的，是标题 98.7 + 模式按钮 113.9 两块把它挤没了。

                   **有意与上游不同的两处，都不是疏忽。** 原来记的是四处，两条已结清：
                   · `border-border`（wave 32）：那句「本仓 main.css 没有
                     `* { @apply border-border }` 基础层」是错的——规则一直都在，
                     错的是它**裸写在顶层**因而赢过所有工具类；挪进 `@layer base`
                     之后这里的裸 `border-b` 与上游落到同一个颜色。
                   · 关闭按钮（wave 28）：上游那颗**没有任何可访问名**
                     （无 aria-label、无 title，XIcon 还是 aria-hidden），是 WCAG 4.1.2
                     缺陷，已按「根因在 frontend/ 就两边同改」补上。**两边念同一句**
                     （上游 `common.closeBrowser`、本仓 `browser.close`，同字不同路径），
                     所以它不是分叉，只是一条别名——由
                     `tests/unit/i18n/upstream-key-coverage.test.ts` 的别名表守着（wave 39）。

                   剩下的两处：
                   1. `role="alert"` 那条内联错误 + 重试入口：上游走 toast，本仓保留内联
                      提示与重试。对照看不见它——mock 后端没有 WS 端点时要 32 秒才耗尽
                      6 次预算，取样点在 settle+700ms。
                      **原来记的「上游耗尽之后什么都不显示」是错的**（wave 40 量）：
                      上游那颗模式键会**永远画着 "…"**，那个字面意思是「还在连」，
                      而 `scheduleReconnect` 已经彻底 return 了；出路是把它切走再切回来
                      （`enabled` 转 false 时 `setConnectionAttempt(0)`），但界面没有任何
                      地方说得出这一点。**而且这条账把「本仓更好」当成了整件事——
                      同一处缺陷的另一半本仓照抄了**：`liveLabel` 原本写的是
                      `status !== "open"`，本仓耗尽时是 `"error"`，于是本仓那颗键
                      也在说同一句反话。两边已同改，形状不同，见 `liveLabel` 的注释。
                   2. 画面上的 `@mousemove`：上游 forwardMouse 只接了 onClick。本仓多发
                      move（远端页面的 hover 态因此能用），走 WS，台账看不见，
                      由 browser-panel.dom.test.ts 守着。

                   **头部不再显示页面标题**（上游那一格是写死的面板标签 `t.common.browser`，
                   和左边的 MonitorIcon 是一对）。页面标题现在只剩 `<img alt>` 一个出口，
                   与上游 `alt={frame?.title ?? "Browser view"}` 同源。
*/
import { useMutation } from "@tanstack/vue-query";
import {
  ArrowLeft,
  ArrowRight,
  Globe,
  Loader2,
  Monitor,
  Radio,
  RefreshCw,
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
  normalizeBrowserWheel,
  type BrowserNormalizedPoint,
} from "@/core/browser/geometry";
import { decideBrowserKeyInput } from "@/core/browser/keyboard";
import type { BrowserInputEvent } from "@/core/browser/protocol";

import { navigateBrowser } from "./browser-api";
import { useBrowserStream } from "./useBrowserStream";

/*
  上游点一次 Live 导航后亮 1200ms 的转圈：screencast 是连续帧，没有哪一帧算「到了」，
  所以只能给一个固定窗口当反馈（browser-view-panel.tsx:161）。
*/
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

const requestedLive = ref(true);
const threadId = computed(() => props.threadId);
const streamEnabled = computed(() => props.active && requestedLive.value);
const localFrame = ref<BrowserViewFrame | null>(null);
const staticFrame = computed(() => localFrame.value ?? props.frame ?? null);
const lastLiveUrl = ref<string | null>(null);
const seedUrl = computed(
  () =>
    localFrame.value?.url || lastLiveUrl.value || props.frame?.url || undefined,
);
const stream = useBrowserStream(threadId, streamEnabled, seedUrl);
const url = ref("");
const editingUrl = ref(false);
const surface = ref<HTMLImageElement | null>(null);
const stage = ref<HTMLElement | null>(null);
const browserPanel = ref<HTMLElement | null>(null);
const restError = ref<string | null>(null);
/*
  **「导航成功、但一张图都没截到」要说出来。**

  REST 导航回来 `screenshot` 为空时，本仓把 `localFrame` 置空、面板变空白，
  然后空状态照常写着「暂无浏览器活动 / 在上方输入网址…」——用户刚刚输完网址、
  按了回车、导航也确实成功了，界面却让他再输一次。上游这一支有话说
  （`browser-view-panel.tsx` 的 `toast.warning`），只是走的是 toast，
  而这个面板整体不走 toast（理由在文件头）。所以换个出口：**同一句话放进空状态的
  说明位**——那正是用户此刻在看的地方。它不是错误，所以不进 `role="alert"` 那条。
*/
const navigatedWithoutFrame = ref(false);
const retryTarget = ref<string | null>(null);
const composing = ref(false);
const liveNavigating = ref(false);
let navSpinnerTimer: ReturnType<typeof setTimeout> | null = null;
let restController: AbortController | null = null;
let restGeneration = 0;
let moveFrame: number | null = null;
let pendingMove: BrowserNormalizedPoint | null = null;
let lastPoint: BrowserNormalizedPoint | null = null;
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
/*
  上游只有 connecting / open / closed 三态，重连时它是把整个 effect 重跑一遍，
  于是又回到 connecting。本仓的控制器把退避等待单独记成 `reconnecting`，真正
  开 socket 的那一刻仍然是 `connecting`——所以这里比的是同一段时间。
*/
const liveConnecting = computed(
  () => requestedLive.value && stream.status.value === "connecting",
);
/*
  上游 browser-view-panel.tsx:408 的两态：请求了 Live 但还没连上画 "…"，其余都画 Live。
  **但 `error` 不能落进「还没连上」那一支。** 这里原来照抄的是 `!== "open"`，
  而本仓的控制器在重连预算耗尽时发的是 `status: "error"`——于是那颗键会永远画着
  一个意思是「还在连」的 "…"，而它已经彻底不连了。上游同一处也说这句反话
  （它只有三态，耗尽后停在 `closed`，标签一样是 "…"），已按「根因在 frontend/
  就两边同改」处理：上游放弃时退出 live 模式，那颗键回到 "Live"/"Take live
  control"，点一下就重新连（切走会把预算清零）。本仓不走那条路——`stop()` 会把
  快照重置成初始态，连带抹掉下面那条 `role="alert"` 与重试入口，那正是本仓比上游
  好的地方。所以本仓只把标签改诚实：放弃之后画 Live（live 模式确实还开着），
  失败的事实与出路交给内联提示。
*/
const liveLabel = computed(() =>
  requestedLive.value &&
  stream.status.value !== "open" &&
  stream.status.value !== "error"
    ? "…"
    : $i18n.t.value.browser.live,
);
const navigating = computed(
  () => liveNavigating.value || restMutation.isPending.value,
);
const displayFrameUrl = computed(() => {
  if (stream.frameUrl.value) return stream.frameUrl.value;
  const screenshot = staticFrame.value?.screenshot;
  return screenshot ? resolveArtifactURL(screenshot, props.threadId) : null;
});
/** 与上游 `alt={frame?.title ?? "Browser view"}` 同源：取静态帧的标题，不取 live 标题。 */
const frameAlt = computed(
  () => staticFrame.value?.title ?? $i18n.t.value.browser.panelTitle,
);
const alertMessage = computed(() => restError.value ?? stream.error.value);

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
  retryTarget.value = target;
  restError.value = null;
  navigatedWithoutFrame.value = false;
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
    retryTarget.value = null;
    const nextFrame: BrowserViewFrame | null = result.screenshot
      ? {
          screenshot: result.screenshot,
          url: result.url,
          title: result.title,
        }
      : null;
    localFrame.value = nextFrame;
    navigatedWithoutFrame.value = nextFrame === null;
    if (nextFrame) emit("frame", nextFrame);
  } catch (cause) {
    if (controller.signal.aborted || generation !== restGeneration) return;
    restError.value =
      cause instanceof Error
        ? cause.message
        : $i18n.t.value.browser.navigationFailedFallback;
  } finally {
    if (generation === restGeneration) restController = null;
  }
}

function navigate() {
  const target = normalizeTarget(url.value);
  if (!target) return;
  url.value = target;
  editingUrl.value = false;
  restError.value = null;
  stream.clearError();
  retryTarget.value = target;
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

function retryNavigation() {
  if (retryTarget.value) void navigateRest(retryTarget.value);
}

function toggleLive() {
  requestedLive.value = !requestedLive.value;
  restError.value = null;
  if (requestedLive.value) stream.clearError();
}

function retryLive() {
  requestedLive.value = true;
  stream.retry();
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
  lastPoint = point;
  sendLiveInput({ type: "click", ...point });
}

function moveFrameInput(event: MouseEvent) {
  if (!liveActive.value) return;
  pendingMove = pointFromEvent(event);
  if (!pendingMove || moveFrame !== null) return;
  lastPoint = pendingMove;
  moveFrame = requestAnimationFrame(() => {
    moveFrame = null;
    const point = pendingMove;
    pendingMove = null;
    if (point) sendLiveInput({ type: "move", ...point });
  });
}

function onWheel(event: WheelEvent) {
  if (!liveActive.value) return;
  const delta = normalizeBrowserWheel(event);
  if (!delta.dx && !delta.dy) return;
  event.preventDefault();
  event.stopPropagation();
  const point = pointFromEvent(event) ?? lastPoint;
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
    sendLiveInput({
      type: "wheel",
      dx: pending.dx,
      dy: pending.dy,
      ...(pending.point ?? {}),
    });
  });
}

function onKeydown(event: KeyboardEvent) {
  const input = decideBrowserKeyInput({
    eventType: "keydown",
    live: liveActive.value,
    editableTarget: isEditableTarget(event.target),
    composing: composing.value || event.isComposing,
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

function onCompositionEnd(event: CompositionEvent) {
  composing.value = false;
  if (
    !event.data ||
    isEditableTarget(event.target) ||
    !sendLiveInput({ type: "text", text: event.data })
  ) {
    return;
  }
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
    /*
      上游只把**写回地址栏**这一步挡在编辑态后面，`lastLiveUrl` 与「导航结束」是
      无条件的（browser-view-panel.tsx:127）。本仓原来把三件事一起挡住了，于是
      用户正在输入时到达的 live URL 不会进 seed，下一次重连会用一个过期的地址开机。
    */
    lastLiveUrl.value = nextUrl;
    stopNavSpinner();
    if (editingUrl.value) return;
    url.value = nextUrl;
    retryTarget.value = null;
    restError.value = null;
    navigatedWithoutFrame.value = false;
  },
);

watch(
  staticFrame,
  (nextFrame) => {
    if (!editingUrl.value && !stream.liveUrl.value)
      url.value = nextFrame?.url ?? "";
  },
  { immediate: true },
);

watch(
  () => stream.fallbackNavigate.value,
  (fallback) => {
    if (!fallback || !props.active) return;
    requestedLive.value = false;
    void navigateRest(fallback.url);
  },
);

watch(
  () => props.active,
  (active) => {
    if (!active) abortRestNavigation();
  },
);

onMounted(() => {
  stage.value?.addEventListener("wheel", onWheel, { passive: false });
});

onBeforeUnmount(() => {
  stage.value?.removeEventListener("wheel", onWheel);
  abortRestNavigation();
  stopNavSpinner();
  if (moveFrame !== null) cancelAnimationFrame(moveFrame);
  if (wheelFrame !== null) cancelAnimationFrame(wheelFrame);
});
</script>

<template>
  <!--
    这一格用 `div` 而不是 `section`：**没有可访问名的 `<section>` 不是地标**
    （不进可访问性树的 landmark 列表），所以它给不了任何语义，
    而上游同一格用的就是 `div`。wave 96 的 tab 序档把这处标签差异报出来
    （两边都可 tab，只是标签不同），wave 97 按「照抄上游」对齐。
  -->
  <div
    ref="browserPanel"
    data-testid="browser-panel"
    class="bg-background flex size-full flex-col"
    :tabindex="requestedLive ? 0 : undefined"
    @keydown="onKeydown"
    @compositionstart="composing = true"
    @compositionend="onCompositionEnd"
  >
    <header
      class="border-border flex shrink-0 items-center gap-2 border-b px-3 py-2"
    >
      <Monitor class="size-4 shrink-0" />
      <span class="shrink-0 text-sm font-medium">
        {{ $i18n.t.value.common.browser }}
      </span>
      <!--
        前进/后退外面这层容器是上游有的（browser-view-panel.tsx:343）：两颗按钮之间
        **不吃 header 的 gap-2**，是一对紧挨着的图标键。少了它两颗会被推开 8px，
        后面每一件跟着位移。
      -->
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
        class="relative flex min-w-0 flex-1 items-center"
        @submit.prevent="navigate"
      >
        <Globe
          class="text-muted-foreground pointer-events-none absolute left-2 size-3.5"
        />
        <!--
          **不要给它 aria-label**：上游这颗输入框的可访问名来自 placeholder
          （"Enter a URL and press Enter"）。本仓原来挂了一条 `browser.urlLabel`
          （"Browser URL"），它会把 placeholder 顶掉——屏幕阅读器只念得到「浏览器网址」，
          「输入网址后按 Enter」这句操作提示整段丢失。与 wave 16 在 sidecar textarea 上
          修掉的是同一个毛病；那条词条已随之删掉，别再加回来。
        -->
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

    <p
      v-if="alertMessage"
      role="alert"
      class="bg-destructive/10 text-destructive px-3 py-2 text-sm"
    >
      {{ alertMessage }}
      <button
        v-if="restError && retryTarget"
        type="button"
        :aria-label="$i18n.t.value.browser.retryNavigation"
        class="ml-2 underline"
        @click="retryNavigation"
      >
        {{ $i18n.t.value.browser.retryNavigation }}
      </button>
      <button
        v-else-if="stream.canRetry.value"
        type="button"
        :aria-label="$i18n.t.value.browser.retryLive"
        class="ml-2 inline-flex items-center gap-1 underline"
        @click="retryLive"
      >
        <RefreshCw :size="12" /> {{ $i18n.t.value.browser.retryLive }}
      </button>
    </p>

    <main
      class="relative flex min-h-0 grow flex-col overflow-hidden bg-neutral-950"
    >
      <!--
        舞台是 main 里面单独的一层，不是 main 自己：上游 browser-view-panel.tsx:423
        把 stageRef / onMouseDown / bg-neutral-900 都挂在这一层，main 只负责
        `flex-col overflow-hidden` 与更深的 bg-neutral-950。本仓原来把两层压成
        一个 main，于是**画面背后露出来的是 neutral-950 而不是 neutral-900**。
        两层的盒子实际重合（main 的唯一 flex 子节点带 grow），所以这不是几何差异，
        只是底色差一档。
      -->
      <div
        ref="stage"
        data-testid="browser-stage"
        class="relative min-h-0 grow bg-neutral-900"
        @mousedown="browserPanel?.focus()"
      >
        <img
          v-if="displayFrameUrl"
          ref="surface"
          :src="displayFrameUrl"
          :alt="frameAlt"
          draggable="false"
          class="absolute inset-0 size-full cursor-default object-contain object-center"
          @click="clickFrame"
          @mousemove="moveFrameInput"
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
              : navigatedWithoutFrame
                ? $i18n.t.value.browser.navigatedNoScreenshot
                : $i18n.t.value.browser.noFrameDescription
          "
        >
          <template #icon><Monitor /></template>
        </ConversationEmptyState>
        <!--
          舞台遮罩：上游 browser-view-panel.tsx:453。只有**已经有画面**时才盖，
          没有画面那一支归空状态管，两个都画会叠出一层白纱。
        -->
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
