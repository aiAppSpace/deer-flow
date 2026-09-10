<!--
  【文件职责】     把 CSV/TSV 产物画成可翻页、可展开单元格的表格。
  【架构位置】     L4 产品组件
  【主要导出】     默认 ArtifactTablePreview 组件
  【依赖关系】     composables/useDelimitedPreview · ui/button · ui/dialog · core/clipboard
  【边界与注意】   - 单元格一律当**字面量**渲染：`00123` 不能变成 123，
                   `<script>` 不能变成标签。所以只用文本插值，绝不 v-html。
                 - 「预览」和「全部」是两回事：样本被上限截过就说「预览前 N 行」，
                   页脚也标出来。把有界样本说成总数，用户会拿它当结论。
                 - 长内容不撑高行：超过 120 字符或含换行的单元格收进对话框，
                   否则一条脏数据就能把整张表拉成一屏一行。
                 - 换文件（identity）重置表头选择和翻页；只改内容（草稿编辑）
                   只重置翻页——表头是用户的选择，内容变一下不该把它推翻。
                 - `active=false` 时整块 `hidden`，且解析真的停掉（见 composable）。
-->

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ChevronLeft, ChevronRight, Loader, Table2 } from "lucide-vue-next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDelimitedPreview } from "@/composables/useDelimitedPreview";
import { writeTextToClipboard } from "@/core/clipboard";

const PAGE_SIZE = 50;
const MAX_DATA_ROWS = 200;
const MAX_COLUMNS = 50;
/** 超过这个长度（或含换行）的单元格收进对话框，不撑高整行。 */
const INLINE_CELL_LIMIT = 120;

const props = withDefaults(
  defineProps<{
    content: string;
    delimiter: "," | "\t";
    truncated: boolean;
    identity: string;
    active?: boolean;
  }>(),
  { active: true },
);

const { $i18n } = useNuxtApp();
const labels = computed(() => $i18n.t.value.artifactTable);

const { result, status, retry } = useDelimitedPreview({
  content: () => props.content,
  delimiter: () => props.delimiter,
  truncated: () => props.truncated,
  identity: () => props.identity,
  active: () => props.active,
});

const hasHeader = ref(true);
const page = ref(0);
const cell = ref<{ value: string; label: string } | null>(null);
const copyStatus = ref("");

watch(
  () => props.identity,
  () => {
    hasHeader.value = true;
    page.value = 0;
    cell.value = null;
  },
);
watch(
  () => props.content,
  () => {
    page.value = 0;
    // 内容变了，展开的还是旧内容里的单元格。
    cell.value = null;
  },
);
watch(hasHeader, () => {
  page.value = 0;
});

const headerOffset = computed(() => (hasHeader.value ? 1 : 0));
const headerRow = computed(() => result.value?.rows[0]);
const rows = computed(
  () =>
    result.value?.rows.slice(
      headerOffset.value,
      headerOffset.value + MAX_DATA_ROWS,
    ) ?? [],
);
const limited = computed(
  () =>
    result.value?.limited === true ||
    (result.value !== undefined &&
      result.value.rows.length > MAX_DATA_ROWS + headerOffset.value),
);
const columnCount = computed(() =>
  Math.min(result.value?.columnCount ?? 0, MAX_COLUMNS),
);
const columns = computed(() =>
  Array.from({ length: columnCount.value }, (_, index) => index),
);
const start = computed(() =>
  Math.min(page.value * PAGE_SIZE, Math.max(0, rows.value.length - 1)),
);
const end = computed(() =>
  Math.min(start.value + PAGE_SIZE, rows.value.length),
);
const pageRows = computed(() => rows.value.slice(start.value, end.value));
const tableMinWidth = computed(() =>
  Math.max(320, columnCount.value * 180 + 48),
);
const showsNotice = computed(
  () =>
    result.value !== undefined &&
    (result.value.columnCount > MAX_COLUMNS || result.value.unevenRows),
);

function isExpandable(value: string | undefined): boolean {
  return (
    value !== undefined &&
    (value.length > INLINE_CELL_LIMIT || /[\r\n]/.test(value))
  );
}

function openCell(value: string, row: number, column: number) {
  cell.value = { value, label: labels.value.cell(row, column) };
  copyStatus.value = "";
}

const cellOpen = computed({
  get: () => cell.value !== null && props.active,
  set: (open: boolean) => {
    if (!open) cell.value = null;
  },
});

async function copyCell() {
  const clipboard = $i18n.t.value.clipboard;
  try {
    copyStatus.value = (await writeTextToClipboard(cell.value?.value ?? ""))
      ? clipboard.copiedToClipboard
      : clipboard.failedToCopyToClipboard;
  } catch {
    copyStatus.value = clipboard.failedToCopyToClipboard;
  }
}
</script>

