import { afterEach, beforeEach, describe, expect, it, rs } from "@rstest/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

import { PromptInputProvider } from "@/components/ai-elements/prompt-input";
import { InputBox } from "@/components/workspace/input-box";
import { referenceToken } from "@/components/workspace/mentions/inline-references";
import { ThreadContext } from "@/components/workspace/messages/context";
import { DEFAULT_LOCALE } from "@/core/i18n";
import { I18nProvider } from "@/core/i18n/context";
import {
  buildComposerDraftKey,
  readComposerDraft,
  writeComposerDraft,
} from "@/core/threads/composer-draft";

rs.mock("next/navigation", () => ({
  useRouter: () => ({ push: rs.fn(), replace: rs.fn(), refresh: rs.fn() }),
  usePathname: () => "/workspace/chats/thread-a",
  useSearchParams: () => new URLSearchParams(),
}));
rs.mock("@/core/auth/AuthProvider", () => ({
  useAuth: () => ({ user: { id: "user-a" }, isLoading: false }),
}));
rs.mock("@/core/models/hooks", () => ({
  useModels: () => ({ models: [], isLoading: false, refetch: rs.fn() }),
}));
rs.mock("@/core/skills/hooks", () => ({
  useSkills: () => ({ skills: [], isLoading: false, refetch: rs.fn() }),
}));

const key = (threadId = "thread-a") =>
  buildComposerDraftKey({ userId: "user-a", threadId });
const stored = (threadId = "thread-a") =>
  readComposerDraft(window.sessionStorage, key(threadId));
let resolveFeatures: (value: Response) => void;
const clients: QueryClient[] = [];

function composer() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  clients.push(client);
  const tree = (threadId: string) => (
    <I18nProvider initialLocale={DEFAULT_LOCALE}>
      <QueryClientProvider client={client}>
        <ThreadContext.Provider
          value={{ thread: { messages: [] } as never, isMock: true }}
        >
          <PromptInputProvider>
            <InputBox
              threadId={threadId}
              status="ready"
              context={{ mode: "flash" } as never}
            />
          </PromptInputProvider>
        </ThreadContext.Provider>
      </QueryClientProvider>
    </I18nProvider>
  );
  const view = render(tree("thread-a"));
  return {
    ...view,
    client,
    update: (threadId = "thread-a") => view.rerender(tree(threadId)),
  };
}

async function advance(ms: number) {
  await act(async () => rs.advanceTimersByTimeAsync(ms));
}
function type(text: string) {
  fireEvent.change(screen.getByRole("textbox"), { target: { value: text } });
}
async function completeFeatures(enabled: boolean) {
  await act(async () => {
    resolveFeatures(
      new Response(
        JSON.stringify({
          agents_api: { enabled: false },
          conversation_references: { enabled, max_references: 3 },
        }),
        { headers: { "Content-Type": "application/json" } },
      ),
    );
  });
  await advance(0);
}

beforeEach(() => {
  rs.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const features = new Promise<Response>((resolve) => {
    resolveFeatures = resolve;
  });
  rs.stubGlobal("fetch", (input: unknown) => {
    if (String(input).endsWith("/api/features")) return features;
    throw new Error(`Unexpected request: ${String(input)}`);
  });
});
afterEach(() => {
  cleanup();
  for (const client of clients.splice(0)) client.clear();
  rs.useRealTimers();
  rs.restoreAllMocks();
  rs.unstubAllGlobals();
  window.sessionStorage.clear();
});

describe("composer draft persistence deadline", () => {
  it("saves 300ms after the edit despite unrelated parent rerenders", async () => {
    const view = composer();
    type("summarize it");
    await advance(100);
    view.update();
    await advance(100);
    view.update();
    await advance(99);
    expect(stored()).toBeNull();
    await advance(1);
    expect(stored()?.text).toBe("summarize it");
  });

  it("keeps the deadline when the real capability query settles without changing the draft", async () => {
    const view = composer();
    type("summarize it");
    await advance(150);
    await completeFeatures(true);
    expect(
      view.client.getQueryState(["features", "conversation_references"])
        ?.status,
    ).toBe("success");
    await advance(149);
    expect(stored()).toBeNull();
    await advance(1);
    expect(stored()?.text).toBe("summarize it");
  });

  it("restarts the deadline for an actual edit and persists only the latest text", async () => {
    composer();
    type("first");
    await advance(150);
    type("replacement");
    await advance(299);
    expect(stored()).toBeNull();
    await advance(1);
    expect(stored()?.text).toBe("replacement");
  });

  it("flushes the departing owner and gives the next thread its own deadline", async () => {
    const view = composer();
    type("first thread");
    await advance(100);
    view.update("thread-b");
    expect(stored()?.text).toBe("first thread");
    type("second thread");
    await advance(299);
    expect(stored("thread-b")).toBeNull();
    await advance(1);
    expect(stored("thread-b")?.text).toBe("second thread");
    expect(stored()?.text).toBe("first thread");
  });

  it("flushes on pagehide and unmount before the deadline", async () => {
    const view = composer();
    type("pagehide");
    await advance(100);
    fireEvent(window, new Event("pagehide"));
    expect(stored()?.text).toBe("pagehide");
    type("unmount");
    view.unmount();
    expect(stored()?.text).toBe("unmount");
    await advance(300);
    expect(stored()?.text).toBe("unmount");
  });

  it("persists a capability-driven change to the effective reference draft", async () => {
    writeComposerDraft(window.sessionStorage, key(), {
      text: `${referenceToken("conversation", "thread-earlier", "Earlier")} summarize`,
      skillName: null,
      conversationReferences: [
        { threadId: "thread-earlier", title: "Earlier" },
      ],
    });
    composer();
    await advance(150);
    await completeFeatures(false);
    await advance(300);
    expect(stored()).toEqual({ text: "@Earlier summarize", skillName: null });
  });
});
