import { afterEach, describe, expect, it } from "@rstest/core";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import type { ComponentProps } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

afterEach(cleanup);

function setup(props: ComponentProps<typeof DialogContent> = {}) {
  render(
    <Dialog defaultOpen>
      <DialogContent showCloseButton={false} {...props}>
        <DialogTitle>Scope</DialogTitle>
        <DialogDescription>Programmatic entry</DialogDescription>
        <h2 tabIndex={-1} data-entry="before">
          Before
        </h2>
        <button>First</button>
        <h2 tabIndex={-1} data-entry="middle">
          Middle
        </h2>
        <button>Last</button>
        <p tabIndex={-1} data-entry="after">
          After
        </p>
      </DialogContent>
    </Dialog>,
  );
}
function press(position: string, init: KeyboardEventInit = {}) {
  const target = document.querySelector<HTMLElement>(
    `[data-entry="${position}"]`,
  )!;
  act(() => target.focus());
  const event = new KeyboardEvent("keydown", {
    key: "Tab",
    bubbles: true,
    cancelable: true,
    ...init,
  });
  fireEvent(target, event);
  return { target, event };
}

describe("programmatic modal entry", () => {
  it.each([
    ["before", true, "Last"],
    ["after", false, "First"],
  ] as const)(
    "wraps from %s only across the real edge",
    (position, shiftKey, name) => {
      setup();
      const { event } = press(position, { shiftKey });
      expect(event.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(screen.getByRole("button", { name }));
    },
  );
  it.each([
    ["before", false],
    ["after", true],
    ["middle", false],
    ["middle", true],
  ] as const)(
    "leaves ordinary native navigation from %s reverse=%s intact",
    (position, shiftKey) => {
      setup();
      const { target, event } = press(position, { shiftKey });
      expect(event.defaultPrevented).toBe(false);
      expect(document.activeElement).toBe(target);
    },
  );
  it("honors the caller's canceled Tab", () => {
    setup({ onKeyDown: (event) => event.preventDefault() });
    const { target } = press("before", { shiftKey: true });
    expect(document.activeElement).toBe(target);
  });
  it("leaves modified Tab and editable negative stops to their owners", () => {
    setup();
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
