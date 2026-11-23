/* Framework-neutral, stateful HTTP fixtures for backend project_documents.py,
 * projects.py and trash.py. Original bytes and preview companions are separate;
 * archived/missing targets fail closed and partial purges retain remaining rows. */
import { createHash } from "node:crypto";
import type { Page, Route } from "@playwright/test";

export type MockProject = {
  id: string;
  name: string;
  instructions?: string;
  presentation?: Record<string, unknown>;
  status?: "active" | "archived";
  created_at?: string;
  updated_at?: string;
};
export type MockProjectDocument = {
  id: string;
  project_id: string;
  name: string;
  size_bytes: number;
  sha256?: string;
  content_missing?: boolean;
  source_thread_id?: string | null;
  source_kind?: "upload" | "output" | null;
  source_name?: string | null;
  created_at?: string;
  updated_at?: string;
  content?: string;
  content_type?: string;
  preview_content?: string;
  preview_content_type?: string;
};
export type MockTrashDocument = MockProjectDocument & {
  trashed_at: string;
  trash_origin?: { project_id: string; project_name: string } | null;
};
export type MockThreadFileGroup = {
  thread_id: string;
  display_name: string;
  updated_at: string;
  files: {
    kind: "upload" | "output";
    name: string;
    size_bytes: number;
    modified_at: string;
    artifact_url: string;
    content?: string;
  }[];
  truncated?: boolean;
};
export type ProjectMockOptions = {
  projects?: MockProject[];
  projectsConfig?: {
    instructions_max_bytes?: number;
    trash_retention_days?: number;
  };
  projectDocuments?: MockProjectDocument[];
  trashDocuments?: MockTrashDocument[];
  threadFileGroups?: MockThreadFileGroup[];
  trashPurgeFailureIds?: string[];
};
type Thread = {
  thread_id: string;
  title?: string;
  updated_at?: string;
  metadata?: Record<string, unknown>;
};
const epoch = "2026-01-01T00:00:00Z";
const hash = (content: string | Uint8Array) =>
  createHash("sha256").update(content).digest("hex");
const json = (status: number, body: unknown) => Response.json(body, { status });
const error = (status: number, detail: string) => json(status, { detail });
const normalize = (p: MockProject) => ({
  ...p,
  instructions: p.instructions ?? "",
  presentation: p.presentation ?? {},
  status: p.status ?? "active",
  created_at: p.created_at ?? epoch,
  updated_at: p.updated_at ?? epoch,
});
const documentResponse = (d: MockProjectDocument) => ({
  id: d.id,
  name: d.name,
  size_bytes: d.size_bytes,
  sha256: d.sha256 ?? hash(d.content ?? `mock content of ${d.name}`),
  content_missing: d.content_missing ?? false,
  source_thread_id: d.source_thread_id ?? null,
  source_kind: d.source_kind ?? null,
  source_name: d.source_name ?? null,
  created_at: d.created_at ?? epoch,
  updated_at: d.updated_at ?? epoch,
});

