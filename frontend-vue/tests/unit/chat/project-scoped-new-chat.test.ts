/*
  【文件职责】     固定「从项目里新建会话」的归属时机与失败处置。
  【架构位置】     测试
  【依赖关系】     app/components/chat/AgentChat.vue · app/core/threads/api.ts
  【边界与注意】   守的是**顺序**：归属必须发生在消息发出去之前。顺序反了，
                   会话会先落在项目外面，而用户是从项目里点进来的。

                   AgentChat 是两千多行、依赖整条流式链的组件，本仓从来没有
                   挂载它的用例（其余九个 AgentChat 用例全是源码守卫）。所以
                   这里同样钉源码，另一半用真单测钉 `createThread` 的请求形状——
                   顺序与请求体各有一份证据，而不是靠读代码相信。
*/

import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ fetchWithAuth: vi.fn() }));
vi.mock("@/core/api/fetcher", () => ({ fetch: mocks.fetchWithAuth }));

import { createThread } from "@/core/threads/api";

/** 注释先剥掉：下面钉的每一条在文件里都同时出现在解释它的注释里。 */
const agentChat = readFileSync("app/components/chat/AgentChat.vue", "utf8")
  .replaceAll(/<!--[\s\S]*?-->/g, "")
  .replaceAll(/\/\*[\s\S]*?\*\//g, "");

afterEach(() => {
  mocks.fetchWithAuth.mockReset();
});

describe("从项目里新建会话", () => {
  it("先归属到项目，再发消息", () => {
    const ensure = agentChat.indexOf("await ensureProjectMembership(");
    const create = agentChat.indexOf(
      "const targetThreadId = await ensureThread()",
    );
    const send = agentChat.indexOf("await stream.sendMessage(");
    expect(create).toBeGreaterThan(-1);
    expect(ensure).toBeGreaterThan(create);
    expect(send).toBeGreaterThan(ensure);
  });

  it("归属失败就不发这条消息", () => {
    const start = agentChat.indexOf("async function ensureProjectMembership(");
    expect(start).toBeGreaterThan(-1);
    const body = agentChat.slice(start, agentChat.indexOf("\n}", start));
    // 报一句话给用户，然后抛出——吞掉异常就等于「悄悄发到项目外面」。
    expect(body).toContain("projects.projectUnavailable");
    expect(body).toContain("throw error");
    // 没有 project 参数时什么都不做。
    expect(body).toContain("if (!projectId) return;");
  });

  it("createThread 把 project_id 放进请求体，并且带 thread_id", async () => {
    mocks.fetchWithAuth.mockResolvedValue({
      ok: true,
      json: async () => ({ thread_id: "t-1" }),
    });
    await createThread("t-1", "p-9");
    const [url, init] = mocks.fetchWithAuth.mock.calls[0]!;
    expect(String(url)).toContain("/api/threads");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      thread_id: "t-1",
      project_id: "p-9",
    });
  });

  /*
    没有项目时**整个字段不出现**，而不是 `project_id: null`。
    后端把显式的 null 当成「移出项目」，与「没说」不是一回事。
  */
  it("没有项目时不发 project_id", async () => {
    mocks.fetchWithAuth.mockResolvedValue({
      ok: true,
      json: async () => ({ thread_id: "t-2" }),
    });
    await createThread("t-2");
    const body = JSON.parse(
      mocks.fetchWithAuth.mock.calls[0]![1].body as string,
    );
    expect(body).toEqual({ thread_id: "t-2" });
    expect("project_id" in body).toBe(false);
  });

  /*
    抛的**是什么**要断言到。只写 `rejects.toThrow()` 的话，把错误检查整个删掉
    也照样绿：那时抛的是「响应体读不出来」这种下游 TypeError，而不是后端说的
    那句话——用户看到的提示会从「项目没了」变成一句莫名其妙的内部错误。
  */
  it("后端拒绝时把后端那句话抛出来", async () => {
    mocks.fetchWithAuth.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ detail: "project gone" }),
      text: async () => JSON.stringify({ detail: "project gone" }),
    });
    await expect(createThread("t-3", "p-gone")).rejects.toThrow(/project gone/);
  });
});
