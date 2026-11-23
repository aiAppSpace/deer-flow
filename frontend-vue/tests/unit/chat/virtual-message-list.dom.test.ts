import { mount, flushPromises } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { h } from "vue";
import VirtualMessageList from "@/components/chat/VirtualMessageList.vue";
import type { MessageGroup } from "@/core/messages/utils";

const wrappers: ReturnType<typeof mount>[] = [];
const frames = new Map<number, FrameRequestCallback>();
const observers = new Set<{
  targets: Set<Element>;
  callback: ResizeObserverCallback;
}>();
const sizes = new Map<string, number>();
let frameId = 0;
function rowSize(element: Element) {
  return (
    sizes.get(
      element.querySelector("[data-row]")?.getAttribute("data-row") ?? "",
    ) ?? 176
  );
}
beforeEach(() => {
  frames.clear();
  observers.clear();
  sizes.clear();
  frameId = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++frameId, callback);
    return frameId;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
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
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(
    function (this: HTMLElement) {
      if (this.hasAttribute("data-message-group-index")) return rowSize(this);
      if (this.dataset.viewport) return 600;
      if (this.dataset.testid === "message-list")
        return (
          Number.parseFloat(this.style.height) || this.children.length * 176
        );
      return 0;
    },
  );
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(800);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      const viewport = this.closest<HTMLElement>("[data-viewport]");
      const prefix = Number(viewport?.dataset.prefix ?? 0);
      let top = 0;
      if (this !== viewport && viewport) {
        top = prefix - viewport.scrollTop;
        if (this.hasAttribute("data-message-group-index"))
          top += Number(
            /translateY\(([-\d.]+)px\)/.exec(this.style.transform)?.[1] ??
              Number(this.dataset.messageGroupIndex) * 176,
          );
      }
      return {
        x: 0,
        y: top,
        top,
        left: 0,
        bottom: top + this.offsetHeight,
        right: 800,
        width: 800,
        height: this.offsetHeight,
        toJSON() {},
      };
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
async function settle() {
  for (let pass = 0; pass < 8; pass++) {
    await flushPromises();
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((callback) => callback(performance.now()));
  }
}
async function resizeRow(
  wrapper: ReturnType<typeof mount>,
  id: string,
  height: number,
) {
  sizes.set(id, height);
  const element = wrapper.get(`[data-row="${id}"]`).element.parentElement!;
  for (const observer of observers)
    if (observer.targets.has(element))
      observer.callback(
        [
          {
            target: element,
            borderBoxSize: [{ blockSize: height, inlineSize: 800 }],
          } as unknown as ResizeObserverEntry,
        ],
        observer as unknown as ResizeObserver,
      );
  await settle();
}

function groups(count: number): MessageGroup[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `group-${index}`,
    type: "human",
    messages: [
      { id: `message-${index}`, type: "human", content: `Row ${index}` },
    ],
  })) as MessageGroup[];
}

function mountList(
  items: MessageGroup[],
  streaming = false,
  followingTail = false,
  prefix = 0,
) {
  const viewport = document.createElement("div");
  viewport.dataset.viewport = "yes";
  viewport.dataset.prefix = String(prefix);
  Object.defineProperties(viewport, {
    offsetHeight: { value: 600 },
    clientHeight: { value: 600 },
    offsetWidth: { value: 800 },
  });
  Object.defineProperty(viewport, "scrollHeight", {
    get: () =>
      prefix +
      (viewport.querySelector<HTMLElement>('[data-testid="message-list"]')
        ?.offsetHeight ?? 0),
  });
  viewport.scrollTo = (options?: ScrollToOptions | number, y?: number) => {
    viewport.scrollTop = Math.min(
      Math.max(0, viewport.scrollHeight - 600),
      Math.max(
        0,
        typeof options === "number" ? (y ?? options) : (options?.top ?? 0),
      ),
    );
    viewport.dispatchEvent(new Event("scroll"));
  };
  document.body.append(viewport);
  const wrapper = mount(VirtualMessageList, {
    attachTo: viewport,
    props: { groups: items, streaming, scrollElement: viewport, followingTail },
    slots: {
      default: ({ group }: { group: MessageGroup }) =>
        h("p", { "data-row": group.id }, group.messages[0]?.content as string),
    },
  });
  wrappers.push(wrapper);
  return wrapper;
}

