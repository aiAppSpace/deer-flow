/*
  【文件职责】     `useThreadStream` 的生产流模式与生命周期：C8/C9 顺序锚点、A7 清空、A8 失效。
  【架构位置】     L3 测试（dom project）
  【主要导出】     无
  【依赖关系】     app/composables/useThreadStream.ts · @tanstack/vue-query
  【边界与注意】   **每一条断言都是成功态的正面特征，不是「没崩」。** M3 的教训：
                   有回退路径的地方，只断言「文本还在」就是假绿。这里对应的
                   三个回退形状分别是——顺序没被恢复（消息仍在原位也「有内容」）、
                   A7 没清空（旧乐观消息仍在也「能显示」）、A8 只失效一次
                   （标题最终也会对，只是晚 30 秒）。所以断言的是
                   **顺序数组本身、清空后的长度、以及两轮失效的 key 集合**。

                   上游那份用 `rs.mock("@langchain/langgraph-sdk/react")` 换掉
                   `useStream`。这里换的是 `runnerFactory`——它是**生产代码本来
                   就有的注入点**，不是测试专用的 mock 层。差别在于：mock 模块
                   时被替换的是一整个包，测试与生产的代码路径就此分叉；
                   注入 factory 时分叉只有一处，且那一处在类型上是同一个接口。
*/

import type { AgentSnapshot } from "@deerflow/agent-core";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, ref, type Ref } from "vue";

import { STREAM_RENDER_COALESCE_MS } from "@/core/threads/coalesce";
import type { ObservationPacket } from "@/core/diagnostics/parity-observation";

import type {
  ThreadRunner,
  ThreadRunnerOptions,
} from "@/core/agent-deerflow/thread-runner";
import type { Message } from "@/core/types/message";
import type { Model } from "@/core/models/types";

import { enUS } from "@/core/i18n/locales/en-US";
import { zhCN } from "@/core/i18n/locales/zh-CN";

import { useThreadStream } from "@/composables/useThreadStream";
import { INFINITE_THREADS_QUERY_KEY_PREFIX } from "@/core/threads/infinite";
import { invalidateWorkspaceQueryOwner } from "@/core/auth/workspace-queries";

beforeEach(() => {
  // This fixture owns checkpoint reads too; never let a DOM unit test reach a
  // development server through happy-dom's default fetch implementation.
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("[]", { status: 200 })),
  );
});

// `useThreadHistory` 真的会发请求。这里给一个空历史，让被测对象只剩实时那一路。
const { historyOptions } = vi.hoisted(() => ({
  historyOptions: {
    onError: undefined as ((error: Error) => void) | undefined,
  },
}));
vi.mock("@/composables/useThreadHistory", () => ({
  useThreadHistory: (
    _threadId: unknown,
    options: { onError?: (error: Error) => void },
  ) => {
    historyOptions.onError = options.onError;
    return {
      messages: ref<Message[]>([]),
      loading: ref(false),
      loadingInitial: ref(false),
      loadingMore: ref(false),
      hasMore: ref(false),
      loadMore: () => Promise.resolve(),
      error: ref(null),
    };
  },
}));

interface FakeRunner extends ThreadRunner {
  joins: Parameters<ThreadRunner["join"]>[0][];
  submissions: Parameters<ThreadRunner["submit"]>[0][];
  /** `seedDurableState` 真正收下的那几帧 checkpoint values。 */
  seeds: Record<string, unknown>[];
  emitStart(threadId?: string, runId?: string): void;
  emitCustom(data: unknown): void;
  emitUpdate(data: unknown): void;
  setMessages(messages: Message[]): void;
  setStreamingMessageIds(ids: readonly string[]): void;
  settle(status: "completed" | "cancelled"): void;
}

function createFakeRunner(
  options: ThreadRunnerOptions,
  {
    autoStart = true,
    failBeforeStart = false,
    submitBarrier,
  }: {
    autoStart?: boolean;
    failBeforeStart?: boolean;
    submitBarrier?: (threadId: string) => Promise<void>;
  } = {},
): FakeRunner {
  let messages: Message[] = [];
  let streamingMessageIds: ReadonlySet<string> = new Set();
  let status = "idle";
  const snapshot = {
    state: {},
    messageIds: [],
    messages: {},
    session: { status: "idle" },
    lastActivityAt: 0,
  } as unknown as AgentSnapshot<Record<string, unknown>>;

  const submissions: Parameters<ThreadRunner["submit"]>[0][] = [];
  const joins: Parameters<ThreadRunner["join"]>[0][] = [];
  const seeds: Record<string, unknown>[] = [];
  /*
    `values` 对 reducer 是全量替换，这里照同一语义换掉消息集合，
    于是种子能一路走到 mergeMessages，而不是停在一个只有测试看得见的数组里。
  */
  const applyDurableValues = (values: Record<string, unknown>) => {
    seeds.push(values);
    if (Array.isArray(values.messages)) {
      messages = values.messages as Message[];
    }
    options.onSnapshot?.();
    return true;
  };
  return {
    joins,
    submissions,
    seeds,
    getSnapshot: () => snapshot,
    getWireMessages: () => messages,
    getStreamingMessageIds: () => streamingMessageIds,
    getSessionState: () => ({ status }) as never,
    isStreaming: () => status === "streaming",
    seedDurableState(values) {
      // 与真 runner 同形：只在 idle 时收下，返回值就是「有没有落下去」。
      if (status !== "idle") return false;
      return applyDurableValues(values);
    },
    /*
      真 runner 的第二个落库口（frontend-vue/app/core/agent-deerflow/thread-runner.ts:291）：
      run **落定之后**那一帧 checkpoint 走的是它，判据比 seed 松——只有流式中才拒收。
      frontend-vue/app/composables/useThreadStream.ts:616 的 `mode === "run-end"`
      就打在这里；假 runner 少了它，那条路径在这份夹具下是「调一个不存在的方法」。
    */
    refreshDurableState(values) {
      if (status === "streaming") return false;
      return applyDurableValues(values);
    },
    subscribe: () => () => {},
    async submit(input) {
      submissions.push(input);
      if (failBeforeStart) {
        const error = new Error("Run creation rejected.");
        status = "failed";
        options.onSessionState?.({ status: "failed", error } as never);
        options.onError?.(error as never);
        options.onSettled?.({ status: "failed", error } as never);
        return;
      }
      status = "streaming";
      if (autoStart) {
        options.onStart?.({ threadId: input.threadId, runId: "run-1" });
      }
      options.onSnapshot?.();
      await submitBarrier?.(input.threadId);
    },
    async join(handle) {
      joins.push(handle);
      status = "streaming";
      options.onStart?.(handle);
      options.onSnapshot?.();
      await submitBarrier?.(handle.threadId);
    },
    stop() {
      status = "cancelled";
    },
    abort() {},
    dispose() {},
    reset() {
      status = "idle";
    },
    flushNotifications() {},
    emitStart(startedThreadId = "thread-1", runId = "run-1") {
      options.onStart?.({ threadId: startedThreadId, runId });
    },
    emitCustom: (data) => options.onCustomEvent?.(data),
    emitUpdate: (data) => options.onUpdateEvent?.(data),
    setStreamingMessageIds(ids) {
      streamingMessageIds = new Set(ids);
      options.onSnapshot?.();
    },
    setMessages(next) {
      messages = next;
      options.onSnapshot?.();
    },
    settle(next) {
      status = next;
      options.onSettled?.({ status: next } as never);
    },
  };
}

