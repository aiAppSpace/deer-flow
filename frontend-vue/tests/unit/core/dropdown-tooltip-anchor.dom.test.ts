import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, expect, it } from "vitest";
import { defineComponent, h } from "vue";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const wrappers: ReturnType<typeof mount>[] = [];
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  document.body.innerHTML = "";
});
function menu(reference?: HTMLElement, initiallyOpen = false) {
  const wrapper = mount(
    defineComponent({
      setup: () => () =>
        h(
          DropdownMenu,
          { defaultOpen: initiallyOpen },
          {
            default: () => [
              h(Tooltip, null, {
                default: () => [
                  h(
                    TooltipTrigger,
                    { asChild: true },
                    {
                      default: () =>
                        h(
                          DropdownMenuTrigger,
                          { asChild: true },
                          {
                            default: () =>
                              h(Button, null, { default: () => "Export" }),
                          },
                        ),
                    },
                  ),
                  h(TooltipContent, null, {
                    default: () => "Export conversation",
                  }),
                ],
              }),
              h(
                DropdownMenuContent,
                { reference },
                {
                  default: () =>
                    h(DropdownMenuItem, null, { default: () => "Markdown" }),
                },
              ),
            ],
          },
        ),
    }),
    { attachTo: document.body },
  );
  wrappers.push(wrapper);
  return wrapper;
}

it("anchors a menu to its actual trigger when a nested tooltip owns the nearest generic Popper root", async () => {
  const wrapper = menu();
  const trigger = wrapper.get("button");
  await trigger.trigger("click");
  await flushPromises();
  const popper = wrapper.findComponent({ name: "PopperContent" });
  expect(popper.exists()).toBe(true);
  expect(popper.props("reference")).toBe(trigger.element);
  expect(trigger.attributes("aria-expanded")).toBe("true");
  await trigger.trigger("click");
  await flushPromises();
  expect(trigger.attributes("aria-expanded")).toBe("false");
  await trigger.trigger("click");
  await flushPromises();
  expect(
    wrapper.findComponent({ name: "PopperContent" }).props("reference"),
  ).toBe(trigger.element);
});

it("preserves a caller's explicit native reference instead of replacing it with the menu trigger", async () => {
  const reference = document.createElement("button");
  document.body.append(reference);
  const wrapper = menu(reference);
  await wrapper.get("button").trigger("click");
  await flushPromises();
  expect(
    wrapper.findComponent({ name: "PopperContent" }).props("reference"),
  ).toBe(reference);
});

it("resolves the real trigger after mount for an initially open composed menu", async () => {
  const wrapper = menu(undefined, true);
  await flushPromises();
  expect(
    wrapper.findComponent({ name: "PopperContent" }).props("reference"),
  ).toBe(wrapper.get("button").element);
});
