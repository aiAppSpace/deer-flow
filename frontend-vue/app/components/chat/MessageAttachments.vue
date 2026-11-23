<!--
  【文件职责】     渲染HumanMessage 的图片预览、上传状态与普通文件信息卡。
  【架构位置】     L3 消息 UI adapter
  【主要导出】     默认 MessageAttachments 组件
  【依赖关系】     core/messages/attachments · core/artifacts
  【边界与注意】   URL 只从 thread artifact endpoint 构造；缺 path 时不生成链接。
-->

<script setup lang="ts">
import { computed } from "vue";
// 上游 message-list-item.tsx:735 画的是 `FileIcon`（素页），不是 `FileTextIcon`
// （带横线的页）——两颗不同字形。本仓另外两处用 FileText 的地方
// （ExportTrigger / ThreadActionsMenu）与上游一致，不动。
import { FileIcon, LoaderCircle } from "lucide-vue-next";

import { Badge } from "@/components/ui/badge";
import { resolveArtifactURL } from "@/core/artifacts/utils";
import {
  extractMessageAttachments,
  isImageAttachment,
} from "@/core/messages/attachments";
import type { Message } from "@/core/types/message";

const props = defineProps<{
  message: Message;
  threadId?: string | null;
  isMock?: boolean;
}>();
const files = computed(() => extractMessageAttachments(props.message));
function fileUrl(path: string) {
  return props.threadId
    ? resolveArtifactURL(path, props.threadId, { isMock: props.isMock })
    : null;
}
// Same presentation names as message-list-item.tsx's RichFileCard.
const FILE_TYPE_MAP: Record<string, string> = {
  json: "JSON",
  csv: "CSV",
  txt: "TXT",
  md: "Markdown",
  py: "Python",
  js: "JavaScript",
  ts: "TypeScript",
  tsx: "TSX",
  jsx: "JSX",
  html: "HTML",
  css: "CSS",
  xml: "XML",
  yaml: "YAML",
  yml: "YAML",
  pdf: "PDF",
  png: "PNG",
  jpg: "JPG",
  jpeg: "JPEG",
  gif: "GIF",
  svg: "SVG",
  zip: "ZIP",
  tar: "TAR",
  gz: "GZ",
};
function fileTypeLabel(filename: string) {
  const extension = filename.split(".").pop()?.toLowerCase() ?? "";
  return FILE_TYPE_MAP[extension] ?? (extension.toUpperCase() || "FILE");
}
function formatBytes(bytes: number) {
  if (bytes === 0) return "—";
  const kb = bytes / 1024;
  return kb < 1024 ? `${kb.toFixed(1)} KB` : `${(kb / 1024).toFixed(1)} MB`;
}
</script>

<template>
  <div
    v-if="files.length"
    class="mb-2 flex flex-wrap justify-end gap-2"
    data-testid="message-attachments"
  >
    <template
      v-for="file in files"
      :key="`${file.filename}:${file.path ?? file.status}`"
    >
      <div
        v-if="file.status === 'uploading'"
        class="bg-background border-border/40 flex max-w-50 min-w-30 flex-col gap-1 rounded-lg border p-3 opacity-60 shadow-sm"
      >
        <div class="flex items-start gap-2">
          <LoaderCircle
            class="text-muted-foreground mt-0.5 size-4 shrink-0 animate-spin"
          />
          <span
            class="text-foreground truncate text-sm font-medium"
            :title="file.filename"
            >{{ file.filename }}</span
          >
        </div>
        <div class="flex items-center justify-between gap-2">
          <Badge
            variant="secondary"
            class="rounded px-1.5 py-0.5 text-[10px] font-normal"
            >{{ fileTypeLabel(file.filename) }}</Badge
          >
          <span class="text-muted-foreground text-[10px]">{{
            $i18n.t.value.uploads.uploading
          }}</span>
        </div>
      </div>
      <template v-else-if="file.path && fileUrl(file.path)">
        <a
          v-if="isImageAttachment(file)"
          :href="fileUrl(file.path)!"
          target="_blank"
          rel="noopener noreferrer"
          class="group border-border/40 relative block overflow-hidden rounded-lg border"
        >
          <img
            :src="fileUrl(file.path)!"
            :alt="file.filename"
            loading="lazy"
            decoding="async"
            class="h-32 w-auto max-w-60 object-cover transition-transform group-hover:scale-105"
          />
        </a>
        <div
          v-else
          class="bg-background border-border/40 flex max-w-50 min-w-30 flex-col gap-1 rounded-lg border p-3 shadow-sm"
        >
          <div class="flex items-start gap-2">
            <FileIcon class="text-muted-foreground mt-0.5 size-4 shrink-0" />
            <span
              class="text-foreground truncate text-sm font-medium"
              :title="file.filename"
              >{{ file.filename }}</span
            >
          </div>
          <div class="flex items-center justify-between gap-2">
            <Badge
              variant="secondary"
              class="rounded px-1.5 py-0.5 text-[10px] font-normal"
              >{{ fileTypeLabel(file.filename) }}</Badge
            >
            <span class="text-muted-foreground text-[10px]">{{
              formatBytes(file.size)
            }}</span>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>
