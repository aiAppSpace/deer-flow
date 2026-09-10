/*
  【文件职责】     持有 sidecar 的恢复/创建、run、草稿附件、HIL 与删除生命周期。
  【架构位置】     L3 Vue session owner
  【主要导出】     useSidecarSession · SidecarSession
  【依赖关系】     useThreadStream · sidecar/session-lifecycle · uploads
  【边界与注意】   每个 AgentChat 仅实例化一次；关闭/隐藏面板不销毁或中断 run。
*/
import {
  computed,
  onScopeDispose,
  ref,
  toValue,
  watch,
  type MaybeRefOrGetter,
  type Ref,
} from "vue";

import { useThreadStream } from "@/composables/useThreadStream";
import { useUploadLimits } from "@/composables/useUploads";
import { fetch as fetchWithAuth } from "@/core/api/fetcher";
import { getBackendBaseURL } from "@/core/config";
import {
  buildHumanInputResponseText,
  type HumanInputRequest,
  type HumanInputResponse,
} from "@/core/messages/human-input";
import {
  buildParentConversationContext,
  buildReferenceMessageMetadata,
  buildSidecarContextPrompt,
} from "@/core/sidecar";
import {
  createSidecarThread,
  findLatestSidecarThread,
} from "@/core/sidecar/api";
import {
  createSidecarSessionLifecycle,
  type SidecarSessionState,
} from "@/core/sidecar/session-lifecycle";
import type { SidecarReference } from "@/composables/useSidecar";
import type { ThreadRunContextInput } from "@/core/threads/submit";
import type { Message } from "@/core/types/message";
import {
  formatUploadSize,
  splitUnsupportedUploadFiles,
  validateUploadLimits,
} from "@/core/uploads/file-validation";
import {
  createSubmissionFileCache,
  prepareSubmissionFiles,
} from "@/core/uploads/submission-files";

type SessionLifecycle = ReturnType<typeof createSidecarSessionLifecycle>;

