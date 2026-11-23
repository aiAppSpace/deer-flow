/*
  【文件职责】     DeerFlow RunProtocol 的四个方法对上 M0 录到的请求/响应约定。
  【架构位置】     L3 测试
  【主要导出】     无
  【依赖关系】     @/core/agent-deerflow/run-protocol
  【边界与注意】   假 fetch **记录请求**，因为这一层最重要的几条断言是关于
                   「发出去的是什么」而不是「返回了什么」：create 必须是 POST、
                   resume 必须是 GET 且带 Last-Event-ID、cancel 必须带
                   action=interrupt。只断言返回值的话，把 resume 写成 POST
                   照样能绿。
*/

import { beforeEach, describe, expect, it } from "vitest";

import {
  DEERFLOW_DURABLE_STATUS,
  createDeerFlowRunProtocol,
} from "@/core/agent-deerflow/run-protocol";

const BASE = "https://example.test/api/langgraph";

interface Recorded {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

let recorded: Recorded[] = [];

function fakeFetch(
  responses: (() => Response)[] | (() => Response),
): (input: RequestInfo | string, init?: RequestInit) => Promise<Response> {
  let at = 0;
  return async (input, init) => {
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });
    recorded.push({
      url: typeof input === "string" ? input : input.url,
      method: init?.method ?? "GET",
      headers,
      ...(typeof init?.body === "string" ? { body: init.body } : {}),
    });
    return Array.isArray(responses)
      ? (responses[at++] ?? responses[0])!()
      : responses();
  };
}

const sseResponse = (headers: Record<string, string> = {}) =>
  new Response("event: end\ndata: null\n\n", { status: 200, headers });

const CONTENT_LOCATION = { "Content-Location": "/api/threads/t-1/runs/r-1" };

const protocolWith = (fetchImpl: ReturnType<typeof fakeFetch>) =>
  createDeerFlowRunProtocol({ baseUrl: BASE, fetchImpl });

const signal = () => new AbortController().signal;

const validPayload = {
  assistant_id: "lead_agent",
  stream_mode: ["values", "messages-tuple"],
};

beforeEach(() => {
  recorded = [];
});

