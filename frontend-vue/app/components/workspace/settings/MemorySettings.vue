<script setup lang="ts">
import {
  computed,
  onScopeDispose,
  reactive,
  ref,
  toRaw,
  useId,
  watch,
} from "vue";
import { Download, PenLine, Plus, Trash2, Upload } from "lucide-vue-next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import SettingsSection from "@/components/workspace/settings/SettingsSection.vue";
import { useMemory } from "@/composables/useMemory";
import { createMemoryImportObservation } from "@/core/diagnostics/parity-observation";
import { isRequestAborted } from "@/core/api/cancellation";
import { useWorkspaceToast } from "@/core/workspace-shell/toast";
import {
  confidenceToLevelKey,
  filterMemoryDocument,
  summariesToMarkdown,
  upperFirst,
  type MemoryDocumentLabels,
} from "@/core/memory/document";
import { normalizeMemoryPayload } from "@/core/memory/schema";
import type { MemoryFact, UserMemory } from "@/core/memory/types";
import {
  buildMemoryFactCreateInput,
  truncateMemoryFact,
  validateMemoryFactForm,
  type MemoryFactForm,
  type MemoryViewFilter,
} from "@/core/memory/view-model";

import { richContentComponents } from "@/components/markdown/components";
import { rawHtmlRehypePlugins } from "@/core/markdown/plugins";
import { pathOfThread } from "@/core/threads/utils";
import { formatTimeAgo } from "@/core/utils/datetime";

import MessageMarkdown from "@/components/chat/MessageMarkdown.vue";

interface PendingImport {
  fileName: string;
  memory: UserMemory;
}

const { $i18n } = useNuxtApp();
const t = computed(() => $i18n.t.value);
const importObservation = createMemoryImportObservation();
const owner = useMemory(
  importObservation
    ? (memory, preAborted) =>
        importObservation.dispatch(toRaw(memory), preAborted)
    : undefined,
);

const toast = useWorkspaceToast();
const importInput = ref<HTMLInputElement | null>(null);
const query = ref("");
const filter = ref<MemoryViewFilter>("all");
const pendingImport = ref<PendingImport | null>(null);
if (importObservation) {
  watch(
    pendingImport,
    (pending) => importObservation.select(pending ? toRaw(pending) : null),
    { flush: "sync" },
  );
  onScopeDispose(() => importObservation.select(null));
}
const clearDialogOpen = ref(false);
const factToDelete = ref<MemoryFact | null>(null);
const factToEdit = ref<MemoryFact | null>(null);
const factEditorOpen = ref(false);
const factForm = reactive<MemoryFactForm>({
  content: "",
  category: "context",
  confidence: "0.8",
});

const documentLabels = computed<MemoryDocumentLabels>(() => {
  const markdown = t.value.settings.memory.markdown;
  return {
    overview: markdown.overview,
    lastUpdated: t.value.common.lastUpdated,
    userContext: markdown.userContext,
    work: markdown.work,
    personal: markdown.personal,
    topOfMind: markdown.topOfMind,
    cognitiveStyle: markdown.cognitiveStyle,
    historyBackground: markdown.historyBackground,
    recentMonths: markdown.recentMonths,
    earlierContext: markdown.earlierContext,
    longTermBackground: markdown.longTermBackground,
    updatedAt: markdown.updatedAt,
    empty: markdown.empty,
  };
});
const visible = computed(() =>
  owner.memory.value
    ? filterMemoryDocument(
        owner.memory.value,
        query.value,
        filter.value,
        documentLabels.value,
      )
    : {
        sectionGroups: [],
        facts: [],
        fullyEmpty: false,
        showSummaries: false,
        showFacts: false,
        hasMatches: true,
        query: "",
      },
);
const summariesMarkdown = computed(() =>
  owner.memory.value
    ? summariesToMarkdown(
        owner.memory.value,
        visible.value.sectionGroups,
        documentLabels.value,
        $i18n.locale.value,
      )
    : "",
);
function factMeta(fact: MemoryFact) {
  const table = t.value.settings.memory.markdown.table;
  return {
    category: upperFirst(fact.category),
    confidence: table.confidenceLevel[confidenceToLevelKey(fact.confidence)],
    createdAt:
      fact.createdAt && Number.isFinite(Date.parse(fact.createdAt))
        ? formatTimeAgo(fact.createdAt, $i18n.locale.value)
        : table.unknown,
    knownSource: Boolean(fact.source && fact.source !== "unknown"),
    manual: fact.source === "manual",
    href: pathOfThread(fact.source),
  };
}

