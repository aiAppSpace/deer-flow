import { afterEach, beforeEach, expect, it, rs } from "@rstest/core";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
} from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { toast } from "sonner";

import { PromptInputProvider } from "@/components/ai-elements/prompt-input";
import {
  useThreadChat,
  resetThreadChatAfterDelete,
} from "@/components/workspace/chats/use-thread-chat";
import {
  InputBox,
  type InputBoxHandle,
} from "@/components/workspace/input-box";
import { MessageDetailsProvider } from "@/components/workspace/message-details/context";
import { ThreadContext } from "@/components/workspace/messages/context";
import {
  ThreadDeleteDialogProvider,
  useThreadDeleteDialog,
} from "@/components/workspace/thread-delete-dialog";
import { DEFAULT_LOCALE } from "@/core/i18n";
import { I18nProvider } from "@/core/i18n/context";

const { route, replace, remove, account } = rs.hoisted(() => ({
  route: {
    pathname: "/workspace/chats/new",
    threadId: "new",
    agentName: undefined as string | undefined,
  },
  replace: rs.fn(),
  remove: rs.fn(),
  account: { id: "user-a" },
}));
rs.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => route.pathname,
  useParams: () => ({ thread_id: route.threadId, agent_name: route.agentName }),
  useSearchParams: () => new URLSearchParams(),
}));
rs.mock("@/core/auth/AuthProvider", () => ({
  useAuth: () => ({ user: account, isLoading: false }),
}));
rs.mock("@/core/models/hooks", () => ({
  useModels: () => ({ models: [], isLoading: false, refetch: rs.fn() }),
}));
rs.mock("@/core/skills/hooks", () => ({
  useSkills: () => ({ skills: [], isLoading: false, refetch: rs.fn() }),
}));
rs.mock("@/core/threads/hooks", () => ({
  useDeleteThread: () => useMutation({ mutationFn: remove }),
}));
let update: () => void;
const clients: QueryClient[] = [];
const composerHandoff = rs.fn();
const controls = {
  disabled: false,
  retained: false,
  targetId: undefined as string | undefined,
};
function Conversation() {
  const composer = useRef<InputBoxHandle>(null);
  const userId = account.id;
  const focus = useCallback(
    (id: string) => {
      composerHandoff(id, userId);
      composer.current?.focusIfOwned(id, userId);
    },
    [userId],
  );
  const { threadId, isNewThread, setIsNewThread } = useThreadChat(focus);
  const [welcome, setWelcome] = useState(isNewThread);
  useEffect(() => setWelcome(isNewThread), [isNewThread]);
  const requestDelete = useThreadDeleteDialog();
  return (
    <>
      <input aria-label="Outside" />
      <output data-testid="owner">{threadId}</output>
      <button
        onClick={() => {
          // Prepared creation adopts the very same UUID through native history;
          // Next's params keep their original `new` value while the tree survives.
          window.history.replaceState({}, "", `/workspace/chats/${threadId}`);
          route.pathname = window.location.pathname;
          setIsNewThread(false);
        }}
      >
        Adopt
      </button>
      <button
        onClick={() =>
          requestDelete({
            thread: {
              thread_id: controls.targetId ?? threadId,
              created_at: "2026-01-01T00:00:00Z",
              updated_at: "2026-01-01T00:00:00Z",
              metadata: route.agentName ? { agent_name: route.agentName } : {},
              status: "idle",
              values: { title: "Adopted", messages: [] },
              interrupts: {},
            },
          })
        }
      >
        Open deletion
      </button>
      <ThreadContext.Provider
        value={{ thread: { messages: [] } as never, isMock: true }}
      >
        <MessageDetailsProvider
          key={controls.retained ? "retained-control" : threadId}
        >
          <PromptInputProvider>
            <InputBox
              disabled={controls.disabled}
              ref={composer}
              threadId={threadId}
              draftThreadId={isNewThread ? "new" : threadId}
              autoFocus={welcome}
              status="ready"
              context={{ mode: "flash" }}
            />
          </PromptInputProvider>
        </MessageDetailsProvider>
      </ThreadContext.Provider>
    </>
  );
}
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  clients.push(client);
  const tree = () => (
    <I18nProvider initialLocale={DEFAULT_LOCALE}>
      <QueryClientProvider client={client}>
        <ThreadDeleteDialogProvider>
          <Conversation />
        </ThreadDeleteDialogProvider>
      </QueryClientProvider>
    </I18nProvider>
  );
  const view = render(tree());
  update = () => view.rerender(tree());
  return view;
}
beforeEach(() => {
  route.pathname = "/workspace/chats/new";
  route.threadId = "new";
  route.agentName = undefined;
  controls.targetId = undefined;
  composerHandoff.mockReset();
  account.id = "user-a";
  controls.disabled = false;
  controls.retained = false;
  window.history.replaceState({}, "", route.pathname);
  remove
    .mockReset()
    .mockImplementation(async ({ onDeleted }: { onDeleted?: () => void }) => {
      onDeleted?.();
    });
  replace.mockReset().mockImplementation((path: string) => {
    window.history.replaceState({}, "", path);
    route.pathname = path;
    update();
  });
  rs.spyOn(URL, "createObjectURL").mockReturnValue("blob:test-attachment");
  rs.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
  rs.stubGlobal("fetch", async (input: unknown) => {
    if (String(input).endsWith("/api/features"))
      return new Response(
        JSON.stringify({
          agents_api: { enabled: false },
          conversation_references: { enabled: false, max_references: 3 },
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    throw new Error(`Unexpected request: ${String(input)}`);
  });
});
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((c) => c.clear());
  rs.restoreAllMocks();
  rs.unstubAllGlobals();
  window.sessionStorage.clear();
});
for (const retained of [false, true])
  it(`returns deletion focus after prepared UUID adoption (retained composer control=${retained})`, async () => {
    controls.retained = retained;
    setup();
    const textarea = screen.getByPlaceholderText<HTMLTextAreaElement>(
      "How can I assist you today?",
    );
    const preparedId = screen.getByTestId("owner").textContent;
    expect(document.activeElement).toBe(textarea);
    fireEvent.click(screen.getByRole("button", { name: "Adopt" }));
    expect(screen.getByTestId("owner").textContent).toBe(preparedId);
    expect(
      screen.getByPlaceholderText<HTMLTextAreaElement>(
        "How can I assist you today?",
      ),
    ).toBe(textarea);
    fireEvent.change(textarea, {
      target: { value: "Draft in adopted conversation" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Open deletion" }));
    const del = await screen.findByRole("button", { name: "Delete" });
    del.focus();
    fireEvent.click(del);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByTestId("owner").textContent).not.toBe(preparedId);
    const nextTextarea = screen.getByPlaceholderText<HTMLTextAreaElement>(
      "How can I assist you today?",
    );
    expect(nextTextarea === textarea).toBe(retained);
    expect(nextTextarea.value).toBe("");
    await waitFor(() =>
      expect(document.activeElement === nextTextarea).toBe(true),
    );
    expect(composerHandoff).toHaveBeenCalledOnce();
    expect(composerHandoff).toHaveBeenCalledWith(
      screen.getByTestId("owner").textContent,
      "user-a",
    );
    await act(async () => undefined);
  });

async function adoptedDeletion(
  activation: "programmatic" | "focused" = "programmatic",
) {
  setup();
  const textarea = screen.getByPlaceholderText<HTMLTextAreaElement>(
    "How can I assist you today?",
  );
  fireEvent.click(screen.getByRole("button", { name: "Adopt" }));
  const opener = screen.getByRole<HTMLButtonElement>("button", {
    name: "Open deletion",
  });
  if (activation === "focused") {
    opener.focus();
    expect(document.activeElement).toBe(opener);
  } else {
    expect(document.activeElement).toBe(textarea);
  }
  fireEvent.click(opener);
  const dialog = await screen.findByRole("dialog");
  // DOM detachment precedes the primitive's deferred close event. Observe the
  // completed event turn before asserting no stale focus was applied.
  const closed = new Promise<void>((resolve) => {
    dialog.addEventListener(
      "focusScope.autoFocusOnUnmount",
      () => queueMicrotask(resolve),
      { once: true },
    );
  });
  return {
    closed,
    opener,
    textarea,
    dialog,
    confirm: () => {
      const button = screen.getByRole("button", { name: "Delete" });
      button.focus();
      fireEvent.click(button);
    },
  };
}

it("hands off once when Next's void replacement commits after the dialog closes", async () => {
  let destination = "";
  replace.mockImplementation((path: string) => {
    destination = path;
  });
  const { confirm } = await adoptedDeletion();
  confirm();
  await waitFor(() =>
    expect(
      document.activeElement ===
        screen.getByPlaceholderText<HTMLTextAreaElement>(
          "How can I assist you today?",
        ),
    ).toBe(true),
  );
  const textarea = screen.getByPlaceholderText<HTMLTextAreaElement>(
    "How can I assist you today?",
  );
  expect(window.location.pathname.endsWith("/new")).toBe(false);
  const owner = screen.getByTestId("owner").textContent;
  fireEvent.change(textarea, {
    target: { value: "New typing before route commit" },
  });
  const outside = screen.getByRole("textbox", { name: "Outside" });
  outside.focus();
  act(() => {
    window.history.replaceState({}, "", destination);
    route.pathname = destination;
    update();
  });
  expect(screen.getByTestId("owner").textContent).toBe(owner);
  expect(textarea.value).toBe("New typing before route commit");
  expect(document.activeElement).toBe(outside);
});

for (const boundary of [
  "account",
  "account roundtrip",
  "new owner",
  "route",
  "disabled",
  "new focus",
  "new text and attachment",
] as const) {
  it(`retires the close handoff for ${boundary} at the actual closing scope boundary`, async () => {
    const { dialog, confirm } = await adoptedDeletion();
    let closed = false;
    const focus = rs.spyOn(HTMLElement.prototype, "focus");
    dialog.addEventListener(
      "focusScope.autoFocusOnUnmount",
      () => {
        flushSync(() => {
          if (boundary.startsWith("account")) account.id = "user-b";
          if (boundary === "disabled") controls.disabled = true;
          if (boundary === "route") {
            route.pathname = "/workspace/chats/other";
            window.history.replaceState({}, "", route.pathname);
          }
          if (boundary === "new owner")
            resetThreadChatAfterDelete({
              deletedThreadId: "newer",
              nextPath: "/workspace/chats/new",
              force: true,
            });
          update();
        });
        if (boundary === "account roundtrip")
          flushSync(() => {
            account.id = "user-a";
            update();
          });
        const textarea = screen.getByPlaceholderText<HTMLTextAreaElement>(
          "How can I assist you today?",
        );
        if (boundary === "new text and attachment") {
          fireEvent.change(textarea, { target: { value: "New user draft" } });
          fireEvent.change(screen.getByLabelText("Upload files"), {
            target: {
              files: [new File(["new"], "new.txt", { type: "text/plain" })],
            },
          });
        }
        if (boundary === "new focus" || boundary === "new text and attachment")
          screen.getByRole("textbox", { name: "Outside" }).focus();
        focus.mockClear();
        closed = true;
      },
      { once: true },
    );
    confirm();
    await waitFor(() => expect(closed).toBe(true));
    expect(focus).not.toHaveBeenCalled();
    if (boundary === "new text and attachment") {
      expect(
        screen.getByPlaceholderText<HTMLTextAreaElement>(
          "How can I assist you today?",
        ).value,
      ).toBe("New user draft");
      expect(screen.getByText("new.txt")).not.toBeNull();
    }
  });
}

it("keeps the adopted draft and Cancel focus on deletion failure, then completes a retry", async () => {
  remove.mockRejectedValueOnce(new Error("delete failed"));
  const log = rs.spyOn(console, "error").mockImplementation(() => undefined);
  const { textarea, confirm } = await adoptedDeletion();
  fireEvent.change(textarea, { target: { value: "Keep on failure" } });
  confirm();
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Cancel" }),
    ),
  );
  expect(textarea.value).toBe("Keep on failure");
  expect(replace).not.toHaveBeenCalled();
  expect(log).toHaveBeenCalledWith("Failed to delete chat:", expect.any(Error));
  confirm();
  await waitFor(() =>
    expect(
      document.activeElement ===
        screen.getByPlaceholderText<HTMLTextAreaElement>(
          "How can I assist you today?",
        ),
    ).toBe(true),
  );
  expect(
    screen.getByPlaceholderText<HTMLTextAreaElement>(
      "How can I assist you today?",
    ).value,
  ).toBe("");
});

it("does not reclaim focus after Cancel", async () => {
  const { textarea, opener, closed } = await adoptedDeletion("focused");
  const owner = screen.getByTestId("owner").textContent;
  fireEvent.change(textarea, { target: { value: "Cancel draft" } });
  const focus = rs.spyOn(textarea, "focus");
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  await act(async () => closed);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(remove).not.toHaveBeenCalled();
  expect(focus).not.toHaveBeenCalled();
  expect(composerHandoff).not.toHaveBeenCalled();
  expect(replace).not.toHaveBeenCalled();
  expect(screen.getByTestId("owner").textContent).toBe(owner);
  expect(textarea.value).toBe("Cancel draft");
  expect(document.activeElement).toBe(opener);
});

for (const departure of ["route", "account", "account roundtrip"] as const) {
  it(`does not hand a pending deletion to a newer ${departure}`, async () => {
    let finish!: () => void;
    remove.mockImplementation(
      async ({ onDeleted }: { onDeleted?: () => void }) => {
        await new Promise<void>((resolve) => {
          finish = resolve;
        });
        onDeleted?.();
      },
    );
    const { confirm, closed } = await adoptedDeletion();
    confirm();
    await waitFor(() => expect(remove).toHaveBeenCalledOnce());
    act(() => {
      if (departure.startsWith("account")) account.id = "user-b";
      else {
        route.pathname = "/workspace/chats/other";
        route.threadId = "other";
        window.history.replaceState({}, "", route.pathname);
      }
      update();
    });
    if (departure === "account roundtrip")
      act(() => {
        account.id = "user-a";
        update();
      });
    const textarea = screen.getByPlaceholderText<HTMLTextAreaElement>(
      "How can I assist you today?",
    );
    const newerOwner = screen.getByTestId("owner").textContent;
    fireEvent.change(textarea, { target: { value: "Newer owner draft" } });
    const focus = rs.spyOn(textarea, "focus");
    await act(async () => finish());
    await act(async () => closed);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByTestId("owner").textContent).toBe(newerOwner);
    expect(textarea.value).toBe("Newer owner draft");
    expect(replace).not.toHaveBeenCalled();
    expect(focus).not.toHaveBeenCalled();
    expect(composerHandoff).not.toHaveBeenCalled();
  });
}

