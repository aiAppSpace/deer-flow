<!--
  【文件职责】     渲染好的 mermaid SVG + 缩放平移外壳（上游 streamdown 的 `Mermaid` 成功态）。
  【架构位置】     L2 —— 通用渲染层组件
  【主要导出】     默认组件
  【依赖关系】     ./MermaidZoomPan.vue · @/lib/utils
  【边界与注意】   ① 只画已渲染成功的 SVG。placeholder / spinner / error 由
                   MermaidRenderState 共享负责，普通图与全屏使用相同状态机。

                   ② 图容器是 `role="img"` + `aria-label`。两个都要：只给 aria-label
                   而不给 role，读屏器仍然会往里走并逐个念 SVG 里的文本节点，
                   听到的是一堆散落的节点标签而不是「一张图」。

                   ③ `class` 同时落在**根节点与 ZoomPan 上**，上游如此。全屏那一路
                   靠它把 `size-full` 一直传到最里层，少传一处图就不铺满。

                   ④ `v-html` 只消费 Mermaid 渲染器生成的 SVG；不接收用户直接提供的 HTML。
-->

<script setup lang="ts">
import { computed } from "vue";

import { cn } from "@/lib/utils";

import MermaidZoomPan from "./MermaidZoomPan.vue";

const props = withDefaults(
  defineProps<{
    svg: string;
    class?: string;
    fullscreen?: boolean;
    showControls?: boolean;
  }>(),
  { class: "", fullscreen: false, showControls: true },
);

const rootClass = computed(() => cn("size-full", props.class));

const zoomPanClass = computed(() =>
  cn(
    props.fullscreen ? "size-full overflow-hidden" : "overflow-hidden",
    props.class,
  ),
);

const chartClass = computed(() =>
  cn("flex justify-center", props.fullscreen ? "size-full items-center" : null),
);
</script>

<template>
  <div :class="rootClass" data-streamdown="mermaid">
    <MermaidZoomPan
      :class="zoomPanClass"
      :fullscreen="props.fullscreen"
      :max-zoom="3"
      :min-zoom="0.5"
      :show-controls="props.showControls"
      :zoom-step="0.1"
    >
      <!-- eslint-disable vue/no-v-html —— 见文件头 ④ -->
      <div
        :aria-label="$i18n.t.value.primitives.mermaidChart"
        :class="chartClass"
        role="img"
        v-html="props.svg"
      />
      <!-- eslint-enable vue/no-v-html -->
    </MermaidZoomPan>
  </div>
</template>
