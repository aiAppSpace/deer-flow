<script setup lang="ts">
/*
  【文件职责】     展示 Memory document，并编排严格导入、搜索筛选与事实 CRUD。
  【架构位置】     L3 product UI
  【主要导出】     默认 MemorySettings 组件
  【依赖关系】     useMemory · memory schema/view-model · SettingsActionDialog
  【边界与注意】   import 先纯校验再预览确认；所有写操作以 Gateway 完整响应回填单一 query cache。
*/

import { computed, reactive, ref } from "vue";
import { Download, PenLine, Plus, Trash2, Upload } from "lucide-vue-next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import SettingsActionDialog from "@/components/workspace/settings/SettingsActionDialog.vue";
import SettingsSection from "@/components/workspace/settings/SettingsSection.vue";
import { useMemory } from "@/composables/useMemory";
import { useWorkspaceToast } from "@/core/workspace-shell/toast";
import {
  confidenceToLevelKey,
  filterMemoryDocument,
  summariesToMarkdown,
  upperFirst,
  type MemoryDocumentLabels,
} from "@/core/memory/document";
import {
  parseMemoryImportText,
  type MemoryImportWarning,
} from "@/core/memory/schema";
import type { MemoryFact, UserMemory } from "@/core/memory/types";
import {
  buildMemoryFactCreateInput,
  buildMemoryFactPatchInput,
  truncateMemoryFact,
  validateMemoryFactForm,
  type MemoryFactForm,
  type MemoryViewFilter,
} from "@/core/memory/view-model";
/*
  ① 空小节那句 `(empty)` 是一段内联 HTML（灰掉的 `<span>`）。上游走的是
  `streamdownPlugins`，那一档带 rehype-raw；本仓消息路径**不带**，于是 raw 节点会被
  降级成转义文本，页面上直接显示出 `<span class="...">(empty)</span>` 这串源码。
  artifacts 预览路径早就有这一档，直接复用。

  ② `richContentComponents` 是本仓对 Streamdown 内建元素样式的镜像（ArtifactPreview
  用的也是它）。不传它，`**粗体**` 会渲染成真的 `<strong>`——而 Streamdown 渲染的是
  `<span class="font-semibold" data-streamdown="strong">`。两者在可访问性树上不是
  一回事（`strong` 有自己的节点，`span` 没有），列表、行内代码、引用块同理全裸。
*/
import { richContentComponents } from "@/components/markdown/components";
import { rawHtmlRehypePlugins } from "@/core/markdown/plugins";
import { pathOfThread } from "@/core/threads/utils";
import { formatTimeAgo } from "@/core/utils/datetime";

import MessageMarkdown from "@/components/chat/MessageMarkdown.vue";

interface PendingImport {
  fileName: string;
  memory: UserMemory;
  warnings: MemoryImportWarning[];
}

const { $i18n } = useNuxtApp();
const t = computed(() => $i18n.t.value);
const owner = useMemory();
/*
  六条**成功播报**，与上游 memory-settings-page.tsx 逐处对应
  （`:396` export、`:435` import、`:445` clearAll、`:457` factDelete、
  `:510/:513` edit/add）。本仓此前一条都没有：删掉一条记忆、清空整份文档、
  导入一份文件，屏幕上除了对话框关掉之外**没有任何确认**。

  交接文档把 `settings.memory.*` 那几条记成「上游自己也零消费」——**记错了**：
  只有 `rawJson` 是上游也没人用的，其余五条上游都在 toast，
  加上被 `common.exportSuccess` 的同名叶子遮蔽的 `exportSuccess`，一共六条
  （wave 34 复量）。

  走 toaster 而不是内联，判据是 wave 31 定的那条：**一刻发生的事走 toaster，
  一段时间里为真的事留在页面里**。失败仍然是内联的——那几处是「这个表单现在有问题」，
  是状态不是播报，本仓这一侧比上游的 toast 更贴近判据，有意保留。
*/
const toast = useWorkspaceToast();
const importInput = ref<HTMLInputElement | null>(null);
const query = ref("");
const filter = ref<MemoryViewFilter>("all");
const pageError = ref("");
const importError = ref("");
const pendingImport = ref<PendingImport | null>(null);
const clearDialogOpen = ref(false);
const clearError = ref("");
const factToDelete = ref<MemoryFact | null>(null);
const deleteError = ref("");
const factToEdit = ref<MemoryFact | null>(null);
const factEditorOpen = ref(false);
const factFormError = ref("");
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
    createdAt: formatTimeAgo(fact.createdAt, $i18n.locale.value),
    manual: fact.source === "manual",
    href: pathOfThread(fact.source),
  };
}
/*
  按钮名字带上事实正文，而不是三对一模一样的 Edit / Delete（2026-09-02 两边同改）。
  正文用与删除确认框同一个截断规则，免得一条长事实把可访问名撑成一段散文。
*/
function factActionLabel(action: string, fact: MemoryFact) {
  return `${action}: ${truncateMemoryFact(fact.content)}`;
}

