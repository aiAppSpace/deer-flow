/*
  【文件职责】     证明 KaTeX 按内容加载：没有公式就不进链，有公式就排版出来。
  【架构位置】     测试
  【主要导出】     无；Vitest cases
  【依赖关系】     MessageMarkdown · core/markdown/math
  【边界与注意】   两个方向都要证：只证「不含公式时不排版」会让「公式根本不渲染」
                   也照绿；只证「渲染出来了」则测不到省下的那 264 KB。
                   这里断言的是**渲染结果**而不是模块有没有被 import——
                   「浏览器实际下载了多少字节」由 tests/e2e/route-payload.spec.ts
                   在真实导航里量，那才是能说明问题的那一层。
*/

import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

import MessageMarkdown from "@/components/chat/MessageMarkdown.vue";
// Preload the real async adapter so unit flushes wait for rendering, not Vite transforms.
import "@/components/chat/MessageMarkdownContent.vue";
/*
  必须在这里静态 import 一次：MessageMarkdown 用 defineAsyncComponent 动态加载它，
  不预热的话 flushPromises 再多轮也等不到模块 transform 完，wrapper.html() 永远是
  空串——而空串会让所有 `not.toContain` 断言假绿。既有的 table-controls 与
  dom-equivalence 也是这么做的。
*/
import "@/components/markdown/StreamMarkdown.vue";
// 同理预热 KaTeX 插件模块本身；它在产品里也是动态 import 的。
import "rehype-katex";

function render(content: string) {
  // The real lazy plugin also loads CSS asynchronously. A fixed number of
  // microtask flushes cannot observe its completion under a full-suite load.
  return mount(MessageMarkdown, { props: { content } });
}

describe("KaTeX 按需加载", () => {
  it.each(["$a\n+b$", String.raw`\\$a$`])(
    "renders parser-admitted math %s with the actual lazy pipeline",
    async (source) => {
      const wrapper = await render(source);
      await vi.waitFor(() =>
        expect(wrapper.find(".katex").exists()).toBe(true),
      );
      wrapper.unmount();
    },
  );

  it("纯文本内容不经过 KaTeX", async () => {
    const wrapper = await render("一句没有公式的话。");
    await vi.waitFor(() =>
      expect(wrapper.text()).toContain("一句没有公式的话"),
    );
    expect(wrapper.html()).not.toContain("katex");
    wrapper.unmount();
  });

  it("代码块里的 shell 变量不触发 KaTeX", async () => {
    const wrapper = await render("```sh\necho $PATH $HOME\n```\n");
    await vi.waitFor(() =>
      expect(wrapper.find("code").text()).toContain("$PATH $HOME"),
    );
    expect(wrapper.html()).not.toContain("katex");
    wrapper.unmount();
  });

  it("含行内公式的内容加载 KaTeX 并排版出来", async () => {
    const wrapper = await render("面积是 $a^2+b^2=c^2$。");
    await vi.waitFor(() => expect(wrapper.find(".katex").exists()).toBe(true));
    // 只留下原始 `$…$` 文本说明插件没接上。
    expect(wrapper.text()).not.toContain("$a^2");
    wrapper.unmount();
  });

  it("含显示公式的内容同样排版", async () => {
    const wrapper = await render("推导：\n\n$$\\int_0^1 x\\,dx$$\n");
    await vi.waitFor(() => expect(wrapper.find(".katex").exists()).toBe(true));
    wrapper.unmount();
  });
});
