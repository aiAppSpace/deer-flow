import { afterEach, expect, it, rs } from "@rstest/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  act,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { SidebarProvider } from "@/components/ui/sidebar";
import { ThreadSidebarItem } from "@/components/workspace/recent-chat-list";
import { ThreadDeleteDialogProvider } from "@/components/workspace/thread-delete-dialog";
import { AuthProvider } from "@/core/auth/AuthProvider";
import type { User } from "@/core/auth/types";
import { DEFAULT_LOCALE } from "@/core/i18n";
import { I18nProvider } from "@/core/i18n/context";

rs.mock("next/navigation", () => ({
  useRouter: () => ({ push: rs.fn(), replace: rs.fn(), refresh: rs.fn() }),
  usePathname: () => "/workspace",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

const pendingRename = rs.hoisted(() => ({ updateState: rs.fn() }));
rs.mock("sonner", () => ({ toast: { success: rs.fn(), error: rs.fn() } }));
rs.mock("@/core/api", () => ({
  getAPIClient: () => ({ threads: { updateState: pendingRename.updateState } }),
}));
function makeUser(permissions: string[] | undefined): User {
  return {
    id: "user-1",
    email: "user@example.test",
    system_role: "user",
    ...(permissions === undefined ? {} : { permissions }),
  } as User;
}

function makeThread() {
  return {
    thread_id: "thread-1",
    title: "A thread",
    updated_at: "2026-01-01T00:00:00Z",
  } as never;
}

function renderItem(user: User): ReturnType<typeof render> {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const tree: ReactNode = (
    <I18nProvider initialLocale={DEFAULT_LOCALE}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider initialUser={user}>
          <SidebarProvider>
            <ThreadDeleteDialogProvider>
              <ThreadSidebarItem thread={makeThread()} isActive={false} />
            </ThreadDeleteDialogProvider>
          </SidebarProvider>
        </AuthProvider>
      </QueryClientProvider>
    </I18nProvider>
  );
  return render(tree);
}

/** Opens the row's "more" dropdown — the Delete item lives inside it.
 * Radix triggers open on pointerdown, not click (verified in happy-dom). */
async function openRowMenu(): Promise<void> {
  const trigger = await screen.findByRole("button", { name: /more/i });
  fireEvent.pointerDown(trigger, { button: 0, pointerType: "mouse" });
  fireEvent.click(trigger);
}

afterEach(() => {
  rs.clearAllMocks();
  pendingRename.updateState.mockReset();
  cleanup();
});

async function openRename() {
  await openRowMenu();
  fireEvent.click(await screen.findByRole("menuitem", { name: "Rename" }));
  return await screen.findByPlaceholderText("Rename");
}
for (const outcome of ["success", "failure"] as const)
  for (const reopen of [false, true]) {
    it(`rename ${outcome} belongs to its own dialog (reopen=${reopen})`, async () => {
      let resolve!: () => void;
      let reject!: (error: Error) => void;
      pendingRename.updateState.mockReturnValue(
        new Promise<void>((yes, no) => {
          resolve = yes;
          reject = no;
        }),
      );
      renderItem(makeUser(["threads:read"]));
      fireEvent.change(await openRename(), {
        target: { value: "First draft" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() =>
        expect(pendingRename.updateState).toHaveBeenCalledWith("thread-1", {
          values: { title: "First draft" },
        }),
      );
      if (reopen) {
        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
        await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
        fireEvent.change(await openRename(), {
          target: { value: "Second draft" },
        });
      }
      await act(async () => {
        if (outcome === "success") resolve();
        else reject(new Error("Rename rejected"));
        await new Promise((done) => setTimeout(done, 20));
      });
      if (reopen) {
        expect(
          screen.getByPlaceholderText<HTMLInputElement>("Rename").value,
        ).toBe("Second draft");
        expect(toast.error).not.toHaveBeenCalled();
      } else if (outcome === "success")
        await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      else {
        expect(
          screen.getByPlaceholderText<HTMLInputElement>("Rename").value,
        ).toBe("First draft");
        expect(toast.error).toHaveBeenCalledWith("Rename rejected");
      }
    });
  }
