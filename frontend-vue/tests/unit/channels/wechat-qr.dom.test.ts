import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { ref, type Plugin } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WechatQRLogin from "@/components/workspace/channels/WechatQRLogin.vue";
import WechatQRCompletion from "@/components/workspace/channels/WechatQRCompletion.vue";
import ChannelRuntimeConfigDialog from "@/components/workspace/channels/ChannelRuntimeConfigDialog.vue";
import { invalidateWorkspaceQueryOwner } from "@/core/auth/workspace-queries";
import type {
  ChannelProvider,
  WechatQRLoginSession,
} from "@/core/channels/types";
import { enUS } from "@/core/i18n/locales/en-US";
const api = vi.hoisted(() => ({
  startWechatQRLogin: vi.fn(),
  pollWechatQRLogin: vi.fn(),
  cancelWechatQRLogin: vi.fn(),
  listChannelProviders: vi.fn(),
  connectChannelProvider: vi.fn(),
  listChannelConnections: vi.fn(),
}));
vi.mock("@/core/channels/api", () => api);
const provider = (
  overrides: Partial<ChannelProvider> = {},
): ChannelProvider => ({
  provider: "wechat",
  display_name: "WeChat",
  enabled: true,
  configured: true,
  connectable: true,
  connection_status: "not_connected",
  auth_mode: "binding_code",
  credential_fields: [
    { name: "bot_token", label: "Bot token", type: "password", required: true },
  ],
  ...overrides,
});
const session = (
  overrides: Partial<WechatQRLoginSession> = {},
): WechatQRLoginSession => ({
  id: "qr-session",
  status: "pending",
  qrcode_content: "https://wechat.example.test/scan?code=example",
  expires_in: 60,
  provider: null,
  ...overrides,
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const wrappers: VueWrapper[] = [];
const clients: QueryClient[] = [];
function createClient() {
  const client = new QueryClient();
  clients.push(client);
  return client;
}
function options(client: QueryClient) {
  return {
    attachTo: document.body,
    global: {
      plugins: [
        [VueQueryPlugin, { queryClient: client }] as [
          Plugin,
          { queryClient: QueryClient },
        ],
      ],
    },
  };
}
function login() {
  const client = createClient();
  const wrapper = mount(WechatQRLogin, options(client));
  wrappers.push(wrapper);
  return { client, wrapper };
}
function completion(
  resume?: { code: string; expiresAt: number },
  p = provider(),
) {
  const client = createClient();
  const wrapper = mount(WechatQRCompletion, {
    ...options(client),
    props: { provider: p, bindingToResume: resume },
  });
  wrappers.push(wrapper);
  return { client, wrapper };
}
async function tick(ms = 0) {
  await vi.advanceTimersByTimeAsync(ms);
  await flushPromises();
}
function button(wrapper: VueWrapper, text: string) {
  const result = wrapper.findAll("button").find((item) => item.text() === text);
  if (!result) throw new Error(`Missing button ${text}`);
  return result;
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  for (const fn of Object.values(api)) fn.mockReset();
  api.startWechatQRLogin.mockResolvedValue(session());
  api.cancelWechatQRLogin.mockResolvedValue(undefined);
  api.pollWechatQRLogin.mockResolvedValue(session());
  api.listChannelProviders.mockResolvedValue({
    enabled: true,
    providers: [provider()],
  });
  api.connectChannelProvider.mockResolvedValue({
    provider: "wechat",
    code: "bind-code",
    expires_in: 60,
    instruction: "Send command",
  });
  api.listChannelConnections.mockResolvedValue([]);
  vi.stubGlobal("useNuxtApp", () => ({ $i18n: { t: ref(enUS) } }));
});
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => {
    if (wrapper.exists()) wrapper.unmount();
  });
  clients.splice(0).forEach((client) => client.clear());
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});
describe("WeChat credential QR lifecycle", () => {
  it("renders an encoded SVG matrix and polls at the upstream interval until confirmed", async () => {
    const { wrapper } = login();
    await tick();
    const svg = wrapper.get('svg[role="img"]');
    expect(svg.attributes("aria-label")).toBe(
      enUS.channels.wechatQr.imageTitle,
    );
    expect(svg.get("path").attributes("d")!.length).toBeGreaterThan(300);
    api.pollWechatQRLogin
      .mockResolvedValueOnce(session({ status: "scanned" }))
      .mockResolvedValueOnce(
        session({ status: "confirmed", provider: provider() }),
      );
    await tick(1499);
    expect(api.pollWechatQRLogin).not.toHaveBeenCalled();
    await tick(1);
    expect(wrapper.text()).toContain(enUS.channels.wechatQr.scannedTitle);
    await tick(1500);
    expect(wrapper.emitted("configured")?.[0]).toEqual([provider()]);
    await tick(5000);
    expect(api.pollWechatQRLogin).toHaveBeenCalledTimes(2);
  });
  it("pauses for a numeric verification code, prevents duplicate submits and resumes after network status", async () => {
    const result = deferred<WechatQRLoginSession>();
    api.pollWechatQRLogin
      .mockResolvedValueOnce(session({ status: "verification_required" }))
      .mockReturnValueOnce(result.promise);
    const { wrapper } = login();
    await tick();
    await tick(1500);
    await tick(6000);
    expect(api.pollWechatQRLogin).toHaveBeenCalledTimes(1);
    await wrapper.get("input").setValue("1x2-34");
    expect((wrapper.get("input").element as HTMLInputElement).value).toBe(
      "1234",
    );
    await button(wrapper, enUS.channels.wechatQr.verifySubmit).trigger("click");
    await wrapper.get("input").trigger("keydown", { key: "Enter" });
    expect(api.pollWechatQRLogin).toHaveBeenCalledTimes(2);
    expect(api.pollWechatQRLogin.mock.calls[1]).toEqual([
      "qr-session",
      expect.any(AbortSignal),
      "1234",
    ]);
    result.resolve(
      session({ status: "verification_required", error: "network" }),
    );
    await tick();
    await tick(1500);
    expect(api.pollWechatQRLogin).toHaveBeenCalledTimes(3);
  });
  it.each([
    "verification_rejected",
    "verification_blocked",
    "already_bound",
    "invalid_response",
  ] as const)("shows the localized %s response", async (error) => {
    api.pollWechatQRLogin.mockResolvedValue(
      session({ status: "failed", error }),
    );
    const { wrapper } = login();
    await tick();
    await tick(1500);
    expect(wrapper.text()).toContain(enUS.channels.wechatQr[error]);
    expect(button(wrapper, enUS.channels.wechatQr.retry).exists()).toBe(true);
  });
  it("expires a session and starts a new attempt only on explicit retry", async () => {
    api.startWechatQRLogin.mockResolvedValue(session({ expires_in: 1 }));
    const { wrapper } = login();
    await tick();
    await tick(1000);
    expect(wrapper.text()).toContain(enUS.channels.wechatQr.expiredTitle);
    expect(api.pollWechatQRLogin).not.toHaveBeenCalled();
    await button(wrapper, enUS.channels.wechatQr.retry).trigger("click");
    await tick();
    expect(api.cancelWechatQRLogin).toHaveBeenCalledWith("qr-session");
    expect(api.startWechatQRLogin).toHaveBeenCalledTimes(2);
  });
  it("cancels a session returned after closing the QR dialog", async () => {
    const start = deferred<WechatQRLoginSession>();
    api.startWechatQRLogin.mockReturnValue(start.promise);
    const { wrapper } = login();
    await tick();
    wrapper.unmount();
    start.resolve(session());
    await tick();
    expect(api.cancelWechatQRLogin).toHaveBeenCalledWith("qr-session");
    expect(api.pollWechatQRLogin).not.toHaveBeenCalled();
  });
  it.each(["unmount", "account"])(
    "suppresses a late confirmation after %s",
    async (boundary) => {
      const result = deferred<WechatQRLoginSession>();
      api.pollWechatQRLogin.mockReturnValue(result.promise);
      const { wrapper, client } = login();
      await tick();
      await tick(1500);
      const signal = api.pollWechatQRLogin.mock.calls[0]![1] as AbortSignal;
      if (boundary === "unmount") {
        wrapper.unmount();
        expect(signal.aborted).toBe(true);
      } else invalidateWorkspaceQueryOwner(client);
      result.resolve(session({ status: "confirmed", provider: provider() }));
      await tick();
      expect(wrapper.emitted("configured")).toBeUndefined();
      await tick(5000);
      expect(api.pollWechatQRLogin).toHaveBeenCalledTimes(1);
    },
  );
});
describe("WeChat user binding completion", () => {
  it("creates and copies the binding command, observes connection and finishes", async () => {
    const copy = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText: copy } });
    const { wrapper } = completion();
    await tick();
    expect(wrapper.get("code").text()).toBe("/connect bind-code");
    await button(wrapper, enUS.channels.wechatQr.copyCommand).trigger("click");
    await tick();
    expect(copy).toHaveBeenCalledWith("/connect bind-code");
    expect(wrapper.text()).toContain(enUS.channels.wechatQr.copied);
    api.listChannelConnections.mockResolvedValue([
      { id: "wechat-binding", provider: "wechat", status: "connected" },
    ]);
    await tick(2000);
    expect(wrapper.text()).toContain(enUS.channels.wechatQr.connectedTitle);
    await button(wrapper, enUS.channels.wechatQr.done).trigger("click");
    expect(wrapper.emitted("done")).toHaveLength(1);
  });
  it("reuses the copied command and original deadline when rescanning", async () => {
    const resume = { code: "original-code", expiresAt: 10_000 };
    const { wrapper } = completion(resume);
    await tick();
    expect(api.connectChannelProvider).not.toHaveBeenCalled();
    expect(wrapper.get("code").text()).toBe("/connect original-code");
    await button(wrapper, enUS.channels.wechatQr.restart).trigger("click");
    expect(wrapper.emitted("restart")?.[0]).toEqual([resume]);
    await tick(10_000);
    expect(wrapper.text()).toContain(enUS.channels.wechatQr.bindExpired);
  });
  it("renews an expired resumed command and handles bind errors with explicit retry", async () => {
    api.connectChannelProvider.mockRejectedValueOnce(new Error("unavailable"));
    const { wrapper } = completion({ code: "old", expiresAt: -1 });
    await tick();
    expect(wrapper.text()).toContain(enUS.channels.wechatQr.bindFailed);
    await button(wrapper, enUS.channels.wechatQr.bindRetry).trigger("click");
    await tick();
    expect(wrapper.get("code").text()).toBe("/connect bind-code");
  });
  it("skips a new binding when the refreshed provider already has one", async () => {
    api.listChannelProviders.mockResolvedValue({
      providers: [provider({ connection_status: "connected" })],
    });
    const { wrapper } = completion();
    await tick();
    expect(api.connectChannelProvider).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain(enUS.channels.wechatQr.connectedTitle);
  });
  it("aborts pending bind setup on unmount and ignores a transport that completes anyway", async () => {
    const request = deferred<{ providers: ChannelProvider[] }>();
    api.listChannelProviders.mockReturnValue(request.promise);
    const { wrapper } = completion();
    await tick();
    const signal = api.listChannelProviders.mock.calls[0]![0]
      .signal as AbortSignal;
    wrapper.unmount();
    expect(signal.aborted).toBe(true);
    request.resolve({ providers: [] });
    await tick();
    expect(api.connectChannelProvider).not.toHaveBeenCalled();
  });
});
describe("shared WeChat runtime configuration dialog", () => {
  it("opens QR setup for an unconfigured provider and supports token configuration into binding", async () => {
    const client = createClient();
    const submit = vi.fn().mockResolvedValue(provider());
    const configured = vi.fn();
    const wrapper = mount(ChannelRuntimeConfigDialog, {
      ...options(client),
      props: {
        provider: provider({ configured: false }),
        open: true,
        submitting: false,
        submit,
        onConfigured: configured,
      },
    });
    wrappers.push(wrapper);
    await tick();
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain(enUS.channels.wechatQr.login);
    expect(api.startWechatQRLogin).toHaveBeenCalledTimes(1);
    const tokenTab = [
      ...dialog.querySelectorAll<HTMLElement>('[role="tab"]'),
    ].find((item) =>
      item.textContent?.includes(enUS.channels.wechatQr.manual),
    )!;
    tokenTab.dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true, button: 0, ctrlKey: false }),
    );
    await tick();
    const input = dialog.querySelector<HTMLInputElement>("input")!;
    input.value = "manual-token";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await tick();
    dialog
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await tick();
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "wechat" }),
      { bot_token: "manual-token" },
    );
    expect(dialog.textContent).toContain(enUS.channels.wechatQr.bindTitle);
    expect(api.cancelWechatQRLogin).toHaveBeenCalledWith("qr-session");
  });
  it("ignores a token response after close/reopen and seeds masked fields afresh", async () => {
    const save = deferred<ChannelProvider>();
    const submit = vi.fn().mockReturnValue(save.promise);
    const wrapper = mount(ChannelRuntimeConfigDialog, {
      ...options(createClient()),
      props: {
        provider: provider({ credential_values: { bot_token: "********" } }),
        open: true,
        submitting: false,
        submit,
        onConfigured: vi.fn(),
      },
    });
    wrappers.push(wrapper);
    await tick();
    document
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await wrapper.setProps({ open: false });
    await wrapper.setProps({ open: true });
    save.resolve(provider());
    await tick();
    expect(document.querySelector("code")).toBeNull();
    expect(document.querySelector<HTMLInputElement>("input")?.value).toBe(
      "********",
    );
  });
});
