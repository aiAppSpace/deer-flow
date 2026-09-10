/*
  Reasoning primitive 的合同。这三个组件是从 `chat/ReasoningDisclosure.vue` 那份
  **手搓**披露里拆出来的，所以这里钉的重点不是"能展开能收起"，而是当初手搓版
  跑偏的那几处：内容层的外边距与行高（对照台账上唯一那条几何差异）、三个
  data-slot、触发器的 cursor-pointer，以及 Collapsible 转发 update:open 这件事——
  它靠 fallthrough 是做不到的，见下面那条用例。
*/

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { defineComponent, h, ref } from "vue";

import Collapsible from "@/components/ui/collapsible/Collapsible.vue";
import CollapsibleTrigger from "@/components/ui/collapsible/CollapsibleTrigger.vue";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ui/reasoning";

/** 坑 58：.dom.test.ts 里 import.meta.url 不是 file: URL，读源码走 cwd。 */
const readSource = (relative: string) =>
  readFileSync(resolve(process.cwd(), relative), "utf8");

/** 坑 59：先剥注释，否则锚点串会在解释它的注释里被找到，守卫变假绿。 */
const stripComments = (source: string) =>
  source.replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

function mountReasoning(isStreaming = false) {
  return mount(
    defineComponent({
      setup: () => () =>
        h(Reasoning, { isStreaming }, () => [
          h(ReasoningTrigger, null, () => "Reasoning"),
          h(ReasoningContent, null, () => h("p", "chain of thought")),
        ]),
    }),
  );
}

describe("Reasoning primitive", () => {
  it("carries the three upstream data-slots", () => {
    const wrapper = mountReasoning();

    expect(wrapper.find("[data-slot='collapsible']").exists()).toBe(true);
    expect(wrapper.find("[data-slot='collapsible-trigger']").exists()).toBe(
      true,
    );
    expect(wrapper.find("[data-slot='collapsible-content']").exists()).toBe(
      true,
    );
  });

  /*
    这一条就是 streaming-reasoning-order 那条几何差异。上游内容层是
    `mt-4 text-sm`，text-sm 自带 line-height 1.25rem；手搓版写的是
    `mt-2 … leading-relaxed`，两处方向相反，代数和恰好是 −5.3px。
    所以两半都要钉：只钉 mt-4 的话，把 leading-relaxed 加回来仍然是绿的。
  */
  it("uses the upstream mt-4 and no relaxed leading on the content layer", () => {
    const content = mountReasoning().get("[data-slot='collapsible-content']");

    expect(content.classes()).toContain("mt-4");
    expect(content.classes()).toContain("text-sm");
    expect(content.classes()).not.toContain("mt-2");
    expect(content.classes()).not.toContain("leading-relaxed");
  });

  it("keeps the collapsible trigger's cursor-pointer under the reasoning classes", () => {
    const trigger = mountReasoning().get("[data-slot='collapsible-trigger']");

    expect(trigger.classes()).toContain("cursor-pointer");
    expect(trigger.classes()).toContain("text-muted-foreground");
    expect(trigger.classes()).toContain("w-full");
  });

  /*
    坑 55：箭头的 rotate 档必须由**一个** cn() 产出，两档不能同时留在 class 上——
    那种情况下赢家由样式表顺序决定，不由模板顺序决定。

    断言量的是 class **属性串**而不是 `classes()`：DOM 的 classList 会去重，
    冲突的两档如果各写一遍，classList 里仍然是两项、看得见，但"同一个类写了两遍"
    看不见。顺带一提，这里本来想连重复也一起钉，实测发现**重复是
    lucide-vue-next 自己造的**——它把传进来的 class 既塞进内部数组又让它
    fallthrough，于是每颗图标的 class 串里外来类都出现两遍（`size-4` 也一样）。
    那不是本仓的写法问题，classList 去重后计算样式也完全相同，所以不钉它。
  */
  it("never leaves both rotate directions on the chevron", () => {
    const chevron = mountReasoning().get(".lucide-chevron-down");
    const attribute = chevron.attributes("class") ?? "";

    expect(attribute).toContain("rotate-180");
    expect(attribute).not.toContain("rotate-0");
    expect(chevron.classes()).toContain("size-4");
  });

  it("does not ship a built-in thinking message", () => {
    const source = stripComments(
      readSource("app/components/ui/reasoning/ReasoningTrigger.vue"),
    );

    expect(source).not.toMatch(/Thinking/);
    expect(source).not.toMatch(/Thought for/);
    expect(source).toContain("<slot />");
  });
});