describe("useThreadStream · K3 编辑并重跑", () => {
  it("prepare 返回的替换输入、checkpoint 与 metadata 走唯一 runner 提交流", async () => {
    vi.useRealTimers();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toContain(
        "/api/threads/thread-1/runs/edit-regenerate/prepare",
      );
      return new Response(
        JSON.stringify({
          target_run_id: "run-replacement",
          source_message_ids: ["human-1", "ai-1"],
          replacement_human_message_id: "human-2",
          input: {
            messages: [
              { id: "human-2", type: "human", content: "Revised prompt" },
            ],
          },
          checkpoint: { checkpoint_id: "checkpoint-1" },
          metadata: { replay: "edit" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const ctx = mountStream();

    await expect(
      ctx.api.editAndRegenerateMessage(
        "thread-1",
        "human-1",
        "Revised prompt",
        ["human-1", "ai-1"],
        { knowledge_scope: { version: 1, mode: "disabled" } },
      ),
    ).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/edit-regenerate/prepare"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          human_message_id: "human-1",
          replacement_text: "Revised prompt",
        }),
      }),
    );
    expect(ctx.fake.submissions.at(-1)).toMatchObject({
      threadId: "thread-1",
      payload: {
        stream_mode: ["messages-tuple", "updates", "custom"],
        on_disconnect: "continue",
        input: {
          messages: [
            {
              id: "human-2",
              type: "human",
              content: "Revised prompt",
              additional_kwargs: {
                knowledge_scope: { version: 1, mode: "disabled" },
              },
            },
          ],
        },
        checkpoint: { checkpoint_id: "checkpoint-1" },
        metadata: { replay: "edit" },
      },
    });
    expect(ctx.invalidated).toEqual(
      expect.arrayContaining([
        ["threads", "searchInfinite"],
        ["thread", "thread-1"],
        ["thread-messages", "thread-1"],
        ["thread", "metadata", "thread-1"],
        ["thread-token-usage", "thread-1"],
      ]),
    );
    ctx.wrapper.unmount();
    vi.unstubAllGlobals();
  });

  it("保留 prepare 的 HTTP 状态与 Gateway detail，并让失败状态完全收敛", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              detail: "The selected turn is no longer replayable.",
            }),
            {
              status: 409,
              headers: { "Content-Type": "application/json" },
            },
          ),
      ),
    );
    const ctx = mountStream();

    await expect(ctx.api.regenerateMessage("thread-1", "ai-1")).resolves.toBe(
      false,
    );
    expect(ctx.errors).toEqual(["The selected turn is no longer replayable."]);
    expect(ctx.fake.submissions).toHaveLength(0);

    ctx.wrapper.unmount();
    vi.unstubAllGlobals();
  });

  it("切换 thread 会取消 prepare，迟到响应不能提交也不能污染新页面", async () => {
    let resolvePrepare!: (response: Response) => void;
    // 打开线程时的 checkpoint 种子也走 fetch，所以这里按 URL 分开：
    // 只有 prepare 那一条是本用例要悬住的，混在一起数次数会把种子算进去。
    const prepareCalls: string[] = [];
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/history")) {
        return Promise.resolve(
          new Response("[]", {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
      prepareCalls.push(url);
      return new Promise<Response>((resolve) => (resolvePrepare = resolve));
    });
    vi.stubGlobal("fetch", fetchMock);
    const threadId = ref<string | null>("thread-1");
    const ctx = mountStream(threadId);

    const first = ctx.api.regenerateMessage("thread-1", "ai-1");
    await vi.waitFor(() => expect(prepareCalls).toHaveLength(1));
    await expect(ctx.api.regenerateMessage("thread-1", "ai-1")).resolves.toBe(
      false,
    );
    threadId.value = "thread-2";
    await flushPromises();
    resolvePrepare(
      new Response(
        JSON.stringify({
          target_run_id: "old-run",
          input: { messages: [] },
        }),
        { status: 200 },
      ),
    );

    await expect(first).resolves.toBe(false);
    expect(ctx.fake.submissions).toHaveLength(0);
    expect(ctx.errors).toEqual([]);

    ctx.wrapper.unmount();
    vi.unstubAllGlobals();
  });
});

function mountStream(
  threadId = ref<string | null>("thread-1"),
  runnerOptions: {
    autoStart?: boolean;
    failBeforeStart?: boolean;
    submitBarrier?: (threadId: string) => Promise<void>;
  } = {},
  onFinish?: (
    state: Record<string, unknown>,
    messages: readonly Message[],
  ) => void,
  displayThreadId?: Ref<string | null>,
  runOptions?: {
    context?: Ref<Record<string, unknown>>;
    model?: Ref<Model | null | undefined>;
    assistantId?: Ref<string>;
    onSend?: (threadId: string) => void;
  },
) {
  let fake: FakeRunner | undefined;
  let api: ReturnType<typeof useThreadStream> | undefined;
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidated: unknown[][] = [];
  const errors: string[] = [];
  const notices: string[] = [];
  const originalInvalidate = queryClient.invalidateQueries.bind(queryClient);
  queryClient.invalidateQueries = ((filters?: { queryKey?: unknown[] }) => {
    if (filters?.queryKey) invalidated.push(filters.queryKey);
    return originalInvalidate(filters as never);
  }) as typeof queryClient.invalidateQueries;

  const Component = defineComponent({
    setup() {
      api = useThreadStream({
        threadId,
        ...(displayThreadId ? { displayThreadId } : {}),
        context: runOptions?.context ?? ref({ mode: "flash" }),
        ...(runOptions?.model ? { model: runOptions.model } : {}),
        ...(runOptions?.assistantId
          ? { assistantId: runOptions.assistantId }
          : {}),
        notify: {
          warn: (key) => warnings.push(key),
          error: (message) => errors.push(message),
          message: (message) => notices.push(message),
        },
        onFinish,
        onSend: runOptions?.onSend,
        runnerFactory: (options) => {
          fake = createFakeRunner(options, runnerOptions);
          return fake;
        },
      });
      return () => h("div");
    },
  });
  const warnings: string[] = [];

  const wrapper = mount(Component, {
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  });
  return {
    wrapper,
    threadId,
    get fake() {
      return fake!;
    },
    get api() {
      return api!;
    },
    warnings,
    errors,
    notices,
    invalidated,
    queryClient,
  };
}

describe("LLM retry notification ownership", () => {
  it("routes history failures to the same generic error toast as React while retaining Gateway detail in the query", () => {
    const ctx = mountStream();
    expect(historyOptions.onError).toBeTypeOf("function");
    historyOptions.onError!(new Error("Private gateway detail."));
    expect(ctx.errors).toEqual(["Failed to load thread history."]);
    expect(ctx.notices).toEqual([]);
    ctx.wrapper.unmount();
    ctx.queryClient.clear();
  });

  it("announces each non-empty message unchanged without requiring provider retry metadata or deduplicating its text", async () => {
    const ctx = mountStream();
    await ctx.api.sendMessage("thread-1", { text: "hi" });
    ctx.fake.emitCustom({ type: "llm_retry", message: "  Retrying…  " });
    ctx.fake.emitCustom({ type: "llm_retry", message: "  Retrying…  " });
    ctx.fake.emitCustom({ type: "llm_retry", message: "  " });
    ctx.fake.emitCustom({ type: "llm_retry", message: 3 });
    ctx.fake.emitCustom({
      type: "task_running",
      task_id: "t-1",
      message: "Ignored",
    });
    expect(ctx.notices).toEqual(["  Retrying…  ", "  Retrying…  "]);
    ctx.wrapper.unmount();
  });

  it("fences the run's account and then permits notices for the new account's run", async () => {
    const ctx = mountStream();
    await ctx.api.sendMessage("thread-1", { text: "hi" });
    invalidateWorkspaceQueryOwner(ctx.queryClient);
    ctx.fake.emitCustom({ type: "llm_retry", message: "Old account" });
    expect(ctx.notices).toEqual([]);
    ctx.fake.settle("completed");
    await ctx.api.sendMessage("thread-1", { text: "New account" });
    ctx.fake.emitCustom({ type: "llm_retry", message: "Current account" });
    expect(ctx.notices).toEqual(["Current account"]);
    ctx.wrapper.unmount();
  });

  it("does not announce events from a retired thread, terminal run or unmounted owner", async () => {
    const ctx = mountStream();
    await ctx.api.sendMessage("thread-1", { text: "hi" });
    ctx.fake.settle("completed");
    ctx.fake.emitCustom({ type: "llm_retry", message: "Completed run" });
    ctx.threadId.value = "thread-2";
    ctx.fake.emitCustom({ type: "llm_retry", message: "Old thread" });
    await ctx.api.sendMessage("thread-2", { text: "New thread" });
    ctx.fake.emitCustom({ type: "llm_retry", message: "Current thread" });
    expect(ctx.notices).toEqual(["Current thread"]);
    ctx.wrapper.unmount();
    ctx.fake.emitCustom({ type: "llm_retry", message: "Late event" });
    expect(ctx.notices).toEqual(["Current thread"]);
  });
});

describe("observer join ownership", () => {
  it("joins only the displayed thread and blocks a concurrent local submission", async () => {
    const ctx = mountStream(ref<string | null>("thread-1"));
    await expect(
      ctx.api.joinRun({ threadId: "thread-2", runId: "run-2" }),
    ).resolves.toBe(false);
    expect(ctx.fake.joins).toEqual([]);
    await expect(
      ctx.api.joinRun({ threadId: "thread-1", runId: "run-1" }),
    ).resolves.toBe(true);
    expect(ctx.fake.joins).toEqual([{ threadId: "thread-1", runId: "run-1" }]);
    expect(ctx.api.activeRunId.value).toBe("run-1");
    await expect(
      ctx.api.sendMessage("thread-1", { text: "new turn" }),
    ).resolves.toBe(false);
    expect(ctx.fake.submissions).toEqual([]);
    ctx.wrapper.unmount();
  });
});

/**
 * 等到合帧层把最新数组发出来。
 *
 * **这一步是必需的，不是测试样板。** `useCoalescedStreamMessages` 的前沿 flush
 * 发生在「开始流式」那一刻，那时消息还是空的；随后的第一个 chunk 落在尾部
 * flush 上，最多晚一个 interval（80ms）。M3 那条教训在这里的形态是：
 * 只 `await flushPromises()` 一次就断言，拿到的是**前沿那一帧的空数组**——
 * 用例会红得莫名其妙，或者（如果断言写成「包含某条消息」）永远绿不了。
 */
async function settleCoalescing() {
  await vi.advanceTimersByTimeAsync(STREAM_RENDER_COALESCE_MS + 1);
  await flushPromises();
}

const earlyAssistantStep = {
  id: "early-assistant-step",
  type: "ai",
  content: "Reading the presentation skill",
} as Message;
const injectedHuman = {
  id: "current-request__user",
  type: "human",
  content: "Build a presentation",
} as Message;

