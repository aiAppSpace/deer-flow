/*
  【文件职责】     固定settings UI 的多账号、删除边界、connect 指引与 Gateway 错误展示。
  【架构位置】     Vue DOM test
  【主要导出】     无；Vitest cases
  【依赖关系】     ChannelConnections.vue · i18n · mocked composable owner
  【边界与注意】   provider runtime 删除与 connection instance 删除必须保持为两个明确动作。
*/

import { mount } from "@vue/test-utils";
import { nextTick, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ChannelConnections from "@/components/workspace/channels/ChannelConnections.vue";
import { buildChannelProviderViews } from "@/core/channels/state";
import type {
  ChannelConnectResponse,
  ChannelConnection,
  ChannelProvider,
} from "@/core/channels/types";
import { enUS } from "@/core/i18n/locales/en-US";

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
  const wrapper = mount(ChannelConnections, {
    attachTo: document.body,
    global: {
      stubs: { ChannelProviderIcon: true },
    },
  });
  return { owner, wrapper };
}

/*
  连接按钮的三档文案。第三档「重新连接」是本仓 wave 35 之前缺的：上游
  channels-settings-page.tsx:284 在连接被吊销时把「连接」换成「重新连接」，
  本仓对已吊销的连接照样写「连接」，用户看不出这次是首次接入还是接回一条断掉的。

  三档一起断言，缺一不可：只测「重新连接」那一档的话，把判据写成恒返回 reconnect
  也是绿的。
*/
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

/**
 * 对话框现在由 ui/dialog · ui/alert-dialog 提供，内容 portal 到 body，
 * 所以断言从 wrapper 子树移到 document。破坏性确认是 alertdialog，其余是 dialog。
 */
function openDialog(role: "dialog" | "alertdialog" = "dialog") {
  const element = document.querySelector<HTMLElement>(`[role="${role}"]`);
  expect(element, `no [role="${role}"] in the document`).not.toBeNull();
  return element!;
}

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
    const removalDialog = openDialog("alertdialog");
    expect(removalDialog.textContent).toContain(
      "revokes every active connection",
    );
    [...removalDialog.querySelectorAll<HTMLElement>("button")]
      .find(
        (button) =>
          button.textContent?.trim() === "Remove provider configuration",
      )!
      .click();
    expect(owner.disconnectProvider).toHaveBeenCalledWith("slack");
  });

  it("opens deep links and keeps instruction plus waiting state visible", async () => {
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
    expect(openDialog().textContent).toContain(response.instruction);
    expect(
      document
        .querySelector('[data-testid="channel-connect-state"]')
        ?.textContent?.trim(),
    ).toBe("Waiting for the channel account to connect…");
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
  ])(
    "supports a $label connect response",
    async ({ url, instruction, visible }) => {
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
      expect(openDialog().textContent).toContain(visible);
      if (url)
        expect(connectWindow.open).toHaveBeenCalledWith(
          url,
          expect.any(Object),
        );
      else expect(connectWindow.close).toHaveBeenCalledWith(expect.any(Object));
    },
  );

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
    expect(wrapper.get('[role="alert"]').text()).toBe(message);
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

  /*
    **一行 binding row 都没有、但 provider 自己说已连接**——这正是
    `DEER_FLOW_AUTH_DISABLED=1`（本仓默认的本地跑法）下的形状：每条渠道消息都路由到
    默认用户，配好且跑起来的 provider 没有也不需要 binding row，后端直接回
    `connection_status="connected"`（理由原文在 core/channels/state.ts 的文件头）。

    只看 `connections` 的那一版在这里让同一行自相矛盾：状态图标画绿勾「已连接」，
    按钮却写「连接」。对照台账 `channels#settings-panel` 上
    `ariaOnlyVue: button "Connect" ×3` 报的就是它。
    **侧栏那次已经踩过同一条**，这一页是第二次。
  */
  it("provider 说已连接、却一行账号都没有时，主操作键根本不渲染", () => {
    const owner = createOwner(
      [provider({ connection_status: "connected" })],
      [],
    );
    const { wrapper } = mountSettings(owner);
    /*
      断言落在**按钮本身**，不是整屏文字：面板标题里就有 "Connect IM accounts…"，
      状态词又是 "Connected"，拿整屏做 `not.toContain("Connect")` 永远为假
      （第一版就是这么写的，报的是标题那一句）。

      三档文案**都不许出现**：只把「连接」换成「添加账号」不算修好——
      上游在已连接态压根不渲染这颗键，换名字只会让台账上那几行换个名字继续在
      （对照工厂的 accept 门禁当场拒写，那一版就是这么被挡回来的）。
    */
    const labels = wrapper.findAll("button").map((button) => button.text());

    expect(labels).not.toContain(enUS.channels.connect);
    expect(labels).not.toContain(enUS.channels.addAccount);
    expect(labels).not.toContain(enUS.channels.reconnect);
    // 其余动作照旧：可编辑运行时配置的 provider 仍然有「修改」。
    expect(labels).toContain(enUS.channels.modify);
  });

  /*
    有 binding row 时这颗键要留着——多账号是本仓设置页独有的能力，
    「添加账号」在那种形状下是真操作，不能被上面那条一起砍掉。
  */
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
