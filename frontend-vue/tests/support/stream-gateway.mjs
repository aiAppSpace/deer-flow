/*
  【文件职责】     一个会**真正分块吐帧**的假 Gateway，供 M4a 的流式 gate 使用。
  【架构位置】     测试夹具
  【主要导出】     本地 8014 HTTP server
  【依赖关系】     被 playwright.m4a-stream.config.ts 当 webServer 启动，
                   Nuxt preview 的 DEER_FLOW_INTERNAL_GATEWAY_BASE_URL 指向它
  【边界与注意】   ⚠️ **它存在的唯一理由是 `route.fulfill` 做不到分块。**
                   Playwright 的路由拦截只能一次性给出完整 body，于是
                   `tests/m4a/chat-dataflow.spec.ts` 里的四条用例虽然跑在真浏览器里，
                   走的却是「一帧到齐」的假流——分帧边界、心跳、`Last-Event-ID`
                   续传、gap→rejoin 这四件**只在分块到达时才会出错**的事，
                   在那份用例里一次都没被走到。本文件把它们补上。

                   与 `run_m0_gateway.py` 的分工：那个是**真** Gateway（跑 backend
                   replay fixture），验的是协议层的真实性（G0-8）；它跑一次要十几秒，
                   而且脚本是固定的 agent run，没法按用例编排 gap。本文件相反——
                   它不真实，但**可编排**：每个用例通过 `?script=` 指定要哪种流。
                   两者不互相替代。

                   它**不是** `proxy-probe.mjs` 的扩写：那个探针刻意「不冒充 Gateway」，
                   只回显代理行为。这里必须冒充（要发 Content-Location、要接受
                   Last-Event-ID、要能 204 cancel），所以另起一个文件而不是往
                   探针里加分支——混在一起会让 M0 的代理断言开始依赖业务语义。
*/

import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

const port = Number(process.env.M4A_STREAM_PORT ?? 8014);
const RUN_ID = "00000000-0000-0000-0000-0000000000b1";
const threads = new Map();

function threadRecord(threadId, metadata = {}) {
  const now = new Date().toISOString();
  return {
    thread_id: threadId,
    created_at: now,
    updated_at: now,
    metadata,
    status: "idle",
    values: { title: "", messages: [] },
    interrupts: {},
  };
}

function completeThread(thread, startedAt) {
  thread.status = "idle";
  // The Gateway's completed durable read attributes the last AI message to its
  // run and stamps that run's elapsed integer seconds, including sub-second 0.
  const assistant = thread.values.messages.findLast(
    (message) => message.type === "ai",
  );
  if (assistant) {
    assistant.run_id = RUN_ID;
    assistant.additional_kwargs = {
      ...assistant.additional_kwargs,
      turn_duration: Math.max(0, Math.floor((Date.now() - startedAt) / 1000)),
    };
  }
}

