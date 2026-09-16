/*
  【文件职责】     M4a gate：生产流模式、发消息 → 流式 → 停止 → 刷新恢复顺序，跑在真浏览器里。
  【架构位置】     测试
  【主要导出】     无
  【依赖关系】     app/pages/workspace/chats/[thread_id].vue · useThreadStream
  【边界与注意】   mock 写在这里而不是复用 `tests/e2e/utils/mock-api.ts`，
                   唯一原因是那份 mock 的 `/runs/stream` 不带 `Content-Location`
                   （上游 SDK 从 `metadata` 事件取 handle）。理由与代价写在
                   playwright.m4a.config.ts 的文件头与 evidence 的红项里。

                   **每条断言都是成功态的正面特征。** 这一层的回退形状是
                   「消息列表还有内容但顺序错了」「停止后按钮变了但缓存没失效」
                   ——所以断言的是 `data-role` 序列与文本序列，不是「非空」。
*/

import { expect, test, type Page, type Route } from "@playwright/test";

const THREAD_ID = "00000000-0000-0000-0000-0000000000a1";
const RUN_ID = "00000000-0000-0000-0000-0000000000b1";

function sse(events: { event: string; data: unknown; id?: string }[]): string {
  return events
    .map(
      (e) =>
        `event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n${e.id ? `id: ${e.id}\n` : ""}\n`,
    )
    .join("");
}

/**
 * 一条最小但**顺序刻意做反**的流：AI 步骤先于 human 到达。
 * 这正是 05 C8 描述的形状（`messages` 先于 `values` 发布新步骤）。
 */
const OUT_OF_ORDER_STREAM = sse([
  {
    event: "metadata",
    data: { run_id: RUN_ID, thread_id: THREAD_ID },
    id: "1",
  },
  {
    event: "messages",
    data: [{ id: "ai-early", type: "ai", content: "Reading the skill" }, {}],
    id: "2",
  },
  {
    event: "values",
    data: {
      title: "Generated Title",
      messages: [
        { id: "ai-early", type: "ai", content: "Reading the skill" },
        { id: "human-1__user", type: "human", content: "Build a deck" },
      ],
    },
    id: "3",
  },
  { event: "end", data: {}, id: "4" },
]);

const HISTORY_ROWS = [
  {
    run_id: RUN_ID,
    seq: 1,
    content: { id: "human-1__user", type: "human", content: "Build a deck" },
    metadata: { caller: "lead_agent" },
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    run_id: RUN_ID,
    seq: 2,
    content: { id: "ai-early", type: "ai", content: "Reading the skill" },
    metadata: { caller: "lead_agent" },
    created_at: "2026-01-01T00:00:01Z",
  },
];

const COMPACTED_TAIL = "COMPACTED-SUMMARY-4e91";

