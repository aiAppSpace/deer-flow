<script setup lang="ts">
/*
  【文件职责】     在 run 最终 assistant 气泡显示完整 workspace-change summary/detail。
  【架构位置】     L3 extension reference
  【主要导出】     默认 WorkspaceChangesBadge 组件
  【依赖关系】     useWorkspaceChanges · presentation/summary · artifact URL · ui/sheet
  【边界与注意】   server state 仅由 useWorkspaceChanges/TanStack Query 持有。

                   **折叠态那张卡片上没有状态词。** 上游 `workspace-change-badge.tsx`
                   的 summary 行只有「路径 + 增删数」，`Created` / `Modified` 这些字
                   只出现在展开后的面板里。S7 要求的「完整显示 status」由面板那一层
                   满足，卡片上再写一遍是本仓多出来的——它让同一行在两个应用里读出来
                   不是同一句（对照台账上就是那条
                   `+8-2 outputs/report.md Modified +1-1`）。

                   增删数两边都是「两个 span」，但上游用 `inline-flex ... gap-1`
                   而这里原来用 `ml-1`：gap 产生的是**布局间隙**，会进可访问性树的
                   文本拼接（`+8 -2`），margin 不会（`+8-2`）。看起来只是空格，
                   读屏器念出来是两个数字还是一个数字。
*/
import { computed, ref, watch } from "vue";
import {
  ArrowUpRight,
  ExternalLink,
  FileDiff,
  FileMinus,
  FilePenLine,
  FilePlus,
} from "lucide-vue-next";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useWorkspaceChanges } from "@/composables/useWorkspaceChanges";
import { resolveArtifactURL } from "@/core/artifacts/utils";
import {
  formatWorkspacePath,
  workspaceChangeReasonKey,
  workspaceChangeStatusKey,
} from "@/core/workspace-changes/presentation";
import {
  getChangedFileCount,
  getWorkspaceChangeLineClass,
  sortWorkspaceChanges,
} from "@/core/workspace-changes/summary";
import type { WorkspaceFileChange } from "@/core/workspace-changes/types";

const props = defineProps<{
  threadId: string;
  runId?: string;
  disabled?: boolean;
}>();
const { $i18n } = useNuxtApp();
const open = ref(false);
const summaryOwner = useWorkspaceChanges({
  threadId: computed(() => props.threadId),
  runId: computed(() => props.runId),
  includeFiles: true,
  includeDiff: false,
  enabled: computed(() => Boolean(props.runId && !props.disabled)),
});
const detailOwner = useWorkspaceChanges({
  threadId: computed(() => props.threadId),
  runId: computed(() => props.runId),
  includeFiles: true,
  includeDiff: true,
  enabled: computed(() =>
    Boolean(open.value && props.runId && !props.disabled),
  ),
});

const summary = computed(() => summaryOwner.data.value);
const details = computed(() => detailOwner.data.value);
const count = computed(() =>
  summary.value?.available ? getChangedFileCount(summary.value.summary) : 0,
);
const files = computed(() =>
  sortWorkspaceChanges((details.value ?? summary.value)?.files ?? []),
);
const summaryError = computed(() => errorMessage(summaryOwner.error.value));
const detailError = computed(() => errorMessage(detailOwner.error.value));

watch(
  () => [props.threadId, props.runId] as const,
  () => {
    open.value = false;
  },
);

function errorMessage(error: unknown) {
  if (!error) return null;
  return error instanceof Error && error.message.trim()
    ? error.message
    : $i18n.t.value.workspaceChanges.loadFailed;
}

