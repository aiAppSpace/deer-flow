<!--
  【文件职责】     展开规范化引用来源；每条来源的复制状态由其按钮实例持有。
  【架构位置】     L3 message UI adapter
  【主要导出】     CitationSourcesPanel
  【依赖关系】     core/citations · CitationSourceCopyButton
  【边界与注意】   URL 来自 core 的 http/https 规范化；布局、字体与图标 token 对齐 React。
-->
<script setup lang="ts">
import { BookOpenText, ExternalLink } from "lucide-vue-next";
import type { CitationSource } from "@/core/citations/sources";
import CitationSourceCopyButton from "./CitationSourceCopyButton.vue";

defineProps<{ sources: CitationSource[] }>();
const { $i18n } = useNuxtApp();
</script>

<template>
  <details
    v-if="sources.length"
    class="not-prose border-border/60 bg-muted/20 mt-2 rounded-md border text-xs"
    data-testid="citation-sources"
  >
    <summary
      class="text-muted-foreground hover:text-foreground flex cursor-pointer list-none items-center gap-2 px-3 py-2 transition-colors [&::-webkit-details-marker]:hidden"
    >
      <BookOpenText class="size-3.5 shrink-0" />
      <span class="font-medium">{{
        $i18n.t.value.citations.sourcesSummary(sources.length)
      }}</span>
    </summary>
    <ol
      class="border-border/60 divide-border/60 max-h-80 divide-y overflow-y-auto overscroll-contain border-t"
    >
      <li
        v-for="(source, index) in sources"
        :key="source.id"
        class="flex min-w-0 items-center gap-2 p-2"
      >
        <span
          class="text-muted-foreground w-5 shrink-0 text-right tabular-nums"
          >{{ index + 1 }}</span
        >
        <a
          :href="source.url"
          target="_blank"
          rel="noopener noreferrer"
          class="hover:bg-muted flex min-w-0 flex-1 items-center gap-2 rounded px-2 py-1 transition-colors"
        >
          <span class="min-w-0 flex-1">
            <span class="text-foreground block truncate font-medium">{{
              source.title
            }}</span>
            <span class="text-muted-foreground block truncate">{{
              source.domain
            }}</span>
          </span>
          <span class="text-muted-foreground shrink-0">{{
            $i18n.t.value.citations.citeCount(source.count)
          }}</span>
          <ExternalLink class="text-muted-foreground size-3.5 shrink-0" />
        </a>
        <CitationSourceCopyButton :source="source" />
      </li>
    </ol>
  </details>
</template>
