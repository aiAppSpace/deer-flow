/*
  `useThreadMetadata` 的合同。**这一层此前是缺的**，而 `archive.ts` /
  `useProjects.ts` / `cache-invalidation.ts` / `useThreads.rename` 四处都在失效
  `["thread","metadata",id]`——没有拥有者，所以那四处**全是空操作**。
  这里钉的三件事，缺一件那个缺口就会以别的形状回来：

  ① key 逐字等于 `threadMetadataQueryKey`（否则失效又落空）；
  ② 403 / 404 归一成 `null`（= missing），其余错误照抛（= unknown）——
     判据在 `core/threads/thread-presence.ts`：一次瞬时 5xx 不许把用户踢回新会话；
  ③ 换一条线程就是换一份缓存，旧线程的答案不会被当成新线程的。
*/

import { defineComponent, h, nextTick, ref, shallowRef } from "vue";

import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useThreadMetadata } from "@/composables/useThreadMetadata";
import { GatewayResponseError } from "@/core/api/errors";
import { threadMetadataQueryKey } from "@/core/threads/metadata";
import type { AgentThread } from "@/core/threads/types";

const get = vi.fn();

vi.mock("@/core/api/api-client", () => ({
  getAPIClient: () => ({ threads: { get } }),
}));

let queryClient: QueryClient;

function threadOf(threadId: string, title: string) {
  return {
    thread_id: threadId,
    values: { title },
  } as unknown as AgentThread;
}

function mountMetadata(threadId = ref<string | null>("t-1")) {
  /* shallowRef：普通 ref 会把 useQuery 返回对象里的那些 ref 自动解包。 */
  const seen = shallowRef<ReturnType<typeof useThreadMetadata> | null>(null);
  const wrapper = mount(
    defineComponent({
      setup() {
        seen.value = useThreadMetadata(threadId);
        return () => h("div");
      },
    }),
    { global: { plugins: [[VueQueryPlugin, { queryClient }]] } },
  );
  return { wrapper, query: () => seen.value! };
}

beforeEach(() => {
  get.mockReset();
  queryClient = new QueryClient({
    /* gcTime 不设 0：下面那条「换一条线程」要看旧 key 的缓存还在不在。 */
    defaultOptions: { queries: { retry: false } },
  });
});

afterEach(() => queryClient.clear());

describe("useThreadMetadata", () => {
  it("缓存写在 threadMetadataQueryKey 上，失效方找得到它", async () => {
    get.mockResolvedValue(threadOf("t-1", "Original"));
    const { wrapper, query } = mountMetadata();
    await flushPromises();

    expect(query().data.value).toMatchObject({ thread_id: "t-1" });
    expect(
      queryClient.getQueryData(threadMetadataQueryKey("t-1")),
    ).toMatchObject({ thread_id: "t-1" });

    // 失效之后真的会重取——这正是改名/归档/移到项目那几处依赖的行为。
    get.mockResolvedValue(threadOf("t-1", "Renamed"));
    await queryClient.invalidateQueries({
      queryKey: threadMetadataQueryKey("t-1"),
    });
    await flushPromises();

    expect(get).toHaveBeenCalledTimes(2);
    expect(query().data.value?.values.title).toBe("Renamed");
    wrapper.unmount();
  });

  it.each([403, 404])(
    "%i 归一成 null（线程对这个用户不存在）",
    async (status) => {
      get.mockRejectedValue(
        new GatewayResponseError("nope", status, null, "nope"),
      );
      const { wrapper, query } = mountMetadata();
      await flushPromises();

      expect(query().data.value).toBeNull();
      expect(query().error.value).toBeNull();
      wrapper.unmount();
    },
  );

  /*
    5xx **不是** missing。归进 missing 的话，一次瞬时 500 就会把用户连人带对话
    退回新会话，而且没有任何提示——判词写在 thread-presence.ts。
  */
  it("5xx 留在 error 上，不当成 missing", async () => {
    get.mockRejectedValue(new GatewayResponseError("boom", 500, null, "boom"));
    const { wrapper, query } = mountMetadata();
    await flushPromises();

    expect(query().error.value).toBeTruthy();
    expect(query().data.value).toBeUndefined();
    wrapper.unmount();
  });

  it("换一条线程就是换一份缓存", async () => {
    const threadId = ref<string | null>("t-1");
    get.mockImplementation((id: string) =>
      Promise.resolve(threadOf(id, `title-${id}`)),
    );
    const { wrapper, query } = mountMetadata(threadId);
    await flushPromises();
    expect(query().data.value?.values.title).toBe("title-t-1");

    threadId.value = "t-2";
    await nextTick();
    await flushPromises();

    expect(query().data.value?.values.title).toBe("title-t-2");
    expect(
      queryClient.getQueryData(threadMetadataQueryKey("t-1")),
    ).toMatchObject({ thread_id: "t-1" });
    wrapper.unmount();
  });

  it("没有 threadId 时不发请求", async () => {
    const { wrapper, query } = mountMetadata(ref<string | null>(null));
    await flushPromises();

    expect(get).not.toHaveBeenCalled();
    expect(query().data.value).toBeUndefined();
    wrapper.unmount();
  });
});
