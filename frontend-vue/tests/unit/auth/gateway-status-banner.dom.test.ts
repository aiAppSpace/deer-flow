import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, expect, it, vi } from "vitest";

import GatewayStatusBanner from "@/components/workspace/GatewayStatusBanner.vue";
import { AUTH_SESSION_QUERY_KEY } from "@/core/auth/session-query";
import { nuxtI18nMocks, nuxtI18nStub } from "../../support/nuxt-i18n";

let wrapper: ReturnType<typeof mount> | undefined;
let queryClient: QueryClient | undefined;
afterEach(() => {
  wrapper?.unmount();
  queryClient?.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("recovers automatically with the shared probe response and exposes only React's logout action", async () => {
  vi.useFakeTimers();
  const fetchImpl = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(new Response(null, { status: 503 }))
    .mockResolvedValueOnce(
      Response.json({
        id: "owner-1",
        email: "owner@example.com",
        system_role: "user",
        needs_setup: false,
      }),
    );
  vi.stubGlobal("fetch", fetchImpl);
  vi.stubGlobal("useNuxtApp", () => ({ $i18n: nuxtI18nStub() }));
  vi.stubGlobal("useRuntimeConfig", () => ({ public: { authDisabled: "0" } }));
  vi.stubGlobal("useRoute", () => ({ fullPath: "/workspace/chats/current" }));
  const navigate = vi.fn();
  vi.stubGlobal("navigateTo", navigate);
  queryClient = new QueryClient();
  wrapper = mount(GatewayStatusBanner, {
    global: {
      plugins: [[VueQueryPlugin, { queryClient }]],
      mocks: nuxtI18nMocks(),
    },
  });
  await flushPromises();
  expect(wrapper.get('[role="status"]').text()).toContain(
    "Retrying in the background…",
  );
  expect(wrapper.findAll("button").map((button) => button.text())).toEqual([
    "Log out",
  ]);
  expect(fetchImpl).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(10_000);
  await flushPromises();
  expect(wrapper.find('[role="status"]').exists()).toBe(false);
  expect(queryClient.getQueryData(AUTH_SESSION_QUERY_KEY)).toMatchObject({
    tag: "authenticated",
    user: { id: "owner-1" },
  });
  expect(fetchImpl).toHaveBeenCalledTimes(2);
  expect(navigate).not.toHaveBeenCalled();
});
