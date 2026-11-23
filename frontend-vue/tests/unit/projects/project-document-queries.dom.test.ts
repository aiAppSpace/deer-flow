import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { mount } from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";
import { beforeEach, expect, it, vi } from "vitest";
import {
  useInfiniteProjectDocuments,
  useInfiniteProjectThreadFiles,
  useProjectDocumentMutations,
} from "@/composables/useProjectDocuments";
import {
  useInfiniteTrashDocuments,
  useTrashMutations,
} from "@/composables/useTrash";
import { TRASH_QUERY_KEY } from "@/core/trash";
import { resetWorkspaceQueries } from "@/core/auth/workspace-queries";
const api = vi.hoisted(() => ({
  listProjectDocuments: vi.fn(),
  listProjectThreadFiles: vi.fn(),
  deleteProjectDocument: vi.fn(),
  listTrashDocuments: vi.fn(),
  emptyTrash: vi.fn(),
  uploadProjectDocument: vi.fn(),
}));
vi.mock("@/core/projects/api", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  listProjectDocuments: api.listProjectDocuments,
  listProjectThreadFiles: api.listProjectThreadFiles,
  deleteProjectDocument: api.deleteProjectDocument,
  uploadProjectDocument: api.uploadProjectDocument,
}));
vi.mock("@/core/trash/api", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  listTrashDocuments: api.listTrashDocuments,
  emptyTrash: api.emptyTrash,
}));
beforeEach(() => Object.values(api).forEach((fn) => fn.mockReset()));
function harness<T>(setup: () => T) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  let owner!: T;
  const wrapper = mount(
    defineComponent({
      setup() {
        owner = setup();
        return () => h("div");
      },
    }),
    { global: { plugins: [[VueQueryPlugin, { queryClient: client }]] } },
  );
  return { owner, client, wrapper };
}
it("follows backend member-thread next_offset instead of counting displayed files", async () => {
  api.listProjectThreadFiles
    .mockResolvedValueOnce({
      groups: [{ thread_id: "one", files: [], truncated: false }],
      next_offset: 17,
      truncated: false,
    })
    .mockResolvedValueOnce({ groups: [], next_offset: null, truncated: false });
  const { owner, wrapper } = harness(() =>
    useInfiniteProjectThreadFiles("p", { file_limit: 200 }),
  );
  await vi.waitFor(() => expect(owner.hasNextPage.value).toBe(true));
  await owner.fetchNextPage();
  expect(api.listProjectThreadFiles.mock.calls.map((call) => call[1])).toEqual([
    { offset: 0, file_limit: 200 },
    { offset: 17, file_limit: 200 },
  ]);
  expect(api.listProjectThreadFiles.mock.calls[0]![2].signal).toBeInstanceOf(
    AbortSignal,
  );
  await vi.waitFor(() => expect(owner.hasNextPage.value).toBe(false));
  wrapper.unmount();
});
it("pages shelf documents by loaded row count and total", async () => {
  api.listProjectDocuments
    .mockResolvedValueOnce({
      documents: [{ id: "a" }, { id: "b" }],
      total: 3,
      offset: 0,
      limit: 100,
    })
    .mockResolvedValueOnce({
      documents: [{ id: "c" }],
      total: 3,
      offset: 2,
      limit: 100,
    });
  const { owner, wrapper } = harness(() => useInfiniteProjectDocuments("p"));
  await vi.waitFor(() => expect(owner.hasNextPage.value).toBe(true));
  await owner.fetchNextPage();
  expect(api.listProjectDocuments.mock.calls.map((call) => call[1])).toEqual([
    { limit: 100, offset: 0 },
    { limit: 100, offset: 2 },
  ]);
  await vi.waitFor(() => expect(owner.hasNextPage.value).toBe(false));
  wrapper.unmount();
});
it("refetches remaining trash after a partial empty-all 500 instead of clearing all rows locally", async () => {
  api.listTrashDocuments
    .mockResolvedValueOnce({
      documents: [{ id: "purged" }, { id: "remaining" }],
      total: 2,
      offset: 0,
      limit: 100,
    })
    .mockResolvedValue({
      documents: [{ id: "remaining" }],
      total: 1,
      offset: 0,
      limit: 100,
    });
  api.emptyTrash.mockRejectedValue(new Error("partial cleanup"));
  const { owner, wrapper } = harness(() => ({
    query: useInfiniteTrashDocuments(),
    mutations: useTrashMutations(),
  }));
  await vi.waitFor(() =>
    expect(owner.query.data.value?.pages[0]?.total).toBe(2),
  );
  await expect(owner.mutations.empty.mutateAsync()).rejects.toThrow(
    "partial cleanup",
  );
  await vi.waitFor(() =>
    expect(owner.query.data.value?.pages[0]?.documents).toEqual([
      { id: "remaining" },
    ]),
  );
  expect(api.emptyTrash).toHaveBeenCalledOnce();
  expect(api.listTrashDocuments).toHaveBeenCalledTimes(2);
  wrapper.unmount();
});
it("moving a shelf row to trash invalidates the trash owner as well as the project owner", async () => {
  api.deleteProjectDocument.mockResolvedValue(undefined);
  const { owner, client, wrapper } = harness(() =>
    useProjectDocumentMutations("p"),
  );
  const invalidate = vi.spyOn(client, "invalidateQueries");
  await owner.remove.mutateAsync("d");
  expect(invalidate).toHaveBeenCalledWith({ queryKey: TRASH_QUERY_KEY });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ["projects"] });
  wrapper.unmount();
});