describe("useThreadStream · production stream modes", () => {
  it("uses the agent assistant and only grants explicitly submitted conversations in run context", async () => {
    const ctx = mountStream(ref("thread-1"), {}, undefined, undefined, {
      assistantId: ref("researcher"),
      context: ref({ mode: "pro", conversation_references: ["stale"] }),
    });
    await ctx.api.sendMessage("thread-1", { text: "read" }, undefined, {
      conversationReferences: ["reference-thread"],
    });
    expect(ctx.fake.submissions[0]?.payload).toMatchObject({
      assistant_id: "researcher",
      context: { conversation_references: ["reference-thread"] },
    });
    expect(ctx.fake.submissions[0]?.payload).not.toHaveProperty(
      "conversation_references",
    );
    ctx.wrapper.unmount();
  });
  it("optimistic, wire and accepted snapshot share the human identity and attachment snapshot", async () => {
    const ctx = mountStream();
    const onAccepted = vi.fn();
    const files = [{ filename: "local.txt", size: 2, path: "/mnt/local.txt" }];
    const staged = {
      filename: "project.pdf",
      size: 4,
      path: "/mnt/project.pdf",
    };
    await ctx.api.sendMessage("thread-1", { text: "read", files }, undefined, {
      humanMessageId: "human-immutable",
      additionalKwargs: { files: [staged] },
      onAccepted,
    });
    files[0]!.filename = "later.txt";
    const input = ctx.fake.submissions[0]?.payload.input as {
      messages: Message[];
    };
    expect(input.messages[0]).toMatchObject({
      id: "human-immutable",
      additional_kwargs: { files: [staged, { filename: "local.txt" }] },
    });
    expect(
      ctx.api.messages.value.find((message) => message.type === "human")?.id,
    ).toBe("human-immutable");
    expect(onAccepted).toHaveBeenCalledWith(
      expect.objectContaining({
        threadId: "thread-1",
        humanMessageId: "human-immutable",
        messages: input.messages,
      }),
    );
    ctx.wrapper.unmount();
  });

  it("late completion and abort from A cannot release or abort B's submission", async () => {
    let finishA!: () => void;
    let finishB!: () => void;
    const barriers = {
      "thread-1": new Promise<void>((resolve) => {
        finishA = resolve;
      }),
      "thread-2": new Promise<void>((resolve) => {
        finishB = resolve;
      }),
    };
    const ctx = mountStream(ref("thread-1"), {
      submitBarrier: (id) => barriers[id as keyof typeof barriers],
    });
    const abort = vi.spyOn(ctx.fake, "abort");
    const controller = new AbortController();
    const first = ctx.api.sendMessage("thread-1", { text: "A" }, undefined, {
      signal: controller.signal,
    });
    ctx.threadId.value = "thread-2";
    const second = ctx.api.sendMessage("thread-2", { text: "B" });
    controller.abort();
    expect(abort).not.toHaveBeenCalled();
    finishA();
    await expect(first).resolves.toBe(false);
    await expect(
      ctx.api.sendMessage("thread-2", { text: "duplicate" }),
    ).resolves.toBe(false);
    expect(ctx.fake.submissions).toHaveLength(2);
    finishB();
    await expect(second).resolves.toBe(true);
    ctx.wrapper.unmount();
  });

  /*
    **这三个模式与上游 wire 上逐字相同，`values` 不在里面**（wave 216）。
    状态由 `updates` 累积——`reduceUpdates` 的 `patch-state` 本来就是干这件事的。
    多订 `values` 会带来一条真缺陷：全量快照里用户刚发出的那条 human 消息没有 id，
    本仓得给它编 `values-0` 这种位置键，而「编辑并重新运行」会把它交给
    `POST /runs/edit-regenerate/prepare`，服务端解析不了。判词写在
    `useThreadStream.ts` 的 `THREAD_STREAM_MODES` 注释里。

    `stream_resumable` 也不发：Gateway 把它声明成 `Literal[False] | None`、默认
    `None`（`run_models.py` 的「compatibility placeholder」），发 `false` 与不发
    是同一个请求，上游 SDK 也不发。
  */
  it("普通发送只请求消息分片、更新与自定义事件，且不带 stream_resumable", async () => {
    const ctx = mountStream();

    await ctx.api.sendMessage("thread-1", { text: "hi" });

    expect(ctx.fake.submissions).toHaveLength(1);
    expect(ctx.fake.submissions[0]?.payload.stream_mode).toEqual([
      "messages-tuple",
      "updates",
      "custom",
    ]);
    expect(ctx.fake.submissions[0]?.payload).toMatchObject({
      on_disconnect: "continue",
    });
    expect(ctx.fake.submissions[0]?.payload).not.toHaveProperty(
      "stream_resumable",
    );
    ctx.wrapper.unmount();
  });

  it("omits effort for a legacy thinking-only model with no advertised effort values", async () => {
    const context = ref<Record<string, unknown>>({
      model_name: "minimax-m3",
      mode: "pro",
    });
    const model = ref<Model>({
      id: "minimax-m3",
      name: "minimax-m3",
      model: "MiniMax-M3",
      display_name: "MiniMax M3",
      supports_thinking: true,
      supports_reasoning_effort: false,
    });
    const ctx = mountStream(ref("thread-1"), {}, undefined, undefined, {
      context,
      model,
    });

    await ctx.api.sendMessage("thread-1", { text: "today's weather" });

    expect(ctx.fake.submissions[0]?.payload.context).toMatchObject({
      model_name: "minimax-m3",
      mode: "pro",
      thinking_enabled: true,
      is_plan_mode: true,
      subagent_enabled: false,
      reasoning_effort: undefined,
    });
    ctx.wrapper.unmount();
  });

  it("normalizes a captured composer context with its captured model, then uses live defaults for the next send", async () => {
    const context = ref<Record<string, unknown>>({
      model_name: "plain",
      mode: "flash",
    });
    const model = ref<Model>({
      id: "plain",
      name: "plain",
      model: "plain",
      display_name: "Plain",
      supports_thinking: false,
      supports_reasoning_effort: false,
    });
    const ctx = mountStream(ref("thread-1"), {}, undefined, undefined, {
      context,
      model,
    });
    await ctx.api.sendMessage(
      "thread-1",
      { text: "Uploaded earlier" },
      undefined,
      {
        runSnapshot: {
          context: {
            model_name: "reasoner",
            mode: "pro",
            reasoning_effort: "high",
          },
          model: {
            id: "reasoner",
            name: "reasoner",
            model: "reasoner",
            display_name: "Reasoner",
            supports_thinking: true,
            supports_reasoning_effort: true,
          },
        },
      },
    );
    expect(ctx.fake.submissions[0]?.payload.context).toMatchObject({
      model_name: "reasoner",
      mode: "pro",
      thinking_enabled: true,
      is_plan_mode: true,
      subagent_enabled: false,
      reasoning_effort: "high",
    });
    ctx.fake.settle("completed");
    await ctx.api.sendMessage("thread-1", { text: "Next live turn" });
    expect(ctx.fake.submissions[1]?.payload.context).toMatchObject({
      model_name: "plain",
      mode: "flash",
      thinking_enabled: false,
      is_plan_mode: false,
      subagent_enabled: false,
      reasoning_effort: undefined,
    });
    ctx.wrapper.unmount();
  });

  it("fires accepted callbacks only after the Gateway run start is observed", async () => {
    const ctx = mountStream(ref("thread-1"), { autoStart: false });
    const onAccepted = vi.fn();

    await expect(
      ctx.api.sendMessage("thread-1", { text: "hi" }, undefined, {
        onAccepted,
      }),
    ).resolves.toBe(true);
    expect(onAccepted).not.toHaveBeenCalled();

    ctx.fake.emitStart("thread-1", "run-accepted");
    expect(onAccepted).toHaveBeenCalledTimes(1);
    ctx.wrapper.unmount();
  });

  it("rejects a create-stage failure before accepted callbacks can clear retry state", async () => {
    const ctx = mountStream(ref("thread-1"), { failBeforeStart: true });
    const onAccepted = vi.fn();

    await expect(
      ctx.api.sendMessage("thread-1", { text: "keep me" }, undefined, {
        onAccepted,
      }),
    ).rejects.toThrow("Run creation rejected.");
    expect(onAccepted).not.toHaveBeenCalled();
    expect(ctx.api.messages.value).toEqual([]);
    ctx.wrapper.unmount();
  });

  it("passes the runner wire messages to onFinish even when durable state omits messages", () => {
    const onFinish = vi.fn();
    const ctx = mountStream(ref("thread-1"), {}, onFinish);
    const finalMessages = [
      {
        id: "tool-result-1",
        type: "tool",
        tool_call_id: "setup-agent-1",
        status: "success",
        content: "Agent saved.",
      } as Message,
    ];

    ctx.fake.setMessages(finalMessages);
    ctx.fake.settle("completed");

    expect(onFinish).toHaveBeenCalledOnce();
    expect(onFinish).toHaveBeenCalledWith({}, finalMessages);
    ctx.wrapper.unmount();
  });

  it("keeps a prepared bootstrap thread visible before the route adopts its id", async () => {
    vi.useFakeTimers();
    const preparedThreadId = ref<string | null>(null);
    const ctx = mountStream(ref(null), {}, undefined, preparedThreadId);
    preparedThreadId.value = "bootstrap-thread";

    await ctx.api.sendMessage("bootstrap-thread", { text: "Design an agent" });
    ctx.fake.setMessages([
      {
        id: "bootstrap-answer",
        type: "ai",
        content: "Let's design the agent before saving.",
      } as Message,
    ]);
    await settleCoalescing();

    expect(ctx.api.messages.value.map((message) => message.id)).toContain(
      "bootstrap-answer",
    );
    ctx.wrapper.unmount();
    vi.useRealTimers();
  });
});

