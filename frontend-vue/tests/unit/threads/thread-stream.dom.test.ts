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

// `useThreadHistory` 真的会发请求。这里给一个空历史，让被测对象只剩实时那一路。
vi.mock("@/composables/useThreadHistory", () => ({
  useThreadHistory: () => ({
    messages: ref<Message[]>([]),
    loading: ref(false),
    loadingInitial: ref(false),
    loadingMore: ref(false),
    hasMore: ref(false),
    loadMore: () => Promise.resolve(),
    error: ref(null),
  }),
}));

interface FakeRunner extends ThreadRunner {
  submissions: Parameters<ThreadRunner["submit"]>[0][];
  /** `seedDurableState` 真正收下的那几帧 checkpoint values。 */
  seeds: Record<string, unknown>[];
  emitStart(threadId?: string, runId?: string): void;
  emitCustom(data: unknown): void;
  emitUpdate(data: unknown): void;
  setMessages(messages: Message[]): void;
  settle(status: "completed" | "cancelled"): void;
}

function createFakeRunner(
  options: ThreadRunnerOptions,
  {
    autoStart = true,
    failBeforeStart = false,
  }: { autoStart?: boolean; failBeforeStart?: boolean } = {},
): FakeRunner {
  let messages: Message[] = [];
  let status = "idle";
  const snapshot = {
    state: {},
    messageIds: [],
    messages: {},
    session: { status: "idle" },
    lastActivityAt: 0,
  } as unknown as AgentSnapshot<Record<string, unknown>>;

  const submissions: Parameters<ThreadRunner["submit"]>[0][] = [];
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
    submissions,
    seeds,
    getSnapshot: () => snapshot,
    getWireMessages: () => messages,
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
    },
    stop() {
      status = "cancelled";
    },
    abort() {},
    reset() {},
    flushNotifications() {},
    emitStart(startedThreadId = "thread-1", runId = "run-1") {
      options.onStart?.({ threadId: startedThreadId, runId });
    },
    emitCustom: (data) => options.onCustomEvent?.(data),
    emitUpdate: (data) => options.onUpdateEvent?.(data),
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
        stream_mode: ["values", "messages-tuple", "updates", "custom"],
        stream_resumable: false,
        on_disconnect: "continue",
        input: {
          messages: [
            { id: "human-2", type: "human", content: "Revised prompt" },
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
  runnerOptions: { autoStart?: boolean; failBeforeStart?: boolean } = {},
  onFinish?: (
    state: Record<string, unknown>,
    messages: readonly Message[],
  ) => void,
  displayThreadId?: Ref<string | null>,
  runOptions?: {
    context?: Ref<Record<string, unknown>>;
    model?: Ref<Model | null | undefined>;
  },
) {
  let fake: FakeRunner | undefined;
  let api: ReturnType<typeof useThreadStream> | undefined;
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidated: unknown[][] = [];
  const errors: string[] = [];
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
        notify: {
          warn: (key) => warnings.push(key),
          error: (message) => errors.push(message),
        },
        onFinish,
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
    invalidated,
    queryClient,
  };
}

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
  it("普通发送显式请求消息分片、全量状态、更新与自定义事件", async () => {
    const ctx = mountStream();

    await ctx.api.sendMessage("thread-1", { text: "hi" });

    expect(ctx.fake.submissions).toHaveLength(1);
    expect(ctx.fake.submissions[0]?.payload.stream_mode).toEqual([
      "values",
      "messages-tuple",
      "updates",
      "custom",
    ]);
    expect(ctx.fake.submissions[0]?.payload).toMatchObject({
      stream_resumable: false,
      on_disconnect: "continue",
    });
    ctx.wrapper.unmount();
  });

  it("sends the same mode-derived reasoning context as React for a thinking-only model", async () => {
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
      reasoning_effort: "medium",
      thread_id: "thread-1",
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
          [
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
        ],
        pageParams: [0],
      },
    );

    ctx.fake.emitUpdate({ some_node: { title: "Generated Title" } });
    await flushPromises();

    const rows = ctx.queryClient
      .getQueryData<{
        pages: {
          thread_id: string;
          status: string;
          metadata: Record<string, unknown>;
          values: { title: string };
        }[][];
      }>([...INFINITE_THREADS_QUERY_KEY_PREFIX, "all"])
      ?.pages.flat();
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
      { pages: [[]], pageParams: [0] },
    );

    ctx.fake.emitUpdate({ some_node: { title: "Generated Title" } });
    await flushPromises();

    expect(
      ctx.queryClient.getQueryData([
        ...INFINITE_THREADS_QUERY_KEY_PREFIX,
        "all",
      ]),
    ).toEqual({ pages: [[]], pageParams: [0] });
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