export function createProjectGatewayMock(
  options: ProjectMockOptions = {},
  getThreads: () => readonly Thread[] = () => [],
) {
  let projects = (options.projects ?? []).map(normalize);
  let documents = structuredClone(options.projectDocuments ?? []);
  let trash = structuredClone(options.trashDocuments ?? []);
  const groups = structuredClone(options.threadFileGroups ?? []);
  const originals = new Map<string, Uint8Array>();
  const attachments = new Map<string, Set<string>>();
  let sequence = 0;
  const nextId = () =>
    `80000000-0000-0000-0000-${String(++sequence).padStart(12, "0")}`;
  const config = {
    instructions_max_bytes:
      options.projectsConfig?.instructions_max_bytes ?? 8192,
    trash_retention_days: options.projectsConfig?.trash_retention_days ?? 30,
  };
  const findProject = (id: string) => projects.find((p) => p.id === id);
  const active = (id: string) => findProject(id)?.status === "active";
  const page = (rows: unknown[], url: URL) => {
    const limit = Number(url.searchParams.get("limit") ?? 100),
      offset = Number(url.searchParams.get("offset") ?? 0);
    return !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 1000 ||
      !Number.isInteger(offset) ||
      offset < 0
      ? error(422, "Invalid pagination")
      : json(200, {
          documents: rows.slice(offset, offset + limit),
          total: rows.length,
          limit,
          offset,
        });
  };
  function add(document: MockProjectDocument, bytes: Uint8Array) {
    const digest = hash(bytes);
    const existing = documents.find(
      (d) =>
        d.project_id === document.project_id &&
        documentResponse(d).sha256 === digest,
    );
    if (existing)
      return json(200, {
        document: documentResponse(existing),
        deduplicated: true,
      });
    const created = { ...document, sha256: digest, size_bytes: bytes.length };
    documents = [...documents, created];
    originals.set(created.id, bytes);
    return json(201, {
      document: documentResponse(created),
      deduplicated: false,
    });
  }
  async function handle(request: Request): Promise<Response | null> {
    const url = new URL(request.url),
      method = request.method;
    const parts = url.pathname
      .replace(/^\/api\//, "")
      .split("/")
      .map(decodeURIComponent);
    if (parts[0] !== "projects" && parts[0] !== "trash") return null;
    const body = async () => request.json() as Promise<Record<string, unknown>>;
    if (parts[0] === "projects") {
      if (parts.length === 1) {
        if (method === "GET")
          return json(200, {
            projects: projects.filter(
              (p) =>
                !url.searchParams.has("status") ||
                p.status === url.searchParams.get("status"),
            ),
          });
        if (method === "POST") {
          const input = await body();
          const name = String(input.name ?? "");
          const instructions = String(input.instructions ?? "");
          if (
            !name ||
            name.length > 128 ||
            Buffer.byteLength(instructions) > config.instructions_max_bytes
          )
            return error(422, "Invalid project input");
          const p = normalize({
            id: nextId(),
            name,
            instructions,
            presentation: (input.presentation as Record<string, unknown>) ?? {},
          });
          projects.push(p);
          return json(201, p);
        }
        return null;
      }
      const projectId = parts[1]!;
      if (projectId === "config" && method === "GET") return json(200, config);
      const project = findProject(projectId);
      if (!project) return error(404, "Project not found");
      if (parts.length === 2) {
        if (method === "GET") return json(200, project);
        if (method === "PATCH") {
          const input = await body();
          if (
            typeof input.instructions === "string" &&
            Buffer.byteLength(input.instructions) >
              config.instructions_max_bytes
          )
            return error(
              422,
              `instructions exceeds the configured ${config.instructions_max_bytes}-byte UTF-8 limit`,
            );
          if (
            input.name !== undefined &&
            (typeof input.name !== "string" ||
              !input.name.length ||
              input.name.length > 128)
          )
            return error(422, "Invalid project name");
          Object.assign(
            project,
            Object.fromEntries(
              Object.entries(input).filter(
                ([k, v]) =>
                  ["name", "instructions", "presentation"].includes(k) &&
                  v !== null,
              ),
            ),
            { updated_at: new Date().toISOString() },
          );
          return json(200, project);
        }
        if (method === "DELETE") {
          const owned = documents.filter((d) => d.project_id === projectId);
          for (const d of owned)
            trash.push({
              ...d,
              trashed_at: new Date().toISOString(),
              trash_origin: {
                project_id: projectId,
                project_name: project.name,
              },
            });
          documents = documents.filter((d) => d.project_id !== projectId);
          projects = projects.filter((p) => p.id !== projectId);
          return new Response(null, { status: 204 });
        }
        return null;
      }
      if (["archive", "restore"].includes(parts[2]!) && method === "POST") {
        project.status = parts[2] === "archive" ? "archived" : "active";
        return json(200, project);
      }
      if (parts[2] === "threads" && method === "GET")
        return json(
          200,
          getThreads()
            .filter(
              (t) =>
                t.metadata?.deerflow_project_id === projectId &&
                !t.metadata?.deerflow_archived,
            )
            .slice(
              Number(url.searchParams.get("offset") ?? 0),
              Number(url.searchParams.get("offset") ?? 0) +
                Number(url.searchParams.get("limit") ?? 100),
            )
            .map((t) => ({
              thread_id: t.thread_id,
              display_name: t.title ?? null,
              metadata: t.metadata ?? {},
              created_at: epoch,
              updated_at: t.updated_at ?? epoch,
            })),
        );
      if (parts[2] === "thread-files" && method === "GET") {
        const members = getThreads().filter(
          (t) =>
            t.metadata?.deerflow_project_id === projectId &&
            t.metadata?.deerflow_archived !== true,
        );
        const offset = Number(url.searchParams.get("offset") ?? 0);
        const limit = Number(url.searchParams.get("thread_limit") ?? 20);
        const fileLimit = Number(url.searchParams.get("file_limit") ?? 50);
        if (
          ![offset, limit, fileLimit].every(Number.isInteger) ||
          offset < 0 ||
          limit < 1 ||
          limit > 50 ||
          fileLimit < 1 ||
          fileLimit > 200
        )
          return error(422, "Invalid pagination");
        const result = members.slice(offset, offset + limit).map((t) => {
          const group = groups.find((g) => g.thread_id === t.thread_id);
          return {
            thread_id: t.thread_id,
            display_name: group?.display_name ?? t.title ?? null,
            updated_at: group?.updated_at ?? t.updated_at ?? epoch,
            files: (group?.files ?? []).slice(0, fileLimit).map((f) => ({
              kind: f.kind,
              name: f.name,
              size_bytes: f.size_bytes,
              modified_at: f.modified_at,
              artifact_url: f.artifact_url,
            })),
            truncated:
              group?.truncated === true ||
              (group?.files.length ?? 0) > fileLimit,
          };
        });
        return json(200, {
          groups: result,
          next_offset: offset + limit < members.length ? offset + limit : null,
          truncated: result.some((g) => g.truncated),
        });
      }
      if (parts[2] !== "documents") return null;
      if (parts.length === 3) {
        if (method === "GET")
          return page(
            documents
              .filter((d) => d.project_id === projectId)
              .map(documentResponse),
            url,
          );
        if (method === "POST") {
          if (!active(projectId))
            return error(404, "Project document not found");
          const form = await request.formData();
          const file = form.get("file");
          if (!(file instanceof File)) return error(422, "file is required");
          const name = String(form.get("name") ?? file.name);
          if (!name || /[\\/]/.test(name) || Buffer.byteLength(name) > 255)
            return error(400, "Invalid filename");
          const bytes = new Uint8Array(await file.arrayBuffer());
          if (!bytes.length) return error(400, "Empty file");
          return add(
            {
              id: nextId(),
              project_id: projectId,
              name,
              size_bytes: bytes.length,
              content_type: file.type || "application/octet-stream",
              source_kind: "upload",
            },
            bytes,
          );
        }
        return null;
      }
      if (parts[3] === "from-thread" && method === "POST") {
        const input = await body();
        const group = groups.find((g) => g.thread_id === input.thread_id);
        const source = group?.files.find(
          (f) => f.kind === input.kind && f.name === input.name,
        );
        if (
          !active(projectId) ||
          !source ||
          !getThreads().some((t) => t.thread_id === input.thread_id)
        )
          return error(404, "Project document not found");
        const name = String(input.shelf_name ?? source.name);
        if (!name || /[\\/]/.test(name) || Buffer.byteLength(name) > 255)
          return error(400, "Invalid filename");
        return add(
          {
            id: nextId(),
            project_id: projectId,
            name,
            size_bytes: source.size_bytes,
            source_thread_id: group!.thread_id,
            source_kind: source.kind,
            source_name: source.name,
          },
          new TextEncoder().encode(
            source.content ?? `mock content of ${source.name}`,
          ),
        );
      }
      const documentId = parts[3]!;
      const d = documents.find(
        (d) => d.id === documentId && d.project_id === projectId,
      );
      if (!d) return error(404, "Project document not found");
      if (parts[4] === "content" && method === "GET") {
        if (d.content_missing) return error(409, "content_missing");
        const download = ["1", "true"].includes(
          url.searchParams.get("download") ?? "",
        );
        const converted = !download && d.preview_content !== undefined;
        const content = converted
          ? d.preview_content!
          : (originals.get(d.id) ?? d.content ?? `mock content of ${d.name}`);
        const mime = converted
          ? (d.preview_content_type ?? "text/markdown")
          : (d.content_type ?? "text/plain");
        const name = converted ? `${d.name}.md` : d.name;
        const inline = !download && !/(html|xml|svg)/i.test(mime);
        return new Response(content as BodyInit, {
          headers: {
            "content-type": mime,
            "content-disposition": `${inline ? "inline" : "attachment"}; filename="${name.replaceAll('"', "")}"`,
            "x-content-type-options": "nosniff",
          },
        });
      }
      if (parts[4] === "attach-to-thread" && method === "POST") {
        const threadId = parts[5]!;
        if (!getThreads().some((t) => t.thread_id === threadId))
          return error(404, "Project document not found");
        if (d.content_missing) return error(409, "content_missing");
        const used =
          attachments.get(threadId) ??
          new Set(
            groups
              .filter((g) => g.thread_id === threadId)
              .flatMap((g) =>
                g.files.filter((f) => f.kind === "upload").map((f) => f.name),
              ),
          );
        let filename = d.name;
        const dot = d.name.lastIndexOf(".");
        const stem = dot > 0 ? d.name.slice(0, dot) : d.name,
          ext = dot > 0 ? d.name.slice(dot) : "";
        for (let i = 1; used.has(filename); i++)
          filename = `${stem}_${i}${ext}`;
        used.add(filename);
        attachments.set(threadId, used);
        return json(200, {
          filename,
          size_bytes: d.size_bytes,
          virtual_path: `/mnt/user-data/uploads/${filename}`,
          artifact_url: `/api/threads/${threadId}/artifacts/mnt/user-data/uploads/${encodeURIComponent(filename)}`,
        });
      }
      if (parts.length === 4 && method === "DELETE") {
        if (!active(projectId)) return error(404, "Project document not found");
        documents = documents.filter((c) => c.id !== documentId);
        trash.unshift({
          ...d,
          trashed_at: new Date().toISOString(),
          trash_origin: { project_id: projectId, project_name: project.name },
        });
        return new Response(null, { status: 204 });
      }
      return null;
    }
    if (parts[1] === "documents" && parts.length === 2 && method === "GET")
      return page(
        trash.map((d) => {
          const { content_missing: _missing, ...row } = documentResponse(d);
          return {
            ...row,
            trashed_at: d.trashed_at,
            trash_origin: d.trash_origin ?? null,
          };
        }),
        url,
      );
    if (parts[1] === "purge" && method === "POST") {
      let purged = 0;
      for (const d of [...trash]) {
        if (options.trashPurgeFailureIds?.includes(d.id))
          return error(
            500,
            "Purge failed during file cleanup; the remaining documents stay in trash and the purge can be retried",
          );
        trash = trash.filter((c) => c.id !== d.id);
        originals.delete(d.id);
        purged++;
      }
      return json(200, { purged });
    }
    if (parts[1] !== "documents" || method !== "POST") return null;
    const d = trash.find((d) => d.id === parts[2]);
    if (!d) return error(404, "Trash document not found");
    if (parts[3] === "purge") {
      if (options.trashPurgeFailureIds?.includes(d.id))
        return error(
          500,
          "Purge failed during file cleanup; the document remains in trash and the purge can be retried",
        );
      trash = trash.filter((c) => c.id !== d.id);
      originals.delete(d.id);
      return new Response(null, { status: 204 });
    }
    if (parts[3] === "restore") {
      const input = await body().catch(() => ({}) as Record<string, unknown>);
      const target =
        typeof input.project_id === "string"
          ? input.project_id
          : d.trash_origin?.project_id;
      if (!target || !active(target))
        return error(404, "Trash document not found");
      if (d.content_missing) return error(409, "content_missing");
      const existing = documents.find(
        (c) =>
          c.project_id === target &&
          documentResponse(c).sha256 === documentResponse(d).sha256,
      );
      const restored = existing ?? { ...d, project_id: target };
      if (!existing) documents.push(restored);
      trash = trash.filter((c) => c.id !== d.id);
      return json(200, {
        outcome: existing ? "merged" : "restored",
        document: documentResponse(restored),
      });
    }
    return null;
  }
  return { handle, canAssignProject: active };
}

export function installProjectGatewayMock(
  page: Page,
  options: ProjectMockOptions,
  getThreads: () => readonly Thread[],
) {
  const gateway = createProjectGatewayMock(options, getThreads);
  const handleRoute = async (route: Route) => {
    const req = route.request();
    const payload = req.postDataBuffer();
    const result = await gateway.handle(
      new Request(req.url(), {
        method: req.method(),
        headers: req.headers(),
        ...(["GET", "HEAD"].includes(req.method())
          ? {}
          : { body: payload ? Uint8Array.from(payload).buffer : null }),
      }),
    );
    if (!result) return route.fallback();
    return route.fulfill({
      status: result.status,
      headers: Object.fromEntries(result.headers),
      body: Buffer.from(await result.arrayBuffer()),
    });
  };
  void page.route(/\/api\/(?:projects|trash)(?:\/|\?|$)/, handleRoute);
  // A target=_blank original download starts a popup navigation. Page.route
  // cannot intercept its first request; the same state owner must serve it at
  // BrowserContext level as well. Page-specific overrides still take precedence.
  void page
    .context()
    .route(
      /\/api\/projects\/[^/]+\/documents\/[^/]+\/content(?:\?|$)/,
      handleRoute,
    );
  return gateway;
}
