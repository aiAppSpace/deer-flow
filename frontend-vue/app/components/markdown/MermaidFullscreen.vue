<!--
  【文件职责】     mermaid 图的全屏查看（上游 streamdown 的 `MermaidFullscreenButton`）。
  【架构位置】     L2 —— 通用渲染层组件
  【主要导出】     默认组件
  【依赖关系】     ui/dialog · ./MarkdownIcon.vue · ./MermaidChart.vue · @/core/markdown/rendering-context
  【边界与注意】   **壳子走 `ui/dialog`，不再手搓遮罩**（wave 148 系统扫描后统一改的
                   三处之一，另两处是移动端侧栏抽屉与外链确认弹窗）。

                   原来这里逐字照抄 streamdown：一个 `createPortal` 到 body 的裸遮罩，
                   带 `role="button"` + `tabindex="0"`（点它任意处关闭），
                   **没有 dialog 语义、没有焦点陷阱、不给兄弟节点打 `aria-hidden`、
                   关闭后不归还焦点**，外加一份手写的模块级引用计数滚动锁。

                   **为什么这一次不再「照抄第三方包」**：这块代码来自 npm 包
                   `streamdown`，两个应用引的是同一个包，所以它与 `/auth/callback`
                   同一档——能改的只有本仓一侧。此前的结论是「改了就是纯粹制造差异，
                   对齐价值为零」。**wave 92 在同一个包上做过相反的决定并且沿用至今**：
                   mermaid 工具条的文案上游写死英文、改不了，本仓保留了翻译，
                   台账为此记着 14 行。判据是 fork-boundary 那条已授权的例外
                   ——**「vue 有更好的可以保留」**。一个全屏浮层对读屏器来说不是对话框、
                   Tab 能走到它背后去，属于同一档，而且比文案更硬。

                   代价是明的：可访问性树上本仓会多出 dialog / title / description
                   三层节点与一层 portal 容器，**台账为此记账**（逐条见一页纸清单）。
                   **翻案判据**：streamdown 哪天自己换成真正的 dialog，这里跟着回退。

                   仍然照抄的一处：内容层挡住 click，否则点图上任何一处都会关掉全屏
                   ——而全屏的用途正是在图上拖拽和缩放。滚动锁、Escape、焦点归还
                   现在都由 reka 的 `DialogContentModal` 承担，本仓不再自己写一份。
-->

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
import MermaidChart from "./MermaidChart.vue";

const props = defineProps<{ svg: string }>();

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
      class="bg-background/95 flex size-full max-w-none translate-x-0 translate-y-0 items-center justify-center rounded-none border-0 p-4 backdrop-blur-sm sm:max-w-none"
      overlay-class="bg-transparent"
    >
      <DialogHeader class="sr-only">
        <DialogTitle>{{ $i18n.t.value.markdown.viewFullscreen }}</DialogTitle>
        <DialogDescription>
          {{ $i18n.t.value.markdown.viewFullscreen }}
        </DialogDescription>
      </DialogHeader>
      <!-- 内容层挡住 click：见文件头。 -->
      <div
        class="flex size-full items-center justify-center"
        role="presentation"
        @click.stop
      >
        <MermaidChart
          class="size-full [&_svg]:h-auto [&_svg]:w-auto"
          fullscreen
          :svg="props.svg"
        />
      </div>
    </DialogContent>
  </Dialog>
</template>
