<script setup lang="ts">
/*
  【文件职责】     编排 artifact 分类、有限加载、预览、编辑、动作与 stale 结果隔离。
  【架构位置】     L3 extension reference
  【主要导出】     默认 ArtifactPanel 组件
  【依赖关系】     ArtifactPolicy · useArtifactDraft · ArtifactFileList/Editor/Preview/Actions
  【边界与注意】   drafts/离开决策由父层唯一 owner 持有；本组件只拥有当前 path 的短生命周期 I/O。
*/
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { Code2, Download, Eye, X } from "lucide-vue-next";

import { Button, buttonVariants } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import ArtifactActions from "./ArtifactActions.vue";
import ArtifactEditor from "./ArtifactEditor.vue";
import ArtifactFileList from "./ArtifactFileList.vue";
import ArtifactPreview from "./ArtifactPreview.vue";

import {
  ArtifactRequestError,
  updateArtifactContent,
} from "@/core/artifacts/api";
import { probeArtifactAction } from "@/core/artifacts/actions";
import {
  loadArtifactContent,
  loadArtifactContentFromToolCall,
} from "@/core/artifacts/loader";
import {
  canInstallSkillArtifact,
  canLoadArtifactText,
  canSaveArtifactText,
  classifyArtifact,
  getTabularDelimiter,
} from "@/core/artifacts/policy";
import { canRenderArtifactHtml } from "@/core/artifacts/preview-policy";
import { urlOfArtifact } from "@/core/artifacts/utils";
import { formatArtifactBytes } from "@/core/artifacts/display";
import { resolveArtifactOpenURL } from "@/core/artifacts/viewer";
import { writeTextToClipboard } from "@/core/clipboard";
import { installSkill } from "@/core/skills/api";
import type { Message } from "@/core/types/message";
import { useWorkspaceToast } from "@/core/workspace-shell/toast";
import type { ArtifactDraftOwner } from "@/composables/useArtifactDraft";

const props = defineProps<{
  threadId: string;
  selected: string;
  artifacts: string[];
  openedPresentedArtifacts: string[];
  messages: Message[];
  streaming: boolean;
  isMock?: boolean;
  isAdmin?: boolean;
  draftOwner: ArtifactDraftOwner;
}>();
const { $i18n } = useNuxtApp();
const toast = useWorkspaceToast();
const emit = defineEmits<{ close: []; select: [path: string] }>();

const content = ref("");
const contentUrl = ref<string>();
const sha256 = ref<string>();
const truncated = ref(false);
const fullContentLoaded = ref(false);
const previewBytes = ref<number>();
const totalBytes = ref<number>();
const loading = ref(false);
/** 「正在加载完整文件」是一个**独立**的中间态，React 单独渲染一行提示。 */
const loadingFull = ref(false);
const error = ref("");
/*
  **加载失败**与**动作失败**是两回事，渲染方式也不同：
  React 把预览失败渲染成内容区里的一段固定说明 + 下载入口（ArtifactPreviewError），
  而保存冲突这类动作失败留在头部下方当 alert 播报。原来 Vue 把两者塞进同一个 ref、
  一律弹成 alert，于是 Gateway 的原始错误串（"Path must start with /mnt/user-data"）
  被当成产品文案念给用户听。
*/
const loadError = ref("");
const notice = ref("");
const viewMode = ref<"code" | "preview">("code");
const saving = ref(false);
const installing = ref(false);
let loadGeneration = 0;
let saveGeneration = 0;
let actionGeneration = 0;
let loadController: AbortController | null = null;
let actionController: AbortController | null = null;
let disposed = false;

