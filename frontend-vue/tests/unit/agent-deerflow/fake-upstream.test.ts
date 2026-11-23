/*
  【文件职责】     06 §M2 B 的**第 3 类证据**：对着一个真的 HTTP 后端跑完整会话。
  【架构位置】     L3 集成测试
  【主要导出】     无
  【依赖关系】     node:http · @deerflow/agent-core · @/core/agent-deerflow/*
  【边界与注意】   与 run-session.test.ts 的分工不能混：那边假的是 `RunProtocol`
                   这一层，验的是状态机；**这里假的是后端**，验的是真实
                   `fetch` / `Response` / TCP chunk 边界 / header 大小写 /
                   连接被掐断这些只有真网络栈才有的东西。

                   状态机那一层再全，也证明不了「`Last-Event-ID` 这个 header
                   真的发出去了」——`fetch` 会规范化 header 名，而假 fetch 不会。
                   这正是本文件存在的理由。

                   服务器**故意**在几处做得不规矩：用 CRLF、把帧切在分隔符中间、
                   中途断开连接。规矩的后端测不出 05 L1 与 L11。
*/

import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { afterEach, describe, expect, it } from "vitest";

import { createRunSession } from "@deerflow/agent-core";
import type { SessionOutput } from "@deerflow/agent-core";

import { classifyDeerFlowEvent } from "@/core/agent-deerflow/event-map";
import { createDeerFlowRunProtocol } from "@/core/agent-deerflow/run-protocol";
import type { DeerFlowRunHandle } from "@/core/agent-deerflow/endpoints";

interface Recorded {
  method: string;
  url: string;
  lastEventId?: string;
}

interface Upstream {
  baseUrl: string;
  calls: Recorded[];
  close(): Promise<void>;
}

type Handler = (
  request: IncomingMessage,
  response: ServerResponse,
  calls: Recorded[],
) => void;

const servers: Server[] = [];

