import { flushPromises, mount } from "@vue/test-utils";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { computed, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({
  load: vi.fn(),
  toggle: vi.fn(),
  upload: vi.fn(),
  access: { value: undefined as unknown },
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("@/core/skills/api", async () => ({
  ...(await vi.importActual<typeof import("@/core/skills/api")>(
    "@/core/skills/api",
  )),
  loadSkills: api.load,
  enableSkill: api.toggle,
  uploadSkillArchive: api.upload,
}));
vi.mock("@/core/workspace-shell/toast", () => ({
  useWorkspaceToast: () => api.toast,
}));
vi.mock("@/composables/useSettingsPermissions", () => ({
  useSettingsPermissions: () => ({ authDisabled: false, session: api.access }),
}));
import SkillGallery from "@/components/workspace/capabilities/SkillGallery.vue";
import CapabilityCard from "@/components/workspace/capabilities/CapabilityCard.vue";
import { Tabs } from "@/components/ui/tabs";
import { enUS } from "@/core/i18n/locales/en-US";
const builtin = {
  name: "deep-research",
  description: "Research topic",
  category: "public",
  enabled: true,
};
const custom = {
  name: "review",
  description: "Custom review",
  category: "custom",
  enabled: true,
};
const cleanup: (() => void)[] = [];
function setup(query = "") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = mount(SkillGallery, {
    props: { query },
    attachTo: document.body,
    global: {
      plugins: [[VueQueryPlugin, { queryClient: client }]],
      stubs: { SkillExportDialog: true },
    },
  });
  cleanup.push(() => {
    wrapper.unmount();
    client.clear();
  });
  return wrapper;
}
beforeEach(() => {
  api.access = ref({
    tag: "authenticated",
    user: { id: "member", system_role: "user" },
  });
  api.load.mockReset().mockResolvedValue([builtin, custom]);
  api.toggle.mockReset();
  api.upload.mockReset();
  api.toast.error.mockReset();
  api.toast.success.mockReset();
  vi.stubGlobal("useNuxtApp", () => ({
    $i18n: { t: computed(() => enUS), locale: ref("en-US") },
  }));
  vi.stubGlobal("useRouter", () => ({ push: vi.fn() }));
});
afterEach(() => {
  cleanup.splice(0).forEach((fn) => fn());
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});
describe("real capability skill gallery", () => {
  it("lets a member browse while preventing global toggles and installation", async () => {
    const wrapper = setup();
    await flushPromises();
    expect(wrapper.findAllComponents(CapabilityCard)).toHaveLength(1);
    expect(wrapper.get('[role="switch"]').attributes("disabled")).toBeDefined();
    expect(wrapper.text()).not.toContain(enUS.settings.skills.installFromFile);
    wrapper.getComponent(Tabs).vm.$emit("update:modelValue", "custom");
    await flushPromises();
    await wrapper
      .getComponent(CapabilityCard)
      .find("h3 button")
      .trigger("click");
    await flushPromises();
    expect(document.body.textContent).toContain("Custom review");
    expect(
      [...document.querySelectorAll("button")].some(
        (button) =>
          button.textContent?.trim() === enUS.settings.skills.exportSkill,
      ),
    ).toBe(false);
  });
  it("preserves community empty state but uses no-results for a search", async () => {
    const wrapper = setup();
    await flushPromises();
    wrapper.getComponent(Tabs).vm.$emit("update:modelValue", "community");
    await flushPromises();
    expect(wrapper.text()).toContain(enUS.capabilities.communityTitle);
    await wrapper.setProps({ query: "research" });
    expect(wrapper.text()).toContain(enUS.capabilities.noResults);
    expect(wrapper.text()).not.toContain(enUS.capabilities.communityTitle);
  });
  it("installs as admin and selects the custom category only after backend success", async () => {
    api.access = ref({
      tag: "authenticated",
      user: { id: "admin", system_role: "admin" },
    });
    api.upload.mockResolvedValueOnce({ success: true, message: "Installed" });
    const wrapper = setup();
    await flushPromises();
    const file = new File(["archive"], "review.skill");
    const input = wrapper.get<HTMLInputElement>('input[type="file"]');
    Object.defineProperty(input.element, "files", {
      configurable: true,
      value: [file],
    });
    await input.trigger("change");
    await flushPromises();
    expect(api.upload).toHaveBeenCalledWith(file, {
      signal: expect.any(AbortSignal),
    });
    expect(api.toast.success).toHaveBeenCalledWith("Installed");
    expect(wrapper.getComponent(Tabs).props("modelValue")).toBe("custom");
    expect(wrapper.getComponent(CapabilityCard).props("name")).toBe("review");
  });
  it("retains the authoritative toggle value when a mutation fails", async () => {
    api.access = ref({
      tag: "authenticated",
      user: { id: "admin", system_role: "admin" },
    });
    api.toggle.mockRejectedValueOnce(new Error("Denied"));
    const wrapper = setup();
    await flushPromises();
    await wrapper.get('[role="switch"]').trigger("click");
    await flushPromises();
    expect(api.toggle).toHaveBeenCalledOnce();
    expect(api.toast.error).toHaveBeenCalledWith("Denied");
    expect(wrapper.get('[role="switch"]').attributes("aria-checked")).toBe(
      "true",
    );
  });
});
