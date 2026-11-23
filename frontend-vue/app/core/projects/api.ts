/*
  【文件职责】     项目（project workspace）CRUD、归档/恢复与项目内会话列表的 Gateway HTTP adapter。
  【架构位置】     L3 project API boundary
  【主要导出】     listProjects · getProject · createProject · patchProject ·
                   archiveProject · restoreProject · deleteProject · listProjectThreads
  【依赖关系】     core api fetcher/errors/config · ./types
  【边界与注意】   端点形状以 `backend/app/gateway/routers/projects.py` 为准：
                   归档/恢复是 **POST 子资源**（`/archive` `/restore`）而不是 PATCH status，
                   删除返回 **204 无正文**。每个请求都收 `signal`——调用方是唯一的
                   Vue Query owner，取消由它负责，这一层不自己起生命周期。
*/
import {
  readGatewayResponseError,
  type GatewayResponseError,
} from "@/core/api/errors";
import { fetch } from "@/core/api/fetcher";
import { getBackendBaseURL } from "@/core/config";
import { readArtifactPreviewBody } from "@/core/artifacts/response-body";

import {
  ARTIFACT_PREVIEW_MAX_BYTES,
  parseContentRange,
} from "@/core/artifacts/loader";

import type {
  Project,
  ProjectCreateInput,
  ProjectPatchInput,
  ProjectStatus,
  ProjectThread,
  ProjectDocument,
  ProjectThreadFileGroup,
  PromoteThreadFileInput,
  AttachProjectDocumentResult,
} from "./types";

type RequestOptions = {
  signal?: AbortSignal;
};

/** `GET /api/projects` 的响应：**包了一层 `projects`**，不是裸数组。 */
interface ProjectListResponse {
  projects: Project[];
}

function projectsUrl(path = ""): string {
  return `${getBackendBaseURL()}/api/projects${path}`;
}

function projectUrl(projectId: string, suffix = ""): string {
  return projectsUrl(`/${encodeURIComponent(projectId)}${suffix}`);
}

export async function listProjects(
  status?: ProjectStatus,
  options: RequestOptions = {},
): Promise<Project[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const response = await fetch(projectsUrl(query), { signal: options.signal });
  if (!response.ok) {
    throw await readProjectResponseError(response, "Failed to load projects.");
  }
  const body = (await response.json()) as ProjectListResponse;
  return body.projects;
}

export async function getProject(
  projectId: string,
  options: RequestOptions = {},
): Promise<Project> {
  const response = await fetch(projectUrl(projectId), {
    signal: options.signal,
  });
  if (!response.ok) {
    throw await readProjectResponseError(response, "Failed to load project.");
  }
  return response.json();
}

export async function createProject(
  input: ProjectCreateInput,
  options: RequestOptions = {},
): Promise<Project> {
  const response = await fetch(projectsUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: input.name,
      instructions: input.instructions ?? "",
      presentation: input.presentation ?? {},
    }),
    signal: options.signal,
  });
  if (!response.ok) {
    throw await readProjectResponseError(response, "Failed to create project.");
  }
  return response.json();
}

/**
 * PATCH 只发**显式给出的**字段。
 *
 * 用 `key in input` 而不是 `!== undefined` 判断：`{ instructions: undefined }`
 * 与「没传 instructions」在语义上不同，前者是调用方的疏漏，让它照样不发比
 * 悄悄把 `undefined` 序列化成缺字段更容易发现。
 */
export async function patchProject(
  projectId: string,
  input: ProjectPatchInput,
  options: RequestOptions = {},
): Promise<Project> {
  const payload: Record<string, unknown> = {};
  for (const key of ["name", "instructions", "presentation"] as const) {
    if (input[key] !== undefined) {
      payload[key] = input[key];
    }
  }
  const response = await fetch(projectUrl(projectId), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: options.signal,
  });
  if (!response.ok) {
    throw await readProjectResponseError(response, "Failed to update project.");
  }
  return response.json();
}

