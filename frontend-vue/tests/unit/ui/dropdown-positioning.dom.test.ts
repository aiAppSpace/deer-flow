import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const cleanup: (() => void)[] = [];
afterEach(() => {
  cleanup.splice(0).forEach((dispose) => dispose());
  document.body.innerHTML = "";
});

describe("native dropdown collision owner", () => {
  it("retains Tab in a non-modal submenu's own native owner", async () => {
    const wrapper = mount(
      defineComponent({
        setup: () => () =>
          h(DropdownMenu, { defaultOpen: true, modal: false }, () => [
            h(DropdownMenuTrigger, null, () => "Thread actions"),
            h(DropdownMenuContent, null, () => [
              h(DropdownMenuSub, null, () => [
                h(DropdownMenuSubTrigger, null, () => "Export"),
                h(DropdownMenuSubContent, null, () =>
                  h(DropdownMenuItem, null, () => "Markdown"),
                ),
              ]),
            ]),
          ]),
      }),
      { attachTo: document.body },
    );
    cleanup.push(() => wrapper.unmount());
    await flushPromises();
    document
      .querySelector<HTMLElement>('[data-slot="dropdown-menu-sub-trigger"]')!
      .click();
    await flushPromises();
    const item = document.querySelector<HTMLElement>(
      '[data-slot="dropdown-menu-sub-content"] [role="menuitem"]',
    )!;
    expect(item).not.toBeNull();
    item.focus();
    for (const shiftKey of [false, true]) {
      const tab = new KeyboardEvent("keydown", {
        key: "Tab",
        shiftKey,
        bubbles: true,
        cancelable: true,
      });
      item.dispatchEvent(tab);
      expect(tab.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(item);
    }
  });

  it.each([false, true])(
    "uses the same native menu Tab boundary for modal=%s, preserving arrows and Escape",
    async (modal) => {
      const openChanged = vi.fn();
      const wrapper = mount(
        defineComponent({
          setup: () => () =>
            h(
              DropdownMenu,
              { defaultOpen: true, modal, "onUpdate:open": openChanged },
              () => [
                h(DropdownMenuTrigger, null, () => "Skills"),
                h(DropdownMenuContent, null, () => [
                  h(
                    DropdownMenuItem,
                    { textValue: "First skill" },
                    () => "First skill",
                  ),
                  h(
                    DropdownMenuItem,
                    { textValue: "Second skill" },
                    () => "Second skill",
                  ),
                ]),
              ],
            ),
        }),
        { attachTo: document.body },
      );
      cleanup.push(() => wrapper.unmount());
      await flushPromises();
      const content = document.querySelector<HTMLElement>('[role="menu"]')!;
      const items = [
        ...document.querySelectorAll<HTMLElement>('[role="menuitem"]'),
      ];
      for (const origin of [content, items[0]!]) {
        origin.focus();
        for (const shiftKey of [false, true]) {
          const tab = new KeyboardEvent("keydown", {
            key: "Tab",
            shiftKey,
            bubbles: true,
            cancelable: true,
          });
          origin.dispatchEvent(tab);
          expect(tab.defaultPrevented).toBe(true);
          expect(document.activeElement).toBe(origin);
          expect(content.isConnected).toBe(true);
        }
        const character = new KeyboardEvent("keydown", {
          key: "s",
          bubbles: true,
          cancelable: true,
        });
        origin.dispatchEvent(character);
        expect(character.defaultPrevented).toBe(false);
      }
      items[0]!.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowDown",
          bubbles: true,
          cancelable: true,
        }),
      );
      await flushPromises();
      expect(document.activeElement).toBe(items[1]);
      items[1]!.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
          cancelable: true,
        }),
      );
      await flushPromises();
      expect(openChanged).toHaveBeenCalledWith(false);
    },
  );

  it("keeps native outside-focus dismissal for non-modal menus", async () => {
    const openChanged = vi.fn();
    const wrapper = mount(
      defineComponent({
        setup: () => () =>
          h(
            DropdownMenu,
            { defaultOpen: true, modal: false, "onUpdate:open": openChanged },
            () => [
              h(DropdownMenuTrigger, null, () => "Skills"),
              h(DropdownMenuContent, null, () =>
                h(DropdownMenuItem, null, () => "First skill"),
              ),
            ],
          ),
      }),
      { attachTo: document.body },
    );
    cleanup.push(() => wrapper.unmount());
    await flushPromises();
    const item = document.querySelector<HTMLElement>('[role="menuitem"]')!;
    item.focus();
    const outside = document.createElement("button");
    outside.textContent = "Outside";
    document.body.append(outside);
    outside.focus();
    await flushPromises();
    expect(openChanged).toHaveBeenCalledWith(false);
    expect(document.activeElement).toBe(outside);
  });

  it("delegates both-axis collision and moving-anchor updates to the real Popper while preserving keyboard selection", async () => {
    const wrapper = mount(
      defineComponent({
        setup: () => () =>
          h(DropdownMenu, { open: true, modal: false }, () => [
            h(DropdownMenuTrigger, null, () => "Skills"),
            h(DropdownMenuContent, { side: "top" }, () => [
              h(
                DropdownMenuItem,
                { textValue: "First skill" },
                () => "First skill",
              ),
              h(
                DropdownMenuItem,
                { textValue: "Second skill" },
                () => "Second skill",
              ),
            ]),
          ]),
      }),
      { attachTo: document.body },
    );
    cleanup.push(() => wrapper.unmount());
    await flushPromises();
    const popper = wrapper.findComponent({ name: "PopperContent" });
    expect(popper.exists()).toBe(true);
    expect(popper.props("prioritizePosition")).toBe(true);
    expect(popper.props("updatePositionStrategy")).toBe("optimized");
    expect(popper.props("sticky")).toBe("always");
    const items = [
      ...document.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    ];
    expect(items.map((item) => item.textContent)).toEqual([
      "First skill",
      "Second skill",
    ]);
    items[0]!.focus();
    items[0]!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
    await flushPromises();
    expect(document.activeElement).toBe(items[1]);
    for (const element of document.querySelectorAll<HTMLElement>(
      "[data-reka-popper-content-wrapper]",
    ))
      expect(element.style.getPropertyValue("translate")).toBe("");
  });
});