const FILTER_OPTIONS = ["all", "facts", "summaries"] as const;
function filterLabel(option: MemoryViewFilter) {
  if (option === "all") return t.value.settings.memory.filterAll;
  if (option === "facts") return t.value.settings.memory.filterFacts;
  return t.value.settings.memory.filterSummaries;
}
const pendingSummaryCount = computed(() => {
  const memory = pendingImport.value?.memory;
  if (!memory) return 0;
  return [
    memory.user.workContext,
    memory.user.personalContext,
    memory.user.topOfMind,
    memory.history.recentMonths,
    memory.history.earlierContext,
    memory.history.longTermBackground,
  ].filter((section) => section.summary.trim()).length;
});
const importExtraCount = computed(
  () =>
    pendingImport.value?.warnings.filter(
      (warning) => warning.code === "extra-field",
    ).length ?? 0,
);
const importDuplicateCount = computed(
  () =>
    pendingImport.value?.warnings.filter(
      (warning) => warning.code === "duplicate-fact-content",
    ).length ?? 0,
);
const factPending = computed(
  () => owner.create.isPending.value || owner.update.isPending.value,
);

function errorMessage(cause: unknown, fallback: string) {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}

function resetFactForm() {
  factToEdit.value = null;
  factForm.content = "";
  factForm.category = "context";
  factForm.confidence = "0.8";
  factFormError.value = "";
}

function openCreateFact() {
  resetFactForm();
  factEditorOpen.value = true;
}

function openEditFact(fact: MemoryFact) {
  factToEdit.value = fact;
  factForm.content = fact.content;
  factForm.category = fact.category;
  factForm.confidence = String(fact.confidence);
  factFormError.value = "";
  factEditorOpen.value = true;
}

function closeFactEditor() {
  if (factPending.value) return;
  factEditorOpen.value = false;
  resetFactForm();
}

async function saveFact() {
  if (factPending.value) return;
  const validation = validateMemoryFactForm(factForm);
  if (!validation.ok) {
    factFormError.value =
      validation.field === "content"
        ? t.value.settings.memory.factValidationContent
        : t.value.settings.memory.factValidationConfidence;
    return;
  }
  factFormError.value = "";
  try {
    if (factToEdit.value) {
      const input = buildMemoryFactPatchInput(factToEdit.value, factForm);
      if (Object.keys(input).length > 0) {
        await owner.update.mutateAsync({ factId: factToEdit.value.id, input });
      }
    } else {
      await owner.create.mutateAsync(buildMemoryFactCreateInput(factForm));
    }
    toast.success(
      factToEdit.value
        ? t.value.settings.memory.editFactSuccess
        : t.value.settings.memory.addFactSuccess,
    );
    closeFactEditor();
  } catch (cause) {
    factFormError.value = errorMessage(cause, t.value.settings.memory.factSave);
  }
}

async function selectImport(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  target.value = "";
  if (!file) return;
  importError.value = "";
  try {
    const validation = parseMemoryImportText(await file.text());
    if (!validation.ok) {
      const first = validation.issues[0];
      importError.value = t.value.settings.memory.importSchemaIssue(
        first?.code ?? "invalid",
        first?.path ?? "$",
      );
      return;
    }
    pendingImport.value = {
      fileName: file.name,
      memory: validation.memory,
      warnings: validation.warnings,
    };
  } catch (cause) {
    importError.value = errorMessage(
      cause,
      t.value.settings.memory.importInvalidFile,
    );
  }
}