describe("Collapsible update:open forwarding", () => {
  /*
    Vue 的 renderComponentRoot 在合并 $attrs 之前跑 filterModelListeners
    （runtime-core 3.5.40:4759）：`onUpdate:<key>` 碰上本组件声明了同名 prop
    就被剔掉——它假定这一层自己在做 v-model。Collapsible 恰好声明了 open，
    于是 fallthrough 版本会**静默**吞掉监听：不警告、不报错，点击毫无反应。
    这条用例钉的是"显式声明并转发"这件事本身。
  */
  it("reaches the parent when the trigger is clicked", async () => {
    const seen: boolean[] = [];
    const Host = defineComponent({
      setup() {
        const open = ref(true);
        return () =>
          h(
            Collapsible,
            {
              open: open.value,
              "onUpdate:open": (next: boolean) => {
                seen.push(next);
                open.value = next;
              },
            },
            () => [h(CollapsibleTrigger, null, () => "T")],
          );
      },
    });

    const wrapper = mount(Host);
    await wrapper.get("button").trigger("click");

    expect(seen).toEqual([false]);
  });
});

describe("Reasoning auto-close", () => {
  it("closes once after the run settles and stops there", async () => {
    vi.useFakeTimers();
    const wrapper = mountReasoning();

    expect(wrapper.text()).toContain("chain of thought");
    await vi.advanceTimersByTimeAsync(1_001);
    expect(wrapper.text()).not.toContain("chain of thought");

    await wrapper.get("button").trigger("click");
    expect(wrapper.text()).toContain("chain of thought");
    await vi.advanceTimersByTimeAsync(1_001);
    expect(wrapper.text()).toContain("chain of thought");

    wrapper.unmount();
    vi.useRealTimers();
  });

  /*
    「手动开合之后不再自动收起」这条分叉，够得着它需要两个条件同时成立：
    ① 手动开合发生在 timer 烧掉**之前**（timer 一烧，autoCloseSettled 本来就是
    true，handleOpenChange 里那一行删不删都看不出来）；② 之后 isStreaming 再变
    一次，因为 onMounted 与 watch(isStreaming) 是仅有的两个调度点。

    所以这里从流式态起步——流式期间不排 timer，用户先手动收起再展开，然后 run
    结束。前两版守卫各缺一个条件，删掉 autoCloseSettled 照样绿。
  */
  it("stays open when the user toggled before the run settled", async () => {
    vi.useFakeTimers();
    const wrapper = mount(Reasoning, {
      props: { isStreaming: true },
      slots: {
        default: () => [
          h(ReasoningTrigger, null, () => "Reasoning"),
          h(ReasoningContent, null, () => h("p", "chain of thought")),
        ],
      },
    });

    await wrapper.get("button").trigger("click");
    expect(wrapper.text()).not.toContain("chain of thought");
    await wrapper.get("button").trigger("click");
    expect(wrapper.text()).toContain("chain of thought");

    await wrapper.setProps({ isStreaming: false });
    await vi.advanceTimersByTimeAsync(1_001);
    expect(wrapper.text()).toContain("chain of thought");

    wrapper.unmount();
    vi.useRealTimers();
  });

  it("leaves a streaming disclosure open", async () => {
    vi.useFakeTimers();
    const wrapper = mountReasoning(true);

    await vi.advanceTimersByTimeAsync(5_000);
    expect(wrapper.text()).toContain("chain of thought");

    wrapper.unmount();
    vi.useRealTimers();
  });
});
