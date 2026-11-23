import { afterEach, beforeEach, describe, expect, it, rs } from "@rstest/core";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import type { ComponentProps } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

let frames: FrameRequestCallback[];
let reveal: ReturnType<typeof rs.fn>;

function flushFrames() {
  // Also invoke retired callbacks: cancellation alone must not authorize a
  // stale A -> B -> A frame to publish after focus returns to the same node.
  frames.splice(0).forEach((callback) => callback(0));
}

beforeEach(() => {
  frames = [];
  reveal = rs.fn();
  rs.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.push(callback);
    return frames.length;
  });
  rs.stubGlobal("cancelAnimationFrame", rs.fn());
  rs.spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(reveal);
});

afterEach(() => {
  cleanup();
  rs.restoreAllMocks();
  rs.unstubAllGlobals();
});

function mountDialog(props: ComponentProps<typeof DialogContent> = {}) {
  const onClick = rs.fn();
  const mounted = render(
    <Dialog defaultOpen>
      <DialogContent
        onOpenAutoFocus={(event) => event.preventDefault()}
        {...props}
      >
        <DialogTitle>Focus owner</DialogTitle>
        <DialogDescription>
          Native keyboard and pointer controls.
        </DialogDescription>
        <div data-owner-scroll>
          <button onClick={onClick}>A</button>
          <button>B</button>
          <input aria-label="Draft" defaultValue="abcdef" />
        </div>
      </DialogContent>
    </Dialog>,
  );
  const host = document.querySelector<HTMLElement>('[role="dialog"]')!;
  const [a, b] = Array.from(host.querySelectorAll("button"));
  const input = host.querySelector("input")!;
  flushFrames();
  reveal.mockClear();
  return { ...mounted, host, a: a!, b: b!, input, onClick };
}

function overflow(element: HTMLElement, active = true) {
  element.style.overflowY = "auto";
  Object.defineProperties(element, {
    clientHeight: { configurable: true, value: 100 },
    scrollHeight: { configurable: true, value: active ? 300 : 100 },
  });
}

function focus(element: HTMLElement) {
  act(() => element.focus());
}

