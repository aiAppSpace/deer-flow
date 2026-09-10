/*
  【文件职责】     钉住项目 mutation 的缓存失效范围，以及项目内会话的翻页 offset 语义。
  【架构位置】     Vue DOM/composable test
  【主要导出】     无；Vitest cases
  【依赖关系】     @tanstack/vue-query · composables/useProjects
  【边界与注意】   最要紧的一条是**哪些 mutation 连带失效无限会话列表**：
                   归档/恢复/删除会改变会话在侧栏的分组，不连带失效侧栏就停在旧分组上；
                   创建与改名不影响成员关系，连带失效等于每次改名都白重取一次会话列表。
                   这条差别没有 UI 能直接看出来，只能在这里钉。
*/
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { mount } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PROJECT_THREADS_PAGE_SIZE,
  useMoveThreadToProject,
  useProjectMutations,
  useProjectThreads,
} from "@/composables/useProjects";
import { projectKeys } from "@/core/projects";
import { INFINITE_THREADS_QUERY_KEY_PREFIX } from "@/core/threads/infinite";

const threadsApi = vi.hoisted(() => ({ moveThreadToProject: vi.fn() }));
vi.mock("@/core/threads/api", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  ...threadsApi,
}));

const api = vi.hoisted(() => ({
  createProject: vi.fn(),
  patchProject: vi.fn(),
  archiveProject: vi.fn(),
  restoreProject: vi.fn(),
  deleteProject: vi.fn(),
  listProjectThreads: vi.fn(),
}));

vi.mock("@/core/projects/api", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  ...api,
}));

const PROJECT = {
  id: "p-1",
  name: "Launch plan",
  instructions: "",
  presentation: {},
  status: "active" as const,
  created_at: "2026-07-01T00:00:00+00:00",
  updated_at: "2026-07-01T00:00:00+00:00",
};

function mountWith<T>(setup: () => T) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidated: unknown[][] = [];
  const original = queryClient.invalidateQueries.bind(queryClient);
  vi.spyOn(queryClient, "invalidateQueries").mockImplementation((filters) => {
    invalidated.push((filters?.queryKey ?? []) as unknown[]);
    return original(filters);
  });

  let exposed!: T;
  const wrapper = mount(
    defineComponent({
      setup() {
        exposed = setup();
        return () => h("div");
      },
    }),
    { global: { plugins: [[VueQueryPlugin, { queryClient }]] } },
  );
  return { wrapper, invalidated, api: exposed };
}

/** 失效清单里有没有以某个前缀开头的 key。 */
function invalidatedWith(invalidated: unknown[][], prefix: readonly unknown[]) {
  return invalidated.some((key) =>
    prefix.every((part, index) => key[index] === part),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});
beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset();
});

describe("项目 mutation 的失效范围", () => {
  it("归档/恢复/删除连带失效无限会话列表", async () => {
    for (const [name, run] of [
      [
        "archive",
        (m: ReturnType<typeof useProjectMutations>) =>
          m.archive.mutateAsync("p-1"),
      ],
      [
        "restore",
        (m: ReturnType<typeof useProjectMutations>) =>
          m.restore.mutateAsync("p-1"),
      ],
      [
        "remove",
        (m: ReturnType<typeof useProjectMutations>) =>
          m.remove.mutateAsync("p-1"),
      ],
    ] as const) {
      api.archiveProject.mockResolvedValue(PROJECT);
      api.restoreProject.mockResolvedValue(PROJECT);
      api.deleteProject.mockResolvedValue(undefined);

      const {
        invalidated,
        api: mutations,
        wrapper,
      } = mountWith(useProjectMutations);
      await run(mutations);

      expect(
        invalidatedWith(invalidated, projectKeys.root()),
        `${name} 应当失效 projects 子树`,
      ).toBe(true);
      expect(
        invalidatedWith(invalidated, INFINITE_THREADS_QUERY_KEY_PREFIX),
        `${name} 改变了会话在侧栏的分组，必须连带失效无限会话列表`,
      ).toBe(true);
      wrapper.unmount();
    }
  });

  it("创建与改名不连带失效会话列表——成员关系没变", async () => {
    for (const [name, run] of [
      [
        "create",
        (m: ReturnType<typeof useProjectMutations>) =>
          m.create.mutateAsync({ name: "New" }),
      ],
      [
        "patch",
        (m: ReturnType<typeof useProjectMutations>) =>
          m.patch.mutateAsync({ id: "p-1", input: { name: "Renamed" } }),
      ],
    ] as const) {
      api.createProject.mockResolvedValue(PROJECT);
      api.patchProject.mockResolvedValue(PROJECT);

      const {
        invalidated,
        api: mutations,
        wrapper,
      } = mountWith(useProjectMutations);
      await run(mutations);

      expect(invalidatedWith(invalidated, projectKeys.root())).toBe(true);
      expect(
        invalidatedWith(invalidated, INFINITE_THREADS_QUERY_KEY_PREFIX),
        `${name} 不影响成员关系，连带失效等于每次都白重取一次会话列表`,
      ).toBe(false);
      wrapper.unmount();
    }
  });
});

