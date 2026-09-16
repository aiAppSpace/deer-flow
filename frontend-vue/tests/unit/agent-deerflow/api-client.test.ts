/*
  【文件职责】     自写 REST client 的 8 个方法：URL、方法、body、错误归一化。
  【架构位置】     L3 测试
  【主要导出】     无
  【依赖关系】     @/core/api/client
  【边界与注意】   上游没有可搬的测试——被测对象在 SDK 里。所以这些断言的来源是
                   **实测的调用点**（`git show 27a425b0:frontend/src/core/threads/hooks.ts`
                   里的 9 处 `apiClient.*`）与 Gateway 的路由，不是 SDK 文档。

                   `fetchImpl` 注入而不是 mock 全局 fetch：这一层的正确性
                   ("发的是 POST 还是 GET"、"body 里有没有 signal") 只体现在
                   请求上，而 mock 全局 fetch 会把 fetcher.ts 的 CSRF 逻辑一起
                   吃掉——那是另一个模块的职责，不该在这里被间接测。
*/

import { beforeEach, describe, expect, it } from "vitest";

import { createDeerFlowApiClient } from "@/core/api/client";

const BASE = "https://example.test/api/langgraph";

interface Recorded {
  url: string;
  method: string;
  body?: string;
  hasSignal: boolean;
}

let recorded: Recorded[] = [];

const clientWith = (make: () => Response) =>
  createDeerFlowApiClient({
    baseUrl: BASE,
    fetchImpl: async (input, init) => {
      recorded.push({
        url: typeof input === "string" ? input : input.url,
        method: init?.method ?? "GET",
        ...(typeof init?.body === "string" ? { body: init.body } : {}),
        hasSignal: Boolean(init?.signal),
      });
      return make();
    },
  });

const jsonResponse = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });

beforeEach(() => {
  recorded = [];
});

describe("threads", () => {
  /*
    **`assistant_id` 不在这个体里，而且这条用例就是守这件事的。**
    后端收这颗键，但 `"lead_agent"` 正是它的默认值，`build_run_config` 的
    `if assistant_id and assistant_id != _DEFAULT_ASSISTANT_ID` 把传与不传
    变成同一件事；自定义 agent 走的是 `metadata.agent_name`。上游也不传，
    对照台账上 `POST /api/langgraph/threads` 的请求体差异就是它（wave 215）。
  */
  it("create 是 POST /threads，body 只有 thread id 与 metadata", async () => {
    const client = clientWith(() => jsonResponse({ thread_id: "draft-1" }));
    await client.threads.create({
      threadId: "draft-1",
      metadata: { agent_name: "researcher" },
    });
    expect(recorded[0]).toMatchObject({
      url: `${BASE}/threads`,
      method: "POST",
    });
    expect(JSON.parse(recorded[0]?.body ?? "{}")).toEqual({
      thread_id: "draft-1",
      metadata: { agent_name: "researcher" },
    });
  });

  it("search 是 POST /threads/search，query 进 body", async () => {
    const client = clientWith(() => jsonResponse([{ thread_id: "t-1" }]));
    const result = await client.threads.search({ limit: 1, offset: 0 });

    expect(recorded[0]).toMatchObject({
      url: `${BASE}/threads/search`,
      method: "POST",
    });
    expect(JSON.parse(recorded[0]?.body ?? "{}")).toEqual({
      limit: 1,
      offset: 0,
    });
    expect(result).toEqual([{ thread_id: "t-1" }]);
  });

  /*
    **排序键在线上叫 `sort_by`/`sort_order`，不是选项对象里的 camelCase。**
    SDK 的 `threads.search` 是逐字段搭 body 的（`client.js`:
    `sort_by: query?.sortBy`），本仓自己搭 body，那一步转换原来漏了——
    wave 44 用 parity 探针实测出来的：两个应用打同一个 Gateway，
    上游发 `sort_by,sort_order`，本仓发 `sortBy,sortOrder`。
    **对照台账看不见这一类**（只比 method + path + query）。

    今天不炸只是因为 Gateway 的 `ThreadSearchRequest` 没有排序字段，
    多余的键被 pydantic 忽略——所以断言必须钉「线上的名字」，
    不能靠「界面顺序对不对」来验，那个眼下两边都对。
  */
  it("search 把 sortBy/sortOrder 转成 wire 上的 snake_case", async () => {
    const client = clientWith(() => jsonResponse([]));
    await client.threads.search({
      limit: 20,
      sortBy: "updated_at",
      sortOrder: "desc",
    });
    const body = JSON.parse(recorded[0]?.body ?? "{}") as Record<
      string,
      unknown
    >;
    expect(body).toEqual({
      limit: 20,
      sort_by: "updated_at",
      sort_order: "desc",
    });
    // 两半都断：camelCase 一个字都不许留在线上。
    expect(Object.keys(body)).not.toContain("sortBy");
    expect(Object.keys(body)).not.toContain("sortOrder");
  });

  it("search 不发没给的排序键（上游同样是 undefined 就整键不发）", async () => {
    const client = clientWith(() => jsonResponse([]));
    await client.threads.search({ limit: 5 });
    expect(JSON.parse(recorded[0]?.body ?? "{}")).toEqual({ limit: 5 });
  });

  it("search 的 signal 是传输参数，不能混进 body", async () => {
    // 连它一起 stringify 会得到 `"signal": {}`，后端把它当成一个未知过滤字段。
    const client = clientWith(() => jsonResponse([]));
    await client.threads.search({
      limit: 1,
      signal: new AbortController().signal,
    });
    expect(JSON.parse(recorded[0]?.body ?? "{}")).toEqual({ limit: 1 });
    expect(recorded[0]?.hasSignal).toBe(true);
  });

  it("get 是 GET /threads/:id", async () => {
    const client = clientWith(() => jsonResponse({ thread_id: "t-1" }));
    await client.threads.get("t-1");
    expect(recorded[0]).toMatchObject({
      url: `${BASE}/threads/t-1`,
      method: "GET",
    });
  });

  it("getState 是 GET /threads/:id/state", async () => {
    const client = clientWith(() => jsonResponse({ values: {} }));
    await client.threads.getState("t-1");
    expect(recorded[0]).toMatchObject({
      url: `${BASE}/threads/t-1/state`,
      method: "GET",
    });
  });

  it("updateState 是 POST /threads/:id/state，带 values", async () => {
    const client = clientWith(() => new Response(null, { status: 204 }));
    await client.threads.updateState("t-1", { values: { messages: [] } });
    expect(recorded[0]).toMatchObject({
      url: `${BASE}/threads/t-1/state`,
      method: "POST",
    });
    expect(JSON.parse(recorded[0]?.body ?? "{}")).toEqual({
      values: { messages: [] },
    });
  });

  it("delete 是 DELETE /threads/:id，204 不当成失败", async () => {
    // 204 喂给 json() 会抛 SyntaxError，把「删除成功」报成失败。
    const client = clientWith(() => new Response(null, { status: 204 }));
    await expect(client.threads.delete("t-1")).resolves.toBeUndefined();
    expect(recorded[0]).toMatchObject({
      url: `${BASE}/threads/t-1`,
      method: "DELETE",
    });
  });

  it("thread id 会被 URL 编码", async () => {
    const client = clientWith(() => jsonResponse({}));
    await client.threads.get("a/b?c");
    expect(recorded[0]?.url).toBe(`${BASE}/threads/a%2Fb%3Fc`);
  });
});