describe("Dialog host focus reveal owner", () => {
  it("centers the current keyboard target in a genuinely overflowing modal", () => {
    const { host, a } = mountDialog();
    overflow(host);
    focus(a);
    flushFrames();
    expect(reveal).toHaveBeenCalledExactlyOnceWith({ block: "center" });
  });

  it("detects a nested native scrollport and keeps an unoverflowed path nearest", () => {
    const { host, a, b } = mountDialog();
    const scrollport = host.querySelector<HTMLElement>("[data-owner-scroll]")!;
    overflow(scrollport, false);
    focus(a);
    flushFrames();
    expect(reveal).toHaveBeenLastCalledWith({ block: "nearest" });
    overflow(scrollport);
    focus(b);
    flushFrames();
    expect(reveal).toHaveBeenLastCalledWith({ block: "center" });
  });

  it("retires stale A -> B -> A frames even when A is active again", () => {
    const { a, b } = mountDialog();
    focus(a);
    focus(b);
    focus(a);
    flushFrames();
    expect(document.activeElement).toBe(a);
    expect(reveal).toHaveBeenCalledTimes(1);
    expect(reveal.mock.instances[0]).toBe(a);
  });

  it("does not move a mouse-focused button before its click", () => {
    const { a, onClick } = mountDialog();
    fireEvent.pointerDown(a, { pointerType: "mouse" });
    focus(a);
    flushFrames();
    fireEvent.pointerUp(a, { pointerType: "mouse" });
    fireEvent.click(a);
    expect(reveal).not.toHaveBeenCalled();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("preserves pointer input caret and resumes native keyboard reveal", () => {
    const { host, input, b } = mountDialog();
    overflow(host);
    fireEvent.pointerDown(input, { pointerType: "mouse" });
    focus(input);
    input.setSelectionRange(2, 2);
    flushFrames();
    expect(reveal).not.toHaveBeenCalled();
    expect(input.selectionStart).toBe(2);
    fireEvent.keyDown(input, { key: "Tab" });
    focus(b);
    flushFrames();
    expect(reveal).toHaveBeenCalledExactlyOnceWith({ block: "center" });
  });

  it("retires a queued keyboard frame as soon as pointer interaction begins", () => {
    const { a, input } = mountDialog();
    focus(a);
    fireEvent.pointerDown(input, { pointerType: "mouse" });
    flushFrames();
    expect(document.activeElement).toBe(a);
    expect(reveal).not.toHaveBeenCalled();
  });

  it("runs the caller first and honors prevented focus reveal", () => {
    const onFocusCapture = rs.fn((event: React.FocusEvent<HTMLDivElement>) => {
      expect(reveal).not.toHaveBeenCalled();
      event.preventDefault();
    });
    const { a } = mountDialog({ onFocusCapture });
    focus(a);
    flushFrames();
    expect(onFocusCapture).toHaveBeenCalledTimes(1);
    expect(reveal).not.toHaveBeenCalled();
  });

  it("preserves the current B owner when the caller redirects A's focus", () => {
    const mounted = mountDialog({
      onFocusCapture: (event) => {
        if (event.target.textContent === "A")
          (event.target.nextElementSibling as HTMLElement).focus();
      },
    });
    const b = mounted.b;
    focus(mounted.a);
    flushFrames();
    expect(document.activeElement).toBe(b);
    expect(reveal).toHaveBeenCalledTimes(1);
    expect(reveal.mock.instances[0]).toBe(b);
  });

  it("does not reveal when focus leaves, a target is moved, or its host unmounts", () => {
    const { a, b, host, unmount } = mountDialog();
    focus(a);
    act(() => a.blur());
    flushFrames();
    expect(reveal).not.toHaveBeenCalled();
    focus(b);
    document.body.append(b);
    flushFrames();
    expect(reveal).not.toHaveBeenCalled();
    host.append(b);
    focus(a);
    unmount();
    flushFrames();
    expect(reveal).not.toHaveBeenCalled();
  });

  it("isolates a nested portal from the outer dialog's logical React events", () => {
    render(
      <Dialog defaultOpen>
        <DialogContent onOpenAutoFocus={(event) => event.preventDefault()}>
          <DialogTitle>Outer dialog</DialogTitle>
          <DialogDescription>Outer content.</DialogDescription>
          <Dialog defaultOpen>
            <DialogContent onOpenAutoFocus={(event) => event.preventDefault()}>
              <DialogTitle>Inner dialog</DialogTitle>
              <DialogDescription>Inner content.</DialogDescription>
              <button data-nested-target>Nested target</button>
            </DialogContent>
          </Dialog>
        </DialogContent>
      </Dialog>,
    );
    flushFrames();
    reveal.mockClear();
    const target = document.querySelector<HTMLElement>("[data-nested-target]")!;
    focus(target);
    flushFrames();
    expect(reveal).toHaveBeenCalledTimes(1);
    expect(reveal.mock.instances[0]).toBe(target);
  });
});

describe("Dialog document keyboard modality", () => {
  it.each([false, true])(
    "reveals focus after a body Tab (reverse=%s)",
    (shiftKey) => {
      const { a, b } = mountDialog();
      fireEvent.pointerDown(a, { pointerType: "mouse" });
      focus(a);
      flushFrames();
      expect(reveal).not.toHaveBeenCalled();
      // Native FocusScope can restore from a body guard; keydown never crosses the host.
      fireEvent.keyDown(document.body, { key: "Tab", shiftKey });
      focus(b);
      flushFrames();
      expect(reveal).toHaveBeenCalledExactlyOnceWith({ block: "nearest" });
    },
  );
});
