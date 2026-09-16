/*
  `useThreadTokenUsage` 的合同，钉的是**一条实测出来的缺陷**：

  `refetch()` 按 TanStack 的设计**绕过 `enabled`**，而 `AgentChat` 的
  `refreshPostRun` 在 run 落定之后正有这么一次调用。原来 `queryFn` 写的是
  `fetchThreadTokenUsage(threadId.value!)`——那个 `!` 等于在说「enabled 保证非空」，
  对 `refetch()` 不成立：wave 216 的对照尺子实测到本仓发出过
  `GET /api/threads/null/token-usage`，**字面量 `null` 直接拼进了 URL**。

  它此前一直藏着：`refreshPostRun` 里在 refetch 之前还命令式打了一次
  `threads.get()`，那次 await 恰好把路由更新等到了。把那次重复取数去掉之后
  （它本身是与上游对不上的一条多发），这个缺陷当场显形——
  **一处重复请求把另一处缺陷遮住了**。
*/

import { defineComponent, h, ref, shallowRef } from "vue";

import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useThreadTokenUsage } from "@/composables/useThreadTokenUsage";

const fetchThreadTokenUsage = vi.fn();

vi.mock("@/core/threads/api", () => ({
  fetchThreadTokenUsage: (...args: unknown[]) => fetchThreadTokenUsage(...args),
}));

let queryClient: QueryClient;

function mountUsage(threadId: ReturnType<typeof ref<string | null>>) {
  const seen = shallowRef<ReturnType<typeof useThreadTokenUsage> | null>(null);
  const wrapper = mount(
    defineComponent({
      setup() {
        seen.value = useThreadTokenUsage(threadId);
        return () => h("div");
      },
    }),
    { global: { plugins: [[VueQueryPlugin, { queryClient }]] } },
  );
  return { wrapper, query: () => seen.value! };
}

beforeEach(() => {
  fetchThreadTokenUsage.mockReset();
  /* `usage` 只留 thread_id 对得上的那一份（retainThreadTokenUsagePlaceholder）。 */
  fetchThreadTokenUsage.mockResolvedValue({
    thread_id: "t-1",
    total_input_tokens: 7,
  });
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
});

afterEach(() => queryClient.clear());

describe("useThreadTokenUsage", () => {
  it("threadId 为空时 refetch() 也不发请求", async () => {
    const threadId = ref<string | null>(null);
    const { wrapper, query } = mountUsage(threadId);
    await flushPromises();

    // enabled 先挡住一层。
    expect(fetchThreadTokenUsage).not.toHaveBeenCalled();

    // **refetch 绕过 enabled**——挡不住就会拼出 /api/threads/null/token-usage。
    await query().refetch();
    await flushPromises();

    expect(fetchThreadTokenUsage).not.toHaveBeenCalled();
    expect(query().usage.value).toBeNull();
    wrapper.unmount();
  });

  it("有 threadId 时照常取，并且带的是那一条", async () => {
    const threadId = ref<string | null>("t-1");
    const { wrapper, query } = mountUsage(threadId);
    await flushPromises();

    expect(fetchThreadTokenUsage).toHaveBeenCalledWith("t-1");
    expect(query().usage.value).toMatchObject({
      thread_id: "t-1",
      total_input_tokens: 7,
    });
    wrapper.unmount();
  });
});
