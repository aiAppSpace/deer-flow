import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ref } from "vue";
import LoginPage from "@/pages/login.vue";
import SetupPage from "@/pages/setup.vue";
import { enUS } from "@/core/i18n/locales/en-US";
vi.mock("@/components/ui/effects/FlickeringGrid.vue", () => ({
  default: { template: "<div />" },
}));
const navigate = vi.fn();
const wrappers: ReturnType<typeof mount>[] = [];
const clients: QueryClient[] = [];
const user = {
  id: "owner",
  email: "user@example.com",
  system_role: "admin",
  needs_setup: true,
};
function pending<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
function page(kind: "login" | "initialize" | "password") {
  const $i18n = { t: ref(enUS), locale: ref("en-US") };
  vi.stubGlobal("useNuxtApp", () => ({ $i18n }));
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  clients.push(queryClient);
  const w = mount(kind === "login" ? LoginPage : SetupPage, {
    global: {
      plugins: [[VueQueryPlugin, { queryClient }]],
      mocks: { $i18n },
      stubs: { NuxtLink: { template: "<a><slot /></a>" } },
    },
  });
  wrappers.push(w);
  return w;
}
beforeEach(() => {
  localStorage.clear();
  navigate.mockClear();
  vi.stubGlobal("definePageMeta", vi.fn());
  vi.stubGlobal("navigateTo", navigate);
  vi.stubGlobal("useRoute", () => ({ query: { next: "/workspace/chats" } }));
});
afterEach(() => {
  wrappers.splice(0).forEach((w) => {
    if (w.exists()) w.unmount();
  });
  clients.splice(0).forEach((c) => c.clear());
  vi.unstubAllGlobals();
});
for (const kind of ["login", "initialize", "password"] as const)
  for (const leave of [false, true]) {
    it(`${kind} success navigates only while its page is mounted (leave=${leave})`, async () => {
      const response = pending<Response>();
      const fetchMock = vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/me"))
          return Promise.resolve(
            kind === "password"
              ? Response.json(user)
              : new Response(null, { status: 401 }),
          );
        if (url.endsWith("/setup-status"))
          return Promise.resolve(
            Response.json({ needs_setup: kind === "initialize" }),
          );
        if (url.endsWith("/providers"))
          return Promise.resolve(Response.json({ providers: [] }));
        return response.promise;
      });
      vi.stubGlobal("fetch", fetchMock);
      const w = page(kind);
      await flushPromises();
      const inputs = w.findAll("input:not([type=checkbox])");
      const values =
        kind === "login"
          ? ["user@example.com", "password-123"]
          : kind === "initialize"
            ? ["user@example.com", "password-123", "password-123"]
            : [
                "user@example.com",
                "old-password",
                "password-123",
                "password-123",
              ];
      for (let i = 0; i < values.length; i++)
        await inputs[i]!.setValue(values[i]);
      await w.get("form").trigger("submit");
      expect(fetchMock.mock.calls.at(-1)?.[0]).toBe(
        `/api/v1/auth/${kind === "login" ? "login/local" : kind === "initialize" ? "initialize" : "change-password"}`,
      );
      if (leave) w.unmount();
      response.resolve(Response.json({}));
      await flushPromises();
      if (leave) expect(navigate).not.toHaveBeenCalled();
      else
        expect(navigate).toHaveBeenCalledWith(
          kind === "login" ? "/workspace/chats" : "/workspace",
        );
    });
  }
it("a login session probe cannot redirect after leaving the page", async () => {
  const me = pending<Response>();
  const fetchMock = vi.fn((input: RequestInfo | URL) =>
    String(input).endsWith("/me")
      ? me.promise
      : Promise.resolve(Response.json({ providers: [], needs_setup: false })),
  );
  vi.stubGlobal("fetch", fetchMock);
  const w = page("login");
  await vi.waitFor(() =>
    expect(fetchMock.mock.calls.some(([p]) => String(p).endsWith("/me"))).toBe(
      true,
    ),
  );
  w.unmount();
  me.resolve(Response.json({ ...user, needs_setup: false }));
  await flushPromises();
  expect(navigate).not.toHaveBeenCalled();
});
it("a setup mode probe cannot redirect after leaving the page", async () => {
  const me = pending<Response>();
  vi.stubGlobal(
    "fetch",
    vi.fn(() => me.promise),
  );
  const w = page("initialize");
  w.unmount();
  me.resolve(Response.json({ ...user, needs_setup: false }));
  await flushPromises();
  expect(navigate).not.toHaveBeenCalled();
});