it("captures the project at click time before Vue Query schedules a document request", async () => {
  const projectId = ref("project-a");
  const file = new File(["content"], "document.txt");
  api.uploadProjectDocument.mockResolvedValue({
    document: { id: "doc" },
    deduplicated: false,
  });
  const { owner, wrapper } = harness(() =>
    useProjectDocumentMutations(projectId),
  );
  const pending = owner.upload.mutateAsync({ file });
  projectId.value = "project-b";
  await pending;
  expect(api.uploadProjectDocument).toHaveBeenCalledWith(
    "project-a",
    { file },
    { signal: expect.any(AbortSignal) },
  );
  wrapper.unmount();
});

it.each(["documents", "trash"] as const)(
  "aborts %s mutations and ignores late completion after its owner is disposed",
  async (kind) => {
    let resolve!: (value: unknown) => void;
    const request = new Promise((done) => {
      resolve = done;
    });
    const call =
      kind === "documents" ? api.deleteProjectDocument : api.emptyTrash;
    call.mockReturnValue(request);
    const { owner, client, wrapper } = harness(() =>
      kind === "documents"
        ? useProjectDocumentMutations("p").remove
        : useTrashMutations().empty,
    );
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const pending =
      kind === "documents"
        ? owner.mutateAsync("d" as never)
        : owner.mutateAsync(undefined as never);
    const settled = pending.catch((error: unknown) => error);
    await vi.waitFor(() => expect(call).toHaveBeenCalledOnce());
    const signal = call.mock.calls[0]!.at(-1)?.signal as AbortSignal;
    wrapper.unmount();
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(signal.aborted).toBe(true);
    resolve(undefined);
    expect(await settled).toMatchObject({ name: "AbortError" });
    expect(invalidate).not.toHaveBeenCalled();
  },
);

it("captures the account synchronously before Vue Query schedules a request", async () => {
  const { owner, client, wrapper } = harness(() =>
    useProjectDocumentMutations("p"),
  );
  const pending = owner.remove
    .mutateAsync("d")
    .catch((error: unknown) => error);
  await resetWorkspaceQueries(client);
  expect(await pending).toMatchObject({ name: "AbortError" });
  expect(api.deleteProjectDocument).not.toHaveBeenCalled();
  wrapper.unmount();
});
it("rejects old-account completions before unmount and cannot invalidate the new account", async () => {
  let finish!: () => void;
  api.deleteProjectDocument.mockReturnValue(
    new Promise<void>((resolve) => {
      finish = resolve;
    }),
  );
  const { owner, client, wrapper } = harness(() =>
    useProjectDocumentMutations("p"),
  );
  const pending = owner.remove
    .mutateAsync("d")
    .catch((error: unknown) => error);
  await vi.waitFor(() =>
    expect(api.deleteProjectDocument).toHaveBeenCalledOnce(),
  );
  await resetWorkspaceQueries(client);
  const invalidate = vi.spyOn(client, "invalidateQueries");
  finish();
  expect(await pending).toMatchObject({ name: "AbortError" });
  expect(invalidate).not.toHaveBeenCalled();
  wrapper.unmount();
});
it("suppresses old-account mutation callbacks and converts a late transport failure into cancellation", async () => {
  let reject!: (error: Error) => void;
  api.emptyTrash.mockReturnValue(
    new Promise<void>((_resolve, fail) => {
      reject = fail;
    }),
  );
  const { owner, client, wrapper } = harness(useTrashMutations);
  const onError = vi.fn();
  const onSettled = vi.fn();
  const pending = owner.empty
    .mutateAsync(undefined, { onError, onSettled })
    .catch((error: unknown) => error);
  await vi.waitFor(() => expect(api.emptyTrash).toHaveBeenCalledOnce());
  await resetWorkspaceQueries(client);
  reject(new Error("old-account provider error"));
  expect(await pending).toMatchObject({ name: "AbortError" });
  expect(onError).not.toHaveBeenCalled();
  expect(onSettled).not.toHaveBeenCalled();
  wrapper.unmount();
});
