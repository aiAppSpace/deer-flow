import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { nextTick, type ComputedRef } from "vue";

import VirtualThreadList from "@/components/workspace/VirtualThreadList.vue";

const boundary = vi.hoisted(() => ({
  options: undefined as ComputedRef<{ scrollMargin: number }> | undefined,
}));
vi.mock("@tanstack/vue-virtual", async () => {
  const { shallowRef } = await import("vue");
  return {
    useVirtualizer: (options: ComputedRef<{ scrollMargin: number }>) => {
      boundary.options = options;
      return shallowRef({
        getVirtualItems: () => [],
        getTotalSize: () => 1000,
        measureElement: vi.fn(),
      });
    },
  };
});

const wrappers: ReturnType<typeof mount>[] = [];
const hosts: HTMLElement[] = [];
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  hosts.splice(0).forEach((host) => host.remove());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  boundary.options = undefined;
});

function render(count = 100) {
  let offset = 0;
  const observers: {
    fire: () => void;
    observe: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  }[] = [];
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe = vi.fn();
      disconnect = vi.fn();
      constructor(callback: ResizeObserverCallback) {
        observers.push({
          fire: () => callback([], this as unknown as ResizeObserver),
          observe: this.observe,
          disconnect: this.disconnect,
        });
      }
    },
  );
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      const top = this.dataset.port === "" ? 20 : 20 + offset;
      return new DOMRect(0, top, 360, 360);
    },
  );
  const makeRows = (length: number) =>
    Array.from({ length }, (_, index) => ({ thread_id: String(index) }));
  const port = document.createElement("div");
  port.dataset.port = "";
  const padding = document.createElement("div");
  padding.dataset.padding = "";
  port.append(padding);
  document.body.append(port);
  hosts.push(port);
  const wrapper = mount(VirtualThreadList, {
    props: {
      items: makeRows(count),
      estimateSize: 76,
      scrollParentSelector: "[data-port]",
    },
    slots: {
      default: ({ thread }: { thread: { thread_id: string } }) =>
        thread.thread_id,
    },
    attachTo: padding,
  });
  wrappers.push(wrapper);
  return {
    wrapper,
    port,
    padding,
    observers,
    setOffset: (next: number) => (offset = next),
    setCount: (next: number) => wrapper.setProps({ items: makeRows(next) }),
  };
}

describe("thread-list physical scroll margin", () => {
  it("remeasures reflowed content padding with unchanged rows and keeps the original viewport owner", async () => {
    const { wrapper, port, padding, observers, setOffset } = render();
    await nextTick();
    expect(boundary.options!.value.scrollMargin).toBe(0);
    setOffset(32);
    observers.forEach((observer) => observer.fire());
    expect(boundary.options!.value.scrollMargin).toBe(32);
    expect(observers).toHaveLength(1);
    expect(observers[0]!.observe).toHaveBeenCalledWith(port);
    expect(observers[0]!.observe).toHaveBeenCalledWith(padding);
    expect(wrapper.element.closest("[data-port]")).toBe(port);
  });

  it("rebinds measurements across the static/virtual threshold without replacing the viewport", async () => {
    const { wrapper, port, observers, setOffset, setCount } = render(59);
    await nextTick();
    const staticRoot = wrapper.element;
    const retired = observers[0]!;
    await setCount(60);
    await nextTick();
    expect(wrapper.element).not.toBe(staticRoot);
    expect(wrapper.element.closest("[data-port]")).toBe(port);
    expect(retired.disconnect).toHaveBeenCalledTimes(1);
    setOffset(48);
    retired.fire();
    expect(boundary.options!.value.scrollMargin).toBe(0);
    observers.at(-1)!.fire();
    expect(boundary.options!.value.scrollMargin).toBe(48);
  });

  it("disconnects the retired physical owner and ignores a queued resize after unmount", async () => {
    const { wrapper, observers, setOffset } = render();
    await nextTick();
    expect(observers).toHaveLength(1);
    wrapper.unmount();
    expect(observers[0]!.disconnect).toHaveBeenCalledTimes(1);
    setOffset(64);
    observers[0]!.fire();
    expect(boundary.options!.value.scrollMargin).toBe(0);
    wrappers.splice(wrappers.indexOf(wrapper), 1);
  });
});
