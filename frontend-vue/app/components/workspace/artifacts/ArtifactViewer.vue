<!--
  【文件职责】     独立视窗里的产物阅读器：头部信息、截断提示、内容区。
  【架构位置】     L4 产品组件
  【主要导出】     默认 ArtifactViewer 组件
  【依赖关系】     composables/useStandaloneArtifactContent · ArtifactPreview · ui/button
  【边界与注意】   - 打不开也要**给得出出路**：加载失败时不是一句「失败」了事，
                   头部那两个入口（查看源文件 / 下载）始终在，因为它们不依赖
                   这次加载的结果。
                 - 表格不套 `max-w-4xl`：表格要横向铺开，正文才需要一个易读宽度。
                 - 截断提示对表格不显示：表格预览自己就把「这是有界样本」画在
                   页脚了，再叠一条只会让人以为是两件事。
-->

<script setup lang="ts">
import { computed } from "vue";
import { Download, ExternalLink, Loader } from "lucide-vue-next";

import { Button } from "@/components/ui/button";
import ArtifactPreview from "./ArtifactPreview.vue";
import { useStandaloneArtifactContent } from "@/composables/useStandaloneArtifactContent";
import {
  artifactFileIcon,
  artifactFileName,
  formatArtifactBytes,
} from "@/core/artifacts/display";
import { classifyArtifact, getTabularDelimiter } from "@/core/artifacts/policy";
import { urlOfArtifact } from "@/core/artifacts/utils";
import { resolveStoredArtifactLanguage } from "@/core/artifacts/viewer";

const props = defineProps<{
  filepath: string;
  threadId: string;
  isMock: boolean;
}>();

const { $i18n } = useNuxtApp();

const target = computed(() => ({
  filepath: props.filepath,
  threadId: props.threadId,
  isMock: props.isMock,
}));

const {
  content,
  url,
  truncated,
  previewBytes,
  totalBytes,
  fullContentRequested,
  loadFullContent,
  isLoading,
  error,
} = useStandaloneArtifactContent(target);

const filename = computed(() => artifactFileName(props.filepath));
const language = computed(
  () => resolveStoredArtifactLanguage(props.filepath) ?? "text",
);
const isTabular = computed(() => getTabularDelimiter(language.value) !== null);
const isLoadingFullFile = computed(
  () => fullContentRequested.value && isLoading.value,
);

/*
  预览组件按 policy 分发，所以这里要把「视窗认定的语言」交给它。
  视窗只接 markdown 与表格（viewer.ts 的 resolveArtifactOpenURL 已经把别的挡在
  外面），两者都是文本，policy 的 kind 也是 text。
*/
const policy = computed(() => ({
  ...classifyArtifact(props.filepath),
  kind: "text" as const,
  language: language.value,
  previewKind: null,
}));

const sourceUrl = computed(() => urlOfArtifact(target.value));
const downloadUrl = computed(() =>
  urlOfArtifact({ ...target.value, download: true }),
);
/** 后端没报 previewBytes 时按默认预览窗口显示，与产物面板同一句话。 */
const previewedSize = computed(
  () => formatArtifactBytes(previewBytes.value) ?? "1 MiB",
);
</script>

<template>
  <div class="bg-background flex h-screen flex-col">
    <header
      class="border-border bg-background/95 sticky top-0 z-10 flex shrink-0 items-center gap-3 border-b px-4 py-3 backdrop-blur"
    >
      <div class="text-muted-foreground shrink-0">
        <component :is="artifactFileIcon(filepath)" class="size-4" />
      </div>
      <div class="min-w-0 flex-1">
        <div class="truncate font-medium" :title="filepath">{{ filename }}</div>
        <div class="text-muted-foreground truncate text-xs">{{ filepath }}</div>
      </div>
      <Button variant="ghost" size="sm" as-child>
        <a :href="sourceUrl" target="_blank" rel="noopener noreferrer">
          <ExternalLink class="size-4" />
          {{ $i18n.t.value.artifactPreview.viewSource }}
        </a>
      </Button>
      <Button variant="outline" size="sm" as-child>
        <a :href="downloadUrl">
          <Download class="size-4" />
          {{ $i18n.t.value.common.download }}
        </a>
      </Button>
    </header>

    <div
      v-if="truncated && !isTabular"
      class="border-border bg-muted/40 flex shrink-0 items-center justify-between gap-3 border-b px-4 py-2 text-sm"
    >
      <span class="text-muted-foreground">
        {{
          $i18n.t.value.artifactPreview.limited(
            previewedSize,
            formatArtifactBytes(totalBytes),
          )
        }}
      </span>
      <Button size="sm" variant="outline" @click="loadFullContent">
        {{ $i18n.t.value.artifactPreview.loadFullFile }}
      </Button>
    </div>
    <div
      v-if="isLoadingFullFile"
      class="border-border text-muted-foreground flex shrink-0 items-center gap-2 border-b px-4 py-2 text-sm"
    >
      <Loader class="size-4 animate-spin" />
      {{ $i18n.t.value.artifactPreview.loadingFullFile }}
    </div>

    <main
      class="mx-auto min-h-0 w-full flex-1 overflow-hidden"
      :class="isTabular ? '' : 'max-w-4xl'"
    >
      <p v-if="error" class="text-muted-foreground p-6 text-sm">
        {{ $i18n.t.value.artifactPreview.previewFailed }}
      </p>
      <div
        v-else-if="content === undefined"
        class="text-muted-foreground flex items-center gap-2 p-6 text-sm"
      >
        <Loader class="size-4 animate-spin" />
        {{ $i18n.t.value.common.loading }}
      </div>
      <ArtifactPreview
        v-else
        :policy="policy"
        :filename="filename"
        :content="content"
        :url="url"
        :download-url="downloadUrl"
        :truncated="truncated"
        :identity="`${threadId}:${filepath}`"
        view-mode="preview"
        :html-preview-allowed="false"
      />
    </main>
  </div>
</template>
