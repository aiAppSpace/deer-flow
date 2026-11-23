import { afterEach, describe, expect, it, rs } from "@rstest/core";
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
import { ThreadContext } from "@/components/workspace/messages/context";
import { DEFAULT_LOCALE } from "@/core/i18n";
import { I18nProvider } from "@/core/i18n/context";

rs.mock("next/navigation", () => ({
  useRouter: () => ({ push: rs.fn(), replace: rs.fn(), refresh: rs.fn() }),
  usePathname: () => "/workspace/chats/thread-a",
  useSearchParams: () => new URLSearchParams(),
}));
rs.mock("@/core/auth/AuthProvider", () => ({
  useAuth: () => ({
    user: { id: "user-a", system_role: "admin" },
    isLoading: false,
  }),
}));
rs.mock("@/core/models/hooks", () => ({
  useModels: () => ({
    models: [
      {
        name: "thinker",
        display_name: "Thinker",
        supports_thinking: true,
        supports_reasoning_effort: true,
      },
    ],
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

const clients: QueryClient[] = [];
afterEach(() => {
  cleanup();
  for (const client of clients.splice(0)) client.clear();
  rs.restoreAllMocks();
  rs.unstubAllGlobals();
  sessionStorage.clear();
  localStorage.clear();
});

describe("mounted reasoning menu owner", () => {
  it("retains its actual trigger/menu on resize and dispatches the selected effort", async () => {
    rs.stubGlobal(
      "fetch",
      async () =>
        new Response(JSON.stringify({ data: [], enabled: false }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    clients.push(client);
    const onContextChange = rs.fn();
    render(
      <I18nProvider initialLocale={DEFAULT_LOCALE}>
        <QueryClientProvider client={client}>
          <ThreadContext.Provider
            value={{ thread: { messages: [] } as never, isMock: true }}
          >
            <PromptInputProvider>
              <InputBox
                threadId="thread-a"
                status="ready"
                context={
                  {
                    mode: "pro",
                    model_name: "thinker",
                    reasoning_effort: "medium",
                  } as never
                }
                onContextChange={onContextChange}
              />
            </PromptInputProvider>
          </ThreadContext.Provider>
        </QueryClientProvider>
      </I18nProvider>,
    );
    const trigger = screen.getByRole("button", {
      name: "Reasoning Effort: Medium",
    });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const menu = await screen.findByRole("menu");
    const id = trigger.getAttribute("aria-controls");
    expect(id).toBe(menu.id);
    rs.stubGlobal("innerWidth", 375);
    await act(async () => {
      window.dispatchEvent(new Event("resize"));
    });
    // Radix's modal menu hides the outside tree from the accessibility tree;
    // retain the actual trigger identity rather than querying hidden roles.
    expect(document.getElementById(trigger.id)).toBe(trigger);
    expect(trigger.isConnected).toBe(true);
    expect(screen.getByRole("menu")).toBe(menu);
    expect(trigger.getAttribute("aria-controls")).toBe(id);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(screen.getByRole("menuitemradio", { name: /^High / }));
    expect(onContextChange).toHaveBeenLastCalledWith({
      reasoning_effort: "high",
    });
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