async function mockGateway(
  page: Page,
  options: {
    streamDelayMs?: number;
    /** 有值就路由 `POST /history`，并记下每次调用。 */
    checkpoint?: { messages: unknown[] };
    checkpointDelayMs?: number;
    historyCalls?: string[];
  } = {},
) {
  const {
    streamDelayMs = 0,
    checkpoint,
    checkpointDelayMs = 0,
    historyCalls,
  } = options;

  if (checkpoint) {
    await page.route(
      "**/api/langgraph/threads/*/history",
      async (route: Route) => {
        historyCalls?.push(new Date().toISOString());
        if (checkpointDelayMs > 0) {
          await new Promise((resolve) =>
            setTimeout(resolve, checkpointDelayMs),
          );
        }
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([{ values: checkpoint }]),
        });
      },
    );
  }

  await page.route("**/api/langgraph/threads", async (route) => {
    const body = route.request().postDataJSON() as { thread_id?: string };
    const now = new Date().toISOString();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        thread_id: body.thread_id ?? THREAD_ID,
        created_at: now,
        updated_at: now,
        metadata: {},
        status: "idle",
        values: { title: "", messages: [] },
        interrupts: {},
      }),
    });
  });
  await page.route(
    /\/api\/langgraph\/threads\/[^/?]+(?:\?.*)?$/,
    async (route) => {
      const now = new Date().toISOString();
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          thread_id: THREAD_ID,
          created_at: now,
          updated_at: now,
          metadata: {},
          status: "idle",
          values: { title: "Generated Title", messages: [] },
          interrupts: {},
        }),
      });
    },
  );

  await page.route("**/api/langgraph/threads/*/runs/stream", async (route) => {
    if (streamDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, streamDelayMs));
    }
    return route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      headers: {
        // 05 L12 / 08 硬规则 2：本仓的 protocol 只认这个头，读不到就 fail closed。
        "Content-Location": `/api/threads/${THREAD_ID}/runs/${RUN_ID}`,
      },
      body: OUT_OF_ORDER_STREAM,
    });
  });

  await page.route(
    "**/api/langgraph/threads/*/runs/*/cancel*",
    (route: Route) => route.fulfill({ status: 204, body: "" }),
  );

  await page.route("**/api/threads/*/messages/page*", (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: HISTORY_ROWS,
        has_more: false,
        next_before_seq: null,
      }),
    }),
  );

  await page.route("**/api/langgraph/threads/*/state", (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ values: { title: "", messages: [] } }),
    }),
  );
}

