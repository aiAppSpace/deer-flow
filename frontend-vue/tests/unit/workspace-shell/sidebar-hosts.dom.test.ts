import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import CapabilityCenter from "@/components/workspace/capabilities/CapabilityCenter.vue";
import PluginPage from "@/components/workspace/extensions/PluginPage.vue";
import ThreadSidebarShell from "@/components/workspace/ThreadSidebarShell.vue";
import { useWorkspaceSidebar } from "@/composables/useWorkspaceSidebar";
import { enUS } from "@/core/i18n/locales/en-US";

vi.mock("@/components/workspace/capabilities/PluginGallery.vue", () => ({
  __esModule: true,
  default: { render: () => h("div") },
}));
vi.mock("@/components/workspace/capabilities/SkillGallery.vue", () => ({
  __esModule: true,
  default: { render: () => h("div") },
}));
vi.mock("@/components/workspace/capabilities/ExtensionGallery.vue", () => ({
  __esModule: true,
  default: { render: () => h("div") },
}));
vi.mock("@/components/workspace/extensions/PluginSurfaces.vue", () => ({
  default: { render: () => h("div") },
}));
vi.mock("@/composables/useCapabilities", () => ({
  useCapabilityUser: () => ref({ id: "alice" }),
}));
vi.mock("@/composables/useFrontendExtensions", () => ({
  useFrontendExtensions: () => ({
    data: ref([]),
    isError: ref(false),
    isPending: ref(false),
  }),
}));

const cleanups: (() => void)[] = [];
let narrow = true;
const mediaListeners = new Set<(event: MediaQueryListEvent) => void>();

function setup(component: typeof CapabilityCenter | typeof PluginPage) {
  let state!: ReturnType<typeof useWorkspaceSidebar>;
  const wrapper = mount(
    defineComponent({
      setup() {
        state = useWorkspaceSidebar();
        return () =>
          h("div", [
            h(component, { namespace: "missing", surfaceId: "missing" }),
            h(
              ThreadSidebarShell,
              {
                narrow: state.isNarrow.value,
                open: state.mobileOpen.value,
                collapsed: state.collapsed.value,
                title: "Sidebar",
                description: "Displays the mobile sidebar.",
                closeLabel: "Close sidebar",
                "onUpdate:open": (open: boolean) => {
                  state.mobileOpen.value = open;
                },
              },
              {
                default: () =>
                  h(
                    "button",
                    { onClick: state.closeMobileSidebar },
                    "Close navigation",
                  ),
              },
            ),
          ]);
      },
    }),
    {
      attachTo: document.body,
      global: {
        stubs: { NuxtLink: { template: "<a><slot /></a>" } },
      },
    },
  );
  cleanups.push(() => {
    state.closeMobileSidebar();
    state.setCollapsed(false);
    wrapper.unmount();
  });
  return {
    wrapper,
    get state() {
      return state;
    },
  };
}

beforeEach(() => {
  narrow = true;
  vi.stubGlobal("matchMedia", () => ({
    get matches() {
      return narrow;
    },
    addEventListener: (
      _type: string,
      callback: (event: MediaQueryListEvent) => void,
    ) => mediaListeners.add(callback),
    removeEventListener: (
      _type: string,
      callback: (event: MediaQueryListEvent) => void,
    ) => mediaListeners.delete(callback),
  }));
  vi.stubGlobal("useNuxtApp", () => ({
    $i18n: { t: ref(enUS), locale: ref("en-US") },
  }));
  vi.stubGlobal("useRoute", () => ({
    path: "/workspace/capabilities",
    query: {},
  }));
  vi.stubGlobal("useRouter", () => ({ replace: vi.fn() }));
});
afterEach(async () => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  await flushPromises();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
  mediaListeners.clear();
});

describe.each([
  ["capability center", CapabilityCenter],
  ["extension page", PluginPage],
] as const)("%s sidebar trigger", (_name, component) => {
  it("uses the actual mobile drawer state through open, close and focus", async () => {
    const { wrapper, state } = setup(component);
    await flushPromises();
    const trigger = wrapper.get<HTMLButtonElement>("[data-sidebar='trigger']");
    expect(trigger.classes()).toContain("md:hidden");
    expect(trigger.get("svg").classes()).toContain("lucide-panel-left-open");
    expect(state.open.value).toBe(true);
    expect(state.mobileOpen.value).toBe(false);
    expect(document.querySelector("[role='dialog']")).toBeNull();
    trigger.element.focus();
    expect(document.activeElement).toBe(trigger.element);
    await trigger.trigger("click");
    await flushPromises();
    const drawer = document.querySelector<HTMLElement>("[role='dialog']")!;
    expect(drawer).not.toBeNull();
    expect(state.mobileOpen.value).toBe(true);
    expect(state.collapsed.value).toBe(false);
    expect(trigger.get("svg").classes()).toContain("lucide-panel-left-close");
    const close = [
      ...drawer.querySelectorAll<HTMLButtonElement>("button"),
    ].find((button) => button.textContent === "Close navigation")!;
    close.focus();
    expect(drawer.contains(document.activeElement)).toBe(true);
    close.click();
    await flushPromises();
    await vi.waitFor(() =>
      expect(document.querySelector("[role='dialog']")).toBeNull(),
    );
    expect(state.mobileOpen.value).toBe(false);
    expect(trigger.get("svg").classes()).toContain("lucide-panel-left-open");
    trigger.element.focus();
    expect(document.activeElement).toBe(trigger.element);
  });

  it("keeps desktop collapse independent from the mobile-only icon", async () => {
    const { wrapper, state } = setup(component);
    await flushPromises();
    const trigger = wrapper.get("[data-sidebar='trigger']");
    state.setCollapsed(true);
    await flushPromises();
    expect(trigger.get("svg").classes()).toContain("lucide-panel-left-open");
    await trigger.trigger("click");
    await flushPromises();
    expect(state.mobileOpen.value).toBe(true);
    expect(state.collapsed.value).toBe(true);
    expect(trigger.get("svg").classes()).toContain("lucide-panel-left-close");
    state.closeMobileSidebar();
    narrow = false;
    mediaListeners.forEach((listener) =>
      listener({ matches: false } as MediaQueryListEvent),
    );
    await flushPromises();
    state.toggleSidebar();
    expect(state.open.value).toBe(true);
    expect(state.mobileOpen.value).toBe(false);
    await flushPromises();
    expect(trigger.get("svg").classes()).toContain("lucide-panel-left-open");
  });
});
