import * as Popover from "@radix-ui/react-popover";
import { afterEach, beforeEach, describe, expect, it, rs } from "@rstest/core";
import { act, cleanup, render, screen } from "@testing-library/react";
import { useState } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useOpenMenuAnchorRetention } from "@/hooks/use-open-menu-anchor-retention";

let observers: Array<{
  callback: ResizeObserverCallback;
  observed: Set<Element>;
  disconnected: boolean;
}>;
let frames: Map<number, FrameRequestCallback>;
let frameId: number;

beforeEach(() => {
  observers = [];
  frames = new Map();
  frameId = 0;
  rs.stubGlobal(
    "ResizeObserver",
    class {
      observed = new Set<Element>();
      disconnected = false;
      constructor(readonly callback: ResizeObserverCallback) {
        observers.push(this);
      }
      observe(element: Element) {
        this.observed.add(element);
      }
      unobserve(element: Element) {
        this.observed.delete(element);
      }
      disconnect() {
        this.disconnected = true;
        this.observed.clear();
      }
    },
  );
  rs.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++frameId, callback);
    return frameId;
  });
  rs.stubGlobal("cancelAnimationFrame", (id: number) => {
    frames.delete(id);
  });
});
afterEach(() => {
  cleanup();
  rs.restoreAllMocks();
  rs.unstubAllGlobals();
});
function flushLayout() {
  act(() => {
    for (const observer of observers)
      if (!observer.disconnected)
        observer.callback([], observer as unknown as ResizeObserver);
    const current = [...frames.values()];
    frames.clear();
    current.forEach((callback) => callback(0));
  });
}
async function mountMenu() {
  const host = render(
    <main style={{ overflowY: "auto" }}>
      <input aria-label="Composer" />
      <DropdownMenu defaultOpen modal={false}>
        <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Inspect</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </main>,
  );
  const trigger = screen.getByRole("button", { name: "Actions" });
  const menu = await screen.findByRole("menu");
  const owner = host.container.querySelector("main")!;
  const reveal = rs.fn();
  trigger.scrollIntoView = reveal;
  let triggerTop = 1300;
  let menuTop = 1050;
  const rect = (top: number, height: number) =>
    new DOMRect(20, top, 280, height);
  rs.spyOn(trigger, "getBoundingClientRect").mockImplementation(() =>
    rect(triggerTop, 64),
  );
  rs.spyOn(menu, "getBoundingClientRect").mockImplementation(() =>
    rect(menuTop, 250),
  );
  rs.spyOn(owner, "getBoundingClientRect").mockReturnValue(
    new DOMRect(0, 120, 360, 598),
  );
  Object.defineProperty(owner, "clientHeight", {
    configurable: true,
    value: 598,
  });
  Object.defineProperty(owner, "clientWidth", {
    configurable: true,
    value: 360,
  });
  return {
    ...host,
    trigger,
    menu,
    owner,
    reveal,
    setRects: (t: number, m: number) => {
      triggerTop = t;
      menuTop = m;
    },
  };
}

