/** Real mounted splitter; only missing capture and DOM geometry are platform fixtures. */
import { mount, type VueWrapper } from "@vue/test-utils";
import { defineComponent, h, nextTick, onMounted } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ResizablePanels,
  type ResizableLayoutEvent,
} from "@/components/ui/resizable";
import { installPointerCaptureFixture } from "../helpers/pointer-capture";

const panels = [
  { id: "main", minSize: 30 },
  { id: "side", minSize: 20, collapsible: true },
];
const wrappers: VueWrapper[] = [];
let capture: ReturnType<typeof installPointerCaptureFixture>;
beforeEach(() => {
  capture = installPointerCaptureFixture();
});
afterEach(() => {
  for (const wrapper of wrappers.splice(0)) wrapper.unmount();
  capture.restore();
  vi.restoreAllMocks();
});

function subject(extra: Record<string, unknown> = {}) {
  const wrapper = mount(ResizablePanels, {
    attachTo: document.body,
    props: { panels, sizes: [60, 40], ownerKey: "a", ...extra },
    slots: {
      main: '<input data-main value="retained">',
      side: '<input data-side value="draft">',
      handle: "<span data-grip>Grip</span>",
    },
  });
  wrappers.push(wrapper);
  vi.spyOn(wrapper.element, "getBoundingClientRect").mockReturnValue(
    new DOMRect(0, 0, 1001, 400),
  );
  for (const pane of wrapper.findAll("[data-panel]"))
    vi.spyOn(pane.element, "getBoundingClientRect").mockImplementation(
      () =>
        new DOMRect(0, 0, Number(pane.attributes("data-panel-size")) * 10, 400),
    );
  return wrapper;
}
function handle(wrapper: VueWrapper, index = 0) {
  return wrapper.findAll<HTMLElement>("[data-resize-handle]")[index]!.element;
}
function pointer(
  element: Element,
  type: string,
  x = 600,
  id = 1,
  extra: PointerEventInit = {},
) {
  const event = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    pointerId: id,
    button: 0,
    isPrimary: true,
    ...extra,
  });
  element.dispatchEvent(event);
  return event;
}
function key(element: Element, value: string, extra: KeyboardEventInit = {}) {
  const event = new KeyboardEvent("keydown", {
    key: value,
    bubbles: true,
    cancelable: true,
    ...extra,
  });
  element.dispatchEvent(event);
  return event;
}
const sizes = (wrapper: VueWrapper) =>
  wrapper
    .findAll("[data-panel]")
    .map((pane) => Number(pane.attributes("data-panel-size")));
const payloads = (wrapper: VueWrapper, name: "resize" | "resized") =>
  (wrapper.emitted(name) ?? []).map((args) => args[0] as ResizableLayoutEvent);

