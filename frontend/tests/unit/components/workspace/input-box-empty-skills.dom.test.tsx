import { afterEach, describe, expect, it, rs } from "@rstest/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";

import { PromptInputProvider } from "@/components/ai-elements/prompt-input";
import { InputBox } from "@/components/workspace/input-box";
import { ThreadContext } from "@/components/workspace/messages/context";
import { AuthProvider } from "@/core/auth/AuthProvider";
import { DEFAULT_LOCALE } from "@/core/i18n";
import { I18nProvider } from "@/core/i18n/context";

rs.mock("next/navigation", () => ({
  useRouter: () => ({ push: rs.fn(), replace: rs.fn(), refresh: rs.fn() }),
  usePathname: () => "/workspace",
  useSearchParams: () => new URLSearchParams(),
}));

// The composer's model selector is irrelevant to skill-suggestion alignment;
// keep the react-query + network machinery out of the way entirely.
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

// The server-side resource-level filter (GET /api/skills filtered by
// filter_resources(principal, "skill", ...)) is what produces an empty
// catalog for a denied role. Pin the composer wiring against that shape:
// useSkills returning [] must degrade to a builtin-only dropdown, never a
// broken or fully-vanishing catalog.
rs.mock("@/core/skills/hooks", () => ({
  useSkills: () => ({
    skills: [],
    isLoading: false,
    error: null,
  }),
}));

function renderComposer() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const tree: ReactNode = (
    <I18nProvider initialLocale={DEFAULT_LOCALE}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider
          initialUser={{
            id: "user-1",
            email: "user@example.test",
            system_role: "user",
            needs_setup: false,
            oauth_provider: null,
          }}
        >
          <ThreadContext.Provider
            value={{ thread: { messages: [] } as never, isMock: true }}
          >
            <PromptInputProvider>
              <InputBox
                threadId="thread-1"
                status="ready"
                context={{ mode: "flash" } as never}
              />
            </PromptInputProvider>
          </ThreadContext.Provider>
        </AuthProvider>
      </QueryClientProvider>
    </I18nProvider>
  );
  return render(tree);
}

function getComposerTextarea(container: HTMLElement): HTMLTextAreaElement {
  const textarea = container.querySelector("textarea");
  if (!(textarea instanceof HTMLTextAreaElement)) {
    throw new Error("composer textarea not rendered");
  }
  return textarea;
}

function typeSlashQuery(
  container: HTMLElement,
  value: string,
): HTMLTextAreaElement {
  const textarea = getComposerTextarea(container);
  fireEvent.focus(textarea);
  fireEvent.change(textarea, { target: { value } });
  return textarea;
}

afterEach(() => {
  rs.restoreAllMocks();
  cleanup();
});

describe("InputBox command suggestions with an empty (denied) catalog", () => {
  it("fits commands to the native clipping ancestor and updates its layout lifecycle", async () => {
    const observers: {
      callback: ResizeObserverCallback;
      targets: Element[];
      disconnected: boolean;
    }[] = [];
    rs.stubGlobal(
      "ResizeObserver",
      class {
        entry: (typeof observers)[number];
        constructor(callback: ResizeObserverCallback) {
          this.entry = { callback, targets: [], disconnected: false };
          observers.push(this.entry);
        }
        observe(target: Element) {
          this.entry.targets.push(target);
        }
        disconnect() {
          this.entry.disconnected = true;
        }
      },
    );
    rs.stubGlobal("innerHeight", 800);
    document.documentElement.style.fontSize = "32px";
    const rendered = renderComposer();
    const clip = rendered.container;
    clip.style.overflowY = "auto";
    let clipTop = 120,
      rootTop = 300;
    rs.spyOn(clip, "getBoundingClientRect").mockImplementation(
      () => ({ top: clipTop, bottom: 800 }) as DOMRect,
    );
    Object.defineProperty(clip, "clientHeight", {
      configurable: true,
      get: () => 800 - clipTop,
    });
    const root = getComposerTextarea(clip).closest("form")!.parentElement!;
    rs.spyOn(root, "getBoundingClientRect").mockImplementation(
      () => ({ top: rootTop, bottom: 780 }) as DOMRect,
    );
    try {
      const textarea = typeSlashQuery(clip, "/");
      const list = screen.getByRole("listbox", { name: "Command suggestions" });
      await waitFor(() => expect(list.style.maxHeight).toBe("156px"));
      const active = observers.filter((item) => !item.disconnected);
      expect(active.some((item) => item.targets.includes(clip))).toBe(true);
      clipTop = 200;
      void act(() => {
        for (const observer of active.filter((item) =>
          item.targets.includes(clip),
        ))
          observer.callback([], {} as ResizeObserver);
      });
      await waitFor(() =>
        expect(list.parentElement!.classList.contains("relative")).toBe(true),
      );
      expect(list.style.maxHeight).toBe("568px");
      rootTop = 480;
      void act(() => {
        window.dispatchEvent(new Event("scroll"));
      });
      await waitFor(() =>
        expect(list.parentElement!.classList.contains("absolute")).toBe(true),
      );
      expect(list.style.maxHeight).toBe("256px");
      fireEvent.keyDown(textarea, { key: "Escape" });
      expect(observers.every((item) => item.disconnected)).toBe(true);
      expect(
        screen.queryByRole("listbox", { name: "Command suggestions" }),
      ).toBeNull();
    } finally {
      rendered.unmount();
      document.documentElement.style.removeProperty("font-size");
      rs.unstubAllGlobals();
    }
  });
  it("offers the builtin commands when '/' is typed with zero visible skills", () => {
    const { container } = renderComposer();

    typeSlashQuery(container, "/");

    // The dropdown survives the empty catalog and offers exactly the builtin
    // commands (/goal, /compact) — no phantom skill rows, no crash.
    const listbox = screen.getByRole("listbox", {
      name: "Command suggestions",
    });
    const options = Array.from(listbox.querySelectorAll('[role="option"]'));
    const names = options.map((option) => option.textContent ?? "");
    expect(names.some((name) => name.includes("/goal"))).toBe(true);
    expect(names.some((name) => name.includes("/compact"))).toBe(true);
    expect(names.every((name) => !name.includes("/data-analysis"))).toBe(true);
  });

  it("hides the dropdown when an empty catalog matches nothing more specifically", () => {
    const { container } = renderComposer();

    // No builtin matches "nosuch" and the catalog is empty, so the dropdown
    // must be absent — same silent behavior as an unmatched query today.
    typeSlashQuery(container, "/nosuch");

    expect(
      screen.queryByRole("listbox", { name: "Command suggestions" }),
    ).toBeNull();
  });
});