describe("useThreadStream · C8/C9 本地回合顺序锚点", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("把先于 human 到达的 AI 步骤移到 human 之后，并在 finish 之后保持", async () => {
    const ctx = mountStream();

    await ctx.api.sendMessage("thread-1", { text: "Build a presentation" });
    await flushPromises();

    // 协议顺序：AI 步骤先到，human 后到（messages-tuple 先于 values）。
    ctx.fake.setMessages([earlyAssistantStep, injectedHuman]);
    await settleCoalescing();

    // 正面特征：**顺序数组本身**。只断言「两条都在」的话，没恢复顺序也会绿。
    expect(ctx.api.messages.value.map((m) => m.id)).toEqual([
      injectedHuman.id,
      earlyAssistantStep.id,
    ]);

    ctx.fake.settle("completed");
    await settleCoalescing();

    // C9：基线保持到 finish 之后。清早了这里就会退回协议顺序。
    expect(ctx.api.messages.value.map((m) => m.id)).toEqual([
      injectedHuman.id,
      earlyAssistantStep.id,
    ]);
    ctx.wrapper.unmount();
  });

  it("没有本地提交时不动协议顺序（基线为 null，不是空 set）", async () => {
    const ctx = mountStream();
    vi.useRealTimers();
    vi.useFakeTimers();
    // 直接灌消息，不经过 sendMessage —— 重连 / 别的客户端起的 run 就是这个形状。
    ctx.fake.setMessages([earlyAssistantStep, injectedHuman]);
    await settleCoalescing();

    expect(ctx.api.messages.value.map((m) => m.id)).toEqual([
      earlyAssistantStep.id,
      injectedHuman.id,
    ]);
    ctx.wrapper.unmount();
  });
});

describe("useThreadStream · A7 gap 恢复", () => {
  it("清空乐观消息、失效缓存、发出本地化恢复警告", async () => {
    const ctx = mountStream();
    await ctx.api.sendMessage("thread-1", { text: "hi" });
    await flushPromises();
    expect(ctx.api.messages.value.length).toBe(1);

    ctx.invalidated.length = 0;
    ctx.fake.emitCustom({ type: "stream_replay_gap", run_id: "run-1" });
    await flushPromises();

    // 四条正面特征，缺一条都说明 A7 只做了一半。
    expect(ctx.api.messages.value).toEqual([]);
    expect(ctx.warnings).toEqual(["conversation.streamReplayGap"]);
    expect(ctx.invalidated).toContainEqual(["thread-messages", "thread-1"]);
    // 第四条：这个 key 在**两份词典里都查得到**。
    // 只断言「发出了 key」的话，词典改名后 A7 会静默退化成给用户看一行
    // 原始 key，而用例照绿——M3 那条假绿教训在本层的形态。
    for (const dictionary of [enUS, zhCN]) {
      expect(dictionary.conversation.streamReplayGap).toBeTypeOf("string");
      expect(dictionary.conversation.streamReplayGap.length).toBeGreaterThan(0);
    }
    ctx.wrapper.unmount();
  });

  it("非 gap 的 custom 事件不清空任何东西", async () => {
    const ctx = mountStream();
    await ctx.api.sendMessage("thread-1", { text: "hi" });
    await flushPromises();

    ctx.fake.emitCustom({ type: "task_running", task_id: "t-1" });
    await flushPromises();

    expect(ctx.api.messages.value.length).toBe(1);
    expect(ctx.warnings).toEqual([]);
    ctx.wrapper.unmount();
  });
});

describe("useThreadStream · A8 停止后的两轮失效", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("stop 立刻失效五个 key，并在 1.5 秒后再来一轮", async () => {
    vi.useFakeTimers();
    const ctx = mountStream();
    await ctx.api.sendMessage("thread-1", { text: "hi" });
    await vi.advanceTimersByTimeAsync(0);

    ctx.invalidated.length = 0;
    await ctx.api.stop();
    // thread 级那四条要等在飞的取数先被取消掉才发得出去，见
    // `cache-invalidation.ts` 的 `restartThreadScopedQueries`。**这一步不能省**：
    // 省掉它这条用例只看得见全局那两类，而 A8 数的是六个。
    await vi.advanceTimersByTimeAsync(0);

    const firstRound = [...ctx.invalidated];
    expect(firstRound).toEqual([
      ["threads", "searchInfinite"],
      ["thread", "thread-1"],
      ["thread-messages", "thread-1"],
      ["thread", "metadata", "thread-1"],
      ["thread-token-usage", "thread-1"],
    ]);

    // 延迟那一次是 A8 的后半句：后端可能在 stop 之后才把标题定稿。
    await vi.advanceTimersByTimeAsync(1500);
    expect(ctx.invalidated.length).toBe(firstRound.length * 2);
    ctx.wrapper.unmount();
    vi.useRealTimers();
  });
});

describe("useThreadStream · 标题定稿写回侧栏缓存", () => {
  // 第一版这里错用了 `upsertThreadIn*`（那两个上游只在 onCreated 用），
  // 于是要造一个假的完整 AgentThread 去喂类型。这条用例钉住正确语义：
  // **只补丁 title，其余字段一个都不动**，并且不认识的 thread 不受影响。
  it("只改匹配 thread 的 values.title，不碰 metadata/status", async () => {
    const ctx = mountStream();
    /*
      写的是**真实那张列表缓存**（无限查询）。原来这里挂的是
      `["threads","search"]`——本仓没有任何查询拥有它，这条用例因此自己造了一个
      生产里不存在的拥有者，验的是一段到不了的代码。
    */
    ctx.queryClient.setQueryData(
      [...INFINITE_THREADS_QUERY_KEY_PREFIX, "all"],
      {
        pages: [
          {
            threads: [
              {
                thread_id: "thread-1",
                status: "idle",
                metadata: { agent_name: "lead" },
                values: { title: "New chat", messages: [] },
              },
              {
                thread_id: "thread-2",
                status: "idle",
                metadata: {},
                values: { title: "Other", messages: [] },
              },
            ],
            nextOffset: null,
          },
        ],
        pageParams: [0],
      },
    );

    ctx.fake.emitUpdate({ some_node: { title: "Generated Title" } });
    await flushPromises();

    const rows = ctx.queryClient
      .getQueryData<import("@/core/threads/infinite").InfiniteThreadsData>([
        ...INFINITE_THREADS_QUERY_KEY_PREFIX,
        "all",
      ])
      ?.pages.flatMap((page) => page.threads);
    expect(rows?.[0]?.values.title).toBe("Generated Title");
    // 正面特征：**其余字段原样**。用 upsert 的那一版会把 metadata 冲掉。
    expect(rows?.[0]?.metadata).toEqual({ agent_name: "lead" });
    expect(rows?.[0]?.status).toBe("idle");
    expect(rows?.[1]?.values.title).toBe("Other");
    ctx.wrapper.unmount();
  });

  it("缓存里没有这条 thread 时不凭空插入", async () => {
    const ctx = mountStream();
    ctx.queryClient.setQueryData(
      [...INFINITE_THREADS_QUERY_KEY_PREFIX, "all"],
      { pages: [{ threads: [], nextOffset: null }], pageParams: [0] },
    );

    ctx.fake.emitUpdate({ some_node: { title: "Generated Title" } });
    await flushPromises();

    expect(
      ctx.queryClient.getQueryData([
        ...INFINITE_THREADS_QUERY_KEY_PREFIX,
        "all",
      ]),
    ).toEqual({ pages: [{ threads: [], nextOffset: null }], pageParams: [0] });
    ctx.wrapper.unmount();
  });
});

describe("useThreadStream · new → 真 id 不是「切换 thread」（C9 的边界）", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  // `/chats/new` 提交后 URL 会 replace 成后端建出的 id，threadId 从 null 变成
  // 具体值。照 C9 字面意思清场，第一个回合的 C8 重排就没了——先到的 AI 步骤
  // 会永远排在 human 前面。这条 bug 是 `make e2e-stream` 撞出来的：
  // route.fulfill 那份用例里整条流在导航之前就到齐了，照绿。
  it("URL 从 new 换成真 id 之后，C8 的顺序锚点仍然有效", async () => {
    const threadId = ref<string | null>(null);
    const ctx = mountStream(threadId);

    await ctx.api.sendMessage("thread-1", { text: "Build a deck" });
    await flushPromises();
    // runner 通过 onStart 宣告真实 id，随后路由把它写进 URL。
    threadId.value = "thread-1";
    await flushPromises();

    ctx.fake.setMessages([earlyAssistantStep, injectedHuman]);
    await settleCoalescing();

    expect(ctx.api.messages.value.map((m) => m.id)).toEqual([
      injectedHuman.id,
      earlyAssistantStep.id,
    ]);
    ctx.wrapper.unmount();
  });

  it("换到另一个 thread 仍然清场（这条不能被上面那条放宽掉）", async () => {
    const threadId = ref<string | null>("thread-1");
    const ctx = mountStream(threadId);

    await ctx.api.sendMessage("thread-1", { text: "Build a deck" });
    await flushPromises();

    threadId.value = "thread-2";
    await flushPromises();

    ctx.fake.setMessages([earlyAssistantStep, injectedHuman]);
    await settleCoalescing();

    // 基线被清掉了 → 不重排，按协议顺序显示。
    expect(ctx.api.messages.value.map((m) => m.id)).toEqual([
      earlyAssistantStep.id,
      injectedHuman.id,
    ]);
    ctx.wrapper.unmount();
    vi.useRealTimers();
  });
});

