import type { Message } from "@langchain/langgraph-sdk";
import { afterEach, beforeEach, expect, rs, test } from "@rstest/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { createElement, StrictMode, type ReactNode } from "react";
import { toast } from "sonner";

import type { ObservationPacket } from "@/core/diagnostics/parity-observation";
import { I18nContext } from "@/core/i18n/context";
import { enUS } from "@/core/i18n/locales/en-US";
import { isHiddenFromUIMessage } from "@/core/messages/utils";
import { DEFAULT_LOCAL_SETTINGS } from "@/core/settings/local";
import type { RunMessage } from "@/core/threads/types";

const streamMockState = rs.hoisted(() => ({
  isLoading: false,
  messages: [] as Message[],
  onFinish: undefined as
    | ((state: { values: { messages: Message[] } }) => void)
    | undefined,
  onError: undefined as ((error: unknown) => void) | undefined,
  onUpdateEvent: undefined as
    | ((data: unknown, options: { mutate: (updater: unknown) => void }) => void)
    | undefined,
  onCustomEvent: undefined as ((event: unknown) => void) | undefined,
  stop: rs.fn(async () => undefined),
  submit: rs.fn(async (): Promise<void> => undefined),
}));

rs.mock("@langchain/langgraph-sdk/react", () => ({
  useStream: (options: {
    onFinish?: (state: { values: { messages: Message[] } }) => void;
    onError?: (error: unknown) => void;
    onUpdateEvent?: (
      data: unknown,
      options: { mutate: (updater: unknown) => void },
    ) => void;
    onCustomEvent?: (event: unknown) => void;
  }) => {
    streamMockState.onFinish = options.onFinish;
    streamMockState.onError = options.onError;
    streamMockState.onUpdateEvent = options.onUpdateEvent;
    streamMockState.onCustomEvent = options.onCustomEvent;
    return {
      isLoading: streamMockState.isLoading,
      messages: streamMockState.messages,
      stop: streamMockState.stop,
      submit: streamMockState.submit,
      values: {
        artifacts: [],
        messages: streamMockState.messages,
        title: "",
        todos: [],
      },
    };
  },
}));

function humanMessage(
  id: string,
  text: string,
  extra?: Record<string, unknown>,
): Message {
  return {
    id,
    type: "human",
    content: [{ type: "text", text }],
    ...(extra ? { additional_kwargs: extra } : {}),
  } as Message;
}

function aiMessage(
  id: string,
  text: string,
  extra?: { run_id?: string; seq?: number },
): Message {
  return {
    id,
    type: "ai",
    content: text,
    ...(extra?.run_id ? { run_id: extra.run_id } : {}),
    ...(extra?.seq !== undefined
      ? { additional_kwargs: { deerflow_seq: extra.seq } }
      : {}),
  } as Message;
}

function historyRow(seq: number, runId: string, content: Message): RunMessage {
  return {
    run_id: runId,
    seq,
    content,
    metadata: { caller: "" },
    created_at: "2026-09-08T00:00:00Z",
  } as RunMessage;
}

