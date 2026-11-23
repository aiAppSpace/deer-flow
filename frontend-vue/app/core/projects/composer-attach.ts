import type { AttachProjectDocumentResult } from "./types";

export type StagedProjectAttachment = AttachProjectDocumentResult & {
  staging_id: string;
};
const PREFIX = "deerflow.project-attachment.";
const memory = new Map<string, StagedProjectAttachment[]>();
const memoryOnly = new Set<string>();

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}
function sourceKey(file: AttachProjectDocumentResult) {
  return file.source_project_id && file.source_document_id
    ? `${file.source_project_id}:${file.source_document_id}`
    : file.virtual_path;
}
function parseEntry(value: unknown): StagedProjectAttachment | null {
  if (!value || typeof value !== "object") return null;
  const file = value as Partial<StagedProjectAttachment>;
  if (
    typeof file.filename !== "string" ||
    typeof file.virtual_path !== "string"
  )
    return null;
  return {
    filename: file.filename,
    virtual_path: file.virtual_path,
    size_bytes: typeof file.size_bytes === "number" ? file.size_bytes : 0,
    artifact_url:
      typeof file.artifact_url === "string"
        ? file.artifact_url
        : file.virtual_path,
    ...(typeof file.source_document_id === "string"
      ? { source_document_id: file.source_document_id }
      : {}),
    ...(typeof file.source_project_id === "string"
      ? { source_project_id: file.source_project_id }
      : {}),
    staging_id:
      typeof file.staging_id === "string"
        ? file.staging_id
        : `legacy:${file.virtual_path}`,
  };
}

/** Reading never consumes a pending attachment, including across full page reloads. */
export function readProjectAttachments(
  threadId: string,
): StagedProjectAttachment[] {
  const target = storage();
  if (!target || memoryOnly.has(threadId))
    return [...(memory.get(threadId) ?? [])];
  let raw: string | null;
  try {
    raw = target.getItem(`${PREFIX}${threadId}`);
  } catch {
    memoryOnly.add(threadId);
    return [...(memory.get(threadId) ?? [])];
  }
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    const values = Array.isArray(parsed) ? parsed : [parsed];
    return values
      .map(parseEntry)
      .filter((file): file is StagedProjectAttachment => file !== null);
  } catch {
    return [];
  }
}

/** The mounted composer's chip removals are written through immediately. */
export function writeProjectAttachments(
  threadId: string,
  files: readonly StagedProjectAttachment[],
) {
  memory.set(threadId, [...files]);
  const target = storage();
  if (!target) {
    memoryOnly.add(threadId);
    return;
  }
  try {
    if (files.length === 0) target.removeItem(`${PREFIX}${threadId}`);
    else target.setItem(`${PREFIX}${threadId}`, JSON.stringify(files));
    memoryOnly.delete(threadId);
  } catch {
    memoryOnly.add(threadId);
  }
}

/** Only a server-confirmed ingestion result may enter the cross-route handoff. */
export function stageProjectAttachment(
  threadId: string,
  result: AttachProjectDocumentResult,
): StagedProjectAttachment {
  const staged = { ...result, staging_id: crypto.randomUUID() };
  const pending = readProjectAttachments(threadId).filter(
    (file) =>
      sourceKey(file) !== sourceKey(result) &&
      file.virtual_path !== result.virtual_path,
  );
  writeProjectAttachments(threadId, [...pending, staged]);
  return staged;
}

/** Retire exactly the accepted send's revisions; later additions remain pending. */
export function retireProjectAttachments(
  threadId: string,
  sent: readonly StagedProjectAttachment[],
) {
  const revisions = new Set(sent.map((file) => file.staging_id));
  writeProjectAttachments(
    threadId,
    readProjectAttachments(threadId).filter(
      (file) => !revisions.has(file.staging_id),
    ),
  );
}
