import { flushPromises, mount } from "@vue/test-utils";
import { computed, defineComponent, h, ref } from "vue";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
const api = vi.hoisted(() => ({
  copy: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("@/core/clipboard", () => ({ writeTextToClipboard: api.copy }));
vi.mock("@/core/workspace-shell/toast", () => ({
  useWorkspaceToast: () => api.toast,
}));
import { provideMessageDetails } from "@/components/workspace/message-details/context";
import MessageDetailsPanel from "@/components/workspace/message-details/MessageDetailsPanel.vue";
import MessageDetailsMenu from "@/components/workspace/message-details/MessageDetailsMenu.vue";
import SkillUsageMenu from "@/components/workspace/skill-usage/SkillUsageMenu.vue";
import SkillUsagePanel from "@/components/workspace/skill-usage/SkillUsagePanel.vue";
import { enUS } from "@/core/i18n/locales/en-US";
import type { SkillUsage } from "@/core/skills/usage";
const snapshot: SkillUsage = {
  name: "report",
  description: "Captured description",
  category: "custom",
  path: "/mnt/skills/custom/report/SKILL.md",
  content:
    "---\nname: hidden-frontmatter\n---\n# Original snapshot\n[local](./note.md) ![local image](images/diagram.png) [remote](https://example.com/reference)",
  content_hash: "a".repeat(64),
  activation: "automatic",
  partial: true,
};
const cleanup: (() => void)[] = [];
beforeAll(async () => {
  // Exercise the real adapter, but load its async modules before timing the detail interaction.
  await Promise.all([
    import("@/components/chat/MessageMarkdownContent.vue"),
    import("@/components/markdown/StreamMarkdown.vue"),
  ]);
});
beforeEach(() => {
  api.copy.mockReset().mockResolvedValue(true);
  api.toast.success.mockReset();
  vi.stubGlobal("useNuxtApp", () => ({
    $i18n: { t: computed(() => enUS), locale: ref("en-US") },
  }));
});
afterEach(() => {
  cleanup.splice(0).forEach((fn) => fn());
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function host() {
  const scope = ref("thread-a");
  let owner!: ReturnType<typeof provideMessageDetails>;
  const onSelect = vi.fn();
  const wrapper = mount(
    defineComponent({
      setup() {
        owner = provideMessageDetails(scope, onSelect);
        return () =>
          h("div", [
            h(SkillUsageMenu, { skills: [snapshot] }),
            h(MessageDetailsPanel),
          ]);
      },
    }),
    { attachTo: document.body },
  );
  cleanup.push(() => wrapper.unmount());
  return { wrapper, owner, scope, onSelect };
}
describe("historical skill details", () => {
  it("does not replace the selected detail or move focus when the panel owner refuses to close", async () => {
    const { wrapper, owner, onSelect } = host();
    const origin = wrapper.get("button").element;
    origin.focus();
    onSelect.mockReturnValueOnce(false);
    expect(
      owner.select(
        {
          id: "blocked",
          title: "Blocked",
          content: SkillUsagePanel,
          props: { skill: snapshot },
        },
        origin,
      ),
    ).toBe(false);
    await flushPromises();
    expect(owner.open.value).toBe(false);
    expect(owner.selectedDetail.value).toBeNull();
    expect(document.activeElement).toBe(origin);
  });
  it("opens on mouse hover without moving composer focus and transfers selection into the detail heading", async () => {
    vi.useFakeTimers();
    const { wrapper, owner } = host();
    const composer = document.createElement("textarea");
    document.body.append(composer);
    composer.focus();
    const trigger = wrapper.get(`button[aria-label="${enUS.skillUsage.used}"]`);
    await trigger.trigger("pointerenter", { pointerType: "mouse" });
    await vi.advanceTimersByTimeAsync(120);
    await flushPromises();
    expect(document.querySelector('[role="menu"]')).toBeTruthy();
    expect(document.activeElement).toBe(composer);
    (document.querySelector('[role="menuitem"]') as HTMLElement).click();
    await flushPromises();
    expect(owner.open.value).toBe(true);
    expect(wrapper.get("h2").element).toBe(document.activeElement);
    await wrapper.get("section").trigger("keydown", { key: "Escape" });
    await flushPromises();
    expect(document.activeElement).toBe(trigger.element);
  });
  it("opens the captured snapshot through the shared owner, copies original content, and returns focus", async () => {
    const { wrapper, owner, onSelect } = host();
    const menu = wrapper.getComponent(MessageDetailsMenu);
    const trigger = wrapper.get(`button[aria-label="${enUS.skillUsage.used}"]`)
      .element as HTMLButtonElement;
    const entry = menu.props("entries")[0]!;
    entry.onSelect(trigger);
    await flushPromises();
    await flushPromises();
    expect(owner.open.value).toBe(true);
    expect(onSelect).toHaveBeenCalledOnce();
    expect(wrapper.get("h2").element).toBe(document.activeElement);
    const panel = wrapper.getComponent(SkillUsagePanel);
    expect(panel.text()).toContain("Captured description");
    await vi.waitFor(() => expect(panel.text()).toContain("Original snapshot"));
    expect(panel.text()).not.toContain("hidden-frontmatter");
    expect(panel.get('[role="status"]').text()).toBe(enUS.skillUsage.partial);
    expect(panel.find('a[href="./note.md"]').exists()).toBe(false);
    expect(panel.find('img[src="images/diagram.png"]').exists()).toBe(false);
    expect(panel.find('a[href="https://example.com/reference"]').exists()).toBe(
      true,
    );
    await wrapper
      .get(`button[aria-label="${enUS.skillUsage.copy}"]`)
      .trigger("click");
    await flushPromises();
    expect(api.copy).toHaveBeenCalledWith(snapshot.content);
    expect(api.toast.success).toHaveBeenCalledWith(
      enUS.clipboard.copiedToClipboard,
    );
    await wrapper.get("section").trigger("keydown", { key: "Escape" });
    await flushPromises();
    expect(owner.open.value).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });
  it("isolates selected details across thread switches and prevents stale focus restoration", async () => {
    const { wrapper, owner, scope } = host();
    const trigger = wrapper.get("button").element as HTMLButtonElement;
    wrapper
      .getComponent(MessageDetailsMenu)
      .props("entries")[0]!
      .onSelect(trigger);
    await flushPromises();
    owner.close();
    scope.value = "thread-b";
    await flushPromises();
    expect(owner.open.value).toBe(false);
    expect(owner.selectedDetail.value).toBeNull();
    expect(wrapper.find("section").exists()).toBe(false);
  });
  it("does not render a dead menu when the shared details owner is absent", () => {
    const wrapper = mount(SkillUsageMenu, { props: { skills: [snapshot] } });
    cleanup.push(() => wrapper.unmount());
    expect(wrapper.find("button").exists()).toBe(false);
  });
});
