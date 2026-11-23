<script setup lang="ts">
import { computed } from "vue";
import MarkdownLink from "@/components/chat/MarkdownLink.vue";
import { isSafeMarkdownHref } from "@/core/markdown/links";
defineOptions({ inheritAttrs: false });
const props = defineProps<{ href?: string; title?: string; node?: unknown }>();
const safe = computed(
  () =>
    props.href &&
    /^(https?:\/\/|mailto:|tel:)/i.test(props.href) &&
    isSafeMarkdownHref(props.href),
);
</script>
<template>
  <MarkdownLink v-if="safe" :href="href" :title="title" v-bind="$attrs"
    ><slot /></MarkdownLink
  ><span
    v-else
    class="text-muted-foreground decoration-muted-foreground/50 underline decoration-dotted underline-offset-2"
    :title="href"
    ><slot
  /></span>
</template>
