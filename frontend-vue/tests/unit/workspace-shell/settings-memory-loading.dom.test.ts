import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h, nextTick, reactive, Suspense } from "vue";
import { afterEach, expect, it, vi, type Mock } from "vitest";

import SettingsDialog from "@/components/workspace/settings/SettingsDialog.vue";
import {
  useSettingsDialog,
  type SettingsSection,
} from "@/composables/useSettingsDialog";
import { nuxtI18nMocks, nuxtI18nStub } from "../../support/nuxt-i18n";

const panels = vi.hoisted(() => {
  const sections = [
    "account",
    "appearance",
    "notification",
    "channels",
    "memory",
    "subagents",
    "models",
    "about",
  ] as const;
  return Object.fromEntries(
    sections.map((section) => {
      let resolve!: () => void;
      const gate = new Promise<void>((done) => {
        resolve = done;
      });
      return [section, { loaded: vi.fn<() => void>(), gate, resolve }];
    }),
  ) as Record<
    (typeof sections)[number],
    {
      loaded: Mock<() => void>;
      gate: Promise<void>;
      resolve: () => void;
    }
  >;
});

async function panel(section: SettingsSection) {
  panels[section].loaded();
  await panels[section].gate;
  return {
    __esModule: true,
    default: {
      template: `<div data-testid="loaded-${section}">${section} panel</div>`,
    },
  };
}

vi.mock("@/components/workspace/settings/AccountSettings.vue", () =>
  panel("account"),
);
vi.mock("@/components/workspace/settings/AppearanceSettings.vue", () =>
  panel("appearance"),
);
vi.mock("@/components/workspace/settings/NotificationSettings.vue", () =>
  panel("notification"),
);
vi.mock("@/components/workspace/channels/ChannelConnections.vue", () =>
  panel("channels"),
);
vi.mock("@/components/workspace/settings/MemorySettings.vue", () =>
  panel("memory"),
);
vi.mock("@/components/workspace/settings/SubagentSettings.vue", () =>
  panel("subagents"),
);
vi.mock("@/components/workspace/settings/ModelSettings.vue", () =>
  panel("models"),
);
vi.mock("@/components/workspace/settings/AboutSettings.vue", () =>
  panel("about"),
);

let wrapper: ReturnType<typeof mount> | undefined;
afterEach(() => {
  wrapper?.unmount();
  useSettingsDialog().close();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

it("loads only the selected panel and owns its loading state inside Nuxt's parent Suspense", async () => {
  vi.stubGlobal("useNuxtApp", () => ({ $i18n: nuxtI18nStub() }));
  vi.stubGlobal("useRoute", () =>
    reactive({ path: "/workspace/chats/new", query: {}, hash: "" }),
  );
  vi.stubGlobal("useRouter", () => ({ push: vi.fn() }));
  useSettingsDialog().close();
  const Host = defineComponent({
    setup: () => () => h(Suspense, null, { default: () => h(SettingsDialog) }),
  });
  wrapper = mount(Host, {
    attachTo: document.body,
    global: { mocks: nuxtI18nMocks() },
  });
  await flushPromises();
  for (const state of Object.values(panels))
    expect(state.loaded).not.toHaveBeenCalled();

  const selected = new Set<SettingsSection>();
  for (const section of Object.keys(panels) as SettingsSection[]) {
    useSettingsDialog().show(section);
    await nextTick();
    await flushPromises();
    expect(
      document.querySelector('p[role="status"]')?.textContent?.trim(),
    ).toBe("Loading…");
    expect(panels[section].loaded).toHaveBeenCalledTimes(1);
    selected.add(section);
    for (const unselected of Object.keys(panels) as SettingsSection[]) {
      if (!selected.has(unselected))
        expect(panels[unselected].loaded).not.toHaveBeenCalled();
    }
    panels[section].resolve();
    await flushPromises();
    expect(
      document.querySelector(`[data-testid="loaded-${section}"]`),
    ).not.toBeNull();
  }

  useSettingsDialog().close();
  await flushPromises();
  for (const section of Object.keys(panels) as SettingsSection[]) {
    useSettingsDialog().show(section);
    await flushPromises();
    expect(panels[section].loaded).toHaveBeenCalledTimes(1);
    expect(
      document.querySelector(`[data-testid="loaded-${section}"]`),
    ).not.toBeNull();
    expect(document.querySelector('p[role="status"]')).toBeNull();
  }
});
