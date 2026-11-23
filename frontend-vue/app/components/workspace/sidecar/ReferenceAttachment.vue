<script setup lang="ts">
/*
  【文件职责】     显示 sidecar 消息选区引用附件。
  【架构位置】     L3 extension reference
  【主要导出】     默认 ReferenceAttachment 组件
  【依赖关系】     useSidecar SidecarReference
  【边界与注意】   ① sidecar 专有引用形状，不进入 L2。

                   ② **提示走 Tooltip 组件，不是 `title`。**
                   上游 reference-attachments.tsx:78 把 `<Tooltip>` 包在
                   **图标 + 标签那一层 span** 上，内容是一个 `w-72` 的预览块
                   （每条引用一行、`line-clamp-3`、原文加引号、空白折叠成单空格）。
                   本仓原来是把 `title` 挂在整个 chip 上，三处可观察差异：
                   原生气泡的延迟/位置/配色不受控（深色主题下尤其突兀）、
                   触屏上根本不出现，而且挂在容器上时**连清除键也会弹**，
                   上游那颗按钮是不弹提示的。ChatComposer.vue 里为语音键
                   写过同一条判据。

                   ③ 清除键上游是
                   `<Button variant="ghost" size="icon-sm"
                   className="text-muted-foreground hover:text-foreground size-6 rounded-full">`。
*/
import { MessageSquareQuote, X } from "lucide-vue-next";
import { computed, type HTMLAttributes } from "vue";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { SidecarReference } from "@/composables/useSidecar";

const props = defineProps<{
  references: SidecarReference[];
  testId?: string;
  clearable?: boolean;
  class?: HTMLAttributes["class"];
}>();
const emit = defineEmits<{ clear: [] }>();
const { $i18n } = useNuxtApp();
const referenceLabel = computed(() =>
  (props.references.length === 1
    ? $i18n.t.value.sidecar.selectedTextFragment
    : $i18n.t.value.sidecar.selectedTextFragments
  ).replace("{count}", String(props.references.length)),
);
/* 上游 reference-attachments.tsx:52 的 formatPreviewText：空白折叠成单空格。 */
function previewText(content: string): string {
  return content.replace(/\s+/g, " ").trim();
}
</script>

<template>
  <div
    v-if="references.length"
    :data-testid="testId"
    :class="
      cn(
        'border-border bg-muted/40 text-foreground inline-flex max-w-[min(18rem,100%)] items-center gap-1.5 rounded-full border px-2.5 py-1.5 shadow-sm',
        props.class,
      )
    "
  >
    <Tooltip>
      <TooltipTrigger>
        <span class="flex min-w-0 cursor-default items-center gap-1.5">
          <MessageSquareQuote class="text-muted-foreground size-4 shrink-0" />
          <span class="truncate text-sm font-medium">
            {{ referenceLabel }}
          </span>
        </span>
      </TooltipTrigger>
      <TooltipContent class="w-72 max-w-[80vw] space-y-1.5">
        <div
          v-for="reference in references"
          :key="reference.id"
          class="line-clamp-3 text-left text-sm leading-6 break-words"
        >
          {{ `"${previewText(reference.context.content)}"` }}
        </div>
      </TooltipContent>
    </Tooltip>
    <Button
      v-if="clearable"
      type="button"
      variant="ghost"
      size="icon-sm"
      :aria-label="$i18n.t.value.sidecar.clearReferences"
      class="text-muted-foreground hover:text-foreground size-6 rounded-full"
      @click="emit('clear')"
    >
      <X class="size-3.5" />
    </Button>
  </div>
</template>
