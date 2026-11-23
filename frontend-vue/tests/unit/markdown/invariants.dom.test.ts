/*
  【文件职责】     05 的 Vue 移植陷阱 M3 / M4 / M5 / M6 在本里程碑的验收。
  【架构位置】     门禁测试
  【主要导出】     无
  【依赖关系】     app/components/markdown/* · app/core/markdown/*
  【边界与注意】   这四条在 M3 **首次**有验收对象——在此之前仓库里没有任何 Vue 渲染路径。
                   归属见 06 §验收项归属表：M3/M4/M6 归 M3，M5 从 M3 起每个写 Vue 代码的
                   里程碑都要查一遍。

                   每条都要**能红**。只断言「渲染出来了」不算验收：
                   - M3 要断言拿到的是 `class` 且 `className` 是 undefined，
                     否则把 prop 名写错也能绿；
                   - M4 要断言**同一个 DOM 节点对象**（`toBe`），不是「文本还在」；
                   - M5 要断言首帧就发生了，不是「最终发生了」；
                   - M6 要断言错误**没有**继续往上冒（父组件的 handler 没被调用）。
*/

import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h, onErrorCaptured, ref, watch } from "vue";
import { describe, expect, it, vi } from "vitest";

import StreamMarkdown from "@/components/markdown/StreamMarkdown.vue";
// 静态导入，不要写成用例体里的 `await import(...)`：这个 barrel 会把 shiki、
// mermaid、katex 一起拉进来，而动态导入的那几百毫秒是**算在用例自己的 5s 超时
// 里**的。M5 那条用例本来就要跑满 4.9s，于是套件并行起来时它会偶发超时——
// 实测过一次（wave 7 的 `make verify`：5093ms / 5000ms），单独跑却是绿的。
// 挪到模块顶层之后，加载开销落在文件的 import 阶段，不再占用任何用例的预算。
import { richContentComponents } from "@/components/markdown/components";
import { appRemarkPlugins } from "@/core/markdown/plugins";

const PIPELINE = {
  remarkPlugins: appRemarkPlugins,
  rehypePlugins: [], // 消息路径的同步 rehype 链现在是空的：KaTeX 由 core/markdown/math.ts 按内容加载。
};

describe("Vue component slot boundary", () => {
  it("updates real Markdown component slots without eager-slot warnings or remounting", async () => {
    const warnings: string[] = [];
    const wrapper = mount(StreamMarkdown, {
      props: {
        content: "First **answer**",
        ...PIPELINE,
        components: richContentComponents as unknown as Record<string, unknown>,
      },
      global: { config: { warnHandler: (message) => warnings.push(message) } },
    });
    const paragraph = wrapper.get("p").element;
    expect(wrapper.get('[data-streamdown="strong"]').text()).toBe("answer");
    await wrapper.setProps({ content: "First **answer expanded**" });
    expect(wrapper.get("p").element).toBe(paragraph);
    expect(wrapper.get('[data-streamdown="strong"]').text()).toBe(
      "answer expanded",
    );
    expect(warnings).toEqual([]);
    wrapper.unmount();
  });
});

describe("组件覆盖收到的是 class 不是 className", () => {
  it("覆盖组件的 props 里有 class，没有 className", () => {
    const seen: Record<string, unknown>[] = [];
    const Probe = defineComponent({
      name: "Probe",
      inheritAttrs: false,
      props: { class: { type: String, default: "" } },
      setup(props, { attrs, slots }) {
        seen.push({ class: props.class, ...attrs });
        return () => h("div", slots.default?.());
      },
    });

    const wrapper = mount(StreamMarkdown, {
      props: {
        // `contains-task-list` 是 remark-gfm 给 ul 加的 class，走的正是这条路径。
        content: "- [ ] todo",
        ...PIPELINE,
        components: { ul: Probe },
      },
    });

    expect(seen).toHaveLength(1);
    expect(seen[0]).toHaveProperty("class");
    expect(seen[0]?.class).toContain("contains-task-list");
    expect(seen[0]).not.toHaveProperty("className");
    wrapper.unmount();
  });
});