function factActionLabel(action: string, fact: MemoryFact) {
  return `${action}: ${truncateMemoryFact(fact.content)}`;
}

const FILTER_OPTIONS = ["all", "facts", "summaries"] as const;
function filterLabel(option: MemoryViewFilter) {
  if (option === "all") return t.value.settings.memory.filterAll;
  if (option === "facts") return t.value.settings.memory.filterFacts;
  return t.value.settings.memory.filterSummaries;
}
const factPending = computed(
  () => owner.create.isPending.value || owner.update.isPending.value,
);

const factContentId = useId();
const factCategoryId = useId();
const factConfidenceId = useId();
const factConfidenceHintId = useId();
let importSelection = 0;
let disposed = false;
let factRevision = 0;
onScopeDispose(() => {
  disposed = true;
  importSelection += 1;
  factRevision += 1;
});
function reportError(cause: unknown) {
  if (isRequestAborted(cause)) return;
  toast.error(cause instanceof Error ? cause.message : String(cause));
}
function resetFactForm() {
  factToEdit.value = null;
  Object.assign(factForm, {
    content: "",
    category: "context",
    confidence: "0.8",
  });
}
function openCreateFact() {
  factRevision += 1;
  resetFactForm();
  factEditorOpen.value = true;
}
function openEditFact(fact: MemoryFact) {
  factRevision += 1;
  factToEdit.value = fact;
  Object.assign(factForm, {
    content: fact.content,
    category: fact.category,
    confidence: String(fact.confidence),
  });
  factEditorOpen.value = true;
}
function closeFactEditor() {
  factRevision += 1;
  factEditorOpen.value = false;
  resetFactForm();
}
async function saveFact() {
  if (factPending.value) return;
  const validation = validateMemoryFactForm(factForm);
  if (!validation.ok) {
    toast.error(
      validation.field === "content"
        ? t.value.settings.memory.factValidationContent
        : t.value.settings.memory.factValidationConfidence,
    );
    return;
  }
  const fact = factToEdit.value;
  const revision = factRevision;
  const input = buildMemoryFactCreateInput(factForm);
  try {
    if (fact) await owner.update.mutateAsync({ factId: fact.id, input });
    else await owner.create.mutateAsync(input);
    if (disposed) return;
    toast.success(
      fact
        ? t.value.settings.memory.editFactSuccess
        : t.value.settings.memory.addFactSuccess,
    );
    if (revision === factRevision) closeFactEditor();
  } catch (cause) {
    if (!disposed) reportError(cause);
  }
}
async function selectImport(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  target.value = "";
  if (!file) return;
  const selection = ++importSelection;
  const observation = importObservation?.begin();
  try {
    const memory = normalizeMemoryPayload(JSON.parse(await file.text()), {
      onFactIdentity: observation?.fact,
    });
    if (disposed || selection !== importSelection) return;
    if (!memory) {
      toast.error(t.value.settings.memory.importInvalidFile);
      return;
    }
    const pending = { fileName: file.name, memory };
    observation?.retain(pending, memory);
    pendingImport.value = pending;
  } catch {
    if (!disposed && selection === importSelection)
      toast.error(t.value.settings.memory.importInvalidFile);
  }
}
async function confirmImport() {
  const pending = pendingImport.value;
  if (!pending || owner.importDocument.isPending.value) return;
  try {
    await owner.importDocument.mutateAsync(pending.memory);
    if (disposed) return;
    toast.success(t.value.settings.memory.importSuccess);
    if (pendingImport.value === pending) pendingImport.value = null;
  } catch (cause) {
    if (!disposed) reportError(cause);
  }
}
async function exportDocument() {
  if (owner.exportDocument.isPending.value) return;
  try {
    const memory = await owner.exportDocument.mutateAsync();
    if (disposed) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(memory, null, 2)], { type: "application/json" }),
    );
    const anchor = document.createElement("a");
    try {
      anchor.href = url;
      anchor.download = `deerflow-memory-${(memory.lastUpdated || new Date().toISOString()).replaceAll(/[:.]/g, "-")}.json`;
      document.body.appendChild(anchor);
      anchor.click();
    } finally {
      anchor.remove();
      URL.revokeObjectURL(url);
    }
    toast.success(t.value.settings.memory.exportSuccess);
  } catch (cause) {
    if (!disposed) reportError(cause);
  }
}
async function confirmClear() {
  if (owner.clear.isPending.value) return;
  try {
    await owner.clear.mutateAsync();
    if (disposed) return;
    toast.success(t.value.settings.memory.clearAllSuccess);
    clearDialogOpen.value = false;
  } catch (cause) {
    if (!disposed) reportError(cause);
  }
}
function openDelete(fact: MemoryFact) {
  factToDelete.value = fact;
}
async function confirmDelete() {
  const fact = factToDelete.value;
  if (!fact || owner.remove.isPending.value) return;
  try {
    await owner.remove.mutateAsync(fact.id);
    if (disposed) return;
    toast.success(t.value.settings.memory.factDeleteSuccess);
    if (factToDelete.value === fact) factToDelete.value = null;
  } catch (cause) {
    if (!disposed) reportError(cause);
  }
}
</script>