/*
  **三档都要带 `dark:` 变体**（上游 `workspace-change-panel.tsx:235`）。
  `text-emerald-700` / `text-red-700` / `text-sky-700` 是给浅色底配的深色字；
  深色主题下底还是那层 `/10` 的半透明色、字却仍然是 700 档——
  **深字压在深底上**，diff 基本读不出来。上游三档各带一个 `dark:text-*-300`，
  本仓三档一个都没有。
*/
function lineClass(line: string) {
  const type = getWorkspaceChangeLineClass(line);
  if (type === "addition")
    return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (type === "deletion")
    return "bg-red-500/10 text-red-700 dark:text-red-300";
  if (type === "hunk") return "bg-sky-500/10 text-sky-700 dark:text-sky-300";
  if (type === "meta") return "text-muted-foreground";
  return "text-foreground";
}

function statusText(file: WorkspaceFileChange) {
  return $i18n.t.value.workspaceChanges[workspaceChangeStatusKey(file.status)];
}

function reasonText(file: WorkspaceFileChange) {
  return $i18n.t.value.workspaceChanges[
    workspaceChangeReasonKey(file.diff_unavailable_reason)
  ];
}

function canOpen(file: WorkspaceFileChange) {
  return file.status !== "deleted" && !file.sensitive;
}

function fileKey(file: WorkspaceFileChange) {
  return `${file.status}:${file.path}`;
}

/*
  上游的每行是 `<Collapsible defaultOpen={hasDiff}>`；本仓这一层是**受控**的
  （见 ui/collapsible/Collapsible.vue 的文件头），所以展开态放在这里。

  **只记用户翻过的那几行，默认值在模板里用 `?? Boolean(file.diff)` 兜底。**
  第一版是 `watch(files, …, { immediate: true })` 预填一张全表——功能上等价，
  但它在 setup 阶段就**读了 `files`**，于是把这个组件订阅到了 detail 查询上，
  而这块 UI 只在 Sheet 打开时才渲染。代价不在本组件：实测
  `real-stream.spec.ts` 里「流式期间用户上滚后不该被拽回底部」那条
  **三次里红两次**，而干净树上三次全绿、只还原这一个文件也三次全绿。
  **一个「预热缓存」式的 watch，代价会落在别人身上。**
  （本仓自己的路径**不要写成 `文件:行号`**——`upstream-citations`
  会把那种形状当成对上游的引用，然后报「文件不存在」。）
*/
const openFiles = ref<Record<string, boolean>>({});

/** 状态图标照上游 workspace-change-panel.tsx:188 的 StatusIcon。 */
function statusIcon(file: WorkspaceFileChange) {
  if (file.status === "created") return FilePlus;
  if (file.status === "deleted") return FileMinus;
  return FilePenLine;
}

function statusIconClass(file: WorkspaceFileChange) {
  if (file.status === "created") return "text-emerald-500";
  if (file.status === "deleted") return "text-red-500";
  return "text-sky-500";
}
</script>