function historyPageResponse(rows: RunMessage[]): Response {
  return new Response(
    JSON.stringify({ data: rows, has_more: false, next_before_seq: null }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

/** Serve per-thread history pages through the wrapped API fetcher. */
function stubHistoryFetch(pagesByThread: Record<string, () => RunMessage[]>) {
  rs.stubGlobal("fetch", async (input: unknown) => {
    const url = String(input);
    const pageMatch = /\/api\/threads\/([^/]+)\/messages\/page/.exec(url);
    if (pageMatch) {
      return historyPageResponse(pagesByThread[pageMatch[1]!]?.() ?? []);
    }
    throw new Error(`Unexpected fetch: ${url}`);
  });
}

function visibleMessageIds(messages: Message[]): string[] {
  return messages
    .filter((message) => !isHiddenFromUIMessage(message))
    .map((message) => String(message.id));
}

function createWrapper(queryClient: QueryClient) {
  return function ThreadStreamTestWrapper({
    children,
  }: {
    children: ReactNode;
  }) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(
        I18nContext.Provider,
        {
          value: {
            locale: "en-US",
            setLocale: () => undefined,
            t: enUS,
          },
        },
        children,
      ),
    );
  };
}

async function flushFrames() {
  // React Query delivers cache updates through setTimeout(0) and the history
  // retained-rows effect adds another render cycle, so a flush fires due
  // 0ms timers (never the 80ms coalesce trailing flush) and lets the render
  // chain settle — a fixed number of rounds, never a real sleep.
  for (let index = 0; index < 6; index += 1) {
    await act(async () => {
      if (rs.isFakeTimers()) {
        await rs.advanceTimersByTimeAsync(0);
      }
    });
  }
}

beforeEach(() => {
  streamMockState.isLoading = false;
  streamMockState.messages = [];
  streamMockState.onFinish = undefined;
  streamMockState.onError = undefined;
  streamMockState.onUpdateEvent = undefined;
  streamMockState.onCustomEvent = undefined;
  streamMockState.stop.mockClear();
  streamMockState.submit.mockClear();
});

afterEach(() => {
  rs.useRealTimers();
  rs.unstubAllGlobals();
});

// Compaction trimmed the checkpoint tail to the latest turn while the REST
// history feed still holds both turns: A更早(1), H旧(2), H近(3), A近(4).
const EARLIER_ANSWER = aiMessage("earlier-answer", "Earlier answer");
const OLD_HUMAN = humanMessage("old-human", "An older request");
const RECENT_HUMAN = humanMessage("recent-human", "The recent request");
const RECENT_ANSWER = aiMessage("recent-answer", "The recent answer");

function seededHistoryRows(): RunMessage[] {
  return [
    historyRow(1, "run-earlier", EARLIER_ANSWER),
    historyRow(2, "run-old", OLD_HUMAN),
    historyRow(3, "run-recent", RECENT_HUMAN),
    historyRow(4, "run-recent", RECENT_ANSWER),
  ];
}

function checkpointMessages(): Message[] {
  return [
    {
      id: "recent-human",
      type: "human",
      content: [{ type: "text", text: "The recent request" }],
      additional_kwargs: { deerflow_seq: 3 },
    } as Message,
    aiMessage("recent-answer", "The recent answer", { seq: 4 }),
  ];
}

async function renderSeededThread(options?: {
  threadId?: string;
  isMock?: boolean;
  historyRows?: () => RunMessage[];
}) {
  const threadId = options?.threadId ?? "thread-1";
  if (!options?.isMock) {
    stubHistoryFetch({
      [threadId]: options?.historyRows ?? (() => []),
    });
  }
  const { useThreadStream } = await import("@/core/threads/hooks");
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const hook = renderHook(
    ({ currentThreadId }: { currentThreadId?: string } = {}) =>
      useThreadStream({
        context: DEFAULT_LOCAL_SETTINGS.context,
        isMock: options?.isMock ?? false,
        threadId: currentThreadId ?? threadId,
      }),
    { wrapper: createWrapper(queryClient) },
  );
  await flushFrames();
  return hook;
}

/** Submit one visible turn and return the id shared by display and submit. */
async function submitVisibleTurn(
  result: {
    current: {
      sendMessage: (
        threadId: string,
        message: { files: []; text: string },
      ) => Promise<unknown>;
      thread: { messages: Message[] };
    };
  },
  text = "Continue the work",
): Promise<string> {
  await act(async () => {
    await result.current.sendMessage("thread-1", { files: [], text });
  });
  const displayed = result.current.thread.messages.at(-1);
  const submittedId = displayed?.id;
  expect(typeof submittedId).toBe("string");
  // The submit mock is an untyped rs.fn(); cast the call list once so the
  // tuple indexing below typechecks.
  const submitCalls = streamMockState.submit.mock.calls as unknown as Array<
    [{ messages: Message[] }]
  >;
  const submittedInput = submitCalls.at(-1)?.[0];
  expect(submittedInput?.messages.at(-1)?.id).toBe(submittedId);
  return submittedId!;
}

test("keeps early streamed steps behind a local user message after finish", async () => {
  const { useThreadStream } = await import("@/core/threads/hooks");
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const { rerender, result } = renderHook(
    () =>
      useThreadStream({
        context: DEFAULT_LOCAL_SETTINGS.context,
        isMock: true,
        threadId: "thread-1",
      }),
    { wrapper: createWrapper(queryClient) },
  );

  const submittedId = await submitVisibleTurn(result, "Build a presentation");

  const earlyAssistantStep = {
    id: "early-assistant-step",
    type: "ai",
    content: "Reading the presentation skill",
  } as Message;
  // The server keeps the client-submitted id and the runtime injects the
  // visible copy as `<id>__user`; both normalize onto the same identity.
  const injectedHuman = {
    id: `${submittedId}__user`,
    type: "human",
    content: "Build a presentation",
  } as Message;
  streamMockState.messages = [earlyAssistantStep, injectedHuman];
  streamMockState.isLoading = true;
  rerender();

  expect(result.current.thread.messages).toEqual([
    injectedHuman,
    earlyAssistantStep,
  ]);

  act(() => {
    streamMockState.onFinish?.({
      values: { messages: streamMockState.messages },
    });
    streamMockState.isLoading = false;
    rerender();
  });

  expect(result.current.thread.messages).toEqual([
    injectedHuman,
    earlyAssistantStep,
  ]);
});

test.each([false, true])(
  "keeps a new chat's first turn ordered when the server thread is confirmed: %s",
  async (confirmed) => {
    rs.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { useThreadStream } = await import("@/core/threads/hooks");
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { rerender, result } = renderHook(
      ({ created }: { created: boolean }) =>
        useThreadStream({
          context: DEFAULT_LOCAL_SETTINGS.context,
          isMock: true,
          threadId: created ? "thread-1" : undefined,
          displayThreadId: "thread-1",
        }),
      {
        initialProps: { created: false },
        wrapper: createWrapper(queryClient),
      },
    );
    const submittedId = await submitVisibleTurn(result);
    if (confirmed) {
      // ChatPage's onStart confirms the existing draft conversation without
      // remounting the hook or changing displayThreadId.
      rerender({ created: true });
    }
    streamMockState.messages = [aiMessage("first-step", "Searching the web")];
    streamMockState.isLoading = true;
    rerender({ created: confirmed });
    expect(visibleMessageIds(result.current.thread.messages)).toEqual([
      submittedId,
      "first-step",
    ]);
    const serverHuman = humanMessage(
      `${submittedId}__user`,
      "Continue the work",
    );
    streamMockState.messages = [
      ...streamMockState.messages,
      {
        type: "tool",
        id: "search-result",
        tool_call_id: "search",
        content: "Found news",
      } as Message,
      serverHuman,
    ];
    rerender({ created: confirmed });
    await act(async () => {
      await rs.advanceTimersByTimeAsync(100);
    });
    expect(visibleMessageIds(result.current.thread.messages)).toEqual([
      serverHuman.id,
      "first-step",
      "search-result",
    ]);
    act(() => {
      streamMockState.onFinish?.({
        values: { messages: streamMockState.messages },
      });
      streamMockState.isLoading = false;
      rerender({ created: confirmed });
    });
    expect(visibleMessageIds(result.current.thread.messages)).toEqual([
      serverHuman.id,
      "first-step",
      "search-result",
    ]);
  },
);

test("keeps established history order while the submitted human is outside the render snapshot", async () => {
  rs.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  let rows = seededHistoryRows();
  streamMockState.messages = checkpointMessages();
  const { rerender, result } = await renderSeededThread({
    historyRows: () => rows,
  });

  // Frame 0: history beyond the checkpoint baseline renders in feed order.
  expect(visibleMessageIds(result.current.thread.messages)).toEqual([
    "earlier-answer",
    "old-human",
    "recent-human",
    "recent-answer",
  ]);

  const submittedId = await submitVisibleTurn(result);
  expect(visibleMessageIds(result.current.thread.messages)).toEqual([
    "earlier-answer",
    "old-human",
    "recent-human",
    "recent-answer",
    submittedId,
  ]);

  // Frame 1 (leading-edge flush): the first AI step of the new turn arrives
  // before the server echo of the human input.
  const newStep = aiMessage("new-step", "Working on the follow-up", {
    run_id: "run-new",
  });
  streamMockState.messages = [RECENT_HUMAN, RECENT_ANSWER, newStep];
  streamMockState.isLoading = true;
  rerender();
  expect(visibleMessageIds(result.current.thread.messages)).toEqual([
    "earlier-answer",
    "old-human",
    "recent-human",
    "recent-answer",
    submittedId,
    "new-step",
  ]);

  // Frame 2: the server human copy reaches the unthrottled SDK state, but the
  // ~80ms render snapshot cannot see it yet. The established history must keep
  // its order and the local input must stay visible — no frame may drop the
  // current turn's human or relocate the history-only `old-human`.
  const serverHuman = {
    id: `${submittedId}__user`,
    type: "human",
    content: "Continue the work",
    run_id: "run-new",
  } as Message;
  streamMockState.messages = [
    RECENT_HUMAN,
    RECENT_ANSWER,
    newStep,
    serverHuman,
  ];
  rerender();
  expect(visibleMessageIds(result.current.thread.messages)).toEqual([
    "earlier-answer",
    "old-human",
    "recent-human",
    "recent-answer",
    submittedId,
    "new-step",
  ]);

  // Frame 3: the throttled snapshot catches up; the confirmed server copy
  // takes over the same identity exactly once.
  await act(async () => {
    await rs.advanceTimersByTimeAsync(100);
  });
  expect(visibleMessageIds(result.current.thread.messages)).toEqual([
    "earlier-answer",
    "old-human",
    "recent-human",
    "recent-answer",
    `${submittedId}__user`,
    "new-step",
  ]);

  // Frame 4: finish triggers the history refetch; the canonical page now
  // commits the whole turn and the display converges to seq order.
  rows = [
    ...seededHistoryRows(),
    historyRow(5, "run-new", serverHuman),
    historyRow(6, "run-new", newStep),
  ];
  await act(async () => {
    streamMockState.onFinish?.({
      values: { messages: streamMockState.messages },
    });
    streamMockState.isLoading = false;
  });
  rerender();
  await flushFrames();
  expect(visibleMessageIds(result.current.thread.messages)).toEqual([
    "earlier-answer",
    "old-human",
    "recent-human",
    "recent-answer",
    `${submittedId}__user`,
    "new-step",
  ]);
});

test("keeps a pre-submit older-turn rescue above the submitted human", async () => {
  rs.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const rescuedOldHuman = {
    id: "rescued-old-human",
    type: "human",
    content: "Older request",
    run_id: "run-old",
    additional_kwargs: { deerflow_seq: 1 },
  } as Message;
  const rescuedOldAnswer = aiMessage("rescued-old-answer", "Older answer", {
    run_id: "run-old",
    seq: 2,
  });
  const recentHuman = {
    id: "recent-human",
    type: "human",
    content: "Recent request",
    run_id: "run-recent",
    additional_kwargs: { deerflow_seq: 3 },
  } as Message;
  const recentAnswer = aiMessage("recent-answer", "Recent answer", {
    run_id: "run-recent",
    seq: 4,
  });
  const rows = [
    historyRow(3, "run-recent", recentHuman),
    historyRow(4, "run-recent", recentAnswer),
  ];
  streamMockState.messages = [
    rescuedOldHuman,
    rescuedOldAnswer,
    recentHuman,
    recentAnswer,
  ];
  const { rerender, result } = await renderSeededThread({
    historyRows: () => rows,
  });

  const removeAll = {
    id: "__remove_all__",
    type: "remove",
    content: "",
  } as Message;
  const hiddenSummary = humanMessage("summary-old", "Conversation summary", {
    hide_from_ui: true,
  });
  act(() => {
    streamMockState.onUpdateEvent?.(
      {
        "DeerFlowSummarizationMiddleware.before_model": {
          messages: [removeAll, hiddenSummary, recentHuman, recentAnswer],
        },
      },
      { mutate: () => undefined },
    );
    streamMockState.messages = [hiddenSummary, recentHuman, recentAnswer];
    rerender();
  });
  await act(async () => {
    await rs.advanceTimersByTimeAsync(100);
  });
  expect(visibleMessageIds(result.current.thread.messages)).toEqual([
    "rescued-old-human",
    "rescued-old-answer",
    "recent-human",
    "recent-answer",
  ]);

  await act(async () => {
    await result.current.sendMessage("thread-1", {
      files: [],
      text: "Continue the work",
    });
  });
  const submitCalls = streamMockState.submit.mock.calls as unknown as Array<
    [{ messages: Message[] }]
  >;
  const submittedId = submitCalls.at(-1)?.[0].messages.at(-1)?.id;
  expect(typeof submittedId).toBe("string");
  const serverHuman = {
    id: `${submittedId}__user`,
    type: "human",
    content: "Continue the work",
    run_id: "run-current",
  } as Message;
  const currentStep = aiMessage("current-step", "Current step", {
    run_id: "run-current",
  });
  streamMockState.messages = [
    hiddenSummary,
    recentHuman,
    recentAnswer,
    serverHuman,
    currentStep,
  ];
  streamMockState.isLoading = true;
  rerender();
  await act(async () => {
    await rs.advanceTimersByTimeAsync(100);
  });

  expect(visibleMessageIds(result.current.thread.messages)).toEqual([
    "rescued-old-human",
    "rescued-old-answer",
    "recent-human",
    "recent-answer",
    `${submittedId}__user`,
    "current-step",
  ]);
});

test("keeps a transiently rescued current-turn step behind its submitted human", async () => {
  rs.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const previousHuman = humanMessage("previous-human", "Previous request");
  const previousAnswer = aiMessage("previous-answer", "Previous answer", {
    run_id: "run-previous",
  });
  const rows = [
    historyRow(1, "run-previous", previousHuman),
    historyRow(2, "run-previous", previousAnswer),
  ];
  streamMockState.messages = [previousHuman, previousAnswer];
  const { rerender, result } = await renderSeededThread({
    historyRows: () => rows,
  });

  const submittedId = await submitVisibleTurn(result);
  const serverHuman = {
    id: `${submittedId}__user`,
    type: "human",
    content: "Continue the work",
    run_id: "run-current",
  } as Message;
  // Deliberately omit run_id: this is the streamed step whose ownership has
  // not yet been restored by canonical history.
  const rescuedStep = aiMessage("rescued-step", "First current step");
  const retainedStep = aiMessage("retained-step", "Latest current step", {
    run_id: "run-current",
  });
  streamMockState.messages = [serverHuman, rescuedStep, retainedStep];
  streamMockState.isLoading = true;
  rerender();
  await act(async () => {
    await rs.advanceTimersByTimeAsync(100);
  });
  expect(visibleMessageIds(result.current.thread.messages)).toEqual([
    "previous-human",
    "previous-answer",
    `${submittedId}__user`,
    "rescued-step",
    "retained-step",
  ]);

  const removeAll = {
    id: "__remove_all__",
    type: "remove",
    content: "",
  } as Message;
  const hiddenSummary = humanMessage(
    "summary-current",
    "Conversation summary",
    { hide_from_ui: true },
  );
  act(() => {
    streamMockState.onUpdateEvent?.(
      {
        "DeerFlowSummarizationMiddleware.before_model": {
          messages: [removeAll, hiddenSummary, serverHuman, retainedStep],
        },
      },
      { mutate: () => undefined },
    );
    streamMockState.messages = [hiddenSummary, serverHuman, retainedStep];
    rerender();
  });
  await act(async () => {
    await rs.advanceTimersByTimeAsync(100);
  });

  // The rescued step is transient current-turn state, not canonical old
  // history, so it must remain behind the submitted human.
  expect(visibleMessageIds(result.current.thread.messages)).toEqual([
    "previous-human",
    "previous-answer",
    `${submittedId}__user`,
    "rescued-step",
    "retained-step",
  ]);
});

test("does not move a later externally submitted answer ahead of the retained local anchor", async () => {
  rs.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const previousHuman = humanMessage("previous-human", "Previous request");
  const previousAnswer = aiMessage("previous-answer", "Previous answer", {
    run_id: "run-previous",
  });
  let rows = [
    historyRow(1, "run-previous", previousHuman),
    historyRow(2, "run-previous", previousAnswer),
  ];
  streamMockState.messages = [previousHuman, previousAnswer];
  const { rerender, result } = await renderSeededThread({
    historyRows: () => rows,
  });

  const submittedId = await submitVisibleTurn(result);
  const localHuman = {
    id: `${submittedId}__user`,
    type: "human",
    content: "Continue the work",
    run_id: "run-local",
  } as Message;
  const localAnswer = aiMessage("local-answer", "Local answer", {
    run_id: "run-local",
  });
  streamMockState.messages = [localHuman, localAnswer];
  streamMockState.isLoading = true;
  rerender();
  await act(async () => {
    await rs.advanceTimersByTimeAsync(100);
  });

  const remoteHuman = humanMessage("remote-human", "Later request elsewhere");
  const remoteAnswer = aiMessage("remote-answer", "Later external answer", {
    run_id: "run-remote",
  });
  rows = [
    historyRow(1, "run-previous", previousHuman),
    historyRow(2, "run-previous", previousAnswer),
    historyRow(3, "run-local", localHuman),
    historyRow(4, "run-local", localAnswer),
    historyRow(5, "run-remote", remoteHuman),
    historyRow(6, "run-remote", remoteAnswer),
  ];
  await act(async () => {
    streamMockState.onFinish?.({
      values: { messages: streamMockState.messages },
    });
    streamMockState.isLoading = false;
  });
  rerender();
  await flushFrames();

  // The local anchor survives finish only to repair its own turn. Canonical
  // messages submitted later by another client must retain their feed order.
  expect(visibleMessageIds(result.current.thread.messages)).toEqual([
    "previous-human",
    "previous-answer",
    `${submittedId}__user`,
    "local-answer",
    "remote-human",
    "remote-answer",
  ]);
});

test("hidden human-input reply never borrows an older visible human as its turn anchor", async () => {
  const rows = seededHistoryRows();
  streamMockState.messages = checkpointMessages();
  const { rerender, result } = await renderSeededThread({
    historyRows: () => rows,
  });

  // A clarification answer submits hidden: no visible optimistic human exists
  // for this turn at all.
  await act(async () => {
    await result.current.sendMessage(
      "thread-1",
      { files: [], text: "For your clarification, my answer is: staging" },
      undefined,
      { additionalKwargs: { hide_from_ui: true } },
    );
  });
  expect(visibleMessageIds(result.current.thread.messages)).toEqual([
    "earlier-answer",
    "old-human",
    "recent-human",
    "recent-answer",
  ]);

  const hiddenReply = humanMessage(
    "hidden-reply",
    "For your clarification, my answer is: staging",
    { hide_from_ui: true },
  );
  const replyStep = aiMessage("reply-step", "Applying the answer", {
    run_id: "run-reply",
  });
  streamMockState.messages = [
    RECENT_HUMAN,
    RECENT_ANSWER,
    hiddenReply,
    replyStep,
  ];
  streamMockState.isLoading = true;
  rerender();

  // The hidden turn must not re-anchor on `old-human`: visible history order
  // is already correct and stays untouched, the new step appends at the tail.
  expect(visibleMessageIds(result.current.thread.messages)).toEqual([
    "earlier-answer",
    "old-human",
    "recent-human",
    "recent-answer",
    "reply-step",
  ]);
});

test("keeps the new turn in place when the history page resolves after submit", async () => {
  rs.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  let resolveHistory: ((response: Response) => void) | undefined;
  rs.stubGlobal(
    "fetch",
    () =>
      new Promise<Response>((resolve) => {
        resolveHistory = resolve;
      }),
  );
  streamMockState.messages = checkpointMessages();
  const { useThreadStream } = await import("@/core/threads/hooks");
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const { rerender, result } = renderHook(
    () =>
      useThreadStream({
        context: DEFAULT_LOCAL_SETTINGS.context,
        isMock: false,
        threadId: "thread-1",
      }),
    { wrapper: createWrapper(queryClient) },
  );
  await flushFrames();

  // History is still loading: only the checkpoint tail is visible.
  expect(visibleMessageIds(result.current.thread.messages)).toEqual([
    "recent-human",
    "recent-answer",
  ]);

  const submittedId = await submitVisibleTurn(result);
  const newStep = aiMessage("new-step", "Working on the follow-up", {
    run_id: "run-new",
  });
  streamMockState.messages = [RECENT_HUMAN, RECENT_ANSWER, newStep];
  streamMockState.isLoading = true;
  rerender();
  expect(visibleMessageIds(result.current.thread.messages)).toEqual([
    "recent-human",
    "recent-answer",
    submittedId,
    "new-step",
  ]);

  // The page resolves mid-turn: older turns slot in ahead of the established
  // anchor without disturbing the in-flight turn.
  await act(async () => {
    resolveHistory?.(historyPageResponse(seededHistoryRows()));
  });
  await flushFrames();
  expect(visibleMessageIds(result.current.thread.messages)).toEqual([
    "earlier-answer",
    "old-human",
    "recent-human",
    "recent-answer",
    submittedId,
    "new-step",
  ]);
});

test("clears the local turn anchor when switching threads before the pending flush", async () => {
  rs.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const thread2Human = humanMessage("t2-human", "Another thread request");
  const thread2Answer = aiMessage("t2-answer", "Another thread answer");
  streamMockState.messages = checkpointMessages();
  const { rerender, result } = await renderSeededThread({
    historyRows: () => seededHistoryRows(),
  });

  const submittedId = await submitVisibleTurn(result);
  const newStep = aiMessage("new-step", "Working on the follow-up", {
    run_id: "run-new",
  });
  streamMockState.messages = [RECENT_HUMAN, RECENT_ANSWER, newStep];
  streamMockState.isLoading = true;
  rerender();
  expect(visibleMessageIds(result.current.thread.messages)).toContain(
    submittedId,
  );

  // Switch threads while a trailing coalesce flush is still pending. The
  // other thread's view must not inherit this turn's anchor or messages.
  stubHistoryFetch({
    "thread-1": () => seededHistoryRows(),
    "thread-2": () => [
      historyRow(1, "run-t2", thread2Human),
      historyRow(2, "run-t2", thread2Answer),
    ],
  });
  streamMockState.messages = [thread2Human, thread2Answer];
  streamMockState.isLoading = false;
  rerender({ currentThreadId: "thread-2" });
  await flushFrames();
  expect(visibleMessageIds(result.current.thread.messages)).toEqual([
    "t2-human",
    "t2-answer",
  ]);

  // The pending timer from the previous thread's stream must not repaint its
  // messages into this view either.
  await act(async () => {
    await rs.advanceTimersByTimeAsync(200);
  });
  expect(visibleMessageIds(result.current.thread.messages)).toEqual([
    "t2-human",
    "t2-answer",
  ]);
});

test("releases the in-flight turn state when the submit fails", async () => {
  const rows = seededHistoryRows();
  streamMockState.messages = checkpointMessages();
  const { rerender, result } = await renderSeededThread({
    historyRows: () => rows,
  });

  streamMockState.submit.mockRejectedValueOnce(new Error("network down"));
  await act(async () => {
    await result.current
      .sendMessage("thread-1", { files: [], text: "This send fails" })
      .catch(() => undefined);
  });

  // The failed input is withdrawn and must not linger through any ledger.
  expect(visibleMessageIds(result.current.thread.messages)).toEqual([
    "earlier-answer",
    "old-human",
    "recent-human",
    "recent-answer",
  ]);

  // The in-flight guard is released: the next send proceeds and anchors on
  // its own fresh identity, never on the failed one.
  const nextId = await submitVisibleTurn(result, "Retry the request");
  const newStep = aiMessage("new-step", "Working on the retry", {
    run_id: "run-retry",
  });
  streamMockState.messages = [RECENT_HUMAN, RECENT_ANSWER, newStep];
  streamMockState.isLoading = true;
  rerender();
  expect(visibleMessageIds(result.current.thread.messages)).toEqual([
    "earlier-answer",
    "old-human",
    "recent-human",
    "recent-answer",
    nextId,
    "new-step",
  ]);
});

test("anchors an edit-regenerate replay on the replacement human identity", async () => {
  const threadHuman = humanMessage("srv-h1", "Original question");
  const threadAnswer = aiMessage("srv-a1", "Original answer");
  const rows = [
    historyRow(1, "run-1", threadHuman),
    historyRow(2, "run-1", threadAnswer),
  ];
  streamMockState.messages = [threadHuman, threadAnswer];

  const replacementHuman = humanMessage("repl-h1", "Edited question");
  rs.stubGlobal("fetch", async (input: unknown, _init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/runs/edit-regenerate/prepare")) {
      return new Response(
        JSON.stringify({
          input: { messages: [replacementHuman] },
          checkpoint: {
            checkpoint_ns: "",
            checkpoint_id: "cp-1",
            checkpoint_map: null,
          },
          metadata: {},
          target_run_id: "run-1",
          replacement_human_message_id: "repl-h1",
          source_message_ids: ["srv-h1", "srv-a1"],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (url.includes("/messages/page")) {
      return historyPageResponse(rows);
    }
    throw new Error(`Unexpected fetch: ${url}`);
  });

  const { useThreadStream } = await import("@/core/threads/hooks");
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const { rerender, result } = renderHook(
    () =>
      useThreadStream({
        context: DEFAULT_LOCAL_SETTINGS.context,
        isMock: false,
        threadId: "thread-1",
      }),
    { wrapper: createWrapper(queryClient) },
  );
  await flushFrames();
  expect(visibleMessageIds(result.current.thread.messages)).toEqual([
    "srv-h1",
    "srv-a1",
  ]);

  await act(async () => {
    await result.current.editAndRegenerateMessage(
      "thread-1",
      "srv-h1",
      "Edited question",
    );
  });

  // The superseded turn is masked; the replacement human from the prepare
  // response is shown optimistically with its server-assigned identity.
  expect(visibleMessageIds(result.current.thread.messages)).toEqual([
    "repl-h1",
  ]);

  // The replay's first step arrives before the replacement human echo: the
  // replay anchors on the prepare identity, not on any older human.
  const replayStep = aiMessage("repl-step", "Recomputing the answer", {
    run_id: "run-2",
  });
  streamMockState.messages = [replayStep];
  streamMockState.isLoading = true;
  rerender();
  expect(visibleMessageIds(result.current.thread.messages)).toEqual([
    "repl-h1",
    "repl-step",
  ]);

  // Once the server copy lands, the same identity is shown exactly once and
  // the optimistic copy is withdrawn.
  const serverReplacement = {
    id: "repl-h1__user",
    type: "human",
    content: "Edited question",
    run_id: "run-2",
  } as Message;
  streamMockState.messages = [replayStep, serverReplacement];
  streamMockState.isLoading = false;
  rerender();
  await flushFrames();
  expect(visibleMessageIds(result.current.thread.messages)).toEqual([
    "repl-h1__user",
    "repl-step",
  ]);
});

test("drops the local turn anchor after a stream replay gap", async () => {
  const rows = seededHistoryRows();
  streamMockState.messages = checkpointMessages();
  const { rerender, result } = await renderSeededThread({
    historyRows: () => rows,
  });

  const submittedId = await submitVisibleTurn(result);
  expect(visibleMessageIds(result.current.thread.messages)).toContain(
    submittedId,
  );

  // A replay gap invalidates every locally kept ordering assumption.
  act(() => {
    streamMockState.onCustomEvent?.({ type: "stream_replay_gap" });
  });
  expect(visibleMessageIds(result.current.thread.messages)).toEqual([
    "earlier-answer",
    "old-human",
    "recent-human",
    "recent-answer",
  ]);

  // Afterwards, reconnection semantics apply: an arriving step with no local
  // anchor left must not reorder the established history.
  const newStep = aiMessage("new-step", "Working on the follow-up", {
    run_id: "run-new",
  });
  streamMockState.messages = [RECENT_HUMAN, RECENT_ANSWER, newStep];
  streamMockState.isLoading = true;
  rerender();
  expect(visibleMessageIds(result.current.thread.messages)).toEqual([
    "earlier-answer",
    "old-human",
    "recent-human",
    "recent-answer",
    "new-step",
  ]);
});

test("keeps the submitted turn anchored through stop and the final history refresh", async () => {
  rs.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  let rows = seededHistoryRows();
  streamMockState.messages = checkpointMessages();
  const { rerender, result } = await renderSeededThread({
    historyRows: () => rows,
  });

  const submittedId = await submitVisibleTurn(result);
  const newStep = aiMessage("new-step", "Working on the follow-up", {
    run_id: "run-new",
  });
  const serverHuman = {
    id: `${submittedId}__user`,
    type: "human",
    content: "Continue the work",
    run_id: "run-new",
  } as Message;
  streamMockState.messages = [
    RECENT_HUMAN,
    RECENT_ANSWER,
    newStep,
    serverHuman,
  ];
  streamMockState.isLoading = true;
  rerender();
  await act(async () => {
    await rs.advanceTimersByTimeAsync(100);
  });
  expect(visibleMessageIds(result.current.thread.messages)).toEqual([
    "earlier-answer",
    "old-human",
    "recent-human",
    "recent-answer",
    `${submittedId}__user`,
    "new-step",
  ]);

  // Stop flushes the turn into canonical history; the refresh must converge
  // to the same order the stream already showed.
  rows = [
    ...seededHistoryRows(),
    historyRow(5, "run-new", serverHuman),
    historyRow(6, "run-new", newStep),
  ];
  await act(async () => {
    await result.current.thread.stop();
    streamMockState.isLoading = false;
  });
  rerender();
  await flushFrames();
  expect(visibleMessageIds(result.current.thread.messages)).toEqual([
    "earlier-answer",
    "old-human",
    "recent-human",
    "recent-answer",
    `${submittedId}__user`,
    "new-step",
  ]);

  // The delayed finalization refetch changes nothing.
  await act(async () => {
    await rs.advanceTimersByTimeAsync(1600);
  });
  await flushFrames();
  expect(visibleMessageIds(result.current.thread.messages)).toEqual([
    "earlier-answer",
    "old-human",
    "recent-human",
    "recent-answer",
    `${submittedId}__user`,
    "new-step",
  ]);
});

test("keeps history stable when the stream errors after the human was confirmed", async () => {
  rs.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  let rows = seededHistoryRows();
  streamMockState.messages = checkpointMessages();
  const { rerender, result } = await renderSeededThread({
    historyRows: () => rows,
  });

  const submittedId = await submitVisibleTurn(result);
  const newStep = aiMessage("new-step", "Working on the follow-up", {
    run_id: "run-new",
  });
  const serverHuman = {
    id: `${submittedId}__user`,
    type: "human",
    content: "Continue the work",
    run_id: "run-new",
  } as Message;
  streamMockState.messages = [
    RECENT_HUMAN,
    RECENT_ANSWER,
    newStep,
    serverHuman,
  ];
  streamMockState.isLoading = true;
  rerender();
  await act(async () => {
    await rs.advanceTimersByTimeAsync(100);
  });
  expect(visibleMessageIds(result.current.thread.messages)).toEqual([
    "earlier-answer",
    "old-human",
    "recent-human",
    "recent-answer",
    `${submittedId}__user`,
    "new-step",
  ]);

  // The stream errors; the error path invalidates history and the refreshed
  // canonical page keeps the turn exactly where the user saw it.
  rows = [
    ...seededHistoryRows(),
    historyRow(5, "run-new", serverHuman),
    historyRow(6, "run-new", newStep),
  ];
  await act(async () => {
    streamMockState.onError?.(new Error("stream broke"));
    streamMockState.isLoading = false;
  });
  rerender();
  await flushFrames();
  expect(visibleMessageIds(result.current.thread.messages)).toEqual([
    "earlier-answer",
    "old-human",
    "recent-human",
    "recent-answer",
    `${submittedId}__user`,
    "new-step",
  ]);
});

type PendingPrepare = {
  url: string;
  signal?: AbortSignal | null;
  resolve(response: Response): void;
  reject(cause: Error): void;
};
type ReplayLifetimeProps = {
  threadId: string | undefined;
  displayThreadId?: string;
  assistantId?: string;
  agentName?: string;
  isMock?: boolean;
  context?: typeof DEFAULT_LOCAL_SETTINGS.context;
};
async function renderReplayLifetime(options?: {
  bootstrap?: boolean;
  strict?: boolean;
}) {
  const prepares: PendingPrepare[] = [];
  const uploads: PendingPrepare[] = [];
  rs.stubGlobal("fetch", (input: unknown, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/uploads"))
      return new Promise<Response>((resolve, reject) =>
        uploads.push({ url, signal: init?.signal, resolve, reject }),
      );
    if (url.endsWith("/prepare"))
      return new Promise<Response>((resolve, reject) =>
        prepares.push({ url, signal: init?.signal, resolve, reject }),
      );
    if (url.includes("/messages/page"))
      return Promise.resolve(historyPageResponse([]));
    if (/\/api\/langgraph\/threads\/[^/?]+\/runs(?:\?|$)/.test(url))
      return Promise.resolve(
        new Response("[]", { headers: { "Content-Type": "application/json" } }),
      );
    throw new Error(`Unexpected fetch: ${url}`);
  });
  const { useThreadStream } = await import("@/core/threads/hooks");
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper = createWrapper(queryClient);
  const initialProps: ReplayLifetimeProps = {
    threadId: options?.bootstrap ? undefined : "thread-a",
    displayThreadId: options?.bootstrap ? "thread-a" : undefined,
  };
  const hook = renderHook(
    ({
      threadId,
      displayThreadId,
      assistantId,
      agentName,
      isMock = false,
      context = DEFAULT_LOCAL_SETTINGS.context,
    }: ReplayLifetimeProps) =>
      useThreadStream({
        context: { ...context, agent_name: agentName },
        isMock,
        assistantId,
        threadId,
        displayThreadId,
      }),
    {
      initialProps,
      wrapper: options?.strict
        ? ({ children }: { children: ReactNode }) =>
            createElement(
              StrictMode,
              null,
              createElement(Wrapper, null, children),
            )
        : Wrapper,
    },
  );
  await flushFrames();
  return { ...hook, queryClient, prepares, uploads };
}
function preparedReplayResponse(thread = "a", edit = true) {
  return new Response(
    JSON.stringify({
      input: {
        messages: [
          humanMessage(
            edit ? `replacement-${thread}` : `human-${thread}`,
            edit ? `Edited ${thread}` : `Original ${thread}`,
          ),
        ],
      },
      checkpoint: {
        checkpoint_ns: "",
        checkpoint_id: `cp-${thread}`,
        checkpoint_map: null,
      },
      metadata: {},
      target_run_id: `run-${thread}`,
      ...(edit
        ? { replacement_human_message_id: `replacement-${thread}` }
        : {}),
      source_message_ids: [`human-${thread}`, `answer-${thread}`],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}
for (const kind of ["edit", "regenerate"] as const)
  test(`does not submit a late ${kind} preparation after switching thread`, async () => {
    const f = await renderReplayLifetime();
    try {
      let pending!: Promise<boolean>;
      await act(async () => {
        pending =
          kind === "edit"
            ? f.result.current.editAndRegenerateMessage(
                "thread-a",
                "human-a",
                "Edited a",
              )
            : f.result.current.regenerateMessage("thread-a", "answer-a");
      });
      expect(f.prepares).toHaveLength(1);
      expect(streamMockState.submit).not.toHaveBeenCalled();
      f.rerender({ threadId: "thread-b" });
      await flushFrames();
      let accepted: boolean | undefined;
      await act(async () => {
        f.prepares[0]!.resolve(preparedReplayResponse("a", kind === "edit"));
        accepted = await pending;
      });
      expect(accepted).toBe(false);
      expect(f.prepares[0]!.signal?.aborted).toBe(true);
      expect(streamMockState.submit).not.toHaveBeenCalled();
      expect(visibleMessageIds(f.result.current.thread.messages)).not.toContain(
        "replacement-a",
      );
    } finally {
      f.unmount();
      f.queryClient.clear();
    }
  });
test("returning to the same thread does not revive an earlier prepare", async () => {
  const f = await renderReplayLifetime();
  try {
    let pending!: Promise<boolean>;
    await act(async () => {
      pending = f.result.current.editAndRegenerateMessage(
        "thread-a",
        "human-a",
        "Edited a",
      );
    });
    expect(f.prepares).toHaveLength(1);
    f.rerender({ threadId: "thread-b" });
    await flushFrames();
    f.rerender({ threadId: "thread-a" });
    await flushFrames();
    let accepted: boolean | undefined;
    await act(async () => {
      f.prepares[0]!.resolve(preparedReplayResponse());
      accepted = await pending;
    });
    expect(accepted).toBe(false);
    expect(f.prepares[0]!.signal?.aborted).toBe(true);
    expect(streamMockState.submit).not.toHaveBeenCalled();
  } finally {
    f.unmount();
    f.queryClient.clear();
  }
});
for (const outcome of ["success", "error"] as const)
  test(`retires a ${outcome} preparation after real owner unmount`, async () => {
    const f = await renderReplayLifetime();
    const errorToast = rs.spyOn(toast, "error").mockReturnValue("test-toast");
    try {
      let pending!: Promise<boolean>;
      await act(async () => {
        pending = f.result.current.regenerateMessage("thread-a", "answer-a");
      });
      expect(f.prepares).toHaveLength(1);
      f.unmount();
      let accepted: boolean | undefined;
      await act(async () => {
        if (outcome === "success")
          f.prepares[0]!.resolve(preparedReplayResponse("a", false));
        else f.prepares[0]!.reject(new Error("Late prepare failed"));
        accepted = await pending;
      });
      expect(accepted).toBe(false);
      expect(errorToast).not.toHaveBeenCalled();
      expect(streamMockState.submit).not.toHaveBeenCalled();
      expect(f.prepares[0]!.signal?.aborted).toBe(true);
    } finally {
      f.unmount();
      f.queryClient.clear();
      errorToast.mockRestore();
    }
  });
test("an old prepare failure cannot release a new thread's submission guard", async () => {
  const f = await renderReplayLifetime();
  const errorToast = rs.spyOn(toast, "error").mockReturnValue("test-toast");
  try {
    let older!: Promise<boolean>;
    let current!: Promise<boolean>;
    await act(async () => {
      older = f.result.current.regenerateMessage("thread-a", "answer-a");
    });
    expect(f.prepares).toHaveLength(1);
    f.rerender({ threadId: "thread-b" });
    await flushFrames();
    await act(async () => {
      current = f.result.current.regenerateMessage("thread-b", "answer-b");
    });
    expect(f.prepares).toHaveLength(2);
    await act(async () => {
      f.prepares[0]!.reject(new Error("Old owner failed"));
      expect(await older).toBe(false);
    });
    let duplicate!: Promise<boolean>;
    await act(async () => {
      duplicate = f.result.current.regenerateMessage("thread-b", "answer-b");
    });
    // Count is checked before awaiting: an incorrectly admitted duplicate would
    // have another unresolved transport promise, not a false return value.
    expect(f.prepares).toHaveLength(2);
    expect(await duplicate).toBe(false);
    expect(errorToast).not.toHaveBeenCalled();
    await act(async () => {
      f.prepares[1]!.resolve(preparedReplayResponse("b", false));
      expect(await current).toBe(true);
    });
    expect(streamMockState.submit).toHaveBeenCalledTimes(1);
    expect(streamMockState.submit.mock.calls[0]).toEqual([
      expect.objectContaining({
        messages: [expect.objectContaining({ id: "human-b" })],
      }),
      expect.objectContaining({ threadId: "thread-b" }),
    ]);
  } finally {
    // Every synthetic prepare owns a completion even on the expected RED path.
    for (const [index, request] of f.prepares.entries())
      request.resolve(preparedReplayResponse(String(index)));
    await flushFrames();
    f.unmount();
    f.queryClient.clear();
    errorToast.mockRestore();
  }
});

test("an old replay failure cannot clear a new ordinary send's optimistic turn or guard", async () => {
  const f = await renderReplayLifetime();
  const errorToast = rs.spyOn(toast, "error").mockReturnValue("test-toast");
  let finishSend: () => void = () => undefined;
  let current: Promise<unknown> | undefined;
  try {
    let older!: Promise<boolean>;
    await act(async () => {
      older = f.result.current.regenerateMessage("thread-a", "answer-a");
    });
    expect(f.prepares).toHaveLength(1);
    f.rerender({ threadId: "thread-b" });
    await flushFrames();
    streamMockState.submit.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishSend = resolve;
        }),
    );
    await act(async () => {
      current = f.result.current.sendMessage("thread-b", {
        text: "Current ordinary send",
        files: [],
      });
    });
    expect(streamMockState.submit).toHaveBeenCalledTimes(1);
    const selectedTurn = visibleMessageIds(f.result.current.thread.messages);
    expect(selectedTurn).toHaveLength(1);
    expect(selectedTurn[0]).toMatch(/^local-human-/);
    await act(async () => {
      f.prepares[0]!.reject(new Error("Old replay failed"));
      expect(await older).toBe(false);
    });
    expect(visibleMessageIds(f.result.current.thread.messages)).toEqual(
      selectedTurn,
    );
    await act(async () => {
      await f.result.current.sendMessage("thread-b", {
        text: "Blocked duplicate",
        files: [],
      });
    });
    expect(streamMockState.submit).toHaveBeenCalledTimes(1);
    expect(errorToast).not.toHaveBeenCalled();
  } finally {
    await act(async () => {
      finishSend();
      await current;
    });
    f.unmount();
    f.queryClient.clear();
    errorToast.mockRestore();
  }
});
for (const outcome of ["success", "error"] as const)
  test(`an old ordinary send ${outcome} cannot release a new replay guard`, async () => {
    const f = await renderReplayLifetime();
    let finishSend: () => void = () => undefined;
    let failSend: (cause: Error) => void = () => undefined;
    let older: Promise<unknown> | undefined;
    let current: Promise<boolean> | undefined;
    const failure = new Error("Old ordinary send failed");
    const invalidate = rs.spyOn(f.queryClient, "invalidateQueries");
    try {
      streamMockState.submit.mockImplementationOnce(
        () =>
          new Promise<void>((resolve, reject) => {
            finishSend = resolve;
            failSend = reject;
          }),
      );
      await act(async () => {
        older = f.result.current
          .sendMessage("thread-a", { text: "Older ordinary send", files: [] })
          .catch((cause: unknown) => cause);
      });
      expect(streamMockState.submit).toHaveBeenCalledTimes(1);
      f.rerender({ threadId: "thread-b" });
      await flushFrames();
      await act(async () => {
        current = f.result.current.regenerateMessage("thread-b", "answer-b");
      });
      expect(f.prepares).toHaveLength(1);
      invalidate.mockClear();
      await act(async () => {
        if (outcome === "success") finishSend();
        else failSend(failure);
        expect(await older).toBe(outcome === "success" ? undefined : failure);
      });
      if (outcome === "success") {
        expect(invalidate).toHaveBeenCalledWith({
          queryKey: ["threads", "search"],
        });
        expect(invalidate).toHaveBeenCalledWith({
          queryKey: ["threads", "searchInfinite"],
        });
      }
      let duplicate!: Promise<boolean>;
      await act(async () => {
        duplicate = f.result.current.regenerateMessage("thread-b", "answer-b");
      });
      expect(f.prepares).toHaveLength(1);
      expect(await duplicate).toBe(false);
      await act(async () => {
        f.prepares[0]!.resolve(preparedReplayResponse("b", false));
        expect(await current).toBe(true);
      });
      expect(streamMockState.submit).toHaveBeenCalledTimes(2);
    } finally {
      finishSend();
      for (const request of f.prepares)
        request.resolve(preparedReplayResponse("b", false));
      await act(async () => {
        await older;
        await current;
      });
      invalidate.mockRestore();
      f.unmount();
      f.queryClient.clear();
    }
  });

for (const strict of [false, true])
  test(`bootstrap confirmation keeps its in-flight ordinary send (StrictMode=${strict})`, async () => {
    const f = await renderReplayLifetime({ bootstrap: true, strict });
    let complete: () => void = () => undefined;
    let pending: Promise<unknown> | undefined;
    try {
      streamMockState.submit.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            complete = resolve;
          }),
      );
      await act(async () => {
        pending = f.result.current.sendMessage("thread-a", {
          text: "Bootstrap",
          files: [],
        });
      });
      expect(streamMockState.submit).toHaveBeenCalledTimes(1);
      const ids = visibleMessageIds(f.result.current.thread.messages);
      expect(ids).toHaveLength(1);
      f.rerender({ threadId: "thread-a", displayThreadId: "thread-a" });
      await flushFrames();
      expect(visibleMessageIds(f.result.current.thread.messages)).toEqual(ids);
      await act(async () => {
        await f.result.current.sendMessage("thread-a", {
          text: "Blocked duplicate",
          files: [],
        });
      });
      expect(streamMockState.submit).toHaveBeenCalledTimes(1);
      await act(async () => {
        complete();
        await pending;
      });
      await act(async () => {
        await f.result.current.sendMessage("thread-a", {
          text: "Next independent send",
          files: [],
        });
      });
      expect(streamMockState.submit).toHaveBeenCalledTimes(2);
    } finally {
      await act(async () => {
        complete();
        await pending;
      });
      f.unmount();
      f.queryClient.clear();
    }
  });

for (const changed of [
  { label: "displayed thread", props: { displayThreadId: "thread-b" } },
  { label: "assistant", props: { assistantId: "researcher" } },
  { label: "agent", props: { agentName: "researcher" } },
  { label: "mock mode", props: { isMock: true } },
])
  test(`changing ${changed.label} retires preparation even when SDK thread ID stays the same`, async () => {
    const f = await renderReplayLifetime();
    let pending: Promise<boolean> | undefined;
    try {
      await act(async () => {
        pending = f.result.current.regenerateMessage("thread-a", "answer-a");
      });
      expect(f.prepares).toHaveLength(1);
      f.rerender({ threadId: "thread-a", ...changed.props });
      await flushFrames();
      await act(async () => {
        f.prepares[0]!.resolve(preparedReplayResponse("a", false));
        expect(await pending).toBe(false);
      });
      expect(f.prepares[0]!.signal?.aborted).toBe(true);
      expect(streamMockState.submit).not.toHaveBeenCalled();
    } finally {
      for (const request of f.prepares)
        request.resolve(preparedReplayResponse());
      await act(async () => {
        await pending;
      });
      f.unmount();
      f.queryClient.clear();
    }
  });

for (const strict of [false, true])
  test(`same-owner context changes retain live replay preparation (StrictMode=${strict})`, async () => {
    const f = await renderReplayLifetime({ strict });
    let pending: Promise<boolean> | undefined;
    try {
      await act(async () => {
        pending = f.result.current.regenerateMessage("thread-a", "answer-a");
      });
      f.rerender({
        threadId: "thread-a",
        context: {
          ...DEFAULT_LOCAL_SETTINGS.context,
          model_name: "another-model",
        },
      });
      await flushFrames();
      expect(f.prepares).toHaveLength(1);
      expect(f.prepares[0]!.signal?.aborted).toBe(false);
      await act(async () => {
        f.prepares[0]!.resolve(preparedReplayResponse("a", false));
        expect(await pending).toBe(true);
      });
      expect(streamMockState.submit).toHaveBeenCalledTimes(1);
    } finally {
      for (const request of f.prepares)
        request.resolve(preparedReplayResponse());
      await act(async () => {
        await pending;
      });
      f.unmount();
      f.queryClient.clear();
    }
  });

test("a stale replay callback cannot claim a new committed view", async () => {
  const f = await renderReplayLifetime();
  const previous = f.result.current.regenerateMessage;
  try {
    f.rerender({ threadId: "thread-b" });
    await flushFrames();
    await act(async () => {
      expect(await previous("thread-a", "answer-a")).toBe(false);
      expect(await previous("thread-b", "answer-b")).toBe(false);
    });
    expect(f.prepares).toHaveLength(0);
    expect(streamMockState.submit).not.toHaveBeenCalled();
  } finally {
    f.unmount();
    f.queryClient.clear();
  }
});

for (const outcome of ["success", "error"] as const)
  test(`a retired replay submit Promise ${outcome} cannot clear a newer ordinary turn`, async () => {
    const f = await renderReplayLifetime();
    const errorToast = rs.spyOn(toast, "error").mockReturnValue("test-toast");
    const invalidate = rs.spyOn(f.queryClient, "invalidateQueries");
    let finishOld: () => void = () => undefined;
    let rejectOld: (error: Error) => void = () => undefined;
    let finishNew: () => void = () => undefined;
    let older: Promise<boolean> | undefined;
    let current: Promise<void> | undefined;
    try {
      streamMockState.submit.mockImplementationOnce(
        () =>
          new Promise<void>((resolve, reject) => {
            finishOld = resolve;
            rejectOld = reject;
          }),
      );
      await act(async () => {
        older = f.result.current.regenerateMessage("thread-a", "answer-a");
      });
      await act(async () => {
        f.prepares[0]!.resolve(preparedReplayResponse("a", false));
      });
      expect(streamMockState.submit).toHaveBeenCalledTimes(1);
      f.rerender({ threadId: "thread-b" });
      await flushFrames();
      streamMockState.submit.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finishNew = resolve;
          }),
      );
      await act(async () => {
        current = f.result.current.sendMessage("thread-b", {
          text: "New ordinary turn",
          files: [],
        });
      });
      const currentIds = visibleMessageIds(f.result.current.thread.messages);
      expect(currentIds).toHaveLength(1);
      expect(currentIds[0]).toMatch(/^local-human-/);
      invalidate.mockClear();
      await act(async () => {
        if (outcome === "success") finishOld();
        else rejectOld(new Error("Old replay submit failed"));
        expect(await older).toBe(false);
      });
      if (outcome === "success")
        expect(invalidate).toHaveBeenCalledWith({
          queryKey: ["threads", "search"],
        });
      expect(visibleMessageIds(f.result.current.thread.messages)).toEqual(
        currentIds,
      );
      expect(errorToast).not.toHaveBeenCalled();
      expect(streamMockState.stop).not.toHaveBeenCalled();
      await act(async () => {
        await f.result.current.sendMessage("thread-b", {
          text: "Blocked duplicate",
          files: [],
        });
      });
      expect(streamMockState.submit).toHaveBeenCalledTimes(2);
    } finally {
      finishOld();
      finishNew();
      for (const request of f.prepares)
        request.resolve(preparedReplayResponse());
      await act(async () => {
        await older;
        await current;
      });
      invalidate.mockRestore();
      errorToast.mockRestore();
      f.unmount();
      f.queryClient.clear();
    }
  });