describe("runs", () => {
  it("list 是 GET /threads/:id/runs", async () => {
    const client = clientWith(() => jsonResponse([]));
    await client.runs.list("t-1");
    expect(recorded[0]).toMatchObject({
      url: `${BASE}/threads/t-1/runs`,
      method: "GET",
    });
  });

  it("get 是 GET /threads/:id/runs/:runId", async () => {
    const client = clientWith(() => jsonResponse({ run_id: "r-1" }));
    await client.runs.get("t-1", "r-1");
    expect(recorded[0]).toMatchObject({
      url: `${BASE}/threads/t-1/runs/r-1`,
      method: "GET",
    });
  });
});

describe("错误归一化与前缀", () => {
  it("非 2xx 抛出 FastAPI 信封里的 detail", async () => {
    const client = clientWith(() =>
      jsonResponse({ detail: "Thread not found." }, 404),
    );
    await expect(client.threads.get("t-1")).rejects.toThrow(
      "Thread not found.",
    );
  });

  it("信封不是那个形状时退回调用方给的兜底文案", async () => {
    const client = clientWith(
      () => new Response("<html>502</html>", { status: 502 }),
    );
    await expect(client.threads.get("t-1")).rejects.toThrow(
      "Failed to load thread.",
    );
  });

  it("base URL 末尾多余的斜杠不会拼出双斜杠", async () => {
    const client = createDeerFlowApiClient({
      baseUrl: `${BASE}//`,
      fetchImpl: async (input) => {
        recorded.push({
          url: typeof input === "string" ? input : input.url,
          method: "GET",
          hasSignal: false,
        });
        return jsonResponse({});
      },
    });
    await client.threads.get("t-1");
    expect(recorded[0]?.url).toBe(`${BASE}/threads/t-1`);
  });

  it("所有 7 个方法都挂在 /api/langgraph 前缀下", async () => {
    // 02：移除的是 SDK，不是路由约定。前缀是 nginx SSE 超时与 E2E 拦截的挂载点。
    const client = clientWith(() => jsonResponse([]));
    await client.threads.search();
    await client.threads.get("t");
    await client.threads.getState("t");
    await client.threads.updateState("t", { values: {} });
    await client.threads.delete("t");
    await client.runs.list("t");
    await client.runs.get("t", "r");

    expect(recorded).toHaveLength(7);
    for (const call of recorded) {
      expect(call.url.startsWith(`${BASE}/`)).toBe(true);
    }
  });
});