describe("create（08 硬规则 1 · 05 A2/L10/L12）", () => {
  it("是一次 POST，并从 Content-Location 拿到 handle", async () => {
    const protocol = protocolWith(
      fakeFetch(() => sseResponse(CONTENT_LOCATION)),
    );
    const opened = await protocol.create(
      { threadId: "t-1", payload: validPayload },
      signal(),
    );

    expect(recorded).toHaveLength(1);
    expect(recorded[0]?.method).toBe("POST");
    expect(recorded[0]?.url).toBe(`${BASE}/threads/t-1/runs/stream`);
    expect(opened.handle).toEqual({ threadId: "t-1", runId: "r-1" });
  });

  it("A2：不支持的 stream mode 必须在**发出请求之前**抛错", async () => {
    const protocol = protocolWith(
      fakeFetch(() => sseResponse(CONTENT_LOCATION)),
    );
    await expect(
      protocol.create(
        {
          threadId: "t-1",
          payload: { stream_mode: ["values", "events"] },
        },
        signal(),
      ),
    ).rejects.toThrow(/Unsupported LangGraph stream mode/);
    // 关键断言：一个请求都没发出去。部分转发或静默降级都会让这里变成 1。
    expect(recorded).toHaveLength(0);
  });

  it("L12：没有 Content-Location 就 fail closed，不去猜 Location", async () => {
    const protocol = protocolWith(
      fakeFetch(() => sseResponse({ Location: "/api/threads/t-1/runs/r-1" })),
    );
    await expect(
      protocol.create({ threadId: "t-1", payload: validPayload }, signal()),
    ).rejects.toMatchObject({ kind: "missing_handle" });
  });

  it("A2：wire 的 snake_case `stream_mode` 也要被校验到", async () => {
    // 回归用例：桥接之前，sanitizeRunStreamOptions 只认 camelCase
    // `streamMode`，套在 wire 请求体上恒为 no-op——校验一声不响地什么都不做。
    const protocol = protocolWith(
      fakeFetch(() => sseResponse(CONTENT_LOCATION)),
    );
    await expect(
      protocol.create(
        { threadId: "t-1", payload: { stream_mode: ["events"] } },
        signal(),
      ),
    ).rejects.toThrow(/Unsupported LangGraph stream mode/);
    expect(recorded).toHaveLength(0);
  });

  it("A3：校验后的 wire payload 原样发送，不做兼容改写", async () => {
    const protocol = protocolWith(
      fakeFetch(() => sseResponse(CONTENT_LOCATION)),
    );
    await protocol.create(
      {
        threadId: "t-1",
        payload: validPayload,
      },
      signal(),
    );
    const body = JSON.parse(recorded[0]?.body ?? "{}") as Record<
      string,
      unknown
    >;
    expect(body).toEqual({ on_disconnect: "continue", ...validPayload });
  });

  it("forwards an explicit immutable idempotency key and rejects unsupported resumable streams before HTTP", async () => {
    const protocol = protocolWith(
      fakeFetch(() => sseResponse(CONTENT_LOCATION)),
    );
    await protocol.create(
      { threadId: "t-1", payload: validPayload, idempotencyKey: "same-input" },
      signal(),
    );
    expect(recorded[0]?.headers["idempotency-key"]).toBe("same-input");
    recorded = [];
    await expect(
      protocol.create(
        {
          threadId: "t-1",
          payload: { ...validPayload, stream_resumable: true },
        },
        signal(),
      ),
    ).rejects.toMatchObject({ kind: "http" });
    expect(recorded).toHaveLength(0);
  });

  it("非 2xx 归一化成 http 错误", async () => {
    const protocol = protocolWith(
      fakeFetch(() => new Response("nope", { status: 500 })),
    );
    await expect(
      protocol.create({ threadId: "t-1", payload: validPayload }, signal()),
    ).rejects.toMatchObject({ kind: "http" });
  });
});

describe("resume（05 L11）", () => {
  const handle = { threadId: "t-1", runId: "r-1" };

  it("是 GET 到既有 run 的 stream，并带 Last-Event-ID", async () => {
    const protocol = protocolWith(fakeFetch(() => sseResponse()));
    await protocol.resume(handle, "1785-42", signal());

    expect(recorded[0]?.method).toBe("GET");
    expect(recorded[0]?.url).toBe(`${BASE}/threads/t-1/runs/r-1/stream`);
    expect(recorded[0]?.headers["last-event-id"]).toBe("1785-42");
  });

  it("没有游标时**不发**空的 Last-Event-ID", async () => {
    // 空字符串会被后端当成一个真实存在过的游标，而不是「从头开始」。
    const protocol = protocolWith(fakeFetch(() => sseResponse()));
    await protocol.resume(handle, undefined, signal());
    expect(recorded[0]?.headers).not.toHaveProperty("last-event-id");
  });
});

