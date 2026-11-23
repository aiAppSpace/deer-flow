<!--
  【文件职责】     代码块 UI：语言标签、复制/下载、shiki 高亮、行号。
  【架构位置】     L2 —— 通用渲染层组件
  【主要导出】     默认组件
  【依赖关系】     shiki（异步高亮）· @/lib/utils · ./MarkdownCopyButton.vue · ./MarkdownIcon.vue
  【边界与注意】   ① **class 串必须写在本文件里**。上游 `globals.css` 有三行
                   `@source ".../node_modules/streamdown/dist/..."`，Tailwind 4 靠它从
                   streamdown 的 dist 扫 class。frontend-vue 不装 streamdown，那三行也
                   已经不在 `app/assets/css/main.css` 里（`tests/guards/css-source-scan.test.ts`
                   守着不许加回来）。所以只出现在别处的 class 会被 purge 掉——
                   **表现是「样式莫名少一块」，不报错**。

                   ② 两处上游拼写错误**照抄不改**：
                   `bg-[var(--sdm-bg,inherit]` 与 `dark:bg-[var(--shiki-dark-bg,var(--sdm-bg,inherit)]`
                   括号不配对。它们生成不出任何 CSS，视觉上等于不存在；照抄是为了让
                   DOM 等价 gate 保持逐属性比对，不必为两个死 class 开一条豁免。
                   将来若上游修了，这里跟着改并重录夹具。

                   ③ 复制按钮与图标是**与 mermaid 图块共用**的组件，不是这里的私有实现：
                   上游两处复用的是同一个 `CodeBlockCopyButton` 与同一套内联图标，
                   各写一份迟早会分叉（复制反馈到底在图标上还是 title 上就分叉过一次，
                   见 MarkdownCopyButton.vue 文件头 ②）。

                   ④ **首帧必须是未高亮的回退结构**，与上游 SSR 一致：shiki 的
                   `codeToTokens` 是异步的，先画结构再替换 token，才不会让代码块在流式
                   过程中闪一下空白。异步结果回来时若 `code` 已经变了就丢弃——
                   流式代码块每个 chunk 都会触发一次高亮，晚到的结果会把新内容盖回旧内容。
-->

<script setup lang="ts">
import { computed, inject, shallowRef, watch } from "vue";

import { markdownStreamingKey } from "@/core/markdown/rendering-context";
import { cn } from "@/lib/utils";

import MarkdownCopyButton from "./MarkdownCopyButton.vue";
import MarkdownIcon from "./MarkdownIcon.vue";

const props = withDefaults(
  defineProps<{
    code: string;
    language?: string;
    class?: string;
  }>(),
  { language: "", class: "" },
);

/** 与上游一致的双主题。 */
const THEMES = { light: "github-light", dark: "github-dark" } as const;

interface HighlightedToken {
  content: string;
  light: string;
  dark: string;
  background: string;
}

// Streamdown removes terminal LF characters before both fallback and Shiki
// rendering. Keep the original prop for exact clipboard/download contents.
const displayCode = computed(() => props.code.replace(/\n+$/, ""));
const lines = computed(() => displayCode.value.split("\n"));

/** 高亮结果；`null` 表示还没回来（或失败），走未高亮回退。 */
const highlighted = shallowRef<HighlightedToken[][] | null>(null);
const streaming = inject(
  markdownStreamingKey,
  computed(() => false),
);

watch(
  // ⚠️ `immediate: true`（05 M5）：watch 默认惰性，首帧不跑就永远等不到第一次高亮，
  // 而首帧正是代码块最长停留的那一帧。
  () => [displayCode.value, props.language] as const,
  async ([code, language], _previous, onCleanup) => {
    let active = true;
    onCleanup(() => {
      active = false;
    });
    highlighted.value = null;
    if (!code) return;
    try {
      const { codeToTokens } = await import("shiki");
      if (!active) return;
      const result = await codeToTokens(code, {
        lang: (language || "text") as never,
        themes: THEMES,
        defaultColor: false,
      });
      // 晚到的结果不许覆盖新内容——流式代码块每个 chunk 都会触发一次高亮。
      if (!active) return;
      highlighted.value = result.tokens.map((line) =>
        line.map((token) => ({
          content: token.content,
          light: token.htmlStyle?.["--shiki-light"] ?? "inherit",
          dark: token.htmlStyle?.["--shiki-dark"] ?? "inherit",
          background: token.htmlStyle?.["--shiki-light-bg"] ?? "transparent",
        })),
      );
    } catch {
      // 语言不认识 / shiki 加载失败都退回未高亮结构，不让代码块消失。
      if (active) highlighted.value = null;
    }
  },
  { immediate: true },
);

