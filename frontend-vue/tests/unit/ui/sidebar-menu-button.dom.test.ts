import { mount } from "@vue/test-utils";
import { h } from "vue";
import { afterEach, expect, it, vi } from "vitest";
import SidebarMenuButton from "@/components/ui/sidebar/SidebarMenuButton.vue";

afterEach(() => document.body.replaceChildren());

for (const tooltip of [undefined, "Details"]) {
  for (const asChild of [false, true]) {
    it(`forwards caller attributes and one click to the actual ${asChild ? "link" : "button"} with tooltip=${Boolean(tooltip)}`, async () => {
      const click = vi.fn();
      const wrapper = mount(SidebarMenuButton, {
        attachTo: document.body,
        props: { asChild, tooltip, class: "test-caller-class" },
        attrs: {
          id: "caller-menu",
          "aria-label": "Caller menu",
          title: "Caller title",
          "data-caller": "present",
          onClick: click,
        },
        slots: {
          default: () =>
            asChild ? h("a", { href: "#menu" }, "Menu") : h("span", "Menu"),
        },
      });
      try {
        const target = wrapper.get(asChild ? "a" : "button");
        expect(target.attributes("id")).toBe("caller-menu");
        expect(target.attributes("aria-label")).toBe("Caller menu");
        expect(target.attributes("title")).toBe("Caller title");
        expect(target.attributes("data-caller")).toBe("present");
        expect(target.classes()).toContain("test-caller-class");
        await target.trigger("click");
        expect(click).toHaveBeenCalledTimes(1);
      } finally {
        wrapper.unmount();
      }
    });
  }
}

it("keeps the outer trigger identity on the actual unwrapped button", () => {
  const wrapper = mount(SidebarMenuButton, {
    attrs: {
      "data-slot": "dropdown-menu-trigger",
      disabled: true,
      type: "button",
    },
    slots: { default: "Account" },
  });
  try {
    const button = wrapper.get("button");
    expect(button.attributes("data-slot")).toBe("dropdown-menu-trigger");
    expect(button.element.disabled).toBe(true);
    expect(button.attributes("type")).toBe("button");
  } finally {
    wrapper.unmount();
  }
});
