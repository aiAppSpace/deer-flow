import { beforeEach, expect, it, vi } from "vitest";
import { fetch } from "@/core/api/fetcher";
import {
  attachProjectDocument,
  fetchProjectDocumentPreview,
  listProjectDocuments,
  listProjectThreadFiles,
  promoteThreadFile,
  ProjectDocumentContentMissingError,
  uploadProjectDocument,
  urlOfProjectDocumentContent,
} from "@/core/projects/api";
import {
  emptyTrash,
  listTrashDocuments,
  restoreTrashDocument,
  RestoreConflictError,
  TrashNotFoundError,
} from "@/core/trash";
import { ARTIFACT_PREVIEW_MAX_BYTES } from "@/core/artifacts/loader";
vi.mock("@/core/api/fetcher", () => ({ fetch: vi.fn() }));
const request = vi.mocked(fetch);
beforeEach(() => request.mockReset());
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

it("keeps preview and original download endpoints distinct, requests a bounded range, and passes cancellation", async () => {
  const signal = new AbortController().signal;
  request.mockResolvedValue(
    new Response("# converted", {
      headers: { "Content-Type": "text/markdown; charset=utf-8" },
    }),
  );
  await expect(
    fetchProjectDocumentPreview("p / 1", "d/2", { signal }),
  ).resolves.toMatchObject({
    kind: "text",
    content: "# converted",
    truncated: false,
  });
  expect(request.mock.calls[0]![0]).toContain(
    "/p%20%2F%201/documents/d%2F2/content",
  );
  expect(request.mock.calls[0]![1]).toMatchObject({
    signal,
    headers: { Range: "bytes=0-1048575" },
  });
  expect(urlOfProjectDocumentContent("p", "d", { download: true })).toMatch(
    /\/d\/content\?download=true$/,
  );
});

it.each([
  ["application/pdf", "pdf"],
  ["image/png", "binary"],
  [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "unsupported",
  ],
])("never text-decodes %s preview bytes", async (contentType, kind) => {
  const response = new Response("binary", {
    headers: { "Content-Type": contentType },
  });
  const decode = vi.spyOn(response, "arrayBuffer");
  const cancel = vi.spyOn(response.body!, "cancel");
  request.mockResolvedValue(response);
  await expect(fetchProjectDocumentPreview("p", "d")).resolves.toEqual({
    kind,
  });
  expect(decode).not.toHaveBeenCalled();
  expect(cancel).toHaveBeenCalledOnce();
});

it("bounds a 200 body even when the server ignores Range and cancels the remaining stream", async () => {
  let pulls = 0;
  const cancel = vi.fn();
  const chunk = new Uint8Array(ARTIFACT_PREVIEW_MAX_BYTES).fill(65);
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulls++;
      if (pulls > 4) controller.close();
      else controller.enqueue(chunk);
    },
    cancel,
  });
  request.mockResolvedValue(
    new Response(body, { headers: { "Content-Type": "text/plain" } }),
  );
  const result = await fetchProjectDocumentPreview("p", "d");
  expect(result).toMatchObject({
    kind: "text",
    truncated: true,
    previewBytes: ARTIFACT_PREVIEW_MAX_BYTES,
  });
  expect(cancel).toHaveBeenCalledOnce();
  expect(pulls).toBeLessThanOrEqual(3);
});

it("holds an incomplete trailing UTF-8 code point in a truncated response", async () => {
  request.mockResolvedValue(
    new Response(new Uint8Array([65, 0xe4, 0xb8]), {
      status: 206,
      headers: { "Content-Type": "text/plain", "Content-Range": "bytes 0-2/9" },
    }),
  );
  await expect(fetchProjectDocumentPreview("p", "d")).resolves.toMatchObject({
    content: "A",
    truncated: true,
    totalBytes: 9,
  });
});

it("uses backend member-thread cursors and exact promote/attach/upload bodies", async () => {
  request.mockResolvedValue(
    json({ groups: [], next_offset: 23, truncated: true }),
  );
  const result = await listProjectThreadFiles("p", {
    offset: 11,
    file_limit: 200,
  });
  expect(result.next_offset).toBe(23);
  expect(String(request.mock.calls[0]![0])).toContain(
    "offset=11&file_limit=200",
  );
  request
    .mockResolvedValueOnce(json({}))
    .mockResolvedValueOnce(json({}))
    .mockResolvedValueOnce(json({}));
  await promoteThreadFile("p", {
    thread_id: "t",
    kind: "output",
    name: "a.csv",
    shelf_name: "renamed.csv",
  });
  expect(JSON.parse(String(request.mock.calls[1]![1]?.body))).toEqual({
    thread_id: "t",
    kind: "output",
    name: "a.csv",
    shelf_name: "renamed.csv",
  });
  await attachProjectDocument("p", "d", "t");
  expect(String(request.mock.calls[2]![0])).toContain(
    "/documents/d/attach-to-thread/t",
  );
  const file = new File(["x"], "a.txt");
  await uploadProjectDocument("p", { file });
  expect(
    (request.mock.calls[3]![1]?.body as FormData).get("file"),
  ).toBeInstanceOf(File);
});

it("surfaces permission denials and indistinguishable foreign-resource 404s", async () => {
  request.mockResolvedValue(json({ detail: "Permission denied" }, 403));
  await expect(listProjectDocuments("p")).rejects.toThrow("Permission denied");
  request.mockResolvedValue(json({ detail: "Project not found" }, 404));
  await expect(attachProjectDocument("foreign", "d", "t")).rejects.toThrow(
    "Project not found",
  );
  request.mockResolvedValue(json({ detail: "content_missing" }, 409));
  await expect(fetchProjectDocumentPreview("p", "d")).rejects.toBeInstanceOf(
    ProjectDocumentContentMissingError,
  );
});

it("distinguishes missing-target restore, damaged-content conflict, and partial purge failure", async () => {
  request.mockResolvedValue(json({ detail: "gone" }, 404));
  await expect(restoreTrashDocument("d")).rejects.toBeInstanceOf(
    TrashNotFoundError,
  );
  request.mockResolvedValue(json({ detail: "content_missing" }, 409));
  await expect(
    restoreTrashDocument("d", { projectId: "p" }),
  ).rejects.toBeInstanceOf(RestoreConflictError);
  request.mockResolvedValue(json({ detail: "partial cleanup" }, 500));
  await expect(emptyTrash()).rejects.toThrow("partial cleanup");
  expect(request.mock.calls[2]![1]?.body).toBeUndefined();
  const signal = new AbortController().signal;
  request.mockResolvedValue(
    json({ documents: [], total: 0, limit: 100, offset: 0 }),
  );
  await listTrashDocuments({ limit: 100, offset: 100 }, { signal });
  expect(request.mock.calls[3]![1]?.signal).toBe(signal);
});
