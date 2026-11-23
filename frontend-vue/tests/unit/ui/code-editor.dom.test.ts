/*
  【文件职责】     固定 L2 CodeEditor 的 v-model、只读、主题、语法与生命周期合同。
  【架构位置】     测试
  【主要导出】     无；Vitest cases
  【依赖关系】     app/components/ui/code-editor · @codemirror/{state,view,language}
  【边界与注意】   全部通过真实 EditorView 断言，不 mock CodeMirror：这一层的价值
                   就在于「接线接对了没有」，把被接的东西换成假的等于什么都没测。
*/

import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { beforeAll, describe, expect, it } from "vitest";
import { EditorView } from "@codemirror/view";
import { highlightingFor, language } from "@codemirror/language";
import { tags } from "@lezer/highlight";

import { CodeEditor } from "@/components/ui/code-editor";

/*
  等到布局真的挂上，判据是**时间**而不是"drain 多少次微任务"。
  `flushPromises()` 只清微任务队列，既不推进定时器也不等下一帧；CodeMirror 的挂载
  在忙碌的机器上完全可能在 50 次 drain 之后才发生，于是这里抛出一个和真实原因毫不
  相干的错误。实测：这条用例在 `make verify` 与并发构建同时跑时偶发变红，单独跑必过。
*/
async function viewOf(wrapper: VueWrapper): Promise<EditorView> {
  const deadline = Date.now() + 5_000;
  do {
    const view = EditorView.findFromDOM(wrapper.element as HTMLElement);
    if (view) return view;
    await flushPromises();
    await new Promise((resolve) => setTimeout(resolve, 5));
  } while (Date.now() < deadline);
  throw new Error("editor did not mount");
}

async function mountEditor(props: Record<string, unknown> = {}) {
  const wrapper = mount(CodeEditor, {
    attachTo: document.body,
    props: { modelValue: "", ...props },
  });
  const view = await viewOf(wrapper);
  return { wrapper, view };
}

describe("L2 CodeEditor", () => {
  beforeAll(async () => {
    await import("@/core/code-editor/editor");
    await import("@codemirror/lang-python");
    await import("@codemirror/lang-json");
  });

  it("renders a readonly Textarea with the current value before CodeMirror has loaded", () => {
    const wrapper = mount(CodeEditor, { props: { modelValue: "first frame" } });
    // 兜底层不是装饰：第一帧空白和「内容加载失败」在屏幕上完全一样。
    const fallback = wrapper.get("textarea");
    expect((fallback.element as HTMLTextAreaElement).value).toBe("first frame");
    expect((fallback.element as HTMLTextAreaElement).readOnly).toBe(true);
    expect(fallback.attributes("aria-label")).toBeUndefined();
    expect(fallback.classes()).toEqual(
      expect.arrayContaining([
        "font-mono",
        "resize-none",
        "border-none",
        "p-4!",
      ]),
    );
    expect(wrapper.find("pre").exists()).toBe(false);
    wrapper.unmount();
  });

  it("emits every user edit and does not echo its own writes back", async () => {
    const { wrapper, view } = await mountEditor({ modelValue: "one" });
    expect(view.state.doc.toString()).toBe("one");

    view.dispatch({ changes: { from: 3, insert: " two" } });
    await flushPromises();
    expect(wrapper.emitted("update:modelValue")).toEqual([["one two"]]);

    // 父层把同一个值写回来（v-model 的正常回路）不能再产生一次 emit，
    // 否则 modelValue 每变一次都会自激一轮。
    await wrapper.setProps({ modelValue: "one two" });
    await flushPromises();
    expect(wrapper.emitted("update:modelValue")).toHaveLength(1);

    await wrapper.setProps({ modelValue: "replaced" });
    await flushPromises();
    expect(view.state.doc.toString()).toBe("replaced");
    expect(wrapper.emitted("update:modelValue")).toHaveLength(1);
    wrapper.unmount();
  });

  it("exposes an accessible textbox named by the caller", async () => {
    const { wrapper, view } = await mountEditor({
      modelValue: "x",
      contentLabel: "Artifact editor",
    });
    expect(view.contentDOM.getAttribute("role")).toBe("textbox");
    expect(view.contentDOM.getAttribute("aria-label")).toBe("Artifact editor");
    wrapper.unmount();
  });

  it("switches between readable and editable without losing the document", async () => {
    const { wrapper, view } = await mountEditor({
      modelValue: "locked",
      readonly: true,
    });
    expect(view.state.readOnly).toBe(true);
    expect(view.contentDOM.contentEditable).not.toBe("true");

    await wrapper.setProps({ readonly: false });
    await flushPromises();
    expect(view.state.readOnly).toBe(false);
    expect(view.contentDOM.contentEditable).toBe("true");
    expect(view.state.doc.toString()).toBe("locked");
    wrapper.unmount();
  });

  it("follows the theme it is given without rebuilding the editor state", async () => {
    const { wrapper, view } = await mountEditor({
      modelValue: "value = 1",
      language: "python",
      theme: "light",
    });
    const lightKeyword = highlightingFor(view.state, [tags.keyword]);
    view.dispatch({ selection: { anchor: 3 } });

    await wrapper.setProps({ theme: "dark" });
    await flushPromises();
    const darkKeyword = highlightingFor(view.state, [tags.keyword]);

    expect(darkKeyword).not.toBeNull();
    expect(darkKeyword).not.toBe(lightKeyword);
    // 换主题不能是「重建一个编辑器」：那会把光标和撤销历史一起清掉。
    expect(view.state.selection.main.anchor).toBe(3);
    expect(view.state.doc.toString()).toBe("value = 1");
    wrapper.unmount();
  });

  it("loads the syntax mode for the language and swaps it when the file changes", async () => {
    const { wrapper, view } = await mountEditor({
      modelValue: "def demo():\n    return 1\n",
      language: "python",
    });
    expect(highlightingFor(view.state, [tags.keyword])).not.toBeNull();
    expect(view.state.facet(language)?.name).toBe("python");

    await wrapper.setProps({ modelValue: '{"a": 1}', language: "json" });
    await flushPromises();
    expect(view.state.facet(language)?.name).toBe("json");
    expect(view.state.doc.toString()).toBe('{"a": 1}');
    wrapper.unmount();
  });

  it("keeps an unknown language editable as plain text", async () => {
    const { wrapper, view } = await mountEditor({
      modelValue: "#!/bin/sh\necho hi\n",
      language: "bash",
    });
    expect(view.state.doc.toString()).toBe("#!/bin/sh\necho hi\n");
    expect(view.state.facet(language)).toBeNull();
    expect(view.contentDOM.contentEditable).toBe("true");
    wrapper.unmount();
  });

  it("turns Mod-S into a save request instead of the browser dialog", async () => {
    const { wrapper, view } = await mountEditor({ modelValue: "draft" });
    const event = new KeyboardEvent("keydown", {
      key: "s",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    view.contentDOM.dispatchEvent(event);
    await flushPromises();
    expect(wrapper.emitted("save")).toHaveLength(1);
    expect(event.defaultPrevented).toBe(true);
    wrapper.unmount();
  });

  it("tears the editor down with the component", async () => {
    const { wrapper, view } = await mountEditor({ modelValue: "bye" });
    const host = wrapper.element as HTMLElement;
    expect(host.querySelector(".cm-editor")).not.toBeNull();
    wrapper.unmount();
    await flushPromises();
    expect(EditorView.findFromDOM(host)).toBeNull();
    expect(view.dom.isConnected).toBe(false);
  });
});
