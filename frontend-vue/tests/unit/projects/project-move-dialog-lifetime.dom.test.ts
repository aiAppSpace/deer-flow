import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ref } from "vue";
import ProjectMoveDialog from "@/components/workspace/projects/ProjectMoveDialog.vue";
import {
  createWorkspaceToastStore,
  workspaceToastKey,
} from "@/core/workspace-shell/toast";

const api = vi.hoisted(() => ({ create: vi.fn(), move: vi.fn() }));
vi.mock("@/composables/useProjects", () => ({
  useProjectMutations: () => ({
    create: { mutateAsync: api.create, isPending: ref(false) },
  }),
  useMoveThreadToProject: () => ({ mutateAsync: api.move }),
}));
const wrappers: ReturnType<typeof mount>[] = [];
const stores: ReturnType<typeof createWorkspaceToastStore>[] = [];
beforeEach(() => {
  api.create.mockReset();
  api.move.mockReset().mockResolvedValue(undefined);
});
afterEach(() => {
  wrappers.splice(0).forEach((w) => w.unmount());
  stores.splice(0).forEach((s) => s.clear());
  document.body.innerHTML = "";
});
async function render() {
  const toast = createWorkspaceToastStore();
  stores.push(toast);
  const wrapper = mount(ProjectMoveDialog, {
    attachTo: document.body,
    props: { threadId: "chat-a" },
    global: { provide: { [workspaceToastKey as symbol]: toast } },
  });
  wrappers.push(wrapper);
  await flushPromises();
  const input = document.querySelector("input")!;
  input.value = "Original project";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await flushPromises();
  [...document.querySelectorAll("button")]
    .find((b) => b.textContent?.trim() === "Create")!
    .click();
  await flushPromises();
  return { wrapper, toast };
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
    const { wrapper, toast } = await render();
    await wrapper.setProps({ threadId: null });
    await wrapper.setProps({ threadId: "chat-a" });
    if (settle === "success") resolve({ id: "created-project" });
    else reject(new Error("Old creation failed"));
    await flushPromises();
    expect(wrapper.emitted("close")).toBeUndefined();
    expect(api.move).not.toHaveBeenCalled();
    expect(toast.toasts.value).toEqual([]);
  });
}
it("keeps the accepted creation and move in the original thread", async () => {
  api.create.mockResolvedValue({ id: "created-project" });
  const { wrapper, toast } = await render();
  expect(wrapper.emitted("close")).toHaveLength(1);
  expect(api.move).toHaveBeenCalledExactlyOnceWith({
    threadId: "chat-a",
    projectId: "created-project",
  });
  expect(toast.toasts.value).toEqual([]);
});
it("reports a move failure after successful creation as a move failure", async () => {
  api.create.mockResolvedValue({ id: "created-project" });
  api.move.mockRejectedValue(new Error(""));
  const { toast } = await render();
  expect(toast.toasts.value.map((t) => t.message)).toEqual([
    "Failed to move chat",
  ]);
});
