<!--
  【文件职责】     mermaid 图的下载菜单：SVG / PNG / MMD 三个格式（上游 streamdown 的
                    `MermaidDownloadButton`）。
  【架构位置】     L2 —— 通用渲染层组件
  【主要导出】     默认组件
  【依赖关系】     ./MarkdownIcon.vue · @/core/markdown/mermaid-export · @/core/markdown/rendering-context
  【边界与注意】   ① **不是 shadcn 的 DropdownMenu。** 上游这里是一个绝对定位的裸
                   `<div>` 加三颗普通 `<button>`，没有 `role="menu"`、不传送到 body、
                   也没有 roving tabindex。换成 DropdownMenu 得到的可访问性树完全
                   不同（多一层 menu/menuitem、内容跑到 portal 里），对照会整片红。

                   ② 关菜单听的是 `mousedown` + `composedPath()`，不是 `click`：
                   `click` 要等抬起，期间菜单还在，点击穿透到下面的元素时序会反。
                   `composedPath()` 而不是 `event.target.closest()`——图里可能有
                   shadow root，`target` 会被重定向到宿主。

                   ③ 转码与落盘在 `@/core/markdown/mermaid-export`，不在这里：
                   那是纯逻辑，能单独测；理由与代价写在那个文件的头注释里。

                   ④ 导出失败时**不弹错**——与复制一样，这是浏览器能力问题
                   （canvas 被污染、剪贴板无权限），不是用户做错了什么。
-->

<script setup lang="ts">
import { renderMermaidSvg } from "@/core/markdown/mermaid-renderer";
import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from "vue";

import {
  saveBlob,
  serializeMermaidSvg,
  svgToPngBlob,
} from "@/core/markdown/mermaid-export";
import { markdownStreamingKey } from "@/core/markdown/rendering-context";

import MarkdownIcon from "./MarkdownIcon.vue";

const props = defineProps<{
  /** mermaid 源码，`MMD` 那一项直接下载它。 */
  code: string;
}>();

const open = ref(false);
const root = ref<HTMLElement | null>(null);
let owner: AbortController;
watch(
  () => props.code,
  (_code, _previous, onCleanup) => {
    const controller = new AbortController();
    owner = controller;
    onCleanup(() => controller.abort());
  },
  { immediate: true, flush: "sync" },
);
const streaming = inject(
  markdownStreamingKey,
  computed(() => false),
);

/** 见文件头 ②。 */
function onDocumentMouseDown(event: MouseEvent) {
  const element = root.value;
  if (element && !event.composedPath().includes(element)) open.value = false;
}

onMounted(() => document.addEventListener("mousedown", onDocumentMouseDown));
onBeforeUnmount(() =>
  document.removeEventListener("mousedown", onDocumentMouseDown),
);

async function download(format: "svg" | "png" | "mmd") {
  const signal = owner.signal;
  const code = props.code;
  if (signal.aborted) return;
  try {
    let blob: Blob;
    if (format === "mmd") {
      blob = new Blob([code], { type: "text/plain" });
    } else {
      const svg = await renderMermaidSvg(code);
      if (signal.aborted) return;
      blob =
        format === "svg"
          ? new Blob([serializeMermaidSvg(svg)], { type: "image/svg+xml" })
          : await svgToPngBlob(svg, signal);
    }
    if (signal.aborted) return;
    saveBlob(`diagram.${format}`, blob);
    open.value = false;
  } catch {
    // 见文件头 ④。
  }
}

const ITEM_CLASS =
  "w-full px-3 py-2 text-left text-sm transition-colors hover:bg-muted/40";
</script>

<template>
  <div ref="root" class="relative">
    <button
      class="text-muted-foreground hover:text-foreground cursor-pointer p-1 transition-all disabled:cursor-not-allowed disabled:opacity-50"
      :disabled="streaming"
      :title="$i18n.t.value.markdown.downloadDiagram"
      type="button"
      @click="open = !open"
    >
      <MarkdownIcon name="DownloadIcon" :size="14" />
    </button>
    <div
      v-if="open"
      class="border-border bg-background absolute top-full right-0 z-10 mt-1 min-w-[120px] overflow-hidden rounded-md border shadow-lg"
    >
      <button
        :class="ITEM_CLASS"
        :title="$i18n.t.value.markdown.downloadDiagramAsSvg"
        type="button"
        @click="download('svg')"
      >
        {{ $i18n.t.value.markdown.mermaidFormatSvg }}
      </button>
      <button
        :class="ITEM_CLASS"
        :title="$i18n.t.value.markdown.downloadDiagramAsPng"
        type="button"
        @click="download('png')"
      >
        {{ $i18n.t.value.markdown.mermaidFormatPng }}
      </button>
      <button
        :class="ITEM_CLASS"
        :title="$i18n.t.value.markdown.downloadDiagramAsMmd"
        type="button"
        @click="download('mmd')"
      >
        {{ $i18n.t.value.markdown.mermaidFormatMmd }}
      </button>
    </div>
  </div>
</template>
