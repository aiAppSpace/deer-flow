import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AccountSettings from "@/components/workspace/settings/AccountSettings.vue";
import { enUS } from "@/core/i18n/locales/en-US";
import { invalidateWorkspaceQueryOwner } from "@/core/auth/workspace-queries";
const api = vi.hoisted(() => ({ fetch: vi.fn() }));
const permissions = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/core/api/fetcher", () => api);
vi.mock("@/composables/useSettingsPermissions", () => ({
  useSettingsPermissions: permissions.get,
}));
const session = ref({
  tag: "authenticated",
  user: {
    id: "alice",
    email: "alice@example.test",
    system_role: "member",
    oauth_provider: undefined as string | undefined,
  },
});
const wrappers: VueWrapper[] = [];
function host() {
  const client = new QueryClient();
  const wrapper = mount(AccountSettings, {
    global: { plugins: [[VueQueryPlugin, { queryClient: client }]] },
  });
  wrappers.push(wrapper);
  return { wrapper, client };
}
async function fill(wrapper: VueWrapper, password = "long-password") {
  const inputs = wrapper.findAll("input");
  await inputs[0]!.setValue("current-password");
  await inputs[1]!.setValue(password);
  await inputs[2]!.setValue(password);
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
beforeEach(() => {
  api.fetch.mockReset();
  session.value = {
    tag: "authenticated",
    user: {
      id: "alice",
      email: "alice@example.test",
      system_role: "member",
      oauth_provider: undefined,
    },
  };
  permissions.get.mockReturnValue({ authDisabled: false, session });
  vi.stubGlobal("useNuxtApp", () => ({ $i18n: { t: ref(enUS) } }));
});
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  vi.unstubAllGlobals();
});
describe("account password lifecycle", () => {
  it("validates before transport and leaves SSO password ownership with the provider", async () => {
    const { wrapper } = host();
    await fill(wrapper, "short");
    await wrapper.get("form").trigger("submit");
    expect(wrapper.get('[role="alert"]').text()).toBe(
      enUS.settings.account.passwordTooShort,
    );
    expect(api.fetch).not.toHaveBeenCalled();
    session.value = {
      ...session.value,
      user: { ...session.value.user, oauth_provider: "github" },
    };
    await flushPromises();
    expect(wrapper.find("form").exists()).toBe(false);
    expect(wrapper.text()).toContain(
      enUS.settings.account.ssoPasswordMessage.replace("{provider}", "github"),
    );
  });
  it.each([401, 403, 409, 503])(
    "preserves Gateway password error details (%i)",
    async (status) => {
      api.fetch.mockResolvedValue(
        Response.json(
          {
            detail: {
              code: "invalid_credentials",
              message: "Password rejected by Gateway",
            },
          },
          { status },
        ),
      );
      const { wrapper } = host();
      await fill(wrapper);
      await wrapper.get("form").trigger("submit");
      await flushPromises();
      expect(wrapper.get('[role="alert"]').text()).toBe(
        "Password rejected by Gateway",
      );
      expect(
        wrapper.get('button[type="submit"]').attributes("disabled"),
      ).toBeUndefined();
      expect(api.fetch).toHaveBeenCalledWith(
        "/api/v1/auth/change-password",
        expect.objectContaining({
          signal: expect.any(AbortSignal),
          body: JSON.stringify({
            current_password: "current-password",
            new_password: "long-password",
          }),
        }),
      );
    },
  );
  it.each(["network", "invalid-json"])(
    "uses the React network error message for %s failures",
    async (kind) => {
      if (kind === "network")
        api.fetch.mockRejectedValue(new TypeError("Failed to fetch"));
      else
        api.fetch.mockResolvedValue(new Response("not-json", { status: 503 }));
      const { wrapper } = host();
      await fill(wrapper);
      await wrapper.get("form").trigger("submit");
      await flushPromises();
      expect(wrapper.get('[role="alert"]').text()).toBe(
        enUS.settings.account.networkError,
      );
    },
  );
  it("deduplicates submit, accepts an empty success response and clears secret fields", async () => {
    const request = deferred<Response>();
    api.fetch.mockReturnValue(request.promise);
    const { wrapper } = host();
    await fill(wrapper);
    await wrapper.get("form").trigger("submit");
    await wrapper.get("form").trigger("submit");
    expect(api.fetch).toHaveBeenCalledTimes(1);
    request.resolve(new Response(null, { status: 204 }));
    await flushPromises();
    expect(wrapper.get('[role="status"]').text()).toBe(
      enUS.settings.account.passwordChangedSuccess,
    );
    expect(
      wrapper.findAll("input").map((input) => input.element.value),
    ).toEqual(["", "", ""]);
  });
  it.each(["account", "reset", "unmount"])(
    "retires a pending password request on %s even when transport ignores abort",
    async (boundary) => {
      const request = deferred<Response>();
      api.fetch.mockReturnValue(request.promise);
      const { wrapper, client } = host();
      await fill(wrapper);
      await wrapper.get("form").trigger("submit");
      const signal = api.fetch.mock.calls[0]![1].signal as AbortSignal;
      if (boundary === "account")
        session.value = {
          ...session.value,
          user: { ...session.value.user, id: "bob", email: "bob@example.test" },
        };
      else if (boundary === "reset") invalidateWorkspaceQueryOwner(client);
      else wrapper.unmount();
      if (boundary !== "reset") expect(signal.aborted).toBe(true);
      request.resolve(
        Response.json({ detail: "Old account error" }, { status: 403 }),
      );
      await flushPromises();
      if (boundary !== "unmount")
        expect(wrapper.text()).not.toContain("Old account error");
      if (boundary === "account")
        expect(
          wrapper.findAll("input").every((input) => input.element.value === ""),
        ).toBe(true);
    },
  );
});
