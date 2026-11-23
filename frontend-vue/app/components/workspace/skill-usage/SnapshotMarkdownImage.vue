<script setup lang="ts">
import { computed } from "vue";
import { isSafeMarkdownHref } from "@/core/markdown/links";
defineOptions({ inheritAttrs: false });
const props = defineProps<{
  src?: string;
  alt?: string;
  title?: string;
  node?: unknown;
}>();
const safe = computed(
  () =>
    typeof props.src === "string" &&
    /^https?:\/\//i.test(props.src) &&
    isSafeMarkdownHref(props.src),
);
</script>
<template>
  <img
    v-if="safe"
    :src="src"
    :alt="alt ?? ''"
    :title="title"
    loading="lazy"
    class="max-w-full"
  /><span v-else class="text-muted-foreground text-sm" :title="src">{{
    alt?.trim() ? alt : (src ?? "")
  }}</span>
</template>