async function startUpstream(handler: Handler): Promise<Upstream> {
  const calls: Recorded[] = [];
  const server = createServer((request, response) => {
    calls.push({
      method: request.method ?? "",
      url: request.url ?? "",
      // 真 fetch 会把 header 名规范化成小写，假 fetch 不会——
      // 这条差别正是 L11「续传要带 Last-Event-ID」能不能被真正验到的关键。
      ...(typeof request.headers["last-event-id"] === "string"
        ? { lastEventId: request.headers["last-event-id"] }
        : {}),
    });
    handler(request, response, calls);
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}/api/langgraph`,
    calls,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
  };
}

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.closeAllConnections?.();
          server.close(() => resolve());
        }),
    ),
  );
});

const sseHead = (
  response: ServerResponse,
  extra: Record<string, string> = {},
) =>
  response.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    ...extra,
  });

const CONTENT_LOCATION = { "Content-Location": "/api/threads/t-1/runs/r-1" };

function sessionAgainst(upstream: Upstream, overrides = {}) {
  return createRunSession<
    { threadId: string; payload: Record<string, unknown> },
    DeerFlowRunHandle
  >({
    protocol: createDeerFlowRunProtocol({ baseUrl: upstream.baseUrl }),
    classifyEvent: classifyDeerFlowEvent,
    maxBufferBytes: 1024 * 1024,
    maxReconnects: 3,
    sleep: async () => {},
    ...overrides,
  });
}

const START = {
  threadId: "t-1",
  payload: { assistant_id: "lead_agent", stream_mode: ["values"] },
};

async function drain(
  outputs: AsyncGenerator<SessionOutput<DeerFlowRunHandle>>,
): Promise<SessionOutput<DeerFlowRunHandle>[]> {
  const collected: SessionOutput<DeerFlowRunHandle>[] = [];
  for await (const output of outputs) collected.push(output);
  return collected;
}

const statuses = (outputs: SessionOutput<DeerFlowRunHandle>[]) =>
  outputs.flatMap((o) => (o.kind === "state" ? [o.state.status] : []));

const dataOf = (outputs: SessionOutput<DeerFlowRunHandle>[]) =>
  outputs.flatMap((o) => (o.kind === "event" ? [o.event.data] : []));

describe("完整一趟：create → 流 → end", () => {
  it("真 fetch 下走通，且 create 只发一次", async () => {
    const upstream = await startUpstream((request, response) => {
      sseHead(response, CONTENT_LOCATION);
      response.write('event: values\r\ndata: {"a":1}\r\nid: 1\r\n\r\n');
      response.write(": heartbeat\r\n\r\n");
      response.end("event: end\r\ndata: null\r\n\r\n");
    });

    const outputs = await drain(sessionAgainst(upstream).run(START));

    expect(statuses(outputs)).toEqual(["creating", "streaming", "completed"]);
    expect(dataOf(outputs)).toEqual(['{"a":1}', "null"]);
    expect(outputs.filter((o) => o.kind === "heartbeat")).toHaveLength(1);
    expect(upstream.calls).toHaveLength(1);
    expect(upstream.calls[0]).toMatchObject({
      method: "POST",
      url: "/api/langgraph/threads/t-1/runs/stream",
    });
  });

  it("帧被 TCP 切在分隔符中间也能拼回来", async () => {
    const upstream = await startUpstream((_request, response) => {
      sseHead(response, CONTENT_LOCATION);
      // 分隔符跨两次 write：只有真 socket 才会这样到达。
      response.write("data: first\n");
      response.write("\ndata: second\n\nevent: end\ndata: null\n");
      response.end("\n");
    });

    const outputs = await drain(sessionAgainst(upstream).run(START));
    expect(dataOf(outputs)).toEqual(["first", "second", "null"]);
  });

  it("多字节字符被切在两个 write 之间不会变成替换字符", async () => {
    const upstream = await startUpstream((_request, response) => {
      sseHead(response, CONTENT_LOCATION);
      const payload = Buffer.from('data: {"text":"中文测试"}\n\n', "utf8");
      response.write(payload.subarray(0, 20));
      response.write(payload.subarray(20));
      response.end("event: end\ndata: null\n\n");
    });

    const outputs = await drain(sessionAgainst(upstream).run(START));
    expect(dataOf(outputs)[0]).toBe('{"text":"中文测试"}');
  });
});

describe("续传（05 L10/L11）", () => {
  it("意外 EOF 后走 GET resume，带上真正发出去的 Last-Event-ID", async () => {
    const upstream = await startUpstream((request, response) => {
      if (request.method === "POST") {
        // body 正常结束但**没有** end 事件：这就是意外 EOF。
        // 这里不用 `response.destroy()`——它会在 undici 交付响应头之前就把连接
        // 重置掉，create 本身就失败了，测到的是另一回事。真实的网络中断发生在
        // 响应头之后，见下一个用例。
        sseHead(response, CONTENT_LOCATION);
        response.end("data: partial\nid: 42\n\n");
        return;
      }
      sseHead(response);
      response.end("event: end\ndata: null\n\n");
    });

    const outputs = await drain(sessionAgainst(upstream).run(START));

    expect(statuses(outputs)).toEqual([
      "creating",
      "streaming",
      "reconnecting",
      "streaming",
      "completed",
    ]);
    // L10：create 只发一次。重放 POST 会让后端跑两个 run。
    expect(upstream.calls.filter((c) => c.method === "POST")).toHaveLength(1);
    // L11：续传是 GET，走既有 run 的地址，并带上游标。
    expect(upstream.calls[1]).toMatchObject({
      method: "GET",
      url: "/api/langgraph/threads/t-1/runs/r-1/stream",
      lastEventId: "42",
    });
  });

  it("流式中途连接被重置也按可重连处理", async () => {
    // 与上一个用例的区别：这里连接是**被重置**的，不是正常结束。
    // 延时是必需的——要让响应头先到达客户端，否则测的是 create 失败而不是重连。
    const upstream = await startUpstream((request, response) => {
      if (request.method === "POST") {
        sseHead(response, CONTENT_LOCATION);
        response.write("data: partial\nid: 7\n\n");
        setTimeout(() => response.destroy(), 50);
        return;
      }
      sseHead(response);
      response.end("event: end\ndata: null\n\n");
    });

    const outputs = await drain(sessionAgainst(upstream).run(START));
    expect(statuses(outputs)).toContain("reconnecting");
    expect(outputs.at(-1)).toMatchObject({
      kind: "state",
      state: { status: "completed" },
    });
    expect(upstream.calls[1]).toMatchObject({
      method: "GET",
      lastEventId: "7",
    });
  });

  it("重连次数封顶后落 reconnect_exhausted，不无限重试", async () => {
    const upstream = await startUpstream((_request, response) => {
      sseHead(response, CONTENT_LOCATION);
      response.end("data: x\nid: 1\n\n");
    });

    const outputs = await drain(
      sessionAgainst(upstream, { maxReconnects: 2 }).run(START),
    );
    expect(outputs.at(-1)).toMatchObject({
      kind: "state",
      state: { status: "failed", error: { kind: "reconnect_exhausted" } },
    });
    expect(upstream.calls.filter((c) => c.method === "GET")).toHaveLength(2);
  });
});

describe("协议边界", () => {
  it("缺 Content-Location → missing_handle，且不重试 create（05 L12）", async () => {
    const upstream = await startUpstream((_request, response) => {
      // 只发 Location。实测 Gateway 不发它，但代理或未来的后端可能发——
      // 那时候「猜一下另一个 header」就会悄悄接上一个错的 run。
      sseHead(response, { Location: "/api/threads/t-1/runs/r-1" });
      response.end("event: end\ndata: null\n\n");
    });

    const outputs = await drain(sessionAgainst(upstream).run(START));
    expect(outputs.at(-1)).toMatchObject({
      kind: "state",
      state: { status: "failed", error: { kind: "missing_handle" } },
    });
    expect(upstream.calls).toHaveLength(1);
  });

  it("后端 error 事件不触发重连", async () => {
    const upstream = await startUpstream((_request, response) => {
      sseHead(response, CONTENT_LOCATION);
      response.end('event: error\ndata: {"message":"boom"}\n\n');
    });

    const outputs = await drain(sessionAgainst(upstream).run(START));
    expect(outputs.at(-1)).toMatchObject({
      kind: "state",
      state: { status: "failed", error: { kind: "backend_error" } },
    });
    expect(upstream.calls.filter((c) => c.method === "GET")).toHaveLength(0);
  });

  it("gap 进 gap 态并停下，不自作主张 rejoin（08 硬规则 6）", async () => {
    const upstream = await startUpstream((_request, response) => {
      sseHead(response, CONTENT_LOCATION);
      response.end(
        'event: gap\ndata: {"code":"stream_replay_gap","run_id":"r-1",' +
          '"requested_event_id":null,"earliest_available_event_id":"5",' +
          '"latest_available_event_id":"9","recovery":"reload_durable_state"}\n\n',
      );
    });

    const outputs = await drain(sessionAgainst(upstream).run(START));
    expect(outputs.at(-1)).toMatchObject({
      kind: "state",
      state: { status: "gap", recovery: "reload_durable_state" },
    });
    expect(upstream.calls.filter((c) => c.method === "GET")).toHaveLength(0);
  });

  it("HTTP 500 归一化成 http 错误，不当成空流", async () => {
    const upstream = await startUpstream((_request, response) => {
      response.writeHead(500, { "Content-Type": "text/plain" });
      response.end("upstream exploded");
    });

    const outputs = await drain(sessionAgainst(upstream).run(START));
    expect(outputs.at(-1)).toMatchObject({
      kind: "state",
      state: { status: "failed", error: { kind: "missing_handle" } },
    });
  });

  it("L6：后端一直不发空行时按字节上限断开", async () => {
    const upstream = await startUpstream((_request, response) => {
      sseHead(response, CONTENT_LOCATION);
      response.write(`data: ${"x".repeat(4096)}`);
    });

    const outputs = await drain(
      sessionAgainst(upstream, { maxBufferBytes: 512 }).run(START),
    );
    expect(outputs.at(-1)).toMatchObject({
      kind: "state",
      state: { status: "failed", error: { kind: "parse_error" } },
    });
    // 解析错误不重试：重连只会把同一段畸形数据再收一遍。
    expect(upstream.calls.filter((c) => c.method === "GET")).toHaveLength(0);
  });
});

describe("停止（05 L13/L16）", () => {
  it("stop 发出 cancel 后，读取 durable 终态及同一运行的尾帧才收敛", async () => {
    const upstream = await startUpstream((request, response) => {
      if (request.method === "POST" && request.url?.endsWith("/runs/stream")) {
        sseHead(response, CONTENT_LOCATION);
        response.write("data: a\nid: 1\n\n");
        return; // 挂着不结束，等 cancel
      }
      if (request.url?.includes("/cancel")) {
        response.writeHead(202).end();
        return;
      }
      if (request.method === "GET" && request.url?.endsWith("/stream")) {
        sseHead(response);
        response.write(
          'event: values\ndata: {"final":"cancelled tail"}\nid: 2\n\n',
        );
        response.end("event: end\ndata: null\n\n");
        return;
      }
      response
        .writeHead(200, { "Content-Type": "application/json" })
        .end(JSON.stringify({ status: "interrupted" }));
    });

    const session = sessionAgainst(upstream);
    const iterator = session.run(START)[Symbol.asyncIterator]();
    const outputs: SessionOutput<DeerFlowRunHandle>[] = [];
    for (let i = 0; i < 3; i += 1) {
      const next = await iterator.next();
      if (next.done) break;
      outputs.push(next.value);
    }
    session.stop();
    for (;;) {
      const next = await iterator.next();
      if (next.done) break;
      outputs.push(next.value);
    }

    // cancel 与 inspect 都真的出门了——abort 掉读取不代表服务端知道要停。
    expect(
      upstream.calls.some(
        (c) => c.url.includes("/cancel") && c.method === "POST",
      ),
    ).toBe(true);
    expect(
      upstream.calls.some(
        (c) => c.method === "GET" && c.url.endsWith("/runs/r-1"),
      ),
    ).toBe(true);
    expect(statuses(outputs)).toContain("stopping");
    expect(upstream.calls).toContainEqual({
      method: "GET",
      url: "/api/langgraph/threads/t-1/runs/r-1/stream",
      lastEventId: "1",
    });
    expect(dataOf(outputs)).toContain('{"final":"cancelled tail"}');
    expect(outputs.at(-1)).toMatchObject({
      kind: "state",
      state: { status: "cancelled", reason: "interrupted" },
    });
  });
});