describe("逐词动画的 key 必须稳定", () => {
  it("追加 chunk 后已渲染的词还是同一个 DOM 节点", async () => {
    const wrapper = mount(StreamMarkdown, {
      props: {
        content: "alpha beta",
        animated: true,
        newWordClass: "md-word-enter",
        ...PIPELINE,
      },
    });

    const before = wrapper.findAll("[data-md-word]");
    expect(before.length).toBe(2);
    const alphaNode = before[0]?.element;
    const betaNode = before[1]?.element;

    await wrapper.setProps({ content: "alpha beta gamma delta" });

    const after = wrapper.findAll("[data-md-word]");
    expect(after.length).toBe(4);
    // 关键断言：同一个 DOM 节点对象，不是「文本还在」。
    expect(after[0]?.element).toBe(alphaNode);
    expect(after[1]?.element).toBe(betaNode);
    wrapper.unmount();
  });

  it("只有新词带入场 class，老词不重播", async () => {
    const wrapper = mount(StreamMarkdown, {
      props: {
        content: "alpha beta",
        animated: true,
        newWordClass: "md-word-enter",
        ...PIPELINE,
      },
    });

    // 首帧一律不播——一次性把整篇淡入是闪屏，不是流式效果。
    expect(wrapper.findAll(".md-word-enter")).toHaveLength(0);

    await wrapper.setProps({ content: "alpha beta gamma delta" });

    const entering = wrapper.findAll(".md-word-enter");
    expect(entering.map((node) => node.text())).toEqual(["gamma", "delta"]);
    wrapper.unmount();
  });

  it("块 key 让前面的块在追加后原地保留", async () => {
    const wrapper = mount(StreamMarkdown, {
      props: { content: "# title\n\nfirst", ...PIPELINE },
    });
    const heading = wrapper.find("h1").element;

    await wrapper.setProps({ content: "# title\n\nfirst\n\nsecond" });

    expect(wrapper.find("h1").element).toBe(heading);
    expect(wrapper.findAll("p")).toHaveLength(2);
    wrapper.unmount();
  });
});

describe("watch 惰性", () => {
  it("本层每个 watch 都显式声明了 immediate（首帧就要跑）", async () => {
    // 直接验行为而不是扫源码：代码块的高亮与 mermaid 的渲染都发生在 watch 里，
    // 漏了 immediate 的表现是「首帧永远不生效」，而首帧正是停留最久的那一帧。
    const wrapper = mount(StreamMarkdown, {
      props: {
        content: "```ts\nconst x = 1;\n```",
        ...PIPELINE,
        components: richContentComponents as unknown as Record<string, unknown>,
      },
    });

    // 首帧就有未高亮的回退结构（不是等到第二次渲染才出现）。
    expect(wrapper.find('[data-streamdown="code-block"]').exists()).toBe(true);
    expect(
      wrapper.find('[data-streamdown="code-block-body"]').text(),
    ).toContain("const x = 1;");

    await flushPromises();
    // 高亮回来之后仍然是同一块，内容没丢。
    expect(
      wrapper.find('[data-streamdown="code-block-body"]').text(),
    ).toContain("const x = 1;");
    wrapper.unmount();
  });

  it("对照：不加 immediate 的 watch 首帧不跑（这就是 M5 要防的形状）", async () => {
    const ran = vi.fn();
    const source = ref(1);
    watch(source, ran);
    await flushPromises();
    expect(ran).not.toHaveBeenCalled();
  });
});

describe("onErrorCaptured 必须显式 return false", () => {
  /** 一个必定在渲染期抛错的组件覆盖。 */
  const Exploding = defineComponent({
    name: "Exploding",
    setup() {
      return () => {
        throw new Error("boom");
      };
    },
  });

  it("渲染错误被本层挡住，不冒泡到父组件", async () => {
    const parentCaught = vi.fn();
    const Parent = defineComponent({
      name: "Parent",
      setup() {
        onErrorCaptured((error) => {
          parentCaught(error);
          return false;
        });
        return () =>
          h(StreamMarkdown, {
            content: "hello",
            ...PIPELINE,
            components: { p: Exploding },
          });
      },
    });

    const wrapper = mount(Parent);
    await flushPromises();

    // 挡住了：父组件一次都没收到。
    expect(parentCaught).not.toHaveBeenCalled();
    // 并且降级成纯文本，不是空白。
    expect(wrapper.text()).toContain("hello");
    expect(wrapper.find(".whitespace-pre-wrap").exists()).toBe(true);
    wrapper.unmount();
  });

  it("下一个 chunk 到达时重新尝试渲染（错误状态不粘住）", async () => {
    let shouldExplode = true;
    const Flaky = defineComponent({
      name: "Flaky",
      setup(_props, { slots }) {
        return () => {
          if (shouldExplode) throw new Error("boom");
          return h("p", slots.default?.());
        };
      },
    });

    const wrapper = mount(StreamMarkdown, {
      props: { content: "hello", ...PIPELINE, components: { p: Flaky } },
    });
    await flushPromises();
    expect(wrapper.find(".whitespace-pre-wrap").exists()).toBe(true);

    shouldExplode = false;
    await wrapper.setProps({ content: "hello world" });
    await flushPromises();

    expect(wrapper.find(".whitespace-pre-wrap").exists()).toBe(false);
    expect(wrapper.find("p").text()).toBe("hello world");
    wrapper.unmount();
  });
});
