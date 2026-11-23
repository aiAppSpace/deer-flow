<script setup lang="ts">
import { shallowRef, watch } from "vue";
import type { BundledLanguage } from "shiki";

import { highlightCode } from "@/core/markdown/highlight-code";
import { cn } from "@/lib/utils";

const props = withDefaults(
  defineProps<{
    code: string;
    language: BundledLanguage;
    showLineNumbers?: boolean;
    class?: string;
  }>(),
  { showLineNumbers: false, class: undefined },
);
const html = shallowRef("");
watch(
  () => [props.code, props.language, props.showLineNumbers] as const,
  async ([code, language, showLineNumbers], _previous, onCleanup) => {
    let active = true;
    onCleanup(() => {
      active = false;
    });
    html.value = "";
    try {
      const highlighted = await highlightCode(code, language, showLineNumbers);
      if (active) html.value = highlighted;
    } catch {
      // The visible original code remains the fallback for unsupported languages/load failures.
    }
  },
  { immediate: true },
);
</script>

<template>
  <div
    :class="
      cn(
        'group bg-background text-foreground relative size-full overflow-hidden rounded-md border',
        props.class,
      )
    "
  >
    <div class="relative size-full">
      <!-- Shiki escapes code before producing the trusted syntax-highlight markup. -->
      <!-- eslint-disable vue/no-v-html -->
      <div
        v-if="html"
        class="[&>pre]:bg-background! [&>pre]:text-foreground! size-full overflow-auto [&_code]:font-mono [&_code]:text-sm [&>pre]:m-0 [&>pre]:text-sm [&>pre]:whitespace-pre-wrap"
        v-html="html"
      />
      <!-- eslint-enable vue/no-v-html -->
      <pre
        v-else
        class="bg-background text-foreground size-full overflow-auto p-4 font-mono text-sm whitespace-pre-wrap"
      ><code>{{ code }}</code></pre>
      <div
        v-if="$slots.default"
        class="absolute top-2 right-2 flex items-center gap-2"
      >
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Match React globals.css inside this renderer; Markdown fences own their token styles. */
:deep(.shiki span) {
  html.dark & {
    color: var(--shiki-dark) !important;
  }
}
</style>
