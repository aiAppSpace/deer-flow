<script setup lang="ts">
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
import { useArtifactFileContent } from "@/composables/useArtifactFileContent";
import { useArtifactPreviewContent } from "@/composables/useArtifactPreviewContent";
import {
  canInstallSkillArtifact,
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

const error = ref("");

const notice = ref("");
const viewMode = ref<"code" | "preview">("code");
const saving = ref(false);
const installing = ref(false);
let saveGeneration = 0;
let actionGeneration = 0;
let actionController: AbortController | null = null;
let saveController: AbortController | null = null;
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
const artifactContent = useArtifactFileContent({
  selection: () => ({
    selected: props.selected,
    threadId: props.threadId,
    isMock: props.isMock === true,
  }),
  policy,
  messages: () => props.messages,
  streaming: () => props.streaming,
  writeComplete: () => toolResult.value !== undefined,
  onLoaded: ({ selected }, result) => {
    if (result.sha256 && !result.truncated) {
      props.draftOwner.reconcile(selected, {
        content: result.content,
        sha256: result.sha256,
      });
    }
  },
});
const {
  content,
  contentUrl,
  sha256,
  truncated,
  fullContentLoaded,
  previewBytes,
  totalBytes,
  loading,
  loadingFull,
  loadFull,
  error: loadError,
} = artifactContent;
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
const canEdit = computed(
  () =>
    !loading.value &&
    !loadError.value &&
    canSaveArtifactText(policy.value, {
      hasRevision: /^[0-9a-f]{64}$/.test(sha256.value ?? ""),
      fullContentLoaded: fullContentLoaded.value,
    }),
);
const previewContent = useArtifactPreviewContent({
  content,
  writing: () => isWrite.value && toolResult.value === undefined,
  identity: () => `${props.threadId}:${props.selected}`,
});
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
      content: previewContent.value,
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
    return (
      policy.value.source !== "write-file-draft" ||
      toolResult.value?.trim() === "OK"
    );
  }
  return policy.value.language === "markdown" || htmlPreviewAllowed.value;
});
// React 的渲染条件是「是不是代码/文本文件」，禁用条件才是「有没有内容 / 截断了没有」。
const visibleContent = computed(() =>
  dirty.value ? activeDraft.value.draftContent : previewContent.value,
);
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

watch(previewAllowed, (allowed) => {
  viewMode.value = allowed ? "preview" : "code";
});

watch(
  () =>
    [props.selected, props.threadId, props.isMock, props.draftOwner] as const,
  () => {
    saveGeneration += 1;
    actionGeneration += 1;
    actionController?.abort();
    actionController = null;
    saving.value = false;
    installing.value = false;
    saveController?.abort();
    saveController = null;
    error.value = "";
    notice.value = "";
    viewMode.value = previewAllowed.value ? "preview" : "code";
  },
  { immediate: true },
);
function beginEdit() {
  if (!canEdit.value || props.streaming) return;
  viewMode.value = "code";
  props.draftOwner.beginEdit(filepath.value);
}

function updateDraft(value: string) {
  if (!saving.value && !props.streaming)
    props.draftOwner.update(filepath.value, value);
}

function confirmDiscard() {
  return (
    !dirty.value ||
    globalThis.confirm($i18n.t.value.artifactEditing.discardChanges)
  );
}

function discard() {
  if (saving.value || !confirmDiscard()) return;
  props.draftOwner.discard(filepath.value);
  props.draftOwner.requestExitEdit(filepath.value);
  error.value = "";
}

function exitEdit() {
  if (saving.value) return;
  props.draftOwner.requestExitEdit(filepath.value);
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
  const draftOwner = props.draftOwner;
  const controller = new AbortController();
  saveController = controller;
  saving.value = true;
  error.value = "";
  try {
    const result = await updateArtifactContent({
      threadId,
      filepath: path,
      content: savedContent,
      expectedSha256: draft.baselineSha256,
      signal: controller.signal,
    });
    if (
      disposed ||
      controller.signal.aborted ||
      draftOwner !== props.draftOwner ||
      generation !== saveGeneration ||
      selected !== props.selected ||
      threadId !== props.threadId
    ) {
      return;
    }
    draftOwner.completeSave(path, {
      content: savedContent,
      sha256: result.sha256,
    });
    artifactContent.acknowledgeSaved({
      content: savedContent,
      sha256: result.sha256,
    });

    toast.success($i18n.t.value.artifactEditing.saved);
  } catch (reason) {
    if (
      disposed ||
      controller.signal.aborted ||
      draftOwner !== props.draftOwner ||
      generation !== saveGeneration ||
      selected !== props.selected ||
      threadId !== props.threadId
    ) {
      return;
    }
    const status =
      reason instanceof ArtifactRequestError ? reason.status : undefined;
    if (status !== undefined) draftOwner.failSave(path, status);
    if (status === 412) void artifactContent.reload();
    error.value =
      reason instanceof Error
        ? reason.message
        : $i18n.t.value.artifacts.saveFailed;
  } finally {
    if (generation === saveGeneration && !disposed) {
      saving.value = false;
      saveController = null;
    }
  }
}

