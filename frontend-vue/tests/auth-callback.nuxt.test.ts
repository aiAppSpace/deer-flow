/*
  【文件职责】     在 Nuxt DOM 环境验证 callback 页的真实状态渲染和 replace 跳转。
  【架构位置】     测试
  【主要导出】     无
  【依赖关系】     @nuxt/test-utils/runtime · app/pages/auth/callback.vue
  【边界与注意】   使用真实 Vue Query plugin；网络与导航边界用 Nuxt mock 隔离。
*/

import { flushPromises } from "@vue/test-utils";
import { mountSuspended, mockNuxtImport } from "@nuxt/test-utils/runtime";
import { afterEach, describe, expect, it, vi } from "vitest";

import AuthCallbackPage from "@/pages/auth/callback.vue";

const { navigateToMock } = vi.hoisted(() => ({
  navigateToMock: vi.fn(),
}));

mockNuxtImport("navigateTo", () => navigateToMock);

const USER = {
  id: "user-1",
  email: "admin@example.com",
  system_role: "admin",
  needs_setup: false,
  oauth_provider: null,
};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  navigateToMock.mockReset();
});

describe("OIDC callback Nuxt page", () => {
  it("renders success then replaces to a safe next path", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(USER)));

    const wrapper = await mountSuspended(AuthCallbackPage, {
      route: "/auth/callback?next=%2Fworkspace%2Fchats%2Fthread-1",
    });
    await flushPromises();

    expect(wrapper.get('[data-auth-callback-status="success"]').text()).toMatch(
      /redirecting/i,
    );
    await vi.waitFor(
      () =>
        expect(navigateToMock).toHaveBeenCalledWith(
          "/workspace/chats/thread-1",
          { replace: true },
        ),
      { timeout: 1_000 },
    );
  });

  it("renders a distinct Gateway error before replacing to the recovery route", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 503 })),
    );

    const wrapper = await mountSuspended(AuthCallbackPage, {
      route: "/auth/callback?next=https%3A%2F%2Fevil.example%2Fphish",
    });
    await flushPromises();

    expect(
      wrapper.get('[data-auth-callback-status="unavailable"]').text(),
    ).toMatch(/temporarily unavailable/i);
    await vi.waitFor(
      () =>
        expect(navigateToMock).toHaveBeenCalledWith(
          "/login?error=gateway_unavailable&next=%2Fworkspace",
          { replace: true },
        ),
      { timeout: 2_500 },
    );
  });
  it("does not navigate after unmount while the session probe is pending", async () => {
    let resolve!: (response: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((done) => {
            resolve = done;
          }),
      ),
    );
    const wrapper = await mountSuspended(AuthCallbackPage, {
      route: "/auth/callback?next=%2Fworkspace",
    });
    vi.useFakeTimers();
    wrapper.unmount();
    resolve(Response.json(USER));
    await flushPromises();
    await vi.advanceTimersByTimeAsync(1_500);
    expect(navigateToMock).not.toHaveBeenCalled();
  });
});
