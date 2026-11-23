import { afterEach, beforeEach, describe, expect, it, rs } from "@rstest/core";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";

let frames: FrameRequestCallback[];
let reveal: ReturnType<typeof rs.fn>;

beforeEach(() => {
  frames = [];
  rs.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.push(callback);
    return frames.length;
  });
  rs.stubGlobal("cancelAnimationFrame", rs.fn());
  reveal = rs.fn();
  rs.spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(reveal);
});

afterEach(() => {
  cleanup();
  rs.restoreAllMocks();
  rs.unstubAllGlobals();
});

function flush() {
  // Invoke retired callbacks too: a stale callback must reject its old owner.
  frames.splice(0).forEach((callback) => callback(0));
}

function mountSheet(props: ComponentProps<typeof SheetContent> = {}) {
  const mounted = render(
    <Sheet defaultOpen>
      <SheetContent
        onOpenAutoFocus={(event) => event.preventDefault()}
        {...props}
      >
        <SheetTitle>Artifacts</SheetTitle>
        <SheetDescription>Artifact controls.</SheetDescription>
        <button>A</button>
        <button>B</button>
        <Dialog>
          <DialogTrigger>Open inner</DialogTrigger>
          <DialogContent onOpenAutoFocus={(event) => event.preventDefault()}>
            <DialogTitle>Inner</DialogTitle>
            <DialogDescription>Inner controls.</DialogDescription>
            <button>Inner target</button>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>,
  );
  flush();
  reveal.mockClear();
  return mounted;
}

describe("Sheet native focus reveal owner", () => {
  it("reveals its current control with the existing nearest behavior", () => {
    mountSheet();
    const button = screen.getByRole("button", { name: "A" });
    act(() => button.focus());
    flush();
    expect(reveal).toHaveBeenCalledExactlyOnceWith({ block: "nearest" });
    expect(reveal.mock.instances[0]).toBe(button);
  });

  it("retires stale A to B to A callbacks", () => {
    mountSheet();
    const a = screen.getByRole("button", { name: "A" });
    const b = screen.getByRole("button", { name: "B" });
    act(() => {
      a.focus();
      b.focus();
      a.focus();
    });
    flush();
    expect(reveal).toHaveBeenCalledTimes(1);
    expect(reveal.mock.instances[0]).toBe(a);
  });

  it("leaves a nested portal's focus reveal to its physical Dialog host", () => {
    mountSheet();
    fireEvent.click(screen.getByRole("button", { name: "Open inner" }));
    flush();
    reveal.mockClear();
    const inner = screen.getByRole("button", { name: "Inner target" });
    act(() => inner.focus());
    flush();
    expect(reveal).toHaveBeenCalledExactlyOnceWith({ block: "nearest" });
    expect(reveal.mock.instances[0]).toBe(inner);
  });

  it("retires pending work on unmount", () => {
    const mounted = mountSheet();
    act(() => screen.getByRole("button", { name: "A" }).focus());
    mounted.unmount();
    flush();
    expect(reveal).not.toHaveBeenCalled();
  });

  it("honors the caller's prevented focus reveal", () => {
    mountSheet({ onFocusCapture: (event) => event.preventDefault() });
    act(() => screen.getByRole("button", { name: "A" }).focus());
    flush();
    expect(reveal).not.toHaveBeenCalled();
  });
});
