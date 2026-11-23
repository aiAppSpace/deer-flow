<script setup lang="ts">
import { computed } from "vue";
import { citedKnowledgeSources } from "@/core/knowledge/sources";
import { useKnowledgeSources } from "./knowledge-sources-context";
import KnowledgeSourceDialog from "./KnowledgeSourceDialog.vue";
const props = defineProps<{ content: string }>();
const { $i18n } = useNuxtApp();
const all = useKnowledgeSources();
const sources = computed(() => citedKnowledgeSources(props.content, all.value));
</script>

<template>
  <details
    v-if="sources.length"
    class="not-prose border-border/60 bg-muted/20 mt-2 rounded-md border text-xs"
  >
    <summary class="text-muted-foreground cursor-pointer px-3 py-2">
      {{ $i18n.t.value.citations.knowledgeSourcesSummary(sources.length) }}
    </summary>
    <ul
      class="border-border/60 max-h-80 space-y-2 overflow-y-auto border-t p-3"
    >
      <li v-for="source in sources" :key="source.id">
        <KnowledgeSourceDialog :source="source"
          ><span class="text-foreground block font-medium break-words">{{
            source.document_name
          }}</span
          ><span class="text-muted-foreground block break-words">{{
            source.dataset_name
          }}</span></KnowledgeSourceDialog
        >
      </li>
    </ul>
  </details>
</template>
