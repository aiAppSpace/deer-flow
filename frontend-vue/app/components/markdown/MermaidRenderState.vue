<!--
  【文件职责】     Mermaid MermaidRenderState 的 Streamdown 对应渲染与生命周期。
  【架构位置】     L2
  【主要导出】     MermaidRenderState
  【依赖关系】     markdown primitives · Mermaid renderer
  【边界与注意】   不读取 workspace/业务状态，调用方提供 code 与可访问标签。
-->
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { renderMermaidSvg } from "@/core/markdown/mermaid-renderer";
import MermaidChart from "./MermaidChart.vue";

const props = withDefaults(
  defineProps<{ code: string; fullscreen?: boolean; showControls?: boolean }>(),
  { fullscreen: false, showControls: true },
);
const { $i18n } = useNuxtApp();
const container = ref<HTMLElement | null>(null);
const shouldRender = ref(props.fullscreen);
const svg = ref("");
const loading = ref(false);
const error = ref<string | null>(null);
let generation = 0;
let observer: IntersectionObserver | undefined;
let debounce: number | undefined;
let idle: number | undefined;
let fallbackIdle = false;
function cancelScheduled() {
  if (debounce !== undefined) window.clearTimeout(debounce);
  if (idle !== undefined) {
    if (fallbackIdle) window.clearTimeout(idle);
    else window.cancelIdleCallback(idle);
  }
  debounce = idle = undefined;
}
function scheduleIdle() {
  const complete = () => {
    shouldRender.value = true;
    observer?.disconnect();
  };
  if (typeof window.requestIdleCallback === "function") {
    fallbackIdle = false;
    idle = window.requestIdleCallback(
      (deadline) => {
        if (deadline.timeRemaining() > 0 || deadline.didTimeout) complete();
        else idle = window.requestIdleCallback(complete, { timeout: 250 });
      },
      { timeout: 500 },
    );
  } else {
    fallbackIdle = true;
    idle = window.setTimeout(complete, 1);
  }
}
onMounted(() => {
  if (shouldRender.value) return;
  if (typeof IntersectionObserver === "undefined") {
    shouldRender.value = true;
    return;
  }
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        cancelScheduled();
        if (entry.isIntersecting)
          debounce = window.setTimeout(() => {
            const pending = observer?.takeRecords() ?? [];
            if (pending.length === 0 || pending.at(-1)?.isIntersecting)
              scheduleIdle();
          }, 300);
      }
    },
    { rootMargin: "300px", threshold: 0 },
  );
  if (container.value) observer.observe(container.value);
});
watch(
  [() => props.code, shouldRender],
  async ([code, ready]) => {
    const owner = ++generation;
    if (!ready) return;
    error.value = null;
    loading.value = true;
    try {
      const result = await renderMermaidSvg(code);
      if (owner !== generation) return;
      svg.value = result;
    } catch (cause) {
      if (owner === generation && !svg.value)
        error.value =
          cause instanceof Error
            ? cause.message
            : $i18n.t.value.primitives.mermaidRenderFailed;
    } finally {
      if (owner === generation) loading.value = false;
    }
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  ++generation;
  cancelScheduled();
  observer?.disconnect();
});
</script>

<template>
  <div
    v-if="!shouldRender && !svg"
    ref="container"
    class="my-4 min-h-[200px]"
  />
  <div
    v-else-if="loading && !svg"
    ref="container"
    class="my-4 flex justify-center p-4"
  >
    <div class="text-muted-foreground flex items-center space-x-2">
      <div
        class="h-4 w-4 animate-spin rounded-full border-b-2 border-current"
      />
      <span class="text-sm">{{ $i18n.t.value.primitives.mermaidLoading }}</span>
    </div>
  </div>
  <div
    v-else-if="error && !svg"
    ref="container"
    class="rounded-md bg-red-50 p-4"
  >
    <p class="font-mono text-sm text-red-700">
      {{ $i18n.t.value.primitives.mermaidError }}{{ error }}
    </p>
    <details class="mt-2">
      <summary class="cursor-pointer text-xs text-red-600">
        {{ $i18n.t.value.primitives.mermaidShowCode }}
      </summary>
      <pre
        class="mt-2 overflow-x-auto rounded bg-red-100 p-2 text-xs text-red-800"
        >{{ code }}</pre>
    </details>
  </div>
  <MermaidChart
    v-else
    :svg="svg"
    :fullscreen="fullscreen"
    :show-controls="showControls"
    :class="fullscreen ? 'size-full [&_svg]:h-auto [&_svg]:w-auto' : undefined"
  />
</template>
