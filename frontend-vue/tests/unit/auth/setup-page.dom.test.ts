import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

import SetupPage from "@/pages/setup.vue";
import { enUS } from "@/core/i18n/locales/en-US";
import { zhCN } from "@/core/i18n/locales/zh-CN";

vi.mock("@/components/ui/effects/FlickeringGrid.vue", () => ({
  default: { template: "<div />" },
}));
const wrappers: ReturnType<typeof mount>[] = [];
const clients: QueryClient[] = [];
const navigate = vi.fn().mockResolvedValue(undefined);
beforeEach(() => {
  localStorage.clear();
  navigate.mockClear();
  vi.stubGlobal("definePageMeta", vi.fn());
  vi.stubGlobal("navigateTo", navigate);
  document.cookie = "csrf_token=setup-page-csrf; path=/";
});
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  clients.splice(0).forEach((client) => client.clear());
  vi.unstubAllGlobals();
});

for (const [locale, dictionary, copy] of [
  [
    "en-US",
    enUS,
    {
      email: "Your email",
      current: "Current password",
      next: "New password",
      confirm: "Confirm new password",
      subtitle: "Set your real email and a new password.",
      settingUp: "Setting up…",
      creating: "Creating account…",
    },
  ],
  [
    "zh-CN",
    zhCN,
    {
      email: "你的邮箱",
      current: "当前密码",
      next: "新密码",
      confirm: "确认新密码",
      subtitle: "设置你的真实邮箱和新密码。",
      settingUp: "正在设置…",
      creating: "正在创建账号…",
    },
  ],
] as const) {
  describe(`actual setup page ${locale}`, () => {
    function renderSetup() {
      const $i18n = { t: ref(dictionary), locale: ref(locale) };
      vi.stubGlobal("useNuxtApp", () => ({ $i18n }));
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      clients.push(queryClient);
      const wrapper = mount(SetupPage, {
        global: {
          plugins: [[VueQueryPlugin, { queryClient }]],
          mocks: { $i18n },
        },
      });
      wrappers.push(wrapper);
      return wrapper;
    }

    it("retains the initialization wire while showing its localized pending action", async () => {
      let resolve!: (response: Response) => void;
      const fetchMock = vi.fn((input: RequestInfo | URL) => {
        if (String(input).endsWith("/me"))
          return Promise.resolve(new Response(null, { status: 401 }));
        if (String(input).endsWith("/setup-status"))
          return Promise.resolve(Response.json({ needs_setup: true }));
        return new Promise<Response>((done) => {
          resolve = done;
        });
      });
      vi.stubGlobal("fetch", fetchMock);
      const wrapper = renderSetup();
      await flushPromises();
      const inputs = wrapper.findAll("input");
      await inputs[0]!.setValue("admin@example.com");
      await inputs[1]!.setValue("new-password-123");
      await inputs[2]!.setValue("new-password-123");
      await wrapper.get("form").trigger("submit");
      expect(wrapper.get('button[type="submit"]').text()).toBe(copy.creating);
      expect(
        wrapper.get('button[type="submit"]').attributes("disabled"),
      ).toBeDefined();
      expect(fetchMock).toHaveBeenLastCalledWith(
        "/api/v1/auth/initialize",
        expect.objectContaining({
          body: JSON.stringify({
            email: "admin@example.com",
            password: "new-password-123",
            remember_me: true,
          }),
        }),
      );
      resolve(Response.json({}));
      await flushPromises();
      expect(navigate).toHaveBeenCalledWith("/workspace");
    });

    it("matches explicit blank-email password fields, spacing, pending copy and CSRF wire", async () => {
      let resolve!: (response: Response) => void;
      const fetchMock = vi.fn((input: RequestInfo | URL) =>
        String(input).endsWith("/me")
          ? Promise.resolve(
              Response.json({
                id: "setup-owner",
                email: "temporary@example.com",
                system_role: "admin",
                needs_setup: true,
              }),
            )
          : new Promise<Response>((done) => {
              resolve = done;
            }),
      );
      vi.stubGlobal("fetch", fetchMock);
      const wrapper = renderSetup();
      await flushPromises();
      expect(wrapper.text()).toContain(copy.subtitle);
      const inputs = wrapper.findAll("input:not([type='checkbox'])");
      expect(inputs.map((input) => input.attributes("placeholder"))).toEqual([
        copy.email,
        copy.current,
        copy.next,
        copy.confirm,
      ]);
      expect((inputs[0]!.element as HTMLInputElement).value).toBe("");
      expect(inputs.map((input) => input.attributes("aria-label"))).toEqual([
        copy.email,
        copy.current,
        copy.next,
        copy.confirm,
      ]);
      expect(inputs.map((input) => input.attributes("autocomplete"))).toEqual([
        "email",
        "current-password",
        "new-password",
        "new-password",
      ]);
      expect(wrapper.findAll("label")).toHaveLength(1);
      expect(wrapper.get("form").classes()).toContain("space-y-4");
      await inputs[0]!.setValue("real@example.com");
      await inputs[1]!.setValue("temporary-password");
      await inputs[2]!.setValue("new-password-123");
      await inputs[3]!.setValue("new-password-123");
      await wrapper.get("form").trigger("submit");
      expect(wrapper.get('button[type="submit"]').text()).toBe(copy.settingUp);
      const wire = fetchMock.mock.calls.at(-1);
      expect(wire?.[0]).toBe("/api/v1/auth/change-password");
      const init = (wire as unknown as [unknown, RequestInit])[1];
      expect(new Headers(init.headers).get("X-CSRF-Token")).toBe(
        "setup-page-csrf",
      );
      expect(JSON.parse(String(init.body))).toEqual({
        current_password: "temporary-password",
        new_password: "new-password-123",
        new_email: "real@example.com",
        remember_me: true,
      });
      resolve(Response.json({}));
      await flushPromises();
      expect(navigate).toHaveBeenCalledWith("/workspace");
    });
  });
}