const isWrite = computed(() => props.selected.startsWith("write-file:"));
const filepath = computed(() => {
  if (!isWrite.value) return props.selected;
  try {
    return decodeURIComponent(new URL(props.selected).pathname);
  } catch {
    return props.selected.slice("write-file:".length);
  }
});
const filename = computed(
  () => filepath.value.split("/").filter(Boolean).at(-1) ?? filepath.value,
);
const policy = computed(() =>
  classifyArtifact(props.selected, { isMock: props.isMock }),
);
const toolResult = computed(() => {
  if (!isWrite.value) return undefined;
  let callId: string | null = null;
  try {
    callId = new URL(props.selected).searchParams.get("tool_call_id");
  } catch {
    return undefined;
  }
  if (!callId) return undefined;
  const message = props.messages.find(
    (candidate) =>
      candidate.type === "tool" && candidate.tool_call_id === callId,
  );
  return typeof message?.content === "string" ? message.content : undefined;
});
const options = computed(() => [
  ...new Set([
    ...props.openedPresentedArtifacts.filter(
      (path) => !props.artifacts.includes(path),
    ),
    ...props.artifacts,
  ]),
]);
const activeDraft = computed(() => props.draftOwner.ensure(filepath.value));
const editing = computed(
  () => props.draftOwner.editingPath.value === filepath.value,
);
const dirty = computed(
  () => activeDraft.value.draftContent !== activeDraft.value.baselineContent,
);
const canEdit = computed(() =>
  canSaveArtifactText(policy.value, {
    hasRevision: Boolean(sha256.value),
    fullContentLoaded: fullContentLoaded.value,
  }),
);
const sourceUrl = computed(() =>
  urlOfArtifact({
    filepath: filepath.value,
    threadId: props.threadId,
    isMock: props.isMock,
  }),
);
const downloadUrl = computed(() =>
  urlOfArtifact({
    filepath: filepath.value,
    threadId: props.threadId,
    download: true,
    isMock: props.isMock,
  }),
);
const htmlPreviewAllowed = computed(
  () =>
    policy.value.kind === "text" &&
    policy.value.language === "html" &&
    canRenderArtifactHtml({
      source:
        policy.value.source === "write-file-draft"
          ? policy.value.source
          : "formal",
      content: content.value,
      truncated: truncated.value,
      fullContentLoaded: fullContentLoaded.value,
      toolResult: toolResult.value,
    }),
);
const tabularDelimiter = computed(() =>
  policy.value.kind === "text"
    ? getTabularDelimiter(policy.value.language)
    : null,
);
const isTabular = computed(() => tabularDelimiter.value !== null);

const previewAllowed = computed(() => {
  if (
    policy.value.kind === "browser-media" ||
    policy.value.kind === "safe-document"
  ) {
    return true;
  }
  if (policy.value.kind !== "text") return false;
  if (
    policy.value.source === "write-file-draft" &&
    toolResult.value !== undefined &&
    toolResult.value.trim() !== "OK"
  ) {
    return false;
  }
  if (isTabular.value) {
    /*
      表格比 markdown/html 多一条：写入**还没完成**时不给预览。
      流式写入中的 CSV 每一帧都是残的，解析出来的表格会不停变形甚至报错，
      而这既不是文件的问题也不是用户能处理的问题。等 write 工具回 OK 再说。
      React 的条件同形（artifact-file-detail.tsx 的 `!isTabular || !isWriteFile ||
      toolResult?.trim() === "OK"`）。
    */
    return (
      policy.value.source !== "write-file-draft" ||
      toolResult.value?.trim() === "OK"
    );
  }
  return policy.value.language === "markdown" || htmlPreviewAllowed.value;
});
// React 的渲染条件是「是不是代码/文本文件」，禁用条件才是「有没有内容 / 截断了没有」。
const canCopy = computed(() => policy.value.kind === "text");
const copyDisabled = computed(
  () => !content.value || truncated.value || loading.value,
);
const hasGatewayArtifact = computed(
  () => policy.value.source !== "write-file-draft",
);
const canInstall = computed(() =>
  canInstallSkillArtifact(policy.value, { isAdmin: props.isAdmin === true }),
);

function resetTransientState() {
  loading.value = false;
  content.value = "";
  contentUrl.value = undefined;
  sha256.value = undefined;
  truncated.value = false;
  fullContentLoaded.value = false;
  previewBytes.value = undefined;
  totalBytes.value = undefined;
  error.value = "";
  loadError.value = "";
  notice.value = "";
  viewMode.value = "code";
}