<template>
  <SettingsSection
    data-testid="memory-settings"
    :title="t.settings.memory.title"
    :description="t.settings.memory.description"
  >
    <div class="space-y-4">
      <p v-if="owner.loading.value" class="text-muted-foreground text-sm">
        {{ t.common.loading }}
      </p>
      <p v-else-if="owner.error.value" role="alert">
        {{ t.common.error }} {{ owner.error.value.message }}
      </p>
      <template v-else-if="owner.memory.value">
        <p
          v-if="visible.fullyEmpty"
          class="text-muted-foreground rounded-lg border border-dashed p-4 text-sm"
          data-testid="memory-empty"
        >
          {{ t.settings.memory.memoryFullyEmpty }}
        </p>

        <div class="@container/memory-controls flex flex-col gap-3">
          <div class="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              v-model="query"
              :placeholder="t.settings.memory.searchPlaceholder"
              class="min-w-0 flex-1 sm:max-w-md"
              data-testid="memory-search"
            />
            <ToggleGroup
              :model-value="filter"
              type="single"
              variant="outline"
              class="shrink-0 self-start sm:ml-auto sm:self-auto @max-md/memory-controls:max-w-full @max-md/memory-controls:flex-wrap"
              @update:model-value="
                (value) => {
                  if (value) filter = value as MemoryViewFilter;
                }
              "
            >
              <ToggleGroupItem
                v-for="option in FILTER_OPTIONS"
                :key="option"
                :value="option"
                single
                :checked="filter === option"
                variant="outline"
                class="whitespace-nowrap"
              >
                {{ filterLabel(option) }}
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div
            class="flex flex-wrap items-center gap-2 @max-md/memory-controls:[&>button]:h-auto @max-md/memory-controls:[&>button]:min-h-9 @max-md/memory-controls:[&>button]:max-w-full @max-md/memory-controls:[&>button]:min-w-0 @max-md/memory-controls:[&>button]:wrap-anywhere @max-md/memory-controls:[&>button]:whitespace-normal"
          >
            <Button
              type="button"
              variant="outline"
              :disabled="owner.importDocument.isPending.value"
              data-testid="memory-import-open"
              @click="importInput?.click()"
            >
              <Upload class="mr-2 h-4 w-4" aria-hidden="true" />
              {{ t.settings.memory.importButton }}
            </Button>
            <input
              ref="importInput"
              type="file"
              accept=".json,application/json"
              class="hidden"
              data-testid="memory-import-file"
              @change="selectImport"
            />
            <Button
              type="button"
              variant="outline"
              :disabled="owner.exportDocument.isPending.value"
              @click="exportDocument"
            >
              <Download class="mr-2 h-4 w-4" aria-hidden="true" />
              {{ t.settings.memory.exportButton }}
            </Button>
            <Button
              type="button"
              variant="outline"
              data-testid="memory-add-fact"
              @click="openCreateFact"
            >
              <Plus class="mr-2 h-4 w-4" aria-hidden="true" />
              {{ t.settings.memory.addFact }}
            </Button>
            <Button
              type="button"
              variant="destructive"
              class="ml-auto"
              data-testid="memory-clear-open"
              :disabled="owner.clear.isPending.value"
              @click="clearDialogOpen = true"
            >
              {{ t.settings.memory.clearAll }}
            </Button>
          </div>
        </div>

        <p
          v-if="!visible.hasMatches && visible.query"
          class="text-muted-foreground rounded-lg border border-dashed p-4 text-sm"
          data-testid="memory-no-matches"
        >
          {{ t.settings.memory.noMatches }}
        </p>

        <div
          v-if="visible.showSummaries"
          class="min-w-0 rounded-lg border p-4"
          data-testid="memory-summary"
        >
          <div class="text-muted-foreground mb-4 text-sm">
            {{ t.settings.memory.summaryReadOnly }}
          </div>
          <MessageMarkdown
            :content="summariesMarkdown"
            :components="richContentComponents"
            :rehype-plugins="rawHtmlRehypePlugins"
            class="size-full min-w-0"
          />
        </div>

        <div v-if="visible.showFacts" class="min-w-0 rounded-lg border p-4">
          <div class="mb-4">
            <h3 class="text-base font-medium">
              {{ t.settings.memory.markdown.facts }}
            </h3>
          </div>
          <div
            v-if="visible.facts.length === 0"
            class="text-muted-foreground text-sm"
          >
            {{
              visible.query
                ? t.settings.memory.noMatches
                : t.settings.memory.noFacts
            }}
          </div>
          <div v-else class="space-y-3">
            <div
              v-for="fact in visible.facts"
              :key="fact.id"
              class="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-start sm:justify-between"
              :data-testid="`memory-fact-${fact.id}`"
            >
              <div class="min-w-0 space-y-2 [overflow-wrap:anywhere]">
                <div class="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <span>
                    <span class="text-muted-foreground"
                      >{{ t.settings.memory.markdown.table.category }}:</span
                    >
                    {{ factMeta(fact).category }}
                  </span>
                  <span>
                    <span class="text-muted-foreground"
                      >{{ t.settings.memory.markdown.table.confidence }}:</span
                    >
                    {{ factMeta(fact).confidence }}
                  </span>
                  <span>
                    <span class="text-muted-foreground"
                      >{{ t.settings.memory.markdown.table.createdAt }}:</span
                    >
                    {{ factMeta(fact).createdAt }}
                  </span>
                  <span>
                    <span class="text-muted-foreground"
                      >{{ t.settings.memory.markdown.table.source }}:{{
                        " "
                      }}</span
                    >
                    <template v-if="factMeta(fact).manual">
                      {{ t.settings.memory.manualFactSource }}
                    </template>
                    <NuxtLink
                      v-else-if="factMeta(fact).knownSource"
                      :to="factMeta(fact).href"
                      class="text-primary underline-offset-4 hover:underline"
                    >
                      {{ t.settings.memory.markdown.table.view }}
                    </NuxtLink>
                    <template v-else>{{
                      t.settings.memory.markdown.table.unknown
                    }}</template>
                  </span>
                </div>
                <p class="text-sm [overflow-wrap:anywhere]">
                  {{ fact.content }}
                </p>
              </div>
              <div class="flex shrink-0 items-center gap-1 self-start sm:ml-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  class="shrink-0"
                  :disabled="owner.remove.isPending.value"
                  :title="factActionLabel(t.common.edit, fact)"
                  :aria-label="factActionLabel(t.common.edit, fact)"
                  @click="openEditFact(fact)"
                >
                  <PenLine class="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  class="text-destructive hover:text-destructive shrink-0"
                  :disabled="owner.remove.isPending.value"
                  :title="factActionLabel(t.common.delete, fact)"
                  :aria-label="factActionLabel(t.common.delete, fact)"
                  @click="openDelete(fact)"
                >
                  <Trash2 class="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </template>
      <p v-else class="text-muted-foreground text-sm">
        {{ t.settings.memory.empty }}
      </p>
    </div>
  </SettingsSection>

  <Dialog :open="clearDialogOpen" @update:open="clearDialogOpen = $event">
    <DialogContent
      :close-label="t.common.close"
      data-testid="memory-clear-dialog"
    >
      <DialogHeader
        ><DialogTitle>{{ t.settings.memory.clearAllConfirmTitle }}</DialogTitle
        ><DialogDescription>{{
          t.settings.memory.clearAllConfirmDescription
        }}</DialogDescription></DialogHeader
      >
      <DialogFooter
        ><Button
          variant="outline"
          :disabled="owner.clear.isPending.value"
          @click="clearDialogOpen = false"
          >{{ t.common.cancel }}</Button
        ><Button
          variant="destructive"
          :disabled="owner.clear.isPending.value"
          @click="confirmClear"
          >{{
            owner.clear.isPending.value
              ? t.common.loading
              : t.settings.memory.clearAll
          }}</Button
        ></DialogFooter
      >
    </DialogContent>
  </Dialog>
  <Dialog :open="factEditorOpen" @update:open="!$event && closeFactEditor()">
    <DialogContent
      :close-label="t.common.close"
      data-testid="memory-fact-dialog"
      :aria-describedby="undefined"
    >
      <DialogHeader
        ><DialogTitle>{{
          factToEdit
            ? t.settings.memory.editFactTitle
            : t.settings.memory.addFactTitle
        }}</DialogTitle></DialogHeader
      >
      <div class="space-y-4">
        <div class="space-y-2">
          <label :for="factContentId" class="text-sm font-medium">{{
            t.settings.memory.factContentLabel
          }}</label
          ><Textarea
            :id="factContentId"
            v-model="factForm.content"
            rows="4"
            :placeholder="t.settings.memory.factContentPlaceholder"
            data-testid="memory-fact-content"
          />
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-2">
            <label :for="factCategoryId" class="text-sm font-medium">{{
              t.settings.memory.factCategoryLabel
            }}</label
            ><Input
              :id="factCategoryId"
              v-model="factForm.category"
              :placeholder="t.settings.memory.factCategoryPlaceholder"
              data-testid="memory-fact-category"
            />
          </div>
          <div class="space-y-2">
            <label :for="factConfidenceId" class="text-sm font-medium">{{
              t.settings.memory.factConfidenceLabel
            }}</label
            ><Input
              :id="factConfidenceId"
              v-model="factForm.confidence"
              type="number"
              min="0"
              max="1"
              step="0.01"
              :aria-describedby="factConfidenceHintId"
              data-testid="memory-fact-confidence"
            />
            <div
              :id="factConfidenceHintId"
              class="text-muted-foreground text-xs"
            >
              {{ t.settings.memory.factConfidenceHint }}
            </div>
          </div>
        </div>
      </div>
      <DialogFooter
        ><Button
          variant="outline"
          :disabled="factPending"
          @click="closeFactEditor"
          >{{ t.common.cancel }}</Button
        ><Button :disabled="factPending" @click="saveFact">{{
          factPending ? t.common.loading : t.settings.memory.factSave
        }}</Button></DialogFooter
      >
    </DialogContent>
  </Dialog>
  <Dialog
    :open="factToDelete !== null"
    @update:open="!$event && (factToDelete = null)"
  >
    <DialogContent
      :close-label="t.common.close"
      data-testid="memory-delete-dialog"
    >
      <DialogHeader
        ><DialogTitle>{{
          t.settings.memory.factDeleteConfirmTitle
        }}</DialogTitle
        ><DialogDescription>{{
          t.settings.memory.factDeleteConfirmDescription
        }}</DialogDescription></DialogHeader
      >
      <div v-if="factToDelete" class="bg-muted rounded-md border p-3 text-sm">
        <div class="text-muted-foreground mb-1 font-medium">
          {{ t.settings.memory.factPreviewLabel }}
        </div>
        <p class="break-words">
          {{ truncateMemoryFact(factToDelete.content) }}
        </p>
      </div>
      <DialogFooter
        ><Button
          variant="outline"
          :disabled="owner.remove.isPending.value"
          @click="factToDelete = null"
          >{{ t.common.cancel }}</Button
        ><Button
          variant="destructive"
          :disabled="owner.remove.isPending.value"
          @click="confirmDelete"
          >{{
            owner.remove.isPending.value ? t.common.loading : t.common.delete
          }}</Button
        ></DialogFooter
      >
    </DialogContent>
  </Dialog>
  <Dialog
    :open="pendingImport !== null"
    @update:open="!$event && (pendingImport = null)"
  >
    <DialogContent
      :close-label="t.common.close"
      data-testid="memory-import-dialog"
    >
      <DialogHeader
        ><DialogTitle>{{ t.settings.memory.importConfirmTitle }}</DialogTitle
        ><DialogDescription>{{
          t.settings.memory.importConfirmDescription
        }}</DialogDescription></DialogHeader
      >
      <div v-if="pendingImport" class="bg-muted rounded-md border p-3 text-sm">
        <div>
          <span class="text-muted-foreground"
            >{{ t.settings.memory.importFileLabel }}:</span
          >
          {{ pendingImport.fileName }}
        </div>
        <div>
          <span class="text-muted-foreground"
            >{{ t.settings.memory.markdown.facts }}:</span
          >
          {{ pendingImport.memory.facts.length }}
        </div>
        <div>
          <span class="text-muted-foreground">{{ t.common.lastUpdated }}:</span>
          {{
            pendingImport.memory.lastUpdated
              ? formatTimeAgo(
                  pendingImport.memory.lastUpdated,
                  $i18n.locale.value,
                )
              : "-"
          }}
        </div>
      </div>
      <DialogFooter
        ><Button
          variant="outline"
          :disabled="owner.importDocument.isPending.value"
          @click="pendingImport = null"
          >{{ t.common.cancel }}</Button
        ><Button
          :disabled="owner.importDocument.isPending.value"
          @click="confirmImport"
          >{{
            owner.importDocument.isPending.value
              ? t.common.loading
              : t.common.import
          }}</Button
        ></DialogFooter
      >
    </DialogContent>
  </Dialog>
</template>
