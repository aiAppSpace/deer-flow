/*
  【文件职责】     钉住归档写入的缓存收尾顺序与失效范围。
  【架构位置】     Vue DOM/composable test
  【主要导出】     无；Vitest cases
  【依赖关系】     @tanstack/vue-query · core/threads/archive
  【边界与注意】   三条都没有 UI 能直接看出来，只能在这里钉：
                   ① **先取消在途查询再写缓存**——顺序反了，一个更早的读回来会把旧状态
                      放回去，表现是「归档了一下又弹回来」。
                   ② 无限列表必须 **resetQueries**：成员关系变了，旧分页偏移作废，
                      只 invalidate 会拿着过时 offset 继续翻。
                   ③ 项目会话列表也要失效——其余每种会话 mutation 都失效这个前缀。
*/
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { mount } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useArchiveThread } from "@/core/threads/archive";
import { INFINITE_THREADS_QUERY_KEY_PREFIX } from "@/core/threads/infinite";
import { projectKeys } from "@/core/projects";

const api = vi.hoisted(() => ({ patchThreadMetadata: vi.fn() }));
vi.mock("@/core/threads/api", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  ...api,
}));

function harness() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const calls: { op: string; key: unknown[] }[] = [];
  for (const op of [
    "cancelQueries",
    "resetQueries",
    "invalidateQueries",
  ] as const) {
    /*
      三个方法的 filters 参数类型互不相同（QueryFilters / ResetQueryFilters /
      InvalidateQueryFilters），一份实现喂三个 spy 必然对不上其中两个。
      这里只关心「被调用时带的 queryKey」，所以按最小共同形状读。
    */
    vi.spyOn(queryClient, op).mockImplementation((async (filters?: {
      queryKey?: unknown[];
    }) => {
      calls.push({ op, key: (filters?.queryKey ?? []) as unknown[] });
    }) as never);
  }
  const setSpy = vi.spyOn(queryClient, "setQueriesData").mockImplementation(((
    ...a: unknown[]
  ) => {
    calls.push({ op: "set", key: [] });
    return a;
  }) as never);

  let mutation!: ReturnType<typeof useArchiveThread>;
  const wrapper = mount(
    defineComponent({
      setup() {
        mutation = useArchiveThread();
        return () => h("div");
      },
    }),
    { global: { plugins: [[VueQueryPlugin, { queryClient }]] } },
  );
  return { mutation, calls, wrapper, setSpy };
}

const startsWith = (key: unknown[], prefix: readonly unknown[]) =>
  prefix.every((part, i) => key[i] === part);

afterEach(() => vi.restoreAllMocks());
beforeEach(() => api.patchThreadMetadata.mockReset());

describe("归档会话的缓存收尾", () => {
  it("先取消在途查询，再写缓存——顺序反了会被旧读覆盖", async () => {
    api.patchThreadMetadata.mockResolvedValue({});
    const { mutation, calls, wrapper } = harness();

    await mutation.mutateAsync({ threadId: "t-1", archived: true });

    const firstSet = calls.findIndex((c) => c.op === "set");
    const lastCancel = calls.map((c) => c.op).lastIndexOf("cancelQueries");
    expect(lastCancel).toBeGreaterThanOrEqual(0);
    expect(lastCancel).toBeLessThan(firstSet);
    wrapper.unmount();
  });

  it("无限列表用 resetQueries 丢弃旧分页偏移，而不是只失效", async () => {
    api.patchThreadMetadata.mockResolvedValue({});
    const { mutation, calls, wrapper } = harness();

    await mutation.mutateAsync({ threadId: "t-1", archived: true });

    const reset = calls.filter(
      (c) =>
        c.op === "resetQueries" &&
        startsWith(c.key, INFINITE_THREADS_QUERY_KEY_PREFIX),
    );
    expect(reset.length, "成员关系变了，旧 offset 作废").toBeGreaterThan(0);
    wrapper.unmount();
  });

  /*
    列表本身走的是上一条用例里的 `resetQueries`，不在这里数——
    这一条只管另外两处 invalidate。（原来它还断言了 `["threads","search"]`，
    而本仓没有任何查询拥有那个 key，那一行验的是一次空操作。）
  */
  it("同时失效单条元数据与项目会话列表", async () => {
    api.patchThreadMetadata.mockResolvedValue({});
    const { mutation, calls, wrapper } = harness();

    await mutation.mutateAsync({ threadId: "t-1", archived: false });

    const invalidated = calls.filter((c) => c.op === "invalidateQueries");
    expect(
      invalidated.some((c) => startsWith(c.key, ["thread", "metadata", "t-1"])),
    ).toBe(true);
    expect(
      invalidated.some((c) =>
        startsWith(c.key, [...projectKeys.root(), "threads"]),
      ),
      "归档改变了项目会话列表的成员关系",
    ).toBe(true);
    wrapper.unmount();
  });

  it("写入的元数据键是 deerflow_archived，且值是布尔", async () => {
    api.patchThreadMetadata.mockResolvedValue({});
    const { mutation, wrapper } = harness();

    await mutation.mutateAsync({ threadId: "t-1", archived: true });

    expect(api.patchThreadMetadata).toHaveBeenCalledWith("t-1", {
      deerflow_archived: true,
    });
    wrapper.unmount();
  });
});
