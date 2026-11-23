import { mount } from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";
import { describe, expect, it } from "vitest";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

describe("ToggleGroup pressed-state owner", () => {
  it("passes the scheduled-task filter group's small size and spacing to each item", async () => {
    const wrapper = mount(ToggleGroup, {
      props: { type: "single", size: "sm", spacing: 1 },
      slots: {
        default: () =>
          ["a", "b"].map((value) =>
            h(
              ToggleGroupItem,
              {
                value,
                single: true,
                checked: value === "a",
                class: "rounded-full px-2.5",
              },
              () => value,
            ),
          ),
      },
    });
    try {
      for (const button of wrapper.findAll("button")) {
        expect(button.attributes("data-size")).toBe("sm");
        expect(button.attributes("data-spacing")).toBe("1");
        expect(button.classes()).toContain("h-8");
        expect(button.classes()).not.toContain("h-9");
        expect(button.classes()).toContain("rounded-full");
      }
    } finally {
      wrapper.unmount();
    }
  });
  it("reactively applies group appearance before item fallbacks", async () => {
    const wrapper = mount(ToggleGroup, {
      props: { type: "multiple", size: "sm", variant: "outline", spacing: 2 },
      slots: {
        default: () =>
          h(
            ToggleGroupItem,
            { value: "a", size: "lg", variant: "default", spacing: 3 },
            () => "A",
          ),
      },
    });
    try {
      const button = wrapper.get("button");
      expect(button.attributes("data-size")).toBe("sm");
      expect(button.attributes("data-variant")).toBe("outline");
      expect(button.attributes("data-spacing")).toBe("2");
      expect(button.classes()).toContain("border");
      await wrapper.setProps({ size: "lg", variant: "default", spacing: 0 });
      expect(button.attributes("data-size")).toBe("lg");
      expect(button.attributes("data-variant")).toBe("default");
      expect(button.attributes("data-spacing")).toBe("0");
      expect(button.classes()).toContain("h-10");
      expect(button.classes()).not.toContain("border");
    } finally {
      wrapper.unmount();
    }
  });
  it("keeps item appearance when a group omits size and variant", () => {
    const wrapper = mount(ToggleGroup, {
      props: { type: "multiple" },
      slots: {
        default: () =>
          h(
            ToggleGroupItem,
            { value: "a", size: "lg", variant: "outline" },
            () => "A",
          ),
      },
    });
    try {
      const button = wrapper.get("button");
      expect(button.attributes("data-size")).toBe("lg");
      expect(button.attributes("data-variant")).toBe("outline");
      expect(button.classes()).toContain("h-10");
      expect(button.classes()).toContain("border");
    } finally {
      wrapper.unmount();
    }
  });
  it("scopes style inheritance to the nearest group", () => {
    const wrapper = mount(ToggleGroup, {
      props: { type: "multiple", size: "lg", variant: "outline", spacing: 3 },
      slots: {
        default: () => [
          h(ToggleGroupItem, { value: "outer" }, () => "Outer"),
          h(ToggleGroup, { type: "multiple", size: "sm", spacing: 1 }, () =>
            h(ToggleGroupItem, { value: "inner" }, () => "Inner"),
          ),
        ],
      },
    });
    try {
      const [outer, inner] = wrapper.findAll("button");
      expect(outer!.attributes("data-size")).toBe("lg");
      expect(outer!.attributes("data-variant")).toBe("outline");
      expect(outer!.attributes("data-spacing")).toBe("3");
      expect(inner!.attributes("data-size")).toBe("sm");
      expect(inner!.attributes("data-variant")).toBeUndefined();
      expect(inner!.attributes("data-spacing")).toBe("1");
    } finally {
      wrapper.unmount();
    }
  });
  it("keeps actual uncontrolled multiple selection visible to assistive technology", async () => {
    const wrapper = mount(ToggleGroup, {
      props: { type: "multiple", defaultValue: ["a"] },
      slots: {
        default: () => [
          h(ToggleGroupItem, { value: "a" }, () => "A"),
          h(ToggleGroupItem, { value: "b" }, () => "B"),
        ],
      },
    });
    try {
      const [a, b] = wrapper.findAll("button");
      expect(a!.attributes("aria-pressed")).toBe("true");
      expect(b!.attributes("aria-pressed")).toBe("false");
      await b!.trigger("click");
      expect(a!.attributes("aria-pressed")).toBe("true");
      expect(b!.attributes("aria-pressed")).toBe("true");
      await a!.trigger("click");
      expect(a!.attributes("aria-pressed")).toBe("false");
    } finally {
      wrapper.unmount();
    }
  });
  it("does not replace controlled multiple state with an omitted checked prop", async () => {
    const wrapper = mount(ToggleGroup, {
      props: { type: "multiple", modelValue: ["a"] },
      slots: { default: () => h(ToggleGroupItem, { value: "a" }, () => "A") },
    });
    try {
      expect(wrapper.get("button").attributes("aria-pressed")).toBe("true");
      await wrapper.setProps({ modelValue: [] });
      expect(wrapper.get("button").attributes("aria-pressed")).toBe("false");
    } finally {
      wrapper.unmount();
    }
  });
  it("retains the existing product single-radio contract and click updates", async () => {
    const Host = defineComponent({
      setup() {
        const value = ref("a");
        return () =>
          h(
            ToggleGroup,
            {
              type: "single",
              modelValue: value.value,
              "onUpdate:modelValue": (next: unknown) => {
                value.value = next as string;
              },
            },
            () =>
              ["a", "b"].map((item) =>
                h(
                  ToggleGroupItem,
                  { value: item, single: true, checked: value.value === item },
                  () => item,
                ),
              ),
          );
      },
    });
    const wrapper = mount(Host);
    try {
      const [a, b] = wrapper.findAll("button");
      expect(a!.attributes("role")).toBe("radio");
      expect(a!.attributes("aria-checked")).toBe("true");
      expect(a!.attributes("aria-pressed")).toBeUndefined();
      await b!.trigger("click");
      expect(a!.attributes("aria-checked")).toBe("false");
      expect(b!.attributes("aria-checked")).toBe("true");
      expect(b!.attributes("aria-pressed")).toBeUndefined();
    } finally {
      wrapper.unmount();
    }
  });
});
