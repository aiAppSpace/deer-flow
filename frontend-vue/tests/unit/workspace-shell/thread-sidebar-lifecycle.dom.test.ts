import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h, nextTick, reactive, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import RecentChatList from "@/components/workspace/RecentChatList.vue";
import ThreadSidebar from "@/components/workspace/ThreadSidebar.vue";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useUserPreferencesBoundary } from "@/composables/useUserPreferencesBoundary";
import { useWorkspaceSidebar } from "@/composables/useWorkspaceSidebar";
import { enUS } from "@/core/i18n/locales/en-US";
import { stopUserPreferences } from "@/core/settings/user-preferences";

vi.mock("@/core/api/fetcher", () => ({
  fetch: vi.fn(() => new Promise<Response>(() => undefined)),
}));
const mutations = vi.hoisted(() => ({
  rename: vi.fn(),
  error: vi.fn(),
  bootstrap: vi.fn(),
}));
vi.mock("@/composables/useFrontendExtensions", () => ({
  useFrontendExtensions: mutations.bootstrap,
}));
vi.mock("@/composables/useThreads", () => ({
  useThreads: () => ({
    threads: [{ thread_id: "thread-1", values: { title: "Original" } }],
    rename: mutations.rename,
  }),
}));
vi.mock("@/composables/useThreadActivity", () => ({
  useThreadActivity: () => undefined,
}));
vi.mock("@/composables/useProjects", () => ({
  useMoveThreadToProject: () => ({ mutate: vi.fn() }),
}));
vi.mock("@/core/workspace-shell/toast", () => ({
  useWorkspaceToast: () => ({ error: mutations.error }),
}));
vi.mock("@/components/workspace/channels/WorkspaceChannelsList.vue", () => ({
  default: { render: () => null },
}));
vi.mock("@/components/workspace/projects/ProjectsSection.vue", () => ({
  default: { render: () => null },
}));
vi.mock("@/components/workspace/projects/ProjectMoveDialog.vue", () => ({
  default: { render: () => null },
}));
vi.mock("@/components/workspace/RecentChatList.vue", () => ({
  default: { render: () => null },
}));
vi.mock("@/components/workspace/extensions/PluginNavigation.vue", () => ({
  default: { render: () => null },
}));
vi.mock("@/components/workspace/WorkspaceNavChatList.vue", () => ({
  default: { render: () => null },
}));
vi.mock("@/components/workspace/ThreadDeleteDialog.vue", () => ({
  default: { render: () => null },
}));

const route = reactive({
  path: "/workspace/chats/new",
  fullPath: "/workspace/chats/new",
  params: {},
  query: {},
});
let wrapper: ReturnType<typeof mount> | undefined;
let sidebar: ReturnType<typeof useWorkspaceSidebar>;

