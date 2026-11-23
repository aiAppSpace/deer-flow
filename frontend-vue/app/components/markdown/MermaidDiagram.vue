<!--
  【文件职责】     Mermaid MermaidDiagram 的 Streamdown 对应渲染与生命周期。
  【架构位置】     L2
  【主要导出】     MermaidDiagram
  【依赖关系】     markdown primitives · Mermaid renderer
  【边界与注意】   不读取 workspace/业务状态，调用方提供 code 与可访问标签。
-->
<!-- Mermaid block shell mirrors Streamdown; MermaidRenderState owns asynchronous states. -->
<script setup lang="ts">
import MarkdownCopyButton from "./MarkdownCopyButton.vue";
import MermaidRenderState from "./MermaidRenderState.vue";
import MermaidDownloadMenu from "./MermaidDownloadMenu.vue";
import MermaidFullscreen from "./MermaidFullscreen.vue";
const props = defineProps<{ code: string }>();
const LANGUAGE = "mermaid";
</script>

<template>
  <div
    class="group border-border bg-sidebar language-mermaid relative my-4 flex w-full flex-col gap-2 rounded-xl border p-2"
    data-streamdown="mermaid-block"
  >
    <div class="text-muted-foreground flex h-8 items-center text-xs">
      <span class="ml-1 font-mono lowercase">{{ LANGUAGE }}</span>
    </div>
    <div
      class="pointer-events-none sticky top-2 z-10 -mt-10 flex h-8 items-center justify-end"
    >
      <div
        class="border-sidebar bg-sidebar/80 supports-[backdrop-filter]:bg-sidebar/70 pointer-events-auto flex shrink-0 items-center gap-2 rounded-md border px-1.5 py-1 supports-[backdrop-filter]:backdrop-blur"
        data-streamdown="mermaid-block-actions"
      >
        <MermaidDownloadMenu :code="props.code" />
        <MarkdownCopyButton :code="props.code" />
        <MermaidFullscreen :code="props.code" />
      </div>
    </div>
    <div class="border-border bg-background rounded-md border">
      <MermaidRenderState :code="props.code" />
    </div>
  </div>
</template>
