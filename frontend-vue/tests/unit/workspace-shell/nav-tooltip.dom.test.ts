/*
  【文件职责】     禁用 Agents 入口使用真实 Tooltip，保留独立、常驻的可访问说明。
  【架构位置】     Workspace navigation DOM contract
  【依赖关系】     WorkspaceNavChatList 与真实 sidebar/Tooltip primitives。
*/
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { defineComponent, nextTick, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import WorkspaceNavChatList from "@/components/workspace/WorkspaceNavChatList.vue";
import { enUS } from "@/core/i18n/locales/en-US";

const enabled = ref(false);
vi.mock("@/composables/useWorkspaceFeatures", () => ({
  useAgentsApiEnabled: () => ({ agentsApiEnabled: enabled }),
}));
vi.mock("@/composables/useWorkspaceSidebar", () => ({
  useWorkspaceSidebar: () => ({ collapsed: ref(false) }),
}));

beforeEach(() => {
  enabled.value = false;
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  vi.stubGlobal("useNuxtApp", () => ({ $i18n: { t: ref(enUS) } }));
  vi.stubGlobal("useRoute", () => ({ path: "/workspace/chats/new" }));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});
enableAutoUnmount(afterEach);

function fixture() {
  return mount(WorkspaceNavChatList, {
    attachTo: document.body,
    global: {
      stubs: {
        NuxtLink: defineComponent({
          props: ["to"],
          template: '<a :href="to"><slot /></a>',
        }),
      },
    },
  });
}

const content = () =>
  document.querySelector(
    '[data-slot="tooltip-content"]:not([data-state="closed"])',
  );
const reason = () => document.getElementById("agents-disabled-description");

describe("disabled Agents tooltip", () => {
  it("opens a real right-side Tooltip from the hoverable wrapper", async () => {
    const wrapper = fixture();
    const button = wrapper.get<HTMLButtonElement>(
      'button[aria-disabled="true"]',
    );
    expect(
      wrapper.find('[data-slot="tooltip-trigger"]:has(button)').exists(),
    ).toBe(true);
    const trigger = wrapper.get('[data-slot="tooltip-trigger"]:has(button)');
    expect(trigger.element).toBe(button.element.parentElement);
    expect(trigger.attributes("tabindex")).toBeUndefined();
    expect(wrapper.find('a[href="/workspace/agents"]').exists()).toBe(false);
    expect(button.attributes("aria-describedby")).toBe(reason()?.id);
    expect(reason()?.textContent?.trim()).toBe(
      enUS.sidebar.agentsDisabledTooltip,
    );
    expect(content()).toBeNull();
    await trigger.trigger("pointermove", { pointerType: "mouse" });
    await vi.advanceTimersByTimeAsync(0);
    await nextTick();
    expect(content()?.getAttribute("data-side")).toBe("right");
    expect(content()?.textContent ?? "").toContain(
      enUS.sidebar.agentsDisabledTooltip,
    );
    expect(button.attributes("aria-describedby")).toBe(reason()?.id);
  });

  it("uses native descendant focus without adding a tab stop and closes on Escape", async () => {
    const wrapper = fixture();
    const button = wrapper.get<HTMLButtonElement>(
      'button[aria-disabled="true"]',
    );
    button.element.focus();
    await nextTick();
    expect(document.activeElement).toBe(button.element);
    expect(content()?.getAttribute("data-side")).toBe("right");
    expect(button.attributes("aria-describedby")).toBe(reason()?.id);
    await button.trigger("keydown", { key: "Escape" });
    await nextTick();
    expect(content()).toBeNull();
    expect(document.activeElement).toBe(button.element);
    expect(reason()?.textContent?.trim()).toBe(
      enUS.sidebar.agentsDisabledTooltip,
    );
    button.element.blur();
    await nextTick();
    button.element.focus();
    await nextTick();
    expect(content()?.textContent ?? "").toContain(
      enUS.sidebar.agentsDisabledTooltip,
    );
    button.element.blur();
    await nextTick();
    expect(content()).toBeNull();
  });

  it("retires focused content across feature admission changes and unmount", async () => {
    const wrapper = fixture();
    wrapper
      .get<HTMLButtonElement>('button[aria-disabled="true"]')
      .element.focus();
    await nextTick();
    expect(content()?.textContent ?? "").toContain(
      enUS.sidebar.agentsDisabledTooltip,
    );
    enabled.value = true;
    await nextTick();
    expect(content()).toBeNull();
    expect(wrapper.find('a[href="/workspace/agents"]').exists()).toBe(true);
    enabled.value = false;
    await nextTick();
    expect(content()).toBeNull();
    const button = wrapper.get<HTMLButtonElement>(
      'button[aria-disabled="true"]',
    );
    button.element.focus();
    await nextTick();
    expect(content()?.textContent ?? "").toContain(
      enUS.sidebar.agentsDisabledTooltip,
    );
    wrapper.unmount();
    await vi.advanceTimersByTimeAsync(500);
    expect(content()).toBeNull();
  });
});