function cancelImport() {
  if (owner.importDocument.isPending.value) return;
  pendingImport.value = null;
  importError.value = "";
}

async function confirmImport() {
  const pending = pendingImport.value;
  if (!pending || owner.importDocument.isPending.value) return;
  importError.value = "";
  try {
    await owner.importDocument.mutateAsync(pending.memory);
    toast.success(t.value.settings.memory.importSuccess);
    pendingImport.value = null;
  } catch (cause) {
    importError.value = errorMessage(
      cause,
      t.value.settings.memory.importInvalidFile,
    );
  }
}

async function exportDocument() {
  if (owner.exportDocument.isPending.value) return;
  pageError.value = "";
  try {
    const memory = await owner.exportDocument.mutateAsync();
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(memory, null, 2)], {
        type: "application/json",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `deerflow-memory-${(memory.lastUpdated || new Date().toISOString()).replaceAll(/[:.]/g, "-")}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    toast.success(t.value.settings.memory.exportSuccess);
  } catch (cause) {
    pageError.value = errorMessage(cause, t.value.common.exportFailed);
  }
}

async function confirmClear() {
  if (owner.clear.isPending.value) return;
  clearError.value = "";
  try {
    await owner.clear.mutateAsync();
    toast.success(t.value.settings.memory.clearAllSuccess);
    clearDialogOpen.value = false;
  } catch (cause) {
    clearError.value = errorMessage(cause, t.value.settings.memory.clearAll);
  }
}

function openDelete(fact: MemoryFact) {
  deleteError.value = "";
  factToDelete.value = fact;
}

async function confirmDelete() {
  const fact = factToDelete.value;
  if (!fact || owner.remove.isPending.value) return;
  deleteError.value = "";
  try {
    await owner.remove.mutateAsync(fact.id);
    toast.success(t.value.settings.memory.factDeleteSuccess);
    factToDelete.value = null;
  } catch (cause) {
    deleteError.value = errorMessage(cause, t.value.common.delete);
  }
}
</script>

<template>
  <SettingsSection
    data-testid="memory-settings"
    :title="t.settings.memory.title"
    :description="t.settings.memory.description"
  >
    <div class="space-y-5">
      <p v-if="owner.loading.value" class="text-muted-foreground text-sm">
        {{ t.common.loading }}
      </p>
      <p
        v-else-if="owner.error.value"
        role="alert"
        class="text-destructive text-sm"
      >
        {{ errorMessage(owner.error.value, t.settings.memory.empty) }}
      </p>
      <template v-else-if="owner.memory.value">
        <div class="space-y-3">
          <!--
            上游这一行是 `<Input>` + `<ToggleGroup type="single" variant="outline">`
            （memory-settings-page.tsx:561）。两处都换：本仓原来的 `type="search"`
            在可访问性树里是 `searchbox`（上游是 `textbox`），三颗筛选按钮原来是裸
            `button`（上游是单选组里的 `radio`，读屏器念得出「三选一，当前第一项」）。
          -->
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
              class="shrink-0 self-start sm:ml-auto sm:self-auto"
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
          <!--
            上游 `memory-settings-page.tsx:592` 这一行四颗全走 Button：前三颗
            `variant="outline"`，清空那颗 `variant="destructive" className="ml-auto"`。
            手写那版有三处台账看不见的落差：

            ① **前三颗一条 hover 都没有**——鼠标停上去毫无反应，而 outline 变体带着
               `hover:bg-accent hover:text-accent-foreground`；
            ② **清空键写死 `bg-red-600 text-white`**，不是 `bg-destructive`。深色主题下
               destructive 会跟着 token 翻转，写死的 red-600 不会（同 wave 70 在
               AgentCard 上修掉的那一处）；
            ③ **清空键没有 `:disabled`**，而上游是 `disabled={clearMemory.isPending}`
               ——清空正在飞的时候还能再点一次。
          -->
          <div class="flex flex-wrap items-center gap-2">
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
              @click="
                clearError = '';
                clearDialogOpen = true;
              "
            >
              {{ t.settings.memory.clearAll }}
            </Button>
          </div>
          <p v-if="importError" role="alert" class="text-destructive text-sm">
            {{ importError }}
          </p>
          <p v-if="pageError" role="alert" class="text-destructive text-sm">
            {{ pageError }}
          </p>
        </div>

        <p
          v-if="visible.fullyEmpty"
          class="text-muted-foreground rounded-lg border border-dashed p-4 text-sm"
          data-testid="memory-empty"
        >
          {{ t.settings.memory.memoryFullyEmpty }}
        </p>
        <p
          v-if="!visible.hasMatches && visible.query"
          class="text-muted-foreground rounded-lg border border-dashed p-4 text-sm"
          data-testid="memory-no-matches"
        >
          {{ t.settings.memory.noMatches }}
        </p>

        <!--
          摘要区是**一份 markdown 文档**，不是一叠卡片（上游 memory-settings-page.tsx:637
          把六个小节拼成 `## / ### / > 引用 / ---` 再交给 SafeStreamdown）。本仓原来是
          六张手写 `<article>`：没有分组标题、没有引用块、时间是裸 ISO，而且**空小节
          直接被过滤掉**——用户看不出「个人上下文」是没有内容还是这个功能不存在。
        -->
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

        <!--
          事实行的次序是**元数据在上、正文在下**（上游 memory-settings-page.tsx:665）。
          本仓原来倒过来，并且四项元数据全是原样：category 不首字母大写、confidence
          念的是 `0.92` 这个数字而不是「Very high」这个档位、createdAt 是裸 ISO、
          source 是 `conversation` 这种内部值而不是一条能点进去的链接。
        -->
        <div v-if="visible.showFacts" class="min-w-0 rounded-lg border p-4">
          <div class="mb-4">
            <h3 class="text-base font-medium">
              {{ t.settings.memory.markdown.facts }}
            </h3>
          </div>
          <p
            v-if="visible.facts.length === 0"
            class="text-muted-foreground text-sm"
          >
            {{
              visible.query
                ? t.settings.memory.noMatches
                : t.settings.memory.noFacts
            }}
          </p>
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
                      >{{ t.settings.memory.markdown.table.source }}:</span
                    >
                    <template v-if="factMeta(fact).manual">
                      {{ t.settings.memory.manualFactSource }}
                    </template>
                    <NuxtLink
                      v-else
                      :to="factMeta(fact).href"
                      class="text-primary underline-offset-4 hover:underline"
                    >
                      {{ t.settings.memory.markdown.table.view }}
                    </NuxtLink>
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

  <SettingsActionDialog
    :open="pendingImport !== null"
    :title="t.settings.memory.importConfirmTitle"
    :description="t.settings.memory.importConfirmDescription"
    :confirm-label="t.common.import"
    :cancel-label="t.common.cancel"
    :pending="owner.importDocument.isPending.value"
    data-testid="memory-import-dialog"
    @cancel="cancelImport"
    @confirm="confirmImport"
  >
    <div
      v-if="pendingImport"
      class="bg-muted space-y-1 rounded-md border p-3 text-sm"
    >
      <div>
        {{ t.settings.memory.importFileLabel }}: {{ pendingImport.fileName }}
      </div>
      <div>{{ t.common.version }}: {{ pendingImport.memory.version }}</div>
      <div>
        {{ t.common.lastUpdated }}:
        {{ pendingImport.memory.lastUpdated || "-" }}
      </div>
      <div>
        {{ t.settings.memory.filterSummaries }}: {{ pendingSummaryCount }}
      </div>
      <div>
        {{ t.settings.memory.filterFacts }}:
        {{ pendingImport.memory.facts.length }}
      </div>
      <div
        v-if="importExtraCount"
        class="text-amber-700"
        data-testid="memory-import-extra-warning"
      >
        {{ t.settings.memory.importExtraWarning(importExtraCount) }}
      </div>
      <div
        v-if="importDuplicateCount"
        class="text-amber-700"
        data-testid="memory-import-duplicate-warning"
      >
        {{
          t.settings.memory.importDuplicateContentWarning(importDuplicateCount)
        }}
      </div>
    </div>
    <p v-if="importError" role="alert" class="text-destructive text-sm">
      {{ importError }}
    </p>
  </SettingsActionDialog>

  <SettingsActionDialog
    :open="clearDialogOpen"
    :title="t.settings.memory.clearAllConfirmTitle"
    :description="t.settings.memory.clearAllConfirmDescription"
    :confirm-label="t.settings.memory.clearAll"
    :cancel-label="t.common.cancel"
    :pending="owner.clear.isPending.value"
    destructive
    data-testid="memory-clear-dialog"
    @cancel="!owner.clear.isPending.value && (clearDialogOpen = false)"
    @confirm="confirmClear"
  >
    <p v-if="clearError" role="alert" class="text-destructive text-sm">
      {{ clearError }}
    </p>
  </SettingsActionDialog>

  <SettingsActionDialog
    :open="factToDelete !== null"
    :title="t.settings.memory.factDeleteConfirmTitle"
    :description="t.settings.memory.factDeleteConfirmDescription"
    :confirm-label="t.common.delete"
    :cancel-label="t.common.cancel"
    :pending="owner.remove.isPending.value"
    destructive
    data-testid="memory-delete-dialog"
    @cancel="!owner.remove.isPending.value && (factToDelete = null)"
    @confirm="confirmDelete"
  >
    <div v-if="factToDelete" class="bg-muted rounded-md border p-3 text-sm">
      <div class="text-muted-foreground mb-1 font-medium">
        {{ t.settings.memory.factPreviewLabel }}
      </div>
      {{ truncateMemoryFact(factToDelete.content) }}
    </div>
    <p v-if="deleteError" role="alert" class="text-destructive text-sm">
      {{ deleteError }}
    </p>
  </SettingsActionDialog>

  <SettingsActionDialog
    :open="factEditorOpen"
    :title="
      factToEdit
        ? t.settings.memory.editFactTitle
        : t.settings.memory.addFactTitle
    "
    :confirm-label="t.settings.memory.factSave"
    :cancel-label="t.common.cancel"
    :pending="factPending"
    data-testid="memory-fact-dialog"
    @cancel="closeFactEditor"
    @confirm="saveFact"
  >
    <label class="block space-y-1 text-sm">
      <span>{{ t.settings.memory.factContentLabel }}</span>
      <!--
        这三个字段走 `ui/textarea` / `ui/input`，不要手写：上游同一处是
        `memory-settings-page.tsx:807/829/849` 的 `<Textarea>` 与两颗 `<Input>`。
        手写那版丢掉的是焦点环、无效态（`aria-invalid:`）、禁用态样式、
        深色主题 token 与 `h-9` 的统一高度——同一个对话框上方那颗搜索框早就是
        `<Input>` 了，只有这三个不是。
      -->
      <Textarea
        v-model="factForm.content"
        rows="4"
        :placeholder="t.settings.memory.factContentPlaceholder"
        data-testid="memory-fact-content"
      />
    </label>
    <div class="grid gap-3 sm:grid-cols-2">
      <label class="block space-y-1 text-sm">
        <span>{{ t.settings.memory.factCategoryLabel }}</span>
        <Input
          v-model="factForm.category"
          :placeholder="t.settings.memory.factCategoryPlaceholder"
          data-testid="memory-fact-category"
        />
      </label>
      <label class="block space-y-1 text-sm">
        <span>{{ t.settings.memory.factConfidenceLabel }}</span>
        <Input
          v-model="factForm.confidence"
          type="number"
          min="0"
          max="1"
          step="0.01"
          data-testid="memory-fact-confidence"
        />
      </label>
    </div>
    <p class="text-muted-foreground text-xs">
      {{ t.settings.memory.factConfidenceHint }}
    </p>
    <p v-if="factFormError" role="alert" class="text-destructive text-sm">
      {{ factFormError }}
    </p>
  </SettingsActionDialog>
</template>
