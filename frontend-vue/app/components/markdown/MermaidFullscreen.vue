<!--
  【文件职责】     Mermaid MermaidFullscreen 的 Streamdown 对应渲染与生命周期。
  【架构位置】     L2
  【主要导出】     MermaidFullscreen
  【依赖关系】     markdown primitives · Mermaid renderer
  【边界与注意】   不读取 workspace/业务状态，调用方提供 code 与可访问标签。
-->
<!-- Fullscreen uses the shared renderer state and the standard focus-managed dialog. -->
<script setup lang="ts">
import { computed, inject, ref } from "vue";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { markdownStreamingKey } from "@/core/markdown/rendering-context";

import MarkdownIcon from "./MarkdownIcon.vue";
import MermaidRenderState from "./MermaidRenderState.vue";

const props = defineProps<{ code: string }>();

const open = ref(false);
const streaming = inject(
  markdownStreamingKey,
  computed(() => false),
);
</script>

<template>
  <button
    class="text-muted-foreground hover:text-foreground cursor-pointer p-1 transition-all disabled:cursor-not-allowed disabled:opacity-50"
    :disabled="streaming"
    :title="$i18n.t.value.markdown.viewFullscreen"
    type="button"
    @click="open = !open"
  >
    <MarkdownIcon name="Maximize2Icon" :size="14" />
  </button>
  <Dialog v-model:open="open">
    <DialogContent
      :close-label="$i18n.t.value.markdown.exitFullscreen"
      class="bg-background/95 flex size-full max-w-none translate-x-0 translate-y-0 items-center justify-center rounded-none border-0 backdrop-blur-sm sm:max-w-none sm:p-4"
      overlay-class="bg-transparent"
    >
      <DialogHeader class="sr-only">
        <DialogTitle>{{ $i18n.t.value.markdown.viewFullscreen }}</DialogTitle>
        <DialogDescription>
          {{ $i18n.t.value.markdown.viewFullscreen }}
        </DialogDescription>
      </DialogHeader>
      <div
        class="flex size-full items-center justify-center"
        role="presentation"
        @click.stop
      >
        <MermaidRenderState
          class="size-full [&_svg]:h-auto [&_svg]:w-auto"
          fullscreen
          :code="props.code"
        />
      </div>
    </DialogContent>
  </Dialog>
</template>
