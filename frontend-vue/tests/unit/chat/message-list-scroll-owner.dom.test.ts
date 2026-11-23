import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";

import MessageList from "@/components/chat/MessageList.vue";
import VirtualMessageList from "@/components/chat/VirtualMessageList.vue";
import {
  createWorkspaceToastStore,
  workspaceToastKey,
} from "@/core/workspace-shell/toast";

const wrappers: ReturnType<typeof mount>[] = [];
const clients: QueryClient[] = [];
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  clients.splice(0).forEach((client) => client.clear());
});

function render(
  completeHistoryLoad = vi.fn(async () => {}),
  realVirtual = false,
) {
  const ports = {
    scrollToTail: vi.fn(async () => {}),
    stopFollowingTail: vi.fn(),
    captureHistoryAnchor: vi.fn(),
    completeHistoryLoad,
  };
  const queryClient = new QueryClient();
  clients.push(queryClient);
  const wrapper = mount(MessageList, {
    attachTo: document.body,
    props: {
      messages: [],
      streaming: false,
      loading: false,
      threadId: "old-thread",
      hasMoreHistory: true,
      historyLoadingMore: false,
    },
    global: {
      provide: { [workspaceToastKey as symbol]: createWorkspaceToastStore() },
      plugins: [[VueQueryPlugin, { queryClient }]],
      stubs: {
        VirtualMessageList: realVirtual
          ? false
          : defineComponent({
              name: "VirtualTailProbe",
              props: [
                "followingTail",
                "ownerKey",
                "initialScroll",
                "resizeScroll",
              ],
              setup(_, { expose }) {
                expose(ports);
                return () =>
                  h("div", [
                    h("p", "Read text"),
                    h("button", { type: "button" }, "Read turn"),
                  ]);
              },
            }),
      },
    },
  });
  wrappers.push(wrapper);
  return { wrapper, ports };
}