/*
  打开线程时的 checkpoint 种子接线（wave 8）。

  上游这一步在 SDK 里：`useStream({ fetchStateHistory: { limit: 1 } })` 每次
  threadId 变化取一次 `POST /history`，取到的 values 成为
  `values = stream.values ?? historyValues` 的兜底，于是没有 run 的时候
  `thread.messages` 就是 checkpoint 的消息。本仓自己实现 runner，这一段就得
  自己接，接错的两种形状都在下面有对应用例：多发一次请求（对照台账会多一行
  Vue 独有的 `/history`），以及晚到的种子盖掉正在流的消息。
*/
describe("useThreadStream · 打开线程时的 checkpoint 种子", () => {
  function stubSeed(entries: unknown, extra?: (url: string) => Response) {
    const urls: string[] = [];
    const bodies: (string | undefined)[] = [];
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        urls.push(url);
        if (url.includes("/history")) {
          bodies.push(init?.body === undefined ? undefined : String(init.body));
          return new Response(JSON.stringify(entries), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return (
          extra?.(url) ??
          new Response("{}", {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    return { urls, bodies };
  }

  const SUMMARY_ENTRIES = [
    {
      values: {
        title: "Summarized",
        messages: [
          { id: "checkpoint-human", type: "human", content: "old question" },
          { id: "checkpoint-ai", type: "ai", content: "summary of the turn" },
        ],
      },
    },
  ];

  it("打开线程时取一次 POST /history{limit:1}，checkpoint 消息进入渲染", async () => {
    vi.useRealTimers();
    const { urls, bodies } = stubSeed(SUMMARY_ENTRIES);
    const ctx = mountStream(ref<string | null>("thread-1"));
    await flushPromises();
    await flushPromises();

    const seedUrls = urls.filter((url) => url.includes("/history"));
    expect(seedUrls).toHaveLength(1);
    // 路由本身就是判据：`GET /state` 不带 run_id 与 turn_duration。
    expect(seedUrls[0]).toContain("/api/langgraph/threads/thread-1/history");
    expect(seedUrls[0]).not.toContain("/state");
    expect(bodies[0]).toBe(JSON.stringify({ limit: 1 }));
    expect(ctx.fake.seeds).toHaveLength(1);
    expect(ctx.api.messages.value.map((m) => m.id)).toEqual([
      "checkpoint-human",
      "checkpoint-ai",
    ]);

    ctx.wrapper.unmount();
    vi.unstubAllGlobals();
  });

  it("/chats/new 上不取：还没有这条线程", async () => {
    vi.useRealTimers();
    const { urls } = stubSeed(SUMMARY_ENTRIES);
    const ctx = mountStream(ref<string | null>(null));
    await flushPromises();

    expect(urls.filter((url) => url.includes("/history"))).toEqual([]);

    ctx.wrapper.unmount();
    vi.unstubAllGlobals();
  });

  it("提交之后 URL 才换成真 id 的那条路径上不取（上游的 submittingRef）", async () => {
    vi.useRealTimers();
    const { urls } = stubSeed(SUMMARY_ENTRIES);
    const threadId = ref<string | null>(null);
    const ctx = mountStream(threadId);

    await ctx.api.sendMessage("thread-1", { text: "Build a deck" });
    await flushPromises();
    threadId.value = "thread-1";
    await flushPromises();
    await flushPromises();

    // 少了这道守卫，对照台账上会多出一条 Vue 独有的 `POST /history`。
    expect(urls.filter((url) => url.includes("/history"))).toEqual([]);
    expect(ctx.fake.seeds).toHaveLength(0);

    ctx.wrapper.unmount();
    vi.unstubAllGlobals();
  });

  it("切走之后迟到的种子丢弃，不污染新线程", async () => {
    vi.useRealTimers();
    let releaseSeed!: () => void;
    const seedGate = new Promise<void>((resolve) => (releaseSeed = resolve));
    const seenThreads: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (!url.includes("/history")) {
        return new Response("{}", { status: 200 });
      }
      const threadOfUrl = url.includes("thread-1") ? "thread-1" : "thread-2";
      seenThreads.push(threadOfUrl);
      if (threadOfUrl === "thread-1") await seedGate;
      return new Response(
        JSON.stringify([
          {
            values: {
              messages: [{ id: `${threadOfUrl}-checkpoint`, type: "ai" }],
            },
          },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const threadId = ref<string | null>("thread-1");
    const ctx = mountStream(threadId);
    await flushPromises();
    threadId.value = "thread-2";
    await flushPromises();
    await flushPromises();
    releaseSeed();
    await flushPromises();
    await flushPromises();

    expect(seenThreads).toEqual(["thread-1", "thread-2"]);
    // 正面特征是「显示的是 thread-2 的 checkpoint」，不是「没崩」：
    // 丢弃判据写错时，thread-1 的那一帧会最后落地并把这里换成它。
    expect(ctx.api.messages.value.map((m) => m.id)).toEqual([
      "thread-2-checkpoint",
    ]);

    ctx.wrapper.unmount();
    vi.unstubAllGlobals();
  });

  it("没有 checkpoint 时不种：空数组不能当成一帧「清空」", async () => {
    vi.useRealTimers();
    stubSeed([]);
    const ctx = mountStream(ref<string | null>("thread-1"));
    await flushPromises();
    await flushPromises();

    expect(ctx.fake.seeds).toEqual([]);

    ctx.wrapper.unmount();
    vi.unstubAllGlobals();
  });

  it("种子请求失败时静默降级，历史仍然可用", async () => {
    vi.useRealTimers();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) =>
      String(input).includes("/history")
        ? new Response("{}", { status: 404 })
        : new Response("{}", { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const ctx = mountStream(ref<string | null>("thread-1"));
    await flushPromises();
    await flushPromises();

    expect(ctx.fake.seeds).toEqual([]);
    // 404 属常态（线程刚建、还没有 checkpoint），不该冒成流错误。
    expect(ctx.errors).toEqual([]);

    ctx.wrapper.unmount();
    vi.unstubAllGlobals();
  });
});

it("reactively projects current-run identities and clears the view on settlement and thread departure", async () => {
  const ctx = mountStream();
  try {
    await flushPromises();
    ctx.fake.setStreamingMessageIds(["stale"]);
    expect([...ctx.api.streamingMessageIds.value]).toEqual([]);
    await ctx.fake.submit({ threadId: "thread-1", payload: {} });
    ctx.fake.setStreamingMessageIds(["live"]);
    await flushPromises();
    expect([...ctx.api.streamingMessageIds.value]).toEqual(["live"]);
    const published = ctx.api.streamingMessageIds.value;
    ctx.fake.setStreamingMessageIds(["live", "second"]);
    await flushPromises();
    expect([...ctx.api.streamingMessageIds.value]).toEqual(["live", "second"]);
    expect([...published]).toEqual(["live"]);
    ctx.fake.settle("completed");
    await flushPromises();
    expect([...ctx.api.streamingMessageIds.value]).toEqual([]);
    ctx.fake.setStreamingMessageIds(["late"]);
    await flushPromises();
    expect([...ctx.api.streamingMessageIds.value]).toEqual([]);
    ctx.threadId.value = "other-thread";
    await flushPromises();
    expect([...ctx.api.streamingMessageIds.value]).toEqual([]);
  } finally {
    ctx.wrapper.unmount();
    ctx.queryClient.clear();
  }
});

it("observes new versus reused human provenance without claiming additional messages", async () => {
  const capability = "__deerflow_parity_capture_v1__";
  const eventName = "deerflow:parity-identity:v1";
  const packets: ObservationPacket[] = [];
  const receive = (event: Event) =>
    packets.push((event as CustomEvent<(typeof packets)[number]>).detail);
  Object.defineProperty(window, capability, {
    configurable: true,
    value: { version: 1, token: "human-capture", action: "send:0" },
  });
  window.addEventListener(eventName, receive);
  const ctx = mountStream();
  try {
    await ctx.api.sendMessage("thread-1", { text: "Hello" }, undefined, {
      additionalInputMessages: [
        {
          type: "human",
          id: "historical-context",
          content: "Additional context",
        },
      ],
    });
    expect(packets).toHaveLength(3);
    expect(packets[0]).toMatchObject({
      event: "human.allocate",
      values: { thread: "thread-1", raw: expect.any(String) },
    });
    expect(ctx.fake.submissions[0]).toMatchObject({
      threadId: "thread-1",
      idempotencyKey: packets[0]?.values.raw,
      payload: {
        input: {
          messages: expect.arrayContaining([
            expect.objectContaining({
              id: packets[0]?.values.raw,
              type: "human",
            }),
            expect.objectContaining({
              id: "historical-context",
              type: "human",
            }),
          ]),
        },
      },
    });
    expect(packets[1]).toMatchObject({
      event: "human.submission",
      values: {
        raw: packets[0]!.values.raw,
        thread: "thread-1",
        index: 1,
        messageCount: 2,
        keySource: "default",
        key: packets[0]!.values.raw,
      },
    });
    expect(packets[1]).toMatchObject({
      instance: packets[0]!.instance,
    });
    expect(packets[2]).toMatchObject({
      event: "run.bind",
      instance: packets[0]!.instance,
      values: {
        thread: "thread-1",
        assistant: "lead_agent",
        sourceAction: "send:0",
      },
    });
    ctx.fake.settle("completed");
    await ctx.api.sendMessage("thread-1", { text: "Replay" }, undefined, {
      humanMessageId: "existing-human",
    });
    expect(packets.map((packet) => packet.event)).toEqual([
      "human.allocate",
      "human.submission",
      "run.bind",
      "human.reuse",
      "human.submission",
      "run.bind",
    ]);
    expect(packets[3]?.values).toEqual({
      raw: "existing-human",
      thread: "thread-1",
    });
    expect(ctx.fake.submissions[1]).toMatchObject({
      idempotencyKey: "existing-human",
    });
  } finally {
    ctx.wrapper.unmount();
    window.removeEventListener(eventName, receive);
    Reflect.deleteProperty(window, capability);
  }
});

it("a send rejected by the existing busy guard does not invent another human producer", async () => {
  const capability = "__deerflow_parity_capture_v1__";
  const eventName = "deerflow:parity-identity:v1";
  const packets: { event: string; values: Record<string, unknown> }[] = [];
  const receive = (event: Event) =>
    packets.push((event as CustomEvent<(typeof packets)[number]>).detail);
  Object.defineProperty(window, capability, {
    configurable: true,
    value: { version: 1, token: "human-busy", action: "send:0" },
  });
  window.addEventListener(eventName, receive);
  const ctx = mountStream();
  try {
    await ctx.api.sendMessage("thread-1", { text: "First" });
    await expect(
      ctx.api.sendMessage("thread-1", { text: "Busy" }),
    ).resolves.toBe(false);
    expect(packets.map((packet) => packet.event)).toEqual([
      "human.allocate",
      "human.submission",
      "run.bind",
    ]);
    expect(ctx.fake.submissions).toHaveLength(1);
  } finally {
    ctx.wrapper.unmount();
    window.removeEventListener(eventName, receive);
    Reflect.deleteProperty(window, capability);
  }
});

for (const observed of [false, true])
  it.each([undefined, null, "", "existing-human", "explicit-key"])(
    `keeps the effective submission key and getter order with observation=${observed}, key=%s`,
    async (requested) => {
      const capability = "__deerflow_parity_capture_v1__";
      const eventName = "deerflow:parity-identity:v1";
      const packets: ObservationPacket[] = [];
      const receive = (event: Event) =>
        packets.push((event as CustomEvent<ObservationPacket>).detail);
      if (observed)
        Object.defineProperty(window, capability, {
          configurable: true,
          value: { version: 1, token: "key-source", action: "send:0" },
        });
      window.addEventListener(eventName, receive);
      const order: string[] = [];
      let actual: string | null | undefined = "before-onSend";
      const ctx = mountStream(undefined, undefined, undefined, undefined, {
        onSend: () => {
          order.push("onSend");
          actual = requested;
        },
      });
      const random = vi.spyOn(globalThis.crypto, "randomUUID");
      try {
        await ctx.api.sendMessage("thread-1", { text: "Hello" }, undefined, {
          humanMessageId: "existing-human",
          get idempotencyKey() {
            order.push("key");
            return actual as string | undefined;
          },
        });
        expect(order).toEqual(["onSend", "key"]);
        expect(random).not.toHaveBeenCalled();
        expect(ctx.fake.submissions[0]!.idempotencyKey).toBe(
          requested ?? "existing-human",
        );
        if (observed) {
          expect(packets.map((packet) => packet.event)).toEqual([
            "human.reuse",
            "human.submission",
            "run.bind",
          ]);
          expect(packets[1]!.instance).toBe(packets[0]!.instance);
          expect(packets[1]!.values).toEqual({
            raw: "existing-human",
            thread: "thread-1",
            index: 0,
            messageCount: 1,
            keySource: requested == null ? "default" : "explicit",
            key: requested ?? "existing-human",
          });
        } else expect(packets).toEqual([]);
      } finally {
        random.mockRestore();
        ctx.wrapper.unmount();
        ctx.queryClient.clear();
        window.removeEventListener(eventName, receive);
        Reflect.deleteProperty(window, capability);
      }
    },
  );

it.each(["key-getter", "pre-aborted"])(
  "does not publish a submission for %s failure",
  async (failure) => {
    const capability = "__deerflow_parity_capture_v1__";
    const eventName = "deerflow:parity-identity:v1";
    const packets: ObservationPacket[] = [];
    const receive = (event: Event) =>
      packets.push((event as CustomEvent<ObservationPacket>).detail);
    Object.defineProperty(window, capability, {
      configurable: true,
      value: { version: 1, token: "send-rejected", action: "send:0" },
    });
    window.addEventListener(eventName, receive);
    const ctx = mountStream();
    const cause = new Error("key getter failed");
    const controller = new AbortController();
    if (failure === "pre-aborted") controller.abort();
    try {
      const pending = ctx.api.sendMessage(
        "thread-1",
        { text: "Hello" },
        undefined,
        {
          signal: controller.signal,
          get idempotencyKey(): string {
            throw cause;
          },
        },
      );
      if (failure === "key-getter") await expect(pending).rejects.toBe(cause);
      else await expect(pending).rejects.toMatchObject({ name: "AbortError" });
      expect(ctx.fake.submissions).toEqual([]);
      expect(packets.map((packet) => packet.event)).toEqual(
        failure === "key-getter" ? ["human.allocate"] : [],
      );
    } finally {
      ctx.wrapper.unmount();
      ctx.queryClient.clear();
      window.removeEventListener(eventName, receive);
      Reflect.deleteProperty(window, capability);
    }
  },
);

it.each([false, true])(
  "keeps fresh UUID allocation and submit unchanged with observation=%s",
  async (observed) => {
    const capability = "__deerflow_parity_capture_v1__";
    const eventName = "deerflow:parity-identity:v1";
    if (observed)
      Object.defineProperty(window, capability, {
        configurable: true,
        value: {
          version: 1,
          token: "send-throwing-observer",
          action: "send:0",
        },
      });
    const ctx = mountStream();
    const random = vi
      .spyOn(globalThis.crypto, "randomUUID")
      .mockReturnValue("11111111-1111-4111-8111-111111111111");
    const dispatch = window.dispatchEvent.bind(window);
    let observedCalls = 0;
    const spy = vi
      .spyOn(window, "dispatchEvent")
      .mockImplementation((event) => {
        if (event.type === eventName) {
          observedCalls++;
          throw new Error("observer dispatch failed");
        }
        return dispatch(event);
      });
    try {
      await expect(
        ctx.api.sendMessage("thread-1", { text: "Hello" }),
      ).resolves.toBe(true);
      expect(random).toHaveBeenCalledTimes(1);
      expect(ctx.fake.submissions).toHaveLength(1);
      expect(ctx.fake.submissions[0]).toMatchObject({
        idempotencyKey: "11111111-1111-4111-8111-111111111111",
        payload: {
          input: {
            messages: [
              expect.objectContaining({
                id: "11111111-1111-4111-8111-111111111111",
              }),
            ],
          },
        },
      });
      // allocate, submission and run.bind each attempt one throwing dispatch.
      expect(observedCalls).toBe(observed ? 3 : 0);
    } finally {
      spy.mockRestore();
      random.mockRestore();
      ctx.wrapper.unmount();
      ctx.queryClient.clear();
      Reflect.deleteProperty(window, capability);
    }
  },
);

function observedPreparedReplay(kind: "edit" | "regenerate") {
  const raw = kind === "edit" ? "replacement-observed" : "human-observed";
  return {
    target_run_id: "source-run-observed",
    ...(kind === "edit"
      ? {
          replacement_human_message_id: raw,
          source_message_ids: ["human-observed", "answer-observed"],
        }
      : {}),
    input: {
      messages: [
        {
          type: "human",
          id: raw,
          content: "private replay text",
          additional_kwargs: { retained: "private extra field" },
        },
      ],
      title: "private title",
    },
    checkpoint: { checkpoint_id: "checkpoint-observed", checkpoint_ns: "" },
    metadata: {
      replay_kind: kind,
      regenerate_from_run_id: "source-run-observed",
      regenerate_from_message_id: "answer-observed",
      regenerate_checkpoint_id: "checkpoint-observed",
      ...(kind === "edit"
        ? {
            edit_message_id: raw,
            edit_from_message_id: "human-observed",
            edit_version_group_id: "human-observed",
          }
        : {}),
      unknown: "private metadata",
    },
  };
}

for (const enabled of [false, true])
  for (const kind of ["edit", "regenerate"] as const)
    it(`actual ${kind} replay preserves its prepared provenance across cloning (observation=${enabled})`, async () => {
      const packets: ObservationPacket[] = [];
      const capability = "__deerflow_parity_capture_v1__";
      const eventName = "deerflow:parity-identity:v1";
      const receive = (event: Event) =>
        packets.push((event as CustomEvent<ObservationPacket>).detail);
      const control = {
        version: 1,
        token: "vue-replay-capture",
        action: "replay:0",
      };
      if (enabled)
        Object.defineProperty(window, capability, {
          configurable: true,
          value: control,
        });
      window.addEventListener(eventName, receive);
      const prepared = observedPreparedReplay(kind);
      const response = new Response(JSON.stringify(prepared), {
        headers: { "Content-Type": "application/json" },
      });
      const parse = vi.spyOn(response, "json");
      let resolvePrepare: (value: Response) => void = () => undefined;
      let prepareCalls = 0;
      vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/prepare")) {
          prepareCalls += 1;
          return new Promise<Response>((resolve) => {
            resolvePrepare = resolve;
          });
        }
        if (url.includes("/history"))
          return Promise.resolve(
            new Response("[]", {
              headers: { "Content-Type": "application/json" },
            }),
          );
        throw new Error(`Unexpected fetch: ${url}`);
      });
      const ctx = mountStream();
      const uuid = vi
        .spyOn(globalThis.crypto, "randomUUID")
        .mockReturnValue("11111111-1111-4111-8111-111111111111");
      let pending: Promise<boolean> | undefined;
      try {
        pending =
          kind === "edit"
            ? ctx.api.editAndRegenerateMessage(
                "thread-1",
                "human-observed",
                "private revised text",
                ["human-observed", "answer-observed"],
                { added: "private added field" },
              )
            : ctx.api.regenerateMessage("thread-1", "answer-observed");
        await flushPromises();
        expect(prepareCalls).toBe(1);
        control.action = "later:1";
        resolvePrepare(response);
        expect(await pending).toBe(true);
        expect(parse).toHaveBeenCalledTimes(1);
        expect(uuid).toHaveBeenCalledTimes(1);
        expect(ctx.fake.submissions).toHaveLength(1);
        expect(ctx.fake.submissions[0]).toMatchObject({
          threadId: "thread-1",
          idempotencyKey: "11111111-1111-4111-8111-111111111111",
          payload: {
            checkpoint: prepared.checkpoint,
            metadata: prepared.metadata,
            input: {
              ...prepared.input,
              messages: [
                {
                  ...prepared.input.messages[0],
                  additional_kwargs: {
                    retained: "private extra field",
                    ...(kind === "edit"
                      ? { added: "private added field" }
                      : {}),
                  },
                },
              ],
            },
          },
        });

        if (enabled) {
          expect(
            packets.filter((packet) => packet.event === "replay.begin"),
          ).toHaveLength(1);
          expect(
            packets.find((packet) => packet.event === "replay.begin"),
          ).toMatchObject({
            action: "replay:0",
            values: {
              kind,
              thread: "thread-1",
              source: kind === "edit" ? "human-observed" : "answer-observed",
            },
          });
          expect(
            packets.filter((packet) => packet.event === "replay.adopt"),
          ).toHaveLength(1);
          for (const phase of ["response", "attempt"]) {
            expect(
              packets.find(
                (packet) =>
                  packet.event === "replay.message" &&
                  packet.values.phase === phase,
              ),
            ).toMatchObject({
              action: "replay:0",
              values: {
                phase,
                index: 0,
                type: "human",
                raw: prepared.input.messages[0]!.id,
              },
            });
            expect(
              packets.find(
                (packet) =>
                  packet.event === "replay.snapshot" &&
                  packet.values.phase === phase,
              ),
            ).toMatchObject({
              values: { phase, complete: true, messageCount: 1 },
            });
          }
          expect(packets.some((packet) => packet.event === "invalid")).toBe(
            false,
          );
          expect(new Set(packets.map((packet) => packet.instance)).size).toBe(
            1,
          );
          expect(JSON.stringify(packets)).not.toContain("private");
        } else expect(packets).toEqual([]);

        if (enabled)
          expect(
            packets.find((packet) => packet.event === "idempotency.allocate"),
          ).toMatchObject({
            action: "replay:0",
            values: {
              raw: "11111111-1111-4111-8111-111111111111",
              thread: "thread-1",
            },
          });
      } finally {
        resolvePrepare(response);
        await pending;
        uuid.mockRestore();
        parse.mockRestore();
        ctx.wrapper.unmount();
        ctx.queryClient.clear();
        window.removeEventListener(eventName, receive);
        Reflect.deleteProperty(window, capability);
        vi.unstubAllGlobals();
      }
    });

for (const enabled of [false, true])
  it(`replay observation preserves the actual UUID then assistant read (enabled=${enabled})`, async () => {
    Reflect.deleteProperty(window, "__deerflow_parity_capture_v1__");
    const capture = enabled ? captureActualReplay() : undefined;
    const order: string[] = [];
    const assistant = ref("assistant-on-submit");
    const getter = vi
      .spyOn(assistant, "value", "get")
      .mockImplementation(() => {
        order.push("assistant");
        return "assistant-on-submit";
      });
    const uuid = vi
      .spyOn(globalThis.crypto, "randomUUID")
      .mockImplementation(() => {
        order.push("uuid");
        return "11111111-1111-4111-8111-111111111111";
      });
    let resolvePrepare: (value: Response) => void = () => undefined;
    vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/prepare"))
        return new Promise<Response>((resolve) => {
          resolvePrepare = resolve;
        });
      if (url.includes("/history")) return Promise.resolve(new Response("[]"));
      throw new Error(`Unexpected fetch: ${url}`);
    });
    const ctx = mountStream(ref("thread-1"), {}, undefined, undefined, {
      assistantId: assistant,
    });
    let pending: Promise<boolean> | undefined;
    const response = new Response(
      JSON.stringify(observedPreparedReplay("regenerate")),
      { headers: { "Content-Type": "application/json" } },
    );
    try {
      await flushPromises();
      getter.mockClear();
      uuid.mockClear();
      order.length = 0;
      pending = ctx.api.regenerateMessage("thread-1", "answer-observed");
      await flushPromises();
      const prepareReads = getter.mock.calls.length;
      const prepareOrder = [...order];
      resolvePrepare(response);
      expect(await pending).toBe(true);
      expect(prepareReads).toBe(0);
      expect(prepareOrder).toEqual([]);
      expect(order).toEqual(["uuid", "assistant"]);
      expect(uuid).toHaveBeenCalledTimes(1);
      if (enabled)
        expect(
          capture?.packets.find(
            (packet) => packet.event === "replay.submission",
          ),
        ).toMatchObject({ values: { assistant: "assistant-on-submit" } });
      expect(getter).toHaveBeenCalledTimes(1);
      expect(ctx.fake.submissions[0]?.payload.assistant_id).toBe(
        "assistant-on-submit",
      );
    } finally {
      resolvePrepare(response);
      await pending;
      getter.mockRestore();
      uuid.mockRestore();
      capture?.dispose();
      ctx.wrapper.unmount();
      ctx.queryClient.clear();
      vi.unstubAllGlobals();
    }
  });

for (const status of ["failed", "cancelled"] as const)
  it(`retains the replay attempt while recording the runner's ${status} outcome`, async () => {
    const packets: ObservationPacket[] = [];
    const capability = "__deerflow_parity_capture_v1__";
    const eventName = "deerflow:parity-identity:v1";
    const receive = (event: Event) =>
      packets.push((event as CustomEvent<ObservationPacket>).detail);
    Object.defineProperty(window, capability, {
      configurable: true,
      value: { version: 1, token: "replay-outcome", action: "replay:0" },
    });
    window.addEventListener(eventName, receive);
    vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/prepare"))
        return Promise.resolve(
          new Response(JSON.stringify(observedPreparedReplay("regenerate")), {
            headers: { "Content-Type": "application/json" },
          }),
        );
      if (url.includes("/history")) return Promise.resolve(new Response("[]"));
      throw new Error(`Unexpected fetch: ${url}`);
    });
    let release: () => void = () => undefined;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    const ctx = mountStream(ref("thread-1"), {
      failBeforeStart: status === "failed",
      submitBarrier: () => barrier,
    });
    let pending: Promise<boolean> | undefined;
    try {
      pending = ctx.api.regenerateMessage("thread-1", "answer-observed");
      await flushPromises();
      expect(ctx.fake.submissions).toHaveLength(1);
      if (status === "cancelled") ctx.fake.settle("cancelled");
      release();
      expect(await pending).toBe(false);
      expect(
        packets.find((packet) => packet.event === "replay.failure"),
      ).toMatchObject({ values: { status } });
      expect(
        packets.find(
          (packet) =>
            packet.event === "replay.snapshot" &&
            packet.values.phase === "attempt",
        ),
      ).toMatchObject({ values: { complete: true } });
      expect(
        packets.filter((packet) => packet.event === "replay.adopt"),
      ).toHaveLength(1);
    } finally {
      release();
      await pending;
      ctx.wrapper.unmount();
      ctx.queryClient.clear();
      window.removeEventListener(eventName, receive);
      Reflect.deleteProperty(window, capability);
      vi.unstubAllGlobals();
    }
  });

function captureActualReplay() {
  const packets: ObservationPacket[] = [];
  const capability = "__deerflow_parity_capture_v1__";
  const eventName = "deerflow:parity-identity:v1";
  const control = { version: 1, token: "boundary-capture", action: "replay:0" };
  const receive = (event: Event) =>
    packets.push((event as CustomEvent<ObservationPacket>).detail);
  Object.defineProperty(window, capability, {
    configurable: true,
    value: control,
  });
  window.addEventListener(eventName, receive);
  return {
    packets,
    control,
    dispose() {
      window.removeEventListener(eventName, receive);
      Reflect.deleteProperty(window, capability);
    },
  };
}

for (const kind of ["edit", "regenerate"] as const)
  for (const mode of [
    "thread-switch",
    "unmount",
    "http-error",
    "json-error",
    "submit-throw",
    "capture-replaced",
  ] as const)
    it(`actual ${kind} provenance preserves its original owner through ${mode}`, async () => {
      let resolvePrepare: (value: Response) => void = () => undefined;
      let prepareCalls = 0;
      let signal: AbortSignal | null | undefined;
      vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/prepare")) {
          prepareCalls += 1;
          signal = init?.signal;
          return new Promise<Response>((resolve) => {
            resolvePrepare = resolve;
          });
        }
        if (url.includes("/history"))
          return Promise.resolve(new Response("[]"));
        throw new Error(`Unexpected fetch: ${url}`);
      });
      const ctx = mountStream(ref("thread-1"), {
        submitBarrier: async () => {
          if (mode === "submit-throw")
            throw new Error("private submission failure");
        },
      });
      const capture = captureActualReplay();
      let pending: Promise<boolean> | undefined;
      let unmounted = false;
      const retired = mode === "thread-switch" || mode === "unmount";
      const prepared = observedPreparedReplay(kind);
      try {
        pending =
          kind === "edit"
            ? ctx.api.editAndRegenerateMessage(
                "thread-1",
                "human-observed",
                "private revised text",
                ["human-observed", "answer-observed"],
              )
            : ctx.api.regenerateMessage("thread-1", "answer-observed");
        await flushPromises();
        expect(prepareCalls).toBe(1);
        expect(capture.packets.map((packet) => packet.event)).toEqual([
          "replay.begin",
        ]);
        capture.control.action = "later:1";
        if (mode === "thread-switch") {
          ctx.threadId.value = "thread-2";
          await flushPromises();
        } else if (mode === "unmount") {
          ctx.wrapper.unmount();
          unmounted = true;
        } else if (mode === "capture-replaced")
          capture.control.token = "replacement-capture";
        if (retired) expect(signal?.aborted).toBe(true);
        const response =
          mode === "http-error"
            ? new Response(JSON.stringify({ detail: "private denied" }), {
                status: 409,
                headers: { "Content-Type": "application/json" },
              })
            : new Response(
                mode === "json-error"
                  ? "{ private invalid json"
                  : JSON.stringify(prepared),
                { headers: { "Content-Type": "application/json" } },
              );
        resolvePrepare(response);
        const accepted = await pending;

        expect(accepted).toBe(mode === "capture-replaced");
        expect(ctx.fake.submissions.length).toBe(
          mode === "submit-throw" || mode === "capture-replaced" ? 1 : 0,
        );
        expect(capture.packets[0]).toMatchObject({
          event: "replay.begin",
          action: "replay:0",
          values: { kind, thread: "thread-1" },
        });
        // run.bind records the current point; its initiating action is
        // values.sourceAction (run-observation.ts), so compare that instead.
        expect(
          capture.packets.every(
            (packet) =>
              packet.capture === "boundary-capture" &&
              (packet.event === "run.bind"
                ? packet.values.sourceAction
                : packet.action) === "replay:0",
          ),
        ).toBe(true);
        expect(JSON.stringify(capture.packets)).not.toContain("private");
        expect(
          capture.packets.some((packet) => packet.event === "invalid"),
        ).toBe(false);
        if (mode === "capture-replaced") {
          expect(capture.packets.map((packet) => packet.event)).toEqual([
            "replay.begin",
          ]);
        } else {
          const expectedPhases =
            mode === "http-error" || mode === "json-error"
              ? []
              : mode === "submit-throw"
                ? ["response", "attempt"]
                : ["response"];
          expect(
            capture.packets
              .filter((packet) => packet.event === "replay.snapshot")
              .map((packet) => packet.values.phase),
          ).toEqual(expectedPhases);
          expect(
            capture.packets
              .filter((packet) => packet.event === "replay.snapshot")
              .every((packet) => packet.values.complete === true),
          ).toBe(true);
          expect(
            capture.packets.filter((packet) => packet.event === "replay.adopt"),
          ).toHaveLength(mode === "submit-throw" ? 1 : 0);
          expect(
            capture.packets.filter(
              (packet) => packet.event === "replay.submission",
            ),
          ).toHaveLength(mode === "submit-throw" ? 1 : 0);
          expect(
            capture.packets.filter(
              (packet) => packet.event === "replay.retire",
            ),
          ).toHaveLength(retired ? 1 : 0);
          expect(
            capture.packets.filter(
              (packet) => packet.event === "replay.failure",
            ),
          ).toHaveLength(retired ? 0 : 1);
          if (!retired)
            expect(
              capture.packets.find(
                (packet) => packet.event === "replay.failure",
              ),
            ).toMatchObject({ values: { status: "exception" } });
          expect(capture.packets.at(-1)).toMatchObject({
            event: "replay.finish",
            values: { current: !retired },
          });
        }
      } finally {
        resolvePrepare(new Response(JSON.stringify(prepared)));
        await pending;
        if (!unmounted) ctx.wrapper.unmount();
        ctx.queryClient.clear();
        capture.dispose();
        vi.unstubAllGlobals();
      }
    });