export async function archiveProject(
  projectId: string,
  options: RequestOptions = {},
): Promise<Project> {
  const response = await fetch(projectUrl(projectId, "/archive"), {
    method: "POST",
    signal: options.signal,
  });
  if (!response.ok) {
    throw await readProjectResponseError(
      response,
      "Failed to archive project.",
    );
  }
  return response.json();
}

export async function restoreProject(
  projectId: string,
  options: RequestOptions = {},
): Promise<Project> {
  const response = await fetch(projectUrl(projectId, "/restore"), {
    method: "POST",
    signal: options.signal,
  });
  if (!response.ok) {
    throw await readProjectResponseError(
      response,
      "Failed to restore project.",
    );
  }
  return response.json();
}

/** 删除成功是 **204 无正文**，所以这里不读 body。 */
export async function deleteProject(
  projectId: string,
  options: RequestOptions = {},
): Promise<void> {
  const response = await fetch(projectUrl(projectId), {
    method: "DELETE",
    signal: options.signal,
  });
  if (!response.ok) {
    throw await readProjectResponseError(response, "Failed to delete project.");
  }
}

export async function listProjectThreads(
  projectId: string,
  params: { limit?: number; offset?: number } = {},
  options: RequestOptions = {},
): Promise<ProjectThread[]> {
  const search = new URLSearchParams();
  if (params.limit !== undefined) {
    search.set("limit", String(params.limit));
  }
  if (params.offset !== undefined) {
    search.set("offset", String(params.offset));
  }
  const query = search.size > 0 ? `?${search.toString()}` : "";
  const response = await fetch(projectUrl(projectId, `/threads${query}`), {
    signal: options.signal,
  });
  if (!response.ok) {
    throw await readProjectResponseError(
      response,
      "Failed to load project threads.",
    );
  }
  return response.json();
}

/** ``GET /api/projects/{id}/documents`` envelope (spec §6.5). */
export type ProjectDocumentListResponse = {
  documents: ProjectDocument[];
  total: number;
  limit: number;
  offset: number;
};

/**
 * Upload/promote response: ``deduplicated`` distinguishes the 200 dedup hit
 * (existing row, first name wins, §10.9) from the 201 created row.
 */
export type ProjectDocumentUploadResponse = {
  document: ProjectDocument;
  deduplicated: boolean;
};

/** ``GET /api/projects/{id}/thread-files`` envelope (spec §7.4). */
export type ProjectThreadFilesResponse = {
  groups: ProjectThreadFileGroup[];
  next_offset: number | null;
  truncated: boolean;
};

export const PROJECTS_QUERY_KEY = ["projects"] as const;

/** ``GET /api/projects/config`` payload (spec §6.5). */
export type ProjectsConfig = {
  instructions_max_bytes: number;
  trash_retention_days: number;
};

/**
 * Client mirror of the server defaults (config/projects_config.py): callers
 * fall back to these when the config endpoint is unavailable (older gateway,
 * network failure), matching what an unconfigured server enforces.
 */
export const PROJECTS_CONFIG_DEFAULT: ProjectsConfig = {
  instructions_max_bytes: 8192,
  trash_retention_days: 30,
};

/** Server-configured projects limits; shared by the editor and trash. */
export async function getProjectsConfig(
  options: RequestOptions = {},
): Promise<ProjectsConfig> {
  const response = await fetch(`${getBackendBaseURL()}/api/projects/config`, {
    method: "GET",
    signal: options.signal,
  });

  if (!response.ok) {
    throw await readProjectResponseError(
      response,
      "Failed to load projects config.",
    );
  }

  return (await response.json()) as ProjectsConfig;
}

async function readProjectResponseError(
  response: Response,
  fallback: string,
): Promise<GatewayResponseError> {
  const error = await readGatewayResponseError(response, fallback);
  const detail =
    typeof error.body === "object" && error.body !== null
      ? Reflect.get(error.body, "detail")
      : undefined;
  error.message = typeof detail === "string" && detail ? detail : fallback;
  return error;
}

