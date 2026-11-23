import {
  computed,
  nextTick,
  onScopeDispose,
  ref,
  toValue,
  watch,
  type MaybeRefOrGetter,
  type Ref,
} from "vue";
import type { MentionSelection } from "@/components/chat/MentionPicker.vue";
import { useConversationReferencesCapability } from "@/composables/useWorkspaceFeatures";
import type { ConversationReference } from "@/core/conversation-references";
import { extensionMentionId } from "@/core/extensions/mentions";
import {
  inlineReferences,
  reconcileConversationReferences,
  referenceToken,
} from "@/core/mentions/inline-references";
import { getMentionQuery, type MentionQuery } from "@/core/mentions/query";
import { attachProjectDocument } from "@/core/projects";
import {
  readProjectAttachments,
  retireProjectAttachments,
  stageProjectAttachment,
  writeProjectAttachments,
  type StagedProjectAttachment,
} from "@/core/projects/composer-attach";
import { formatUploadSize } from "@/core/uploads/file-validation";
import type { UploadLimits } from "@/core/uploads/api";

/** One owner for picker lifetime and metadata; draft persistence owns its references. */
export function useComposerReferences(options: {
  text: Ref<string>;
  references: Ref<ConversationReference[]>;
  threadId: MaybeRefOrGetter<string>;
  projectId: MaybeRefOrGetter<string | null | undefined>;
  scopeKey: MaybeRefOrGetter<string>;
  ready: MaybeRefOrGetter<boolean>;
  disabled: MaybeRefOrGetter<boolean>;
  limits: MaybeRefOrGetter<UploadLimits | undefined>;
  localFiles: Ref<File[]>;
  ensureThread?: () => Promise<string>;
  focusAt: (offset: number) => void;
  openUpload: () => void;
  onFileAttached: (threadId: string) => void;
}) {
  const { $i18n } = useNuxtApp();
  // Discovery follows the mounted query owner, as in React's InputBox.
  // Editing locks still gate the picker and every mutating action below.
  const capability = useConversationReferencesCapability();
  const capabilityState = computed(() => ({
    enabled: capability.enabled.value,
    maxReferences: capability.maxReferences.value,
    isLoading: capability.isLoading.value,
    isSuccess: capability.isSuccess.value,
    error: capability.error.value,
  }));
  const query = ref<MentionQuery | null>(null);
  const buttonOpen = ref(false);
  const busy = ref(false);
  const error = ref<string | null>(null);
  const attachments = ref<StagedProjectAttachment[]>([]);
  let epoch = 0;
  let caret = 0;
  let dismissed: string | null = null;
  const knownConversations = new Map<string, ConversationReference>();
  const knownAttachments = new Map<string, StagedProjectAttachment>();
  const inline = computed(() => inlineReferences(options.text.value));
  const selectedSkills = computed(() => [
    ...new Set(
      inline.value
        .filter((item) => item.kind === "skill")
        .map((item) => item.id),
    ),
  ]);
  const selectedExtensions = computed(() => [
    ...new Set(
      inline.value
        .filter((item) => item.kind === "extension")
        .map((item) => item.id),
    ),
  ]);
  const unavailable = computed(
    () =>
      (!capability.isSuccess.value || capability.isLoading.value) &&
      inline.value.some((item) => item.kind === "conversation"),
  );
  const show = computed(
    () =>
      !toValue(options.disabled) && (buttonOpen.value || query.value !== null),
  );
  watch(
    [
      () => toValue(options.scopeKey),
      () => toValue(options.threadId),
      () => toValue(options.projectId),
      () => toValue(options.ready),
    ],
    async () => {
      const current = ++epoch;
      query.value = null;
      buttonOpen.value = false;
      busy.value = false;
      error.value = null;
      knownConversations.clear();
      knownAttachments.clear();
      attachments.value = [];
      await nextTick();
      if (current !== epoch || !toValue(options.ready)) return;
      attachments.value = readProjectAttachments(toValue(options.threadId));
      for (const file of attachments.value)
        if (file.source_document_id)
          knownAttachments.set(file.source_document_id, file);
      const tokens = attachments.value
        .filter(
          (file) =>
            file.source_document_id &&
            !inline.value.some(
              (item) =>
                item.kind === "file" && item.id === file.source_document_id,
            ),
        )
        .map((file) =>
          referenceToken("file", file.source_document_id!, file.filename),
        );
      if (tokens.length)
        options.text.value = [options.text.value, ...tokens]
          .filter(Boolean)
          .join(" ");
    },
    { immediate: true, flush: "sync" },
  );
  watch([options.text, options.references, capabilityState], () => {
    for (const reference of options.references.value)
      knownConversations.set(reference.threadId, reference);
    const reconciled = reconcileConversationReferences(
      options.text.value,
      [...knownConversations.values()],
      capabilityState.value,
      toValue(options.threadId),
    );
    if (reconciled.text !== options.text.value)
      options.text.value = reconciled.text;
    if (
      JSON.stringify(reconciled.references) !==
      JSON.stringify(options.references.value)
    )
      options.references.value = reconciled.references;
    const ids = new Set(
      inline.value
        .filter((item) => item.kind === "file")
        .map((item) => item.id),
    );
    const next = [
      ...attachments.value.filter((file) => !file.source_document_id),
      ...[...ids].flatMap((id) =>
        knownAttachments.get(id) ? [knownAttachments.get(id)!] : [],
      ),
    ];
    if (JSON.stringify(next) !== JSON.stringify(attachments.value)) {
      attachments.value = next;
      writeProjectAttachments(toValue(options.threadId), next);
    }
  });
  function updateQuery(value: string, offset: number | null) {
    if (offset !== null) caret = offset;
    if (dismissed === `${value}:${offset}`) return;
    dismissed = null;
    buttonOpen.value = false;
    error.value = null;
    query.value = offset === null ? null : getMentionQuery(value, offset);
  }
  function open(offset?: number | null) {
    if (toValue(options.disabled)) return;
    if (offset != null) caret = offset;
    dismissed = null;
    query.value = null;
    buttonOpen.value = true;
    error.value = null;
  }
  function close() {
    if (busy.value) return;
    dismissed = `${options.text.value}:${query.value?.end}`;
    query.value = null;
    buttonOpen.value = false;
    error.value = null;
  }
  async function select(selection: MentionSelection) {
    if (busy.value || toValue(options.disabled)) return;
    const current = epoch;
    let attachedThreadId = toValue(options.threadId);
    const original = options.text.value;
    const position = query.value?.start ?? Math.min(caret, original.length);
    const end = query.value?.end ?? position;
    const id =
      selection.kind === "skill"
        ? selection.skill.name
        : selection.kind === "conversation"
          ? selection.reference.threadId
          : selection.kind === "extension"
            ? extensionMentionId(selection.reference)
            : selection.kind === "file"
              ? selection.document.id
              : null;
    if (
      id &&
      selection.kind !== "file" &&
      inline.value.some(
        (item) => item.kind === selection.kind && item.id === id,
      )
    ) {
      let next = original.slice(0, position) + original.slice(end);
      for (const item of inlineReferences(next).reverse())
        if (item.kind === selection.kind && item.id === id)
          next = next.slice(0, item.start) + next.slice(item.end);
      options.text.value = next;
      close();
      options.focusAt(Math.min(position, next.length));
      return;
    }
    if (selection.kind === "file") {
      const projectId = toValue(options.projectId);
      if (!projectId) return;
      if (
        !attachments.value.some(
          (file) =>
            file.source_project_id === projectId &&
            file.source_document_id === id,
        )
      ) {
        const limits = toValue(options.limits);
        const sizes = [
          ...attachments.value.map((file) => file.size_bytes),
          ...options.localFiles.value.map((file) => file.size),
          selection.document.size_bytes,
        ];
        if (
          limits &&
          (sizes.length > limits.max_files ||
            sizes.reduce((sum, size) => sum + size, 0) >
              limits.max_total_size ||
            selection.document.size_bytes > limits.max_file_size)
        ) {
          error.value = $i18n.t.value.uploads.limitsHint(
            limits.max_files,
            formatUploadSize(limits.max_file_size),
            formatUploadSize(limits.max_total_size),
          );
          return;
        }
        busy.value = true;
        error.value = null;
        try {
          const threadId = options.ensureThread
            ? await options.ensureThread()
            : toValue(options.threadId);
          attachedThreadId = threadId;
          if (current !== epoch) return;
          const attached = await attachProjectDocument(
            projectId,
            selection.document.id,
            threadId,
          );
          if (current !== epoch) return;
          const staged = stageProjectAttachment(threadId, {
            ...attached,
            source_document_id: selection.document.id,
            source_project_id: projectId,
          });
          knownAttachments.set(selection.document.id, staged);
          attachments.value = [
            ...attachments.value.filter(
              (file) => file.virtual_path !== staged.virtual_path,
            ),
            staged,
          ];
        } catch {
          if (current === epoch)
            error.value = $i18n.t.value.inputBox.mentionAttachFailed;
          return;
        } finally {
          if (current === epoch) busy.value = false;
        }
      }
    } else if (selection.kind === "conversation") {
      if (
        !capability.enabled.value ||
        options.references.value.length >= capability.maxReferences.value
      )
        return;
      knownConversations.set(selection.reference.threadId, selection.reference);
      options.references.value = [
        ...options.references.value,
        selection.reference,
      ];
    } else if (selection.kind === "upload") options.openUpload();
    const label =
      selection.kind === "skill"
        ? selection.skill.name
        : selection.kind === "conversation"
          ? selection.reference.title
          : selection.kind === "extension"
            ? selection.reference.label
            : selection.kind === "file"
              ? selection.document.name
              : "";
    const inserted =
      id && selection.kind !== "upload"
        ? `${referenceToken(selection.kind, id, label)} `
        : "";
    options.text.value =
      original.slice(0, position) + inserted + original.slice(end);
    query.value = null;
    buttonOpen.value = false;
    error.value = null;
    options.focusAt(position + inserted.length);
    if (selection.kind === "file") options.onFileAttached(attachedThreadId);
  }
  function removeAttachment(attachment: StagedProjectAttachment) {
    attachments.value = attachments.value.filter(
      (file) => file.virtual_path !== attachment.virtual_path,
    );
    writeProjectAttachments(toValue(options.threadId), attachments.value);
  }
  function retire(threadId: string, sent: readonly StagedProjectAttachment[]) {
    retireProjectAttachments(threadId, sent);
    if (threadId === toValue(options.threadId)) {
      attachments.value = readProjectAttachments(threadId);
      for (const file of attachments.value)
        if (file.source_document_id)
          knownAttachments.set(file.source_document_id, file);
      const tokens = attachments.value
        .filter(
          (file) =>
            file.source_document_id &&
            !inline.value.some(
              (ref) =>
                ref.kind === "file" && ref.id === file.source_document_id,
            ),
        )
        .map((file) =>
          referenceToken("file", file.source_document_id!, file.filename),
        );
      if (tokens.length)
        options.text.value = [options.text.value, ...tokens]
          .filter(Boolean)
          .join(" ");
    }
  }
  onScopeDispose(() => {
    epoch++;
  });
  return {
    capability,
    capabilityState,
    query,
    buttonOpen,
    busy,
    error,
    attachments,
    inline,
    selectedSkills,
    selectedExtensions,
    unavailable,
    show,
    updateQuery,
    open,
    close,
    select,
    removeAttachment,
    retire,
  };
}