describe("native resize transaction", () => {
  it("publishes synchronous actual moves, commits once only at real up, and releases capture before callback", async () => {
    const wrapper = subject({
      onResized: () => expect(capture.captures.size).toBe(0),
    });
    const grip = handle(wrapper);
    pointer(grip, "pointerdown");
    const move = pointer(grip, "pointermove", 650);
    expect(payloads(wrapper, "resize")[0]).toEqual({
      event: move,
      panes: [
        { id: "main", size: 65 },
        { id: "side", size: 35 },
      ],
    });
    expect(payloads(wrapper, "resized")).toHaveLength(0);
    const up = pointer(grip, "pointerup", 650);
    expect(payloads(wrapper, "resized")[0]?.event).toBe(up);
    pointer(grip, "pointerup", 650);
    expect(payloads(wrapper, "resized")).toHaveLength(1);
    await nextTick();
    expect(sizes(wrapper)).toEqual([65, 35]);
    expect(capture.captures.size).toBe(0);
  });

  it.each([
    "pointercancel",
    "lostpointercapture",
    "blur",
    "hidden",
    "disabled",
    "owner",
    "unmount",
  ])(
    "retires on %s, never commits, and admits the first new gesture",
    async (reason) => {
      const onResize = vi.fn(),
        onResized = vi.fn();
      const wrapper = subject({ onResize, onResized });
      const grip = handle(wrapper);
      let visibility: ReturnType<typeof vi.spyOn> | undefined;
      pointer(grip, "pointerdown");
      pointer(grip, "pointermove", 650);
      if (reason === "blur") window.dispatchEvent(new Event("blur"));
      else if (reason === "hidden") {
        visibility = vi
          .spyOn(document, "visibilityState", "get")
          .mockReturnValue("hidden");
        document.dispatchEvent(new Event("visibilitychange"));
      } else if (reason === "disabled")
        await wrapper.setProps({ disabled: true });
      else if (reason === "owner")
        await wrapper.setProps({ ownerKey: "b", sizes: [70, 30] });
      else if (reason === "unmount") wrapper.unmount();
      else pointer(grip, reason);
      pointer(grip, "pointermove", 680);
      pointer(grip, "pointerup", 680);
      expect(onResized).not.toHaveBeenCalled();
      expect(onResize).toHaveBeenCalledTimes(1);
      expect(capture.captures.size).toBe(0);
      if (reason === "unmount") return;
      visibility?.mockRestore();
      await wrapper.setProps({ disabled: false });
      pointer(grip, "pointerdown", 600, 2);
      pointer(grip, "pointermove", 610, 2);
      pointer(grip, "pointerup", 610, 2);
      expect(payloads(wrapper, "resized")).toHaveLength(1);
    },
  );

  it("uses declared sizes after an owner change and does not transfer a prior preview", async () => {
    const wrapper = subject();
    pointer(handle(wrapper), "pointerdown");
    pointer(handle(wrapper), "pointermove", 650);
    await wrapper.setProps({ ownerKey: "b" });
    expect(sizes(wrapper)).toEqual([60, 40]);
    pointer(handle(wrapper), "pointerup", 650);
    expect(payloads(wrapper, "resized")).toHaveLength(0);
  });

  it("ignores foreign pointers, nonprimary and nonleft buttons, and unchanged release", () => {
    const wrapper = subject();
    const grip = handle(wrapper);
    pointer(grip, "pointerdown", 600, 1, { button: 2 });
    pointer(grip, "pointerdown", 600, 1, { isPrimary: false });
    expect(capture.captures.size).toBe(0);
    pointer(grip, "pointerdown");
    pointer(grip, "pointermove", 700, 2);
    pointer(grip, "pointerup", 700, 2);
    expect(capture.captures.size).toBe(1);
    pointer(grip, "pointerup");
    expect(payloads(wrapper, "resize")).toHaveLength(0);
    expect(payloads(wrapper, "resized")).toHaveLength(0);
  });

  it("keeps simultaneous groups independent and restores only the retiring instance", () => {
    const a = subject(),
      b = subject();
    pointer(handle(a), "pointerdown", 600, 11);
    pointer(handle(b), "pointerdown", 600, 12);
    a.unmount();
    expect(capture.captures.has(12)).toBe(true);
    pointer(handle(b), "pointermove", 650, 12);
    pointer(handle(b), "pointerup", 650, 12);
    expect(payloads(b, "resized")).toHaveLength(1);
    expect(document.body.style.cursor).toBe("");
    expect(document.body.style.userSelect).toBe("");
  });

  it("does not reacquire or commit after resize callback synchronously unmounts the owner", () => {
    const wrapper = subject({ onResize: () => wrapper.unmount() });
    const grip = handle(wrapper);
    pointer(grip, "pointerdown");
    pointer(grip, "pointermove", 650);
    pointer(grip, "pointerup", 650);
    expect(payloads(wrapper, "resized")).toHaveLength(0);
    expect(capture.captures.size).toBe(0);
  });

  it("consumes the final up coordinate even without a preceding move", () => {
    const wrapper = subject();
    pointer(handle(wrapper), "pointerdown");
    const up = pointer(handle(wrapper), "pointerup", 650);
    expect(payloads(wrapper, "resize")[0]).toEqual({
      event: up,
      panes: [
        { id: "main", size: 65 },
        { id: "side", size: 35 },
      ],
    });
    expect(payloads(wrapper, "resized")[0]?.panes).toEqual([
      { id: "main", size: 65 },
      { id: "side", size: 35 },
    ]);
  });

  it("does not commit when the final up's resize callback destroys the group", () => {
    const committed = vi.fn();
    const wrapper = subject({
      onResize: () => wrapper.unmount(),
      onResized: committed,
    });
    const grip = handle(wrapper);
    pointer(grip, "pointerdown");
    pointer(grip, "pointerup", 650);
    expect(committed).not.toHaveBeenCalled();
    expect(capture.captures.size).toBe(0);
  });

  it("also fences a keyboard resize callback which synchronously unmounts the group", () => {
    const committed = vi.fn();
    const wrapper = subject({
      onResize: () => wrapper.unmount(),
      onResized: committed,
    });
    key(handle(wrapper), "ArrowRight");
    expect(committed).not.toHaveBeenCalled();
    expect(capture.captures.size).toBe(0);
  });

  it("keeps an echoed preview and equal constraint objects in the same live transaction", async () => {
    const wrapper = subject();
    const grip = handle(wrapper);
    pointer(grip, "pointerdown");
    pointer(grip, "pointermove", 650);
    await wrapper.setProps({
      sizes: [65, 35],
      panels: panels.map((panel) => ({ ...panel })),
    });
    expect(capture.captures.size).toBe(1);
    pointer(grip, "pointermove", 660);
    pointer(grip, "pointerup", 660);
    expect(payloads(wrapper, "resized")).toHaveLength(1);
    expect(payloads(wrapper, "resized")[0]?.panes).toEqual([
      { id: "main", size: 66 },
      { id: "side", size: 34 },
    ]);
  });

  it("retires a live gesture for an external size or constraint change", async () => {
    const wrapper = subject();
    const grip = handle(wrapper);
    pointer(grip, "pointerdown");
    pointer(grip, "pointermove", 650);
    await wrapper.setProps({ sizes: [70, 30] });
    pointer(grip, "pointerup", 650);
    expect(payloads(wrapper, "resized")).toHaveLength(0);
    expect(sizes(wrapper)).toEqual([70, 30]);
    pointer(grip, "pointerdown", 600, 2);
    pointer(grip, "pointermove", 610, 2);
    await wrapper.setProps({
      panels: [{ id: "main", minSize: 40 }, panels[1]!],
    });
    pointer(grip, "pointerup", 610, 2);
    expect(capture.captures.size).toBe(0);
    expect(payloads(wrapper, "resized")).toHaveLength(0);
  });

  it("pairs per-instance blur/visibility subscriptions on repeated cancel and disposal", () => {
    const addWindow = vi.spyOn(window, "addEventListener"),
      removeWindow = vi.spyOn(window, "removeEventListener");
    const addDocument = vi.spyOn(document, "addEventListener"),
      removeDocument = vi.spyOn(document, "removeEventListener");
    const wrapper = subject();
    for (const id of [1, 2]) {
      pointer(handle(wrapper), "pointerdown", 600, id);
      pointer(handle(wrapper), "pointercancel", 600, id);
    }
    pointer(handle(wrapper), "pointerdown", 600, 3);
    wrapper.unmount();
    const blurAdds = addWindow.mock.calls.filter(
      ([name]) => String(name) === "blur",
    );
    const blurRemoves = removeWindow.mock.calls.filter(
      ([name]) => String(name) === "blur",
    );
    const hiddenAdds = addDocument.mock.calls.filter(
      ([name]) => name === "visibilitychange",
    );
    const hiddenRemoves = removeDocument.mock.calls.filter(
      ([name]) => name === "visibilitychange",
    );
    expect(blurAdds).toHaveLength(3);
    expect(hiddenAdds).toHaveLength(3);
    expect(blurRemoves.map(([, listener]) => listener)).toEqual(
      blurAdds.map(([, listener]) => listener),
    );
    expect(hiddenRemoves.map(([, listener]) => listener)).toEqual(
      hiddenAdds.map(([, listener]) => listener),
    );
    expect(capture.releases).toEqual([1, 2, 3]);
  });

  it("accepts authoritative programmatic updates without user events or remounting pane slots", async () => {
    const mounted = vi.fn();
    const Main = defineComponent({
      setup() {
        onMounted(mounted);
        return () => h("input");
      },
    });
    const wrapper = mount(ResizablePanels, {
      props: { panels, sizes: [60, 40], ownerKey: "a" },
      slots: { main: () => h(Main) },
    });
    wrappers.push(wrapper);
    const input = wrapper.get("input").element;
    input.value = "unsaved";
    await wrapper.setProps({ sizes: [100, 0] });
    await wrapper.setProps({ sizes: [60, 40] });
    expect(wrapper.get("input").element).toBe(input);
    expect(input.value).toBe("unsaved");
    expect(mounted).toHaveBeenCalledTimes(1);
    expect(payloads(wrapper, "resize")).toHaveLength(0);
    expect(payloads(wrapper, "resized")).toHaveLength(0);
  });

  it("supports four keyed panes and three handles without remounting main on declarative collapse", async () => {
    const wrapper = subject({
      panels: [
        { id: "main", minSize: 20 },
        { id: "r1" },
        { id: "r2" },
        { id: "r3" },
      ],
      sizes: [55, 15, 15, 15],
    });
    const main = wrapper.get("[data-main]").element;
    expect(wrapper.findAll("[data-resize-handle]")).toHaveLength(3);
    await wrapper.setProps({ sizes: [100, 0, 0, 0] });
    expect(sizes(wrapper)).toEqual([100, 0, 0, 0]);
    await wrapper.setProps({ sizes: [55, 15, 15, 15] });
    pointer(handle(wrapper), "pointerdown", 550);
    pointer(handle(wrapper), "pointermove", 630);
    pointer(handle(wrapper), "pointerup", 630);
    await nextTick();
    expect(sizes(wrapper)).toEqual([63, 7, 15, 15]);
    expect(wrapper.get("[data-main]").element).toBe(main);
  });
});

