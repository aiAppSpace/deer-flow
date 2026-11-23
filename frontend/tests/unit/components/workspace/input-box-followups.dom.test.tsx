import type { Message } from "@langchain/langgraph-sdk";
import { afterEach, beforeEach, describe, expect, it, rs } from "@rstest/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import { PromptInputProvider } from "@/components/ai-elements/prompt-input";
import { InputBox } from "@/components/workspace/input-box";
import { ThreadContext } from "@/components/workspace/messages/context";
import { DEFAULT_LOCALE } from "@/core/i18n";
import { I18nProvider } from "@/core/i18n/context";

const auth = rs.hoisted(() => ({ id: "user-a" }));
rs.mock("next/navigation", () => ({
  useRouter: () => ({ push: rs.fn(), replace: rs.fn(), refresh: rs.fn() }),
  usePathname: () => "/workspace/chats/thread-a",
  useSearchParams: () => new URLSearchParams(),
}));
rs.mock("@/core/auth/AuthProvider", () => ({
  useAuth: () => ({
    user: { id: auth.id, system_role: "admin" },
    isLoading: false,
  }),
}));
rs.mock("@/core/models/hooks", () => ({
  useModels: () => ({
    models: [],
    tokenUsageEnabled: false,
    isLoading: false,
    isFetching: false,
    error: null,
    refetch: rs.fn(),
  }),
}));
rs.mock("@/core/skills/hooks", () => ({
  useSkills: () => ({
    skills: [],
    isLoading: false,
    isFetching: false,
    error: null,
    refetch: rs.fn(),
  }),
}));

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
  });
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const messages: Message[] = [
  { id: "human-a", type: "human", content: "First question" },
  { id: "ai-a", type: "ai", content: "First answer" },
];
type View = {
  status?: "streaming" | "ready";
  disabled?: boolean;
  threadId?: string;
  draftThreadId?: string;
  model?: string;
  messages?: Message[];
};
type Wire = { url: string; body: unknown; signal?: AbortSignal | null };
let wires: Wire[];
let response: ReturnType<typeof deferred<Response>> | undefined;
let config: ReturnType<typeof deferred<Response>>;
const clients: QueryClient[] = [];

function composer(seedConfig = true) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  clients.push(client);
  if (seedConfig)
    client.setQueryData(["suggestionsConfig"], {
      enabled: true,
      max_suggestions: 3,
    });
  const onStop = rs.fn();
  const tree = (state: View) => (
    <I18nProvider initialLocale={DEFAULT_LOCALE}>
      <QueryClientProvider client={client}>
        <ThreadContext.Provider
          value={{
            thread: { messages: state.messages ?? messages } as never,
            isMock: false,
          }}
        >
          <PromptInputProvider>
            <InputBox
              threadId={state.threadId ?? "thread-a"}
              draftThreadId={state.draftThreadId}
              status={state.status ?? "streaming"}
              disabled={state.disabled}
              context={
                { mode: "flash", model_name: state.model ?? "model-a" } as never
              }
              onStop={onStop}
            />
          </PromptInputProvider>
        </ThreadContext.Provider>
      </QueryClientProvider>
    </I18nProvider>
  );
  const view = render(tree({}));
  return {
    ...view,
    client,
    onStop,
    update: (state: View) => view.rerender(tree(state)),
  };
}

beforeEach(() => {
  auth.id = "user-a";
  wires = [];
  response = undefined;
  config = deferred<Response>();
  rs.stubGlobal("fetch", async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/api/suggestions/config")) return config.promise;
    if (/\/api\/threads\/[^/]+\/suggestions$/.test(url)) {
      if (typeof init?.body !== "string") {
        throw new Error("Suggestion requests must serialize their snapshot");
      }
      wires.push({
        url,
        body: JSON.parse(init.body),
        signal: init?.signal,
      });
      return (
        response?.promise ?? json({ suggestions: ["Continue this answer"] })
      );
    }
    return json({ data: [], has_more: false, next_before_seq: null });
  });
});
afterEach(() => {
  cleanup();
  for (const client of clients.splice(0)) client.clear();
  rs.restoreAllMocks();
  rs.unstubAllGlobals();
  window.sessionStorage.clear();
  window.localStorage.clear();
});

