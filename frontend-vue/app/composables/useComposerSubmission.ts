/*
  【文件职责】     独占 composer 命令与上传提交事务、取消、重试身份和 accepted 退休。
  【架构位置】     L3 Vue 生命周期适配
  【主要导出】     useComposerSubmission
  【依赖关系】     composer draft/references · goal/compact/upload APIs
  【边界与注意】   草稿与引用仍由原 owner 持有；这里只消费快照并按接受结果退休。
*/
import {
  onScopeDispose,
  ref,
  toValue,
  watch,
  type MaybeRefOrGetter,
  type Ref,
} from "vue";
import { useQueryClient } from "@tanstack/vue-query";
import type {
  useComposerDraft,
  ComposerDraftSnapshot,
} from "./useComposerDraft";
import type { useComposerReferences } from "./useComposerReferences";
import type { ConversationReference } from "@/core/conversation-references";
import type { FileInMessage } from "@/core/messages/utils";
import type { Model } from "@/core/models/types";
import type { ThreadRunContextInput } from "@/core/threads/submit";
import {
  buildComposerReferences,
  type ComposerSubmitOptions,
  type ComposerUploadSnapshot,
  type ComposerRunSnapshot,
  type ComposerHostSnapshot,
} from "@/core/threads/composer-submit";
import { compactThreadContext } from "@/core/threads/api";
import { invalidateThreadCaches } from "@/core/threads/cache-invalidation";
import { isCompactCommand } from "@/core/threads/compact-command";
import {
  MAX_GOAL_OBJECTIVE_CHARS,
  parseGoalCommand,
  readGoalResponseError,
} from "@/core/threads/goal";
import type { GoalState } from "@/core/threads/types";
import { fetch as fetchWithAuth } from "@/core/api/fetcher";
import { getBackendBaseURL } from "@/core/config";
import { createParityObserver } from "@/core/diagnostics/parity-observation";
import { findSuggestionTemplatePlaceholder } from "@/core/suggestions/placeholders";
import {
  extensionMentionMetadata,
  MAX_EXPLICIT_SKILLS,
} from "@/core/mentions/inline-references";
import { MAX_EXTENSION_MENTIONS } from "@/core/extensions/mentions";
import {
  createSubmissionFileCache,
  prepareSubmissionFiles,
} from "@/core/uploads/submission-files";
import { retireProjectAttachments } from "@/core/projects/composer-attach";
import { useWorkspaceToast } from "@/core/workspace-shell/toast";

type Submit = (
  text: string,
  files: FileInMessage[],
  options: ComposerSubmitOptions,
) => Promise<boolean | undefined>;
type SubmissionProps = {
  targetThreadId: string;
  streaming: boolean;
  canCreateRuns: boolean;
  isWelcome?: boolean;
  userId?: string | null;
  agentName?: string | null;
  context?: ThreadRunContextInput;
  ensureThread?: () => Promise<string>;
  captureSubmission?: () => ComposerHostSnapshot;
  submitMessage?: Submit;
};
type Operation = {
  epoch: number;
  scope: string;
  userId: string | null | undefined;
  targetThreadId: string;
  controller: AbortController;
  draft: ComposerDraftSnapshot;
  runSnapshot: ComposerRunSnapshot;
  hostSnapshot?: ComposerHostSnapshot;
  ensureThread: () => Promise<string>;
  dispatch: Submit;
  pendingDraft: boolean;
  accepted: boolean;
};