async function load(full = false) {
  const generation = ++loadGeneration;
  const selected = props.selected;
  const threadId = props.threadId;
  error.value = "";
  loadError.value = "";
  notice.value = "";

  if (policy.value.source === "write-file-draft") {
    const draft = loadArtifactContentFromToolCall({
      url: selected,
      thread: { messages: props.messages } as never,
    });
    content.value = typeof draft === "string" ? draft : "";
    truncated.value = false;
    fullContentLoaded.value = toolResult.value !== undefined;
    viewMode.value = previewAllowed.value ? "preview" : "code";
    return;
  }

  if (!canLoadArtifactText(policy.value)) {
    loading.value = false;
    return;
  }

  loadController?.abort();
  loadController = new AbortController();
  loading.value = true;
  try {
    const result = await loadArtifactContent({
      filepath: selected,
      threadId,
      isMock: props.isMock,
      full,
      signal: loadController.signal,
    });
    if (
      disposed ||
      generation !== loadGeneration ||
      selected !== props.selected ||
      threadId !== props.threadId
    ) {
      return;
    }
    content.value = result.content;
    contentUrl.value = result.url;
    sha256.value = result.sha256;
    truncated.value = result.truncated;
    fullContentLoaded.value = !result.truncated;
    previewBytes.value = result.previewBytes;
    totalBytes.value = result.totalBytes;
    if (result.sha256) {
      props.draftOwner.reconcile(filepath.value, {
        content: result.content,
        sha256: result.sha256,
      });
    }
    viewMode.value = previewAllowed.value ? "preview" : "code";
  } catch (reason) {
    if (
      generation === loadGeneration &&
      !disposed &&
      !(reason instanceof DOMException && reason.name === "AbortError")
    ) {
      loadError.value =
        reason instanceof Error
          ? reason.message
          : $i18n.t.value.artifacts.loadFailed;
    }
  } finally {
    if (generation === loadGeneration && !disposed) {
      loading.value = false;
      loadController = null;
    }
  }
}

watch(
  () => [props.selected, props.threadId] as const,
  () => {
    loadGeneration += 1;
    saveGeneration += 1;
    actionGeneration += 1;
    loadController?.abort();
    loadController = null;
    actionController?.abort();
    actionController = null;
    saving.value = false;
    installing.value = false;
    resetTransientState();
    void load(false);
  },
  { immediate: true },
);
watch(
  () => props.messages,
  () => {
    if (isWrite.value) void load(false);
  },
  { deep: true },
);

function beginEdit() {
  if (canEdit.value) props.draftOwner.beginEdit(filepath.value);
}

function updateDraft(value: string) {
  props.draftOwner.update(filepath.value, value);
}

/*
  丢弃草稿前**先问一句**（上游 artifact-file-detail.tsx:270 的 `confirmDiscard`，
  在 :409 切文件与 :521 点丢弃两处都过一遍）。本仓此前直接丢——用户点一下
  「丢弃」，未保存的编辑当场没了，没有任何挽回余地。

  用 `globalThis.confirm` 而不是自造一个对话框：上游就是 `window.confirm`，
  两边同一种模态。`dirty` 为假时不问，与上游 `!isDirty ||` 那一支相同。
*/
function confirmDiscard() {
  return (
    !dirty.value ||
    globalThis.confirm($i18n.t.value.artifactEditing.discardChanges)
  );
}

function discard() {
  if (!confirmDiscard()) return;
  props.draftOwner.discard(filepath.value);
  props.draftOwner.requestExitEdit(filepath.value);
  content.value = activeDraft.value.remoteContent;
  sha256.value = activeDraft.value.remoteSha256 ?? undefined;
  error.value = "";
}

function exitEdit() {
  if (!props.draftOwner.requestExitEdit(filepath.value)) return;
  content.value = activeDraft.value.remoteContent;
  sha256.value = activeDraft.value.remoteSha256 ?? undefined;
  error.value = "";
}

async function save() {
  const draft = activeDraft.value;
  if (
    !canEdit.value ||
    !dirty.value ||
    props.streaming ||
    saving.value ||
    draft.conflict ||
    !draft.baselineSha256
  ) {
    return;
  }
  const generation = ++saveGeneration;
  const selected = props.selected;
  const threadId = props.threadId;
  const path = filepath.value;
  const savedContent = draft.draftContent;
  saving.value = true;
  error.value = "";
  try {
    const result = await updateArtifactContent({
      threadId,
      filepath: path,
      content: savedContent,
      expectedSha256: draft.baselineSha256,
    });
    if (
      disposed ||
      generation !== saveGeneration ||
      selected !== props.selected ||
      threadId !== props.threadId
    ) {
      return;
    }
    props.draftOwner.completeSave(path, result.sha256);
    content.value = savedContent;
    sha256.value = result.sha256;
    /*
      保存成功要说一句（上游 artifact-file-detail.tsx:333）。本仓此前只有失败时的
      内联 `error`——保存成功之后编辑态自己退出，除此之外没有任何确认。
      失败仍然内联（那是「这份草稿现在有问题」的状态，wave 31 的判据）。
    */
    toast.success($i18n.t.value.artifactEditing.saved);
    props.draftOwner.requestExitEdit(path);
  } catch (reason) {
    if (
      disposed ||
      generation !== saveGeneration ||
      selected !== props.selected ||
      threadId !== props.threadId
    ) {
      return;
    }
    const status =
      reason instanceof ArtifactRequestError ? reason.status : undefined;
    if (status !== undefined) props.draftOwner.failSave(path, status);
    error.value =
      reason instanceof Error
        ? reason.message
        : $i18n.t.value.artifacts.saveFailed;
  } finally {
    if (generation === saveGeneration && !disposed) saving.value = false;
  }
}

