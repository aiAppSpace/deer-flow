import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { mount, flushPromises } from "@vue/test-utils";
import { nextTick, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ChannelConnections from "@/components/workspace/channels/ChannelConnections.vue";
import { invalidateWorkspaceQueryOwner } from "@/core/auth/workspace-queries";
import { buildChannelProviderViews } from "@/core/channels/state";
import type {
  ChannelConnectResponse,
  ChannelConnection,
  ChannelProvider,
} from "@/core/channels/types";
import { enUS } from "@/core/i18n/locales/en-US";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("@/core/workspace-shell/toast", () => ({
  useWorkspaceToast: () => toast,
}));

const ownerFactory = vi.hoisted(() => vi.fn());
const connectWindow = vi.hoisted(() => ({
  close: vi.fn(),
  open: vi.fn(),
  prepare: vi.fn(() => ({ closed: false })),
}));

vi.mock("@/composables/useChannelConnections", () => ({
  useChannelConnections: ownerFactory,
}));
vi.mock("@/composables/useAuthSession", () => ({
  useAuthSession: () => ({ session: { value: undefined } }),
}));
vi.mock("@/core/auth/auth-disabled-user", () => ({
  AUTH_DISABLED_USER: {
    id: "default",
    email: "default@test.local",
    system_role: "admin",
  },
  isAuthDisabledMode: () => true,
}));
vi.mock("@/core/channels/open-connect-url", () => ({
  closeConnectWindow: connectWindow.close,
  openConnectUrl: connectWindow.open,
  prepareConnectWindow: connectWindow.prepare,
}));

function provider(overrides: Partial<ChannelProvider> = {}): ChannelProvider {
  return {
    provider: "slack",
    display_name: "Slack",
    enabled: true,
    configured: true,
    connectable: true,
    auth_mode: "binding_code",
    connection_status: "not_connected",
    credential_fields: [
      {
        name: "bot_token",
        label: "Bot token",
        type: "password",
        required: true,
      },
    ],
    ...overrides,
  };
}

function connection(
  id: string,
  status: string,
  name: string,
): ChannelConnection {
  return {
    id,
    provider: "slack",
    status,
    external_account_name: name,
    workspace_name: "DeerFlow",
    scopes: [],
    metadata: {},
  };
}

function createOwner(
  providers = [provider()],
  connections = [
    connection("connection-a", "connected", "Alice"),
    connection("connection-b", "pending", "Bob"),
    connection("connection-old", "revoked", "Old"),
  ],
) {
  return {
    enabled: ref(true),
    providers: ref(providers),
    connections: ref(connections),
    providerViews: ref(buildChannelProviderViews(providers, connections)),
    connectFlows: ref({}),
    loaded: ref(true),
    loading: ref(false),
    error: ref<Error | null>(null),
    connect: vi.fn(),
    configure: vi.fn(),
    disconnectConnection: vi.fn().mockResolvedValue(undefined),
    disconnectProvider: vi.fn().mockResolvedValue(undefined),
    cancelConnect: vi.fn(),
    isProviderPending: vi.fn(() => false),
    isConnectionPending: vi.fn(() => false),
  };
}

function mountSettings(owner = createOwner()) {
  ownerFactory.mockReturnValue(owner);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = mount(ChannelConnections, {
    attachTo: document.body,
    global: {
      plugins: [
        [
          VueQueryPlugin,
          {
            queryClient,
          },
        ],
      ],
      stubs: {
        ChannelProviderIcon: true,
        WechatQRLogin: true,
        WechatQRCompletion: true,
      },
    },
  });
  return { owner, wrapper, queryClient };
}

beforeEach(() => {
  vi.stubGlobal("useNuxtApp", () => ({
    $i18n: { t: ref(enUS) },
  }));
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("ChannelConnections settings UI", () => {
  it("renders every account and keeps instance/provider deletion explicit", async () => {
    const { owner, wrapper } = mountSettings();

    expect(wrapper.get('[data-testid="channel-status-slack"]').text()).toBe(
      "Connected",
    );
    expect(
      wrapper.get('[data-testid="channel-connection-connection-a"]').text(),
    ).toContain("Alice · DeerFlow");
    expect(
      wrapper.get('[data-testid="channel-connection-connection-b"]').text(),
    ).toContain("Bob · DeerFlow");
    expect(
      wrapper.get('[data-testid="channel-connection-connection-old"]').text(),
    ).toContain("Disconnected");

    await wrapper
      .get('button[aria-label="Disconnect Alice · DeerFlow"]')
      .trigger("click");
    expect(owner.disconnectConnection).toHaveBeenCalledWith("connection-a");

    await wrapper
      .get('button[aria-label="Remove provider configuration: Slack"]')
      .trigger("click");
    await nextTick();
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    expect(owner.disconnectProvider).toHaveBeenCalledWith("slack");
    await flushPromises();
    expect(toast.success).toHaveBeenCalledWith(enUS.channels.revoked);
  });

  it("opens deep links without an extra instruction dialog or success toast", async () => {
    const telegram = provider({
      provider: "telegram",
      display_name: "Telegram",
      auth_mode: "deep_link",
      credential_fields: [],
    });
    const owner = createOwner([telegram], []);
    const response: ChannelConnectResponse = {
      provider: "telegram",
      mode: "deep_link",
      url: "https://t.me/deerflow_bot?start=code",
      code: "code",
      instruction: "Open Telegram and finish binding.",
      expires_in: 600,
    };
    owner.connect.mockImplementation(async () => {
      owner.connectFlows.value = {
        telegram: { provider: "telegram", status: "waiting", response },
      };
      return response;
    });
    const { wrapper } = mountSettings(owner);

    await wrapper.get("button").trigger("click");
    await nextTick();
    expect(connectWindow.prepare).toHaveBeenCalledTimes(1);
    expect(connectWindow.open).toHaveBeenCalledWith(
      response.url,
      expect.any(Object),
    );
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it.each([
    {
      label: "URL-only",
      url: "https://t.me/deerflow_bot?start=url-only",
      instruction: "",
      visible: "The provider connection page opened in a new tab.",
    },
    {
      label: "instruction-only",
      url: null,
      instruction: "Send /connect instruction-only",
      visible: "Send /connect instruction-only",
    },
  ])("supports a $label connect response", async ({ url, instruction }) => {
    const telegram = provider({
      provider: "telegram",
      display_name: "Telegram",
      auth_mode: "deep_link",
      credential_fields: [],
    });
    const owner = createOwner([telegram], []);
    const response: ChannelConnectResponse = {
      provider: "telegram",
      mode: "deep_link",
      url,
      code: "code",
      instruction,
      expires_in: 600,
    };
    owner.connect.mockImplementation(async () => {
      owner.connectFlows.value = {
        telegram: { provider: "telegram", status: "waiting", response },
      };
      return response;
    });
    const { wrapper } = mountSettings(owner);

    await wrapper.get("button").trigger("click");
    await nextTick();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    if (!url) expect(toast.success).toHaveBeenCalledWith(instruction);
    if (url)
      expect(connectWindow.open).toHaveBeenCalledWith(url, expect.any(Object));
    else expect(connectWindow.close).toHaveBeenCalledWith(expect.any(Object));
  });

  it.each([
    "Authentication required",
    "Admin privileges required to manage channel runtime credentials.",
    "Channel connection not found",
    "Too many pending channel connection attempts. Try again later.",
  ])("preserves the Gateway error detail: %s", async (message) => {
    const owner = createOwner([provider({ credential_fields: [] })], []);
    owner.connect.mockRejectedValue(new Error(message));
    const { wrapper } = mountSettings(owner);

    await wrapper.get("button").trigger("click");
    await nextTick();
    expect(toast.error).toHaveBeenCalledWith(message);
  });
});

describe("channel UI lifecycle and WeChat entry", () => {
  it.each(["account", "unmount"])(
    "does not open a URL or toast a late connect result after %s",
    async (boundary) => {
      let resolve!: (value: ChannelConnectResponse) => void;
      const owner = createOwner(
        [provider({ auth_mode: "deep_link", credential_fields: [] })],
        [],
      );
      owner.connect.mockReturnValue(
        new Promise((done) => {
          resolve = done;
        }),
      );
      const { wrapper, queryClient } = mountSettings(owner);
      await wrapper.get("button").trigger("click");
      if (boundary === "account") invalidateWorkspaceQueryOwner(queryClient);
      else wrapper.unmount();
      resolve({
        provider: "slack",
        mode: "deep_link",
        code: "old",
        url: "https://old-account.example.test",
        instruction: "Old instruction",
        expires_in: 60,
      });
      await flushPromises();
      expect(connectWindow.open).not.toHaveBeenCalled();
      expect(toast.success).not.toHaveBeenCalled();
      expect(connectWindow.close).toHaveBeenCalled();
    },
  );
  it("routes configured WeChat Connect to binding, while Modify starts credential setup", async () => {
    const owner = createOwner(
      [provider({ provider: "wechat", display_name: "WeChat" })],
      [],
    );
    const { wrapper } = mountSettings(owner);
    await wrapper
      .findAll("button")
      .find((button) => button.text() === enUS.channels.connect)!
      .trigger("click");
    await flushPromises();
    expect(document.querySelector("wechat-q-r-completion-stub")).not.toBeNull();
    expect(owner.connect).not.toHaveBeenCalled();
    const dialog = wrapper.findComponent({
      name: "ChannelRuntimeConfigDialog",
    });
    await dialog.vm.$emit("update:open", false);
    await flushPromises();
    await wrapper
      .findAll("button")
      .find((button) => button.text() === enUS.channels.modify)!
      .trigger("click");
    await flushPromises();
    expect(document.querySelector("input")?.getAttribute("id")).toBe(
      "channel-wechat-bot_token",
    );
    expect(document.querySelector("wechat-q-r-completion-stub")).toBeNull();
  });
  it("uses unavailable query text and waits for initial loading instead of flashing disabled", async () => {
    const owner = createOwner([], []);
    owner.loaded.value = false;
    const { wrapper } = mountSettings(owner);
    expect(wrapper.text()).toContain(enUS.common.loading);
    expect(wrapper.text()).not.toContain(enUS.settings.channels.disabled);
    owner.loaded.value = true;
    owner.error.value = new Error("internal transport error");
    await flushPromises();
    expect(wrapper.text()).toContain(enUS.channels.unavailable);
    expect(wrapper.text()).not.toContain("internal transport error");
  });
});

describe("connect button label", () => {
  it("says reconnect only when every connection is revoked", () => {
    const revokedOnly = createOwner(
      [provider()],
      [connection("connection-old", "revoked", "Old")],
    );
    expect(mountSettings(revokedOnly).wrapper.text()).toContain(
      enUS.channels.reconnect,
    );

    const fresh = createOwner([provider()], []);
    const freshText = mountSettings(fresh).wrapper.text();
    expect(freshText).toContain(enUS.channels.connect);
    expect(freshText).not.toContain(enUS.channels.reconnect);

    // 还有活着的账号时是「添加账号」，吊销的那条不该把它顶掉。
    expect(mountSettings().wrapper.text()).toContain(enUS.channels.addAccount);
  });

  it("provider 说已连接、却一行账号都没有时，主操作键根本不渲染", () => {
    const owner = createOwner(
      [provider({ connection_status: "connected" })],
      [],
    );
    const { wrapper } = mountSettings(owner);

    const labels = wrapper.findAll("button").map((button) => button.text());

    expect(labels).not.toContain(enUS.channels.connect);
    expect(labels).not.toContain(enUS.channels.addAccount);
    expect(labels).not.toContain(enUS.channels.reconnect);
    // 其余动作照旧：可编辑运行时配置的 provider 仍然有「修改」。
    expect(labels).toContain(enUS.channels.modify);
  });

  it("不可用时把原因拼进描述，不只放在按钮 title 里", () => {
    const owner = createOwner(
      [
        provider({
          connection_status: "not_connected",
          unavailable_reason: "WeChat runtime is not running.",
        }),
      ],
      [],
    );
    expect(mountSettings(owner).wrapper.text()).toContain(
      "WeChat runtime is not running.",
    );
  });

  it("没有后端原因时描述里不拼状态词", () => {
    const owner = createOwner(
      [provider({ configured: false, connection_status: "not_connected" })],
      [],
    );
    const description = mountSettings(owner)
      .wrapper.get("[data-slot=item-description]")
      .text();

    expect(description).toBe(enUS.channels.descriptions.slack);
  });

  it("已连接且有账号行时，仍然给「添加账号」", () => {
    const owner = createOwner(
      [provider({ connection_status: "connected" })],
      [connection("connection-live", "connected", "Live")],
    );
    const labels = mountSettings(owner)
      .wrapper.findAll("button")
      .map((button) => button.text());

    expect(labels).toContain(enUS.channels.addAccount);
  });
});

describe("账号列表", () => {
  it("一行 binding row 都没有时，整块不渲染", () => {
    const owner = createOwner(
      [provider({ connection_status: "connected" })],
      [],
    );
    const { wrapper } = mountSettings(owner);

    // 标题也要一起消失——只藏空态那句话的话，留下的是一个空标题。
    expect(wrapper.text()).not.toContain(enUS.channels.accounts);
  });

  it("有 binding row 时照常出标题与每一行", () => {
    const { wrapper } = mountSettings();

    expect(wrapper.text()).toContain(enUS.channels.accounts);
    expect(
      wrapper.findAll('[data-testid^="channel-connection-"]').length,
    ).toBeGreaterThan(0);
  });
});

for (const outcome of ["success", "failure"] as const) {
  it(`a closed and reopened settings configuration retires its old ${outcome}`, async () => {
    let resolve!: (value: ChannelProvider) => void,
      reject!: (reason: Error) => void;
    const item = provider({ configured: false });
    const owner = createOwner([item], []);
    owner.configure.mockReturnValue(
      new Promise((yes, no) => {
        resolve = yes;
        reject = no;
      }),
    );
    const { wrapper } = mountSettings(owner);
    try {
      const open = async () => {
        await wrapper
          .findAll("button")
          .find((b) => b.text() === enUS.channels.connect)!
          .trigger("click");
        await flushPromises();
      };
      await open();
      const dialog = wrapper.findComponent({
        name: "ChannelRuntimeConfigDialog",
      });
      const submit = dialog.props("submit")! as (
        provider: ChannelProvider,
        values: Record<string, string>,
      ) => Promise<unknown>;
      const pending = submit(item, { bot_token: "test-only-token" });
      await dialog.vm.$emit("update:open", false);
      await flushPromises();
      await open();
      if (outcome === "success") resolve({ ...item, configured: true });
      else reject(new Error("Old configuration failed"));
      await pending;
      await flushPromises();
      expect(dialog.props("open")).toBe(true);
      expect(owner.connect).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
      expect(toast.success).not.toHaveBeenCalled();
    } finally {
      wrapper.unmount();
    }
  });
}
for (const outcome of ["success", "failure"] as const) {
  it(`a later settings configuration retires the old binding ${outcome}`, async () => {
    let resolve!: (value: Partial<ChannelConnectResponse>) => void,
      reject!: (reason: Error) => void;
    const item = provider({ configured: false });
    const owner = createOwner([item], []);
    owner.configure.mockResolvedValue({ ...item, configured: true });
    owner.connect.mockReturnValue(
      new Promise((yes, no) => {
        resolve = yes;
        reject = no;
      }),
    );
    const { wrapper } = mountSettings(owner);
    try {
      const open = async () => {
        await wrapper
          .findAll("button")
          .find((b) => b.text() === enUS.channels.connect)!
          .trigger("click");
        await flushPromises();
      };
      await open();
      const dialog = wrapper.findComponent({
        name: "ChannelRuntimeConfigDialog",
      });
      const submit = dialog.props("submit")! as (
        provider: ChannelProvider,
        values: Record<string, string>,
      ) => Promise<unknown>;
      const pending = submit(item, {});
      await flushPromises();
      expect(owner.connect).toHaveBeenCalledOnce();
      await open();
      if (outcome === "success")
        resolve({ url: "https://example.test/old-binding" });
      else reject(new Error("Old binding failed"));
      await pending;
      await flushPromises();
      expect(dialog.props("open")).toBe(true);
      expect(connectWindow.open).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
      expect(toast.success).not.toHaveBeenCalled();
    } finally {
      wrapper.unmount();
    }
  });
}
