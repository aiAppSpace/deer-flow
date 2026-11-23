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
import { toast } from "sonner";

import { SidebarProvider } from "@/components/ui/sidebar";
import { NewProjectDialog } from "@/components/workspace/move-to-project-menu";
import { ProjectsSection } from "@/components/workspace/projects-section";
import { DEFAULT_LOCALE } from "@/core/i18n";
import { I18nProvider } from "@/core/i18n/context";
import type { AgentThread } from "@/core/threads/types";
const api = rs.hoisted(() => ({ create: rs.fn(), move: rs.fn() }));
rs.mock("@/core/projects", () => ({
  useCreateProject: () => useMutation({ mutationFn: api.create }),
  useProjects: () => ({ data: [] }),
}));
rs.mock("@/core/threads/hooks", () => ({
  useMoveThreadToProject: () => useMutation({ mutationFn: api.move }),
}));
rs.mock("@/components/workspace/recent-chat-list", () => ({
  ThreadSidebarItem: () => null,
}));
rs.mock("@/core/settings", () => ({
  useLocalSettings: () => [{ projectsDisplayMode: "flat" }, rs.fn()],
}));
rs.mock("@/core/static-mode", () => ({ isStaticWebsiteOnly: () => false }));
rs.mock("sonner", () => ({ toast: { error: rs.fn() } }));
beforeEach(() => {
  api.create.mockReset();
  api.move.mockReset().mockResolvedValue(undefined);
  rs.mocked(toast.error).mockClear();
});
afterEach(() => cleanup());
async function setup() {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  const close = rs.fn();
  const tree = (open: boolean) => (
    <I18nProvider initialLocale={DEFAULT_LOCALE}>
      <QueryClientProvider client={client}>
        <NewProjectDialog
          thread={{ thread_id: "chat-a" } as AgentThread}
          open={open}
          onOpenChange={close}
        />
      </QueryClientProvider>
    </I18nProvider>
  );
  const view = render(tree(true));
  fireEvent.change(await screen.findByPlaceholderText("Project name"), {
    target: { value: "Original project" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  await waitFor(() => expect(api.create).toHaveBeenCalledOnce());
  return { client, close, view, tree };
}
for (const settle of ["success", "failure"] as const) {
  it(`retires a closed and reopened creation before its late ${settle}`, async () => {
    let resolve!: (value: { id: string }) => void,
      reject!: (reason: Error) => void;
    api.create.mockImplementationOnce(
      () =>
        new Promise((yes, no) => {
          resolve = yes;
          reject = no;
        }),
    );
    const { close, view, tree, client } = await setup();
    view.rerender(tree(false));
    view.rerender(tree(true));
    await act(async () => {
      if (settle === "success") resolve({ id: "created-project" });
      else reject(new Error("Old creation failed"));
    });
    expect(close).not.toHaveBeenCalled();
    expect(api.move).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    client.clear();
  });
}
it("keeps the accepted creation and move in the original thread", async () => {
  api.create.mockResolvedValue({ id: "created-project" });
  const { close, client } = await setup();
  await waitFor(() =>
    expect(api.move).toHaveBeenCalledWith(
      { threadId: "chat-a", projectId: "created-project" },
      expect.anything(),
    ),
  );
  expect(close).toHaveBeenCalledWith(false);
  expect(toast.error).not.toHaveBeenCalled();
  client.clear();
});
it("reports a move failure after successful creation as a move failure", async () => {
  api.create.mockResolvedValue({ id: "created-project" });
  api.move.mockRejectedValue(new Error(""));
  const { client } = await setup();
  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith("Failed to move chat"),
  );
  client.clear();
});

it("does not close or erase a reopened sidebar project creation", async () => {
  let resolve!: (value: { id: string }) => void;
  api.create.mockImplementationOnce(
    () =>
      new Promise((yes) => {
        resolve = yes;
      }),
  );
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  render(
    <I18nProvider initialLocale={DEFAULT_LOCALE}>
      <QueryClientProvider client={client}>
        <SidebarProvider>
          <ProjectsSection />
        </SidebarProvider>
      </QueryClientProvider>
    </I18nProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "New project" }));
  fireEvent.change(await screen.findByPlaceholderText("Project name"), {
    target: { value: "Original project" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  await waitFor(() => expect(api.create).toHaveBeenCalledOnce());
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  fireEvent.click(screen.getByRole("button", { name: "New project" }));
  fireEvent.change(await screen.findByPlaceholderText("Project name"), {
    target: { value: "New draft to keep" },
  });
  await act(async () => resolve({ id: "created" }));
  expect(screen.queryByRole("dialog")).not.toBeNull();
  expect(
    screen.getByPlaceholderText<HTMLInputElement>("Project name").value,
  ).toBe("New draft to keep");
  client.clear();
});