<template>
  <div
    v-if="summaryError && !summary"
    class="border-destructive/30 bg-destructive/5 text-destructive mt-3 rounded-xl border p-3 text-sm"
    role="alert"
    data-testid="workspace-changes-summary-error"
  >
    <p>{{ summaryError }}</p>
    <button
      type="button"
      class="mt-2 underline disabled:pointer-events-none disabled:opacity-50"
      :disabled="summaryOwner.fetching.value"
      @click="summaryOwner.refetch()"
    >
      {{ $i18n.t.value.workspaceChanges.retry }}
    </button>
  </div>

  <div
    v-else-if="count > 0 && summary"
    class="border-border/70 bg-muted/20 mt-3 overflow-hidden rounded-xl border"
  >
    <div
      class="border-border/70 flex items-center justify-between gap-3 border-b p-3"
    >
      <div class="flex min-w-0 items-center gap-2.5">
        <div
          class="bg-background/80 flex size-10 shrink-0 items-center justify-center rounded-lg"
        >
          <FileDiff class="text-muted-foreground size-4" />
        </div>
        <div class="min-w-0">
          <div class="text-foreground text-sm font-semibold">
            {{ $i18n.t.value.workspaceChanges.editedTitle(count) }}
          </div>
          <p
            v-if="summary.summary.truncated"
            class="mt-0.5 text-xs text-amber-700"
          >
            {{ $i18n.t.value.workspaceChanges.truncatedSummary }}
          </p>
          <button
            data-testid="workspace-changes-open"
            type="button"
            class="text-muted-foreground hover:text-foreground mt-0.5 inline-flex items-center gap-1 text-xs font-medium transition-colors"
            @click="open = true"
          >
            {{ $i18n.t.value.workspaceChanges.viewChanges }}
            <ArrowUpRight :size="12" />
          </button>
        </div>
      </div>
      <span
        class="hidden shrink-0 items-center gap-1 text-xs font-semibold tabular-nums sm:inline-flex"
      >
        <span class="text-emerald-500">+{{ summary.summary.additions }}</span>
        <span class="text-red-500">-{{ summary.summary.deletions }}</span>
      </span>
    </div>
    <div class="py-1">
      <div
        v-for="file in sortWorkspaceChanges(summary.files)"
        :key="`${file.status}:${file.path}`"
        class="flex items-center justify-between gap-3 px-3 py-2.5"
      >
        <div class="min-w-0 truncate text-sm" :title="file.path">
          <span
            v-if="formatWorkspacePath(file.path).dirname"
            class="text-muted-foreground"
            >{{ formatWorkspacePath(file.path).dirname }}/</span
          ><span class="text-foreground font-medium">{{
            formatWorkspacePath(file.path).basename
          }}</span>
        </div>
        <span
          class="inline-flex shrink-0 items-center gap-1 text-sm font-semibold tabular-nums"
        >
          <span class="text-emerald-500">+{{ file.additions }}</span>
          <span class="text-red-500">-{{ file.deletions }}</span>
        </span>
      </div>
    </div>
  </div>

  <Sheet v-model:open="open">
    <!--
      `sm:max-w-[900px]` 而不是 `sm:max-w-none`（上游
      workspace-change-panel.tsx:67）。**今天两者渲染一模一样**——
      宽度本来就是 `min(92vw,900px)`，封顶封在同一个数上，读数零变化。
      照抄的理由不是量出来的：两个 token 的语义不同（封顶 vs 不封顶），
      哪天上游动了那个 `w-[...]`，`max-w-none` 会安静地跟着走偏。
    -->
    <SheetContent
      v-if="summary"
      class="w-[min(92vw,900px)] gap-0 p-0 sm:max-w-[900px]"
      :close-label="$i18n.t.value.primitives.close"
    >
      <!--
        头部照上游 workspace-change-panel.tsx:68：图标在 `SheetTitle` **里面**
        （`flex items-center gap-2 text-base`），不是标题旁边的一列。
        本仓原来是 `flex-row ... gap-3 pr-14` + 一个同级图标，于是标题
        往右挪 28px、可用宽度少 64px——wave 87 把这一屏接进取样面时量到的
        两行几何差异就是它。
      -->
      <SheetHeader class="border-border border-b px-5 py-4">
        <SheetTitle class="flex items-center gap-2 text-base">
          <FileDiff class="text-muted-foreground size-4" />
          {{ $i18n.t.value.workspaceChanges.title }}
        </SheetTitle>
        <SheetDescription>
          {{
            $i18n.t.value.workspaceChanges.badge(
              count,
              summary.summary.additions,
              summary.summary.deletions,
            )
          }}
        </SheetDescription>
      </SheetHeader>
      <!--
        纵向内边距是 `py-4` 不是 `p-5`（上游 workspace-change-panel.tsx:85 的
        `px-5 py-4`）。差的这 4px 会把面板里**每一行**往下推 4px；
        2026-09-12 给 diff 三行挂上锚点时当场量到 `y Δ4`，在那之前
        这一整块面板里只有一个 heading 锚点，而它在 header 里、量不到这一处。
      -->
      <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <p
          v-if="detailOwner.loading.value"
          class="text-muted-foreground text-sm"
        >
          {{ $i18n.t.value.workspaceChanges.loading }}
        </p>
        <div
          v-if="detailError"
          role="alert"
          class="border-destructive/30 bg-destructive/5 text-destructive mb-4 rounded-lg border p-3 text-sm"
        >
          <p>{{ detailError }}</p>
          <button
            data-testid="workspace-changes-retry"
            type="button"
            class="mt-2 underline disabled:pointer-events-none disabled:opacity-50"
            :disabled="detailOwner.fetching.value"
            @click="detailOwner.refetch()"
          >
            {{ $i18n.t.value.workspaceChanges.retry }}
          </button>
        </div>
        <p
          v-if="!detailOwner.loading.value && !files.length"
          class="text-muted-foreground text-sm"
        >
          {{ $i18n.t.value.workspaceChanges.noChanges }}
        </p>
        <div v-else class="flex flex-col gap-3">
          <!--
            每行照上游的 `Collapsible`，不是 `<details>`。三处可观察差异：
            ① `<details>` 的隐式 role 是 **group**，对照树里多一行 `group:`；
            ② 原生 `<summary role="button">` 不广播 `aria-expanded`，
               上游那颗触发器是 `[expanded]`；
            ③ 「打开文件」那个链接原来挂 `aria-label`，**它会被算进外层按钮的
               可访问名**（读出来是「…… Modified Open file」）；上游用 `title`，
               链接自己仍然有名字，而按钮的名字里没有它。
          -->
          <Collapsible
            v-for="file in files"
            :key="fileKey(file)"
            :open="openFiles[fileKey(file)] ?? Boolean(file.diff)"
            @update:open="openFiles[fileKey(file)] = $event"
          >
            <div class="border-border/70 bg-background rounded-lg border">
              <CollapsibleTrigger
                class="flex w-full items-start justify-between gap-3 px-3 py-2 text-left"
              >
                <div class="flex min-w-0 items-start gap-2">
                  <component
                    :is="statusIcon(file)"
                    :class="['mt-0.5 size-4 shrink-0', statusIconClass(file)]"
                  />
                  <div class="min-w-0">
                    <div class="text-foreground truncate font-mono text-xs">
                      {{ file.path }}
                    </div>
                    <div
                      class="text-muted-foreground mt-1 flex items-center gap-2 text-xs"
                    >
                      <span>{{ statusText(file) }}</span>
                      <!--
                        两个 span 之间**必须有一个真的文本节点**：上游写的是
                        JSX 的 `{" "}`，读屏器念出来是「+1 -1」两个数字。
                        Vue 模板里换行之间的空白会被 condense 掉，所以用
                        `{{ " " }}` 显式产生它，而不是靠源码里的那个空格
                        （prettier 一换行就没了）。
                      -->
                      <span v-if="file.additions > 0 || file.deletions > 0">
                        <span class="text-emerald-500"
                          >+{{ file.additions }}</span
                        >{{ " "
                        }}<span class="text-red-500"
                          >-{{ file.deletions }}</span
                        >
                      </span>
                    </div>
                  </div>
                </div>
                <a
                  v-if="canOpen(file)"
                  :href="resolveArtifactURL(file.path, threadId)"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-muted-foreground hover:text-foreground rounded-md p-1 transition-colors"
                  :title="$i18n.t.value.workspaceChanges.openFile"
                  @click.stop
                >
                  <ExternalLink class="size-3.5" />
                </a>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <pre
                  v-if="file.diff"
                  class="border-border/70 bg-muted/30 max-h-[520px] overflow-auto border-t p-0 font-mono text-xs leading-5"
                ><div
                    v-for="(line, index) in file.diff.split('\n')"
                    :key="`${index}:${line}`"
                    :class="['min-w-max px-3 whitespace-pre', lineClass(line)]"
                  >{{ line || " " }}</div></pre>
                <div
                  v-else
                  class="border-border/70 text-muted-foreground border-t px-3 py-3 text-xs"
                >
                  {{ reasonText(file) }}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        </div>
      </div>
    </SheetContent>
  </Sheet>
</template>
