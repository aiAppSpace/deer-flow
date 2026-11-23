<!--
  【文件职责】     Markdown表格及其普通/全屏容器。
  【架构位置】     L2 markdown rendering
  【主要导出】     MarkdownTable
  【依赖关系】     MarkdownTableMenu · ui/dialog · rendering-context
  【边界与注意】   普通和全屏菜单各自绑定所属table；共享格式处理但不共享菜单/复制反馈状态。
-->
<script setup lang="ts">
import { computed, inject, ref, useAttrs } from "vue";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { markdownStreamingKey } from "@/core/markdown/rendering-context";
import MarkdownIcon from "./MarkdownIcon.vue";
import MarkdownTableMenu from "./MarkdownTableMenu.vue";

defineOptions({ inheritAttrs: false });
const props = withDefaults(defineProps<{ class?: string }>(), { class: "" });
const attrs = useAttrs();
const { $i18n } = useNuxtApp();
const table = ref<HTMLTableElement | null>(null);
const fullscreenTable = ref<HTMLTableElement | null>(null);
const fullscreen = ref(false);
const streaming = inject(
  markdownStreamingKey,
  computed(() => false),
);
const tableAttrs = computed(() => {
  const { node: _node, class: _class, ...rest } = attrs;
  void _node;
  void _class;
  return rest;
});
</script>

<template>
  <div
    class="border-border bg-sidebar my-4 flex flex-col gap-2 rounded-lg border p-2"
    data-streamdown="table-wrapper"
  >
    <div class="flex items-center justify-end gap-1">
      <MarkdownTableMenu kind="copy" :table="table" />
      <MarkdownTableMenu kind="download" :table="table" />
      <button
        type="button"
        class="text-muted-foreground hover:text-foreground cursor-pointer p-1 transition-all disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="streaming"
        :title="$i18n.t.value.markdown.viewFullscreen"
        @click="fullscreen = true"
      >
        <MarkdownIcon name="Maximize2Icon" :size="14" />
      </button>
    </div>
    <div
      class="border-border bg-background border-collapse overflow-x-auto overflow-y-auto rounded-md border"
    >
      <table
        ref="table"
        v-bind="tableAttrs"
        :class="['divide-border w-full divide-y', props.class]"
        data-streamdown="table"
      >
        <slot />
      </table>
    </div>
  </div>
  <Dialog v-model:open="fullscreen">
    <DialogContent
      data-streamdown="table-fullscreen"
      :aria-label="$i18n.t.value.markdown.viewFullscreen"
      :show-close="false"
      :close-label="$i18n.t.value.markdown.exitFullscreen"
      class="inset-0 top-0 left-0 flex h-full max-h-none max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 p-0 shadow-none sm:max-w-none sm:p-0"
      overlay-class="bg-transparent"
    >
      <DialogTitle class="sr-only">{{
        $i18n.t.value.markdown.viewFullscreen
      }}</DialogTitle>
      <DialogDescription class="sr-only">{{
        $i18n.t.value.markdown.viewFullscreen
      }}</DialogDescription>
      <div class="flex h-full min-h-0 flex-col" data-streamdown="table-wrapper">
        <div class="flex items-center justify-end gap-1 p-4">
          <MarkdownTableMenu kind="copy" :table="fullscreenTable" />
          <MarkdownTableMenu kind="download" :table="fullscreenTable" />
          <button
            type="button"
            class="text-muted-foreground hover:bg-muted hover:text-foreground rounded-md p-1 transition-all"
            :title="$i18n.t.value.markdown.exitFullscreen"
            @click="fullscreen = false"
          >
            <MarkdownIcon name="XIcon" :size="20" />
          </button>
        </div>
        <div
          class="flex-1 overflow-auto p-4 pt-0 [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10"
        >
          <table
            ref="fullscreenTable"
            class="border-border w-full border-collapse border"
            data-streamdown="table"
          >
            <slot />
          </table>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