function uploadedReplayFileResponse() {
  return new Response(
    JSON.stringify({
      success: true,
      files: [
        {
          filename: "note.txt",
          size: 4,
          path: "/uploads/note.txt",
          virtual_path: "/mnt/user-data/uploads/note.txt",
          artifact_url: "/api/threads/thread-b/artifacts/note.txt",
        },
      ],
      message: "ok",
      skipped_files: [],
    }),
    { headers: { "Content-Type": "application/json" } },
  );
}
for (const outcome of ["success", "error"] as const)
  test(`retiring an upload clears its busy state without letting its late ${outcome} clear the next upload`, async () => {
    const f = await renderReplayLifetime();
    const errorToast = rs.spyOn(toast, "error").mockReturnValue("test-toast");
    const onOldSent = rs.fn();
    const onNewSent = rs.fn();
    const failure = new Error("Old upload failed");
    let older: Promise<unknown> | undefined;
    let current: Promise<void> | undefined;
    const filePart = {
      type: "file" as const,
      mediaType: "text/plain",
      filename: "note.txt",
      url: "blob:note",
      file: new File(["note"], "note.txt", { type: "text/plain" }),
    };
    try {
      await act(async () => {
        older = f.result.current
          .sendMessage(
            "thread-a",
            { text: "Old attachment", files: [filePart] },
            undefined,
            { onSent: onOldSent },
          )
          .catch((cause: unknown) => cause);
      });
      expect(f.uploads).toHaveLength(1);
      expect(f.result.current.isUploading).toBe(true);
      f.rerender({ threadId: "thread-b" });
      await flushFrames();
      const busyAfterDeparture = f.result.current.isUploading;
      await act(async () => {
        current = f.result.current.sendMessage(
          "thread-b",
          { text: "New attachment", files: [filePart] },
          undefined,
          { onSent: onNewSent },
        );
      });
      expect(f.uploads).toHaveLength(2);
      const newIds = visibleMessageIds(f.result.current.thread.messages);
      expect(f.result.current.isUploading).toBe(true);
      await act(async () => {
        if (outcome === "success")
          f.uploads[0]!.resolve(uploadedReplayFileResponse());
        else f.uploads[0]!.reject(failure);
        expect(await older).toBe(outcome === "success" ? undefined : failure);
      });
      expect(busyAfterDeparture).toBe(false);
      expect(f.result.current.isUploading).toBe(true);
      expect(visibleMessageIds(f.result.current.thread.messages)).toEqual(
        newIds,
      );
      expect(onOldSent).not.toHaveBeenCalled();
      expect(streamMockState.submit).not.toHaveBeenCalled();
      expect(errorToast).not.toHaveBeenCalled();
      await act(async () => {
        f.uploads[1]!.resolve(uploadedReplayFileResponse());
        expect(await current).toBeUndefined();
      });
      expect(f.result.current.isUploading).toBe(false);
      expect(onNewSent).toHaveBeenCalledTimes(1);
      expect(streamMockState.submit).toHaveBeenCalledTimes(1);
    } finally {
      for (const request of f.uploads)
        request.resolve(uploadedReplayFileResponse());
      await act(async () => {
        await older;
        await current;
      });
      errorToast.mockRestore();
      f.unmount();
      f.queryClient.clear();
    }
  });

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
    test(`actual ${kind} replay preserves its prepared provenance across cloning (observation=${enabled})`, async () => {
      const f = await renderReplayLifetime();
      const packets: ObservationPacket[] = [];
      const capability = "__deerflow_parity_capture_v1__";
      const eventName = "deerflow:parity-identity:v1";
      const receive = (event: Event) =>
        packets.push((event as CustomEvent<ObservationPacket>).detail);
      const control = {
        version: 1,
        token: "react-replay-capture",
        action: "replay:0",
      };
      if (enabled)
        Object.defineProperty(window, capability, {
          configurable: true,
          value: control,
        });
      window.addEventListener(eventName, receive);
      const uuid = rs.spyOn(globalThis.crypto, "randomUUID");
      const prepared = observedPreparedReplay(kind);
      const response = new Response(JSON.stringify(prepared), {
        headers: { "Content-Type": "application/json" },
      });
      const parse = rs.spyOn(response, "json");
      let pending: Promise<boolean> | undefined;
      try {
        await act(async () => {
          pending =
            kind === "edit"
              ? f.result.current.editAndRegenerateMessage(
                  "thread-a",
                  "human-observed",
                  "private revised text",
                  { added: "private added field" },
                )
              : f.result.current.regenerateMessage(
                  "thread-a",
                  "answer-observed",
                );
        });
        expect(f.prepares).toHaveLength(1);
        control.action = "later:1";
        await act(async () => {
          f.prepares[0]!.resolve(response);
          expect(await pending).toBe(true);
        });
        expect(parse).toHaveBeenCalledTimes(1);
        expect(uuid).not.toHaveBeenCalled();
        expect(streamMockState.submit).toHaveBeenCalledTimes(1);
        expect(streamMockState.submit.mock.calls[0]).toEqual([
          {
            ...prepared.input,
            messages: [
              {
                ...prepared.input.messages[0],
                additional_kwargs: {
                  retained: "private extra field",
                  ...(kind === "edit" ? { added: "private added field" } : {}),
                },
              },
            ],
          },
          expect.objectContaining({
            threadId: "thread-a",
            checkpoint: prepared.checkpoint,
            metadata: prepared.metadata,
          }),
        ]);

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
              thread: "thread-a",
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

        expect(
          packets.some((packet) => packet.event === "idempotency.allocate"),
        ).toBe(false);
      } finally {
        for (const request of f.prepares)
          request.resolve(new Response(JSON.stringify(prepared)));
        await act(async () => {
          await pending;
        });
        uuid.mockRestore();
        parse.mockRestore();
        f.unmount();
        f.queryClient.clear();
        window.removeEventListener(eventName, receive);
        Reflect.deleteProperty(window, capability);
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
    test(`actual ${kind} provenance preserves its original owner through ${mode}`, async () => {
      const f = await renderReplayLifetime();
      const capture = captureActualReplay();
      let pending: Promise<boolean> | undefined;
      let unmounted = false;
      const retired = mode === "thread-switch" || mode === "unmount";
      const prepared = observedPreparedReplay(kind);
      if (mode === "submit-throw")
        streamMockState.submit.mockRejectedValueOnce(
          new Error("private submission failure"),
        );
      try {
        await act(async () => {
          pending =
            kind === "edit"
              ? f.result.current.editAndRegenerateMessage(
                  "thread-a",
                  "human-observed",
                  "private revised text",
                )
              : f.result.current.regenerateMessage(
                  "thread-a",
                  "answer-observed",
                );
        });
        expect(f.prepares).toHaveLength(1);
        expect(capture.packets.map((packet) => packet.event)).toEqual([
          "replay.begin",
        ]);
        capture.control.action = "later:1";
        if (mode === "thread-switch") {
          f.rerender({ threadId: "thread-b" });
          await flushFrames();
        } else if (mode === "unmount") {
          f.unmount();
          unmounted = true;
        } else if (mode === "capture-replaced")
          capture.control.token = "replacement-capture";
        if (retired) expect(f.prepares[0]!.signal?.aborted).toBe(true);
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
        let accepted: boolean | undefined;
        await act(async () => {
          f.prepares[0]!.resolve(response);
          accepted = await pending;
        });

        expect(accepted).toBe(mode === "capture-replaced");
        expect(streamMockState.submit.mock.calls.length).toBe(
          mode === "submit-throw" || mode === "capture-replaced" ? 1 : 0,
        );
        expect(capture.packets[0]).toMatchObject({
          event: "replay.begin",
          action: "replay:0",
          values: { kind, thread: "thread-a" },
        });
        expect(
          capture.packets.every(
            (packet) =>
              packet.capture === "boundary-capture" &&
              (packet.event === "run.bind"
                ? packet.action === "later:1" &&
                  packet.values.sourceAction === "replay:0"
                : packet.action === "replay:0"),
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
        for (const request of f.prepares)
          request.resolve(new Response(JSON.stringify(prepared)));
        await act(async () => {
          await pending;
        });
        if (!unmounted) f.unmount();
        f.queryClient.clear();
        capture.dispose();
      }
    });
for (const enabled of [false, true])
  for (const sourceShape of ["absent", "empty", "getter"] as const)
    test(`regenerate retains caller source selection without observation interference (shape=${sourceShape}, enabled=${enabled})`, async () => {
      const emptySources = sourceShape !== "absent";
      const f = await renderReplayLifetime();
      const oldIds = ["answer-observed", "source-step", "unrelated-answer"];
      let release: () => void = () => undefined;
      const barrier = new Promise<void>((resolve) => {
        release = resolve;
      });
      let pending: Promise<boolean> | undefined;
      let capture: ReturnType<typeof captureActualReplay> | undefined;
      const prepared = {
        ...observedPreparedReplay("regenerate"),
        ...(emptySources ? { source_message_ids: [] } : {}),
      };
      const response = new Response(JSON.stringify(prepared));
      const parse = rs.spyOn(response, "json");
      const readSources = rs.fn(() => [] as string[]);
      if (sourceShape === "getter") {
        Object.defineProperty(prepared, "source_message_ids", {
          get: readSources,
        });
        // Synthetic robustness only: normal JSON cases above use real parsing.
        parse.mockResolvedValue(prepared);
      }
      const uuid = rs.spyOn(globalThis.crypto, "randomUUID");
      streamMockState.submit.mockImplementationOnce(() => barrier);
      try {
        streamMockState.messages = oldIds.map((id) => aiMessage(id, id));
        f.rerender({ threadId: "thread-a" });
        await flushFrames();
        expect(visibleMessageIds(f.result.current.thread.messages)).toEqual(
          oldIds,
        );
        capture = captureActualReplay();
        if (!enabled)
          Reflect.deleteProperty(window, "__deerflow_parity_capture_v1__");
        await act(async () => {
          pending = f.result.current.regenerateMessage(
            "thread-a",
            "answer-observed",
            ["answer-observed", "source-step"],
          );
        });
        expect(f.prepares).toHaveLength(1);
        expect(f.prepares[0]!.url).toContain(
          "/api/threads/thread-a/runs/regenerate/prepare",
        );
        await act(async () => {
          f.prepares[0]!.resolve(response);
        });
        await flushFrames();
        expect(streamMockState.submit).toHaveBeenCalledTimes(1);
        expect(streamMockState.submit.mock.calls[0]).toEqual([
          prepared.input,
          expect.objectContaining({
            threadId: "thread-a",
            checkpoint: prepared.checkpoint,
            metadata: prepared.metadata,
          }),
        ]);
        expect(parse).toHaveBeenCalledTimes(1);
        expect(readSources).toHaveBeenCalledTimes(0);
        expect(uuid).not.toHaveBeenCalled();
        const visible = visibleMessageIds(f.result.current.thread.messages);
        expect(visible.filter((id) => oldIds.includes(id))).toEqual([
          "unrelated-answer",
        ]);
        expect(visible).not.toContain("human-observed");
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
        await act(async () => {
          release();
          expect(await pending).toBe(true);
        });
      } finally {
        for (const request of f.prepares) request.resolve(response);
        await act(async () => {
          release();
          await pending;
        });
        streamMockState.submit.mockReset();
        streamMockState.submit.mockResolvedValue(undefined);
        capture?.dispose();
        parse.mockRestore();
        uuid.mockRestore();
        f.unmount();
        f.queryClient.clear();
      }
    });
