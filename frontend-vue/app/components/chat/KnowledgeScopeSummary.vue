<script setup lang="ts">
import { computed } from "vue";
import { Database } from "lucide-vue-next";
import {
  KNOWLEDGE_SCOPE_KEY,
  readKnowledgeScopeSnapshot,
} from "@/core/knowledge";
const props = defineProps<{ additionalKwargs?: Record<string, unknown> }>();
const { $i18n } = useNuxtApp();
const snapshot = computed(() =>
  readKnowledgeScopeSnapshot(props.additionalKwargs?.[KNOWLEDGE_SCOPE_KEY]),
);
const details = computed(() => {
  const datasets = snapshot.value?.display?.datasets;
  return [
    datasets
      ?.map((item) => item.name)
      .filter(Boolean)
      .join("、"),
    datasets
      ?.flatMap(
        (item) => item.documents?.map((document) => document.name) ?? [],
      )
      .filter(Boolean)
      .join("、"),
  ]
    .filter(Boolean)
    .join(" · ");
});
const label = computed(() => {
  if (!snapshot.value) return "";
  const text = $i18n.t.value.knowledge.scope;
  if (snapshot.value.mode === "all") return text.historyAll;
  if (snapshot.value.mode === "disabled") return text.historyDisabled;
  return text.historySelected(
    snapshot.value.dataset_ids?.length ?? 0,
    snapshot.value.document_filters?.reduce(
      (total, item) => total + item.document_ids.length,
      0,
    ) ?? 0,
  );
});
</script>

<template>
  <div
    v-if="snapshot"
    class="text-muted-foreground flex max-w-full items-center justify-end gap-1 text-xs"
    data-testid="message-knowledge-scope"
    :title="details || undefined"
  >
    <Database class="size-3 shrink-0" /><span class="truncate">{{
      details ? `${label} · ${details}` : label
    }}</span>
  </div>
</template>