describe("completed-run followups", () => {
  it("retains the completion across the real history-admission disabled edge", async () => {
    const view = composer();
    view.update({ status: "ready", disabled: true });
    expect(wires).toHaveLength(0);
    view.update({
      status: "ready",
      disabled: false,
      model: "model-b",
      messages: [{ id: "unrelated", type: "ai", content: "Later hydration" }],
    });
    await screen.findByRole("button", { name: "Continue this answer" });
    expect(wires).toHaveLength(1);
    expect(wires[0]).toMatchObject({
      url: "/api/threads/thread-a/suggestions",
      body: {
        model_name: "model-a",
        n: 3,
        messages: [
          { role: "user", content: "First question" },
          { role: "assistant", content: "First answer" },
        ],
      },
    });
    view.update({ status: "ready" });
    expect(wires).toHaveLength(1);
  });

  it("waits for the actual query config without losing the completion", async () => {
    const view = composer(false);
    view.update({ status: "ready" });
    expect(wires).toHaveLength(0);
    await act(async () =>
      config.resolve(json({ enabled: true, max_suggestions: 2 })),
    );
    await screen.findByRole("button", { name: "Continue this answer" });
    expect(wires).toHaveLength(1);
    expect(wires[0]?.body).toMatchObject({ n: 2 });
  });

  it("does not generate from an initial historical ready view", () => {
    const view = composer();
    view.unmount();
    const client = new QueryClient();
    clients.push(client);
    client.setQueryData(["suggestionsConfig"], {
      enabled: true,
      max_suggestions: 3,
    });
    render(
      <I18nProvider initialLocale={DEFAULT_LOCALE}>
        <QueryClientProvider client={client}>
          <ThreadContext.Provider
            value={{ thread: { messages } as never, isMock: false }}
          >
            <PromptInputProvider>
              <InputBox
                threadId="history"
                status="ready"
                context={{ mode: "flash" } as never}
              />
            </PromptInputProvider>
          </ThreadContext.Provider>
        </QueryClientProvider>
      </I18nProvider>,
    );
    expect(wires).toHaveLength(0);
  });

  it("retires a pending completion when Stop interrupts the run", () => {
    const view = composer();
    fireEvent.click(screen.getByRole("button", { name: "Stop" }));
    view.update({ status: "ready", disabled: true });
    view.update({ status: "ready" });
    expect(view.onStop).toHaveBeenCalledTimes(1);
    expect(wires).toHaveLength(0);
  });

  it.each(["thread", "user", "lifetime"])(
    "retires pending completion on %s owner change",
    (owner) => {
      const view = composer();
      view.update({ status: "ready", disabled: true });
      if (owner === "user") auth.id = "user-b";
      view.update({
        status: "ready",
        threadId: owner === "thread" ? "thread-b" : "thread-a",
        draftThreadId: owner === "lifetime" ? "other-draft" : undefined,
      });
      expect(wires).toHaveLength(0);
    },
  );

  it.each(["thread", "user"])(
    "aborts an in-flight request and fences late output after %s changes",
    async (owner) => {
      response = deferred<Response>();
      const view = composer();
      view.update({ status: "ready" });
      await waitFor(() => expect(wires).toHaveLength(1));
      if (owner === "user") auth.id = "user-b";
      view.update({
        status: "ready",
        threadId: owner === "thread" ? "thread-b" : "thread-a",
      });
      expect(wires[0]?.signal?.aborted).toBe(true);
      await act(async () =>
        response?.resolve(json({ suggestions: ["Other owner's answer"] })),
      );
      expect(
        screen.queryByRole("button", { name: "Other owner's answer" }),
      ).toBeNull();
      expect(wires).toHaveLength(1);
    },
  );

  it("consumes a disabled config without issuing a suggestion request", () => {
    const view = composer();
    view.client.setQueryData(["suggestionsConfig"], {
      enabled: false,
      max_suggestions: 3,
    });
    view.update({ status: "ready" });
    expect(wires).toHaveLength(0);
  });

  it("aborts an old request and ignores a transport that returns after a new run", async () => {
    response = deferred<Response>();
    const view = composer();
    view.update({ status: "ready" });
    await waitFor(() => expect(wires).toHaveLength(1));
    view.update({ status: "streaming", model: "model-b" });
    expect(wires[0]?.signal?.aborted).toBe(true);
    await act(async () =>
      response?.resolve(json({ suggestions: ["Stale answer"] })),
    );
    expect(screen.queryByRole("button", { name: "Stale answer" })).toBeNull();
    response = undefined;
    view.update({
      status: "ready",
      model: "model-b",
      messages: [
        ...messages,
        { id: "ai-b", type: "ai", content: "Second answer" },
      ],
    });
    await screen.findByRole("button", { name: "Continue this answer" });
    expect(wires).toHaveLength(2);
    expect(wires[1]?.body).toMatchObject({ model_name: "model-b" });
  });

  it("aborts on unmount without committing a late reply", async () => {
    response = deferred<Response>();
    const view = composer();
    view.update({ status: "ready" });
    await waitFor(() => expect(wires).toHaveLength(1));
    view.unmount();
    expect(wires[0]?.signal?.aborted).toBe(true);
    await act(async () =>
      response?.resolve(json({ suggestions: ["Stale answer"] })),
    );
    expect(screen.queryByRole("button", { name: "Stale answer" })).toBeNull();
  });
});
