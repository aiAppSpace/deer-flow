/*
  【文件职责】     验证 Tooltip 默认与显式 hover 延迟、原生焦点和关闭生命周期。
  【架构位置】     L2 DOM contract
  【依赖关系】     真实 Tooltip/Trigger/Content 与 Reka；不替换 primitive。
*/
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { defineComponent, nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] }));
afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});
enableAutoUnmount(afterEach);

function fixture(delayDuration?: number, forceMount = false) {
  return mount(
    defineComponent({
      components: { Tooltip, TooltipContent, TooltipTrigger },
      setup: () => ({ delayDuration, forceMount }),
      template: `<Tooltip :delay-duration="delayDuration">
        <TooltipTrigger><button type="button">Explain</button></TooltipTrigger>
        <TooltipContent :force-mount="forceMount">Explanation</TooltipContent>
      </Tooltip>`,
    }),
    { attachTo: document.body },
  );
}

const content = () =>
  document.querySelector(
    '[data-slot="tooltip-content"]:not([data-state="closed"])',
  );

describe("Tooltip public lifecycle", () => {
  it("does not dismiss its own open broadcast when content remains mounted", async () => {
    const wrapper = fixture(0, true);
    await nextTick();
    const trigger = wrapper.get("button");
    trigger.element.focus();
    await nextTick();
    expect(trigger.attributes("data-state")).toBe("instant-open");
    trigger.element.blur();
    await nextTick();
    expect(trigger.attributes("data-state")).toBe("closed");
    trigger.element.focus();
    await nextTick();
    expect(trigger.attributes("data-state")).toBe("instant-open");
  });
  it("keeps retained independent roots exclusive and still accepts legacy close broadcasts", async () => {
    const first = fixture(0, true);
    const second = fixture(0, true);
    await nextTick();
    first.get("button").element.focus();
    await nextTick();
    expect(first.get("button").attributes("data-state")).toBe("instant-open");
    second.get("button").element.focus();
    await nextTick();
    expect(first.get("button").attributes("data-state")).toBe("closed");
    expect(second.get("button").attributes("data-state")).toBe("instant-open");
    document.dispatchEvent(new CustomEvent("tooltip.open"));
    await nextTick();
    expect(second.get("button").attributes("data-state")).toBe("closed");
  });
  it("closes a focused tooltip when another independent provider opens one without moving focus", async () => {
    const first = fixture();
    const second = fixture();
    first.get("button").element.focus();
    await nextTick();
    expect(first.get("button").attributes("data-state")).toBe("instant-open");
    await second.get("button").trigger("pointermove", { pointerType: "mouse" });
    await vi.advanceTimersByTimeAsync(0);
    await nextTick();
    expect(first.get("button").attributes("data-state")).toBe("closed");
    expect(second.get("button").attributes("data-state")).toBe("delayed-open");
    expect(document.activeElement).toBe(first.get("button").element);
    expect(
      document.querySelectorAll(
        '[data-slot="tooltip-content"]:not([data-state="closed"])',
      ),
    ).toHaveLength(1);
    first.get("button").element.blur();
    first.get("button").element.focus();
    await nextTick();
    expect(first.get("button").attributes("data-state")).toBe("instant-open");
    expect(second.get("button").attributes("data-state")).toBe("closed");
  });
  it("opens on the first hover task without an added default delay", async () => {
    const wrapper = fixture();
    await wrapper
      .get("button")
      .trigger("pointermove", { pointerType: "mouse" });
    await vi.advanceTimersByTimeAsync(0);
    await nextTick();
    expect(content()?.textContent ?? "").toContain("Explanation");
  });

  it("preserves an explicit caller delay and cancels hover before it elapses", async () => {
    const wrapper = fixture(120);
    const trigger = wrapper.get("button");
    await trigger.trigger("pointermove", { pointerType: "mouse" });
    await vi.advanceTimersByTimeAsync(119);
    expect(content()).toBeNull();
    await trigger.trigger("pointerleave", { pointerType: "mouse" });
    await vi.advanceTimersByTimeAsync(1);
    expect(content()).toBeNull();
    await trigger.trigger("pointermove", { pointerType: "mouse" });
    await vi.advanceTimersByTimeAsync(120);
    expect(content()?.textContent ?? "").toContain("Explanation");
  });

  it("opens with actual button focus and closes on blur", async () => {
    const wrapper = fixture(120);
    wrapper.get("button").element.focus();
    await nextTick();
    expect(content()?.textContent ?? "").toContain("Explanation");
    wrapper.get("button").element.blur();
    await nextTick();
    expect(content()).toBeNull();
  });

  it("retires a pending hover when its owner unmounts", async () => {
    const wrapper = fixture(120);
    await wrapper
      .get("button")
      .trigger("pointermove", { pointerType: "mouse" });
    wrapper.unmount();
    await vi.advanceTimersByTimeAsync(120);
    expect(content()).toBeNull();
  });
});