describe("项目内会话翻页", () => {
  /*
    **这条断言不区分「累计条数」与「页码 × 页大小」**——在当前实现下两者恒等
    （短页即终止翻页）。它钉的是可观测的合同：第二页的 offset 是 100、
    短页之后没有下一页。想区分那两种写法就得先改掉「短页即终止」，
    在那之前写一条区分它们的断言只会是空的。
  */
  it("第二页的 offset 是累计条数，短页之后不再有下一页", async () => {
    const full = Array.from({ length: PROJECT_THREADS_PAGE_SIZE }, (_, i) => ({
      thread_id: `t-${i}`,
    }));
    api.listProjectThreads.mockResolvedValueOnce(full);

    const { api: query, wrapper } = mountWith(() => useProjectThreads("p-1"));
    await vi.waitFor(() => expect(query.data.value).toBeTruthy());

    // 第二页：短页之后也不能跳条，所以 offset 必须是累计条数。
    const short = [{ thread_id: "t-tail" }];
    api.listProjectThreads.mockResolvedValueOnce(short);
    await query.fetchNextPage();

    expect(api.listProjectThreads.mock.calls[1]?.[1]).toMatchObject({
      limit: PROJECT_THREADS_PAGE_SIZE,
      offset: PROJECT_THREADS_PAGE_SIZE,
    });
    // 短页之后不再有下一页。
    await vi.waitFor(() => expect(query.hasNextPage.value).toBe(false));
    wrapper.unmount();
  });
});

describe("移动会话到项目", () => {
  it("先取消在途的元数据查询，再写缓存——顺序反了会被旧 GET 覆盖", async () => {
    threadsApi.moveThreadToProject.mockResolvedValue({});
    const order: string[] = [];

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.spyOn(queryClient, "cancelQueries").mockImplementation(async () => {
      order.push("cancel");
    });
    vi.spyOn(queryClient, "setQueriesData").mockImplementation(((
      ...args: unknown[]
    ) => {
      order.push("set");
      return args;
    }) as never);
    vi.spyOn(queryClient, "invalidateQueries").mockImplementation(async () => {
      order.push("invalidate");
    });

    let mutation!: ReturnType<typeof useMoveThreadToProject>;
    const wrapper = mount(
      defineComponent({
        setup() {
          mutation = useMoveThreadToProject();
          return () => h("div");
        },
      }),
      { global: { plugins: [[VueQueryPlugin, { queryClient }]] } },
    );

    await mutation.mutateAsync({ threadId: "t-1", projectId: "p-1" });

    expect(order.indexOf("cancel")).toBeGreaterThanOrEqual(0);
    expect(order.indexOf("cancel")).toBeLessThan(order.indexOf("set"));
    wrapper.unmount();
  });

  it("移动之后失效搜索、无限列表与项目会话列表三处", async () => {
    threadsApi.moveThreadToProject.mockResolvedValue({});
    const {
      invalidated,
      api: mutation,
      wrapper,
    } = mountWith(() => useMoveThreadToProject());

    await mutation.mutateAsync({ threadId: "t-1", projectId: null });

    expect(invalidatedWith(invalidated, ["threads", "search"])).toBe(true);
    expect(
      invalidatedWith(invalidated, INFINITE_THREADS_QUERY_KEY_PREFIX),
    ).toBe(true);
    expect(
      invalidatedWith(invalidated, [...projectKeys.root(), "threads"]),
      "移动改变了项目会话列表的成员关系",
    ).toBe(true);
    wrapper.unmount();
  });
});
