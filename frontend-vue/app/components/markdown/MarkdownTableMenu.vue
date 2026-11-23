<!--
  【文件职责】     普通/全屏表格的复制或下载菜单及反馈。
  【架构位置】     L2 markdown rendering
  【主要导出】     MarkdownTableMenu
  【依赖关系】     core/markdown/table · MarkdownIcon · rendering-context
  【边界与注意】   调用方提供当前真实表格；菜单为普通按钮，保留Streamdown的Tab顺序和mousedown外点生命周期。
-->
<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, ref } from "vue";
import {
  copyTable,
  tableDownload,
  type TableFormat,
} from "@/core/markdown/table";
import { saveBlob } from "@/core/markdown/mermaid-export";
import { markdownStreamingKey } from "@/core/markdown/rendering-context";
import MarkdownIcon from "./MarkdownIcon.vue";

const props = defineProps<{
  kind: "copy" | "download";
  table: HTMLTableElement | null;
}>();
const { $i18n } = useNuxtApp();
const root = ref<HTMLElement | null>(null);
const open = ref(false);
const copied = ref(false);
const streaming = inject(
  markdownStreamingKey,
  computed(() => false),
);
let resetTimer: ReturnType<typeof setTimeout> | undefined;
let active = true;
const choices = computed(() =>
  props.kind === "copy"
    ? [
        {
          format: "markdown" as const,
          title: $i18n.t.value.markdown.copyTableAsMarkdown,
          label: $i18n.t.value.markdown.tableFormatMarkdown,
        },
        {
          format: "csv" as const,
          title: $i18n.t.value.markdown.copyTableAsCsv,
          label: $i18n.t.value.markdown.tableFormatCsv,
        },
        {
          format: "tsv" as const,
          title: $i18n.t.value.markdown.copyTableAsTsv,
          label: $i18n.t.value.markdown.tableFormatTsv,
        },
      ]
    : [
        {
          format: "csv" as const,
          title: $i18n.t.value.markdown.downloadTableAsCsv,
          label: $i18n.t.value.markdown.tableFormatCsv,
        },
        {
          format: "markdown" as const,
          title: $i18n.t.value.markdown.downloadTableAsMarkdown,
          label: $i18n.t.value.markdown.tableFormatMarkdown,
        },
      ],
);
function outside(event: MouseEvent) {
  if (root.value && !event.composedPath().includes(root.value))
    open.value = false;
}
onMounted(() => document.addEventListener("mousedown", outside));
onBeforeUnmount(() => {
  active = false;
  document.removeEventListener("mousedown", outside);
  if (resetTimer !== undefined) clearTimeout(resetTimer);
});
async function select(format: TableFormat) {
  if (streaming.value || !props.table) return;
  try {
    if (props.kind === "copy") {
      if (!(await copyTable(props.table, format)) || !active) return;
      copied.value = true;
      if (resetTimer !== undefined) clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        copied.value = false;
        resetTimer = undefined;
      }, 2000);
    } else if (format !== "tsv") {
      const { filename, blob } = tableDownload(props.table, format);
      saveBlob(filename, blob);
    }
    open.value = false;
  } catch {
    // Streamdown leaves rejected browser operations open and retryable.
  }
}
</script>

<template>
  <div ref="root" class="relative">
    <button
      type="button"
      class="text-muted-foreground hover:text-foreground cursor-pointer p-1 transition-all disabled:cursor-not-allowed disabled:opacity-50"
      :disabled="streaming"
      :title="
        kind === 'copy'
          ? $i18n.t.value.markdown.copyTable
          : $i18n.t.value.markdown.downloadTable
      "
      @click="open = !open"
    >
      <MarkdownIcon
        v-if="kind === 'copy'"
        :name="copied ? 'CheckIcon' : 'CopyIcon'"
        height="14"
        width="14"
      />
      <MarkdownIcon v-else name="DownloadIcon" :size="14" />
    </button>
    <div
      v-if="open"
      class="border-border bg-background absolute top-full right-0 z-20 mt-1 min-w-[120px] overflow-hidden rounded-md border shadow-lg"
    >
      <button
        v-for="choice in choices"
        :key="choice.format"
        type="button"
        class="hover:bg-muted/40 w-full px-3 py-2 text-left text-sm transition-colors"
        :title="choice.title"
        @click="select(choice.format)"
      >
        {{ choice.label }}
      </button>
    </div>
  </div>
</template>
