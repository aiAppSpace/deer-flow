/*
  【文件职责】     固定侧栏渠道分组的列表语义、连接态措辞与「不拉 connections」这条取数判据。
  【架构位置】     Vue DOM test
  【主要导出】     无；Vitest cases
  【依赖关系】     WorkspaceChannelsList.vue · i18n · mocked composable owner
  【边界与注意】   对照 frontend/src/components/workspace/channels/workspace-channels-list.tsx。
                   列表语义（ul/li）与设置页那张 `ui/item` 卡片不是同一件事，别为了省一个组件把它们合回去。
*/

import { mount } from "@vue/test-utils";
import { nextTick, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import WorkspaceChannelsList from "@/components/workspace/channels/WorkspaceChannelsList.vue";
import type { ChannelProvider } from "@/core/channels/types";
import { enUS } from "@/core/i18n/locales/en-US";

const ownerFactory = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

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
vi.mock("@/core/workspace-shell/toast", () => ({
  useWorkspaceToast: () => toast,
}));
vi.mock("@/core/channels/open-connect-url", () => ({
  closeConnectWindow: vi.fn(),
  openConnectUrl: vi.fn(),
  prepareConnectWindow: vi.fn(() => null),
}));

function provider(overrides: Partial<ChannelProvider> = {}): ChannelProvider {
  return {
    provider: "slack",
    display_name: "Slack",
    enabled: true,
    configured: true,
    connectable: true,
    auth_mode: "binding_code",
    connection_status: "connected",
    credential_fields: [],
    ...overrides,
  };
}

function createOwner(providers: ChannelProvider[]) {
  return {
    enabled: ref(true),
    providers: ref(providers),
    connections: ref([]),
    providerViews: ref([]),
    connectFlows: ref({}),
    loaded: ref(true),
    loading: ref(false),
    error: ref<Error | null>(null),
    connect: vi.fn(),
    configure: vi.fn(),
    disconnectConnection: vi.fn(),
    disconnectProvider: vi.fn(),
    cancelConnect: vi.fn(),
    isProviderPending: vi.fn(() => false),
    isConnectionPending: vi.fn(() => false),
  };
}

function mountList(providers = [provider()]) {
  const owner = createOwner(providers);
  ownerFactory.mockReturnValue(owner);
  const wrapper = mount(WorkspaceChannelsList, {
    attachTo: document.body,
    global: { stubs: { ChannelProviderIcon: true } },
  });
  return { owner, wrapper };
}

beforeEach(() => {
  vi.stubGlobal("useNuxtApp", () => ({ $i18n: { t: ref(enUS) } }));
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("WorkspaceChannelsList", () => {
  /*
    侧栏与 React 一样是 SidebarMenu：ul + 每个 provider 一个 li。
    负向验证：把 ul/li 换回 article，第一条断言立刻红——而这正是台账里 17 行差异的形状。
  */
  it("renders one list item per enabled provider", () => {
    const { wrapper } = mountList([
      provider(),
      provider({ provider: "telegram", display_name: "Telegram" }),
      provider({
        provider: "discord",
        display_name: "Discord",
        enabled: false,
      }),
    ]);

    expect(wrapper.findAll("ul[data-sidebar='menu']")).toHaveLength(1);
    const items = wrapper.findAll("li[data-sidebar='menu-item']");
    expect(items).toHaveLength(2);
    expect(items.map((item) => item.text())).toEqual([
      "SlackConnected",
      "TelegramConnected",
    ]);
    expect(wrapper.find("article").exists()).toBe(false);
  });

  /*
    这里是「侧栏不预取 connections」那条判据的单测面：composable 收到 withConnections=false。
    负向验证：删掉那个参数，这条立刻红；对照套件那边同一处改动会多出一条
    GET /api/channels/connections。
  */
  it("never prefetches the connections list", () => {
    mountList();
    expect(ownerFactory).toHaveBeenCalledTimes(1);
    expect(ownerFactory.mock.calls[0]?.[0]).toMatchObject({
      withConnections: false,
    });
  });

  it("labels an unavailable runtime as connectable and explains why", () => {
    const { wrapper } = mountList([
      provider({
        connection_status: "connected",
        connectable: false,
        unavailable_reason: "Slack runtime is not running.",
      }),
    ]);

    const button = wrapper.get("li button");
    expect(button.text()).toBe("Connect");
    expect(button.attributes("title")).toBe("Slack runtime is not running.");
  });

  it("opens the runtime setup form instead of connecting when credentials are missing", async () => {
    const { owner, wrapper } = mountList([
      provider({
        configured: false,
        connectable: false,
        connection_status: "not_connected",
        credential_fields: [
          {
            name: "bot_token",
            label: "Bot token",
            type: "password",
            required: true,
          },
        ],
      }),
    ]);

    await wrapper.get("li button").trigger("click");
    await nextTick();
    expect(owner.connect).not.toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
      "Connect Slack",
    );
  });

  it("refuses to connect an unconnectable provider and says so once", async () => {
    const { owner, wrapper } = mountList([
      provider({
        connectable: false,
        connection_status: "not_connected",
        unavailable_reason: "Slack runtime is not running.",
      }),
    ]);

    await wrapper.get("li button").trigger("click");
    expect(owner.connect).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Slack runtime is not running.");
  });

  it("hides the whole group when the providers query failed", () => {
    const owner = createOwner([provider()]);
    owner.error.value = new Error("boom");
    ownerFactory.mockReturnValue(owner);
    const wrapper = mount(WorkspaceChannelsList, {
      global: { stubs: { ChannelProviderIcon: true } },
    });
    expect(wrapper.find("[data-sidebar='group']").exists()).toBe(false);
  });
});