async function copyArtifact() {
  error.value = "";
  if ((await writeTextToClipboard(visibleContent.value)) === false) {
    error.value = $i18n.t.value.artifacts.copyFailed;
  }
}

function openInNewWindow(url: string) {
  const opened = globalThis.open(url, "_blank", "noopener,noreferrer");
  if (opened) opened.opener = null;
}

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

const DEFAULT_PREVIEW_WINDOW = "1 MiB";
const previewedSize = computed(
  () => formatArtifactBytes(previewBytes.value) ?? DEFAULT_PREVIEW_WINDOW,
);
const totalSize = computed(() => formatArtifactBytes(totalBytes.value));

onBeforeUnmount(() => {
  disposed = true;
  saveGeneration += 1;
  actionGeneration += 1;
  actionController?.abort();
  actionController = null;
  saveController?.abort();
  saveController = null;
});
</script>

<template>
  <section
    class="bg-background @container flex size-full min-h-0 flex-col overflow-x-hidden overflow-y-auto rounded-lg border shadow-lg max-md:min-h-min"
  >
    <header
      data-testid="artifact-panel-header"
      class="bg-muted/50 border-border flex min-w-0 shrink-0 items-center justify-between border-b px-2 py-3 max-[361px]:grid max-[361px]:grid-cols-[minmax(0,1fr)] @max-[28rem]:flex-wrap @max-[28rem]:gap-y-2"
    >
      <div
        class="flex max-w-full min-w-0 items-center gap-2 max-[361px]:w-full @max-[28rem]:grow @max-[28rem]:basis-0"
      >
        <ArtifactFileList
          v-if="!isWrite"
          :current="filepath"
          :options="options"
          @select="emit('select', $event)"
        />

        <div v-else class="text-foreground text-sm font-medium">
          <div class="truncate px-2">{{ filename }}</div>
        </div>
      </div>
      <div
        class="flex min-w-0 grow items-center justify-center gap-2 max-[361px]:w-full @max-[28rem]:order-3 @max-[28rem]:basis-full"
      >
        <ToggleGroup
          v-if="
            policy.kind === 'text' &&
            (isTabular || ['html', 'markdown'].includes(policy.language)) &&
            previewAllowed &&
            (!truncated || isTabular)
          "
          class="mx-auto"
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

      <div
        class="flex shrink-0 items-center gap-2 max-[361px]:w-full max-[361px]:min-w-0"
      >
        <div
          class="flex items-center gap-1 max-[361px]:w-full max-[361px]:flex-wrap"
        >
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

    <div
      class="relative flex min-h-0 flex-1 flex-col overflow-auto p-0 @max-[28rem]:max-h-dvh @max-[28rem]:min-h-auto @max-[28rem]:overflow-visible"
    >
      <div
        v-if="truncated && !(isTabular && viewMode === 'preview')"
        class="border-border bg-muted/40 flex shrink-0 flex-wrap items-center justify-between gap-3 border-b px-4 py-2 text-sm"
      >
        <span class="text-muted-foreground">
          {{ $i18n.t.value.artifactPreview.limited(previewedSize, totalSize) }}
        </span>
        <Button
          class="h-auto min-h-8 max-w-full py-1 whitespace-normal"
          size="sm"
          variant="outline"
          :disabled="loading"
          @click="loadFull"
        >
          {{ $i18n.t.value.artifactPreview.loadFullFile }}
        </Button>
      </div>
      <div
        v-if="loadingFull"
        class="border-border text-muted-foreground flex shrink-0 items-center gap-2 border-b px-4 py-2 text-sm"
      >
        {{ $i18n.t.value.artifactPreview.loadingFullFile }}
      </div>
      <div
        class="min-h-0 flex-1 [@media(max-height:360px)]:min-h-[160px] [@media(max-height:360px)]:flex-none"
      >
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
          :disabled="saving || streaming"
          @update:model-value="updateDraft"
          @save="save"
        />
        <ArtifactPreview
          v-else
          :policy="policy"
          :filename="filename"
          :content="visibleContent"
          :url="sourceUrl"
          :download-url="downloadUrl"
          :content-url="contentUrl"
          :view-mode="viewMode"
          :html-preview-allowed="htmlPreviewAllowed"
          :truncated="truncated"
          :identity="`${threadId}:${policy.filepath}`"
        />
      </div>
    </div>
  </section>
</template>