async function requestBody(request) {
  let raw = "";
  for await (const chunk of request) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function frame(event, data, id) {
  return (
    `event: ${event}\n` +
    (id ? `id: ${id}\n` : "") +
    `data: ${JSON.stringify(data)}\n\n`
  );
}

/**
 * 逐段 delta 的 AI 回答。分成 5 片是为了让**分帧边界落在字符中间**：
 * 每片都不是一个完整的 JSON，只有帧解析正确时拼起来才是 "Hello from DeerFlow!"。
 */
const DELTAS = ["Hello", " from", " Deer", "Flow", "!"];

/**
 * 足够撑满桌面聊天视口的逐片回答。每一片都落在同一个 AI message/group 上，
 * 专门覆盖「消息数量不变、只有已渲染内容高度持续增长」的 follow-bottom 路径。
 */
const SCROLL_DELTAS = Array.from(
  { length: 18 },
  (_, index) =>
    `\n\nStreaming paragraph ${index + 1}: ` +
    "DeerFlow keeps the active answer visible while new model tokens arrive. ".repeat(
      3,
    ),
);

/** 初始段：metadata → 一个乱序的 AI 步骤 → human（values）→ 逐片 delta。 */
function* initialScript(thread, human, deltas = DELTAS) {
  yield frame(
    "metadata",
    { run_id: RUN_ID, thread_id: thread.thread_id },
    "e1",
  );
  // 05 C8 的形状：AI 步骤先于 human 到达。
  yield frame(
    "messages",
    [{ id: "ai-early", type: "ai", content: "" }, {}],
    "e2",
  );
  yield frame(
    "values",
    {
      title: "Generated Title",
      messages: [{ id: "ai-early", type: "ai", content: "" }, human],
    },
    "e3",
  );
  const assistant = { id: "ai-early", type: "ai", content: "" };
  // The transport deliberately delivers AI before human. The durable checkpoint
  // retains the submitted input followed by the accumulated assistant answer.
  thread.values = { title: "Generated Title", messages: [human, assistant] };
  let index = 4;
  for (const delta of deltas) {
    assistant.content += delta;
    yield frame(
      "messages",
      [{ id: "ai-early", type: "ai", content: delta }, {}],
      `e${index}`,
    );
    index += 1;
  }
}

async function writeTaskScript(response, thread, human, startedAt) {
  thread.values = {
    title: "Market research",
    messages: [
      human,
      {
        id: "ai-task",
        type: "ai",
        content: "",
        tool_calls: [
          {
            id: "task-1",
            name: "task",
            type: "tool_call",
            args: {
              description: "Research the market",
              prompt: "Find current evidence",
            },
          },
        ],
      },
    ],
  };
  response.write(
    frame("metadata", { run_id: RUN_ID, thread_id: thread.thread_id }, "t1"),
  );
  await sleep(40);
  response.write(frame("values", thread.values, "t2"));
  await sleep(40);
  response.write(
    frame(
      "custom",
      {
        type: "llm_retry",
        attempt: 1,
        max_attempts: 2,
        wait_ms: 500,
        reason: "rate_limit",
        message: "The model is busy. Retrying…",
      },
      "t3",
    ),
  );
  // Task progress is independent of the retry toast's own lifecycle.
  await sleep(700);
  response.write(
    frame(
      "custom",
      {
        type: "task_started",
        task_id: "task-1",
        description: "Research the market",
        prompt: "Find current evidence",
        subagent_type: "research",
        model_name: "scenario-model",
      },
      "t4",
    ),
  );
  await sleep(80);
  response.write(
    frame(
      "custom",
      {
        type: "task_running",
        task_id: "task-1",
        message_index: 1,
        message: { type: "ai", content: "Planning the research" },
        model_name: "scenario-model",
        usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
      },
      "t5",
    ),
  );
  await sleep(80);
  response.write(
    frame(
      "custom",
      {
        type: "task_running",
        task_id: "task-1",
        message_index: 2,
        message: {
          type: "tool",
          name: "web_search",
          content: "Found evidence",
        },
        model_name: "scenario-model",
        usage: { input_tokens: 20, output_tokens: 10, total_tokens: 30 },
      },
      "t6",
    ),
  );
  await sleep(80);
  response.write(
    frame(
      "custom",
      {
        type: "task_completed",
        task_id: "task-1",
        result: "Market evidence ready.",
        model_name: "scenario-model",
        usage: { input_tokens: 20, output_tokens: 10, total_tokens: 30 },
      },
      "t7",
    ),
  );
  await sleep(80);
  completeThread(thread, startedAt);
  response.write(frame("end", {}, "t8"));
  response.end();
}

async function writeChunked(
  response,
  chunks,
  { delayMs = 40, heartbeat = false } = {},
) {
  for (const chunk of chunks) {
    if (response.writableEnded) return false;
    if (heartbeat) {
      // 心跳是注释帧，必须在传输层就被吃掉，不能进 reducer（05 L9）。
      response.write(": keep-alive\n\n");
    }
    response.write(chunk);
    await sleep(delayMs);
  }
  return true;
}

function openSse(response, threadId, runId = RUN_ID) {
  response.writeHead(200, {
    "cache-control": "no-cache",
    "content-type": "text/event-stream",
    "content-location": `/api/threads/${threadId}/runs/${runId}`,
    "x-accel-buffering": "no",
  });
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
  const script =
    url.searchParams.get("script") ?? process.env.M4A_SCRIPT ?? "plain";

  if (url.pathname === "/health") {
    response.setHeader("content-type", "application/json");
    response.end('{"status":"ok"}');
    return;
  }

  // Thread lifecycle: the production Gateway requires an explicit thread
  // before a run starts, so this fixture must model the same contract.
  if (url.pathname === "/api/threads" && request.method === "POST") {
    const body = await requestBody(request);
    const threadId = body.thread_id ?? randomUUID();
    if (!threads.has(threadId))
      threads.set(threadId, threadRecord(threadId, body.metadata ?? {}));
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify(threads.get(threadId)));
    return;
  }

  if (url.pathname === "/api/threads/search" && request.method === "POST") {
    const body = await requestBody(request);
    response.setHeader("content-type", "application/json");
    response.end(
      JSON.stringify(
        [...threads.values()].slice(
          body.offset ?? 0,
          (body.offset ?? 0) + (body.limit ?? 100),
        ),
      ),
    );
    return;
  }

  if (/\/api\/threads\/[^/]+$/.test(url.pathname) && request.method === "GET") {
    const thread = threads.get(url.pathname.split("/").at(-1));
    response.setHeader("content-type", "application/json");
    response.writeHead(thread ? 200 : 404);
    response.end(JSON.stringify(thread ?? { detail: "Thread not found" }));
    return;
  }

  // create：POST /api/threads/:id/runs/stream
  if (
    /\/threads\/[^/]+\/runs\/stream$/.test(url.pathname) &&
    request.method === "POST"
  ) {
    const threadId = url.pathname.split("/").at(-3);
    const thread = threads.get(threadId);
    if (!thread) {
      response.writeHead(404).end();
      return;
    }
    const body = await requestBody(request);
    const human = body.input?.messages?.findLast(
      (message) => message.type === "human",
    ) ?? {
      id: "human-1__user",
      type: "human",
      content: "Build a deck",
    };
    thread.status = "busy";
    const startedAt = Date.now();
    openSse(response, threadId);
    if (script === "task") {
      await writeTaskScript(response, thread, human, startedAt);
      return;
    }
    const deltas = script === "scroll" ? SCROLL_DELTAS : DELTAS;
    const ok = await writeChunked(
      response,
      initialScript(thread, human, deltas),
      {
        delayMs: script === "scroll" ? 90 : 40,
        heartbeat: true,
      },
    );
    if (!ok) return;
    completeThread(thread, startedAt);
    if (script === "gap") {
      // 缺口：告诉客户端「你要的游标已经被淘汰了，从 latest 重来」。
      response.write(
        frame(
          "gap",
          {
            code: "stream_replay_gap",
            run_id: RUN_ID,
            requested_event_id: null,
            earliest_available_event_id: "e7",
            latest_available_event_id: "e8",
            recovery: "reload_durable_state",
          },
          "e9",
        ),
      );
      response.end();
      return;
    }
    response.write(frame("end", {}, "e9"));
    response.end();
    return;
  }

  // resume/join：GET /api/threads/:id/runs/:run/stream，带 Last-Event-ID
  if (
    /\/threads\/[^/]+\/runs\/[^/]+\/stream$/.test(url.pathname) &&
    request.method === "GET"
  ) {
    const cursor = request.headers["last-event-id"];
    const parts = url.pathname.split("/");
    const threadId = parts.at(-4);
    const runId = parts.at(-2);
    const thread = threads.get(threadId);
    if (!thread) {
      response.writeHead(404).end();
      return;
    }
    const resumed = {
      id: "ai-resumed",
      type: "ai",
      content: `resumed@${cursor ?? "none"}`,
    };
    thread.values.messages.push(resumed);
    openSse(response, threadId, runId);
    // 把收到的游标回显成一条 AI 消息：用例据此断言**续传真的带了游标**，
    // 而不是从头重放。
    await writeChunked(response, [
      frame("messages", [resumed, {}], "r1"),
      frame("end", {}, "r2"),
    ]);
    response.end();
    return;
  }

  // cancel
  if (/\/runs\/[^/]+\/cancel/.test(url.pathname)) {
    request.resume();
    response.writeHead(204).end();
    return;
  }

  // durable state（gap 之后的 reload）
  if (/\/threads\/[^/]+\/state$/.test(url.pathname)) {
    const thread = threads.get(url.pathname.split("/").at(-2));
    response.setHeader("content-type", "application/json");
    response.writeHead(thread ? 200 : 404);
    response.end(
      JSON.stringify(
        thread ? { values: thread.values } : { detail: "Thread not found" },
      ),
    );
    return;
  }

  if (
    /\/threads\/[^/]+\/history$/.test(url.pathname) &&
    request.method === "POST"
  ) {
    request.resume();
    const thread = threads.get(url.pathname.split("/").at(-2));
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify(thread ? [{ values: thread.values }] : []));
    return;
  }

  /*
    模型目录。夹具原来没有这一支，`/api/models` 落到最后的 `{}`，于是
    `tokenUsageEnabled` 取默认值 false（两边都是 `?? false`），子任务卡片上的
    token 读数整条不渲染——「终态 Subtask 带 token」那条断言因此**够不着**，
    只是它前面还有一条更早失败的断言，一直没暴露（坑 94）。
    models 故意留空：`scenario-model` 不在目录里时卡片回落到显示后端原名，
    正好是用例断言的那一串。
  */
  if (url.pathname === "/api/models") {
    response.setHeader("content-type", "application/json");
    response.end(
      JSON.stringify({ models: [], token_usage: { enabled: true } }),
    );
    return;
  }

  // 历史分页
  if (/\/threads\/[^/]+\/messages\/page$/.test(url.pathname)) {
    response.setHeader("content-type", "application/json");
    response.end(
      JSON.stringify({ data: [], has_more: false, next_before_seq: null }),
    );
    return;
  }

  if (/\/threads\/[^/]+\/runs\/[^/]+\/events$/.test(url.pathname)) {
    response.setHeader("content-type", "application/json");
    response.end("[]");
    return;
  }

  response.setHeader("content-type", "application/json");
  response.end("{}");
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`m4a stream gateway on ${port}\n`);
});