for (const enabled of [false, true])
  for (const sourceShape of ["absent", "empty", "getter"] as const)
    it(`regenerate adopts its exact source list without observation interference (shape=${sourceShape}, enabled=${enabled})`, async () => {
      const emptySources = sourceShape !== "absent";
      vi.useFakeTimers();
      let release: () => void = () => undefined;
      const barrier = new Promise<void>((resolve) => {
        release = resolve;
      });
      const ctx = mountStream(ref("thread-1"), {
        submitBarrier: () => barrier,
      });
      const oldIds = ["answer-observed", "source-step", "unrelated-answer"];
      let pending: Promise<boolean> | undefined;
      let capture: ReturnType<typeof captureActualReplay> | undefined;
      const prepared = {
        ...observedPreparedReplay("regenerate"),
        ...(emptySources ? { source_message_ids: [] } : {}),
      };
      const response = new Response(JSON.stringify(prepared));
      const parse = vi.spyOn(response, "json");
      const readSources = vi.fn(() => [] as string[]);
      if (sourceShape === "getter") {
        Object.defineProperty(prepared, "source_message_ids", {
          get: readSources,
        });
        // Synthetic robustness only: normal JSON cases above use real parsing.
        parse.mockResolvedValue(prepared);
      }
      const uuid = vi
        .spyOn(globalThis.crypto, "randomUUID")
        .mockReturnValue("11111111-1111-4111-8111-111111111111");
      const calls: { url: string; body: unknown }[] = [];
      try {
        await flushPromises();
        ctx.fake.setMessages(
          oldIds.map((id) => ({ id, type: "ai", content: id })),
        );
        await settleCoalescing();
        expect(ctx.api.messages.value.map((message) => message.id)).toEqual(
          oldIds,
        );
        capture = captureActualReplay();
        if (!enabled)
          Reflect.deleteProperty(window, "__deerflow_parity_capture_v1__");
        vi.stubGlobal(
          "fetch",
          (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input);
            if (url.endsWith("/prepare")) {
              calls.push({ url, body: init?.body });
              return Promise.resolve(response);
            }
            if (url.includes("/history"))
              return Promise.resolve(new Response("[]"));
            throw new Error(`Unexpected fetch: ${url}`);
          },
        );
        pending = ctx.api.regenerateMessage("thread-1", "answer-observed", [
          "answer-observed",
          "source-step",
        ]);
        await flushPromises();
        await settleCoalescing();
        expect(calls).toEqual([
          {
            url: expect.stringContaining(
              "/api/threads/thread-1/runs/regenerate/prepare",
            ),
            body: JSON.stringify({ message_id: "answer-observed" }),
          },
        ]);
        expect(ctx.fake.submissions).toHaveLength(1);
        expect(ctx.fake.submissions[0]).toMatchObject({
          idempotencyKey: "11111111-1111-4111-8111-111111111111",
          payload: {
            input: prepared.input,
            checkpoint: prepared.checkpoint,
            metadata: prepared.metadata,
          },
        });
        expect(parse).toHaveBeenCalledTimes(1);
        expect(readSources).toHaveBeenCalledTimes(
          sourceShape === "getter" ? 1 : 0,
        );
        expect(uuid).toHaveBeenCalledTimes(1);
        const visible = ctx.api.messages.value.map((message) => message.id);
        expect(visible.filter((id) => oldIds.includes(id!))).toEqual(
          emptySources ? oldIds : ["unrelated-answer"],
        );
        expect(visible).toContain("human-observed");
        if (enabled) {
          expect(
            capture.packets
              .filter((packet) => packet.event === "replay.snapshot")
              .map((packet) => packet.values),
          ).toEqual(
            ["response", "attempt"].map((phase) => ({
              phase,
              sourcesType:
                sourceShape === "getter"
                  ? "unreadable"
                  : emptySources
                    ? "array"
                    : "absent",
              sourceCount: sourceShape === "getter" ? null : 0,
              messageCount: sourceShape === "getter" ? null : 1,
              complete: sourceShape !== "getter",
            })),
          );
          expect(
            capture.packets.filter((packet) => packet.event === "replay.adopt"),
          ).toHaveLength(1);
          expect(
            capture.packets.some((packet) => packet.event === "invalid"),
          ).toBe(sourceShape === "getter");
        } else expect(capture.packets).toEqual([]);
        release();
        expect(await pending).toBe(true);
      } finally {
        release();
        await pending;
        capture?.dispose();
        parse.mockRestore();
        uuid.mockRestore();
        ctx.wrapper.unmount();
        ctx.queryClient.clear();
        vi.unstubAllGlobals();
        vi.useRealTimers();
      }
    });
