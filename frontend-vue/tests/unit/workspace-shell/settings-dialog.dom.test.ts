/* settings modal DOM/history contract. */
import { flushPromises, mount } from "@vue/test-utils";
import { reactive } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SettingsDialog from "@/components/workspace/settings/SettingsDialog.vue";
import { useSettingsDialog } from "@/composables/useSettingsDialog";
import { nuxtI18nMocks, nuxtI18nStub } from "../../support/nuxt-i18n";

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
      stubs: {
        AccountSettings: {
          template:
            '<button data-testid="account-control">Account control</button>',
        },
        AppearanceSettings: { template: "<div>Appearance panel</div>" },
        NotificationSettings: true,
        IntegrationsSettings: true,
        ChannelConnections: true,
        ToolSettings: true,
        SkillSettings: true,
        MemorySettings: true,
        AboutSettings: true,
      },
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
