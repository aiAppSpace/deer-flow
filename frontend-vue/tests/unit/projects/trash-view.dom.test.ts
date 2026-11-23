import { flushPromises, mount } from "@vue/test-utils";
import { ref } from "vue";
import { beforeEach, expect, it, vi } from "vitest";
import TrashView from "@/components/workspace/trash/TrashView.vue";
import { RestoreConflictError, TrashNotFoundError } from "@/core/trash";
import {
  createWorkspaceToastStore,
  workspaceToastKey,
} from "@/core/workspace-shell/toast";
const api = vi.hoisted(() => ({
  restore: vi.fn(),
  purge: vi.fn(),
  empty: vi.fn(),
  more: vi.fn(),
}));
const documentRow = {
  id: "d-1",
  name: "report.md",
  size_bytes: 3,
  sha256: "",
  content_missing: false,
  source_thread_id: null,
  source_kind: null,
  source_name: null,
  created_at: "",
  updated_at: "",
  trashed_at: new Date().toISOString(),
  trash_origin: { project_id: "gone", project_name: "Old project" },
};
const query = {
  data: ref({
    pages: [{ documents: [documentRow], total: 123, offset: 0, limit: 100 }],
  }),
  isLoading: ref(false),
  isError: ref(false),
  hasNextPage: ref(true),
  isFetchingNextPage: ref(false),
  fetchNextPage: api.more,
  refetch: vi.fn(),
};
vi.mock("@/composables/useTrash", () => ({
  useInfiniteTrashDocuments: () => query,
  useTrashMutations: () =>
    Object.fromEntries(
      ["restore", "purge", "empty"].map((key) => [
        key,
        { mutateAsync: api[key as "restore"], isPending: ref(false) },
      ]),
    ),
}));
vi.mock("@/composables/useProjects", () => ({
  useProjects: () => ({
    data: ref([{ id: "active", name: "Active project", status: "active" }]),
    isLoading: ref(false),
    isError: ref(false),
    refetch: vi.fn(),
  }),
}));
vi.mock("@/composables/useProjectDocuments", () => ({
  useProjectsConfig: () => ({ data: ref({ trash_retention_days: 30 }) }),
}));
beforeEach(() => Object.values(api).forEach((fn) => fn.mockReset()));
function render() {
  const toast = createWorkspaceToastStore();
  return {
    toast,
    wrapper: mount(TrashView, {
      attachTo: document.body,
      global: { provide: { [workspaceToastKey as symbol]: toast } },
    }),
  };
}
async function click(text: string) {
  const button = [...document.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === text,
  );
  expect(button).toBeTruthy();
  button!.click();
  await flushPromises();
}

it("retries no-target restores with an active project and reports merged content without creating a duplicate row", async () => {
  api.restore
    .mockRejectedValueOnce(new TrashNotFoundError("gone"))
    .mockResolvedValueOnce({
      outcome: "merged",
      document: { ...documentRow, name: "survivor.md" },
    });
  const { wrapper, toast } = render();
  await click("Restore");
  await click("Active project");
  expect(api.restore.mock.calls).toEqual([
    [{ documentId: "d-1" }],
    [{ documentId: "d-1", projectId: "active" }],
  ]);
  expect(
    toast.toasts.value.some(
      (item) =>
        item.message.includes("survivor.md") && item.message.includes("merged"),
    ),
  ).toBe(true);
  expect(wrapper.findAll('[data-trash-document-id="d-1"]')).toHaveLength(1);
  wrapper.unmount();
});

it("keeps content-missing restore conflicts visible and does not open the target picker", async () => {
  api.restore.mockRejectedValue(
    new RestoreConflictError("missing", "content_missing"),
  );
  const { wrapper, toast } = render();
  await click("Restore");
  expect(
    toast.toasts.value.some((item) =>
      item.message.includes("stays in the trash"),
    ),
  ).toBe(true);
  expect(document.body.textContent).not.toContain("Choose a project");
  expect(wrapper.find('[data-trash-document-id="d-1"]').exists()).toBe(true);
  wrapper.unmount();
});

it("confirms emptying all server-counted documents and retains the confirmation after partial purge failure", async () => {
  api.empty.mockRejectedValue(new Error("partial cleanup"));
  const { wrapper, toast } = render();
  await click("Empty trash");
  expect(document.body.textContent).toContain(
    "123 documents will be permanently deleted",
  );
  const buttons = [...document.querySelectorAll("button")].filter(
    (b) => b.textContent?.trim() === "Empty trash",
  );
  buttons.at(-1)!.click();
  await flushPromises();
  expect(api.empty).toHaveBeenCalledOnce();
  expect(api.purge).not.toHaveBeenCalled();
  expect(
    toast.toasts.value.some((item) => item.message === "partial cleanup"),
  ).toBe(true);
  expect(document.body.textContent).toContain(
    "123 documents will be permanently deleted",
  );
  wrapper.unmount();
});