async function copyArtifact() {
  error.value = "";
  if ((await writeTextToClipboard(content.value)) === false) {
    error.value = $i18n.t.value.artifacts.copyFailed;
  }
}

function openInNewWindow(url: string) {
  const opened = globalThis.open(url, "_blank", "noopener,noreferrer");
  if (opened) opened.opener = null;
}

/*
  「打开」有两个去处：markdown 与表格进本应用的独立视窗（那里有渲染器），
  其余保持 Gateway 原始 URL——尤其 HTML/SVG，Gateway 是**故意**把它们作为下载
  返回的。判定在 `resolveArtifactOpenURL` 里，这里只按它的结论走。

  只有去 Gateway 的那一支要先探一下：探的是「这个 URL 能不能取到」，
  而应用内路由本来就在这个源上，探它既没有意义，失败还会误报成产物打不开。
*/
async function runGatewayAction(kind: "open" | "download") {
  if (kind === "open") {
    const openUrl = resolveArtifactOpenURL({
      filepath: policy.value.filepath,
      threadId: props.threadId,
      isMock: policy.value.isMock,
    });
    if (openUrl !== sourceUrl.value) {
      openInNewWindow(openUrl);
      return;
    }
  }
  const generation = ++actionGeneration;
  actionController?.abort();
  actionController = new AbortController();
  error.value = "";
  const url = kind === "open" ? sourceUrl.value : downloadUrl.value;
  try {
    await probeArtifactAction(url, actionController.signal);
    if (disposed || generation !== actionGeneration) return;
    if (kind === "open") {
      openInNewWindow(url);
    } else {
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename.value;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    }
  } catch (reason) {
    if (generation === actionGeneration && !disposed) {
      error.value =
        reason instanceof Error
          ? reason.message
          : kind === "open"
            ? $i18n.t.value.artifacts.openFailed
            : $i18n.t.value.artifacts.downloadFailed;
    }
  } finally {
    if (generation === actionGeneration) actionController = null;
  }
}

async function installArtifactSkill() {
  if (!canInstall.value || installing.value) return;
  const generation = ++actionGeneration;
  installing.value = true;
  error.value = "";
  notice.value = "";
  try {
    const result = await installSkill({
      thread_id: props.threadId,
      path: filepath.value,
    });
    if (disposed || generation !== actionGeneration) return;
    if (!result.success) {
      error.value = result.message;
      return;
    }
    notice.value = result.message;
  } catch (reason) {
    if (generation === actionGeneration && !disposed) {
      error.value =
        reason instanceof Error
          ? reason.message
          : $i18n.t.value.artifacts.installFailed;
    }
  } finally {
    if (generation === actionGeneration && !disposed) installing.value = false;
  }
}

async function loadFull() {
  loadingFull.value = true;
  try {
    await load(true);
  } finally {
    if (!disposed) loadingFull.value = false;
  }
}

/** React 的同名兜底：后端没报 previewBytes 时按默认预览窗口显示。 */
const DEFAULT_PREVIEW_WINDOW = "1 MiB";
const previewedSize = computed(
  () => formatArtifactBytes(previewBytes.value) ?? DEFAULT_PREVIEW_WINDOW,
);
const totalSize = computed(() => formatArtifactBytes(totalBytes.value));

onBeforeUnmount(() => {
  disposed = true;
  loadGeneration += 1;
  saveGeneration += 1;
  actionGeneration += 1;
  loadController?.abort();
  loadController = null;
  actionController?.abort();
  actionController = null;
});
</script>

