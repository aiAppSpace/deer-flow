/*
  【文件职责】     mermaid 槽位的行为验收：成功出图、失败保持代码块、晚到结果不覆盖新内容。
  【架构位置】     门禁测试
  【主要导出】     无
  【依赖关系】     app/components/markdown/*（mermaid 包在模块级被 mock）
  【边界与注意】   ⚠️ **夹具录不到这一屏。** `tests/fixtures/react-markdown-dom.json` 的
                   `mermaid-block` 一条记的是**代码块回退**，不是图：录制脚本
                   `scripts/record-react-markdown.mjs` 只把上游的 remark/rehype 插件
                   转译进来，没有传 `plugins`，于是上游 `de()` 拿不到 mermaid 插件、
                   走的是 `ss` 里的代码块分支。加上 mermaid 只在浏览器里渲染、
                   React SSR 本来也出不了图——这一屏没有可签入的上游 SSR 夹具。

                   所以下面「上游形状」那一组的判据来源是**跑起来的 React 应用**：
                   2026-08-31 用一次性 probe 在 e2e-parity 的
                   `thread-history-mermaid` 场景上，把两个应用的 mermaid 块、
                   下载下拉、复制按钮、缩放 transform、全屏遮罩逐段抓下来对比，
                   除 Vue 的 `v-if` 注释锚点外**逐字符相同**。这里把当时量到的形状
                   固化下来，让它以后不能被悄悄改掉。probe 本身不签入——它要两个应用
                   同时在跑，而这个门禁必须能单独跑。

                   台账（`baseline/parity-diff.json`）看不见这一组里除第一条以外的
                   任何一条：下拉、全屏、缩放都要先交互；全屏还会 portal 出去把整棵
                   树遮掉。这正是它们要在这里有断言的原因。

                   mermaid 包在模块级 mock 掉：真包数百 KB、要注册全局 config，
                   在 happy-dom 里跑一遍既慢又和别的用例互相污染。这里要验的是**分派与容错**，
                   不是 mermaid 自己画得对不对。

                   最要紧的一条是「解析失败是常态」：`graph TD; A--` 这样的中间态在流式
                   期间每个 chunk 都会出现，把它当异常处理会让每条含图的消息闪烁。
*/

import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

import StreamMarkdown from "@/components/markdown/StreamMarkdown.vue";
import { richContentComponents } from "@/components/markdown/components";
import { appRemarkPlugins } from "@/core/markdown/plugins";

const mermaidMock = vi.hoisted(() => ({
  initialize: vi.fn(),
  parse: vi.fn(),
  render: vi.fn(),
}));

vi.mock("mermaid", () => ({ default: mermaidMock }));

const PIPELINE = {
  remarkPlugins: appRemarkPlugins,
  rehypePlugins: [], // 消息路径的同步 rehype 链现在是空的：KaTeX 由 core/markdown/math.ts 按内容加载。
  components: richContentComponents as unknown as Record<string, unknown>,
};

beforeEach(() => {
  mermaidMock.initialize.mockReset();
  mermaidMock.parse.mockReset();
  mermaidMock.render.mockReset();
});