export async function listProjectDocuments(
  projectId: string,
  params: { limit?: number; offset?: number; signal?: AbortSignal } = {},
  options: RequestOptions = {},
): Promise<ProjectDocumentListResponse> {
  const search = new URLSearchParams();
  if (params.limit !== undefined) {
    search.set("limit", String(params.limit));
  }
  if (params.offset !== undefined) {
    search.set("offset", String(params.offset));
  }
  const query = search.size > 0 ? `?${search.toString()}` : "";
  const response = await fetch(projectUrl(projectId, `/documents${query}`), {
    method: "GET",
    signal: options.signal ?? params.signal,
  });

  if (!response.ok) {
    throw await readProjectResponseError(
      response,
      "Failed to load project documents.",
    );
  }

  return (await response.json()) as ProjectDocumentListResponse;
}

/**
 * Shelf exactly one file per request (spec §17.2); the UI loops for
 * multi-file drops. 201 created and 200 dedup hit are both success.
 */
export async function uploadProjectDocument(
  projectId: string,
  { file, name }: { file: File; name?: string },
  options: RequestOptions = {},
): Promise<ProjectDocumentUploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  if (name !== undefined) {
    formData.append("name", name);
  }
  const response = await fetch(projectUrl(projectId, "/documents"), {
    method: "POST",
    body: formData,
    signal: options.signal,
  });

  if (!response.ok) {
    throw await readProjectResponseError(
      response,
      "Failed to upload project document.",
    );
  }

  return (await response.json()) as ProjectDocumentUploadResponse;
}

/** Save a thread file (upload or output) onto the project shelf (spec §7.4). */
export async function promoteThreadFile(
  projectId: string,
  input: PromoteThreadFileInput,
  options: RequestOptions = {},
): Promise<ProjectDocumentUploadResponse> {
  const response = await fetch(
    projectUrl(projectId, "/documents/from-thread"),
    {
      method: "POST",
      signal: options.signal,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        thread_id: input.thread_id,
        kind: input.kind,
        name: input.name,
        ...(input.shelf_name !== undefined
          ? { shelf_name: input.shelf_name }
          : {}),
      }),
    },
  );

  if (!response.ok) {
    throw await readProjectResponseError(
      response,
      "Failed to save file to project.",
    );
  }

  return (await response.json()) as ProjectDocumentUploadResponse;
}

/** Attach a shelf document into a thread through the uploads path (§7.3). */
export async function attachProjectDocument(
  projectId: string,
  documentId: string,
  threadId: string,
  options: RequestOptions = {},
): Promise<AttachProjectDocumentResult> {
  const response = await fetch(
    projectUrl(
      projectId,
      `/documents/${encodeURIComponent(documentId)}/attach-to-thread/${encodeURIComponent(threadId)}`,
    ),
    {
      method: "POST",
      signal: options.signal,
    },
  );

  if (!response.ok) {
    throw await readProjectResponseError(
      response,
      "Failed to attach document to thread.",
    );
  }

  return (await response.json()) as AttachProjectDocumentResult;
}

/** Move one shelf document to trash (204; restore/purge are the trash tier). */
export async function deleteProjectDocument(
  projectId: string,
  documentId: string,
  options: RequestOptions = {},
): Promise<void> {
  const response = await fetch(
    projectUrl(projectId, `/documents/${encodeURIComponent(documentId)}`),
    {
      method: "DELETE",
      signal: options.signal,
    },
  );

  if (!response.ok) {
    throw await readProjectResponseError(
      response,
      "Failed to delete project document.",
    );
  }
}

/**
 * Content endpoint address (spec §6.5): inline text by default, forced
 * attachment with ``download`` — used for the shelf row's download action.
 */
