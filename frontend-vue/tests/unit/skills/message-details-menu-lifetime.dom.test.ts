import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MessageDetailsMenu from "@/components/workspace/message-details/MessageDetailsMenu.vue";

// Real menu, Reka Presence and event handlers. Happy DOM exposes CSS names but
// does not run animations; their completion is dispatched at the browser boundary.
const wrappers: ReturnType<typeof mount>[] = [];
let animationStyle: HTMLStyleElement;
beforeEach(() => {
  vi.useFakeTimers();
  animationStyle = document.createElement("style");
  animationStyle.textContent = `
    [data-slot="dropdown-menu-content"][data-state="open"] {
      animation-name: details-enter;
      animation-duration: 0.2s;
    }
    [data-slot="dropdown-menu-content"][data-state="closed"] {
      animation-name: details-exit;
      animation-duration: 0.2s;
    }
  `;
  document.head.append(animationStyle);
});
afterEach(async () => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  animationStyle.remove();
  document.body.innerHTML = "";
  await flushPromises();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function host() {
  const select = vi.fn();
  const wrapper = mount(MessageDetailsMenu, {
    attachTo: document.body,
    props: {
      label: "Skills used",
      title: "Skills",
      entries: [{ id: "skill", title: "Selected skill", onSelect: select }],
    },
  });
  wrappers.push(wrapper);
  const trigger = wrapper.get('button[aria-label="Skills used"]');
  return { wrapper, trigger, select };
}

function menu() {
  const element = document.querySelector<HTMLElement>('[role="menu"]');
  expect(element).not.toBeNull();
  return element!;
}

async function enter(element: HTMLElement) {
  element.dispatchEvent(
    new PointerEvent("pointerenter", { pointerType: "mouse" }),
  );
  await flushPromises();
}

async function leave(element: HTMLElement) {
  element.dispatchEvent(
    new PointerEvent("pointerleave", { pointerType: "mouse" }),
  );
  await flushPromises();
}

async function selectAndRetainExit() {
  const state = host();
  await state.trigger.trigger("click", { button: 0, ctrlKey: false });
  await flushPromises();
  const content = menu();
  expect(getComputedStyle(content).animationName).toBe("details-enter");
  content.dispatchEvent(new Event("animationstart"));
  content.querySelector<HTMLElement>('[role="menuitem"]')!.click();
  await flushPromises();
  expect(state.select).toHaveBeenCalledOnce();
  expect(state.trigger.attributes("data-state")).toBe("closed");
  expect(content.isConnected).toBe(true);
  expect(content.dataset.state).toBe("closed");
  expect(getComputedStyle(content).animationName).toBe("details-exit");
  return { ...state, content };
}

describe("message details menu interaction lifetime", () => {
  it("does not reopen when the exiting selected menu crosses the stationary pointer", async () => {
    const { trigger, content } = await selectAndRetainExit();
    await leave(content);
    await enter(content);
    await vi.advanceTimersByTimeAsync(120);
    expect(trigger.attributes("data-state")).toBe("closed");
    expect(content.dataset.state).toBe("closed");
  });

  it("still opens from a new trigger hover after selecting a detail", async () => {
    const { trigger, content } = await selectAndRetainExit();
    const ended = new Event("animationend");
    Object.defineProperty(ended, "animationName", { value: "details-exit" });
    content.dispatchEvent(ended);
    await flushPromises();
    expect(content.isConnected).toBe(false);
    await enter(trigger.element as HTMLElement);
    await vi.advanceTimersByTimeAsync(120);
    expect(trigger.attributes("data-state")).toBe("open");
    expect(menu().dataset.state).toBe("open");
  });

  it("keeps the open hover menu while moving from trigger to content, then closes on leaving", async () => {
    const { trigger } = host();
    await enter(trigger.element as HTMLElement);
    await vi.advanceTimersByTimeAsync(120);
    const content = menu();
    await leave(trigger.element as HTMLElement);
    await enter(content);
    await vi.advanceTimersByTimeAsync(180);
    expect(trigger.attributes("data-state")).toBe("open");
    await leave(content);
    await vi.advanceTimersByTimeAsync(180);
    expect(trigger.attributes("data-state")).toBe("closed");
  });
});
