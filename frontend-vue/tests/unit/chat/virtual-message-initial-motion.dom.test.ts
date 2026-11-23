import { mount, flushPromises } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { h } from "vue";
import VirtualMessageList from "@/components/chat/VirtualMessageList.vue";
import type { MessageGroup } from "@/core/messages/utils";
import reference from "./fixtures/conversation-initial-motion.json";

const wrappers: ReturnType<typeof mount>[] = [];
const frames = new Map<number, FrameRequestCallback>();
const observers = new Set<{
  callback: ResizeObserverCallback;
  targets: Set<Element>;
}>();
let frameId = 0;
let now = 0;
let contentHeight = 3000;
let viewportHeight = 600;
let position = 0;
function groups(count = 5): MessageGroup[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `motion-${index}`,
    type: "human",
    messages: [{ id: `motion-${index}`, type: "human", content: "History" }],
  }));
}
beforeEach(() => {
  frames.clear();
  observers.clear();
  frameId = 0;
  now = 0;
  contentHeight = 3000;
  viewportHeight = 600;
  position = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++frameId, callback);
    return frameId;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.spyOn(Date, "now").mockImplementation(() => 100000 + now);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      targets = new Set<Element>();
      constructor(public callback: ResizeObserverCallback) {
        observers.add(this);
      }
      observe(target: Element) {
        this.targets.add(target);
      }
      unobserve(target: Element) {
        this.targets.delete(target);
      }
      disconnect() {
        this.targets.clear();
        observers.delete(this);
      }
    },
  );
});
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  window.getSelection()?.removeAllRanges();
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function render(count = 5, extra = {}) {
  const viewport = document.createElement("div");
  const content = document.createElement("div");
  viewport.append(content);
  document.body.append(viewport);
  Object.defineProperties(viewport, {
    clientHeight: { get: () => viewportHeight },
    offsetHeight: { value: 600 },
    offsetWidth: { value: 800 },
    scrollHeight: { get: () => contentHeight },
    scrollTop: {
      get: () => position,
      set: (value) => {
        position = Math.round(
          Math.max(0, Math.min(contentHeight - viewportHeight, value)),
        );
      },
    },
  });
  viewport.getBoundingClientRect = () => new DOMRect(0, 0, 800, 600);
  viewport.scrollTo = (options?: ScrollToOptions | number) => {
    viewport.scrollTop =
      typeof options === "number" ? options : (options?.top ?? 0);
  };
  content.getBoundingClientRect = () =>
    new DOMRect(0, -position, 800, contentHeight);
  const wrapper = mount(VirtualMessageList, {
    attachTo: content,
    props: {
      groups: groups(count),
      streaming: false,
      scrollElement: viewport,
      contentElement: content,
      followingTail: true,
      ownerKey: "owner-a",
      ...extra,
    },
    slots: {
      default: ({ group }: { group: MessageGroup }) => h("p", group.id),
    },
  });
  wrappers.push(wrapper);
  await flushPromises();
  return { wrapper, viewport, content };
}
async function resize(content: Element) {
  for (const observer of [...observers])
    if (observer.targets.has(content))
      observer.callback(
        [
          {
            target: content,
            contentRect: new DOMRect(0, 0, 800, contentHeight),
            borderBoxSize: [{ blockSize: contentHeight, inlineSize: 800 }],
          } as unknown as ResizeObserverEntry,
        ],
        observer as unknown as ResizeObserver,
      );
  await flushPromises();
}
async function step(delta = 1000 / 60) {
  now += delta;
  const pending = [...frames.values()];
  frames.clear();
  pending.forEach((callback) => callback(now));
  await flushPromises();
}
async function settle() {
  for (let i = 0; i < 200 && frames.size; i++) await step();
}

