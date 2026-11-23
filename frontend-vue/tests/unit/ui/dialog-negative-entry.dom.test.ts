import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import { afterEach, describe, expect, it } from "vitest";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

const wrappers: VueWrapper[] = [];
afterEach(async () => {
  for (const wrapper of wrappers.splice(0)) wrapper.unmount();
  await flushPromises();
  document.body.innerHTML = "";
});
async function setup(onKeydown?: (event: KeyboardEvent) => void) {
  const wrapper = mount(
    defineComponent({
      setup: () => () =>
        h(Dialog, { defaultOpen: true }, () =>
          h(
            DialogContent,
            { closeLabel: "Close", showClose: false, onKeydown },
            () => [
              h(DialogTitle, () => "Scope"),
              h(DialogDescription, () => "Programmatic entry"),
              h("h2", { tabindex: -1, "data-entry": "before" }, "Before"),
              h("button", "First"),
              h("h2", { tabindex: -1, "data-entry": "middle" }, "Middle"),
              h("button", "Last"),
              h("p", { tabindex: -1, "data-entry": "after" }, "After"),
            ],
          ),
        ),
    }),
    { attachTo: document.body },
  );
  wrappers.push(wrapper);
  await flushPromises();
}
function press(position: string, init: KeyboardEventInit = {}) {
  const target = document.querySelector<HTMLElement>(
    `[data-entry="${position}"]`,
  )!;
  target.focus();
  const event = new KeyboardEvent("keydown", {
    key: "Tab",
    bubbles: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(event);
  return { target, event };
}

describe("programmatic modal entry", () => {
  it.each([
    ["before", true, "Last"],
    ["after", false, "First"],
  ] as const)(
    "wraps from %s only across the real edge",
    async (position, shiftKey, name) => {
      await setup();
      const { event } = press(position, { shiftKey });
      expect(event.defaultPrevented).toBe(true);
      expect(document.activeElement?.textContent).toBe(name);
    },
  );
  it.each([
    ["before", false],
    ["after", true],
    ["middle", false],
    ["middle", true],
  ] as const)(
    "leaves ordinary native navigation from %s reverse=%s intact",
    async (position, shiftKey) => {
      await setup();
      const { target, event } = press(position, { shiftKey });
      expect(event.defaultPrevented).toBe(false);
      expect(document.activeElement).toBe(target);
    },
  );
  it("honors the caller's canceled Tab", async () => {
    await setup((event) => event.preventDefault());
    const { target } = press("before", { shiftKey: true });
    expect(document.activeElement).toBe(target);
  });
  it("leaves modified Tab and editable negative stops to their owners", async () => {
    await setup();
    const { target, event } = press("before", {
      shiftKey: true,
      ctrlKey: true,
    });
    expect(event.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(target);
    target.contentEditable = "true";
    expect(press("before", { shiftKey: true }).event.defaultPrevented).toBe(
      false,
    );
  });
});
