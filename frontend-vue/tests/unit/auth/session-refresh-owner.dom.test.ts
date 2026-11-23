import {
  QueryClient,
  VueQueryPlugin,
  useQueryClient,
} from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import { afterEach, expect, it, vi } from "vitest";

import { useAuthSession } from "@/composables/useAuthSession";
import UserPreferencesBoundary from "@/core/settings/UserPreferencesBoundary.vue";
import {
  AUTH_SESSION_QUERY_KEY,
  authSessionQueryOptions,
} from "@/core/auth/session-query";

vi.mock("@/core/auth/auth-disabled-user", () => ({
  isAuthDisabledMode: () => false,
}));
vi.mock("@/core/api/fetcher", () => ({ fetch: () => new Promise(() => {}) }));
const user = {
  id: "alice",
  email: "alice@example.com",
  system_role: "admin",
  needs_setup: false,
  oauth_provider: null,
};
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});
it.each(["transport", "json"] as const)(
  "retains workspace cache and edited native node through %s refresh failure and recovery",
  async (failure) => {
    let serverUser = user;
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => Response.json(serverUser));
    vi.stubGlobal("fetch", fetchImpl);
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    client.setQueryData(AUTH_SESSION_QUERY_KEY, { tag: "authenticated", user });
    let mountedClient: QueryClient | undefined;
    const Consumer = defineComponent({
      setup() {
        mountedClient = useQueryClient();
        const { session } = useAuthSession({ enabled: false });
        return () =>
          h("div", [
            h("input", { "aria-label": "Draft" }),
            h(
              "output",
              session.value?.tag === "authenticated"
                ? session.value.user.email
                : "signed-out",
            ),
          ]);
      },
    });
    const wrapper = mount(UserPreferencesBoundary, {
      slots: { default: () => h(Consumer) },
      global: { plugins: [[VueQueryPlugin, { queryClient: client }]] },
    });
    try {
      await flushPromises();
      const original = wrapper.get("input").element;
      const originalSessionQuery = client
        .getQueryCache()
        .find({ queryKey: AUTH_SESSION_QUERY_KEY, exact: true });
      expect(mountedClient).toBe(client);
      expect(wrapper.get("output").text()).toBe("alice@example.com");
      await wrapper.get("input").setValue("unsent draft");
      client.setQueryData(["private"], "alice-only");
      if (failure === "transport")
        fetchImpl.mockRejectedValueOnce(new TypeError("Offline"));
      else
        fetchImpl.mockResolvedValueOnce(
          new Response("{invalid", { status: 200 }),
        );
      await client.fetchQuery(authSessionQueryOptions());
      await flushPromises();
      expect(client.getQueryData(AUTH_SESSION_QUERY_KEY)).toEqual({
        tag: "authenticated",
        user,
      });
      expect(client.getQueryData(["private"])).toBe("alice-only");
      expect(wrapper.get("input").element).toBe(original);
      expect(original.value).toBe("unsent draft");
      serverUser = { ...user, email: "alice-refreshed@example.com" };
      await client.fetchQuery(authSessionQueryOptions());
      await flushPromises();
      expect(client.getQueryData(AUTH_SESSION_QUERY_KEY)).toEqual({
        tag: "authenticated",
        user: serverUser,
      });
      expect(wrapper.get("output").text()).toBe("alice-refreshed@example.com");
      expect(mountedClient).toBe(client);
      expect(
        client
          .getQueryCache()
          .find({ queryKey: AUTH_SESSION_QUERY_KEY, exact: true }),
      ).toBe(originalSessionQuery);
      expect(wrapper.get("input").element).toBe(original);
      expect(original.value).toBe("unsent draft");
      expect(client.getQueryData(["private"])).toBe("alice-only");
    } finally {
      wrapper.unmount();
      client.clear();
    }
  },
);