beforeEach(() => {
  mutations.bootstrap.mockClear();
  mutations.rename.mockReset();
  mutations.error.mockReset();
  document.body.innerHTML = "";
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.stubGlobal("useRoute", () => route);
  vi.stubGlobal("useNuxtApp", () => ({ $i18n: { t: ref(enUS) } }));
  route.path = route.fullPath = "/workspace/chats/new";
});
afterEach(async () => {
  wrapper?.unmount();
  wrapper = undefined;
  sidebar?.closeMobileSidebar();
  stopUserPreferences();
  await flushPromises();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

function workspace() {
  const owner = ref("alice");
  const settingsOpen = ref(false);
  const Host = defineComponent({
    setup() {
      sidebar = useWorkspaceSidebar();
      const { ready } = useUserPreferencesBoundary(owner);
      return () =>
        ready.value
          ? h("div", [
              h(ThreadSidebar),
              h(Dialog, { open: settingsOpen.value }, () =>
                h(
                  DialogContent,
                  {
                    closeLabel: "Close settings",
                    "aria-describedby": undefined,
                  },
                  () => [
                    h(DialogTitle, () => "Settings"),
                    h(
                      "button",
                      { "data-testid": "settings-control" },
                      "Notification",
                    ),
                  ],
                ),
              ),
            ])
          : null;
    },
  });
  wrapper = mount(Host, {
    attachTo: document.body,
    global: {
      stubs: { NuxtLink: { template: "<a><slot /></a>" } },
    },
  });
  return { owner, settingsOpen };
}

describe("ThreadSidebar host disposal", () => {
  it("boots the workspace extension snapshot while the mobile drawer is closed", async () => {
    workspace();
    await flushPromises();
    expect(sidebar.isNarrow.value).toBe(true);
    expect(sidebar.mobileOpen.value).toBe(false);
    expect(mutations.bootstrap).toHaveBeenCalledTimes(1);
    sidebar.mobileOpen.value = true;
    await flushPromises();
    sidebar.closeMobileSidebar();
    await flushPromises();
    expect(mutations.bootstrap).toHaveBeenCalledTimes(1);
  });

  it("keeps the desktop rail's positioning owner outside the unchanged native pan", async () => {
    vi.stubGlobal("matchMedia", () => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    workspace();
    sidebar.setCollapsed(false);
    await flushPromises();
    const inner = wrapper!.get('[data-slot="sidebar-inner"]');
    const original = inner.element;
    const positionOwner = inner.element.parentElement;
    expect(positionOwner?.getAttribute("data-slot")).toBe("sidebar-container");
    expect(positionOwner?.classList.contains("w-64")).toBe(true);
    expect(positionOwner?.classList.contains("border-r")).toBe(true);
    expect(positionOwner?.classList.contains("md:relative")).toBe(true);
    expect(positionOwner?.classList.contains("overflow-y-auto")).toBe(false);
    expect(inner.classes()).toContain("overflow-y-auto");
    expect(inner.classes()).not.toContain("fixed");
    expect(inner.classes()).not.toContain("relative");
    expect(inner.classes()).not.toContain("-translate-x-full");
    expect(inner.classes()).not.toContain("overflow-x-hidden");
    expect(inner.attributes("id")).toBe("workspace-sidebar");
    expect(inner.attributes("tabindex")).toBeUndefined();
    const rail = inner.get('[data-slot="sidebar-rail"]');
    expect(rail.attributes("tabindex")).toBe("-1");
    await rail.trigger("click");
    await nextTick();
    expect(sidebar.collapsed.value).toBe(true);
    expect(sidebar.mobileOpen.value).toBe(false);
    expect(inner.element).toBe(original);
    expect(positionOwner?.classList.contains("w-12")).toBe(true);
    await inner.get('[data-slot="sidebar-trigger"]').trigger("click");
    await nextTick();
    expect(sidebar.collapsed.value).toBe(false);
    expect(wrapper!.get('[data-slot="sidebar-inner"]').element).toBe(original);
    expect(positionOwner?.classList.contains("w-64")).toBe(true);
  });

  it("releases only the old host drawer across a real preferences owner remount", async () => {
    const { owner, settingsOpen } = workspace();
    sidebar.setCollapsed(true);
    const cookie = document.cookie;
    sidebar.mobileOpen.value = true;
    settingsOpen.value = true;
    await flushPromises();
    const oldDrawer = document.querySelector('[data-sidebar="sidebar"]');
    expect(oldDrawer).not.toBeNull();
    owner.value = "bob";
    await nextTick();
    expect(oldDrawer?.isConnected).toBe(false);
    await flushPromises();
    expect(sidebar.mobileOpen.value).toBe(false);
    expect(document.querySelector('[data-sidebar="sidebar"]')).toBeNull();
    expect(sidebar.collapsed.value).toBe(true);
    expect(document.cookie).toBe(cookie);
    const control = document.querySelector('[data-testid="settings-control"]');
    expect(control).not.toBeNull();
    expect(control?.closest('[aria-hidden="true"]')).toBeNull();
  });

  it("keeps same-owner renders and the existing route-close/desktop-cookie contracts", async () => {
    const { owner, settingsOpen } = workspace();
    sidebar.setCollapsed(true);
    const cookie = document.cookie;
    sidebar.mobileOpen.value = true;
    await flushPromises();
    const drawer = document.querySelector('[data-sidebar="sidebar"]');
    owner.value = "alice";
    settingsOpen.value = false;
    await nextTick();
    expect(sidebar.mobileOpen.value).toBe(true);
    expect(document.querySelector('[data-sidebar="sidebar"]')).toBe(drawer);
    route.fullPath = "/workspace/chats/t-2";
    await flushPromises();
    expect(sidebar.mobileOpen.value).toBe(false);
    expect(sidebar.collapsed.value).toBe(true);
    expect(document.cookie).toBe(cookie);
  });
});

for (const outcome of ["success", "failure"] as const) {
  for (const reopen of [false, true]) {
    it(`rename ${outcome} belongs to its own dialog (reopen=${reopen})`, async () => {
      vi.stubGlobal("matchMedia", () => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));
      let resolve!: () => void;
      let reject!: (error: Error) => void;
      mutations.rename.mockReturnValue(
        new Promise<void>((yes, no) => {
          resolve = yes;
          reject = no;
        }),
      );
      workspace();
      sidebar.setCollapsed(false);
      await flushPromises();
      wrapper!
        .getComponent(RecentChatList)
        .vm.$emit("rename-thread", "thread-1");
      await flushPromises();
      let input = document.querySelector<HTMLInputElement>(
        'input[placeholder="Rename"]',
      )!;
      input.value = "First draft";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input
        .closest("form")!
        .dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        );
      await flushPromises();
      expect(mutations.rename).toHaveBeenCalledWith("thread-1", "First draft");
      if (reopen) {
        [...document.querySelectorAll<HTMLButtonElement>("button")]
          .find((b) => b.textContent?.trim() === "Cancel")!
          .click();
        await flushPromises();
        wrapper!
          .getComponent(RecentChatList)
          .vm.$emit("rename-thread", "thread-1");
        await flushPromises();
        input = document.querySelector<HTMLInputElement>(
          'input[placeholder="Rename"]',
        )!;
        input.value = "Second draft";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        await nextTick();
      }
      if (outcome === "success") resolve();
      else reject(new Error("Rename rejected"));
      await flushPromises();
      if (reopen) {
        expect(
          document.querySelector<HTMLInputElement>(
            'input[placeholder="Rename"]',
          )?.value,
        ).toBe("Second draft");
        expect(mutations.error).not.toHaveBeenCalled();
      } else if (outcome === "success")
        expect(
          document.querySelector('input[placeholder="Rename"]'),
        ).toBeNull();
      else {
        expect(
          document.querySelector<HTMLInputElement>(
            'input[placeholder="Rename"]',
          )?.value,
        ).toBe("First draft");
        expect(mutations.error).toHaveBeenCalledWith("Rename rejected");
      }
    });
  }
}