describe("mermaid 槽位", () => {
  it("解析成功后换成 SVG", async () => {
    mermaidMock.parse.mockResolvedValue(true);
    mermaidMock.render.mockResolvedValue({ svg: '<svg data-fake="1"></svg>' });

    const wrapper = mount(StreamMarkdown, {
      props: { content: "```mermaid\ngraph TD; A-->B;\n```", ...PIPELINE },
    });
    await flushPromises();

    expect(wrapper.find('[data-streamdown="mermaid"]').exists()).toBe(true);
    expect(wrapper.find('[data-streamdown="mermaid"]').html()).toContain(
      "data-fake",
    );
    wrapper.unmount();
  });

  it("解析失败（流式中间态的常态）保持代码块，不清空也不抛", async () => {
    mermaidMock.parse.mockRejectedValue(new Error("incomplete"));

    const wrapper = mount(StreamMarkdown, {
      props: { content: "```mermaid\ngraph TD; A--\n```", ...PIPELINE },
    });
    await flushPromises();

    expect(wrapper.find('[data-streamdown="mermaid"]').exists()).toBe(false);
    expect(wrapper.find('[data-streamdown="code-block"]').text()).toContain(
      "graph TD; A--",
    );
    expect(mermaidMock.render).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("内容继续增长直到合法时补上图", async () => {
    mermaidMock.parse.mockRejectedValueOnce(new Error("incomplete"));

    const wrapper = mount(StreamMarkdown, {
      props: { content: "```mermaid\ngraph TD; A--\n```", ...PIPELINE },
    });
    await flushPromises();
    expect(wrapper.find('[data-streamdown="mermaid"]').exists()).toBe(false);

    mermaidMock.parse.mockResolvedValue(true);
    mermaidMock.render.mockResolvedValue({ svg: "<svg></svg>" });
    await wrapper.setProps({ content: "```mermaid\ngraph TD; A-->B;\n```" });
    await flushPromises();

    expect(wrapper.find('[data-streamdown="mermaid"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it("初始化参数与上游 @streamdown/mermaid 的默认 config 逐项一致", async () => {
    mermaidMock.parse.mockResolvedValue(true);
    mermaidMock.render.mockResolvedValue({ svg: "<svg></svg>" });

    const wrapper = mount(StreamMarkdown, {
      props: { content: "```mermaid\ngraph TD; A-->B;\n```", ...PIPELINE },
    });
    await flushPromises();

    /*
      逐字取自 `@streamdown/mermaid` 的 `m`（dist/index.js，489 字节的那个包）。
      `fontFamily` 不是装饰：mermaid 按字体量文字宽度再定节点尺寸和 viewBox，
      少这一项整张图的几何就与上游不同——而图的高度会把它下面的一切都推走。
      `securityLevel: "strict"` 是把模型输出当不可信内容的那条判据，顺带保证了
      导出 PNG 时 SVG 是自包含的（见 core/markdown/mermaid-export.ts 文件头 ③）。
    */
    expect(mermaidMock.initialize).toHaveBeenCalledWith({
      startOnLoad: false,
      theme: "default",
      securityLevel: "strict",
      fontFamily: "monospace",
      suppressErrorRendering: true,
    });
    wrapper.unmount();
  });
});

/**
 * 挂到真实 body 上：全屏遮罩走 `<Teleport to="body">`，挂在游离节点上时
 * teleport 的目标仍然是 document.body，但断言要能从 body 查到它。
 */
async function mountDiagram() {
  mermaidMock.parse.mockResolvedValue(true);
  mermaidMock.render.mockResolvedValue({
    svg: '<svg data-chart="1"></svg>',
  });
  const wrapper = mount(StreamMarkdown, {
    attachTo: document.body,
    props: { content: "```mermaid\ngraph TD; A-->B;\n```", ...PIPELINE },
  });
  await flushPromises();
  return wrapper;
}

const ACTIONS = '[data-streamdown="mermaid-block-actions"]';

describe("mermaid 图块 · 上游形状（判据来源见文件头）", () => {
  it("块外壳：语言标签、工具栏三颗按钮、role=application 的可拖容器、role=img 的图", async () => {
    const wrapper = await mountDiagram();
    const block = wrapper.find('[data-streamdown="mermaid-block"]');

    expect(block.exists()).toBe(true);
    // 语言标签是 `mermaid`，与代码块外壳同一个位置、同一套 class。
    expect(block.find("span.ml-1.font-mono.lowercase").text()).toBe("mermaid");

    const actions = block.find(ACTIONS);
    expect(
      actions.findAll("button").map((button) => button.attributes("title")),
    ).toEqual(["Download diagram", "Copy Code", "View fullscreen"]);

    // 可访问名从 title 来，不是 aria-label——上游如此，换成 aria-label 名字一样
    // 但树不同形。
    for (const button of actions.findAll("button")) {
      expect(button.attributes("aria-label")).toBeUndefined();
    }

    const chartHost = block.find('[data-streamdown="mermaid"]');
    expect(chartHost.exists()).toBe(true);
    // 三颗缩放按钮在图里面（ZoomPan 自己的控件），不在上面那条工具栏里。
    expect(
      chartHost.findAll("button").map((button) => button.attributes("title")),
    ).toEqual(["Zoom in", "Zoom out", "Reset zoom and pan"]);

    const pan = chartHost.find('[role="application"]');
    expect(pan.exists()).toBe(true);
    const chart = pan.find('[role="img"]');
    expect(chart.attributes("aria-label")).toBe("Mermaid chart");
    expect(chart.html()).toContain('data-chart="1"');
    wrapper.unmount();
  });

  it("缩放：按一次 +0.1，重置回到 1，到边界时按钮 disabled", async () => {
    const wrapper = await mountDiagram();
    const pan = wrapper.find('[role="application"]');
    const style = () => pan.attributes("style") ?? "";
    /*
      比数值不比字符串。上游与本仓的算术完全一样（都是 `zoom + 0.1` 逐次累加），
      但**序列化不一样**：Chromium 把 CSS 数值收进 float，`1.2000000000000002`
      写回来就是 `scale(1.2)`；happy-dom 不收，原样留着。实测 2026-08-31 的
      probe 里两个应用在 Chromium 下拿到的都是 `scale(1.2)`——那是浏览器的口径，
      不是两边的差异。把字符串写进断言等于在钉 happy-dom 的实现。
    */
    const scaleOf = () => Number(/scale\(([\d.]+)\)/.exec(style())?.[1]);
    const translateOf = () => /translate\((-?\d+px), (-?\d+px)\)/.exec(style());

    expect(scaleOf()).toBeCloseTo(1, 10);

    const zoomIn = wrapper
      .findAll("button")
      .find((button) => button.attributes("title") === "Zoom in")!;
    await zoomIn.trigger("click");
    await zoomIn.trigger("click");
    expect(scaleOf()).toBeCloseTo(1.2, 10);
    expect(translateOf()?.slice(1)).toEqual(["0px", "0px"]);

    const reset = wrapper
      .findAll("button")
      .find((button) => button.attributes("title") === "Reset zoom and pan")!;
    await reset.trigger("click");
    expect(scaleOf()).toBeCloseTo(1, 10);
    // 重置按钮没有 disabled 变体，上游如此。
    expect(reset.classes()).not.toContain("disabled:opacity-50");

    const zoomOut = wrapper
      .findAll("button")
      .find((button) => button.attributes("title") === "Zoom out")!;
    for (let step = 0; step < 8; step += 1) await zoomOut.trigger("click");
    expect(scaleOf()).toBeCloseTo(0.5, 10);
    expect(zoomOut.attributes("disabled")).toBeDefined();
    expect(zoomIn.attributes("disabled")).toBeUndefined();
    wrapper.unmount();
  });

  it("下载下拉：三项 SVG/PNG/MMD，点外面关掉", async () => {
    const wrapper = await mountDiagram();
    const actions = wrapper.find(ACTIONS);
    const trigger = actions
      .findAll("button")
      .find((button) => button.attributes("title") === "Download diagram")!;

    expect(actions.findAll("button")).toHaveLength(3);
    await trigger.trigger("click");

    const items = actions
      .findAll("button")
      .filter((button) =>
        button.attributes("title")?.startsWith("Download diagram as"),
      );
    expect(items.map((item) => item.attributes("title"))).toEqual([
      "Download diagram as SVG",
      "Download diagram as PNG",
      "Download diagram as MMD",
    ]);
    expect(items.map((item) => item.text())).toEqual(["SVG", "PNG", "MMD"]);

    // 关菜单听的是 mousedown 而不是 click，见 MermaidDownloadMenu.vue 文件头 ②。
    document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    await flushPromises();
    expect(actions.findAll("button")).toHaveLength(3);
    wrapper.unmount();
  });

  it("复制：反馈在图标上，title 始终是 Copy Code", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });

    const wrapper = await mountDiagram();
    const copy = wrapper
      .find(ACTIONS)
      .findAll("button")
      .find((button) => button.attributes("title") === "Copy Code")!;
    const pathOf = () => copy.find("path").attributes("d") ?? "";
    const before = pathOf();

    await copy.trigger("click");
    await flushPromises();

    expect(writeText).toHaveBeenCalledWith("graph TD; A-->B;\n");
    expect(pathOf()).not.toBe(before);
    expect(copy.attributes("title")).toBe("Copy Code");
    wrapper.unmount();
    vi.unstubAllGlobals();
  });

  /*
    **wave 148 之前这里钉的是一套手搓合同**：一个 `role="button" tabindex="0"` 的
    裸遮罩、一个 document 上的 Escape 监听、一份手写的模块级引用计数滚动锁。
    那一套没有 dialog 语义、没有焦点陷阱、不给兄弟节点打 `aria-hidden`。

    现在壳子是 `ui/dialog`，这四件事由 reka 的 `DialogContentModal` 承担。
    钉的东西跟着换：不再钉「我自己实现得对不对」，而是钉「我确实把它交给了
    primitive」——真的是一个带名字的 dialog、里面确实是同一个图的 fullscreen 形态、
    Escape 真的关得掉。
  */
  it("全屏：是一个真正的 dialog，Escape 关得掉", async () => {
    const wrapper = await mountDiagram();
    const fullscreen = wrapper
      .find(ACTIONS)
      .findAll("button")
      .find((button) => button.attributes("title") === "View fullscreen")!;

    await fullscreen.trigger("click");
    await flushPromises();

    const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute("aria-modal")).toBe("true");
    /*
      **顺着 id 解析到元素再比文字**：reka 无论有没有标题元素都会写上生成的 id，
      只查属性在不在是假绿（wave 148 的负向验证 N5 当场证明过）。
    */
    expect(
      document
        .getElementById(dialog!.getAttribute("aria-labelledby")!)
        ?.textContent?.trim(),
    ).toBe("View fullscreen");
    // 全屏里的图是同一个组件的 fullscreen 形态：控件贴到 bottom-4 left-4。
    expect(
      dialog?.querySelector('[title="Zoom in"]')?.parentElement?.className,
    ).toContain("bottom-4 left-4");

    dialog?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    await flushPromises();

    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    wrapper.unmount();
  });
});