export function urlOfProjectDocumentContent(
  projectId: string,
  documentId: string,
  { download = false }: { download?: boolean } = {},
): string {
  const suffix = `/documents/${encodeURIComponent(documentId)}/content${download ? "?download=true" : ""}`;
  return projectUrl(projectId, suffix);
}

/**
 * Content-missing conflict (HTTP 409 ``content_missing``, spec §11): the
 * row's bytes are gone or damaged, so the page renders the row as
 * content-missing with move-to-trash as its only action.
 */
export class ProjectDocumentContentMissingError extends Error {
  constructor() {
    super("content_missing");
    this.name = "ProjectDocumentContentMissingError";
  }
}

/** Media types the preview dialog decodes as text (bounded prefix only). */
function isTextPreviewMediaType(contentType: string): boolean {
  return (
    contentType.startsWith("text/") ||
    contentType === "application/json" ||
    contentType === "application/xml" ||
    contentType === "application/javascript" ||
    contentType === "application/x-yaml" ||
    contentType === "application/yaml"
  );
}

/**
 * Active-content media types — mirror of the backend's
 * ``deerflow.utils.text_detection._is_active_content_mime_type``: any
 * WHATWG XML type (plus ``text/html``/``text/xsl``) can carry script, so the
 * content endpoint always serves them as an attachment. The preview must
 * never navigate its sandboxed iframe to one (the empty sandbox blocks the
 * download and renders a blank frame).
 */
const ACTIVE_CONTENT_MEDIA_TYPES = new Set([
  "text/html",
  "application/xhtml+xml",
  "image/svg+xml",
  "text/xml",
  "application/xml",
  "text/xsl",
]);

function isActiveContentMediaType(contentType: string): boolean {
  return (
    ACTIVE_CONTENT_MEDIA_TYPES.has(contentType) || contentType.endsWith("+xml")
  );
}

/**
 * Media types the browser renders inline inside the sandboxed iframe —
 * passive binaries only; the active-content XML family (SVG included) is
 * excluded because the endpoint serves it as an attachment. PDF is handled
 * separately (its own preview kind): Chromium blocks the built-in PDF
 * viewer inside ``sandbox=""``, so PDFs render in an unsandboxed iframe.
 */
function isBrowserViewableMediaType(contentType: string): boolean {
  if (isActiveContentMediaType(contentType)) {
    return false;
  }
  return (
    contentType.startsWith("image/") ||
    contentType.startsWith("audio/") ||
    contentType.startsWith("video/")
  );
}

/**
 * Preview payload for the shelf preview dialog (§6.5). Binary documents are
 * never text-decoded: browser-viewable kinds render the content URL in a
 * sandboxed iframe, PDFs render in an iframe WITHOUT the sandbox attribute
 * (Chromium blocks its built-in viewer inside ``sandbox=""``), everything
 * else gets an explicit download fallback.
 */
export type ProjectDocumentPreview =
  | {
      kind: "text";
      content: string;
      truncated: boolean;
      previewBytes: number;
      totalBytes: number | undefined;
    }
  | { kind: "binary" }
  | { kind: "pdf" }
  | { kind: "unsupported" };
/**
 * Fetch a shelf document for the preview dialog (§6.5). The request asks for
 * at most the first ``ARTIFACT_PREVIEW_MAX_BYTES`` through an HTTP byte range
 * (the content endpoint is a Starlette ``FileResponse``, which answers 206);
 * an oversized ``Content-Length`` on a 200 still marks the preview truncated
 * so the dialog offers the explicit full-file action instead of rendering a
 * partial file as complete. The response media type is inspected before any
 * decode: only textual types are decoded, never binary bytes.
 */