test.describe("数据流 gate", () => {
  test("发消息 → 流式回来，先到的 AI 步骤排在 human 之后（C8）", async ({
    page,
  }) => {
    await mockGateway(page);
    await page.goto("/workspace/chats/new");

    const textarea = page.getByPlaceholder(/how can i assist you/i);
    await expect(textarea).toBeVisible({ timeout: 20_000 });
    const streamRequest = page.waitForRequest(
      (request) =>
        request.method() === "POST" &&
        /\/runs\/stream(\?|$)/.test(request.url()),
    );
    await textarea.fill("Build a deck");
    await textarea.press("Enter");

    // wave 216 起不再订 `values`——理由写在 useThreadStream.ts 的 THREAD_STREAM_MODES。
    expect((await streamRequest).postDataJSON()).toMatchObject({
      stream_mode: ["messages-tuple", "updates", "custom"],
    });

    const items = page.locator('[data-testid="message-list"] > [data-role]');
    await expect(items).toHaveCount(2, { timeout: 20_000 });
    // 正面特征：顺序本身。断言「两条都在」的话，顺序没恢复也会绿。
    await expect(items.nth(0)).toHaveAttribute("data-role", "human");
    await expect(items.nth(1)).toHaveAttribute("data-role", "ai");
  });

  test("在流真正建出 thread 之前，不打 /history、不打 GET /runs（issue #2746）", async ({
    page,
  }) => {
    type Event = { url: string; method: string; seq: number };
    const sent: Event[] = [];
    let seq = 0;
    page.on("request", (request) => {
      sent.push({ url: request.url(), method: request.method(), seq: seq++ });
    });

    // 把 create 拖慢，把任何「提前发出的历史请求」的窗口拉大。
    await mockGateway(page, { streamDelayMs: 300 });
    await page.goto("/workspace/chats/new");

    const textarea = page.getByPlaceholder(/how can i assist you/i);
    await expect(textarea).toBeVisible({ timeout: 20_000 });
    await textarea.fill("Build a deck");
    await textarea.press("Enter");
    await expect(
      page.locator('[data-testid="message-list"] > [data-role]'),
    ).toHaveCount(2, { timeout: 20_000 });

    const createSeq = sent.find(
      (e) => e.method === "POST" && /\/runs\/stream(\?|$)/.test(e.url),
    )?.seq;
    expect(createSeq, "expected POST /runs/stream during send").toBeDefined();

    const early = sent.filter(
      (e) =>
        e.seq < createSeq! &&
        (/\/threads\/[^/]+\/(history|messages\/page)/.test(e.url) ||
          (e.method === "GET" && /\/threads\/[^/]+\/runs(\?|$)/.test(e.url))),
    );
    expect(
      early.map((e) => `${e.method} ${e.url}`),
      "history/runs must not be requested before the thread exists",
    ).toEqual([]);
  });

  /*
    run 成功结束之后要**重新取一次 checkpoint**（wave 41）。上游 SDK 在
    `react/stream.lgp.js` 的 `onSuccess` 里 `await history.mutate(threadId)`
    做的是同一件事。**为什么这件事看得见**：run 内发生上下文压缩之后，
    checkpoint 持有的是摘要，事件库仍然持有当时流出去的原文——不重取的话
    本仓要切走再回来才更新。

    这里断的是**可见后果**而不是请求本身：只断言「打了 /history」的话，
    把响应丢掉照样绿（`refreshDurableState` 被 `idle` 判据无声吞掉时就是这样）。
  */
  /*
    **请求体是台账天生看不见的一整类**（`normalizeRequest` 只记 method + path + query，
    `diff.spec.ts` 比的是这些字符串的多重集）。wave 42 第一次系统扫了它，
    这条守卫把扫出来的结论钉住——普通发送这一条是全仓最复杂的请求体。

    **这张表 wave 216 按对照尺子订正过，此前有两处是假的。** 原来写的是
    「wave 42 用一次性 probe 打上游的 mock 后端」量到上游键集里有
    `stream_resumable`、`stream_mode` 里有 `values`——而 `e2e-parity` 的
    `requestBodies` 档每一轮都在真跑两个应用、录真请求体，它记下的上游值是
    `stream_mode: ["messages-tuple","updates","custom"]`，**没有 `values`，
    整个体里也没有 `stream_resumable`**（SDK 收到 `streamResumable: false`
    之后自己省略了这颗键）。一次性 probe 与常驻尺子矛盾时以尺子为准；
    那条 probe 的读数已经过期，连带把本仓多发的两处钉成了「合同」。

    · **`stream_mode` 的顺序**：上游是 messages-tuple/updates/custom（SDK 用
      `unique([...trackStreamMode, ...callbackStreamMode])` 拼出来的），
      后端按集合处理，所以这里断的是**集合**。
    · **真后端上上游会多一个 `checkpoint`**：`fetchStateHistory: { limit: 1 }` 让
      SDK 的 `includeImplicitBranch` 为真，于是它把线程头的 checkpoint 回发。
      **那个字段是空转的**——`/history` 返回的是 `checkpoint: {id, ts}`，而
      `services.py` 读的是 `checkpoint.checkpoint_id`，取不到就 `return`。
      （edit-regenerate 那条路两边都发 `prepared.checkpoint`，键名是后端真读的那个，
      已经对齐——见 `agent-chat.spec.ts`。）

    所以：**本仓在这里多发或少发任何一个键，都是真差异。**
  */
  test("普通发送的请求体键集与上游逐字相同", async ({ page }) => {
    let body: Record<string, unknown> | undefined;
    await mockGateway(page);
    await page.route(
      "**/api/langgraph/threads/*/runs/stream",
      async (route) => {
        body = route.request().postDataJSON() as Record<string, unknown>;
        return route.fulfill({
          status: 200,
          contentType: "text/event-stream",
          headers: {
            "Content-Location": `/api/threads/${THREAD_ID}/runs/${RUN_ID}`,
          },
          body: OUT_OF_ORDER_STREAM,
        });
      },
    );
    await page.goto("/workspace/chats/new");

    const textarea = page.getByPlaceholder(/how can i assist you/i);
    await expect(textarea).toBeVisible({ timeout: 20_000 });
    await textarea.fill("Build a deck");
    await textarea.press("Enter");
    await expect.poll(() => body !== undefined, { timeout: 20_000 }).toBe(true);

    /*
      **`stream_resumable` 不在这张表里**（wave 216 订正）。这条用例的判词是
      「与上游逐字相同」，而上游的体里本来就没有这颗键——此前这张表钉的是本仓
      当时的形状，不是上游的，于是它把一处真差异钉成了合同。
      对照台账 `chat-thread-init-ordering` 的 `requestBodies` 行记着上游那一侧
      的实测值，Gateway 那边它也只是个 `Literal[False] | None` 的兼容占位。
    */
    expect(Object.keys(body!).sort()).toEqual([
      "assistant_id",
      "config",
      "context",
      "input",
      "on_disconnect",
      "stream_mode",
    ]);
    // 值也要钉：键在而值变了（比如 on_disconnect 变成 "cancel"）同样是真差异，
    // 而且那一类只在断线时才显形。
    expect(body).not.toHaveProperty("stream_resumable");
    expect(body).toMatchObject({
      assistant_id: "lead_agent",
      on_disconnect: "continue",
      config: { recursion_limit: 1000 },
    });
    expect([...(body!.stream_mode as string[])].sort()).toEqual([
      "custom",
      "messages-tuple",
      "updates",
    ]);
  });

  test("run 结束之后重取 checkpoint，压缩过的摘要当场上屏", async ({
    page,
  }) => {
    const historyCalls: string[] = [];
    await mockGateway(page, {
      historyCalls,
      // 把重取拖慢，让「流的原文先上屏」这个前置条件真的可观测——不拖的话
      // 摘要来得比 Playwright 的第一次轮询还快（实测就是这样红的）。
      checkpointDelayMs: 1200,
      // 流里那条 "Reading the skill" 在 checkpoint 里已经被压成了摘要。
      checkpoint: {
        messages: [
          { id: "human-1__user", type: "human", content: "Build a deck" },
          { id: "ai-early", type: "ai", content: COMPACTED_TAIL },
        ],
      },
    });
    await page.goto("/workspace/chats/new");

    const textarea = page.getByPlaceholder(/how can i assist you/i);
    await expect(textarea).toBeVisible({ timeout: 20_000 });
    await textarea.fill("Build a deck");
    await textarea.press("Enter");

    // 流先把原文放上屏——前置条件要证明，不能假设。
    await expect(page.getByText("Reading the skill")).toBeVisible({
      timeout: 20_000,
    });

    // run 结束之后那一帧把它换成摘要。
    await expect(page.getByText(COMPACTED_TAIL)).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText("Reading the skill")).toHaveCount(0);
    expect(historyCalls.length).toBeGreaterThan(0);
  });

  test("刷新之后从历史恢复，顺序与流式时一致（C1/C6）", async ({ page }) => {
    await mockGateway(page);
    await page.goto(`/workspace/chats/${THREAD_ID}`);

    const items = page.locator('[data-testid="message-list"] > [data-role]');
    await expect(items).toHaveCount(2, { timeout: 20_000 });
    await expect(items.nth(0)).toContainText("Build a deck");
    await expect(items.nth(1)).toContainText("Reading the skill");
  });

  test("停止按钮在流式期间出现，停止后回到发送态", async ({ page }) => {
    // 慢流：Stop 按钮要在流还开着的时候被看见。
    await mockGateway(page, { streamDelayMs: 1500 });
    await page.goto("/workspace/chats/new");

    const textarea = page.getByPlaceholder(/how can i assist you/i);
    await expect(textarea).toBeVisible({ timeout: 20_000 });
    await textarea.fill("Build a deck");
    await textarea.press("Enter");

    const stop = page.getByRole("button", { name: "Stop" });
    await expect(stop).toBeVisible({ timeout: 20_000 });
    await stop.click();
    await expect(page.getByRole("button", { name: "Submit" })).toBeVisible({
      timeout: 20_000,
    });
  });
});