describe("constraints and keyboard semantics", () => {
  it("uses the React min30/min20, collapsed0 midpoint10 contract", async () => {
    const wrapper = subject();
    pointer(handle(wrapper), "pointerdown");
    pointer(handle(wrapper), "pointermove", 900);
    await nextTick();
    expect(sizes(wrapper)).toEqual([80, 20]);
    pointer(handle(wrapper), "pointermove", 901);
    await nextTick();
    expect(sizes(wrapper)).toEqual([100, 0]);
    pointer(handle(wrapper), "pointermove", -500);
    await nextTick();
    expect(sizes(wrapper)).toEqual([30, 70]);
  });

  it("uses native Arrow5 without Shift inflation, bounded Home/End, and Enter only for the preceding collapsible pane", async () => {
    const wrapper = subject();
    const grip = handle(wrapper);
    const event = key(grip, "ArrowLeft", { shiftKey: true });
    await nextTick();
    expect(sizes(wrapper)).toEqual([55, 45]);
    expect(payloads(wrapper, "resized")[0]?.event).toBe(event);
    key(grip, "Home");
    await nextTick();
    expect(sizes(wrapper)).toEqual([30, 70]);
    key(grip, "End");
    await nextTick();
    expect(sizes(wrapper)).toEqual([100, 0]);
    key(grip, "ArrowLeft");
    await nextTick();
    expect(sizes(wrapper)).toEqual([80, 20]);
    const count = payloads(wrapper, "resized").length;
    key(grip, "Enter");
    await nextTick();
    expect(sizes(wrapper)).toEqual([80, 20]);
    expect(payloads(wrapper, "resized")).toHaveLength(count);
  });

  it("publishes real unique ARIA references and disabled tab semantics", async () => {
    const parent = mount(
      defineComponent({
        setup: () => () =>
          h("main", [
            h(ResizablePanels, { panels, sizes: [60, 40], ownerKey: "a" }),
            h(ResizablePanels, { panels, sizes: [60, 40], ownerKey: "b" }),
          ]),
      }),
    );
    wrappers.push(parent);
    const [a, b] = parent.findAllComponents(ResizablePanels);
    if (!a || !b) throw new Error("Expected two groups in the same Vue app");
    const grip = a.get('[role="separator"]');
    expect(grip.attributes("aria-controls")).toBe(
      a.get("[data-panel]").attributes("id"),
    );
    expect(grip.attributes("aria-controls")).not.toBe(
      b.get("[data-panel]").attributes("id"),
    );
    expect(grip.attributes("aria-orientation")).toBe("vertical");
    expect(grip.attributes("aria-valuenow")).toBe("60");
    expect(grip.attributes("aria-valuemin")).toBe("30");
    expect(grip.attributes("aria-valuemax")).toBe("100");
    expect(grip.attributes("tabindex")).toBe("0");
    const disabled = subject({ disabled: true });
    expect(handle(disabled).getAttribute("aria-disabled")).toBe("true");
    expect(handle(disabled).getAttribute("tabindex")).toBe("-1");
    key(handle(disabled), "ArrowRight");
    expect(payloads(disabled, "resize")).toHaveLength(0);
  });

  it("cycles F6 only through its own handles and leaves modified/editable key events alone", () => {
    const a = subject({
        panels: [{ id: "main" }, { id: "side" }, { id: "third" }],
        sizes: [50, 25, 25],
      }),
      b = subject();
    handle(a).focus();
    key(handle(a), "F6");
    expect(document.activeElement).toBe(handle(a, 1));
    key(handle(a, 1), "F6", { shiftKey: true });
    expect(document.activeElement).toBe(handle(a));
    expect(document.activeElement).not.toBe(handle(b));
    key(handle(a), "ArrowRight", { ctrlKey: true });
    expect(payloads(a, "resize")).toHaveLength(0);
  });
});
