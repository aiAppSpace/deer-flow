<script setup lang="ts">
import { computed } from "vue";
import { BookOpenText } from "lucide-vue-next";
import { Badge } from "@/components/ui/badge";
import { knowledgeSourceId } from "@/core/knowledge/sources";
import { useKnowledgeSources } from "./knowledge-sources-context";
import KnowledgeSourceDialog from "./KnowledgeSourceDialog.vue";
const props = defineProps<{ href: string }>();
const { $i18n } = useNuxtApp();
const sources = useKnowledgeSources();
const source = computed(() => {
  const id = knowledgeSourceId(props.href);
  return id ? sources.value.get(id) : undefined;
});
</script>

<template>
  <KnowledgeSourceDialog v-if="source" :source="source"
    ><Badge
      variant="secondary"
      class="mx-0.5 cursor-pointer gap-1 rounded-full px-2 py-0.5 text-xs font-normal"
      ><BookOpenText class="size-3" /><slot /></Badge
  ></KnowledgeSourceDialog>
  <span
    v-else
    class="text-muted-foreground"
    :title="$i18n.t.value.citations.sourceUnavailable"
    ><slot
  /></span>
</template>