describe("message list scroll ownership", () => {
  it.each(["browser", "pointer"])(
    "keeps the history anchor captured by the parent during the same upward %s scroll",
    async (mode) => {
      const { wrapper } = render(undefined, true);
      const child = wrapper.findComponent(VirtualMessageList);
      const viewport = wrapper.get('[role="log"] > div').element as HTMLElement;
      let top = 300;
      let height = 1800;
      Object.defineProperties(viewport, {
        scrollTop: {
          configurable: true,
          get: () => top,
          set: (value: number) => {
            top = value;
          },
        },
        scrollHeight: { configurable: true, get: () => height },
        clientHeight: { configurable: true, value: 600 },
      });
      await flushPromises();
      viewport.dispatchEvent(new Event("scroll"));
      expect(child.props("followingTail")).toBe(true);
      if (mode === "browser") {
        // A prior upward interaction arms pagination. Returning to the bottom
        // re-enables following; native focus can then scroll up without a wheel.
        await wrapper
          .get('[role="log"] > div')
          .trigger("wheel", { deltaY: -20 });
        top = 1200;
        viewport.dispatchEvent(new Event("scroll"));
        await flushPromises();
        expect(child.props("followingTail")).toBe(true);
      } else {
        await wrapper
          .get('[role="log"] > div')
          .trigger("pointerdown", { pointerType: "mouse" });
      }
      top = 40;
      viewport.dispatchEvent(new Event("scroll"));
      await flushPromises();
      expect(wrapper.emitted("loadMoreHistory")).toHaveLength(1);
      await wrapper.setProps({ historyLoadingMore: true });
      height = 2200;
      await wrapper.setProps({ historyLoadingMore: false });
      await flushPromises();
      expect(top).toBe(440);
    },
  );
  it("stops its existing tail owner on real reading focus and resumes explicit submission requests", async () => {
    const { wrapper, ports } = render();
    expect(ports.stopFollowingTail).not.toHaveBeenCalled();
    const viewport = wrapper.get('[role="log"] > div').element;
    const button = wrapper.findAll("button").at(-1)!
      .element as HTMLButtonElement;
    button.focus();
    expect(document.activeElement).toBe(button);
    expect(ports.stopFollowingTail).toHaveBeenCalledTimes(1);
    await wrapper.setProps({ streaming: true });
    await flushPromises();
    expect(ports.scrollToTail).not.toHaveBeenCalled();
    await wrapper.setProps({ tailRequest: 1 });
    await flushPromises();
    expect(ports.scrollToTail).toHaveBeenCalledExactlyOnceWith("instant");
    expect(wrapper.get('[role="log"] > div').element).toBe(viewport);
  });

  it("delegates tail and history actions without a second physical scroll writer", async () => {
    const { wrapper, ports } = render();
    const viewport = wrapper.get('[role="log"] > div').element as HTMLElement;
    const writes: number[] = [];
    Object.defineProperties(viewport, {
      scrollTop: {
        configurable: true,
        get: () => 20,
        set: (value: number) => writes.push(value),
      },
      scrollHeight: { configurable: true, get: () => 500 },
    });
    await wrapper.setProps({ tailRequest: 1 });
    await flushPromises();
    expect(ports.scrollToTail).toHaveBeenCalledExactlyOnceWith("instant");
    const button = wrapper.get('[data-testid="load-earlier-messages"]');
    await button.trigger("click");
    await button.trigger("click");
    expect(ports.stopFollowingTail).toHaveBeenCalledTimes(1);
    expect(ports.captureHistoryAnchor).toHaveBeenCalledTimes(1);
    expect(wrapper.emitted("loadMoreHistory")).toHaveLength(1);
    await wrapper.setProps({ historyLoadingMore: true });
    await wrapper.setProps({ historyLoadingMore: false });
    await flushPromises();
    expect(ports.completeHistoryLoad).toHaveBeenCalledTimes(1);
    expect(writes).toEqual([]);
  });

  it("does not let an old completion release the new thread's pagination guard", async () => {
    let resolveOld!: () => void;
    const complete = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveOld = resolve;
        }),
    );
    const { wrapper } = render(complete);
    const button = wrapper.get('[data-testid="load-earlier-messages"]');
    await button.trigger("click");
    await wrapper.setProps({ historyLoadingMore: true });
    await wrapper.setProps({ historyLoadingMore: false });
    expect(complete).toHaveBeenCalledTimes(1);
    await wrapper.setProps({ threadId: "new-thread" });
    await button.trigger("click");
    expect(wrapper.emitted("loadMoreHistory")).toHaveLength(2);
    resolveOld();
    await flushPromises();
    await button.trigger("click");
    expect(wrapper.emitted("loadMoreHistory")).toHaveLength(2);
  });
  it("preserves reading on exact prepared adoption and resets only a changed physical owner", async () => {
    const { wrapper, ports } = render();
    await wrapper.setProps({
      threadId: null,
      scrollOwnerKey: "prepared-a",
      editOwnerKey: "alice/main",
    });
    const child = () => wrapper.findComponent({ name: "VirtualTailProbe" });
    const owner = child().props("ownerKey");
    const button = wrapper.findAll("button").at(-1)!
      .element as HTMLButtonElement;
    button.focus();
    await flushPromises();
    expect(child().props("followingTail")).toBe(false);
    await wrapper.setProps({ threadId: "prepared-a" });
    expect(child().props("ownerKey")).toBe(owner);
    expect(child().props("followingTail")).toBe(false);
    await wrapper.setProps({ threadId: "thread-b", scrollOwnerKey: "owner-b" });
    expect(child().props("ownerKey")).not.toBe(owner);
    expect(child().props("followingTail")).toBe(true);
    expect(ports.scrollToTail).not.toHaveBeenCalled();
  });
  it("passes explicit initial and resize policies to its sole physical writer", async () => {
    const { wrapper } = render();
    const child = () => wrapper.findComponent({ name: "VirtualTailProbe" });
    expect(child().props("initialScroll")).toBe("smooth");
    await wrapper.setProps({
      initialScroll: "instant",
      resizeScroll: "instant",
    });
    expect(child().props("initialScroll")).toBe("instant");
    expect(child().props("resizeScroll")).toBe("instant");
  });
  it("does not turn a mouse selection pointerdown into a generic scroll escape", async () => {
    const { wrapper } = render();
    const child = wrapper.findComponent({ name: "VirtualTailProbe" });
    const viewport = wrapper.get('[role="log"] > div').element as HTMLElement;
    Object.defineProperties(viewport, {
      scrollHeight: { value: 1000 },
      clientHeight: { value: 600 },
      scrollTop: { configurable: true, value: 100 },
    });
    await wrapper.get("p").trigger("pointerdown", { pointerType: "mouse" });
    viewport.dispatchEvent(new Event("scroll"));
    await flushPromises();
    expect(child.props("followingTail")).toBe(true);
    child.vm.$emit("reading-intent");
    await flushPromises();
    expect(child.props("followingTail")).toBe(false);
  });
  it("keeps native scrollbar and touch movement as reading intents", async () => {
    for (const input of ["pointerdown", "touchstart"]) {
      const { wrapper } = render();
      const child = wrapper.findComponent({ name: "VirtualTailProbe" });
      const viewport = wrapper.get('[role="log"] > div');
      Object.defineProperties(viewport.element, {
        scrollHeight: { value: 1000 },
        clientHeight: { value: 600 },
        scrollTop: { configurable: true, value: 100 },
      });
      await viewport.trigger(input, { pointerType: "mouse" });
      await viewport.trigger("scroll");
      expect(child.props("followingTail")).toBe(false);
    }
  });
});