describe("initial content owns the measured tail trajectory", () => {
  for (const { name, deltas, trace } of reference.rows)
    it(`matches actual React initial motion at ${name}`, async () => {
      const { viewport, content } = await render();
      expect(viewport.scrollTop).toBe(0);
      await resize(content);
      expect(viewport.scrollTop).toBe(0);
      const actual: number[] = [];
      for (const delta of deltas) {
        await step(delta);
        actual.push(viewport.scrollTop);
      }
      expect(actual).toEqual(trace);
      await settle();
      expect(2400 - viewport.scrollTop).toBeLessThanOrEqual(2);
    });
  it("keeps the first asynchronous short history as initial content after an empty measurement", async () => {
    contentHeight = 0;
    const { wrapper, viewport, content } = await render(0);
    await resize(content);
    await step();
    contentHeight = 3000;
    await wrapper.setProps({ groups: groups() });
    await flushPromises();
    expect(viewport.scrollTop).toBe(0);
    await resize(content);
    const actual: number[] = [];
    for (const delta of reference.rows[0]!.deltas) {
      await step(delta);
      actual.push(viewport.scrollTop);
    }
    // The React hook may have two queued smooth promises after an empty RO;
    // its extra zero-delta momentum is recorded separately. This consumer must
    // own one natural initial motion, without an instant append stealing it.
    expect(actual[0]).toBe(0);
    expect(
      actual
        .slice(1)
        .every((value, index) => value > actual[index]! && value < 2400),
    ).toBe(true);
    await settle();
    expect(2400 - viewport.scrollTop).toBeLessThanOrEqual(2);
  });
  it("does not restart initial motion when the content grows during its first animation", async () => {
    const { viewport, content } = await render();
    await resize(content);
    await step();
    await step();
    const before = viewport.scrollTop;
    contentHeight = 3600;
    await resize(content);
    expect(viewport.scrollTop).toBe(before);
    await step();
    expect(viewport.scrollTop).toBeGreaterThan(before);
    expect(viewport.scrollTop).toBeLessThan(3000);
    await settle();
    expect(3000 - viewport.scrollTop).toBeLessThanOrEqual(2);
  });
  it("keeps an explicitly instant initial policy for sidecar consumers", async () => {
    const { viewport, content } = await render(5, {
      initialScroll: "instant",
      resizeScroll: "instant",
    });
    await resize(content);
    await step();
    expect(2400 - viewport.scrollTop).toBeLessThanOrEqual(2);
  });
  it("retires pending motion while reading, inactive and unmounted", async () => {
    const { wrapper, viewport, content } = await render();
    await resize(content);
    await step();
    await step();
    await wrapper.setProps({ followingTail: false });
    viewport.scrollTop = 100;
    contentHeight = 3600;
    await resize(content);
    await settle();
    expect(viewport.scrollTop).toBe(100);
    await wrapper.setProps({ active: false, followingTail: true });
    await resize(content);
    await settle();
    expect(viewport.scrollTop).toBe(100);
    wrapper.unmount();
    wrappers.splice(wrappers.indexOf(wrapper), 1);
    await settle();
    expect(viewport.scrollTop).toBe(100);
    expect(
      [...observers].some((observer) => observer.targets.has(content)),
    ).toBe(false);
  });
  it("starts first content even when a prior empty-content measurement had the same height", async () => {
    const { wrapper, viewport, content } = await render(0);
    await resize(content);
    await step();
    await wrapper.setProps({ groups: groups() });
    await flushPromises();
    expect(viewport.scrollTop).toBe(0);
    const actual: number[] = [];
    for (const delta of reference.rows[0]!.deltas) {
      await step(delta);
      actual.push(viewport.scrollTop);
    }
    // The React hook may have two queued smooth promises after an empty RO;
    // its extra zero-delta momentum is recorded separately. This consumer must
    // own one natural initial motion, without an instant append stealing it.
    expect(actual[0]).toBe(0);
    expect(
      actual
        .slice(1)
        .every((value, index) => value > actual[index]! && value < 2400),
    ).toBe(true);
    await settle();
    expect(2400 - viewport.scrollTop).toBeLessThanOrEqual(2);
  });
  it("does not classify removing a short group as an instant append", async () => {
    const { wrapper, viewport, content } = await render();
    await resize(content);
    await step();
    await step();
    const before = viewport.scrollTop;
    contentHeight = 2800;
    await wrapper.setProps({ groups: groups(4) });
    await resize(content);
    expect(viewport.scrollTop).toBe(before);
    await step();
    expect(viewport.scrollTop).toBeGreaterThan(before);
    expect(viewport.scrollTop).toBeLessThan(2200);
  });
  it("keeps append and explicit submission instant without a stale smooth frame moving them again", async () => {
    const { wrapper, viewport, content } = await render();
    await resize(content);
    await step();
    await step();
    contentHeight = 3600;
    await wrapper.setProps({ groups: groups(6) });
    await flushPromises();
    expect(viewport.scrollTop).toBe(3000);
    await step();
    expect(viewport.scrollTop).toBe(3000);
    viewport.scrollTop = 100;
    await wrapper.vm.scrollToTail("instant");
    expect(viewport.scrollTop).toBe(3000);
    await settle();
    expect(viewport.scrollTop).toBe(3000);
  });
  it("makes a canceled pending nextTick request unable to restart following", async () => {
    const { wrapper, viewport } = await render();
    const pending = wrapper.vm.scrollToTail("smooth");
    wrapper.vm.stopFollowingTail();
    await pending;
    await settle();
    expect(viewport.scrollTop).toBe(0);
  });
  it("retires old content callbacks and starts the replacement content's own measurement", async () => {
    const { wrapper, viewport, content } = await render();
    const retired = [...observers].find((observer) =>
      observer.targets.has(content),
    )!;
    await resize(content);
    await step();
    await step();
    const next = document.createElement("div");
    viewport.append(next);
    next.getBoundingClientRect = () => new DOMRect(0, 0, 800, contentHeight);
    await wrapper.setProps({ contentElement: next });
    const before = viewport.scrollTop;
    retired.callback(
      [
        {
          target: content,
          contentRect: new DOMRect(0, 0, 800, 6000),
        } as unknown as ResizeObserverEntry,
      ],
      retired as unknown as ResizeObserver,
    );
    await settle();
    expect(viewport.scrollTop).toBe(before);
    expect(retired.targets.size).toBe(0);
    await resize(next);
    await step();
    await step();
    expect(viewport.scrollTop).toBeGreaterThan(before);
  });
  it("re-observes a new owner even at identical geometry and rejects its departed owner's callbacks", async () => {
    const { wrapper, viewport, content } = await render();
    const retired = [...observers].find((observer) =>
      observer.targets.has(content),
    )!;
    await resize(content);
    await step();
    await step();
    await wrapper.setProps({ ownerKey: "owner-b" });
    viewport.scrollTop = 0;
    retired.callback(
      [
        {
          target: content,
          contentRect: new DOMRect(0, 0, 800, contentHeight),
        } as unknown as ResizeObserverEntry,
      ],
      retired as unknown as ResizeObserver,
    );
    await settle();
    expect(viewport.scrollTop).toBe(0);
    await resize(content);
    const actual: number[] = [];
    for (const delta of reference.rows[0]!.deltas) {
      await step(delta);
      actual.push(viewport.scrollTop);
    }
    expect(actual).toEqual(reference.rows[0]!.trace);
  });

  it("keeps its content observer live after outline jump and explicit return to the tail", async () => {
    const { wrapper, viewport, content } = await render();
    await resize(content);
    await settle();
    await wrapper.setProps({ followingTail: false });
    await wrapper.vm.scrollToGroup(2);
    await settle();
    await wrapper.setProps({ followingTail: true });
    await wrapper.vm.scrollToTail("instant");
    expect(viewport.scrollTop).toBe(2400);
    contentHeight = 3600;
    await resize(content);
    await step();
    await step();
    expect(viewport.scrollTop).toBeGreaterThan(2400);
    await settle();
    expect(3000 - viewport.scrollTop).toBeLessThanOrEqual(2);
  });
  it("pauses a held selection inside its viewport and continues on release without a large time step", async () => {
    const { viewport, content } = await render();
    await resize(content);
    await step();
    await step();
    const text = content.querySelector("p")!;
    text.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    const range = document.createRange();
    range.selectNodeContents(text);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
    const before = viewport.scrollTop;
    for (let i = 0; i < 10; i++) await step(100);
    expect(viewport.scrollTop).toBe(before);
    document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    await step();
    expect(viewport.scrollTop).toBeGreaterThan(before);
    expect(viewport.scrollTop).toBeLessThan(2400);
    window.getSelection()!.removeAllRanges();
    await settle();
    expect(2400 - viewport.scrollTop).toBeLessThanOrEqual(2);
  });
  it("does not pause for a held selection outside its viewport", async () => {
    const { viewport, content } = await render();
    await resize(content);
    await step();
    await step();
    const outside = document.createElement("p");
    outside.textContent = "Outside";
    document.body.append(outside);
    outside.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    const range = document.createRange();
    range.selectNodeContents(outside);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
    const before = viewport.scrollTop;
    await step();
    expect(viewport.scrollTop).toBeGreaterThan(before);
    document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    window.getSelection()!.removeAllRanges();
  });
  it("holds an explicit instant append during a real selection until release", async () => {
    const { wrapper, viewport, content } = await render();
    await resize(content);
    await step();
    await step();
    const text = content.querySelector("p")!;
    text.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    const range = document.createRange();
    range.selectNodeContents(text);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
    const before = viewport.scrollTop;
    contentHeight = 3600;
    await wrapper.setProps({ groups: groups(6) });
    await step();
    expect(viewport.scrollTop).toBe(before);
    document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    await step();
    expect(3000 - viewport.scrollTop).toBeLessThanOrEqual(2);
    window.getSelection()!.removeAllRanges();
  });

  it("distinguishes a delayed own scroll event from native selection-edge scrolling", async () => {
    const { wrapper, viewport, content } = await render();
    await resize(content);
    await step();
    await step();
    const text = content.querySelector("p")!;
    text.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    const range = document.createRange();
    range.selectNodeContents(text);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
    viewport.dispatchEvent(new Event("scroll"));
    viewport.dispatchEvent(new Event("scroll"));
    expect(wrapper.emitted("readingIntent")).toBeUndefined();
    viewport.scrollTop += 80;
    viewport.dispatchEvent(new Event("scroll"));
    expect(wrapper.emitted("readingIntent")).toHaveLength(1);
    // The owning MessageList responds to this event through its existing state.
    await wrapper.setProps({ followingTail: false });
    const reading = viewport.scrollTop;
    document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    await settle();
    expect(viewport.scrollTop).toBe(reading);
  });

  it.each([true, false])(
    "retires following on an external upward scroll, with prior own event delivered=%s",
    async (deliverOwn) => {
      const { wrapper, viewport, content } = await render();
      await resize(content);
      for (let i = 0; i < 5; i++) await step();
      expect(viewport.scrollTop).toBeGreaterThan(80);
      if (deliverOwn) viewport.dispatchEvent(new Event("scroll"));
      // Native focus/scrollIntoView may move the physical viewport without a
      // wheel, key or held selection. The scroll itself is the reading evidence.
      viewport.scrollTop -= 80;
      viewport.dispatchEvent(new Event("scroll"));
      expect(wrapper.emitted("readingIntent")).toHaveLength(1);
      await wrapper.setProps({ followingTail: false });
      const reading = viewport.scrollTop;
      await settle();
      expect(viewport.scrollTop).toBe(reading);
    },
  );

  it("does not treat owned writes or external downward motion as an upward escape", async () => {
    const { wrapper, viewport, content } = await render();
    await resize(content);
    for (let i = 0; i < 5; i++) await step();
    viewport.dispatchEvent(new Event("scroll"));
    viewport.dispatchEvent(new Event("scroll"));
    viewport.scrollTop += 80;
    viewport.dispatchEvent(new Event("scroll"));
    expect(wrapper.emitted("readingIntent")).toBeUndefined();
    await settle();
    expect(2400 - viewport.scrollTop).toBeLessThanOrEqual(2);
  });

  it("keeps an external reading position after initial motion has already finished and content grows", async () => {
    const { wrapper, viewport, content } = await render();
    await resize(content);
    await settle();
    viewport.dispatchEvent(new Event("scroll"));
    viewport.scrollTop -= 180;
    viewport.dispatchEvent(new Event("scroll"));
    expect(wrapper.emitted("readingIntent")).toHaveLength(1);
    await wrapper.setProps({ followingTail: false });
    const reading = viewport.scrollTop;
    contentHeight = 3600;
    await resize(content);
    await settle();
    expect(viewport.scrollTop).toBe(reading);
  });

  it.each([true, false])(
    "does not treat a layout clamp as reading, with ResizeObserver first=%s",
    async (resizeFirst) => {
      const { wrapper, viewport, content } = await render();
      await resize(content);
      for (let i = 0; i < 5; i++) await step();
      viewport.dispatchEvent(new Event("scroll"));
      expect(viewport.scrollTop).toBeGreaterThan(100);
      contentHeight = 700;
      viewport.scrollTop = 100;
      if (resizeFirst) await resize(content);
      viewport.dispatchEvent(new Event("scroll"));
      if (!resizeFirst) await resize(content);
      expect(wrapper.emitted("readingIntent")).toBeUndefined();
      await settle();
      expect(100 - viewport.scrollTop).toBeLessThanOrEqual(2);
    },
  );
  it("does not turn a viewport-capacity clamp into reading", async () => {
    const { wrapper, viewport, content } = await render();
    await resize(content);
    await settle();
    viewport.dispatchEvent(new Event("scroll"));
    viewportHeight = 1200;
    viewport.scrollTop = 1800;
    viewport.dispatchEvent(new Event("scroll"));
    expect(wrapper.emitted("readingIntent")).toBeUndefined();
    contentHeight = 3600;
    await resize(content);
    await settle();
    expect(2400 - viewport.scrollTop).toBeLessThanOrEqual(2);
  });
  it.each([true, false])(
    "keeps following a same-cycle resize and upward offset, with ResizeObserver first=%s",
    async (resizeFirst) => {
      const { wrapper, viewport, content } = await render();
      await resize(content);
      for (let i = 0; i < 5; i++) await step();
      contentHeight += 100;
      if (resizeFirst) await resize(content);
      viewport.scrollTop -= 80;
      viewport.dispatchEvent(new Event("scroll"));
      if (!resizeFirst) await resize(content);
      expect(wrapper.emitted("readingIntent")).toBeUndefined();
      await settle();
      expect(2500 - viewport.scrollTop).toBeLessThanOrEqual(2);
    },
  );
  it("does not compare a replacement viewport to the retired owner's position", async () => {
    const { wrapper, viewport, content } = await render();
    await resize(content);
    await settle();
    const replacement = document.createElement("div");
    Object.defineProperties(replacement, {
      scrollHeight: { value: 3000 },
      clientHeight: { value: 600 },
      scrollTop: { value: 400, writable: true },
    });
    await wrapper.setProps({ scrollElement: replacement });
    viewport.scrollTop = 100;
    viewport.dispatchEvent(new Event("scroll"));
    replacement.dispatchEvent(new Event("scroll"));
    expect(wrapper.emitted("readingIntent")).toBeUndefined();
    // The virtualizer may initialize the new viewport's offset. Start a real
    // downward observation before testing an upward movement in that owner.
    replacement.scrollTop = 400;
    replacement.dispatchEvent(new Event("scroll"));
    replacement.scrollTop = 320;
    replacement.dispatchEvent(new Event("scroll"));
    expect(wrapper.emitted("readingIntent")).toHaveLength(1);
  });
  it("records an owned outline placement before its delayed scroll event", async () => {
    const { wrapper, viewport, content } = await render();
    await resize(content);
    await settle();
    const before = viewport.scrollTop;
    await wrapper.vm.scrollToGroup(0);
    expect(viewport.scrollTop).toBeLessThan(before);
    viewport.dispatchEvent(new Event("scroll"));
    expect(wrapper.emitted("readingIntent")).toBeUndefined();
  });
});