<template>
  <section class="flex size-full min-h-0 flex-col">
    <!--
      `data-testid` 是给 e2e 定位用的锚点，不进 aria 快照、不影响对照台账。
      加它的直接原因：wave 62 给消息轮次的复制键补上可访问名之后，
      「复制到剪贴板」这句在这一屏上会同时命中**面板的**复制键和**消息的**复制键，
      裸 `getByLabel(...)` 从此是 strict-mode 的定时炸弹（wave 64 实测红过一次，
      而它在此之前两次全跑里都碰巧是绿的——取决于轮次操作条有没有渲染出来）。
      **两颗同名按钮本身不是缺陷**：上游 artifact-file-detail.tsx:563 用的也是
      `t.clipboard.copyToClipboard`，同一屏同样有两颗。
    -->
    <!--
      头部的三条尺寸照抄上游 `ai-elements/artifact.tsx` 的 `ArtifactHeader`
      （`bg-muted/50 flex items-center justify-between border-b px-4 py-3`）
      加调用点的 `className="px-2"`（artifact-file-detail.tsx:400）：

      ① **`py-3` 而不是 `h-12`。** 上游没有固定高度，高度由内容 + 上下各 12px
         内边距决定；本仓写死 48px，比上游矮 8px——wave 76 把几何档接到交互后的
         锚点上之后，三个 artifact 场景一共报出五条 `y Δ-7.5` / `Δ-14` 就是它。
      ② **`px-2` 而不是 `px-3`**（上游的 `px-4` 被调用点的 `px-2` 盖掉）。
      ③ **`bg-muted/50`**——本仓这一条整个没有，头部与正文之间只有一条下边框。

      **头部是三栏，不是一排。** 上游 artifact-file-detail.tsx:400 往
      `justify-between` 的 ArtifactHeader 里塞三个容器：标题（`flex items-center
      gap-2`）、中间的**伸缩栏**（`flex min-w-0 grow items-center justify-center
      gap-2`，装视图切换与编辑态播报）、动作栏（`flex items-center gap-2` 里再套
      `ArtifactActions` = `flex items-center gap-1`）。本仓原来把五个东西平铺成
      一排、靠 header 自己的 `gap-2` 排版，量出来两处差异：
      - 动作键之间是 8px 而上游是 4px，于是 `Download x` 差 3px；
      - 标题那一层带 `min-w-0 flex-1`，被伸缩栏挤成 153px 宽、文件名**被截断**
        （实测 span 内容宽 127、可视宽 105，上游那颗是自然宽 126.7）。
      伸缩栏才是该 `grow` 的那一个，标题按内容宽。
    -->
    <header
      data-testid="artifact-panel-header"
      class="bg-muted/50 border-border flex shrink-0 items-center justify-between border-b px-2 py-3"
    >
      <!--
        标题栏必须**能缩**。flex item 默认 `min-width:auto`，不写 `min-w-0` 它就
        不肯缩到内容宽度以下：实测（1280 宽、59 字符的文件名）整排动作键被推出面板的
        `overflow-hidden` 盒子——**编辑 / 新窗口 / 复制 / 下载 / 关闭五颗全部落在
        可视区之外**，本仓超出 181px、上游超出 199px，也就是这份产物既下载不了、
        面板也关不掉。**两边同改**（判据「这处不改，React 自己是不是也是坏的？」→ 是）。
        中间那一栏本来就有 `min-w-0` 且 `grow`，该让位的是标题。
      -->
      <div class="flex min-w-0 items-center gap-2">
        <ArtifactFileList
          v-if="!isWrite"
          :current="filepath"
          :options="options"
          @select="emit('select', $event)"
        />
        <!--
        write_file 草稿的标题是**普通文字**，不是 strong：React 这一支渲染的是
        `<div className="px-2">{getFileName(filepath)}</div>`
        （frontend/src/components/workspace/artifacts/artifact-file-detail.tsx 的
        isWriteFile 分支）。strong 会让读屏器把文件名念成强调内容。
      -->
        <div v-else class="text-foreground text-sm font-medium">
          <div class="truncate px-2">{{ filename }}</div>
        </div>
      </div>
      <div class="flex min-w-0 grow items-center justify-center gap-2">
        <!--
        代码 / 预览是一对**单选**，不是一颗会变名字的开关。

        React 用 ToggleGroup type="single"，也就是一个 group 里两个 radio，当前档位
        标 checked（同上文件的 ArtifactHeader）。原来的写法一颗按钮两种名字：读屏器
        每次切换都会重念一遍控件，而且用户听不到「一共有两档、现在在第几档」。
        两个 radio 都只有图标、没有可访问名——React 的 ToggleGroupItem 里就只有一个
        图标，这一点也照抄。
      -->
        <!--
        走 `ui/toggle-group`（与 MemorySettings 那一行同一个 primitive），
        不再手搓两颗 radio。手搓那版**当前档位在视觉上根本看不出来**：
        `aria-checked` 是对的，但两颗的 class 是常量，没有任何一条按选中态分叉；
        上游 ToggleGroupItem 的 base 里写着
        `data-[state=on]:bg-accent data-[state=on]:text-accent-foreground`。
        读屏用户听得出「二选一、现在在第一档」，看得见的用户看不出。

        一并对上的还有：Reka 的 ToggleGroupRoot 带 roving tabindex（左右方向键
        在两档之间走、整组只占一个 Tab 位），手搓那版是两颗各自可 Tab 的普通按钮；
        以及 `cursor-pointer`、3px 焦点环、`disabled:*`、`shadow-xs`、
        `hover:text-accent-foreground` 与 sm 档的 `min-w-8 px-1.5`。
      -->
        <ToggleGroup
          class="mx-auto"
          v-if="
            policy.kind === 'text' &&
            (isTabular || ['html', 'markdown'].includes(policy.language)) &&
            previewAllowed &&
            (!truncated || isTabular)
          "
          type="single"
          variant="outline"
          size="sm"
          :model-value="viewMode"
          @update:model-value="
            (value) => {
              if (value) viewMode = value as 'code' | 'preview';
            }
          "
        >
          <!--
            两档都只有图标，可访问名必须显式给。React 的这两颗带
            `aria-label`（artifact-file-detail.tsx），预览那档在表格文件上
            念的是「表格预览」而不是泛泛的「预览」——用户听得出切过去会看到什么。
          -->
          <ToggleGroupItem
            value="code"
            single
            :checked="viewMode === 'code'"
            :aria-label="$i18n.t.value.artifactPreview.viewSource"
            variant="outline"
            size="sm"
          >
            <Code2 class="size-4" />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="preview"
            single
            :checked="viewMode === 'preview'"
            :aria-label="
              isTabular
                ? $i18n.t.value.artifactTable.title
                : $i18n.t.value.common.preview
            "
            variant="outline"
            size="sm"
          >
            <Eye class="size-4" />
          </ToggleGroupItem>
        </ToggleGroup>
        <!--
        编辑态的状态要**播报**，不能只在按钮的禁用态里体现。React 在头部放了一个
        `aria-live="polite"` 的 span：保存中 / 远端已变 / 有未保存的改动
        （frontend/src/components/workspace/artifacts/artifact-file-detail.tsx）。
        Vue 原来一个都没有——`artifactEditing.{saving,conflictShort,unsaved}` 三个键
        在词典里躺着、从没被渲染过，于是读屏用户改完文件既听不到"有未保存的改动"，
        也听不到"这个文件在你编辑期间被别人改了"。
      -->
        <span
          v-if="saving || dirty || activeDraft.conflict"
          aria-live="polite"
          class="text-muted-foreground max-w-32 truncate text-xs"
          :class="activeDraft.conflict ? 'text-destructive' : ''"
        >
          {{
            saving
              ? $i18n.t.value.artifactEditing.saving
              : activeDraft.conflict
                ? $i18n.t.value.artifactEditing.conflictShort
                : $i18n.t.value.artifactEditing.unsaved
          }}
        </span>
      </div>
      <!--
        `shrink-0`：标题让位之后，这一栏不能跟着缩。里面那几颗 Button 自己带
        `shrink-0`，容器一缩它们就溢出容器盒子。
      -->
      <div class="flex shrink-0 items-center gap-2">
        <div class="flex items-center gap-1">
          <ArtifactActions
            :can-edit="canEdit"
            :editing="editing"
            :dirty="dirty"
            :conflict="activeDraft.conflict"
            :streaming="streaming"
            :saving="saving"
            :can-copy="canCopy"
            :copy-disabled="copyDisabled"
            :can-open="hasGatewayArtifact"
            :can-download="hasGatewayArtifact"
            :can-install="canInstall"
            :installing="installing"
            :saved-version-hint="isTabular && dirty"
            @edit="beginEdit"
            @save="save"
            @exit="exitEdit"
            @discard="discard"
            @copy="copyArtifact"
            @open="runGatewayAction('open')"
            @download="runGatewayAction('download')"
            @install="installArtifactSkill"
          />
          <!--
        关闭键上游也是 `<ArtifactAction icon={XIcon} label tooltip>`
        （artifact-file-detail.tsx:603），和它左边那八颗是同一个形状——
        wave 70 把那八颗改走 Button 时漏了这一颗孤儿。差的是：
        `text-muted-foreground hover:text-foreground` 这个静息/悬停色
        （手写那版恒为前景色，比上游深一档）、**Tooltip**、
        `cursor-pointer`、3px 焦点环与 `disabled:*`。
      -->
          <Tooltip>
            <TooltipTrigger>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                :aria-label="$i18n.t.value.common.close"
                class="text-muted-foreground hover:text-foreground size-8 p-0"
                @click="emit('close')"
              >
                <X :size="16" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{{ $i18n.t.value.common.close }}</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </header>

    <p v-if="error" role="alert" class="text-destructive px-4 pt-3 text-sm">
      {{ error }}
    </p>
    <p v-if="notice" role="status" class="px-4 pt-3 text-sm">{{ notice }}</p>
    <!--
      截断提示条照 React 的 ArtifactContent 头部
      （frontend/src/components/workspace/artifacts/artifact-file-detail.tsx）：
      一句 `artifactPreview.limited` + 一颗**只有可见文字**的按钮（没有 aria-label）。
      字节数要格式化成 KiB / MiB，不是把原始数字念出来——Vue 原来用的是另一套
      `artifacts.previewedBytes` 文案（"Previewed 1048576 of 2097152 bytes"），
      而 `artifactPreview` 段本来就是从 React 逐字抄过来的，只是一直没人用。
    -->
    <div
      v-if="truncated"
      class="border-border bg-muted/40 flex shrink-0 items-center justify-between gap-3 border-b px-4 py-2 text-sm"
    >
      <span class="text-muted-foreground">
        {{ $i18n.t.value.artifactPreview.limited(previewedSize, totalSize) }}
      </span>
      <Button size="sm" variant="outline" :disabled="loading" @click="loadFull">
        {{ $i18n.t.value.artifactPreview.loadFullFile }}
      </Button>
    </div>
    <div
      v-if="loadingFull"
      class="border-border text-muted-foreground flex shrink-0 items-center gap-2 border-b px-4 py-2 text-sm"
    >
      {{ $i18n.t.value.artifactPreview.loadingFullFile }}
    </div>
    <div class="relative min-h-0 flex-1 overflow-auto">
      <!--
        预览失败给的是一句固定说明 + 一个下载入口，不是把后端的错误串原样弹成 alert。
        React 的 ArtifactPreviewError 就是这个形状（同上文件）：用户要的是「还能怎么
        拿到这个文件」，而不是一句 "Path must start with /mnt/user-data"。
      -->
      <div
        v-if="loadError"
        class="flex size-full items-center justify-center p-6"
        data-testid="artifact-preview-error"
      >
        <div class="flex max-w-sm flex-col items-center gap-4 text-center">
          <p class="text-muted-foreground text-sm">
            {{ $i18n.t.value.artifactPreview.previewFailed }}
          </p>
          <a
            :href="downloadUrl"
            target="_blank"
            rel="noopener noreferrer"
            :class="buttonVariants()"
          >
            <Download class="size-4" />
            {{ $i18n.t.value.common.download }}
          </a>
        </div>
      </div>
      <p v-else-if="loading" class="text-muted-foreground p-4 text-sm">
        {{ $i18n.t.value.artifacts.loading }}
      </p>
      <ArtifactEditor
        v-else-if="editing && canEdit"
        :model-value="activeDraft.draftContent"
        :language="policy.language"
        @update:model-value="updateDraft"
        @save="save"
      />
      <ArtifactPreview
        v-else
        :policy="policy"
        :filename="filename"
        :content="content"
        :url="sourceUrl"
        :download-url="downloadUrl"
        :content-url="contentUrl"
        :view-mode="viewMode"
        :html-preview-allowed="htmlPreviewAllowed"
        :truncated="truncated"
        :identity="`${threadId}:${policy.filepath}`"
      />
    </div>
  </section>
</template>
