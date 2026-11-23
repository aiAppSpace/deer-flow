import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import StableOverlay from "./fixtures/stable-overlay.fixture.vue";

const wrappers: VueWrapper[] = [];
let frames: FrameRequestCallback[];
let reveal: ReturnType<typeof vi.spyOn>;
const flushFrames = () => frames.splice(0).forEach((callback) => callback(0));

beforeEach(() => {
  frames = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.push(callback);
    return frames.length;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  reveal = vi.spyOn(HTMLElement.prototype, "scrollIntoView");
});

afterEach(async () => {
  for (const wrapper of wrappers.splice(0)) wrapper.unmount();
  await flushPromises();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe.each(["sheet", "dialog"] as const)(
  "%s physical content lifetime",
  (kind) => {
    async function open(withFrame: boolean, as?: string) {
      const wrapper = mount(StableOverlay, {
        props: { kind, withFrame, as },
        attachTo: document.body,
      });
      wrappers.push(wrapper);
      expect(document.querySelector('[role="dialog"]')).toBeNull();
      await wrapper.get("[data-open]").trigger("click");
      await flushPromises();
      flushFrames();
      reveal.mockClear();
      return {
        wrapper,
        host: document.querySelector<HTMLElement>('[role="dialog"]')!,
      };
    }

    it("reveals the current control after the first open of stable compiled slots", async () => {
      const { host } = await open(false, "section");
      expect(host.tagName).toBe("SECTION");
      const a = host.querySelector<HTMLElement>('[data-choice="a"]')!;
      const b = host.querySelector<HTMLElement>('[data-choice="b"]')!;
      b.focus();
      a.focus();
      flushFrames();
      expect(document.activeElement).toBe(a);
      expect(reveal).toHaveBeenCalledExactlyOnceWith({ block: "nearest" });
      expect(reveal.mock.contexts[0]).toBe(a);
    });

    it("owns iframe boundaries on each actual mount and removes the departed pair", async () => {
      const { wrapper, host } = await open(true);
      expect(
        host.querySelectorAll("[data-dialog-focus-sentinel]"),
      ).toHaveLength(2);
      host
        .querySelector<HTMLButtonElement>(`[data-slot="${kind}-close"]`)!
        .click();
      await flushPromises();
      expect(host.isConnected).toBe(false);
      expect(
        host.querySelectorAll("[data-dialog-focus-sentinel]"),
      ).toHaveLength(0);
      await wrapper.get("[data-open]").trigger("click");
      await flushPromises();
      const reopened = document.querySelector<HTMLElement>('[role="dialog"]')!;
      expect(reopened).not.toBe(host);
      expect(
        reopened.querySelectorAll("[data-dialog-focus-sentinel]"),
      ).toHaveLength(2);
      expect(
        document.querySelectorAll("[data-dialog-focus-sentinel]"),
      ).toHaveLength(2);
    });
  },
);
