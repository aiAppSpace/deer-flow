import { flushPromises, mount } from "@vue/test-utils";
import { computed, reactive, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CapabilityCenter from "@/components/workspace/capabilities/CapabilityCenter.vue";
import { Tabs } from "@/components/ui/tabs";
import { enUS } from "@/core/i18n/locales/en-US";
vi.mock("@/composables/useWorkspaceSidebar", () => ({
  useWorkspaceSidebar: () => ({
    mobileOpen: ref(false),
    toggleSidebar: vi.fn(),
  }),
}));
const route = reactive({
  path: "/workspace/capabilities",
  query: {} as Record<string, string>,
});
const replace = vi.fn();
const wrappers: ReturnType<typeof mount>[] = [];
function setup() {
  const wrapper = mount(CapabilityCenter, {
    global: {
      stubs: {
        PluginGallery: {
          props: ["query"],
          template: '<p data-gallery="plugins">{{query}}</p>',
        },
        SkillGallery: {
          props: ["query"],
          template: '<p data-gallery="skills">{{query}}</p>',
        },
        ExtensionGallery: {
          props: ["query"],
          template: '<p data-gallery="extensions">{{query}}</p>',
        },
      },
    },
  });
  wrappers.push(wrapper);
  return wrapper;
}
beforeEach(() => {
  route.query = {};
  replace.mockReset().mockImplementation(({ query }) => {
    route.query = query;
  });
  vi.stubGlobal("useNuxtApp", () => ({
    $i18n: { t: computed(() => enUS), locale: ref("en-US") },
  }));
  vi.stubGlobal("useRoute", () => route);
  vi.stubGlobal("useRouter", () => ({ replace }));
});
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  vi.unstubAllGlobals();
});
describe("capability center routing", () => {
  it("defaults an unknown tab to plugins and clears query and previous search on tab change", async () => {
    route.query = { tab: "unknown", plugin: "old", keep: "value" };
    const wrapper = setup();
    await flushPromises();
    expect(wrapper.find('[data-gallery="plugins"]').exists()).toBe(true);
    await wrapper.get("input").setValue("search");
    expect(wrapper.get('[data-gallery="plugins"]').text()).toBe("search");
    wrapper.getComponent(Tabs).vm.$emit("update:modelValue", "skills");
    await flushPromises();
    expect(replace).toHaveBeenCalledWith({
      path: route.path,
      query: { tab: "skills" },
    });
    expect(wrapper.get("input").element.value).toBe("");
    expect(wrapper.find('[data-gallery="skills"]').exists()).toBe(true);
    expect(wrapper.get("input").attributes("aria-label")).toBe(
      enUS.capabilities.searchSkills,
    );
  });
  it("opens the extension tab from a URL and uses its dedicated search label", async () => {
    route.query = { tab: "extensions", extension: "community.bookmarks" };
    const wrapper = setup();
    await flushPromises();
    expect(wrapper.find('[data-gallery="extensions"]').exists()).toBe(true);
    expect(wrapper.get("input").attributes("aria-label")).toBe(
      enUS.extensions.search,
    );
  });
});
