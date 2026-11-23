import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";
import type { Window as HappyWindow } from "happy-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { provideFocusReveal } from "@/components/ui/scroll-area/focus-reveal";
import {
  Popover,
  PopoverPickerContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const wrappers: VueWrapper[] = [];
afterEach(async () => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  await flushPromises();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

async function setup(foreign = false) {
  const viewport = ref<HTMLElement | null>(null);
  const open = ref(true);
  let owner: ReturnType<typeof provideFocusReveal>;
  const picker = () =>
    h(Popover, { open: open.value }, () => [
      h(PopoverTrigger, { asChild: true }, () =>
        h("button", { id: "trigger" }, "Models"),
      ),
      h(PopoverPickerContent, { "aria-label": "Models" }, () => [
        h("button", { id: "first" }, "First model"),
        h("button", { id: "last" }, "Last model"),
      ]),
    ]);
  const wrapper = mount(
    defineComponent({
      setup() {
        owner = provideFocusReveal(viewport);
        return () =>
          h("section", [
            h(
              "main",
              {
                ref: viewport,
                onFocusin: owner.reveal,
                onFocusout: owner.retire,
              },
              [
                h("button", { id: "local" }, "Local"),
                foreign ? null : picker(),
              ],
            ),
            foreign ? picker() : null,
          ]);
      },
    }),
    { attachTo: document.body },
  );
  wrappers.push(wrapper);
  await flushPromises();
  const first = document.querySelector<HTMLButtonElement>("#first")!;
  const last = document.querySelector<HTMLButtonElement>("#last")!;
  const local = document.querySelector<HTMLButtonElement>("#local")!;
  const trigger = document.querySelector<HTMLButtonElement>("#trigger")!;
  expect(first).not.toBeNull();
  expect(viewport.value!.contains(first)).toBe(false);
  const frames: FrameRequestCallback[] = [];
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    frames.push(callback);
    return frames.length;
  });
  // Execute canceled callbacks too: revision guards must retire work even then.
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  for (const button of [first, last, local, trigger])
    button.scrollIntoView = vi.fn();
  return {
    wrapper,
    viewport,
    open,
    owner: owner!,
    first,
    last,
    local,
    trigger,
    flush: () => frames.splice(0).forEach((callback) => callback(0)),
  };
}

describe("chat viewport physical and portaled focus ownership", () => {
  it.each(["nearest", "center"] as const)(
    "reveals actual Teleport focus with %s alignment",
    async (block) => {
      const state = await setup();
      if (block === "center") state.viewport.value!.style.overflowY = "auto";
      state.last.focus({ preventScroll: true });
      state.flush();
      expect(state.last.scrollIntoView).toHaveBeenCalledExactlyOnceWith({
        block,
      });
    },
  );

  it("preserves physical main focus reveal", async () => {
    const state = await setup();
    state.local.focus();
    state.flush();
    expect(state.local.scrollIntoView).toHaveBeenCalledExactlyOnceWith({
      block: "nearest",
    });
  });

  it("retires A to B to A work across the actual portal", async () => {
    const state = await setup();
    state.last.focus();
    state.first.focus();
    state.last.focus();
    state.flush();
    expect(state.first.scrollIntoView).not.toHaveBeenCalled();
    expect(state.last.scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it("returns ownership to the actual trigger after closing", async () => {
    const state = await setup();
    state.last.focus();
    state.open.value = false;
    await flushPromises();
    state.trigger.focus();
    state.flush();
    expect(state.last.scrollIntoView).not.toHaveBeenCalled();
    expect(state.trigger.scrollIntoView).toHaveBeenCalledExactlyOnceWith({
      block: "nearest",
    });
  });

  it("retires pending work on unmount", async () => {
    const state = await setup();
    state.last.focus();
    state.wrapper.unmount();
    state.flush();
    expect(state.last.scrollIntoView).not.toHaveBeenCalled();
  });

  it("does not claim a portal whose trigger belongs to another physical viewport", async () => {
    const state = await setup(true);
    state.last.focus();
    state.flush();
    expect(state.last.scrollIntoView).not.toHaveBeenCalled();
  });

  it("retires focus after leaving the owning subtree", async () => {
    const state = await setup();
    const outside = document.createElement("button");
    document.body.append(outside);
    state.last.focus();
    outside.focus();
    state.flush();
    expect(state.last.scrollIntoView).not.toHaveBeenCalled();
  });

  it("honors a prevented event and retires older work for that target", async () => {
    const state = await setup();
    state.last.focus();
    const event = new FocusEvent("focusin", { cancelable: true });
    Object.defineProperty(event, "target", { value: state.last });
    event.preventDefault();
    state.owner.reveal(event, state.trigger);
    state.flush();
    expect(state.last.scrollIntoView).not.toHaveBeenCalled();
  });

  it("rejects callbacks after the physical viewport owner changes", async () => {
    const state = await setup();
    state.last.focus();
    state.viewport.value = null;
    state.flush();
    expect(state.last.scrollIntoView).not.toHaveBeenCalled();
  });

  it("uses the owning document's element, animation frame and active focus", async () => {
    // Happy DOM 21 disables iframe documents by default. This test owns only
    // a local about:blank frame and restores that setting after the assertion.
    const settings = (window as unknown as HappyWindow).happyDOM.settings;
    const wasEnabled = settings.enableIframePageLoading;
    settings.enableIframePageLoading = true;
    try {
      const iframe = document.createElement("iframe");
      document.body.append(iframe);
      const child = iframe.contentDocument!;
      const childWindow = iframe.contentWindow!;
      const viewport = ref<HTMLElement | null>(null);
      const wrapper = mount(
        defineComponent({
          setup() {
            const owner = provideFocusReveal(viewport);
            return () =>
              h(
                "main",
                { ref: viewport, onFocusin: owner.reveal },
                h("button", "In frame"),
              );
          },
        }),
        { attachTo: child.body },
      );
      wrappers.push(wrapper);
      await flushPromises();
      const button = child.querySelector("button")!;
      button.scrollIntoView = vi.fn();
      const frames: FrameRequestCallback[] = [];
      vi.spyOn(childWindow, "requestAnimationFrame").mockImplementation(
        (callback) => {
          frames.push(callback);
          return frames.length;
        },
      );
      button.focus();
      expect(child.activeElement).toBe(button);
      frames.splice(0).forEach((callback) => callback(0));
      expect(button.scrollIntoView).toHaveBeenCalledExactlyOnceWith({
        block: "nearest",
      });
    } finally {
      settings.enableIframePageLoading = wasEnabled;
    }
  });
});