function hiddenContextMessage(parentThreadId: string, prompt: string): Message {
  return {
    type: "human",
    content: [{ type: "text", text: prompt }],
    additional_kwargs: {
      hide_from_ui: true,
      sidecar_context: true,
      parent_thread_id: parentThreadId,
    },
  } as Message;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function useSidecarSession(options: {
  parentThreadId: MaybeRefOrGetter<string | null>;
  parentMessages: MaybeRefOrGetter<Message[]>;
  sidecarThreadId: Ref<string | null>;
  references: MaybeRefOrGetter<SidecarReference[]>;
  context: MaybeRefOrGetter<ThreadRunContextInput>;
  onReferencesAccepted?: (references: SidecarReference[]) => void;
}) {
  /*
    这一层会产出**上屏的文案**（fileError / errorMessage 都渲染在面板里），
    所以它得拿 i18n。原来三处都是写死的英文字面量——`.ts` 不在 i18n source guard
    的扫描面内（它只扫产品 SFC），于是这三条一直没人拦（坑 52 的反面）。
  */
  const { $i18n } = useNuxtApp();
  const input = ref("");
  const selectedFiles = ref<File[]>([]);
  const submissionPending = ref(false);
  const deleting = ref(false);
  const submissionError = ref<unknown>(null);
  const fileError = ref("");
  const lifecycleState = ref<SidecarSessionState>({
    phase: "idle",
    error: null,
  });
  const fileCache = createSubmissionFileCache();
  const drafts = new Map<string, { text: string; files: File[] }>();
  let activeParentThreadId: string | null = null;
  let lifecycle: SessionLifecycle | null = null;
  let scopeGeneration = 0;

  const stream = useThreadStream({
    threadId: options.sidecarThreadId,
    displayThreadId: options.sidecarThreadId,
    context: () => toValue(options.context),
  });
  const limits = useUploadLimits(
    computed(
      () =>
        options.sidecarThreadId.value ?? toValue(options.parentThreadId) ?? "",
    ),
  );

  function setInput(value: string) {
    input.value = value;
  }

  function installLifecycle(parentThreadId: string) {
    lifecycle?.dispose();
    lifecycleState.value = { phase: "idle", error: null };
    const installed = createSidecarSessionLifecycle({
      parentThreadId,
      getThreadId: () => options.sidecarThreadId.value,
      setThreadId: (threadId) => {
        options.sidecarThreadId.value = threadId;
      },
      findLatest: findLatestSidecarThread,
      createThread: createSidecarThread,
      onStateChange: (state) => {
        lifecycleState.value = { ...state };
      },
    });
    lifecycle = installed;
    return installed;
  }

  function currentScopeKey() {
    return JSON.stringify({
      parentThreadId: toValue(options.parentThreadId),
      context: toValue(options.context),
    });
  }

  watch(
    () => toValue(options.parentThreadId),
    (parentThreadId) => {
      if (activeParentThreadId) {
        drafts.set(activeParentThreadId, {
          text: input.value,
          files: [...selectedFiles.value],
        });
      }
      scopeGeneration += 1;
      submissionPending.value = false;
      submissionError.value = null;
      fileError.value = "";
      lifecycle?.dispose();
      lifecycle = null;
      options.sidecarThreadId.value = null;
      activeParentThreadId = parentThreadId;
      const draft = parentThreadId ? drafts.get(parentThreadId) : undefined;
      input.value = draft?.text ?? "";
      selectedFiles.value = [...(draft?.files ?? [])];
      if (!parentThreadId) {
        lifecycleState.value = { phase: "idle", error: null };
        return;
      }
      const currentLifecycle = installLifecycle(parentThreadId);
      const generation = scopeGeneration;
      void currentLifecycle.restore().catch((error: unknown) => {
        if (generation === scopeGeneration) submissionError.value = error;
      });
    },
    { immediate: true },
  );

  async function restore({ force = false } = {}) {
    const currentLifecycle = lifecycle;
    const generation = scopeGeneration;
    if (!currentLifecycle) return null;
    try {
      const restored = await currentLifecycle.restore({ force });
      return generation === scopeGeneration ? restored : null;
    } catch (error) {
      if (generation === scopeGeneration) submissionError.value = error;
      return null;
    }
  }

  async function ensureThread(references: SidecarReference[]) {
    const currentLifecycle = lifecycle;
    if (!currentLifecycle) return null;
    const contexts = references.map((reference) => reference.context);
    if (!options.sidecarThreadId.value && contexts.length === 0) {
      const restored = await currentLifecycle.restore();
      if (restored) return restored;
      /* 上游这一支抛的是 t.sidecar.noContext（sidecar-panel.tsx:326），不是自造的句子。 */
      throw new Error($i18n.t.value.sidecar.noContext);
    }
    return currentLifecycle.ensure(contexts);
  }

  function addFiles(files: File[] | FileList) {
    const supported = splitUnsupportedUploadFiles(files);
    const result = validateUploadLimits(
      selectedFiles.value,
      supported.accepted,
      limits.data.value,
    );
    selectedFiles.value.push(...result.accepted);
    if (supported.message) fileError.value = supported.message;
    else if (result.violations.length > 0) {
      /*
        三种违规三条文案，与 ChatComposer 和上游 reportUploadLimitViolations
        （sidecar-panel.tsx:253）用同一组词条。原来这里忽略 `violation.code`，
        把「文件太多」「总量超限」也一律说成 "X exceeds 50 MB"——文案对不上，
        而且是写死的英文。
      */
      const violation = result.violations[0]!;
      const names = violation.files.map((file) => file.name).join(", ");
      fileError.value =
        violation.code === "max_files"
          ? $i18n.t.value.uploads.tooManyFiles(
              violation.files.length,
              violation.limit,
            )
          : violation.code === "max_total_size"
            ? $i18n.t.value.uploads.totalSizeTooLarge(
                violation.files.length,
                formatUploadSize(violation.limit),
              )
            : $i18n.t.value.uploads.filesTooLarge(
                names,
                formatUploadSize(violation.limit),
              );
    } else {
      fileError.value = "";
    }
  }

  function removeFile(file: File) {
    selectedFiles.value = selectedFiles.value.filter((item) => item !== file);
  }

  async function submit(): Promise<boolean> {
    if (submissionPending.value || stream.isStreaming.value) return false;
    const text = input.value.trim();
    const files = [...selectedFiles.value];
    if (!text && files.length === 0) return false;

    submissionPending.value = true;
    submissionError.value = null;
    const generation = scopeGeneration;
    const scopeKey = currentScopeKey();
    const references = [...toValue(options.references)];
    const parentThreadId = toValue(options.parentThreadId);
    try {
      if (!parentThreadId) return false;
      const targetThreadId = await ensureThread(references);
      if (
        !targetThreadId ||
        generation !== scopeGeneration ||
        scopeKey !== currentScopeKey()
      ) {
        return false;
      }

      if (files.length > 0) stream.isUploading.value = true;
      const uploaded = await prepareSubmissionFiles({
        threadId: targetThreadId,
        files,
        cache: fileCache,
      });
      if (
        generation !== scopeGeneration ||
        scopeKey !== currentScopeKey() ||
        options.sidecarThreadId.value !== targetThreadId
      ) {
        return false;
      }

      const contexts = references.map((reference) => reference.context);
      const prompt = buildSidecarContextPrompt(contexts, {
        parentConversation: buildParentConversationContext(
          toValue(options.parentMessages),
        ),
      });
      let accepted = false;
      const dispatched = await stream.sendMessage(
        targetThreadId,
        { text, files: uploaded },
        undefined,
        {
          additionalInputMessages: [
            hiddenContextMessage(parentThreadId, prompt),
          ],
          additionalKwargs: {
            sidecar_visible_message: true,
            ...(contexts.length ? buildReferenceMessageMetadata(contexts) : {}),
          },
          onAccepted: () => {
            if (
              generation !== scopeGeneration ||
              scopeKey !== currentScopeKey() ||
              options.sidecarThreadId.value !== targetThreadId
            ) {
              return;
            }
            accepted = true;
            if (input.value.trim() === text) input.value = "";
            selectedFiles.value = selectedFiles.value.filter(
              (file) => !files.includes(file),
            );
            options.onReferencesAccepted?.(references);
          },
        },
      );
      return dispatched && accepted;
    } catch (error) {
      if (generation === scopeGeneration) submissionError.value = error;
      return false;
    } finally {
      if (generation === scopeGeneration) {
        stream.isUploading.value = false;
        submissionPending.value = false;
      }
    }
  }

  /*
    `accepted` 只在 onAccepted 回调里被写；TS 的控制流看不进闭包，于是
    `return dispatched && accepted` 会被推成字面量 `false`——整个函数的契约变成
    「永远失败」，而调用方（MessageList.vue:540）正是靠这个返回值决定要不要把
    pending 撤回来。显式标注返回类型，把这条契约钉回 boolean。submit() 同理。
  */
  async function submitHumanInput(
    request: HumanInputRequest,
    response: HumanInputResponse,
  ): Promise<boolean> {
    if (submissionPending.value || stream.isStreaming.value) return false;
    const targetThreadId = options.sidecarThreadId.value;
    if (!targetThreadId) return false;
    const generation = scopeGeneration;
    const scopeKey = currentScopeKey();
    submissionPending.value = true;
    submissionError.value = null;
    let accepted = false;
    try {
      const dispatched = await stream.sendMessage(
        targetThreadId,
        { text: buildHumanInputResponseText(request, response) },
        undefined,
        {
          additionalKwargs: {
            hide_from_ui: true,
            human_input_response: response,
          },
          onAccepted: () => {
            if (
              generation === scopeGeneration &&
              scopeKey === currentScopeKey() &&
              options.sidecarThreadId.value === targetThreadId
            ) {
              accepted = true;
            }
          },
        },
      );
      return dispatched && accepted;
    } catch (error) {
      if (generation === scopeGeneration) submissionError.value = error;
      return false;
    } finally {
      if (generation === scopeGeneration) submissionPending.value = false;
    }
  }

  async function deleteThread() {
    const targetThreadId = options.sidecarThreadId.value;
    const parentThreadId = toValue(options.parentThreadId);
    if (!targetThreadId || !parentThreadId || deleting.value) return false;
    const generation = scopeGeneration;
    deleting.value = true;
    submissionError.value = null;
    try {
      const response = await fetchWithAuth(
        `${getBackendBaseURL()}/api/threads/${encodeURIComponent(targetThreadId)}`,
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error("Failed to delete side chat.");
      if (generation !== scopeGeneration) return false;
      fileCache.delete(targetThreadId);
      drafts.delete(parentThreadId);
      input.value = "";
      selectedFiles.value = [];
      options.sidecarThreadId.value = null;
      installLifecycle(parentThreadId);
      return true;
    } catch (error) {
      if (generation === scopeGeneration) submissionError.value = error;
      return false;
    } finally {
      if (generation === scopeGeneration) deleting.value = false;
    }
  }

  onScopeDispose(() => {
    scopeGeneration += 1;
    lifecycle?.dispose();
  });

  return {
    threadId: options.sidecarThreadId,
    input,
    selectedFiles,
    submissionPending,
    deleting,
    submissionError,
    fileError,
    phase: computed(() => lifecycleState.value.phase),
    ready: computed(
      () =>
        Boolean(options.sidecarThreadId.value) &&
        !stream.isHistoryLoading.value,
    ),
    stream,
    restore,
    ensureThread,
    setInput,
    addFiles,
    removeFile,
    submit,
    submitHumanInput,
    deleteThread,
    errorMessage: computed(() =>
      submissionError.value
        ? errorMessage(submissionError.value, $i18n.t.value.sidecar.sendFailed)
        : "",
    ),
  };
}

export type SidecarSession = ReturnType<typeof useSidecarSession>;
