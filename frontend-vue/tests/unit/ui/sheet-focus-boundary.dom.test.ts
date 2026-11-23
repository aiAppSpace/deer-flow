import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";

const wrappers: VueWrapper[] = [];
afterEach(async () => {
  for (const wrapper of wrappers.splice(0)) wrapper.unmount();
  await flushPromises();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

async function panel(
  initialOpen = true,
  onKeydown?: (event: KeyboardEvent) => void,
  prefocus = false,
) {
  const open = ref(initialOpen);
  const frame = ref(true);
  const extra = ref(false);
  const onOpenAutoFocus = vi.fn();
  const wrapper = mount(
    defineComponent({
      setup: () => () =>
        h(Sheet, { open: open.value }, () => [
          h(
            SheetContent,
            { closeLabel: "Close", onKeydown, onOpenAutoFocus },
            () => [
              h(SheetTitle, () => "Artifact"),
              h(SheetDescription, () => "Artifact preview"),
              h(
                "button",
                {
                  id: "preview",
                  ref: prefocus
                    ? (element) => (element as HTMLElement | null)?.focus()
                    : undefined,
                },
                "Preview",
              ),
              frame.value
                ? h("iframe", {
                    title: "Artifact preview",
                    srcdoc: "<p>Report</p>",
                  })
                : null,
              extra.value ? h("button", { id: "extra" }, "Extra") : null,
            ],
          ),
        ]),
    }),
    { attachTo: document.body },
  );
  wrappers.push(wrapper);
  await flushPromises();
  return { wrapper, open, frame, extra, onOpenAutoFocus };
}

describe("Sheet focus boundary", () => {
  it("creates edges only for actual iframe content and follows dynamic insertion/removal", async () => {
    const { frame } = await panel();
    const host = document.querySelector<HTMLElement>(
      '[data-slot="sheet-content"]',
    )!;
    const edges = () =>
      host.querySelectorAll<HTMLElement>("[data-dialog-focus-sentinel]");
    expect(edges()).toHaveLength(2);
    expect(host.firstElementChild).toBe(edges()[0]);
    expect(host.lastElementChild).toBe(edges()[1]);
    expect(document.querySelectorAll("[data-dialog-focus-guard]")).toHaveLength(
      0,
    );
    frame.value = false;
    await flushPromises();
    expect(edges()).toHaveLength(0);
    frame.value = true;
    await flushPromises();
    expect(edges()).toHaveLength(2);
  });

  it("retains the boundary when initial open content already owns focus", async () => {
    const { onOpenAutoFocus } = await panel(true, undefined, true);
    const host = document.querySelector<HTMLElement>(
      '[data-slot="sheet-content"]',
    )!;
    expect(onOpenAutoFocus).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(host.querySelector("#preview"));
    expect(host.querySelectorAll("[data-dialog-focus-sentinel]")).toHaveLength(
      2,
    );
  });

  it("maintains physical edges when the rendered content changes", async () => {
    const { extra } = await panel();
    extra.value = true;
    await flushPromises();
    const host = document.querySelector<HTMLElement>(
      '[data-slot="sheet-content"]',
    )!;
    const before = document.createElement("button");
    before.textContent = "Inserted before";
    const after = document.createElement("button");
    after.textContent = "Inserted after";
    host.prepend(before);
    host.append(after);
    await flushPromises();
    const edges = host.querySelectorAll<HTMLElement>(
      "[data-dialog-focus-sentinel]",
    );
    expect(edges).toHaveLength(2);
    expect(host.firstElementChild).toBe(edges[0]);
    expect(host.lastElementChild).toBe(edges[1]);
    edges[0]!.focus();
    expect(document.activeElement).toBe(after);
    edges[1]!.focus();
    expect(document.activeElement).toBe(before);
  });

  it.each([
    ["start", '[data-slot="sheet-close"]'],
    ["end", "#preview"],
  ] as const)(
    "wraps the %s edge before FocusScope can retain the sentinel",
    async (edge, selector) => {
      await panel();
      const host = document.querySelector<HTMLElement>(
        '[data-slot="sheet-content"]',
      )!;
      const sentinel = host.querySelector<HTMLElement>(
        `[data-dialog-focus-sentinel="${edge}"]`,
      )!;
      const observed: Element[] = [];
      const listener = (event: FocusEvent) =>
        observed.push(event.target as Element);
      document.addEventListener("focusin", listener);
      try {
        sentinel.focus();
        expect(document.activeElement).toBe(host.querySelector(selector));
        expect(observed).not.toContain(sentinel);
        expect(observed).toContain(host.querySelector(selector));
      } finally {
        document.removeEventListener("focusin", listener);
      }
    },
  );

  it("skips disabled/hidden controls and preserves a caller's real focus redirect", async () => {
    await panel();
    const host = document.querySelector<HTMLElement>(
      '[data-slot="sheet-content"]',
    )!;
    const hidden = document.createElement("button");
    hidden.hidden = true;
    const disabled = document.createElement("button");
    disabled.disabled = true;
    host.prepend(hidden, disabled);
    await flushPromises();
    const preview = host.querySelector<HTMLElement>("#preview")!;
    const close = host.querySelector<HTMLElement>('[data-slot="sheet-close"]')!;
    preview.addEventListener("focus", () => close.focus());
    host
      .querySelector<HTMLElement>('[data-dialog-focus-sentinel="end"]')!
      .focus();
    expect(document.activeElement).toBe(close);
  });

  it("preserves an asChild host and returns an empty visible candidate set to the host", async () => {
    // This fixture needs an inert child browsing context, not navigation.
    const settings = (
      window as unknown as {
        happyDOM: {
          settings: {
            enableIframePageLoading: boolean;
            navigation: { disableChildFrameNavigation: boolean };
          };
        };
      }
    ).happyDOM.settings;
    const previousLoading = settings.enableIframePageLoading;
    const previousNavigation = settings.navigation.disableChildFrameNavigation;
    let mounted: VueWrapper | undefined;
    settings.enableIframePageLoading = true;
    settings.navigation.disableChildFrameNavigation = true;
    try {
      const wrapper = mount(
        defineComponent({
          setup: () => () =>
            h(Dialog, { open: true }, () =>
              h(
                DialogContent,
                { asChild: true, showClose: false, closeLabel: "Close" },
                () =>
                  h("section", { id: "actual-host" }, [
                    h(DialogTitle, () => "Empty"),
                    h(DialogDescription, () => "Hidden preview"),
                    h("iframe", { hidden: true, title: "Hidden report" }),
                  ]),
              ),
            ),
        }),
        { attachTo: document.body },
      );
      mounted = wrapper;
      await flushPromises();
      const host = document.querySelector<HTMLElement>("#actual-host")!;
      expect(host.dataset.slot).toBe("dialog-content");
      const edges = host.querySelectorAll<HTMLElement>(
        "[data-dialog-focus-sentinel]",
      );
      expect(edges).toHaveLength(2);
      edges[0]!.focus();
      expect(document.activeElement).toBe(host);
      edges[1]!.focus();
      expect(document.activeElement).toBe(host);
    } finally {
      mounted?.unmount();
      await flushPromises();
      settings.enableIframePageLoading = previousLoading;
      settings.navigation.disableChildFrameNavigation = previousNavigation;
    }
  });

  it("admits the caller's redirected container entry without overwriting its chosen control", async () => {
    await panel();
    const host = document.querySelector<HTMLElement>(
      '[data-slot="sheet-content"]',
    )!;
    const preview = host.querySelector<HTMLElement>("#preview")!;
    const close = host.querySelector<HTMLElement>('[data-slot="sheet-close"]')!;
    preview.addEventListener("focus", () => close.focus());
    host.focus();
    const event = new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    });
    host.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(close);
  });

  it("continues past an unfocusable candidate instead of accepting the unchanged container", async () => {
    await panel();
    const host = document.querySelector<HTMLElement>(
      '[data-slot="sheet-content"]',
    )!;
    const preview = host.querySelector<HTMLElement>("#preview")!;
    const focus = vi
      .spyOn(preview, "focus")
      .mockImplementation(() => undefined);
    host.focus();
    const event = new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    });
    host.dispatchEvent(event);
    expect(focus).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(host.querySelector("iframe"));
  });

  it("retires stale Sheet A -> B -> A frames while preserving nearest reveal for the actual current control", async () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const reveal = vi.spyOn(HTMLElement.prototype, "scrollIntoView");
    await panel();
    frames.splice(0).forEach((callback) => callback(0));
    reveal.mockClear();
    const host = document.querySelector<HTMLElement>(
      '[data-slot="sheet-content"]',
    )!;
    const a = host.querySelector<HTMLElement>("#preview")!;
    const b = host.querySelector<HTMLElement>('[data-slot="sheet-close"]')!;
    a.focus();
    b.focus();
    a.focus();
    frames.splice(0).forEach((callback) => callback(0));
    expect(document.activeElement).toBe(a);
    expect(reveal).toHaveBeenCalledExactlyOnceWith({ block: "nearest" });
    expect(reveal.mock.contexts[0]).toBe(a);
  });

  it("retires a connected Sheet control's pending reveal on close and unmount", async () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const reveal = vi.spyOn(HTMLElement.prototype, "scrollIntoView");
    const { open, wrapper } = await panel();
    frames.splice(0).forEach((callback) => callback(0));
    reveal.mockClear();
    const host = document.querySelector<HTMLElement>(
      '[data-slot="sheet-content"]',
    )!;
    host.querySelector<HTMLElement>('[data-slot="sheet-close"]')!.focus();
    open.value = false;
    await flushPromises();
    frames.splice(0).forEach((callback) => callback(0));
    expect(reveal).not.toHaveBeenCalled();
    open.value = true;
    await flushPromises();
    frames.splice(0).forEach((callback) => callback(0));
    reveal.mockClear();
    document.querySelector<HTMLElement>('[data-slot="sheet-close"]')!.focus();
    wrapper.unmount();
    wrappers.splice(wrappers.indexOf(wrapper), 1);
    frames.splice(0).forEach((callback) => callback(0));
    expect(reveal).not.toHaveBeenCalled();
  });

  it("retains host-local edges only while content is open", async () => {
    const { open } = await panel(false);
    expect(
      document.querySelectorAll("[data-dialog-focus-sentinel]"),
    ).toHaveLength(0);
    open.value = true;
    await flushPromises();
    expect(
      document.querySelectorAll("[data-dialog-focus-sentinel]"),
    ).toHaveLength(2);
    open.value = false;
    await flushPromises();
    expect(
      document.querySelectorAll("[data-dialog-focus-sentinel]"),
    ).toHaveLength(0);
  });

  it("keeps each host's edges independent and retires only its own pair", async () => {
    const first = await panel();
    const second = await panel();
    expect(
      document.querySelectorAll("[data-dialog-focus-sentinel]"),
    ).toHaveLength(4);
    second.wrapper.unmount();
    wrappers.splice(wrappers.indexOf(second.wrapper), 1);
    await flushPromises();
    expect(
      document.querySelectorAll("[data-dialog-focus-sentinel]"),
    ).toHaveLength(2);
    first.wrapper.unmount();
    wrappers.splice(wrappers.indexOf(first.wrapper), 1);
    await flushPromises();
    expect(
      document.querySelectorAll("[data-dialog-focus-sentinel]"),
    ).toHaveLength(0);
  });

  it.each([
    [false, "#preview"],
    [true, '[data-slot="sheet-close"]'],
  ] as const)(
    "admits Tab from the FocusScope container, reverse=%s",
    async (shiftKey, selector) => {
      await panel();
      const content = document.querySelector<HTMLElement>(
        '[data-slot="sheet-content"]',
      )!;
      content.focus();
      const event = new KeyboardEvent("keydown", {
        key: "Tab",
        shiftKey,
        bubbles: true,
        cancelable: true,
      });
      content.dispatchEvent(event);
      expect(document.activeElement).toBe(content.querySelector(selector));
      expect(event.defaultPrevented).toBe(true);
    },
  );

  it("keeps the caller's prevented Tab and modified Tab unchanged", async () => {
    let prevent = true;
    await panel(true, (event) => {
      if (prevent) event.preventDefault();
    });
    const content = document.querySelector<HTMLElement>(
      '[data-slot="sheet-content"]',
    )!;
    content.focus();
    content.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Tab",
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(document.activeElement).toBe(content);
    prevent = false;
    content.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Tab",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(document.activeElement).toBe(content);
  });
});
