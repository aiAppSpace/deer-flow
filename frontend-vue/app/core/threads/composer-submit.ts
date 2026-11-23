import {
  buildConversationReferenceMetadata,
  type ConversationReference,
} from "@/core/conversation-references";
import { MAX_EXTENSION_MENTIONS } from "@/core/extensions/mentions";
import {
  extensionMentionMetadata,
  inlineReferences,
  readableReferences,
  MAX_EXPLICIT_SKILLS,
  reconcileConversationReferences,
} from "@/core/mentions/inline-references";
import type { StagedProjectAttachment } from "@/core/projects/composer-attach";
import type { Message } from "@/core/types/message";
import type { FileInMessage } from "@/core/messages/utils";
import type { Model } from "@/core/models/types";
import type { ThreadRunContextInput } from "./submit";
import { buildThreadSubmitMessages } from "./submit";

export type ComposerUploadSnapshot = {
  text: string;
  humanMessageId: string;
  files: FileInMessage[];
  additionalKwargs?: Record<string, unknown>;
};

/** The uploading preview is transient; only the eventual submitted human is persisted. */
export function buildComposerUploadMessages(
  snapshot: ComposerUploadSnapshot,
  uploadingLabel: string,
): Message[] {
  if (snapshot.additionalKwargs?.hide_from_ui === true) return [];
  return [
    ...buildThreadSubmitMessages({
      text: snapshot.text,
      humanMessageId: snapshot.humanMessageId,
      additionalKwargs: snapshot.additionalKwargs,
      filesForSubmit: snapshot.files,
    }),
    {
      type: "ai",
      id: `upload:${snapshot.humanMessageId}`,
      content: uploadingLabel,
      additional_kwargs: { element: "task" },
    } as Message,
  ];
}

export type ComposerSubmitOptions = {
  humanMessageId: string;
  signal?: AbortSignal;
  runSnapshot?: ComposerRunSnapshot;
  hostSnapshot?: ComposerHostSnapshot;
  additionalKwargs?: Record<string, unknown>;
  conversationReferences?: readonly string[];
  onAccepted: () => void;
};

/** The React send closure captures these before its attachment upload await. */
export type ComposerRunSnapshot = {
  context: ThreadRunContextInput;
  model?: Model | null;
};

/** Page-owned quote and knowledge metadata captured before upload/preparation. */
export type ComposerHostSnapshot = {
  additionalInputMessages?: Message[];
  additionalKwargs?: Record<string, unknown>;
  onAccepted?: () => void;
};

/** Display metadata, tool activation and per-send grants have separate contracts. */
export function buildComposerReferences({
  text,
  threadId,
  references,
  capability,
  attachments,
}: {
  text: string;
  threadId: string;
  references: ConversationReference[];
  capability: {
    enabled: boolean;
    maxReferences: number;
    isLoading: boolean;
    isSuccess: boolean;
  };
  attachments: readonly StagedProjectAttachment[];
}) {
  const inline = inlineReferences(text);
  if (
    (!capability.isSuccess || capability.isLoading) &&
    inline.some((ref) => ref.kind === "conversation")
  ) {
    throw new Error(
      "Conversation capability is not available. Retry discovery before sending.",
    );
  }
  const reconciled = reconcileConversationReferences(
    text,
    references,
    capability,
    threadId,
  );
  const skills = [
    ...new Set(
      inline.filter((ref) => ref.kind === "skill").map((ref) => ref.id),
    ),
  ];
  if (skills.length > MAX_EXPLICIT_SKILLS)
    throw new Error(`Select up to ${MAX_EXPLICIT_SKILLS} skills.`);
  const extensions = extensionMentionMetadata(text);
  if ((extensions.extension_mentions?.length ?? 0) > MAX_EXTENSION_MENTIONS)
    throw new Error(
      `Select up to ${MAX_EXTENSION_MENTIONS} plugin references.`,
    );
  const selectedAttachments = attachments.filter(
    (file) =>
      !file.source_document_id ||
      inline.some(
        (ref) => ref.kind === "file" && ref.id === file.source_document_id,
      ),
  );
  return {
    text: readableReferences(reconciled.text),
    references: reconciled.references,
    conversationReferences: reconciled.references.map((ref) => ref.threadId),
    additionalKwargs: {
      ...extensions,
      ...(skills.length ? { skill_references: skills } : {}),
      ...(reconciled.references.length
        ? buildConversationReferenceMetadata(reconciled.references)
        : {}),
      ...(selectedAttachments.length
        ? {
            files: selectedAttachments.map((file) => ({
              filename: file.filename,
              size: file.size_bytes,
              path: file.virtual_path,
              status: "uploaded" as const,
            })),
          }
        : {}),
    } as Record<string, unknown>,
  };
}
