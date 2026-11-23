import { describe, expect, it } from "vitest";
import { createProjectGatewayMock } from "../../support/project-gateway-mock";

const project = { id: "p1", name: "Alpha" };
const thread = {
  thread_id: "t1",
  title: "Project chat",
  metadata: { deerflow_project_id: "p1" },
};
const request = (path: string, method = "GET", body?: unknown) =>
  new Request(`http://gateway/api/${path}`, {
    method,
    ...(body === undefined
      ? {}
      : {
          body: JSON.stringify(body),
          headers: { "content-type": "application/json" },
        }),
  });
const document = (id: string, overrides = {}) => ({
  id,
  project_id: "p1",
  name: `${id}.txt`,
  size_bytes: 5,
  content: "hello",
  ...overrides,
});

describe("stateful project Gateway mock contract", () => {
  it("persists instructions with UTF-8 byte rejection and live thread ownership", async () => {
    let threads = [thread];
    const mock = createProjectGatewayMock(
      { projects: [project], projectsConfig: { instructions_max_bytes: 6 } },
      () => threads,
    );
    expect(
      (
        await mock.handle(
          request("projects/p1", "PATCH", { instructions: "中文" }),
        )
      )?.status,
    ).toBe(200);
    expect(
      await (await mock.handle(request("projects/p1")))?.json(),
    ).toMatchObject({ instructions: "中文" });
    expect(
      (
        await mock.handle(
          request("projects/p1", "PATCH", { instructions: "中文a" }),
        )
      )?.status,
    ).toBe(422);
    threads = [];
    expect(
      await (await mock.handle(request("projects/p1/threads")))?.json(),
    ).toEqual([]);
    expect(await mock.handle(request("unrelated"))).toBeNull();
  });
  it("uploads actual bytes, deduplicates by hash, previews converted text and downloads originals", async () => {
    const mock = createProjectGatewayMock({ projects: [project] });
    const upload = async (name: string) => {
      const body = new FormData();
      body.set("file", new File(["original bytes"], name));
      return mock.handle(
        new Request("http://gateway/api/projects/p1/documents", {
          method: "POST",
          body,
        }),
      );
    };
    const first = await upload("report.docx");
    expect(first?.status).toBe(201);
    const { document: created } = await first!.json();
    expect(created).toMatchObject({
      name: "report.docx",
      size_bytes: 14,
      source_kind: "upload",
    });
    expect((await upload("same.docx"))?.status).toBe(200);
    const response = await mock.handle(
      request(`projects/p1/documents/${created.id}/content?download=true`),
    );
    expect(response?.headers.get("content-disposition")).toContain(
      'attachment; filename="report.docx"',
    );
    expect(await response?.text()).toBe("original bytes");
    const converted = createProjectGatewayMock({
      projects: [project],
      projectDocuments: [
        document("converted", {
          name: "deck.pptx",
          preview_content: "# Converted",
          preview_content_type: "text/markdown",
        }),
      ],
    });
    expect(
      await (
        await converted.handle(
          request("projects/p1/documents/converted/content"),
        )
      )?.text(),
    ).toBe("# Converted");
    expect(
      await (
        await converted.handle(
          request("projects/p1/documents/converted/content?download=1"),
        )
      )?.text(),
    ).toBe("hello");
  });
  it("trashes, restores and purges without returning internal project or trash fields on shelf", async () => {
    const mock = createProjectGatewayMock({
      projects: [project],
      projectDocuments: [document("d1")],
    });
    expect(
      (await mock.handle(request("projects/p1/documents/d1", "DELETE")))
        ?.status,
    ).toBe(204);
    expect(
      await (await mock.handle(request("projects/p1/documents")))?.json(),
    ).toMatchObject({ documents: [], total: 0 });
    expect(
      await (await mock.handle(request("trash/documents")))?.json(),
    ).toMatchObject({
      documents: [
        { trash_origin: { project_id: "p1", project_name: "Alpha" } },
      ],
    });
    const result = await (
      await mock.handle(request("trash/documents/d1/restore", "POST", {}))
    )?.json();
    expect(result.outcome).toBe("restored");
    expect(result.document).not.toHaveProperty("project_id");
    expect(result.document).not.toHaveProperty("trashed_at");
    await mock.handle(request("projects/p1/documents/d1", "DELETE"));
    expect(
      (await mock.handle(request("trash/documents/d1/purge", "POST")))?.status,
    ).toBe(204);
    expect(
      (await mock.handle(request("trash/documents/d1/restore", "POST", {})))
        ?.status,
    ).toBe(404);
  });
  it("requires an active restore target, retains missing-content rows and merges identical bytes", async () => {
    const trashed = {
      ...document("lost"),
      trashed_at: new Date().toISOString(),
      trash_origin: { project_id: "gone", project_name: "Gone" },
    };
    const mock = createProjectGatewayMock({
      projects: [project, { id: "archived", name: "Old", status: "archived" }],
      trashDocuments: [trashed],
    });
    expect(
      (await mock.handle(request("trash/documents/lost/restore", "POST", {})))
        ?.status,
    ).toBe(404);
    expect(
      (
        await mock.handle(
          request("trash/documents/lost/restore", "POST", {
            project_id: "archived",
          }),
        )
      )?.status,
    ).toBe(404);
    expect(
      (
        await mock.handle(
          request("trash/documents/lost/restore", "POST", { project_id: "p1" }),
        )
      )?.status,
    ).toBe(200);
    const missing = createProjectGatewayMock({
      projects: [project],
      trashDocuments: [{ ...trashed, content_missing: true }],
    });
    expect(
      (
        await missing.handle(
          request("trash/documents/lost/restore", "POST", { project_id: "p1" }),
        )
      )?.status,
    ).toBe(409);
    expect(
      await (await missing.handle(request("trash/documents")))?.json(),
    ).toMatchObject({ total: 1 });
    const merged = createProjectGatewayMock({
      projects: [project],
      projectDocuments: [document("survivor")],
      trashDocuments: [trashed],
    });
    expect(
      await (
        await merged.handle(
          request("trash/documents/lost/restore", "POST", { project_id: "p1" }),
        )
      )?.json(),
    ).toMatchObject({ outcome: "merged", document: { id: "survivor" } });
  });
  it("rejects archived shelf writes, permits reading/attaching and claims unique thread filenames", async () => {
    const mock = createProjectGatewayMock(
      {
        projects: [{ ...project, status: "archived" }],
        projectDocuments: [document("d1")],
        threadFileGroups: [
          {
            thread_id: "t1",
            display_name: "Project chat",
            updated_at: "2026-01-01",
            files: [
              {
                name: "d1.txt",
                kind: "upload",
                content: "old",
                size_bytes: 3,
                modified_at: "2026-01-01",
                artifact_url: "/old",
              },
            ],
          },
        ],
      },
      () => [thread],
    );
    expect(
      (await mock.handle(request("projects/p1/documents/d1", "DELETE")))
        ?.status,
    ).toBe(404);
    expect(
      (
        await mock.handle(
          request("projects/p1/documents/from-thread", "POST", {
            thread_id: "t1",
            kind: "upload",
            name: "d1.txt",
          }),
        )
      )?.status,
    ).toBe(404);
    expect(
      await (
        await mock.handle(
          request("projects/p1/documents/d1/attach-to-thread/t1", "POST"),
        )
      )?.json(),
    ).toMatchObject({ filename: "d1_1.txt" });
    expect(
      (await mock.handle(request("projects/p1/documents/d1/content")))?.status,
    ).toBe(200);
  });
  it("paginates shelf/trash and keeps failed/remaining rows after partial empty-trash failure", async () => {
    const docs = Array.from({ length: 120 }, (_, i) => document(`d${i}`));
    const mock = createProjectGatewayMock({
      projects: [project],
      projectDocuments: docs,
      trashDocuments: docs
        .slice(0, 3)
        .map((d) => ({ ...d, trashed_at: new Date().toISOString() })),
      trashPurgeFailureIds: ["d1"],
    });
    expect(
      await (
        await mock.handle(request("projects/p1/documents?limit=100&offset=100"))
      )?.json(),
    ).toMatchObject({ total: 120, offset: 100, documents: expect.any(Array) });
    expect(
      (
        await (await mock.handle(
          request("projects/p1/documents?limit=100&offset=100"),
        ))!.json()
      ).documents,
    ).toHaveLength(20);
    expect((await mock.handle(request("trash/purge", "POST")))?.status).toBe(
      500,
    );
    expect(
      (
        await (await mock.handle(request("trash/documents")))!.json()
      ).documents.map((d: { id: string }) => d.id),
    ).toEqual(["d1", "d2"]);
  });
  it("paginates active member threads and bounds each conversation file group", async () => {
    const threads = Array.from({ length: 3 }, (_, i) => ({
      ...thread,
      thread_id: `t${i}`,
    }));
    const groups = threads.map((t) => ({
      thread_id: t.thread_id,
      display_name: t.thread_id,
      updated_at: "2026-01-01",
      files: Array.from({ length: 3 }, (_, i) => ({
        kind: "output" as const,
        name: `${i}.txt`,
        size_bytes: 1,
        modified_at: "2026-01-01",
        artifact_url: "/artifact",
      })),
    }));
    const mock = createProjectGatewayMock(
      { projects: [project], threadFileGroups: groups },
      () => threads,
    );
    expect(
      await (await mock.handle(
        request("projects/p1/threads?limit=1&offset=1"),
      ))!.json(),
    ).toMatchObject([{ thread_id: "t1" }]);
    const response = await (await mock.handle(
      request("projects/p1/thread-files?thread_limit=1&file_limit=2&offset=1"),
    ))!.json();
    expect(response).toMatchObject({
      next_offset: 2,
      truncated: true,
      groups: [{ thread_id: "t1", truncated: true }],
    });
    expect(response.groups[0].files).toHaveLength(2);
  });
});
