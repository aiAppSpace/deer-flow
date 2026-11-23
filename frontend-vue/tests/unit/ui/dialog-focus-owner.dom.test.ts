import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, ref } from "vue";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

let wrappers: ReturnType<typeof mount>[];
let frames: FrameRequestCallback[];
let reveal = vi.fn<HTMLElement["scrollIntoView"]>();

const flushFrames = () => frames.splice(0).forEach((callback) => callback(0));

beforeEach(() => {
  wrappers = [];
  frames = [];
  reveal = vi.fn();
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.push(callback);
    return frames.length;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(reveal);
});

afterEach(async () => {
  wrappers.forEach((wrapper) => wrapper.unmount());
  await flushPromises();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function mountDialog(attrs: Record<string, unknown> = {}) {
  const onClick = vi.fn();
  const open = ref(true);
  const wrapper = mount(
    defineComponent({
      setup: () => () =>
        h(Dialog, { open: open.value }, () =>
          h(
            DialogContent,
            {
              closeLabel: "Close",
              onOpenAutoFocus: (event: Event) => event.preventDefault(),
              ...attrs,
            },
            () => [
              h(DialogTitle, () => "Focus owner"),
              h(
                DialogDescription,
                () => "Native keyboard and pointer controls.",
              ),
              h("div", { "data-owner-scroll": "" }, [
                h("button", { onClick }, "A"),
                h("button", "B"),
                h("input", { "aria-label": "Draft", value: "abcdef" }),
              ]),
            ],
          ),
        ),
    }),
    { attachTo: document.body },
  );
  wrappers.push(wrapper);
  await flushPromises();
  const host = document.querySelector<HTMLElement>('[role="dialog"]')!;
  const [a, b] = Array.from(host.querySelectorAll("button"));
  const input = host.querySelector("input")!;
  flushFrames();
  reveal.mockClear();
  return { wrapper, host, a: a!, b: b!, input, onClick, open };
}

function overflow(element: HTMLElement, active = true) {
  element.style.overflowY = "auto";
  Object.defineProperties(element, {
    clientHeight: { configurable: true, value: 100 },
    scrollHeight: { configurable: true, value: active ? 300 : 100 },
  });
}

const pointer = (element: HTMLElement) =>
  element.dispatchEvent(
    new PointerEvent("pointerdown", { bubbles: true, pointerType: "mouse" }),
  );

describe("Dialog host focus reveal owner", () => {
  it("centers only a genuinely overflowing native modal path", async () => {
    const { host, a, b } = await mountDialog();
    overflow(host, false);
    a.focus();
    flushFrames();
    expect(reveal).toHaveBeenLastCalledWith({ block: "nearest" });
    overflow(host);
    b.focus();
    flushFrames();
    expect(reveal).toHaveBeenLastCalledWith({ block: "center" });
  });

  it("detects an inner scrollport even when the dialog itself does not overflow", async () => {
    const { host, a } = await mountDialog();
    overflow(host.querySelector<HTMLElement>("[data-owner-scroll]")!);
    a.focus();
    flushFrames();
    expect(reveal).toHaveBeenCalledExactlyOnceWith({ block: "center" });
  });

  it("retires stale A -> B -> A callbacks even when A becomes active again", async () => {
    const { a, b } = await mountDialog();
    a.focus();
    b.focus();
    a.focus();
    flushFrames();
    expect(document.activeElement).toBe(a);
    expect(reveal).toHaveBeenCalledTimes(1);
    expect(reveal.mock.contexts[0]).toBe(a);
  });

  it("does not move a pointer-focused button before its real click handler", async () => {
    const { a, onClick } = await mountDialog();
    pointer(a);
    a.focus();
    flushFrames();
    a.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    a.click();
    expect(reveal).not.toHaveBeenCalled();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("preserves a mouse input caret and resumes keyboard navigation", async () => {
    const { host, input, b } = await mountDialog();
    overflow(host);
    pointer(input);
    input.focus();
    input.setSelectionRange(2, 2);
    flushFrames();
    expect(reveal).not.toHaveBeenCalled();
    expect(input.selectionStart).toBe(2);
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Tab", bubbles: true }),
    );
    b.focus();
    flushFrames();
    expect(reveal).toHaveBeenCalledExactlyOnceWith({ block: "center" });
  });

  it("retires pending keyboard reveal immediately on pointer interaction", async () => {
    const { a, input } = await mountDialog();
    a.focus();
    pointer(input);
    flushFrames();
    expect(document.activeElement).toBe(a);
    expect(reveal).not.toHaveBeenCalled();
  });

  it("runs the supplied listener first and honors a cancelable focus event", async () => {
    const onFocusin = vi.fn((event: FocusEvent) => {
      expect(reveal).not.toHaveBeenCalled();
      event.preventDefault();
    });
    const { a } = await mountDialog({ onFocusin });
    a.focus();
    // Native focusin itself is not cancelable; a caller-dispatched cancelable
    // event must still retire the prior native frame before its handler runs.
    a.dispatchEvent(
      new FocusEvent("focusin", { bubbles: true, cancelable: true }),
    );
    flushFrames();
    expect(onFocusin).toHaveBeenCalledTimes(2);
    expect(reveal).not.toHaveBeenCalled();
  });

  it("preserves current B when the caller redirects A's focus", async () => {
    const mounted = await mountDialog({
      onFocusin: (event: FocusEvent) => {
        const target = event.target as HTMLElement;
        if (target.textContent === "A")
          (target.nextElementSibling as HTMLElement).focus();
      },
    });
    const b = mounted.b;
    mounted.a.focus();
    flushFrames();
    expect(document.activeElement).toBe(b);
    expect(reveal).toHaveBeenCalledTimes(1);
    expect(reveal.mock.contexts[0]).toBe(b);
  });

  it("retires blur, close, and disposed owners", async () => {
    const { a, open, wrapper } = await mountDialog();
    a.focus();
    a.blur();
    flushFrames();
    expect(reveal).not.toHaveBeenCalled();
    a.focus();
    open.value = false;
    await flushPromises();
    flushFrames();
    expect(reveal).not.toHaveBeenCalled();
    open.value = true;
    await flushPromises();
    const target = document.querySelector<HTMLButtonElement>(
      "[data-owner-scroll] button",
    )!;
    target.focus();
    wrapper.unmount();
    flushFrames();
    expect(reveal).not.toHaveBeenCalled();
  });

  it("keeps nested portal focus owned by the inner dialog", async () => {
    const wrapper = mount(
      defineComponent({
        setup: () => () =>
          h(Dialog, { defaultOpen: true }, () =>
            h(
              DialogContent,
              {
                closeLabel: "Outer close",
                onOpenAutoFocus: (event: Event) => event.preventDefault(),
              },
              () => [
                h(DialogTitle, () => "Outer"),
                h(DialogDescription, () => "Outer content"),
                h(Dialog, { defaultOpen: true }, () =>
                  h(
                    DialogContent,
                    {
                      closeLabel: "Inner close",
                      onOpenAutoFocus: (event: Event) => event.preventDefault(),
                    },
                    () => [
                      h(DialogTitle, () => "Inner"),
                      h(DialogDescription, () => "Inner content"),
                      h(
                        "button",
                        { "data-nested-target": "" },
                        "Nested target",
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
      }),
      { attachTo: document.body },
    );
    wrappers.push(wrapper);
    await flushPromises();
    flushFrames();
    reveal.mockClear();
    const target = document.querySelector<HTMLButtonElement>(
      "[data-nested-target]",
    )!;
    target.focus();
    flushFrames();
    expect(reveal).toHaveBeenCalledTimes(1);
    expect(reveal.mock.contexts[0]).toBe(target);
  });
});

describe("Dialog document keyboard modality", () => {
  it.each([false, true])(
    "reveals focus after a body Tab (reverse=%s)",
    async (shiftKey) => {
      const { a, b } = await mountDialog();
      a.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          pointerType: "mouse",
        }),
      );
      a.focus();
      flushFrames();
      expect(reveal).not.toHaveBeenCalled();
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Tab", shiftKey, bubbles: true }),
      );
      b.focus();
      flushFrames();
      expect(reveal).toHaveBeenCalledExactlyOnceWith({ block: "nearest" });
    },
  );
});
