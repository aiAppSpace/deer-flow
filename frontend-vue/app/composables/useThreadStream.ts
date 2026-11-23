/*
  【文件职责】     一个 thread 的完整数据流：历史 + 实时 + 乐观三路的归并与生命周期。
  【架构位置】     L3（Vue 适配）
  【主要导出】     useThreadStream
  【依赖关系】     @/core/agent-deerflow/thread-runner · @/core/threads/*
                   ./useThreadHistory · ./useCoalescedStreamMessages
  【边界与注意】   ⚠️ **本文件承载 05 C5 / C8 / C9 与 A7 / A8 的生命周期部分。**
                   排序与归并的规则在 `@/core/threads/` 的纯函数里，这里只管
                   「什么时候取基线、什么时候清、什么时候失效缓存」。

                   三个 ref 的生命周期是 C9 的全部内容，值得逐条写死：
                   - `localTurnOrderBaseline`：**非 null 才代表「本地提交过」**。
                     空 set 与 null 不是一回事——新 thread 的第一次提交基线就是
                     空 set，把它当 null 会让第一个回合失去顺序锚点。
                     finish / stop / error **之后仍然保留**（协议的瞬态顺序会活到
                     settled 帧），下一次本地提交时替换，切 thread 或 gap 时清除。
                   - `transientHistoryBridge*`：只在当前 thread 有效，用
                     `transientHistoryThreadId` 守着，跨 thread 一律不生效。
                   - `renderedMessageSnapshot`：run 作用域的已提交账本（C3）。

                   **A7 的触发点是 `custom` 帧里的 `stream_replay_gap`**，
                   不是合成的那帧 `values`——见 gap-recovery.ts 里同名的注释，
                   那是本窗口实测订正 06 的一处。

                   `isMock` 上游有 23 处，这里**一处都没有**。mock 流的替身是
                   注入 `runnerFactory`：测试给一个假 runner，代码路径与生产完全
                   同一条。上游那 23 个分支等于让生产路径与测试路径分叉，
                   而分叉的那一侧没有测试。
*/

import { useQueryClient } from "@tanstack/vue-query";
import {
  computed,
  onScopeDispose,
  ref,
  shallowRef,
  toValue,
  triggerRef,
  watch,
  type MaybeRefOrGetter,
  type Ref,
} from "vue";

import type { DeerFlowRunHandle } from "@/core/agent-deerflow/endpoints";
import type {
  ThreadRunner,
  ThreadRunnerOptions,
} from "@/core/agent-deerflow/thread-runner";
import {
  createThreadRunner,
  STREAMING_STATUSES,
} from "@/core/agent-deerflow/thread-runner";
import { createDeerFlowRunProtocol } from "@/core/agent-deerflow/run-protocol";
import { loadDeerFlowRunState } from "@/core/agent-deerflow/run-state";
import { getBackendBaseURL, getLangGraphBaseURL } from "@/core/config";
import { createParityObserver } from "@/core/diagnostics/parity-observation";
import { createReplayObservation } from "@/core/diagnostics/replay-observation";
import { bindRunInput } from "@/core/diagnostics/run-observation";
import { fetch as fetchWithAuth } from "@/core/api/fetcher";
import { throwGatewayResponseError } from "@/core/api/errors";
import { captureWorkspaceQueryOwner } from "@/core/auth/workspace-queries";
import {
  buildThreadCheckpointSeedUrl,
  checkpointSeedValues,
} from "@/core/threads/checkpoint-seed";
import {
  createGapRecoveryReset,
  invalidateThreadCaches,
  invalidateStoppedThreadCaches,
  stopThreadAndInvalidateCaches,
} from "@/core/threads/cache-invalidation";
import {
  INFINITE_THREADS_QUERY_KEY_PREFIX,
  mapInfiniteThreadsCache,
  type InfiniteThreadsData,
} from "@/core/threads/infinite";
import type { AgentThread } from "@/core/threads/types";
import {
  restoreLocalTurnMessageOrder,
  restoreReconnectedTurnMessageOrder,
} from "@/core/threads/local-turn-order";
import {
  isNonEmptyString,
  messageIdentity,
  removeSetItems,
} from "@/core/threads/message-identity";
import {
  areOptimisticMessagesConfirmed,
  computeSummarizationTransientMessages,
  EMPTY_MESSAGES,
  EMPTY_MESSAGE_IDENTITIES,
  getSummarizationMiddlewareMessages,
  getVisibleOptimisticMessages,
  mergeMessages,
  mergeRenderedMessageLedger,
  mergeTransientHistoryBridge,
  mergeTransientHistoryBridgeOrder,
  pruneConfirmedTransientMessages,
  resolveThreadTransientHistoryBridge,
} from "@/core/threads/message-merge";
import {
  buildRunContext,
  buildThreadSubmitMessages,
  clientTimezoneContext,
  type ThreadRunContextInput,
  type ThreadSubmitSnapshot,
} from "@/core/threads/submit";
import { isHiddenFromUIMessage } from "@/core/messages/utils";
import type { FileInMessage } from "@/core/messages/utils";
import type { ComposerRunSnapshot } from "@/core/threads/composer-submit";
import type { Model } from "@/core/models/types";
import type { Message } from "@/core/types/message";
import {
  clearThreadRetryNotice,
  createThreadCustomEventState,
  reduceThreadCustomEvent,
} from "@/core/tasks/custom-event";

import { useCoalescedStreamMessages } from "./useCoalescedStreamMessages";
import { useThreadHistory } from "./useThreadHistory";

export interface ThreadStreamNotifier {
  /** 本地化恢复警告（05 A7）。key 是字典路径，文案由调用方取。 */
  warn: (key: string) => void;
  error: (message: string) => void;
  /** React's plain toast(message): no status icon or text-based deduplication. */
  message?: (message: string) => void;
}

export interface UseThreadStreamOptions {
  threadId: MaybeRefOrGetter<string | null | undefined>;
  displayThreadId?: MaybeRefOrGetter<string | null | undefined>;
  context: MaybeRefOrGetter<ThreadRunContextInput>;
  assistantId?: MaybeRefOrGetter<string>;
  model?: MaybeRefOrGetter<Model | null | undefined>;
  notify?: ThreadStreamNotifier;
  onSend?: (threadId: string) => void;
  onStart?: (threadId: string, runId: string) => void;
  onFinish?: (
    state: Record<string, unknown>,
    messages: readonly Message[],
  ) => void;
  /** 测试注入点，取代上游的 23 处 `isMock`。 */
  runnerFactory?: (options: ThreadRunnerOptions) => ThreadRunner;
}