export function useComposerSubmission(options: {
  props: SubmissionProps;
  scope: MaybeRefOrGetter<string>;
  locked: () => boolean;
  model: () => Model | undefined;
  text: Ref<string>;
  skillName?: Ref<string | null>;
  files: Ref<File[]>;
  conversationReferences: Ref<ConversationReference[]>;
  draft: ReturnType<typeof useComposerDraft>;
  references: () => ReturnType<typeof useComposerReferences>;
  send: (
    text: string,
    files: FileInMessage[],
    options: ComposerSubmitOptions,
  ) => void;
  uploadingChange: (value: boolean, snapshot?: ComposerUploadSnapshot) => void;
  goalChange: (value: GoalState | null) => void;
  onAccepted: () => void;
}) {
  const { $i18n } = useNuxtApp();
  const toast = useWorkspaceToast();
  const queryClient = useQueryClient();
  const compactPending = ref(false);
  const submissionPending = ref(false);
  const filesByDraftKey = new Map<string, File[]>();
  const uploadedByThread = createSubmissionFileCache();
  const attachmentKeys = new WeakMap<File, number>();
  let nextAttachmentKey = 0;
  let retryIdentity: { signature: string; id: string } | null = null;
  let active: Operation | null = null;
  let epoch = 0;
  let disposed = false;

  function attachmentKey(file: File) {
    let key = attachmentKeys.get(file);
    if (key === undefined) {
      key = nextAttachmentKey++;
      attachmentKeys.set(file, key);
    }
    return key;
  }

  function owns(operation: Operation) {
    return (
      !disposed &&
      operation.epoch === epoch &&
      operation.scope === toValue(options.scope) &&
      !operation.controller.signal.aborted
    );
  }
  function cancel() {
    epoch += 1;
    const previous = active;
    active = null;
    previous?.controller.abort();
    if (previous?.pendingDraft) {
      options.draft.cancelSubmission(previous.draft);
      previous.pendingDraft = false;
    }
    compactPending.value = false;
    submissionPending.value = false;
    if (previous) options.uploadingChange(false);
  }
  function begin(): Operation {
    cancel();
    const props = options.props;
    const targetThreadId = props.targetThreadId;
    const hostSnapshot = props.captureSubmission?.();
    const operation: Operation = {
      epoch,
      scope: toValue(options.scope),
      userId: props.userId,
      targetThreadId,
      controller: new AbortController(),
      draft: {
        key: options.draft.key.value,
        text: options.text.value,
        skillName: options.skillName?.value ?? null,
        conversationReferences: JSON.parse(
          JSON.stringify(options.conversationReferences.value),
        ) as ConversationReference[],
      },
      runSnapshot: JSON.parse(
        JSON.stringify({
          context: props.context ?? {},
          model: options.model() ?? null,
        }),
      ) as ComposerRunSnapshot,
      hostSnapshot: hostSnapshot
        ? {
            ...JSON.parse(
              JSON.stringify({
                additionalInputMessages: hostSnapshot.additionalInputMessages,
                additionalKwargs: hostSnapshot.additionalKwargs,
              }),
            ),
            onAccepted: hostSnapshot.onAccepted,
          }
        : undefined,
      ensureThread:
        props.ensureThread ?? (() => Promise.resolve(targetThreadId)),
      dispatch:
        props.submitMessage ??
        (async (text, files, submitOptions) => {
          options.send(text, files, submitOptions);
          return undefined;
        }),
      pendingDraft: false,
      accepted: false,
    };
    active = operation;
    return operation;
  }
  function identity(operation: Operation, value: unknown) {
    const signature = JSON.stringify({
      scope: operation.scope,
      runSnapshot: operation.runSnapshot,
      hostSnapshot: {
        additionalInputMessages:
          operation.hostSnapshot?.additionalInputMessages,
        additionalKwargs: operation.hostSnapshot?.additionalKwargs,
      },
      value,
    });
    const observer = createParityObserver("human:composer");
    if (retryIdentity?.signature !== signature) {
      retryIdentity = { signature, id: crypto.randomUUID() };
      observer?.emit("human.allocate", {
        raw: retryIdentity.id,
        thread: operation.targetThreadId,
      });
    } else {
      observer?.emit("human.reuse", {
        raw: retryIdentity.id,
        thread: operation.targetThreadId,
      });
    }
    return retryIdentity.id;
  }
  function acceptsDraft(operation: Operation) {
    // An accepted A may retire A's saved draft while B is open. Returning to A
    // creates a new epoch: the old callback must not clear that live composer.
    if (
      disposed ||
      (!owns(operation) && operation.draft.key === options.draft.key.value)
    )
      return false;
    options.draft.clearIfUnchanged(operation.draft);
    operation.pendingDraft = false;
    operation.accepted = true;
    if (owns(operation)) {
      retryIdentity = null;
      options.onAccepted();
    }
    return true;
  }
  function finish(operation: Operation) {
    if (active !== operation) return;
    if (!operation.pendingDraft) active = null;
    compactPending.value = false;
    submissionPending.value = false;
  }
  function failed(operation: Operation, error: unknown, fallback: string) {
    if (operation.pendingDraft) options.draft.cancelSubmission(operation.draft);
    operation.pendingDraft = false;
    if (owns(operation))
      toast.error(error instanceof Error ? error.message : fallback);
  }
  watch(
    options.draft.key,
    (next, previous) => {
      filesByDraftKey.set(previous, [...options.files.value]);
      options.files.value = [...(filesByDraftKey.get(next) ?? [])];
    },
    { flush: "sync" },
  );
  watch(
    () => toValue(options.scope),
    () => {
      cancel();
      retryIdentity = null;
    },
    { flush: "sync" },
  );
  onScopeDispose(() => {
    cancel();
    disposed = true;
  });

  async function submit() {
    const props = options.props;
    if (options.locked()) return;
    if (props.streaming) {
      toast.info($i18n.t.value.inputBox.pleaseWaitStreaming);
      return;
    }
    const plain = options.text.value.trim();
    const text = options.skillName?.value
      ? `/${options.skillName?.value}${plain ? ` ${plain}` : ""}`
      : plain;
    const references = options.references();
    const pending = [...options.files.value];
    const staged = references.attachments.value.map((item) => ({ ...item }));
    if (!text && !pending.length && !staged.length) return;
    const placeholder = findSuggestionTemplatePlaceholder(text);
    if (placeholder) {
      toast.warning($i18n.t.value.inputBox.suggestionPlaceholderRequired);
      return placeholder;
    }
    const commandOnly = pending.length === 0 && staged.length === 0;
    if (commandOnly && isCompactCommand(text)) {
      if (compactPending.value) return;
      const operation = begin();
      if (props.isWelcome) {
        acceptsDraft(operation);
        toast.info($i18n.t.value.inputBox.compactSkipped);
        finish(operation);
        return;
      }
      compactPending.value = true;
      try {
        const result = await compactThreadContext(operation.targetThreadId, {
          signal: operation.controller.signal,
          agentName:
            typeof operation.runSnapshot.context.agent_name === "string"
              ? operation.runSnapshot.context.agent_name
              : props.agentName,
          modelName:
            typeof operation.runSnapshot.context.model_name === "string"
              ? operation.runSnapshot.context.model_name
              : null,
        });
        if (!owns(operation)) return;
        acceptsDraft(operation);
        invalidateThreadCaches(queryClient, operation.targetThreadId);
        if (result.compacted)
          toast.success($i18n.t.value.inputBox.compactSuccess);
        else
          toast.info(
            result.reason
              ? $i18n.t.value.inputBox.compactNotPerformed(result.reason)
              : $i18n.t.value.inputBox.compactSkipped,
          );
      } catch (error) {
        failed(operation, error, $i18n.t.value.inputBox.compactFailed);
      } finally {
        finish(operation);
      }
      return;
    }
    const goal = commandOnly ? parseGoalCommand(text) : null;
    if (!props.canCreateRuns && (!goal || goal.kind === "set")) {
      toast.info($i18n.t.value.inputBox.startTurnUnavailable);
      return;
    }
    if (goal) {
      if (
        goal.kind === "set" &&
        goal.objective.length > MAX_GOAL_OBJECTIVE_CHARS
      ) {
        toast.error(
          $i18n.t.value.inputBox.goalTooLong.replace(
            "{max}",
            String(MAX_GOAL_OBJECTIVE_CHARS),
          ),
        );
        return;
      }
      const operation = begin();
      try {
        const threadId = await operation.ensureThread();
        if (!owns(operation)) return;
        const response = await fetchWithAuth(
          `${getBackendBaseURL()}/api/threads/${encodeURIComponent(threadId)}/goal`,
          {
            method:
              goal.kind === "status"
                ? "GET"
                : goal.kind === "clear"
                  ? "DELETE"
                  : "PUT",
            ...(goal.kind === "set"
              ? {
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ objective: goal.objective }),
                }
              : {}),
            signal: operation.controller.signal,
          },
        );
        if (!response.ok)
          throw new Error(await readGoalResponseError(response));
        const body = (await response.json()) as { goal?: GoalState | null };
        if (!owns(operation)) return;
        const nextGoal = body.goal ?? null;
        options.goalChange(nextGoal);
        if (goal.kind === "status")
          toast.info(
            nextGoal
              ? $i18n.t.value.inputBox.goalActive.replace(
                  "{goal}",
                  () => nextGoal.objective,
                )
              : $i18n.t.value.inputBox.goalNone,
          );
        else
          toast.success(
            goal.kind === "clear"
              ? $i18n.t.value.inputBox.goalCleared
              : $i18n.t.value.inputBox.goalSet,
          );
        if (goal.kind === "set") {
          operation.pendingDraft = options.draft.beginSubmission(
            operation.draft,
          );
          const dispatched = await operation.dispatch(goal.objective, [], {
            humanMessageId: identity(operation, { goal: goal.objective }),
            signal: operation.controller.signal,
            runSnapshot: operation.runSnapshot,
            hostSnapshot: operation.hostSnapshot,
            onAccepted: () => {
              acceptsDraft(operation);
            },
          });
          if (dispatched === false && !operation.accepted) {
            options.draft.cancelSubmission(operation.draft);
            operation.pendingDraft = false;
          }
        } else acceptsDraft(operation);
      } catch (error) {
        failed(operation, error, $i18n.t.value.inputBox.goalFailed);
      } finally {
        finish(operation);
      }
      return;
    }
    if (references.selectedSkills.value.length > MAX_EXPLICIT_SKILLS) {
      toast.warning($i18n.t.value.inputBox.mentionMultipleSkills);
      return;
    }
    if (
      (extensionMentionMetadata(text).extension_mentions?.length ?? 0) >
      MAX_EXTENSION_MENTIONS
    ) {
      toast.warning($i18n.t.value.inputBox.mentionExtensionsLimit);
      return;
    }
    if (submissionPending.value) return;
    const operation = begin();
    submissionPending.value = true;
    operation.pendingDraft = options.draft.beginSubmission(operation.draft);
    try {
      const snapshot = buildComposerReferences({
        text,
        threadId: operation.targetThreadId,
        references: operation.draft.conversationReferences ?? [],
        capability: { ...references.capabilityState.value },
        attachments: staged,
      });
      const humanMessageId = identity(operation, {
        text: snapshot.text,
        files: pending.map(attachmentKey),
        additionalKwargs: snapshot.additionalKwargs,
      });
      const threadId = await operation.ensureThread();
      if (!owns(operation)) return;
      const missing = pending.some(
        (file) => !uploadedByThread.get(threadId)?.has(file),
      );
      if (missing)
        options.uploadingChange(true, {
          text: snapshot.text,
          humanMessageId,
          files: pending.map((file) => ({
            filename: file.name,
            size: 0,
            status: "uploading",
          })),
          additionalKwargs: {
            ...snapshot.additionalKwargs,
            ...operation.hostSnapshot?.additionalKwargs,
          },
        });
      const uploaded = await prepareSubmissionFiles({
        threadId,
        files: pending,
        cache: uploadedByThread,
        signal: operation.controller.signal,
      });
      if (!owns(operation)) return;
      if (missing) options.uploadingChange(false);
      const dispatched = await operation.dispatch(snapshot.text, uploaded, {
        humanMessageId,
        signal: operation.controller.signal,
        runSnapshot: operation.runSnapshot,
        hostSnapshot: operation.hostSnapshot,
        additionalKwargs: snapshot.additionalKwargs,
        conversationReferences: snapshot.conversationReferences,
        onAccepted: () => {
          if (operation.accepted || !acceptsDraft(operation)) return;
          const key = operation.draft.key;
          const files =
            key === options.draft.key.value
              ? options.files.value
              : (filesByDraftKey.get(key) ?? []);
          filesByDraftKey.set(
            key,
            files.filter((file) => !pending.includes(file)),
          );
          // Reference state is live. Retire stale storage without touching B's
          // picker/text; account changes cannot retire another user's staging.
          if (owns(operation)) references.retire(threadId, staged);
          else if (operation.userId === props.userId)
            retireProjectAttachments(threadId, staged);
          if (!owns(operation)) return;
          references.close();
          options.files.value = [...(filesByDraftKey.get(key) ?? [])];
        },
      });
      if (dispatched === false && !operation.accepted) {
        options.draft.cancelSubmission(operation.draft);
        operation.pendingDraft = false;
      }
    } catch (error) {
      failed(operation, error, $i18n.t.value.common.requestFailed);
    } finally {
      if (owns(operation)) options.uploadingChange(false);
      finish(operation);
    }
  }
  return { compactPending, submissionPending, attachmentKey, submit, cancel };
}