export async function fetchProjectDocumentPreview(
  projectId: string,
  documentId: string,
  options: RequestOptions = {},
): Promise<ProjectDocumentPreview> {
  const response = await fetch(
    urlOfProjectDocumentContent(projectId, documentId),
    {
      headers: { Range: `bytes=0-${ARTIFACT_PREVIEW_MAX_BYTES - 1}` },
      signal: options.signal,
    },
  );
  if (response.status === 409) {
    throw new ProjectDocumentContentMissingError();
  }
  const contentRange = parseContentRange(response.headers.get("Content-Range"));
  if (response.status === 416 && contentRange?.total === 0) {
    return {
      kind: "text",
      content: "",
      truncated: false,
      previewBytes: 0,
      totalBytes: 0,
    };
  }
  if (!response.ok) {
    throw await readProjectResponseError(
      response,
      "Failed to load document content.",
    );
  }

  const contentType = (response.headers.get("Content-Type") ?? "")
    .split(";")[0]!
    .trim()
    .toLowerCase();
  if (contentType === "application/pdf") {
    // PDFs get their own kind: the dialog renders them in an iframe WITHOUT
    // the sandbox attribute (Chromium blocks its built-in viewer inside
    // ``sandbox=""``), unlike other viewable binaries. The bounded prefix is
    // useless either way — release the body instead of decoding it.
    await response.body?.cancel();
    return { kind: "pdf" };
  }
  if (isBrowserViewableMediaType(contentType)) {
    // The bounded prefix is useless to the iframe, which loads the content
    // URL itself; release the body instead of decoding it.
    await response.body?.cancel();
    return { kind: "binary" };
  }
  if (!isTextPreviewMediaType(contentType)) {
    await response.body?.cancel();
    return { kind: "unsupported" };
  }

  const body = await readArtifactPreviewBody(
    response,
    ARTIFACT_PREVIEW_MAX_BYTES,
  );
  const bytes = body.bytes;
  const contentLengthHeader = response.headers.get("Content-Length");
  const contentLength =
    contentLengthHeader === null ? undefined : Number(contentLengthHeader);
  const totalBytes =
    contentRange?.total ??
    (contentLength !== undefined && Number.isFinite(contentLength)
      ? contentLength
      : undefined);
  const previewBytes = Math.min(bytes.byteLength, ARTIFACT_PREVIEW_MAX_BYTES);
  const truncated =
    body.truncated ||
    (response.status === 206 &&
      (contentRange?.end === undefined ||
        contentRange.total > contentRange.end + 1)) ||
    bytes.byteLength > ARTIFACT_PREVIEW_MAX_BYTES ||
    (totalBytes !== undefined &&
      totalBytes > ARTIFACT_PREVIEW_MAX_BYTES &&
      totalBytes > bytes.byteLength);
  // Streaming decode intentionally holds an incomplete trailing UTF-8 code
  // point instead of fabricating U+FFFD at the range boundary.
  const content = new TextDecoder().decode(
    bytes.byteLength > ARTIFACT_PREVIEW_MAX_BYTES
      ? bytes.slice(0, ARTIFACT_PREVIEW_MAX_BYTES)
      : bytes,
    { stream: truncated },
  );
  return { kind: "text", content, truncated, previewBytes, totalBytes };
}

/** Read-only conversation-files view over member threads (spec §7.4). */
export async function listProjectThreadFiles(
  projectId: string,
  params: {
    offset?: number;
    thread_limit?: number;
    file_limit?: number;
  } = {},
  options: RequestOptions = {},
): Promise<ProjectThreadFilesResponse> {
  const search = new URLSearchParams();
  if (params.offset !== undefined) {
    search.set("offset", String(params.offset));
  }
  if (params.thread_limit !== undefined) {
    search.set("thread_limit", String(params.thread_limit));
  }
  if (params.file_limit !== undefined) {
    search.set("file_limit", String(params.file_limit));
  }
  const query = search.size > 0 ? `?${search.toString()}` : "";
  const response = await fetch(projectUrl(projectId, `/thread-files${query}`), {
    method: "GET",
    signal: options.signal,
  });

  if (!response.ok) {
    throw await readProjectResponseError(
      response,
      "Failed to load thread files.",
    );
  }

  return (await response.json()) as ProjectThreadFilesResponse;
}