<template>
  <div
    :hidden="!active"
    class="flex h-full min-h-0 flex-col"
    data-testid="artifact-table-preview"
  >
    <div
      v-if="status === 'error'"
      role="status"
      class="text-muted-foreground flex flex-col items-center gap-3 p-8 text-center text-sm"
    >
      <p>{{ labels.failed }}</p>
      <Button variant="outline" @click="retry">{{ labels.retry }}</Button>
    </div>
    <div
      v-else-if="status === 'loading' || !result"
      role="status"
      class="text-muted-foreground flex items-center gap-2 p-6 text-sm"
    >
      <Loader class="size-4 animate-spin" />
      {{ $i18n.t.value.common.loading }}
    </div>
    <p
      v-else-if="result.rows.length === 0"
      role="status"
      class="text-muted-foreground p-6 text-sm"
    >
      {{ limited ? labels.incomplete : labels.empty }}
    </p>
    <template v-else>
      <div
        class="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b px-4 py-3 text-xs"
      >
        <span class="flex items-center gap-2 font-medium">
          <Table2 class="text-muted-foreground size-4" />
          {{ limited ? labels.sample(rows.length) : labels.total(rows.length) }}
        </span>
        <label
          class="text-muted-foreground flex cursor-pointer items-center gap-2"
        >
          <input
            v-model="hasHeader"
            type="checkbox"
            class="accent-primary size-3.5"
          />
          {{ labels.header }}
        </label>
      </div>
      <p
        v-if="showsNotice"
        role="status"
        class="bg-muted/30 text-muted-foreground border-b px-4 py-2 text-xs"
      >
        <template v-if="result.columnCount > MAX_COLUMNS">{{
          labels.columnsLimited
        }}</template>
        <template v-if="result.unevenRows"> {{ labels.uneven }}</template>
      </p>
      <div
        class="min-h-0 flex-1 overflow-auto"
        tabindex="0"
        role="region"
        :aria-label="labels.title"
      >
        <table
          :aria-label="labels.title"
          class="w-full table-fixed border-separate border-spacing-0 text-sm"
          :style="{ minWidth: `${tableMinWidth}px` }"
        >
          <colgroup>
            <col style="width: 48px" />
            <col v-for="index in columns" :key="index" />
          </colgroup>
          <thead class="bg-muted sticky top-0 z-10">
            <tr>
              <th
                scope="col"
                class="text-muted-foreground border-b px-3 py-3 text-xs font-normal"
              >
                #
              </th>
              <th
                v-for="index in columns"
                :key="index"
                scope="col"
                class="truncate border-b border-l px-3 py-3 text-left text-xs font-medium"
                :title="hasHeader ? headerRow?.[index] : undefined"
              >
                {{
                  hasHeader
                    ? (headerRow?.[index] ?? "")
                    : labels.column(index + 1)
                }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, rowIndex) in pageRows"
              :key="start + rowIndex"
              class="even:bg-muted/20 hover:bg-muted/40"
            >
              <th
                scope="row"
                class="text-muted-foreground border-b px-3 py-2.5 text-right text-xs font-normal tabular-nums"
              >
                {{ start + rowIndex + 1 }}
              </th>
              <td
                v-for="column in columns"
                :key="column"
                class="border-b border-l px-3 py-2.5 align-top"
              >
                <div class="truncate">
                  <span
                    v-if="row[column] === undefined"
                    class="text-muted-foreground text-xs italic"
                    >{{ labels.missing }}</span
                  >
                  <button
                    v-else-if="isExpandable(row[column])"
                    type="button"
                    class="max-w-full cursor-pointer truncate text-left underline underline-offset-4"
                    :aria-label="labels.cell(start + rowIndex + 1, column + 1)"
                    @click="
                      openCell(row[column]!, start + rowIndex + 1, column + 1)
                    "
                  >
                    {{ row[column]!.slice(0, INLINE_CELL_LIMIT) }}
                  </button>
                  <span v-else class="whitespace-pre" :title="row[column]">{{
                    row[column]
                  }}</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div
        class="text-muted-foreground flex shrink-0 items-center justify-between border-t px-4 py-2 text-xs"
      >
        <span aria-live="polite">
          {{ labels.range(rows.length ? start + 1 : 0, end, limited) }}
        </span>
        <div class="flex gap-1">
          <Button
            size="icon-sm"
            variant="ghost"
            :aria-label="labels.previous"
            :disabled="page === 0"
            @click="page -= 1"
          >
            <ChevronLeft class="size-4" />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            :aria-label="labels.next"
            :disabled="end >= rows.length"
            @click="page += 1"
          >
            <ChevronRight class="size-4" />
          </Button>
        </div>
      </div>
    </template>

    <Dialog v-model:open="cellOpen">
      <DialogContent :close-label="$i18n.t.value.primitives.close">
        <DialogHeader>
          <DialogTitle>{{ labels.cellValue }}</DialogTitle>
          <DialogDescription>{{ cell?.label }}</DialogDescription>
        </DialogHeader>
        <textarea
          :aria-label="labels.cellValue"
          readonly
          :value="cell?.value ?? ''"
          class="h-64 w-full resize-none rounded-md border p-3 font-mono text-sm"
        />
        <div class="flex items-center justify-end gap-3">
          <span role="status" class="text-muted-foreground text-xs">{{
            copyStatus
          }}</span>
          <Button variant="outline" @click="copyCell">
            {{ $i18n.t.value.clipboard.copyToClipboard }}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
