<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ChevronDown, Database, Loader2, Search } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  KNOWLEDGE_CATALOG_PAGE_SIZE,
  useKnowledgeDatasetCatalog,
} from "@/composables/useKnowledgeCatalog";
import {
  buildKnowledgeScopeSnapshot,
  cloneKnowledgeScopeSelection,
  countKnowledgeScopeSelection,
  type KnowledgeScopeDatasetSelection,
  type KnowledgeScopeSelection,
  type RetrievalCatalogItem,
} from "@/core/knowledge";
import DocumentSelector from "@/components/workspace/knowledge/DocumentSelector.vue";
import CatalogPagination from "@/components/workspace/knowledge/CatalogPagination.vue";

const props = withDefaults(
  defineProps<{
    agentName: string;
    selection: KnowledgeScopeSelection;
    disabled?: boolean;
    unavailableReason?: string;
    description?: string;
    showLabel?: boolean;
  }>(),
  {
    disabled: false,
    unavailableReason: undefined,
    description: undefined,
    showLabel: false,
  },
);
const emit = defineEmits<{ change: [selection: KnowledgeScopeSelection] }>();
const { $i18n } = useNuxtApp();
const text = computed(() => $i18n.t.value.knowledge.scope);
const open = ref(false);
const draft = ref(cloneKnowledgeScopeSelection(props.selection));
const expandedDatasetId = ref<string | null>(null);
const page = ref(1);
const search = ref("");
watch([open, () => props.selection], () => {
  if (open.value) draft.value = cloneKnowledgeScopeSelection(props.selection);
});
watch(
  search,
  () => {
    page.value = 1;
  },
  { flush: "sync" },
);
const query = useKnowledgeDatasetCatalog({
  agentName: () => props.agentName,
  page,
  search,
  enabled: () =>
    open.value && draft.value.mode === "selected" && !props.unavailableReason,
});
const counts = computed(() => countKnowledgeScopeSelection(props.selection));
const label = computed(() =>
  props.selection.mode === "all"
    ? text.value.buttonAll
    : props.selection.mode === "disabled"
      ? text.value.buttonDisabled
      : counts.value.documents > 0
        ? text.value.buttonDatasetsAndDocuments(
            counts.value.datasets,
            counts.value.documents,
          )
        : text.value.buttonDatasets(counts.value.datasets),
);
const active = computed(() => props.selection.mode !== "disabled");
const draftInvalid = computed(
  () =>
    draft.value.mode === "selected" &&
    (!draft.value.datasets.length ||
      draft.value.datasets.some(
        (dataset) =>
          dataset.documents.mode === "selected" &&
          !dataset.documents.items.length,
      )),
);
const exceedsLimits = computed(() => {
  if (draftInvalid.value) return false;
  try {
    buildKnowledgeScopeSnapshot(draft.value);
    return false;
  } catch {
    return true;
  }
});
const selectedDatasets = computed(
  () =>
    new Map(
      draft.value.mode === "selected"
        ? draft.value.datasets.map((dataset) => [dataset.id, dataset])
        : [],
    ),
);
function mode(next: KnowledgeScopeSelection["mode"]) {
  draft.value =
    next === "selected" ? { mode: next, datasets: [] } : { mode: next };
}
function toggle(dataset: RetrievalCatalogItem, checked: boolean) {
  if (draft.value.mode !== "selected" || props.disabled || !dataset.selectable)
    return;
  draft.value = {
    mode: "selected",
    datasets: checked
      ? [
          ...draft.value.datasets.filter((item) => item.id !== dataset.id),
          { ...dataset, documents: { mode: "all" } },
        ]
      : draft.value.datasets.filter((item) => item.id !== dataset.id),
  };
  if (!checked && expandedDatasetId.value === dataset.id)
    expandedDatasetId.value = null;
}
function replace(dataset: KnowledgeScopeDatasetSelection) {
  if (draft.value.mode !== "selected") return;
  const found = draft.value.datasets.some((item) => item.id === dataset.id);
  draft.value = {
    mode: "selected",
    datasets: found
      ? draft.value.datasets.map((item) =>
          item.id === dataset.id ? dataset : item,
        )
      : [...draft.value.datasets, dataset],
  };
}
function apply() {
  if (props.disabled || draftInvalid.value || exceedsLimits.value) return;
  emit("change", cloneKnowledgeScopeSelection(draft.value));
  open.value = false;
}
</script>