for (const agentName of [undefined, "delete-agent"]) {
  it(`hands off an ordinary existing conversation (${agentName ?? "main"})`, async () => {
    route.agentName = agentName;
    route.threadId = "existing-thread";
    const prefix = agentName
      ? `/workspace/agents/${agentName}/chats`
      : "/workspace/chats";
    route.pathname = `${prefix}/existing-thread`;
    window.history.replaceState({}, "", route.pathname);
    setup();
    fireEvent.change(
      screen.getByPlaceholderText<HTMLTextAreaElement>(
        "How can I assist you today?",
      ),
      { target: { value: "Existing draft" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Open deletion" }));
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(window.location.pathname).toBe(`${prefix}/new`);
    await waitFor(() =>
      expect(
        document.activeElement ===
          screen.getByPlaceholderText<HTMLTextAreaElement>(
            "How can I assist you today?",
          ),
      ).toBe(true),
    );
    expect(
      screen.getByPlaceholderText<HTMLTextAreaElement>(
        "How can I assist you today?",
      ).value,
    ).toBe("");
  });
}
it("keeps the active owner and draft when deleting a background conversation", async () => {
  controls.targetId = "background";
  const { textarea, opener, confirm, closed } =
    await adoptedDeletion("focused");
  const owner = screen.getByTestId("owner").textContent;
  fireEvent.change(textarea, { target: { value: "Active draft" } });
  const focus = rs.spyOn(textarea, "focus");
  confirm();
  await act(async () => closed);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(screen.getByTestId("owner").textContent).toBe(owner);
  expect(textarea.value).toBe("Active draft");
  expect(replace).not.toHaveBeenCalled();
  expect(focus).not.toHaveBeenCalled();
  expect(composerHandoff).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(opener);
});

it("retires failure feedback when the deleting account leaves before rejection", async () => {
  let fail!: (error: Error) => void;
  remove.mockImplementation(
    async () =>
      new Promise<void>((_, reject) => {
        fail = reject;
      }),
  );
  const errorToast = rs.spyOn(toast, "error");
  const log = rs.spyOn(console, "error").mockImplementation(() => undefined);
  const { confirm, closed } = await adoptedDeletion();
  confirm();
  await waitFor(() => expect(remove).toHaveBeenCalledOnce());
  act(() => {
    account.id = "user-b";
    update();
  });
  const textarea = screen.getByPlaceholderText<HTMLTextAreaElement>(
    "How can I assist you today?",
  );
  fireEvent.change(textarea, { target: { value: "New account draft" } });
  const focus = rs.spyOn(HTMLElement.prototype, "focus");
  await act(async () => fail(new Error("Old account failure")));
  await act(async () => closed);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(textarea).toHaveProperty("value", "New account draft");
  expect(errorToast).not.toHaveBeenCalled();
  expect(log).not.toHaveBeenCalled();
  expect(focus).not.toHaveBeenCalled();
  expect(composerHandoff).not.toHaveBeenCalled();
});

for (const action of ["Cancel", "background delete"] as const) {
  it(`restores a programmatic opener without claiming deletion handoff after ${action}`, async () => {
    if (action === "background delete") controls.targetId = "background";
    const { textarea, confirm, closed } = await adoptedDeletion();
    const owner = screen.getByTestId("owner").textContent;
    fireEvent.change(textarea, {
      target: { value: "Programmatic opener draft" },
    });
    if (action === "Cancel")
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    else confirm();
    await act(async () => closed);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(textarea);
    expect(composerHandoff).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByTestId("owner").textContent).toBe(owner);
    expect(textarea.value).toBe("Programmatic opener draft");
    if (action === "Cancel") expect(remove).not.toHaveBeenCalled();
    else {
      expect(remove).toHaveBeenCalledOnce();
      expect(remove.mock.calls[0]?.[0]).toEqual({
        threadId: "background",
        onDeleted: undefined,
      });
    }
  });
}

for (const action of ["Cancel", "Escape"] as const) {
  for (const roundtrip of [false, true]) {
    it(`retires an unconfirmed dialog's default return after account change (${action}, roundtrip=${roundtrip})`, async () => {
      const { textarea, closed } = await adoptedDeletion();
      act(() => {
        account.id = "user-b";
        update();
      });
      if (roundtrip)
        act(() => {
          account.id = "user-a";
          update();
        });
      fireEvent.change(textarea, { target: { value: "New account draft" } });
      const focus = rs.spyOn(HTMLElement.prototype, "focus");
      if (action === "Cancel")
        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      else fireEvent.keyDown(document.activeElement!, { key: "Escape" });
      await act(async () => closed);
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(focus).not.toHaveBeenCalled();
      expect(composerHandoff).not.toHaveBeenCalled();
      expect(remove).not.toHaveBeenCalled();
      expect(replace).not.toHaveBeenCalled();
      expect(textarea.value).toBe("New account draft");
    });
  }
}

it("lets a fresh account's new dialog restore its own focused opener", async () => {
  const { closed } = await adoptedDeletion();
  act(() => {
    account.id = "user-b";
    update();
  });
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  await act(async () => closed);
  const opener = screen.getByRole<HTMLButtonElement>("button", {
    name: "Open deletion",
  });
  opener.focus();
  fireEvent.click(opener);
  const dialog = await screen.findByRole("dialog");
  const nextClosed = new Promise<void>((resolve) =>
    dialog.addEventListener(
      "focusScope.autoFocusOnUnmount",
      () => queueMicrotask(resolve),
      { once: true },
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  await act(async () => nextClosed);
  expect(document.activeElement).toBe(opener);
  expect(composerHandoff).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
});
