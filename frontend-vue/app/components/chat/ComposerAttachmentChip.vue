<!--
  【文件职责】     渲染输入区待发送附件，包含图片缩略图、移除入口与悬停详情。
  【架构位置】     L3
  【主要导出】     默认 ComposerAttachmentChip 组件
  【依赖关系】     File · object URL · ui/hover-card
  【边界与注意】   object URL 仅用于本地预览，文件离开组件时必须立即回收。
-->

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { Paperclip, X } from "lucide-vue-next";

import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

const props = defineProps<{ file: File }>();
const emit = defineEmits<{ remove: [] }>();
const previewUrl = ref<string | null>(null);

function releasePreview() {
  if (previewUrl.value && typeof URL.revokeObjectURL === "function") {
    URL.revokeObjectURL(previewUrl.value);
  }
  previewUrl.value = null;
}

function syncPreview(file: File) {
  releasePreview();
  if (
    file.type.startsWith("image/") &&
    typeof URL.createObjectURL === "function"
  ) {
    previewUrl.value = URL.createObjectURL(file);
  }
}

onMounted(() => syncPreview(props.file));
watch(() => props.file, syncPreview);
onBeforeUnmount(releasePreview);
</script>

<template>
  <HoverCard :open-delay="0" :close-delay="0">
    <HoverCardTrigger>
      <div
        data-testid="composer-attachment"
        class="group border-border hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 relative flex h-8 max-w-60 cursor-pointer items-center gap-1.5 rounded-md border px-1.5 text-sm font-medium transition-all select-none"
      >
        <div class="relative size-5 shrink-0">
          <div
            class="bg-background absolute inset-0 flex size-5 items-center justify-center overflow-hidden rounded transition-opacity group-hover:opacity-0"
          >
            <img
              v-if="previewUrl"
              :src="previewUrl"
              :alt="file.name"
              class="size-5 object-cover"
              width="20"
              height="20"
            />
            <Paperclip
              v-else
              class="text-muted-foreground size-3"
              aria-hidden="true"
            />
          </div>
          <!--
            上游 prompt-input.tsx:336 是
            `<Button variant="ghost" className="absolute inset-0 size-5 cursor-pointer
            rounded p-0 opacity-0 transition-opacity group-hover:pointer-events-auto
            group-hover:opacity-100 [&>svg]:size-2.5">`。手写那版自己写了
            `hover:bg-accent`，缺的是 ghost 变体剩下的两条
            （`hover:text-accent-foreground` / `dark:hover:bg-accent/50`）、
            3px 焦点环与 `disabled:*`。

            **两处与上游不同：**
            ① `focus-visible:opacity-100 focus-visible:pointer-events-auto`
               ——上游此前只有 `group-hover` 才显形，键盘 Tab 到它时**整颗是透明的**，
               焦点落在一个看不见的按钮上（WCAG 2.4.7 / 2.4.11）。
               **wave 73 两边同改**，已补进 `ai-elements/prompt-input.tsx`。
            ② 可访问名带文件名（`artifacts.actions.removeFile(file.name)`），
               上游写死 "Remove attachment"。一次带多个附件时，上游那串名字
               每颗都一样，读屏器听不出在删哪一个。**这一条本仓单方面保留。**
          -->
          <Button
            type="button"
            variant="ghost"
            :aria-label="$i18n.t.value.artifacts.actions.removeFile(file.name)"
            class="absolute inset-0 size-5 cursor-pointer rounded p-0 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100 [&>svg]:size-2.5"
            @click.stop="emit('remove')"
          >
            <X aria-hidden="true" />
          </Button>
        </div>
        <span class="min-w-0 flex-1 truncate">{{ file.name }}</span>
      </div>
    </HoverCardTrigger>
    <HoverCardContent align="start" class="w-auto p-2">
      <div class="w-auto space-y-3">
        <div
          v-if="previewUrl"
          class="flex max-h-96 w-96 items-center justify-center overflow-hidden rounded-md border"
        >
          <img
            :src="previewUrl"
            :alt="file.name"
            class="max-h-full max-w-full object-contain"
            width="448"
            height="384"
          />
        </div>
        <div class="flex items-center gap-2.5">
          <div class="min-w-0 flex-1 space-y-1 px-0.5">
            <h4 class="truncate text-sm leading-none font-semibold">
              {{ file.name }}
            </h4>
            <p
              v-if="file.type"
              class="text-muted-foreground truncate font-mono text-xs"
            >
              {{ file.type }}
            </p>
          </div>
        </div>
      </div>
    </HoverCardContent>
  </HoverCard>
</template>