<template>
  <Dialog v-model:open="open">
    <Tooltip
      ><TooltipTrigger as-child
        ><DialogTrigger as-child
          ><Button
            :aria-label="label"
            :aria-pressed="active"
            :class="
              cn(
                'text-muted-foreground',
                showLabel && 'h-auto min-h-8 max-w-full whitespace-normal',
                active &&
                  'text-foreground hover:text-foreground hover:bg-transparent',
              )
            "
            data-testid="knowledge-scope-trigger"
            :disabled="disabled || Boolean(unavailableReason)"
            :size="showLabel ? 'sm' : 'icon-sm'"
            type="button"
            variant="ghost"
            ><Database class="size-4" /><template v-if="showLabel">{{
              label
            }}</template></Button
          ></DialogTrigger
        ></TooltipTrigger
      ><TooltipContent>{{
        unavailableReason ?? label
      }}</TooltipContent></Tooltip
    >
    <DialogContent
      class="flex max-h-[85vh] flex-col sm:max-w-2xl"
      :close-label="$i18n.t.value.primitives.close"
    >
      <DialogHeader
        ><DialogTitle>{{ text.title }}</DialogTitle
        ><DialogDescription>{{
          description ?? text.description
        }}</DialogDescription></DialogHeader
      >
      <div class="flex flex-wrap gap-4 text-sm">
        <label
          v-for="item in ['all', 'selected', 'disabled'] as const"
          :key="item"
          class="flex items-center gap-2"
          ><input
            :checked="draft.mode === item"
            :disabled="disabled"
            name="knowledge-scope-mode"
            type="radio"
            @change="mode(item)"
          />{{
            item === "all"
              ? text.allDatasets
              : item === "selected"
                ? text.selectedDatasets
                : text.disabled
          }}</label
        >
      </div>
      <div
        v-if="draft.mode === 'selected'"
        class="flex min-h-0 flex-1 flex-col gap-3"
      >
        <div class="relative">
          <Search
            class="text-muted-foreground absolute top-2.5 left-2.5 size-4"
          /><Input
            v-model="search"
            class="h-9 pl-8"
            :placeholder="text.searchDatasets"
          />
        </div>
        <div class="text-muted-foreground text-xs">
          {{ text.selectedCount(draft.datasets.length) }}
        </div>
        <ScrollArea
          class="min-h-48 flex-1 pr-3 [&_[data-slot=scroll-area-viewport]>div]:block!"
        >
          <Loader2
            v-if="query.isPending.value"
            class="text-muted-foreground mx-auto mt-8 size-5 animate-spin"
          />
          <p
            v-else-if="query.isError.value"
            class="text-destructive p-3 text-sm"
          >
            {{ text.loadFailed }}
          </p>
          <div v-else class="space-y-2">
            <div
              v-for="dataset in query.data.value?.items"
              :key="dataset.id"
              class="rounded-md border p-2"
            >
              <div class="flex items-center gap-2">
                <input
                  :aria-label="dataset.name"
                  :checked="selectedDatasets.has(dataset.id)"
                  :disabled="disabled || !dataset.selectable"
                  type="checkbox"
                  @change="
                    toggle(dataset, ($event.target as HTMLInputElement).checked)
                  "
                />
                <span
                  class="min-w-0 flex-1 truncate text-sm"
                  :class="!dataset.selectable ? 'text-muted-foreground' : ''"
                  >{{ dataset.name }}</span
                ><span
                  v-if="!dataset.selectable"
                  class="text-muted-foreground text-xs"
                  >{{ text.notSearchable }}</span
                >
                <Button
                  v-if="selectedDatasets.has(dataset.id)"
                  :aria-expanded="expandedDatasetId === dataset.id"
                  size="sm"
                  type="button"
                  variant="ghost"
                  @click="
                    expandedDatasetId =
                      expandedDatasetId === dataset.id ? null : dataset.id
                  "
                  >{{ text.files
                  }}<ChevronDown
                    class="size-3 transition-transform"
                    :class="
                      expandedDatasetId === dataset.id ? 'rotate-180' : ''
                    "
                /></Button>
              </div>
              <DocumentSelector
                v-if="
                  selectedDatasets.has(dataset.id) &&
                  expandedDatasetId === dataset.id
                "
                :agent-name="agentName"
                :dataset="selectedDatasets.get(dataset.id)!"
                :disabled="disabled"
                @change="replace"
              />
            </div>
            <CatalogPagination
              :page="page"
              :page-size="KNOWLEDGE_CATALOG_PAGE_SIZE"
              :total="query.data.value?.total ?? 0"
              @change="page = $event"
            />
          </div>
        </ScrollArea>
      </div>
      <p v-if="exceedsLimits" class="text-destructive text-xs">
        {{ text.selectionInvalid }}
      </p>
      <DialogFooter
        ><Button type="button" variant="outline" @click="open = false">{{
          $i18n.t.value.common.cancel
        }}</Button
        ><Button
          :disabled="disabled || draftInvalid || exceedsLimits"
          type="button"
          @click="apply"
          >{{ text.apply }}</Button
        ></DialogFooter
      >
    </DialogContent>
  </Dialog>
</template>