const noopNotifier: ThreadStreamNotifier = { warn: () => {}, error: () => {} };

/**
 * 普通提交与 React 使用同一组 stream modes：`messages-tuple` 提供文本/tool-call
 * 分片，`updates` 累积节点状态，`custom` 驱动任务/gap 事件。省略该字段会让 Gateway
 * 退回 `values`-only，回答只能按完整快照刷新，因此创建 run 时显式携带这三个模式。
 *
 * 普通实时流不另订全量 `values`；checkpoint 与 replay-gap 的 durable snapshot
 * 仍通过各自的历史/恢复生命周期进入同一个 runner。消息身份与 stream modes 分开：
 * 本仓 buildThreadSubmitMessages 和 React 提交链都会为 human 生成稳定客户端 ID，
 * 乐观展示与 wire 输入共享该 ID；本仓 accepted snapshot 也保留同一个身份。
 */
const THREAD_STREAM_MODES = ["messages-tuple", "updates", "custom"] as const;

/**
 * Match the React SDK boundary exactly: DeerFlow keeps a disconnected run alive,
 * while the client resumes through Content-Location + Last-Event-ID rather than
 * requesting an unsupported server-side resumable stream.
 *
 * `stream_resumable` is deliberately absent (wave 216). The Gateway declares it
 * as `Literal[False] | None` with a `None` default — "compatibility placeholder;
 * only the SDK's non-resumable default is accepted" (`run_models.py`) — so
 * sending `false` and sending nothing are the same request. The SDK omits it,
 * and a key that can only ever carry its own default is noise on the wire.
 */
const THREAD_RUN_TRANSPORT_OPTIONS = {
  on_disconnect: "continue",
} as const;

function identitiesOf(messages: Message[]): Set<string> {
  return new Set(messages.map(messageIdentity).filter(isNonEmptyString));
}