describe("open dropdown reference retention", () => {
  it("retains a real Popover reference through its public aria-controls relation", async () => {
    function Picker({ showTrigger = true }: { showTrigger?: boolean }) {
      const [content, setContent] = useState<HTMLDivElement | null>(null);
      useOpenMenuAnchorRetention(content);
      return (
        <Popover.Root defaultOpen>
          {showTrigger ? <Popover.Trigger>Model</Popover.Trigger> : null}
          <Popover.Portal>
            <Popover.Content ref={setContent} aria-label="Models">
              <button>Alpha</button>
              <button>Beta</button>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      );
    }
    const host = render(<Picker />);
    const trigger = screen.getByRole("button", { name: /^Model$/ });
    const content = await screen.findByRole("dialog", { name: "Models" });
    expect(content.hasAttribute("aria-labelledby")).toBe(false);
    expect(trigger.getAttribute("aria-controls")).toBe(content.id);
    const reveal = rs.fn();
    trigger.scrollIntoView = reveal;
    rs.spyOn(trigger, "getBoundingClientRect").mockReturnValue(
      new DOMRect(20, 1300, 280, 64),
    );
    rs.spyOn(content, "getBoundingClientRect").mockReturnValue(
      new DOMRect(20, 1050, 280, 250),
    );
    const callerFocus = screen.getByRole("button", { name: "Beta" });
    callerFocus.focus();
    flushLayout();
    expect(reveal).toHaveBeenCalledExactlyOnceWith({
      block: "nearest",
      inline: "nearest",
      behavior: "instant",
    });
    expect(document.activeElement).toBe(callerFocus);
    host.rerender(<Picker showTrigger={false} />);
    expect(trigger.isConnected).toBe(false);
    flushLayout();
    expect(reveal).toHaveBeenCalledTimes(1);
  });

  it.each(["absent", "mismatched", "ambiguous", "non-trigger"])(
    "does not guess a Popover reference when its public controls relation is %s",
    async (relation) => {
      function Picker() {
        const [content, setContent] = useState<HTMLDivElement | null>(null);
        useOpenMenuAnchorRetention(content);
        return (
          <>
            <button
              aria-haspopup={relation === "non-trigger" ? undefined : "dialog"}
              aria-controls={
                relation === "absent"
                  ? undefined
                  : relation === "mismatched"
                    ? "different-picker"
                    : "ambiguous-picker"
              }
            >
              First
            </button>
            {relation === "ambiguous" ? (
              <button aria-haspopup="dialog" aria-controls="ambiguous-picker">
                Second
              </button>
            ) : null}
            <div ref={setContent} id="ambiguous-picker" data-state="open" />
          </>
        );
      }
      render(<Picker />);
      const first = screen.getByRole("button", { name: "First" });
      const reveal = rs.fn();
      first.scrollIntoView = reveal;
      flushLayout();
      expect(observers).toHaveLength(0);
      expect(reveal).not.toHaveBeenCalled();
    },
  );

  it("reveals the actual reference after layout detaches both it and the portaled menu without changing focus", async () => {
    const { trigger, menu, reveal } = await mountMenu();
    const composer = screen.getByRole("textbox", { name: "Composer" });
    composer.focus();
    flushLayout();
    expect(reveal).toHaveBeenCalledExactlyOnceWith({
      block: "nearest",
      inline: "nearest",
      behavior: "instant",
    });
    expect(document.activeElement).toBe(composer);
    expect(menu.getAttribute("data-state")).toBe("open");
    expect(menu.getAttribute("aria-labelledby")).toBe(trigger.id);
  });

  it("retains normal layout and does not reveal an already visible reference merely because its menu collides", async () => {
    const { reveal, setRects } = await mountMenu();
    setRects(240, 300);
    flushLayout();
    expect(reveal).not.toHaveBeenCalled();
    setRects(240, 1050);
    flushLayout();
    expect(reveal).not.toHaveBeenCalled();
  });

  it("uses the reference's real clipping owner when the reference is inside the window but outside its scrollport", async () => {
    const { reveal, setRects } = await mountMenu();
    setRects(680, 1050);
    flushLayout();
    expect(reveal).toHaveBeenCalledTimes(1);
  });

  it("retires layout subscriptions when a force-mounted menu closes", async () => {
    const { menu, reveal, owner } = await mountMenu();
    await act(async () => {
      menu.dataset.state = "closed";
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    flushLayout();
    expect(reveal).not.toHaveBeenCalled();
    expect(observers.some((observer) => observer.observed.has(owner))).toBe(
      false,
    );
  });

  it("cancels pending layout work and disconnects reference observers when the menu owner unmounts", async () => {
    const { unmount, reveal, owner } = await mountMenu();
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    unmount();
    flushLayout();
    expect(reveal).not.toHaveBeenCalled();
    expect(observers.some((observer) => observer.observed.has(owner))).toBe(
      false,
    );
  });
});
