import { flushPromises, mount } from "@vue/test-utils";
import { ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PluginIconPicker from "@/components/workspace/capabilities/PluginIconPicker.vue";
import PluginIcon from "@/components/workspace/capabilities/PluginIcon.vue";
import { enUS } from "@/core/i18n/locales/en-US";
const transform = vi.hoisted(() => vi.fn());
vi.mock("@/core/mcp/icon", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  preparePluginIcon: transform,
}));
beforeEach(() => {
  transform.mockReset();
  vi.stubGlobal("useNuxtApp", () => ({ $i18n: { t: ref(enUS) } }));
});
afterEach(() => vi.unstubAllGlobals());
async function upload(wrapper: ReturnType<typeof mount>) {
  const input = wrapper.get<HTMLInputElement>('input[type="file"]');
  Object.defineProperty(input.element, "files", {
    configurable: true,
    value: [new File(["image"], "icon.png", { type: "image/png" })],
  });
  await input.trigger("change");
}
describe("plugin icon editor", () => {
  it("shows current React preview and controls, blocks duplicate upload and lets Reset retire pending conversion", async () => {
    let resolve!: (value: string) => void;
    transform.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const wrapper = mount(PluginIconPicker, {
      props: { name: "Example", modelValue: null },
    });
    expect(wrapper.text()).toContain(enUS.capabilities.icon.title);
    expect(wrapper.findAll("button")).toHaveLength(3);
    const input = wrapper.get<HTMLInputElement>('input[type="file"]');
    const click = vi.spyOn(input.element, "click");
    await wrapper.get("button[aria-label]").trigger("click");
    expect(click).toHaveBeenCalled();
    await upload(wrapper);
    await upload(wrapper);
    expect(transform).toHaveBeenCalledTimes(1);
    expect(
      wrapper.get("button[aria-label]").attributes("disabled"),
    ).toBeDefined();
    await wrapper
      .findAll("button")
      .find((button) => button.text() === enUS.capabilities.icon.reset)!
      .trigger("click");
    resolve("data:image/png;base64,old");
    await flushPromises();
    expect(wrapper.emitted("update:modelValue")).toEqual([[null]]);
    expect(wrapper.emitted("busy")?.at(-1)).toEqual([false]);
    wrapper.unmount();
  });
  it("keeps both preview and upload disabled when the whole form is disabled", async () => {
    const wrapper = mount(PluginIconPicker, {
      props: { name: "Example", modelValue: null, disabled: true },
    });
    expect(
      wrapper
        .findAll("button")
        .every((button) => button.attributes("disabled") !== undefined),
    ).toBe(true);
    await upload(wrapper);
    expect(transform).not.toHaveBeenCalled();
    wrapper.unmount();
  });
  it("merges preview dimensions so size-16 replaces the default size-12", () => {
    const wrapper = mount(PluginIcon, {
      props: {
        name: "Example",
        icon: "data:image/png;base64,aGVsbG8=",
        class: "size-16",
      },
    });
    expect(wrapper.classes()).toContain("size-16");
    expect(wrapper.classes()).not.toContain("size-12");
    wrapper.unmount();
  });
});