export function useThreadStream(options: UseThreadStreamOptions) {
  const {
    threadId: threadIdInput,
    displayThreadId: displayThreadIdInput,
    context,
    model,
    notify = noopNotifier,
    onSend,
    onStart,
    onFinish,
    runnerFactory = createThreadRunner,
  } = options;

  const queryClient = useQueryClient();

  const threadId = computed(() => toValue(threadIdInput) ?? null);
  const currentViewThreadId = computed(
    () => toValue(displayThreadIdInput) ?? threadId.value,
  );

  // ---- 本地 UI 状态 -------------------------------------------------------
  const optimisticMessages = ref<Message[]>([]);
  const optimisticThreadId = ref<string | null>(null);
  const liveMessagesThreadId = ref<string | null>(null);
  const pendingSupersededRunIds = ref<ReadonlySet<string>>(new Set());
  const pendingSupersededMessageIds = ref<ReadonlySet<string>>(new Set());
  const isUploading = ref(false);

  // ---- 非响应式簿记（C3 / C8 / C9） --------------------------------------
  let localTurnOrderBaseline: Set<string> | null = null;
  let transientHistoryBridge: Message[] = [];
  let transientHistoryOrder: readonly string[] = EMPTY_MESSAGE_IDENTITIES;
  let transientHistoryThreadId: string | null = null;
  let renderedMessageSnapshot: {
    threadId: string | null;
    messages: Message[];
    order: readonly string[];
  } = {
    threadId: null,
    messages: EMPTY_MESSAGES,
    order: EMPTY_MESSAGE_IDENTITIES,
  };
  let summarizedMessageIds = new Set<string>();
  let sendInFlight = false;
  let submissionGeneration = 0;
  let disposed = false;
  let pendingAcceptedCallback: (() => void) | null = null;
  let startedAnnounced = false;
  let observingRun = false;
  /**
   * 本次 run 真正建出来的 thread id（05 C9 的边界条件）。
   *
   * 新会话是 `/chats/new` 提交 → 后端建出 thread → URL replace 成真 id，
   * 于是 `threadId` 会从 `null` 变成一个具体值。**那不是「切换 thread」**，
   * 是同一个 thread 拿到了自己的身份；照 C9 的字面意思在这里清掉顺序锚点，
   * 第一个回合的 C8 重排当场失效（表现：先到的 AI 步骤永远排在 human 前面）。
   *
   * 上游没踩到这条，只是因为它那份 `local-turn-order` 用例用的是固定
   * `threadId: "thread-1"`，从来没走过 new → id 这一步。
   */
  let adoptedThreadId: string | null = null;
  let pendingFinalizationTimer: ReturnType<typeof setTimeout> | null = null;
  let checkpointSeedGeneration = 0;
  let checkpointSeedController: AbortController | undefined;
  let preparedReplayController: AbortController | null = null;
  let preparedReplayGeneration = 0;
  let pendingPreparedReplay: {
    targetRunId: string;
    supersededMessageIds: readonly string[];
  } | null = null;

  // ---- runner ------------------------------------------------------------
  const snapshotVersion = shallowRef(0);
  const sessionStatus = ref<string>("idle");
  const activeRunId = ref<string | null>(null);
  let notificationOwnerIsCurrent: () => boolean = () => false;
  const customEventState = shallowRef(createThreadCustomEventState());
  const streamError = shallowRef<unknown>(null);

  const runner: ThreadRunner = runnerFactory({
    protocol: createDeerFlowRunProtocol({ baseUrl: getLangGraphBaseURL() }),
    loadDurableState: (handle, signal) =>
      loadDeerFlowRunState({ baseUrl: getLangGraphBaseURL(), handle, signal }),
    onSnapshot() {
      snapshotVersion.value += 1;
      triggerRef(snapshotVersion);
      sessionStatus.value = runner.getSessionState().status;
    },
    onSessionState(state) {
      sessionStatus.value = state.status;
    },
    onStart(handle) {
      handleStreamStart(handle.threadId, handle.runId);
    },
    onUpdateEvent: handleUpdateEvent,
    onCustomEvent: handleCustomEvent,
    onError(error) {
      sessionStatus.value = runner.getSessionState().status;
      handleStreamError(error);
    },
    onSettled(state) {
      sessionStatus.value = state.status;
      if (state.status === "completed" || state.status === "cancelled") {
        handleStreamFinish();
      }
      /*
        run 成功结束就重取一次 checkpoint——上游 SDK 在
        `react/stream.lgp.js` 的 `onSuccess` 里 `await history.mutate(threadId)`
        做的是同一件事（`history` 就是 `threads.getHistory(id, { limit })`）。
        **为什么必须重取**：run 内发生上下文压缩之后，checkpoint 持有的是摘要消息，
        而事件库仍然持有当时流出去的原文；不重取的话本仓要切走再回来才更新。

        **只在 `completed` 上做，不含 `cancelled`。** 上游的取消走 `stop()` →
        `onStop`，那条路不刷历史；跟着它走的顺带好处是：本仓不会在某个只有本仓
        会发请求的时机上多打一条 `/history`，对照台账的请求多重集因此仍然齐平。

        **线程 id 取 `adoptedThreadId` 而不是路由上的那个。** `/chats/new` 提交
        之后路由要过一会儿才换成真 id，run settle 时 `threadId.value` 可能还是
        `null`——那样这一次重取会被静静跳过，而首个回合恰恰是最可能压缩的一回合。
        上游同样用它刚建出来的 `usableThreadId`，不用路由。
      */
      const settledThreadId = adoptedThreadId ?? threadId.value;
      if (state.status === "completed" && settledThreadId !== null) {
        void seedThreadCheckpoint(settledThreadId, "run-end");
      }
    },
  });

  onScopeDispose(() => {
    disposed = true;
    submissionGeneration += 1;
    checkpointSeedGeneration += 1;
    checkpointSeedController?.abort();
    if (pendingFinalizationTimer !== null) {
      clearTimeout(pendingFinalizationTimer);
    }
    preparedReplayGeneration += 1;
    preparedReplayController?.abort();
    preparedReplayController = null;
    customEventState.value = createThreadCustomEventState();
    pendingAcceptedCallback = null;
    runner.dispose();
  });

  // 判据来自 runner（见 STREAMING_STATUSES 的注释）：这里不能直接调
  // `runner.isStreaming()`，那读的是闭包变量、不进依赖收集，按钮不会更新。
  const isStreaming = computed(() =>
    STREAMING_STATUSES.has(sessionStatus.value),
  );

  /*
    ---- 历史 --------------------------------------------------------------

    **run 在跑的时候不取历史**——上游 `enabled: !isMock && !thread.isLoading`
    （hooks.ts:1889）本仓一直缺这一半，只判了 `Boolean(threadId)`。

    上游那条注释讲的是「省掉一次没有可观察效果的取数」。**本仓少了它还多一层
    后果**：`/chats/new` 提交之后 threadId 由 `onStart` 交出来，那一刻 run 已经
    在流——上游此时查询是关的，本仓会当场发一次分页取数，而它带回来的是 run
    之前的世界。run 结束时的那次缓存失效如果恰好落在它还在飞的时候，会被它整个
    吞掉（机制见 `@/core/threads/cache-invalidation` 里
    `restartThreadScopedQuery` 的说明），历史于是永远停在空的。

    **这道门只关得住「threadId 在 run 开始之后才出现」那一类。** 侧边会话是先
    `POST /threads` 拿到 id、再发 run，id 就位时 `isStreaming` 还是 false，
    门是开的——那一类由 `restartThreadScopedQuery` 兜住。两处都要有：
    这里省的是请求（与上游齐平），那里保的是失效一定生效。

    禁用期间 vue-query 继续给出已缓存的页，与上游禁用期间的表现一致；
    `useThreadHistory` 自己的保留区（C6）也仍然兜着已经加载过的行。
  */
  const history = useThreadHistory(() => threadId.value ?? "", {
    enabled: computed(() => Boolean(threadId.value) && !isStreaming.value),
    pendingSupersededRunIds,
    onError: () => notify.error("Failed to load thread history."),
  });

  const visibleHistory = computed(() =>
    threadId.value ? history.messages.value : EMPTY_MESSAGES,
  );

  // ---- 实时消息 ----------------------------------------------------------
  const hasVisibleStreamState = computed(
    () =>
      Boolean(threadId.value) ||
      liveMessagesThreadId.value === currentViewThreadId.value,
  );

  const persistedMessages = computed<Message[]>(() => {
    void snapshotVersion.value;
    if (!hasVisibleStreamState.value) return EMPTY_MESSAGES;
    const masked = pendingSupersededMessageIds.value;
    const filtered = runner
      .getWireMessages()
      .filter((message) => !message.id || !masked.has(message.id));
    return filtered.length === 0 ? EMPTY_MESSAGES : filtered;
  });

  const streamingMessageIds = computed<ReadonlySet<string>>(() => {
    void snapshotVersion.value;
    return isStreaming.value && hasVisibleStreamState.value
      ? runner.getStreamingMessageIds()
      : new Set<string>();
  });

  const humanMessageCount = computed(
    () => persistedMessages.value.filter((m) => m.type === "human").length,
  );
  let previousHumanMessageCount = 0;

  const { messages: renderMessages } = useCoalescedStreamMessages(
    persistedMessages,
    isStreaming,
  );

  // ---- 事件处理 ----------------------------------------------------------
  function handleStreamStart(startedThreadId: string, runId: string) {
    notificationOwnerIsCurrent = captureWorkspaceQueryOwner(queryClient);
    streamError.value = null;
    activeRunId.value = runId;
    if (
      optimisticThreadId.value &&
      (optimisticThreadId.value === currentViewThreadId.value ||
        optimisticThreadId.value === startedThreadId ||
        sendInFlight)
    ) {
      optimisticThreadId.value = startedThreadId;
    }
    if (
      liveMessagesThreadId.value &&
      (liveMessagesThreadId.value === currentViewThreadId.value ||
        liveMessagesThreadId.value === startedThreadId)
    ) {
      liveMessagesThreadId.value = startedThreadId;
    }
    adoptedThreadId = startedThreadId;
    if (!observingRun && !startedAnnounced) {
      onStart?.(startedThreadId, runId);
      startedAnnounced = true;
    }
    const accepted = pendingAcceptedCallback;
    pendingAcceptedCallback = null;
    accepted?.();
  }

  function handleUpdateEvent(data: unknown) {
    customEventState.value = clearThreadRetryNotice(customEventState.value);
    const summarization = getSummarizationMiddlewareMessages(data);
    if (summarization && summarization.length >= 2) {
      for (const message of summarization) {
        // 兼容垫片：旧线程可能还带着 name="summary" 的合成 HumanMessage。
        if (message.name === "summary" && message.type === "human") {
          summarizedMessageIds.add(message.id ?? "");
        }
      }
      const captured = computeSummarizationTransientMessages(
        persistedMessages.value,
        summarization,
        summarizedMessageIds,
        renderedMessageSnapshot.threadId === threadId.value
          ? renderedMessageSnapshot.messages
          : EMPTY_MESSAGES,
      );
      transientHistoryOrder = mergeTransientHistoryBridgeOrder(
        transientHistoryOrder,
        captured,
      );
      transientHistoryBridge = mergeTransientHistoryBridge(
        transientHistoryBridge,
        captured,
      );
      transientHistoryThreadId = threadId.value;
    }

    // 标题定稿：**只补丁已有条目的 title，不 upsert 整条 thread。**
    //
    // 上游把这两件事分得很清楚：`upsertThreadIn*` 只在 `onCreated` 用
    // （那时确实要凭空插一条新 thread 进侧栏），标题更新走的是
    // `setQueriesData` + 只改 `values.title` 的 mapper（hooks.ts:1617/1638）。
    // 第一版这里错用了 upsert，于是不得不造一个假的完整 `AgentThread`
    // 去喂类型——那个占位对象的 `metadata: {}` / `status: "busy"` 会把
    // 侧栏里这条 thread 的真实元数据**覆盖掉**（upsert 的浅并方向是
    // 「已有的赢」，但凭空造出来的字段在缓存为空时会原样落进去）。
    if (typeof data !== "object" || data === null) return;
    const id = threadId.value;
    if (!id) return;
    for (const update of Object.values(data)) {
      const title =
        typeof update === "object" && update !== null
          ? Reflect.get(update, "title")
          : undefined;
      if (typeof title !== "string" || !title) continue;
      const withTitle = (thread: AgentThread): AgentThread =>
        thread.thread_id === id
          ? { ...thread, values: { ...thread.values, title } }
          : thread;

      queryClient.setQueriesData(
        { queryKey: [...INFINITE_THREADS_QUERY_KEY_PREFIX], exact: false },
        (oldData: InfiniteThreadsData | undefined) =>
          mapInfiniteThreadsCache(oldData, withTitle),
      );
    }
  }

  /** task / retry / replay-gap custom 事件只在这一处进入纯 reducer。 */
  function handleCustomEvent(data: unknown) {
    if (
      !disposed &&
      activeRunId.value !== null &&
      STREAMING_STATUSES.has(sessionStatus.value) &&
      notificationOwnerIsCurrent() &&
      typeof data === "object" &&
      data !== null &&
      Reflect.get(data, "type") === "llm_retry"
    ) {
      const message = Reflect.get(data, "message");
      if (typeof message === "string" && message.trim())
        notify.message?.(message);
    }
    const reduced = reduceThreadCustomEvent(customEventState.value, data);
    customEventState.value = reduced.state;
    if (reduced.effect !== "replay_gap") return;

    const reset = createGapRecoveryReset();
    if (reset.clearOptimistic) {
      optimisticMessages.value = [];
      optimisticThreadId.value = null;
      liveMessagesThreadId.value = null;
      pendingSupersededRunIds.value = new Set();
      pendingSupersededMessageIds.value = new Set();
    }
    if (reset.clearTransientBridge) {
      transientHistoryBridge = [];
      transientHistoryOrder = EMPTY_MESSAGE_IDENTITIES;
      transientHistoryThreadId = null;
      summarizedMessageIds = new Set();
      localTurnOrderBaseline = null;
    }
    invalidateStoppedThreadCaches(queryClient, threadId.value);
    notify.warn(reset.warningKey);
  }

  function handleStreamError(error: Error) {
    streamError.value = error;
    pendingAcceptedCallback = null;
    customEventState.value = clearThreadRetryNotice(customEventState.value);
    optimisticMessages.value = [];
    optimisticThreadId.value = null;
    liveMessagesThreadId.value = null;
    pendingSupersededRunIds.value = new Set();
    pendingSupersededMessageIds.value = new Set();
    pendingPreparedReplay = null;
    notify.error(error.message || "Request failed.");
    if (threadId.value) {
      invalidateStoppedThreadCaches(queryClient, threadId.value);
    }
  }

  function handleStreamFinish() {
    customEventState.value = clearThreadRetryNotice(customEventState.value);
    if (pendingPreparedReplay) {
      clearPreparedReplayMasks(
        pendingPreparedReplay.targetRunId,
        pendingPreparedReplay.supersededMessageIds,
      );
      pendingPreparedReplay = null;
    }
    onFinish?.(runner.getSnapshot().state, runner.getWireMessages());
    invalidateStoppedThreadCaches(queryClient, threadId.value);
  }

  // ---- 切 thread 时的清场（C9 的「切换 thread 时清除」） ------------------
  watch(
    threadId,
    (next, previous) => {
      // `new` 提交后 URL 换成真 id：同一个 thread，不清场。见 adoptedThreadId。
      if (previous === null && next !== null && next === adoptedThreadId)
        return;
      submissionGeneration += 1;
      checkpointSeedGeneration += 1;
      checkpointSeedController?.abort();
      adoptedThreadId = null;
      preparedReplayGeneration += 1;
      preparedReplayController?.abort();
      preparedReplayController = null;
      pendingPreparedReplay = null;
      runner.reset();
      activeRunId.value = null;
      customEventState.value = createThreadCustomEventState();
      startedAnnounced = false;
      observingRun = false;
      sendInFlight = false;
      pendingAcceptedCallback = null;
      streamError.value = null;
      transientHistoryBridge = [];
      transientHistoryOrder = EMPTY_MESSAGE_IDENTITIES;
      transientHistoryThreadId = null;
      renderedMessageSnapshot = {
        threadId: null,
        messages: EMPTY_MESSAGES,
        order: EMPTY_MESSAGE_IDENTITIES,
      };
      summarizedMessageIds = new Set();
      localTurnOrderBaseline = null;
      pendingSupersededRunIds.value = new Set();
      pendingSupersededMessageIds.value = new Set();
      previousHumanMessageCount = humanMessageCount.value;
    },
    { flush: "sync" },
  );

  // ---- checkpoint 种子 ----------------------------------------------------
  /*
    打开线程时无条件取一次最新 checkpoint，落进 runner 的 store。

    上游这一步在 SDK 里：`useStream({ fetchStateHistory: { limit: 1 } })` 每次
    threadId 变化都取一次 `POST /history`，取到的 `values` 成为
    `values = stream.values ?? historyValues` 的兜底，于是 `thread.messages`
    在没有 run 的时候**就是 checkpoint 的消息**，再由 `mergeMessages` 覆盖在
    `/messages/page` 的行上（hooks.ts:2588 的注释：thread.messages take precedence）。

    **不取这一次，两个应用在压缩过的线程上显示的内容就不一样。** 上下文压缩之后
    checkpoint 持有的是摘要消息，而事件库仍然持有旧的原始消息；上游显示摘要，
    本仓显示旧原文。`message-merge.ts` 里那一整套「summarized checkpoint /
    protected message / hidden checkpoint control」早就移植过来了，只是打开线程时
    没有任何输入喂给它——这一段就是那个缺掉的输入。台账测不到它：默认夹具的
    `/history` 与 `/messages/page` 返回同一批消息，两条路径的差异要专门造后端状态
    才看得见（tests/e2e-real/summarized-checkpoint.spec.ts）。

    `status !== "idle"` 这一道与 `seedDurableState` 里那一道**不是重复**：
    这里省的是请求（上游 SDK 的 effect 同样有 `submittingRef.current === threadId`
    就 return，`/chats/new` 提交后 threadId 变成真 id 走的正是这条），
    那里守的是「晚到的响应不许覆盖正在流的消息」。少任何一道都会有可观察后果：
    少了这里，对照台账上会多出一条 Vue 独有的 `POST /history`；少了那里，
    首个回合的流会被自己的种子抹掉。

    **打开线程不是唯一的取数时机**（wave 41）：run 成功结束之后还要再取一次，
    见上面 `onSettled` 里那段。那一次走的是 `refreshDurableState`——run settle 之后
    状态停在 `completed`，`seedDurableState` 的 `idle` 判据会把它无声丢掉。
  */
  /**
   * `mode` 决定这一帧交给 runner 的哪个入口，两者只差放行条件：
   * · `open`——打开线程时取的，可能在 run 已经开跑之后才落地，所以只在 `idle` 放行；
   * · `run-end`——因为 run 刚结束才去取的，那时状态停在 `completed`，
   *   走 `seedDurableState` 会被无声丢掉。
   */
  async function seedThreadCheckpoint(id: string, mode: "open" | "run-end") {
    const generation = ++checkpointSeedGeneration;
    const controller = new AbortController();
    checkpointSeedController?.abort();
    checkpointSeedController = controller;
    let entries: unknown;
    try {
      const response = await fetchWithAuth(
        buildThreadCheckpointSeedUrl(getBackendBaseURL(), id),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ limit: 1 }),
          signal: controller.signal,
        },
      );
      if (!response.ok) return;
      entries = await response.json();
    } catch {
      // 取不到种子就是「没有种子」，与后端确实没有 checkpoint 同解：
      // 分页历史仍然完整可用，S8 的「线程是否存在」判据也不读它。
      return;
    }
    // 期间又切了 thread 就丢弃。上游靠 SDK 内部的 `state.key !== key` 做同一件事。
    if (generation !== checkpointSeedGeneration || threadId.value !== id)
      return;
    const values = checkpointSeedValues(entries);
    if (!values) return;
    if (mode === "run-end") runner.refreshDurableState(values);
    else runner.seedDurableState(values);
  }

  watch(
    threadId,
    (id) => {
      if (id === null || runner.getSessionState().status !== "idle") return;
      void seedThreadCheckpoint(id, "open");
    },
    { immediate: true },
  );

  // 历史确认后逐条释放瞬态桥。immediate 见 05 M5：首屏那一批确认不能漏。
  watch(
    visibleHistory,
    (rows) => {
      transientHistoryBridge = pruneConfirmedTransientMessages(
        transientHistoryBridge,
        rows,
      );
      if (transientHistoryBridge.length === 0) {
        transientHistoryOrder = EMPTY_MESSAGE_IDENTITIES;
        transientHistoryThreadId = null;
      }
    },
    { immediate: true },
  );

  watch([currentViewThreadId], ([viewId]) => {
    if (optimisticThreadId.value && optimisticThreadId.value !== viewId) {
      optimisticMessages.value = [];
      optimisticThreadId.value = null;
    }
    if (liveMessagesThreadId.value && liveMessagesThreadId.value !== viewId) {
      liveMessagesThreadId.value = null;
    }
  });

  // 服务端消息到位后清乐观消息。带 human 的那种要等服务端的 human 到（C5 的
  // 「不要按时间戳重排序」正是靠这个等待，而不是靠排序）。
  watch([humanMessageCount, optimisticMessages], ([count, optimistic]) => {
    if (optimistic.length === 0) return;
    const hasHumanOptimistic = optimistic.some((m) => m.type === "human");
    if (!hasHumanOptimistic || count > previousHumanMessageCount) {
      optimisticMessages.value = [];
      optimisticThreadId.value = null;
      return;
    }
    if (areOptimisticMessagesConfirmed(optimistic, persistedMessages.value)) {
      optimisticMessages.value = [];
      optimisticThreadId.value = null;
    }
  });

  // ---- 归并 --------------------------------------------------------------
  const visibleOptimisticMessages = computed(() => {
    const raw = getVisibleOptimisticMessages(
      optimisticThreadId.value === currentViewThreadId.value
        ? optimisticMessages.value
        : EMPTY_MESSAGES,
      previousHumanMessageCount,
      humanMessageCount.value,
    );
    return raw.length === 0 ? EMPTY_MESSAGES : raw;
  });

  const mergedMessages = computed(() => {
    const bridgeOrder =
      transientHistoryBridge.length > 0 &&
      transientHistoryThreadId === threadId.value
        ? mergeTransientHistoryBridgeOrder(
            transientHistoryOrder,
            persistedMessages.value,
          )
        : transientHistoryOrder;
    const previouslyRenderedOrder =
      renderedMessageSnapshot.threadId === threadId.value
        ? renderedMessageSnapshot.order
        : EMPTY_MESSAGE_IDENTITIES;

    const effectiveHistory = resolveThreadTransientHistoryBridge(
      visibleHistory.value,
      transientHistoryBridge,
      transientHistoryThreadId,
      threadId.value,
      bridgeOrder,
      previouslyRenderedOrder,
    );
    const merged = mergeMessages(
      effectiveHistory,
      renderMessages.value,
      visibleOptimisticMessages.value,
    );
    return localTurnOrderBaseline === null
      ? restoreReconnectedTurnMessageOrder(merged)
      : restoreLocalTurnMessageOrder(merged, localTurnOrderBaseline);
  });

  // 已提交显示账本（C3）。immediate 见 05 M5：第一帧就要进账本，
  // 否则第一次压缩救援拿到的是空的。
  watch(
    mergedMessages,
    (messages) => {
      const visible = messages.filter(
        (message) =>
          !isHiddenFromUIMessage(message) &&
          !optimisticMessages.value.some(
            (optimistic) => optimistic.id === message.id,
          ),
      );
      const previousLedger =
        renderedMessageSnapshot.threadId === threadId.value
          ? renderedMessageSnapshot.messages
          : EMPTY_MESSAGES;
      const ledger = mergeRenderedMessageLedger(
        previousLedger,
        visible,
        pendingSupersededMessageIds.value,
      );
      renderedMessageSnapshot = {
        threadId: threadId.value,
        messages: ledger,
        order: ledger.map(messageIdentity).filter(isNonEmptyString),
      };
    },
    { immediate: true },
  );

  // ---- 动作 --------------------------------------------------------------
  async function joinRun(handle: DeerFlowRunHandle): Promise<boolean> {
    if (
      disposed ||
      sendInFlight ||
      runner.isStreaming() ||
      handle.threadId !== currentViewThreadId.value
    )
      return false;
    const generation = ++submissionGeneration;
    sendInFlight = true;
    observingRun = true;
    streamError.value = null;
    localTurnOrderBaseline = null;
    liveMessagesThreadId.value = handle.threadId;
    try {
      await runner.join(handle);
      return !disposed && generation === submissionGeneration;
    } finally {
      if (!disposed && generation === submissionGeneration) {
        sendInFlight = false;
        observingRun = false;
      }
    }
  }

  async function sendMessage(
    targetThreadId: string,
    message: { text: string; files?: FileInMessage[] },
    extraContext?: Record<string, unknown>,
    sendOptions?: {
      additionalInputMessages?: Message[];
      additionalKwargs?: Record<string, unknown>;
      humanMessageId?: string;
      idempotencyKey?: string;
      conversationReferences?: readonly string[];
      onAccepted?: (snapshot: ThreadSubmitSnapshot) => void;
      signal?: AbortSignal;
      runSnapshot?: ComposerRunSnapshot;
    },
  ): Promise<boolean> {
    if (sendOptions?.signal?.aborted) {
      throw new DOMException("The operation was aborted.", "AbortError");
    }
    if (disposed || sendInFlight || runner.isStreaming()) return false;
    const generation = ++submissionGeneration;
    const isCurrentSubmission = () =>
      !disposed && generation === submissionGeneration;
    sendInFlight = true;
    const abortRunner = () => {
      if (isCurrentSubmission()) runner.abort();
    };
    sendOptions?.signal?.addEventListener("abort", abortRunner, { once: true });
    streamError.value = null;
    let acceptedByBackend = false;
    const text = message.text.trim();
    const suppliedHumanId = sendOptions?.humanMessageId;
    const humanMessageId = suppliedHumanId ?? globalThis.crypto.randomUUID();
    // A caller-owned replay identity is a reference, never a fresh allocation.
    // Additional input messages have their own provenance and are untouched.
    const humanObservation = createParityObserver("human:send");
    const humanOrigin = humanObservation?.point();
    humanObservation?.emit(
      suppliedHumanId == null ? "human.allocate" : "human.reuse",
      { raw: humanMessageId, thread: targetThreadId },
      humanOrigin,
    );
    const messages: Message[] = JSON.parse(
      JSON.stringify(
        buildThreadSubmitMessages({
          text,
          humanMessageId,
          additionalInputMessages: sendOptions?.additionalInputMessages ?? [],
          additionalKwargs: sendOptions?.additionalKwargs,
          filesForSubmit: message.files ?? [],
        }),
      ),
    );
    const snapshot: ThreadSubmitSnapshot = {
      threadId: targetThreadId,
      humanMessageId,
      messages,
    };
    pendingAcceptedCallback = () => {
      if (!isCurrentSubmission()) return;
      acceptedByBackend = true;
      sendOptions?.onAccepted?.(snapshot);
    };
    previousHumanMessageCount = humanMessageCount.value;
    // C8：pre-submit 身份基线。空 set 与 null 不同，见文件头。
    localTurnOrderBaseline = identitiesOf(persistedMessages.value);

    const hideFromUI = sendOptions?.additionalKwargs?.hide_from_ui === true;
    const optimistic: Message[] = hideFromUI ? [] : [messages.at(-1)!];

    optimisticThreadId.value = targetThreadId;
    liveMessagesThreadId.value = targetThreadId;
    optimisticMessages.value = optimistic;
    onSend?.(targetThreadId);

    try {
      const requestedKey = sendOptions?.idempotencyKey;
      const idempotencyKey = requestedKey ?? humanMessageId;
      const submission: Parameters<ThreadRunner["submit"]>[0] = {
        threadId: targetThreadId,
        idempotencyKey,
        payload: {
          assistant_id: toValue(options.assistantId) ?? "lead_agent",
          stream_mode: THREAD_STREAM_MODES,
          ...THREAD_RUN_TRANSPORT_OPTIONS,
          input: { messages },
          config: { recursion_limit: 1000 },
          context: {
            ...buildRunContext(
              sendOptions?.runSnapshot?.context ?? toValue(context),
              extraContext,
              sendOptions?.runSnapshot
                ? sendOptions.runSnapshot.model
                : model
                  ? toValue(model)
                  : undefined,
            ),
            ...clientTimezoneContext(),
            ...(sendOptions?.conversationReferences?.length
              ? {
                  conversation_references: [
                    ...sendOptions.conversationReferences,
                  ],
                }
              : {}),
          },
        },
      };
      // An actual runner-call attempt, not HTTP admission or backend success.
      humanObservation?.emit(
        "human.submission",
        {
          raw: humanMessageId,
          thread: targetThreadId,
          index: messages.length - 1,
          messageCount: messages.length,
          keySource: requestedKey == null ? "default" : "explicit",
          key: idempotencyKey,
        },
        humanOrigin,
      );
      bindRunInput(
        submission,
        humanObservation,
        humanOrigin,
        targetThreadId,
        submission.payload.assistant_id as string,
      );
      await runner.submit(submission);
      if (!isCurrentSubmission()) return false;
      sendOptions?.signal?.throwIfAborted();
      const settledState = runner.getSessionState();
      if (!acceptedByBackend && settledState.status === "failed") {
        // `ThreadRunner` deliberately turns transport exceptions into a terminal
        // state so every observer sees one consistent lifecycle. Sending is the
        // exception: callers must still distinguish "the Gateway accepted a run"
        // from "the create request failed before a handle existed" so drafts and
        // attachments remain retryable.
        throw settledState.error;
      }
      void queryClient.invalidateQueries({
        queryKey: [...INFINITE_THREADS_QUERY_KEY_PREFIX],
      });
      return true;
    } catch (error) {
      if (!isCurrentSubmission()) return false;
      pendingAcceptedCallback = null;
      optimisticMessages.value = [];
      optimisticThreadId.value = null;
      liveMessagesThreadId.value = null;
      isUploading.value = false;
      localTurnOrderBaseline = null;
      throw error;
    } finally {
      sendOptions?.signal?.removeEventListener("abort", abortRunner);
      if (isCurrentSubmission()) sendInFlight = false;
    }
  }

  type PreparedReplay = {
    input: { messages?: Message[] } & Record<string, unknown>;
    checkpoint?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    target_run_id: string;
    source_message_ids?: string[];
    replacement_human_message_id?: string;
  };

  async function submitPreparedReplay(
    targetThreadId: string,
    preparePath: "regenerate" | "edit-regenerate",
    prepareBody: Record<string, unknown>,
    fallbackSupersededMessageIds: readonly string[],
    additionalKwargs?: Record<string, unknown>,
  ): Promise<boolean> {
    if (disposed || sendInFlight || runner.isStreaming() || !targetThreadId)
      return false;
    submissionGeneration += 1;
    sendInFlight = true;
    const generation = ++preparedReplayGeneration;
    const controller = new AbortController();
    preparedReplayController?.abort();
    preparedReplayController = controller;
    previousHumanMessageCount = humanMessageCount.value;
    localTurnOrderBaseline = identitiesOf(persistedMessages.value);
    liveMessagesThreadId.value = targetThreadId;
    onSend?.(targetThreadId);

    let preparedRunId: string | null = null;
    let supersededMessageIds: readonly string[] = fallbackSupersededMessageIds;
    const replayContext = {
      ...buildRunContext(
        toValue(context),
        undefined,
        model ? toValue(model) : undefined,
      ),
      ...clientTimezoneContext(),
    };
    const source =
      preparePath === "edit-regenerate"
        ? prepareBody.human_message_id
        : prepareBody.message_id;
    const observation = createReplayObservation({
      kind: preparePath === "edit-regenerate" ? "edit" : "regenerate",
      thread: targetThreadId,
      source: typeof source === "string" ? source : null,
      agent:
        typeof replayContext.agent_name === "string"
          ? replayContext.agent_name
          : null,
    });
    const retireObservation = () => observation?.retire();
    if (observation)
      controller.signal.addEventListener("abort", retireObservation, {
        once: true,
      });
    try {
      const response = await fetchWithAuth(
        `${getBackendBaseURL()}/api/threads/${encodeURIComponent(targetThreadId)}/runs/${preparePath}/prepare`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(prepareBody),
          signal: controller.signal,
        },
      );
      if (!response.ok) {
        await throwGatewayResponseError(
          response,
          `Failed to prepare ${preparePath}.`,
        );
      }
      const prepared = (await response.json()) as PreparedReplay;
      observation?.response(prepared);
      if (
        controller.signal.aborted ||
        generation !== preparedReplayGeneration ||
        targetThreadId !== threadId.value
      ) {
        return false;
      }
      observation?.adopt();
      preparedRunId = prepared.target_run_id;
      supersededMessageIds =
        prepared.source_message_ids ?? fallbackSupersededMessageIds;
      pendingSupersededRunIds.value = new Set([
        ...pendingSupersededRunIds.value,
        prepared.target_run_id,
      ]);
      pendingSupersededMessageIds.value = new Set([
        ...pendingSupersededMessageIds.value,
        ...supersededMessageIds,
      ]);
      pendingPreparedReplay = {
        targetRunId: prepared.target_run_id,
        supersededMessageIds,
      };

      if (additionalKwargs && Array.isArray(prepared.input.messages)) {
        const messages = [...prepared.input.messages];
        for (let index = messages.length - 1; index >= 0; index--) {
          const message = messages[index];
          if (message?.type !== "human") continue;
          messages[index] = {
            ...message,
            additional_kwargs: {
              ...message.additional_kwargs,
              ...JSON.parse(JSON.stringify(additionalKwargs)),
            },
          };
          break;
        }
        prepared.input = { ...prepared.input, messages };
      }
      const replacementMessages = prepared.input.messages ?? [];
      if (replacementMessages.length > 0) {
        optimisticThreadId.value = targetThreadId;
        optimisticMessages.value = replacementMessages;
      }

      const idempotencyKey = globalThis.crypto.randomUUID();
      // Preserve the actual argument evaluation order and single getter read.
      const replayAssistantId = toValue(options.assistantId) ?? "lead_agent";
      observation?.idempotency(idempotencyKey);
      observation?.attempt(prepared, replayAssistantId);
      const submission: Parameters<ThreadRunner["submit"]>[0] = {
        threadId: targetThreadId,
        idempotencyKey,
        payload: {
          assistant_id: replayAssistantId,
          stream_mode: THREAD_STREAM_MODES,
          ...THREAD_RUN_TRANSPORT_OPTIONS,
          input: prepared.input,
          checkpoint: prepared.checkpoint,
          metadata: prepared.metadata,
          config: { recursion_limit: 1000 },
          context: replayContext,
        },
      };
      observation?.bindRunInput(submission, replayAssistantId);
      await runner.submit(submission);
      if (
        controller.signal.aborted ||
        generation !== preparedReplayGeneration ||
        targetThreadId !== threadId.value
      ) {
        return false;
      }
      const status = runner.getSessionState().status;
      if (status === "failed" || status === "cancelled") {
        observation?.failure(status);
        if (pendingPreparedReplay) {
          clearPreparedReplayMasks(
            pendingPreparedReplay.targetRunId,
            pendingPreparedReplay.supersededMessageIds,
          );
          pendingPreparedReplay = null;
        }
        return false;
      }
      invalidateThreadCaches(queryClient, targetThreadId);
      return true;
    } catch (error) {
      observation?.failure();
      if (
        disposed ||
        generation !== preparedReplayGeneration ||
        targetThreadId !== threadId.value
      )
        return false;
      optimisticMessages.value = [];
      optimisticThreadId.value = null;
      liveMessagesThreadId.value = null;
      localTurnOrderBaseline = null;
      if (preparedRunId) {
        clearPreparedReplayMasks(preparedRunId, supersededMessageIds);
      }
      pendingPreparedReplay = null;
      if (
        !controller.signal.aborted &&
        generation === preparedReplayGeneration &&
        targetThreadId === threadId.value
      ) {
        notify.error(error instanceof Error ? error.message : String(error));
      }
      return false;
    } finally {
      observation?.finish(
        !disposed &&
          !controller.signal.aborted &&
          generation === preparedReplayGeneration &&
          targetThreadId === threadId.value,
      );
      if (observation)
        controller.signal.removeEventListener("abort", retireObservation);
      if (preparedReplayController === controller) {
        preparedReplayController = null;
      }
      if (generation === preparedReplayGeneration) sendInFlight = false;
    }
  }

  function regenerateMessage(
    targetThreadId: string,
    messageId: string,
    supersededMessageIds: readonly string[] = [messageId],
  ) {
    return submitPreparedReplay(
      targetThreadId,
      "regenerate",
      { message_id: messageId },
      supersededMessageIds,
    );
  }

  function editAndRegenerateMessage(
    targetThreadId: string,
    humanMessageId: string,
    replacementText: string,
    supersededMessageIds: readonly string[] = [humanMessageId],
    additionalKwargs?: Record<string, unknown>,
  ) {
    return submitPreparedReplay(
      targetThreadId,
      "edit-regenerate",
      {
        human_message_id: humanMessageId,
        replacement_text: replacementText,
      },
      supersededMessageIds,
      additionalKwargs,
    );
  }

  /** 05 A8。延迟那一次的 handle 留着，卸载时取消。 */
  async function stop(): Promise<void> {
    const generation = submissionGeneration;
    preparedReplayGeneration += 1;
    preparedReplayController?.abort();
    preparedReplayController = null;
    try {
      const timer = await stopThreadAndInvalidateCaches(
        queryClient,
        () => runner.stop(),
        threadId.value,
      );
      if (disposed || generation !== submissionGeneration) clearTimeout(timer);
      else pendingFinalizationTimer = timer;
    } finally {
      if (!disposed && generation === submissionGeneration) {
        if (pendingPreparedReplay) {
          clearPreparedReplayMasks(
            pendingPreparedReplay.targetRunId,
            pendingPreparedReplay.supersededMessageIds,
          );
          pendingPreparedReplay = null;
        }
        optimisticMessages.value = [];
        optimisticThreadId.value = null;
        customEventState.value = clearThreadRetryNotice(customEventState.value);
        sendInFlight = false;
        pendingAcceptedCallback = null;
      }
    }
  }

  function clearPreparedReplayMasks(
    targetRunId: string,
    supersededMessageIds: readonly string[],
  ) {
    pendingSupersededRunIds.value = removeSetItems(
      pendingSupersededRunIds.value,
      [targetRunId],
    );
    pendingSupersededMessageIds.value = removeSetItems(
      pendingSupersededMessageIds.value,
      supersededMessageIds,
    );
  }

  function resetView() {
    submissionGeneration += 1;
    checkpointSeedGeneration += 1;
    checkpointSeedController?.abort();
    adoptedThreadId = null;
    observingRun = false;
    preparedReplayGeneration += 1;
    preparedReplayController?.abort();
    preparedReplayController = null;
    pendingPreparedReplay = null;
    sendInFlight = false;
    pendingAcceptedCallback = null;
    streamError.value = null;
    runner.reset();
    activeRunId.value = null;
    customEventState.value = createThreadCustomEventState();
    optimisticMessages.value = [];
    optimisticThreadId.value = null;
    liveMessagesThreadId.value = null;
    pendingSupersededRunIds.value = new Set();
    pendingSupersededMessageIds.value = new Set();
    renderedMessageSnapshot = {
      threadId: null,
      messages: EMPTY_MESSAGES,
      order: EMPTY_MESSAGE_IDENTITIES,
    };
    localTurnOrderBaseline = null;
  }

  return {
    messages: mergedMessages,
    state: computed(() => {
      void snapshotVersion.value;
      return runner.getSnapshot().state;
    }),
    activeRunId,
    streamingMessageIds,
    subtasks: computed(() => customEventState.value.tasks),
    llmRetry: computed(() => customEventState.value.retry),
    isStreaming,
    isUploading: isUploading as Ref<boolean>,
    isHistoryLoading: history.loadingInitial,
    isHistoryLoadingMore: history.loadingMore,
    /** 历史是否已经问出结论（含失败）。跳转类决定必须等它，见 useThreadHistory。 */
    isHistorySettled: history.settled,
    historyError: history.error,
    error: streamError,
    hasMoreHistory: history.hasMore,
    loadMoreHistory: history.loadMore,
    sendMessage,
    joinRun,
    regenerateMessage,
    editAndRegenerateMessage,
    stop,
    clearPreparedReplayMasks,
    resetView,
    /** 测试与诊断用：不要在组件里读它。 */
    __runner: runner,
  };
}
