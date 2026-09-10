import { flushPromises, mount } from "@vue/test-utils";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AccountSettings from "@/components/workspace/settings/AccountSettings.vue";
import { fetch as fetchWithAuth } from "@/core/api/fetcher";
import { nuxtI18nMocks, nuxtI18nStub } from "../../support/nuxt-i18n";
import { buildComposerDraftKey } from "@/core/threads/composer-draft";
import { INFINITE_THREADS_QUERY_KEY_PREFIX } from "@/core/threads/infinite";

vi.mock("@/core/api/fetcher", () => ({ fetch: vi.fn() }));

const navigateTo = vi.fn();

describe("AccountSettings authenticated client boundary", () => {
  beforeEach(() => {
    sessionStorage.clear();
    navigateTo.mockReset().mockResolvedValue(undefined);
    vi.stubGlobal("navigateTo", navigateTo);
    vi.stubGlobal("useNuxtApp", () => ({
      $i18n: nuxtI18nStub(),
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.mocked(fetchWithAuth).mockReset();
    sessionStorage.clear();
  });

  it("removes every previous-user query and composer draft after logout", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    /* 随便两个上一位用户的查询；这一条钉的是 `clear()` 一个都不留。 */
    queryClient.setQueryData([...INFINITE_THREADS_QUERY_KEY_PREFIX, "all"], {
      pages: [[{ thread_id: "admin-thread" }]],
      pageParams: [0],
    });
    queryClient.setQueryData(["memory", "facts"], ["admin-memory"]);
    sessionStorage.setItem(
      buildComposerDraftKey({
        userId: "admin-user",
        threadId: "admin-thread",
      }),
      JSON.stringify({ text: "admin draft", skillName: null }),
    );
    sessionStorage.setItem("unrelated", "keep");

    vi.mocked(fetchWithAuth)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "admin-user",
            email: "admin@example.com",
            system_role: "admin",
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    const wrapper = mount(AccountSettings, {
      global: {
        plugins: [[VueQueryPlugin, { queryClient }]],
        mocks: nuxtI18nMocks(),
      },
    });
    await flushPromises();
    // 退出按钮已经换成 shadcn 的 Button（destructive 档），不再是手搓的 bg-red-600。
    await wrapper
      .get('[data-slot="button"][data-variant="destructive"]')
      .trigger("click");
    await flushPromises();

    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(
      sessionStorage.getItem(
        buildComposerDraftKey({
          userId: "admin-user",
          threadId: "admin-thread",
        }),
      ),
    ).toBeNull();
    expect(sessionStorage.getItem("unrelated")).toBe("keep");
    expect(navigateTo).toHaveBeenCalledWith("/login");

    wrapper.unmount();
  });
});
