/*
  `useMediaQuery` 的合同。**判词只有一条：客户端第一次渲染就拿到真值。**

  它不是「少写几行」的封装——本仓原来两份手搓副本都是 `ref(false)` + 在
  `onMounted` 里读 `matchMedia` 纠正，而父组件的 `onMounted` 跑在子组件**全部挂载
  之后**，于是窄屏首帧先挂桌面那一支、整棵子树连同它的查询起来一次再扔掉。
  端到端那一侧由 `tests/e2e/sidebar.spec.ts` 的
  「does not run the sidebar queries while the mobile drawer is closed」守着；
  这里守的是机制本身，免得下一个人「顺手」把它改回挂载后纠正。
*/

import { defineComponent, h } from "vue";

import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useMediaQuery } from "@/composables/useMediaQuery";

type Listener = (event: MediaQueryListEvent) => void;

function stubMatchMedia(matches: boolean) {
  const listeners = new Set<Listener>();
  const media = {
    matches,
    addEventListener: (_: string, listener: Listener) =>
      listeners.add(listener),
    removeEventListener: (_: string, listener: Listener) => {
      listeners.delete(listener);
    },
  };
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => media),
  );
  return {
    emit(next: boolean) {
      media.matches = next;
      for (const listener of listeners)
        listener({ matches: next } as MediaQueryListEvent);
    },
    get listenerCount() {
      return listeners.size;
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("useMediaQuery", () => {
  /*
    **这条用例的形状就是那个缺陷的形状**：探针组件是子组件，它在自己的 setup 里
    记下"我挂载的那一刻查询是什么值"。父组件的 `onMounted` 此时还没跑——挂载后
    才纠正的实现在这里必然读到 false。
  */
  it("is already true for a child mounted on the very first frame", () => {
    stubMatchMedia(true);
    const seenAtChildSetup: boolean[] = [];

    const Child = defineComponent({
      setup() {
        seenAtChildSetup.push(useMediaQuery("(max-width: 767px)").value);
        return () => h("div");
      },
    });
    const Parent = defineComponent({
      setup() {
        const narrow = useMediaQuery("(max-width: 767px)");
        return () => (narrow.value ? h(Child) : h("span", "desktop"));
      },
    });

    const wrapper = mount(Parent);

    expect(seenAtChildSetup).toEqual([true]);
    expect(wrapper.find("span").exists()).toBe(false);
  });

  it("stays false when the query does not match", () => {
    stubMatchMedia(false);
    const wrapper = mount(
      defineComponent({
        setup() {
          const narrow = useMediaQuery("(max-width: 767px)");
          return () => h("i", String(narrow.value));
        },
      }),
    );
    expect(wrapper.text()).toBe("false");
  });

  it("follows later viewport changes", async () => {
    const media = stubMatchMedia(false);
    const wrapper = mount(
      defineComponent({
        setup() {
          const narrow = useMediaQuery("(max-width: 767px)");
          return () => h("i", String(narrow.value));
        },
      }),
    );

    media.emit(true);
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toBe("true");
  });

  /* 组件卸载后还留着监听器，路由来回切几次就攒下一串写已销毁 ref 的回调。 */
  it("drops its listener when the owning scope goes away", () => {
    const media = stubMatchMedia(false);
    const wrapper = mount(
      defineComponent({
        setup() {
          useMediaQuery("(max-width: 767px)");
          return () => h("div");
        },
      }),
    );

    expect(media.listenerCount).toBe(1);
    wrapper.unmount();
    expect(media.listenerCount).toBe(0);
  });

  /* 组件之外调用不该因为没有 scope 就炸，也不该留下 Vue 的空调用警告。 */
  it("can be called outside a component scope", () => {
    stubMatchMedia(true);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(useMediaQuery("(max-width: 767px)").value).toBe(true);
    expect(warn).not.toHaveBeenCalled();

    warn.mockRestore();
  });
});