describe("cancel（05 L16）", () => {
  const handle = { threadId: "t-1", runId: "r-1" };

  it("a terminal cancel conflict drains the same run instead of discarding its tail", async () => {
    const protocol = protocolWith(
      fakeFetch([
        () =>
          new Response(
            JSON.stringify({
              detail: "Run r-1 is not cancellable (status: success)",
            }),
            { status: 409 },
          ),
        () => sseResponse(),
      ]),
    );
    expect(await protocol.cancel(handle, "tail-1", signal())).toMatchObject({
      kind: "drain",
      outcome: "completed",
      reason: "success",
    });
    expect(recorded[1]).toMatchObject({
      method: "GET",
      url: `${BASE}/threads/t-1/runs/r-1/stream`,
      headers: { "last-event-id": "tail-1" },
    });
  });

  it("a live run on another worker is a real cancel failure", async () => {
    const protocol = protocolWith(
      fakeFetch(
        () =>
          new Response(
            JSON.stringify({
              detail:
                "Run r-1 is not active on this worker and cannot be cancelled",
            }),
            { status: 409 },
          ),
      ),
    );
    await expect(
      protocol.cancel(handle, undefined, signal()),
    ).rejects.toMatchObject({ kind: "http" });
    expect(recorded).toHaveLength(1);
  });

  it("POST 到 cancel，且显式带 action=interrupt 与 wait=true", async () => {
    const protocol = protocolWith(
      fakeFetch(() => new Response(null, { status: 204 })),
    );
    await protocol.cancel(handle, "1", signal());
    expect(recorded[0]?.method).toBe("POST");
    expect(recorded[0]?.url).toContain("action=interrupt");
    expect(recorded[0]?.url).toContain("wait=true");
  });

  it("204 = 已确认终态 → terminal/cancelled（M0 实测就是 204）", async () => {
    const protocol = protocolWith(
      fakeFetch(() => new Response(null, { status: 204 })),
    );
    expect(await protocol.cancel(handle, "1", signal())).toEqual({
      kind: "terminal",
      outcome: "cancelled",
    });
  });

  it("202 = 收到但没停 → accepted，交给 inspect 轮询", async () => {
    const protocol = protocolWith(
      fakeFetch(() => new Response(null, { status: 202 })),
    );
    expect(await protocol.cancel(handle, "1", signal())).toEqual({
      kind: "accepted",
    });
  });

  it("200 带 body = 要继续读尾帧 → drain", async () => {
    const protocol = protocolWith(fakeFetch(() => sseResponse()));
    const result = await protocol.cancel(handle, "1", signal());
    expect(result.kind).toBe("drain");
  });

  it("跨 worker 时 200 也可能没有 body——不能假定总有尾帧可读", async () => {
    const protocol = protocolWith(
      fakeFetch(() => new Response(null, { status: 200 })),
    );
    expect((await protocol.cancel(handle, "1", signal())).kind).toBe(
      "accepted",
    );
  });
});

describe("inspect：durable status 的冻结映射（08 §258）", () => {
  const handle = { threadId: "t-1", runId: "r-1" };
  const withStatus = (status: string) =>
    protocolWith(
      fakeFetch(
        () =>
          new Response(JSON.stringify({ status }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );

  it("读的是 durable run resource，不带 /stream", async () => {
    await withStatus("success").inspect(handle, signal());
    expect(recorded[0]?.url).toBe(`${BASE}/threads/t-1/runs/r-1`);
    expect(recorded[0]?.method).toBe("GET");
  });

  it.each([
    ["success", "completed"],
    ["interrupted", "cancelled"],
    ["error", "failed"],
    ["timeout", "failed"],
  ])("%s → %s", async (status, outcome) => {
    expect(await withStatus(status).inspect(handle, signal())).toMatchObject({
      terminal: true,
      outcome,
    });
  });

  it.each(["pending", "running"])("%s 还不是终态", async (status) => {
    expect(await withStatus(status).inspect(handle, signal())).toMatchObject({
      terminal: false,
    });
  });

  it("未知 status 当作还没到终态，不把 run 判死", async () => {
    // 后端加一个枚举值就让所有停止操作报错，是比"多轮询几次"糟得多的失败模式。
    expect(
      await withStatus("brand-new").inspect(handle, signal()),
    ).toMatchObject({ terminal: false });
  });

  it("映射表覆盖 Gateway 的全部 6 个 status", () => {
    expect(Object.keys(DEERFLOW_DURABLE_STATUS).sort()).toEqual([
      "error",
      "interrupted",
      "pending",
      "running",
      "success",
      "timeout",
    ]);
  });
});
