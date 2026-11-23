/** Real common layout/native splitter consumers; pixel interpolation belongs to native acceptance. */
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { installPointerCaptureFixture } from "../helpers/pointer-capture";
import {
  defineComponent,
  h,
  isVNode,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import WorkspacePanels from "@/components/workspace/WorkspacePanels.vue";

const wrappers: VueWrapper[] = [];
function matchMediaFixture() {
  const listeners = new Map<
    string,
    Set<(event: { matches: boolean }) => void>
  >();
  const matches = new Map<string, boolean>();
  vi.stubGlobal("matchMedia", (query: string) => ({
    media: query,
    get matches() {
      return matches.get(query) ?? false;
    },
    addEventListener: (
      _: string,
      callback: (event: { matches: boolean }) => void,
    ) => {
      const callbacks = listeners.get(query) ?? new Set();
      callbacks.add(callback);
      listeners.set(query, callbacks);
    },
    removeEventListener: (
      _: string,
      callback: (event: { matches: boolean }) => void,
    ) => {
      listeners.get(query)?.delete(callback);
    },
  }));
  return {
    change(query: string, next: boolean) {
      matches.set(query, next);
      for (const callback of listeners.get(query) ?? [])
        callback({ matches: next });
    },
    listenerCount: () =>
      [...listeners.values()].reduce(
        (total, callbacks) => total + callbacks.size,
        0,
      ),
  };
}

async function layout(initialOpen = false) {
  const open = ref(initialOpen);
  const panelSize = ref(35);
  const ownerKey = ref("owner-a");
  const panelKey = ref("sidecar");
  const padded = ref(false);
  const mainMounted = vi.fn();
  const persisted = vi.fn();
  const mounted = vi.fn();
  const unmounted = vi.fn();
  const Content = defineComponent({
    setup() {
      onMounted(mounted);
      onUnmounted(unmounted);
      return () => h("input", { "data-testid": "panel-draft", value: "draft" });
    },
  });
  const Main = defineComponent({
    setup() {
      onMounted(mainMounted);
      return () => h("button", { "data-testid": "main-action" }, "Main");
    },
  });
  const wrapper = mount(
    defineComponent({
      setup: () => () =>
        h(
          WorkspacePanels,
          {
            open: open.value,
            panelSize: panelSize.value,
            ownerKey: ownerKey.value,
            panelKey: panelKey.value,
            panelPadded: padded.value,
            "onUpdate:panelSize": (value: number) => {
              persisted(value);
              panelSize.value = value;
            },
            onCollapse: () => {
              open.value = false;
            },
          },
          {
            main: () => h(Main),
            panel: () => h(Content),
          },
        ),
    }),
    { attachTo: document.body },
  );
  wrappers.push(wrapper);
  await flushPromises();
  const contentHost = () => {
    const element = wrapper.get("#artifacts > div").element;
    if (!(element instanceof HTMLElement))
      throw new Error("Expected the actual desktop content host");
    return element;
  };
  const requestedContentWidth = () => {
    // happy-dom drops cqw values. Read the actual mounted production template's
    // renderer output; pixel widths/interpolation remain native-only evidence.
    const vnode: unknown = Reflect.get(contentHost(), "__vnode");
    if (!isVNode(vnode))
      throw new Error("Expected the real rendered host VNode");
    const style: unknown = vnode.props?.style;
    if (!style || typeof style !== "object") return "";
    const width: unknown = Reflect.get(style, "width");
    return typeof width === "string" ? width : "";
  };
  return {
    wrapper,
    open,
    panelSize,
    ownerKey,
    panelKey,
    padded,
    mainMounted,
    persisted,
    mounted,
    unmounted,
    contentHost,
    requestedContentWidth,
  };
}

const frames = new Map<number, FrameRequestCallback>();
let frameId = 0;
async function startRealDrag(
  source: Awaited<ReturnType<typeof layout>>,
  clientX = 700,
) {
  const group = source.wrapper.get(".workspace-panels").element;
  const handle = source.wrapper.get('[role="separator"]');
  vi.spyOn(group, "getBoundingClientRect").mockReturnValue(
    new DOMRect(0, 0, 1001, 500),
  );
  for (const pane of source.wrapper.findAll("[data-panel]"))
    vi.spyOn(pane.element, "getBoundingClientRect").mockImplementation(
      () =>
        new DOMRect(0, 0, Number(pane.attributes("data-panel-size")) * 10, 500),
    );
  const main = source.wrapper.get('[data-panel-id="main"]');
  const pointer = (type: string, x: number) =>
    handle.element.dispatchEvent(
      new PointerEvent(type, {
        pointerId: 7,
        isPrimary: true,
        button: 0,
        clientX: x,
        bubbles: true,
        cancelable: true,
      }),
    );
  pointer("pointerdown", Number(main.attributes("data-panel-size")) * 10);
  pointer("pointermove", clientX);
  await nextTick();
  return {
    handle,
    move: async (x: number) => {
      pointer("pointermove", x);
      await nextTick();
    },
    release: async (x: number) => {
      pointer("pointerup", x);
      await nextTick();
    },
  };
}
let capture: ReturnType<typeof installPointerCaptureFixture>;
let media: ReturnType<typeof matchMediaFixture>;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  media = matchMediaFixture();
  capture = installPointerCaptureFixture();
  frames.clear();
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    const id = ++frameId;
    frames.set(id, callback);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
});
afterEach(async () => {
  for (const wrapper of wrappers.splice(0)) wrapper.unmount();
  await flushPromises();
  capture.restore();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("the actual common workspace panel presentation", () => {
  it("keeps the pane skeleton but does not mount closed panel consumers", async () => {
    const subject = await layout();
    expect(subject.wrapper.findAll("[data-panel]")).toHaveLength(2);
    expect(subject.wrapper.get(".workspace-panels").classes()).toEqual(
      expect.arrayContaining(["h-full", "w-full", "min-w-0", "min-h-0"]),
    );
    expect(subject.wrapper.find('[data-testid="panel-draft"]').exists()).toBe(
      false,
    );
    expect(subject.mounted).not.toHaveBeenCalled();
    subject.open.value = true;
    await flushPromises();
    expect(subject.wrapper.find('[data-testid="panel-draft"]').exists()).toBe(
      true,
    );
    expect(subject.mounted).toHaveBeenCalledOnce();
  });

  it("pins the actual content at the released final width during an opening", async () => {
    const subject = await layout();
    subject.open.value = true;
    await flushPromises();
    expect(subject.requestedContentWidth()).toBe("35cqw");
    await vi.advanceTimersByTimeAsync(279);
    expect(subject.requestedContentWidth()).toBe("35cqw");
    await vi.advanceTimersByTimeAsync(1);
    expect(subject.requestedContentWidth()).toBe("");
  });

  it("retires accessibility immediately while retaining the same close presentation until 280ms", async () => {
    const subject = await layout(true);
    const draft = subject.wrapper.get('[data-testid="panel-draft"]').element;
    if (!(draft instanceof HTMLElement))
      throw new Error("Expected the actual panel input");
    draft.focus();
    subject.open.value = false;
    await flushPromises();
    expect(subject.wrapper.get("#artifacts").attributes("aria-hidden")).toBe(
      "true",
    );
    expect(subject.wrapper.get("#artifacts").attributes("inert")).toBeDefined();
    expect(document.activeElement).toBe(subject.wrapper.get("#chat").element);
    expect(subject.contentHost().style.display).not.toBe("none");
    expect(subject.wrapper.get('[data-testid="panel-draft"]').element).toBe(
      draft,
    );
    await vi.advanceTimersByTimeAsync(279);
    expect(subject.unmounted).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(subject.wrapper.find('[data-testid="panel-draft"]').exists()).toBe(
      false,
    );
    expect(subject.unmounted).toHaveBeenCalledOnce();
    expect(subject.wrapper.findAll("[data-panel]")).toHaveLength(2);
  });

  it("rejects stale close completion after a rapid reopen without remounting the child", async () => {
    const subject = await layout(true);
    const draft = subject.wrapper.get('[data-testid="panel-draft"]').element;
    subject.open.value = false;
    await flushPromises();
    await vi.advanceTimersByTimeAsync(100);
    subject.open.value = true;
    await flushPromises();
    await vi.advanceTimersByTimeAsync(180);
    expect(subject.wrapper.get('[data-testid="panel-draft"]').element).toBe(
      draft,
    );
    expect(subject.requestedContentWidth()).toBe("35cqw");
    expect(subject.unmounted).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(100);
    expect(subject.requestedContentWidth()).toBe("");
    expect(subject.mounted).toHaveBeenCalledOnce();
  });

  it("only commits actual release events and allows a collapse drag to reverse before release", async () => {
    const subject = await layout(true);
    subject.panelSize.value = 55;
    await nextTick();
    expect(subject.persisted).not.toHaveBeenCalled();
    subject.panelSize.value = 35;
    await nextTick();
    const first = await startRealDrag(subject, 1000);
    expect(subject.open.value).toBe(true);
    expect(subject.panelSize.value).toBe(35);
    expect(
      subject.wrapper
        .get('[data-panel-id="side"]')
        .attributes("data-panel-size"),
    ).toBe("0");
    await first.move(550);
    await first.release(550);
    expect(subject.open.value).toBe(true);
    expect(subject.panelSize.value).toBe(45);
    const collapsing = await startRealDrag(subject, 1000);
    await collapsing.release(1000);
    expect(subject.open.value).toBe(false);
  });

  it("ends the opening pin on the native actual keyboard resize before persisting its released size", async () => {
    const subject = await layout();
    subject.open.value = true;
    await flushPromises();
    expect(subject.requestedContentWidth()).toBe("35cqw");
    await subject.wrapper
      .get('[role="separator"]')
      .trigger("keydown", { key: "ArrowLeft" });
    await flushPromises();
    expect(subject.panelSize.value).toBeGreaterThan(35);
    expect(subject.requestedContentWidth()).toBe("");
    await vi.advanceTimersByTimeAsync(280);
    expect(subject.requestedContentWidth()).toBe("");
  });

  it("renders the actual grip and uses React's keyboard step and pane constraints", async () => {
    const source = await layout(true);
    const handle = source.wrapper.get('[role="separator"]');
    expect(handle.attributes("aria-orientation")).toBe("vertical");
    expect(handle.attributes("tabindex")).toBe("0");
    const grip = handle.find("div");
    expect(grip.exists()).toBe(true);
    expect(grip.classes()).toEqual(
      expect.arrayContaining(["h-4", "w-3", "rounded-xs", "border"]),
    );
    const icon = grip.find("svg");
    expect(icon.exists()).toBe(true);
    expect(icon.classes()).toContain("size-2.5");
    await handle.trigger("keydown", { key: "ArrowLeft" });
    expect(source.panelSize.value).toBe(40);
    await handle.trigger("keydown", { key: "Home" });
    expect(source.panelSize.value).toBe(70);
    expect(
      source.wrapper
        .get('[data-panel-id="main"]')
        .attributes("data-panel-size"),
    ).toBe("30");
    await handle.trigger("keydown", { key: "End" });
    expect(source.open.value).toBe(false);
    expect(source.panelSize.value).toBe(70);
    expect(handle.attributes("aria-disabled")).toBe("true");
    expect(handle.attributes("tabindex")).toBe("-1");
    source.open.value = true;
    await nextTick();
    expect(
      source.wrapper
        .get('[data-panel-id="side"]')
        .attributes("data-panel-size"),
    ).toBe("70");
  });
  it("does not let a previous close focus fallback steal focus after the caller reopens nextTick", async () => {
    const source = await layout(true);
    const input = source.wrapper.get('[data-testid="panel-draft"]').element;
    if (!(input instanceof HTMLElement))
      throw new Error("Expected actual input");
    input.focus();
    // A real caller can reverse from its post-flush close reaction; both DOM
    // commits then finish before an old nextTick continuation would resume.
    const stop = watch(
      source.open,
      (open) => {
        if (!open) source.open.value = true;
        else input.focus();
      },
      { flush: "post" },
    );
    source.open.value = false;
    await flushPromises();
    stop();
    expect(document.activeElement).toBe(input);
    expect(source.wrapper.get("#artifacts").attributes("aria-hidden")).toBe(
      "false",
    );
  });

  it("retires the old child when the owner changes even if the same kind stays open", async () => {
    const source = await layout(true);
    const old = source.wrapper.get('[data-testid="panel-draft"]').element;
    source.ownerKey.value = "owner-b";
    await nextTick();
    expect(source.wrapper.get('[data-testid="panel-draft"]').element).not.toBe(
      old,
    );
    expect(old.isConnected).toBe(false);
    expect(source.unmounted).toHaveBeenCalledOnce();
    expect(source.mounted).toHaveBeenCalledTimes(2);
    expect(source.wrapper.get("#artifacts").attributes("aria-hidden")).toBe(
      "false",
    );
  });

  it("retires a closing owner before the next DOM commit and cancels its exit deadline", async () => {
    const source = await layout(true);
    source.open.value = false;
    await nextTick();
    source.ownerKey.value = "owner-b";
    await nextTick();
    expect(source.wrapper.find('[data-testid="panel-draft"]').exists()).toBe(
      false,
    );
    source.open.value = true;
    await nextTick();
    const fresh = source.wrapper.get('[data-testid="panel-draft"]').element;
    await vi.advanceTimersByTimeAsync(280);
    expect(source.wrapper.get('[data-testid="panel-draft"]').element).toBe(
      fresh,
    );
    expect(source.mounted).toHaveBeenCalledTimes(2);
  });

  it("keeps the outgoing padding while closed and changes kind without starting a size animation", async () => {
    const source = await layout(true);
    source.padded.value = true;
    source.panelKey.value = "artifacts";
    await nextTick();
    expect(source.contentHost().classList.contains("p-4")).toBe(true);
    expect(source.wrapper.get(".workspace-panels").classes()).not.toContain(
      "workspace-panels--animating",
    );
    source.open.value = false;
    source.padded.value = false;
    await nextTick();
    expect(source.contentHost().classList.contains("p-4")).toBe(true);
    await vi.advanceTimersByTimeAsync(280);
    expect(source.wrapper.find('[data-testid="panel-draft"]').exists()).toBe(
      false,
    );
  });

  it("reopens at the last provisional positive drag size after a collapsed release", async () => {
    const source = await layout(true);
    const gesture = await startRealDrag(source, 520);
    expect(source.panelSize.value).toBe(35);
    await gesture.move(1000);
    await gesture.release(1000);
    expect(source.panelSize.value).toBe(48);
    expect(source.open.value).toBe(false);
    source.open.value = true;
    await nextTick();
    expect(source.requestedContentWidth()).toBe("48cqw");
  });

  it("uses immediate programmatic resizing outside open/close and cancels an interrupted opening", async () => {
    const source = await layout();
    source.open.value = true;
    await nextTick();
    const gesture = await startRealDrag(source, 600);
    expect(source.requestedContentWidth()).toBe("");
    expect(source.wrapper.get(".workspace-panels").classes()).not.toContain(
      "workspace-panels--animating",
    );
    source.panelSize.value = 45;
    await nextTick();
    expect(source.wrapper.get(".workspace-panels").classes()).not.toContain(
      "workspace-panels--animating",
    );
    const pane = source.wrapper.get(".workspace-panels__side-pane").element;
    if (!(pane instanceof HTMLElement))
      throw new Error("Expected actual side pane");
    expect(pane.style.flexGrow).toBe("45");
    await gesture.release(600);
    expect(source.persisted).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(280);
    expect(source.panelSize.value).toBe(45);
  });

  it("moves only the panel to the real narrow Sheet while keeping the main consumer mounted", async () => {
    const source = await layout();
    source.open.value = true;
    await nextTick();
    media.change("(max-width: 767px)", true);
    await flushPromises();
    expect(source.wrapper.find("#artifacts").exists()).toBe(false);
    expect(
      document.querySelector('[role="dialog"] [data-testid="panel-draft"]'),
    ).not.toBeNull();
    expect(source.mainMounted).toHaveBeenCalledOnce();
    media.change("(max-width: 767px)", false);
    await flushPromises();
    expect(
      source.wrapper.find("#artifacts [data-testid=panel-draft]").exists(),
    ).toBe(true);
    expect(source.mainMounted).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(280);
    expect(source.requestedContentWidth()).toBe("");
  });

  it("keeps accessibility retirement immediate in reduced motion without granting an old exit ownership", async () => {
    media.change("(prefers-reduced-motion: reduce)", true);
    const source = await layout(true);
    source.open.value = false;
    await nextTick();
    expect(source.wrapper.get("#artifacts").classes()).toContain(
      "motion-reduce:transition-none",
    );
    expect(source.wrapper.get("#artifacts").attributes("inert")).toBeDefined();
    source.open.value = true;
    await nextTick();
    await vi.advanceTimersByTimeAsync(280);
    expect(source.wrapper.find('[data-testid="panel-draft"]').exists()).toBe(
      true,
    );
  });

  it("cancels presentation deadlines and media listeners on unmount", async () => {
    const source = await layout();
    source.open.value = true;
    await nextTick();
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    source.open.value = false;
    await nextTick();
    source.wrapper.unmount();
    expect(media.listenerCount()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(500);
    expect(source.unmounted).toHaveBeenCalledOnce();
  });

  it("retires at the original close deadline when a closed presentation crosses narrow and wide", async () => {
    const source = await layout(true);
    source.open.value = false;
    await nextTick();
    await vi.advanceTimersByTimeAsync(100);
    media.change("(max-width: 767px)", true);
    await flushPromises();
    await vi.advanceTimersByTimeAsync(100);
    media.change("(max-width: 767px)", false);
    await flushPromises();
    expect(source.wrapper.find('[data-testid="panel-draft"]').exists()).toBe(
      true,
    );
    await vi.advanceTimersByTimeAsync(79);
    expect(source.wrapper.find('[data-testid="panel-draft"]').exists()).toBe(
      true,
    );
    await vi.advanceTimersByTimeAsync(1);
    expect(source.wrapper.find('[data-testid="panel-draft"]').exists()).toBe(
      false,
    );
    source.open.value = true;
    await nextTick();
    expect(source.wrapper.find('[data-testid="panel-draft"]').exists()).toBe(
      true,
    );
  });

  it("does not close the current narrow Sheet when an earlier desktop drag releases", async () => {
    const source = await layout(true);
    const gesture = await startRealDrag(source);
    expect(
      source.wrapper
        .get(".workspace-panels__side-pane")
        .attributes("data-panel-size"),
    ).toBe("30");
    media.change("(max-width: 767px)", true);
    await flushPromises();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    await gesture.release(700);
    expect(source.open.value).toBe(true);
    expect(source.persisted).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(100);
  });

  it("does not persist an old owner's real captured release into the next owner", async () => {
    const source = await layout(true);
    const gesture = await startRealDrag(source);
    source.ownerKey.value = "owner-b";
    source.panelSize.value = 50;
    await nextTick();
    await gesture.release(700);
    expect(source.open.value).toBe(true);
    expect(source.panelSize.value).toBe(50);
    expect(source.persisted).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(100);
  });

  it("retires a held gesture on owner replacement even when the declared pane sizes stay equal", async () => {
    const source = await layout(true);
    const gesture = await startRealDrag(source);
    expect(
      source.wrapper
        .get('[data-panel-id="side"]')
        .attributes("data-panel-size"),
    ).toBe("30");
    source.ownerKey.value = "owner-b";
    await nextTick();
    expect(capture.captures.size).toBe(0);
    expect(
      source.wrapper
        .get('[data-panel-id="side"]')
        .attributes("data-panel-size"),
    ).toBe("35");
    await gesture.release(700);
    expect(source.panelSize.value).toBe(35);
    expect(source.persisted).not.toHaveBeenCalled();
  });

  it("retires the captured gesture and resource handlers when unmounted mid-drag", async () => {
    const source = await layout(true);
    const gesture = await startRealDrag(source);
    expect(capture.captures.has(7)).toBe(true);
    source.wrapper.unmount();
    expect(capture.captures.size).toBe(0);
    expect(capture.releases).toContain(7);
    expect(frames.size).toBe(0);
    await gesture.move(800);
    await gesture.release(800);
    expect(source.persisted).not.toHaveBeenCalled();
    expect(frames.size).toBe(0);
    expect(document.documentElement.style.cursor).toBe("");
  });
});