describe("measured conversation rows", () => {
  it("owns short-history prepend compensation once without competing with the automatic reading anchor", async () => {
    const initial = groups(10);
    const wrapper = mountList(initial);
    await settle();
    const viewport = wrapper.props("scrollElement")!;
    viewport.scrollTo({ top: 420 });
    await settle();
    wrapper.vm.captureHistoryAnchor();
    const older = groups(2).map((group) => ({
      ...group,
      id: `older-${group.id}`,
    }));
    await wrapper.setProps({ groups: [...older, ...initial] });
    await settle();
    expect(viewport.scrollTop).toBe(420);
    await wrapper.vm.completeHistoryLoad();
    expect(viewport.scrollTop).toBe(772);
    await wrapper.vm.completeHistoryLoad();
    expect(viewport.scrollTop).toBe(772);
  });

  it("owns the short-list tail and leaves the reading position alone after following is stopped", async () => {
    const wrapper = mountList(groups(10), false, true);
    await settle();
    const viewport = wrapper.props("scrollElement")!;
    await wrapper.vm.scrollToTail("instant");
    expect(viewport.scrollTop).toBe(
      viewport.scrollHeight - viewport.clientHeight,
    );
    await wrapper.setProps({ followingTail: false });
    viewport.scrollTo({ top: 120 });
    await wrapper.setProps({ groups: groups(11) });
    await wrapper.vm.scrollToTail("instant");
    await settle();
    expect(viewport.scrollTop).toBe(120);
  });

  it("retires pending prepend work when the conversation owner changes", async () => {
    const wrapper = mountList(groups(10));
    await wrapper.setProps({ ownerKey: "old-thread" });
    await settle();
    const viewport = wrapper.props("scrollElement")!;
    viewport.scrollTo({ top: 420 });
    wrapper.vm.captureHistoryAnchor();
    await wrapper.setProps({ ownerKey: "new-thread", groups: groups(12) });
    await wrapper.vm.completeHistoryLoad();
    expect(viewport.scrollTop).toBe(420);
  });

  it("announces the new owner's active row even when its index matches the previous conversation", async () => {
    const wrapper = mountList(groups(100));
    await wrapper.setProps({ ownerKey: "old-thread" });
    await settle();
    const viewport = wrapper.props("scrollElement")!;
    viewport.scrollTo({ top: 176 * 40 + 37 });
    await settle();
    expect(wrapper.emitted("activeGroupChange")?.at(-1)).toEqual([40]);
    const previousCount = wrapper.emitted("activeGroupChange")!.length;

    await wrapper.setProps({
      ownerKey: "new-thread",
      groups: groups(100).map((group) => ({
        ...group,
        id: `new-${group.id}`,
      })),
    });
    await settle();
    expect(wrapper.emitted("activeGroupChange")).toHaveLength(
      previousCount + 1,
    );
    expect(wrapper.emitted("activeGroupChange")?.at(-1)).toEqual([40]);
    expect(viewport.scrollTop).toBe(176 * 40 + 37);
  });

  it("owns content resize following and cancels it while reading or inactive", async () => {
    const wrapper = mountList(groups(10), false, true);
    const viewport = wrapper.props("scrollElement")!;
    const existingObservers = new Set(observers);
    await wrapper.setProps({
      contentElement: viewport,
      initialScroll: "instant",
      resizeScroll: "instant",
    });
    await settle();
    const contentObserver = [...observers].find(
      (observer) =>
        !existingObservers.has(observer) && observer.targets.has(viewport),
    )!;
    expect(contentObserver).toBeDefined();
    const root = wrapper.get('[data-testid="message-list"]')
      .element as HTMLElement;
    root.style.height = "2500px";
    contentObserver.callback(
      [
        {
          target: viewport,
          contentRect: new DOMRect(0, 0, 800, viewport.scrollHeight),
        } as unknown as ResizeObserverEntry,
      ],
      contentObserver as unknown as ResizeObserver,
    );
    await settle();
    expect(viewport.scrollTop).toBe(1900);
    await wrapper.setProps({ followingTail: false });
    viewport.scrollTo({ top: 120 });
    root.style.height = "2800px";
    contentObserver.callback(
      [
        {
          target: viewport,
          contentRect: new DOMRect(0, 0, 800, viewport.scrollHeight),
        } as unknown as ResizeObserverEntry,
      ],
      contentObserver as unknown as ResizeObserver,
    );
    await settle();
    expect(viewport.scrollTop).toBe(120);
    await wrapper.setProps({ followingTail: true, active: false });
    contentObserver.callback(
      [
        {
          target: viewport,
          contentRect: new DOMRect(0, 0, 800, viewport.scrollHeight),
        } as unknown as ResizeObserverEntry,
      ],
      contentObserver as unknown as ResizeObserver,
    );
    await settle();
    expect(viewport.scrollTop).toBe(120);
    wrapper.unmount();
    expect(contentObserver.targets.size).toBe(0);
    expect(frames.size).toBe(0);
  });

  it("renders all short-history rows with stable group identities", async () => {
    const wrapper = mountList(groups(59));
    await flushPromises();
    expect(wrapper.findAll("[data-message-group-index]")).toHaveLength(59);
    expect(wrapper.get('[data-message-group-index="20"]').text()).toBe(
      "Row 20",
    );
  });

  it("virtualizes at the upstream threshold and keeps the active streaming group mounted", async () => {
    const wrapper = mountList(groups(100), true);
    await flushPromises();
    const rows = wrapper.findAll("[data-message-group-index]");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan(100);
    expect(wrapper.get('[data-message-group-index="99"]').text()).toBe(
      "Row 99",
    );
    expect(
      wrapper
        .get('[data-message-group-index="0"]')
        .element.getAttribute("style"),
    ).toContain("translateY");
  });

  it("positions an initially long conversation at its measured tail including content before the list", async () => {
    sizes.set("group-99", 780);
    const wrapper = mountList(groups(100), true, true, 240);
    await settle();
    const viewport = wrapper.props("scrollElement")!;
    expect(viewport.scrollTop).toBe(
      viewport.scrollHeight - viewport.clientHeight,
    );
    expect(
      wrapper
        .get('[data-row="group-99"]')
        .element.parentElement!.getBoundingClientRect().bottom,
    ).toBe(600);
  });

  it("keeps the reading row in place when history is prepended", async () => {
    const initial = groups(100);
    const wrapper = mountList(initial);
    await settle();
    const viewport = wrapper.props("scrollElement")!;
    viewport.scrollTo({ top: 176 * 40 + 37 });
    await settle();
    const before = wrapper
      .get('[data-row="group-40"]')
      .element.parentElement!.getBoundingClientRect().top;
    const older = groups(10).map((group) => ({
      ...group,
      id: `older-${group.id}`,
    }));
    await wrapper.setProps({ groups: [...older, ...initial] });
    await settle();
    expect(
      wrapper
        .get('[data-row="group-40"]')
        .element.parentElement!.getBoundingClientRect().top,
    ).toBe(before);
  });

  it("preserves the reading anchor across the short-list virtualization threshold", async () => {
    const wrapper = mountList(groups(59));
    await settle();
    const viewport = wrapper.props("scrollElement")!;
    viewport.scrollTo({ top: 176 * 30 + 22 });
    await settle();
    const before = wrapper
      .get('[data-row="group-30"]')
      .element.parentElement!.getBoundingClientRect().top;
    await wrapper.setProps({ groups: groups(60) });
    await settle();
    expect(wrapper.findAll("[data-message-group-index]").length).toBeLessThan(
      60,
    );
    expect(
      wrapper
        .get('[data-row="group-30"]')
        .element.parentElement!.getBoundingClientRect().top,
    ).toBe(before);
  });

  it("uses message identities to preserve a prepended anchor when groups have no ID", async () => {
    const initial = groups(100).map((group) => ({ ...group, id: undefined }));
    const wrapper = mountList(initial);
    await settle();
    const viewport = wrapper.props("scrollElement")!;
    viewport.scrollTo({ top: 176 * 40 + 37 });
    await settle();
    const before = wrapper
      .get('[data-message-group-index="40"]')
      .element.getBoundingClientRect().top;
    const older = groups(10).map((group, index) => ({
      ...group,
      id: undefined,
      messages: [{ ...group.messages[0]!, id: `older-message-${index}` }],
    }));
    await wrapper.setProps({ groups: [...older, ...initial] });
    await settle();
    expect(
      wrapper
        .get('[data-message-group-index="50"]')
        .element.getBoundingClientRect().top,
    ).toBe(before);
  });

  it("compensates a resized long tool above the viewport and does not chase a streaming tail while reading", async () => {
    const wrapper = mountList(groups(100), true);
    await settle();
    const viewport = wrapper.props("scrollElement")!;
    viewport.scrollTo({ top: 176 * 40 + 37 });
    await settle();
    const before = wrapper
      .get('[data-row="group-40"]')
      .element.parentElement!.getBoundingClientRect().top;
    await resizeRow(wrapper, "group-35", 900);
    expect(
      wrapper
        .get('[data-row="group-40"]')
        .element.parentElement!.getBoundingClientRect().top,
    ).toBe(before);
    const offset = viewport.scrollTop;
    await resizeRow(wrapper, "group-99", 950);
    expect(viewport.scrollTop).toBe(offset);
  });

  it("does not shift the reader when a long tool spanning the reading line grows below it", async () => {
    sizes.set("group-40", 1000);
    const wrapper = mountList(groups(100), true);
    await settle();
    const viewport = wrapper.props("scrollElement")!;
    viewport.scrollTo({ top: 176 * 40 + 200 });
    await settle();
    // A real ResizeObserver reports the long row after the scrolling window mounts.
    await resizeRow(wrapper, "group-40", 1000);
    viewport.scrollTo({ top: 176 * 40 + 200 });
    await settle();
    const before = viewport.scrollTop;
    await resizeRow(wrapper, "group-40", 1700);
    expect(viewport.scrollTop).toBe(before);
    expect(wrapper.emitted("activeGroupChange")?.at(-1)).toEqual([40]);
  });

  it("recognizes the virtualizer's internal adjustment when measured rows keep the same total height", async () => {
    const wrapper = mountList(groups(100), true);
    await settle();
    const viewport = wrapper.props("scrollElement")!;
    viewport.scrollTo({ top: 176 * 40 + 37 });
    await settle();
    viewport.dispatchEvent(new Event("scroll"));
    const before = viewport.scrollTop;
    const beforeHeight = viewport.scrollHeight;
    const readingText = wrapper.get('[data-row="group-40"]').element;
    readingText.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    const selection = document.createRange();
    selection.selectNodeContents(readingText);
    window.getSelection()!.addRange(selection);
    // Browser scroll events are delivered after these synchronous measurements.
    // One row above the reader shrinks; a visible row below grows equally.
    viewport.scrollTo = (options?: ScrollToOptions | number) => {
      viewport.scrollTop =
        typeof options === "number" ? options : (options?.top ?? 0);
    };
    const changes = [
      ["group-35", 76],
      ["group-42", 276],
    ] as const;
    for (const [id, height] of changes) sizes.set(id, height);
    for (const observer of [...observers]) {
      const entries = changes.flatMap(([id, height]) => {
        const target = wrapper.get(`[data-row="${id}"]`).element.parentElement!;
        return observer.targets.has(target)
          ? [
              {
                target,
                borderBoxSize: [{ blockSize: height, inlineSize: 800 }],
              } as unknown as ResizeObserverEntry,
            ]
          : [];
      });
      if (entries.length)
        observer.callback(entries, observer as unknown as ResizeObserver);
    }
    await settle();
    expect(viewport.scrollHeight).toBe(beforeHeight);
    expect(viewport.scrollTop).toBe(before - 100);
    viewport.dispatchEvent(new Event("scroll"));
    expect(wrapper.emitted("readingIntent")).toBeUndefined();
    document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  });

  it("keeps following the tail when the active streaming row grows without a new group", async () => {
    const wrapper = mountList(groups(100), true, true);
    await settle();
    await resizeRow(wrapper, "group-99", 920);
    const viewport = wrapper.props("scrollElement")!;
    expect(viewport.scrollTop).toBe(viewport.scrollHeight - 600);
  });

  it("aligns a measured long row at the requested center, then cancels pending alignment on disposal", async () => {
    sizes.set("group-70", 400);
    const wrapper = mountList(groups(100));
    await settle();
    await wrapper.vm.scrollToGroup(70, { align: "center", behavior: "smooth" });
    await settle();
    expect(
      wrapper
        .get('[data-row="group-70"]')
        .element.parentElement!.getBoundingClientRect().top,
    ).toBe(100);
    const viewport = wrapper.props("scrollElement")!;
    const scroll = vi.spyOn(viewport, "scrollTo");
    const pending = wrapper.vm.scrollToGroup(20);
    wrapper.unmount();
    wrappers.splice(wrappers.indexOf(wrapper), 1);
    const calls = scroll.mock.calls.length;
    await pending;
    await settle();
    expect(scroll).toHaveBeenCalledTimes(calls);
  });
  it("retires an unfinished measured outline jump when a newer explicit tail request arrives", async () => {
    const wrapper = mountList(groups(100), false, true);
    await settle();
    const viewport = wrapper.props("scrollElement")!;
    await wrapper.vm.scrollToGroup(96);
    await wrapper.vm.scrollToTail("instant");
    const tail = viewport.scrollTop;
    expect(tail).toBe(viewport.scrollHeight - viewport.clientHeight);
    await settle();
    expect(viewport.scrollTop).toBe(tail);
  });
  it("retires an unfinished outline jump when the reader interrupts its positioning", async () => {
    const wrapper = mountList(groups(100));
    await settle();
    const viewport = wrapper.props("scrollElement")!;
    await wrapper.vm.scrollToGroup(70);
    wrapper.vm.stopFollowingTail();
    const reading = 176 * 69 + 20;
    viewport.scrollTo({ top: reading });
    await settle();
    expect(viewport.scrollTop).toBe(reading);
  });
  it("does not apply an old history anchor after a newer explicit tail request", async () => {
    const wrapper = mountList(groups(10));
    await settle();
    const viewport = wrapper.props("scrollElement")!;
    viewport.scrollTo({ top: 420 });
    wrapper.vm.captureHistoryAnchor();
    await wrapper.setProps({ groups: groups(12), followingTail: true });
    await wrapper.vm.scrollToTail("instant");
    const tail = viewport.scrollTop;
    await wrapper.vm.completeHistoryLoad();
    expect(viewport.scrollTop).toBe(tail);
  });
});
