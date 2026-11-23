<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Loader2, Search } from "lucide-vue-next";
import { Input } from "@/components/ui/input";
import {
  KNOWLEDGE_CATALOG_PAGE_SIZE,
  useKnowledgeDocumentCatalog,
} from "@/composables/useKnowledgeCatalog";
import type {
  KnowledgeScopeDatasetSelection,
  RetrievalCatalogItem,
} from "@/core/knowledge";
import CatalogPagination from "./CatalogPagination.vue";

const props = defineProps<{
  agentName: string;
  dataset: KnowledgeScopeDatasetSelection;
  disabled?: boolean;
}>();
const emit = defineEmits<{
  change: [dataset: KnowledgeScopeDatasetSelection];
}>();
const { $i18n } = useNuxtApp();
const page = ref(1);
const search = ref("");
watch(
  search,
  () => {
    page.value = 1;
  },
  { flush: "sync" },
);
const query = useKnowledgeDocumentCatalog({
  agentName: () => props.agentName,
  datasetId: () => props.dataset.id,
  page,
  search,
  enabled: () => props.dataset.documents.mode === "selected",
});
const selectedIds = computed(
  () =>
    new Set(
      props.dataset.documents.mode === "selected"
        ? props.dataset.documents.items.map((item) => item.id)
        : [],
    ),
);
function toggle(document: RetrievalCatalogItem, checked: boolean) {
  if (props.disabled || !document.selectable) return;
  const current =
    props.dataset.documents.mode === "selected"
      ? props.dataset.documents.items
      : [];
  emit("change", {
    ...props.dataset,
    documents: {
      mode: "selected",
      items: checked
        ? [...current.filter((item) => item.id !== document.id), document]
        : current.filter((item) => item.id !== document.id),
    },
  });
}
</script>

<template>
  <div class="bg-muted/40 mt-2 space-y-3 rounded-md p-3">
    <div class="flex flex-wrap gap-4 text-xs">
      <label class="flex items-center gap-2"
        ><input
          :checked="dataset.documents.mode === 'all'"
          :disabled="disabled"
          :name="`documents-${dataset.id}`"
          type="radio"
          @change="emit('change', { ...dataset, documents: { mode: 'all' } })"
        />{{ $i18n.t.value.knowledge.scope.allDocuments }}</label
      >
      <label class="flex items-center gap-2"
        ><input
          :checked="dataset.documents.mode === 'selected'"
          :disabled="disabled"
          :name="`documents-${dataset.id}`"
          type="radio"
          @change="
            emit('change', {
              ...dataset,
              documents: { mode: 'selected', items: [] },
            })
          "
        />{{ $i18n.t.value.knowledge.scope.selectedDocuments }}</label
      >
    </div>
    <template v-if="dataset.documents.mode === 'selected'">
      <div class="relative">
        <Search
          class="text-muted-foreground absolute top-2.5 left-2.5 size-4"
        /><Input
          v-model="search"
          class="h-9 pl-8"
          :placeholder="$i18n.t.value.knowledge.scope.searchDocuments"
        />
      </div>
      <Loader2
        v-if="query.isPending.value"
        class="text-muted-foreground mx-auto size-4 animate-spin"
      />
      <p v-else-if="query.isError.value" class="text-destructive text-xs">
        {{ $i18n.t.value.knowledge.scope.loadFailed }}
      </p>
      <div v-else class="space-y-1">
        <label
          v-for="document in query.data.value?.items"
          :key="document.id"
          class="flex items-center gap-2 rounded px-2 py-1.5 text-xs"
          :class="
            document.selectable ? 'hover:bg-muted' : 'text-muted-foreground'
          "
        >
          <input
            :aria-label="document.name"
            :checked="selectedIds.has(document.id)"
            :disabled="disabled || !document.selectable"
            type="checkbox"
            @change="
              toggle(document, ($event.target as HTMLInputElement).checked)
            "
          />
          <span class="min-w-0 truncate">{{ document.name }}</span
          ><span v-if="!document.selectable" class="ml-auto shrink-0">{{
            $i18n.t.value.knowledge.scope.notSearchable
          }}</span>
        </label>
        <CatalogPagination
          :page="page"
          :page-size="KNOWLEDGE_CATALOG_PAGE_SIZE"
          :total="query.data.value?.total ?? 0"
          @change="page = $event"
        />
      </div>
    </template>
  </div>
</template>
