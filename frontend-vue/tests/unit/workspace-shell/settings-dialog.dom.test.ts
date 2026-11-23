/* settings modal DOM/history contract. */
import { flushPromises, mount } from "@vue/test-utils";
import { reactive } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SettingsDialog from "@/components/workspace/settings/SettingsDialog.vue";
import { useSettingsDialog } from "@/composables/useSettingsDialog";
import { nuxtI18nMocks, nuxtI18nStub } from "../../support/nuxt-i18n";

// SettingsDialog owns the modal, focus and route lifecycle. Its lazy panels have
// independent consumer tests; module mocks intercept their actual import boundary
// instead of relying on component-name stubs around defineAsyncComponent.
vi.mock("@/components/workspace/settings/AccountSettings.vue", () => ({
  __esModule: true,
  default: {
    template: '<button data-testid="account-control">Account control</button>',
  },
}));
vi.mock("@/components/workspace/settings/AppearanceSettings.vue", () => ({
  __esModule: true,
  default: {
    template: '<div data-testid="appearance-panel">Appearance panel</div>',
  },
}));
vi.mock("@/components/workspace/settings/NotificationSettings.vue", () => ({
  __esModule: true,
  default: { template: "<div>Notification panel</div>" },
}));
vi.mock("@/components/workspace/channels/ChannelConnections.vue", () => ({
  __esModule: true,
  default: { template: "<div>Channels panel</div>" },
}));
vi.mock("@/components/workspace/settings/MemorySettings.vue", () => ({
  __esModule: true,
  default: { template: '<div data-testid="memory-panel">Memory panel</div>' },
}));
vi.mock("@/components/workspace/settings/SubagentSettings.vue", () => ({
  __esModule: true,
  default: { template: "<div>Subagents panel</div>" },
}));
vi.mock("@/components/workspace/settings/ModelSettings.vue", () => ({
  __esModule: true,
  default: { template: "<div>Models panel</div>" },
}));
vi.mock("@/components/workspace/settings/AboutSettings.vue", () => ({
  __esModule: true,
  default: { template: "<div>About panel</div>" },
}));

const route = reactive({
  path: "/workspace/chats/t-1",
  fullPath: "/workspace/chats/t-1",
  query: {} as Record<string, unknown>,
  hash: "#run-2",
});
const push = vi.fn();
let mounted: ReturnType<typeof mount> | null = null;

function mountDialog() {
  mounted = mount(SettingsDialog, {
    attachTo: document.body,
    global: {
      mocks: nuxtI18nMocks(),
    },
  });
  return mounted;
}

beforeEach(() => {
  document.body.innerHTML = "";
  route.query = {};
  push.mockReset().mockResolvedValue(undefined);
  useSettingsDialog().close({ source: "route" });
  vi.stubGlobal("useRoute", () => route);
  vi.stubGlobal("useRouter", () => ({ push }));
  vi.stubGlobal("useNuxtApp", () => ({ $i18n: nuxtI18nStub() }));
});

afterEach(async () => {
  mounted?.unmount();
  mounted = null;
  await flushPromises();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("SettingsDialog", () => {
  it("has an associated title/description and traps Tab in the modal", async () => {
    const wrapper = mountDialog();
    useSettingsDialog().show("account");
    await flushPromises();
    await vi.waitFor(() => {
      expect(
        document.querySelector('[data-testid="account-control"]'),
      ).not.toBeNull();
    });

    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(dialog.getAttribute("aria-labelledby")).toBeTruthy();
    /*
      对照 React settings-dialog.tsx 的 aria-describedby={undefined}：描述是
      可见正文，不做对话框的可访问描述，读屏器打开时只念标题。
    */
    expect(dialog.getAttribute("aria-describedby")).toBeNull();
    expect(
      document.getElementById(dialog.getAttribute("aria-labelledby")!)
        ?.textContent,
    ).toBe("Settings");

    // React 把关闭按钮的名字写死成 "Close"，两边听到同一句（见 primitives.close）。
    const close = document.querySelector<HTMLButtonElement>(
      '[aria-label="Close"]',
    )!;
    close.focus();
    close.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Tab", bubbles: true }),
    );
    expect(dialog.contains(document.activeElement)).toBe(true);
    wrapper.unmount();
  });

  it("returns focus on Escape and closes a deep link by preserving query/hash", async () => {
    const trigger = document.createElement("button");
    trigger.textContent = "Open settings";
    document.body.appendChild(trigger);
    trigger.focus();
    route.query = { settings: "memory", tab: "files" };
    const wrapper = mountDialog();
    await flushPromises();
    await vi.waitFor(() => {
      expect(
        document.querySelector('[data-testid="memory-panel"]'),
      ).not.toBeNull();
    });

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    await flushPromises();
    expect(push).toHaveBeenCalledWith({
      path: "/workspace/chats/t-1",
      query: { tab: "files" },
      hash: "#run-2",
    });
    expect(document.activeElement).toBe(trigger);
    wrapper.unmount();
  });

  it("follows back/forward route changes without a query-write loop", async () => {
    route.query = { settings: "appearance", keep: "1" };
    const wrapper = mountDialog();
    await flushPromises();
    await vi.waitFor(() => {
      expect(
        document.querySelector('[data-testid="appearance-panel"]'),
      ).not.toBeNull();
    });
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();

    route.query = { keep: "1" };
    await flushPromises();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(push).not.toHaveBeenCalled();

    route.query = { settings: "appearance", keep: "1" };
    await flushPromises();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(push).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});