/**
 * 语言 class。**空语言时整个 class 不出现**，不是出现一个空的 `language-`——
 * 上游就是这么做的，而 `language-` 这个残缺 class 会被 Tailwind 当成未知工具类。
 */
const languageClass = computed(() =>
  props.language ? `language-${props.language}` : "",
);

const LINE_CLASS =
  "block before:content-[counter(line)] before:inline-block before:[counter-increment:line] before:w-6 before:mr-4 before:text-[13px] before:text-right before:text-muted-foreground/50 before:font-mono before:select-none";
const TOKEN_CLASS =
  "text-[var(--sdm-c,inherit)] dark:text-[var(--shiki-dark,var(--sdm-c,inherit))] bg-[var(--sdm-tbg)] dark:bg-[var(--shiki-dark-bg,var(--sdm-tbg))]";
const ACTION_CLASS =
  "cursor-pointer p-1 text-muted-foreground transition-all hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50";

function tokenStyle(token: HighlightedToken): string {
  return `--sdm-c:${token.light};--sdm-tbg:${token.background};--shiki-dark:${token.dark}`;
}

function download() {
  if (streaming.value) return;
  const blob = new Blob([props.code], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `code.${props.language || "txt"}`;
  anchor.click();
  URL.revokeObjectURL(url);
}
</script>

<template>
  <div
    :class="
      cn(
        'border-border bg-sidebar my-4 flex w-full flex-col gap-2 rounded-xl border p-2',
        props.class,
      )
    "
    :data-language="language"
    data-streamdown="code-block"
    style="content-visibility: auto; contain-intrinsic-size: auto 200px"
  >
    <div
      class="text-muted-foreground flex h-8 items-center text-xs"
      :data-language="language"
      data-streamdown="code-block-header"
    >
      <span class="ml-1 font-mono lowercase">{{ language }}</span>
    </div>
    <div
      class="pointer-events-none sticky top-2 z-10 -mt-10 flex h-8 items-center justify-end"
    >
      <div
        class="border-sidebar bg-sidebar/80 supports-[backdrop-filter]:bg-sidebar/70 pointer-events-auto flex shrink-0 items-center gap-2 rounded-md border px-1.5 py-1 supports-[backdrop-filter]:backdrop-blur"
        data-streamdown="code-block-actions"
      >
        <button
          :class="ACTION_CLASS"
          data-streamdown="code-block-download-button"
          :disabled="streaming"
          :title="$i18n.t.value.markdown.downloadFile"
          type="button"
          @click="download"
        >
          <MarkdownIcon name="DownloadIcon" :size="14" />
        </button>
        <MarkdownCopyButton :code="props.code" />
      </div>
    </div>
    <div
      :class="
        cn(
          languageClass,
          'border-border bg-background overflow-x-auto rounded-md border p-4 text-sm',
        )
      "
      :data-language="language"
      data-streamdown="code-block-body"
    >
      <!-- eslint-disable-next-line vue/max-attributes-per-line -->
      <pre
        :class="
          cn(
            languageClass,
            'bg-[var(--sdm-bg,inherit] dark:bg-[var(--shiki-dark-bg,var(--sdm-bg,inherit)]',
          )
        "
        style="--sdm-bg: transparent; --sdm-fg: inherit"
      ><code class="[counter-increment:line_0] [counter-reset:line]"><span
        v-for="(line, index) in highlighted ?? lines"
        :key="index"
        :class="LINE_CLASS"
      ><template v-if="Array.isArray(line)"><span
        v-for="(token, tokenIndex) in line"
        :key="tokenIndex"
        :class="TOKEN_CLASS"
        :style="tokenStyle(token)"
      >{{ token.content }}</span></template><span
        v-else
        :class="TOKEN_CLASS"
        style="--sdm-c: inherit; --sdm-tbg: transparent"
      >{{ line }}</span></span></code></pre>
    </div>
  </div>
</template>
