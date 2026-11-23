import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { retainOpenAnchor } from "@/components/ui/popover/retain-open-anchor";

let frames: Map<number, FrameRequestCallback>;
let observers: Array<{
  callback: ResizeObserverCallback;
  targets: Set<Element>;
  stopped: boolean;
}>;
let cleanups: Array<() => void>;
beforeEach(() => {
  frames = new Map();
  observers = [];
  cleanups = [];
  let frameId = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++frameId, callback);
    return frameId;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      readonly record: (typeof observers)[number];
      constructor(callback: ResizeObserverCallback) {
        this.record = { callback, targets: new Set(), stopped: false };
        observers.push(this.record);
      }
      observe(target: Element) {
        this.record.targets.add(target);
      }
      disconnect() {
        this.record.stopped = true;
        this.record.targets.clear();
      }
    },
  );
});
afterEach(() => {
  cleanups.forEach((stop) => stop());
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function flush() {
  const pending = [...frames.values()];
  frames.clear();
  pending.forEach((callback) => callback(0));
}
function fixture() {
  const main = document.createElement("main"),
    reference = document.createElement("button"),
    content = document.createElement("div");
  main.append(reference);
  document.body.append(main, content);
  main.style.overflowY = "auto";
  const rect = (top: number, height: number) =>
    new DOMRect(20, top, 280, height);
  let referenceTop = 900,
    contentTop = 650;
  vi.spyOn(main, "getBoundingClientRect").mockReturnValue(
    new DOMRect(0, 120, 360, 598),
  );
  Object.defineProperties(main, {
    clientHeight: { value: 598 },
    clientWidth: { value: 360 },
  });
  vi.spyOn(reference, "getBoundingClientRect").mockImplementation(() =>
    rect(referenceTop, 64),
  );
  vi.spyOn(content, "getBoundingClientRect").mockImplementation(() =>
    rect(contentTop, 250),
  );
  reference.scrollIntoView = vi.fn();
  cleanups.push(retainOpenAnchor(content, reference));
  return {
    main,
    reference,
    content,
    set: (r: number, c: number) => {
      referenceTop = r;
      contentTop = c;
    },
  };
}
describe("open picker actual reference retention", () => {
  it("reveals the native reference through its clip without moving focus", () => {
    const { reference, main } = fixture();
    const input = document.createElement("input");
    document.body.append(input);
    input.focus();
    flush();
    expect(reference.scrollIntoView).toHaveBeenCalledExactlyOnceWith({
      block: "nearest",
      inline: "nearest",
      behavior: "instant",
    });
    expect(document.activeElement).toBe(input);
    expect(observers.some((observer) => observer.targets.has(main))).toBe(true);
  });
  it("leaves desktop and a visible reference unchanged even if only the picker collides", () => {
    const { reference, set } = fixture();
    set(240, 300);
    flush();
    expect(reference.scrollIntoView).not.toHaveBeenCalled();
    set(240, 900);
    window.dispatchEvent(new Event("resize"));
    flush();
    expect(reference.scrollIntoView).not.toHaveBeenCalled();
  });
  it("reads current ancestor clipping when a breakpoint changes overflow", () => {
    const { main, reference, set } = fixture();
    set(680, 900);
    main.style.overflowY = "visible";
    flush();
    expect(reference.scrollIntoView).not.toHaveBeenCalled();
    main.style.overflowY = "auto";
    window.dispatchEvent(new Event("resize"));
    flush();
    expect(reference.scrollIntoView).toHaveBeenCalledTimes(1);
  });
  it("retires all observers and pending layout work on close or unmount", () => {
    const { reference } = fixture();
    cleanups.splice(0).forEach((stop) => stop());
    flush();
    window.dispatchEvent(new Event("resize"));
    flush();
    expect(reference.scrollIntoView).not.toHaveBeenCalled();
    expect(observers.every((observer) => observer.stopped)).toBe(true);
  });
});
