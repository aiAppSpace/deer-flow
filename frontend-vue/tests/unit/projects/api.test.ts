/*
  【文件职责】     钉住项目 API 的 HTTP method/path/query/body/error 合同。
  【架构位置】     API contract test
  【主要导出】     无；Vitest cases
  【依赖关系】     core/projects/api · mocked fetcher
  【边界与注意】   合同以 `backend/app/gateway/routers/projects.py` 为准：
                   归档/恢复是 POST 子资源而不是 PATCH status；DELETE 返回 204 无正文；
                   列表响应**包了一层 `projects`**。这几条一旦被改成「更顺手」的形状，
                   前端会安静地拿到 undefined，所以在这里逐条钉死。
*/
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetch } from "@/core/api/fetcher";
import {
  archiveProject,
  createProject,
  deleteProject,
  getProject,
  listProjectThreads,
  listProjects,
  patchProject,
  restoreProject,
} from "@/core/projects/api";

vi.mock("@/core/api/fetcher", () => ({ fetch: vi.fn() }));

const mockedFetch = vi.mocked(fetch);

const PROJECT = {
  id: "p-1",
  name: "Launch plan",
  instructions: "",
  presentation: {},
  status: "active" as const,
  created_at: "2026-07-01T00:00:00+00:00",
  updated_at: "2026-07-01T00:00:00+00:00",
};

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

function call(index = 0) {
  const [url, init] = mockedFetch.mock.calls[index] ?? [];
  return { url: String(url), init };
}

describe("project API 合同", () => {
  beforeEach(() => mockedFetch.mockReset());

  it("列表解开 `projects` 包装，并把 status 作为查询参数", async () => {
    const signal = new AbortController().signal;
    mockedFetch.mockResolvedValueOnce(response({ projects: [PROJECT] }));

    const projects = await listProjects("archived", { signal });

    expect(call().url).toContain("/api/projects?status=archived");
    expect(call().init?.signal).toBe(signal);
    // 拿到的是数组本身，不是 { projects: [...] }。
    expect(projects).toEqual([PROJECT]);
  });

  it("不传 status 时不带查询参数——省略在 Gateway 是「全部」", async () => {
    mockedFetch.mockResolvedValueOnce(response({ projects: [] }));

    await listProjects();

    expect(call().url).toMatch(/\/api\/projects$/);
  });

  it("路径里的 id 做百分号编码", async () => {
    mockedFetch.mockResolvedValueOnce(response(PROJECT));

    await getProject("p / 1");

    expect(call().url).toContain("/api/projects/p%20%2F%201");
  });

  it("创建时把缺省的 instructions/presentation 补成空值而不是省略", async () => {
    mockedFetch.mockResolvedValueOnce(response(PROJECT, 201));

    await createProject({ name: "Launch plan" });

    expect(call().init?.method).toBe("POST");
    expect(JSON.parse(String(call().init?.body))).toEqual({
      name: "Launch plan",
      instructions: "",
      presentation: {},
    });
  });

  it("PATCH 只发显式给出的字段", async () => {
    mockedFetch.mockResolvedValueOnce(response(PROJECT));

    await patchProject("p-1", { name: "Renamed" });

    expect(call().init?.method).toBe("PATCH");
    expect(JSON.parse(String(call().init?.body))).toEqual({ name: "Renamed" });
  });

  it("归档与恢复是 POST 子资源，不是 PATCH status", async () => {
    mockedFetch.mockResolvedValueOnce(
      response({ ...PROJECT, status: "archived" }),
    );
    await archiveProject("p-1");
    expect(call().url).toContain("/api/projects/p-1/archive");
    expect(call().init?.method).toBe("POST");

    mockedFetch.mockResolvedValueOnce(response(PROJECT));
    await restoreProject("p-1");
    expect(call(1).url).toContain("/api/projects/p-1/restore");
    expect(call(1).init?.method).toBe("POST");
  });

  it("删除走 DELETE，且不去读 204 的空正文", async () => {
    const noBody = {
      ok: true,
      status: 204,
      statusText: "No Content",
      json: async () => {
        throw new Error("204 没有正文可读");
      },
      text: async () => "",
    } as unknown as Response;
    mockedFetch.mockResolvedValueOnce(noBody);

    await expect(deleteProject("p-1")).resolves.toBeUndefined();
    expect(call().init?.method).toBe("DELETE");
  });

  it("项目内会话列表走 limit/offset 分页", async () => {
    mockedFetch.mockResolvedValueOnce(response([]));

    await listProjectThreads("p-1", { limit: 25, offset: 50 });

    expect(call().url).toContain(
      "/api/projects/p-1/threads?limit=25&offset=50",
    );
  });

  it("不给分页参数时不带问号", async () => {
    mockedFetch.mockResolvedValueOnce(response([]));

    await listProjectThreads("p-1");

    expect(call().url).toMatch(/\/threads$/);
  });

  it("失败时抛出带 Gateway detail 的错误，而不是返回 undefined", async () => {
    mockedFetch.mockResolvedValueOnce(
      response({ detail: "Project not found" }, 404),
    );

    await expect(getProject("missing")).rejects.toThrow(/Project not found/);
  });
});
