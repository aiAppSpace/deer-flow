import { afterEach, describe, expect, it, rs } from "@rstest/core";
import { act, cleanup, render, screen } from "@testing-library/react";
import { toast } from "sonner";

rs.mock("next-themes", () => ({ useTheme: () => ({ theme: "light" }) }));
import { Toaster } from "@/components/ui/sonner";

afterEach(() => {
  cleanup();
  toast.dismiss();
  rs.restoreAllMocks();
  document.body.innerHTML = "";
});

async function setup(withAction = false, shortcut = true) {
  const entry = document.createElement("button");
  const other = document.createElement("button");
  document.body.append(entry, other);
  const wrapper = render(<Toaster />);
  act(() => {
    toast.success("Saved notice", {
      duration: 60_000,
      ...(withAction
        ? { action: { label: "Undo", onClick: () => undefined } }
        : {}),
    });
  });
  const text = await screen.findByText("Saved notice");
  const item = text.closest("li")!;
  const list = item.closest("ol")!;
  const action = item.querySelector("button");
  act(() => {
    entry.focus();
    if (shortcut)
      entry.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "t",
          code: "KeyT",
          altKey: true,
          bubbles: true,
        }),
      );
    item.focus();
  });
  return { entry, other, item, list, action, dispose: () => wrapper.unmount() };
}

function key(target: HTMLElement, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent("keydown", {
    key: "Tab",
    code: "Tab",
    bubbles: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}

describe("notification keyboard boundary", () => {
  it("leaves ordinary Tab and outside focus native, without stealing the destination", async () => {
    const { entry, other, item } = await setup(false, false);
    const restore = rs.spyOn(entry, "focus");
    expect(key(item).defaultPrevented).toBe(false);
    other.focus();
    expect(document.activeElement).toBe(other);
    expect(restore).not.toHaveBeenCalled();
  });

  it("retires the return owner after ordinary navigation has left", async () => {
    const { entry, other, dispose } = await setup(false, false);
    other.focus();
    const restore = rs.spyOn(entry, "focus");
    dispose();
    expect(document.activeElement).toBe(other);
    expect(restore).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    "retires a blurred notification entry before unmount (shortcut=%s)",
    async (shortcut) => {
      const { entry, item, dispose } = await setup(false, shortcut);
      act(() => item.blur());
      expect(document.activeElement).toBe(document.body);
      const restore = rs.spyOn(entry, "focus");
      dispose();
      expect(document.activeElement).toBe(document.body);
      expect(restore).not.toHaveBeenCalled();
    },
  );

  it("restores ordinary entry when the focused notification itself unmounts", async () => {
    const { entry, dispose } = await setup(false, false);
    dispose();
    expect(document.activeElement).toBe(entry);
  });

  it("cancels native browser departure and restores the connected entry", async () => {
    const { entry, item } = await setup();
    expect(key(item).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(entry);
  });

  it("returns from the first notification and its negative list entry on reverse Tab", async () => {
    const { entry, item, list } = await setup();
    expect(key(item, { shiftKey: true }).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(entry);
    entry.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "t",
        code: "KeyT",
        altKey: true,
        bubbles: true,
      }),
    );
    expect(document.activeElement).toBe(list);
    expect(key(list, { shiftKey: true }).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(entry);
  });

  it("leaves internal action traversal native and returns only after the last action", async () => {
    const { entry, item, action } = await setup(true);
    expect(key(item).defaultPrevented).toBe(false);
    action!.focus();
    expect(key(action!, { shiftKey: true }).defaultPrevented).toBe(false);
    expect(key(action!).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(entry);
  });

  it("respects an action handler that already cancelled its key", async () => {
    const { item } = await setup();
    item.addEventListener("keydown", (event) => event.preventDefault(), {
      once: true,
    });
    expect(key(item).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(item);
  });

  it("does not intercept modified keys or unrelated controls", async () => {
    const { item, other } = await setup();
    for (const init of [
      { altKey: true },
      { ctrlKey: true },
      { metaKey: true },
      { key: "Enter", code: "Enter" },
    ]) {
      expect(key(item, init).defaultPrevented).toBe(false);
      expect(document.activeElement).toBe(item);
    }
    other.focus();
    expect(key(other).defaultPrevented).toBe(false);
  });

  it("ignores hidden, disabled and inert descendants at the actual boundary", async () => {
    const { entry, item } = await setup();
    for (const attr of ["hidden", "disabled", "inert"]) {
      const button = document.createElement("button");
      button.setAttribute(attr, "");
      item.append(button);
    }
    expect(key(item).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(entry);
  });

  it("does not claim return to a disconnected entry", async () => {
    const { entry, item } = await setup();
    entry.remove();
    expect(key(item).defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(item);
  });

  it("retires keyboard ownership when the toaster unmounts", async () => {
    const { entry, item, dispose } = await setup();
    dispose();
    expect(document.activeElement).toBe(entry);
    document.body.append(item);
    item.focus();
    expect(key(item).defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(item);
  });
});
