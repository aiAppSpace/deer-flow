import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";

import AgentBootstrapComposer from "@/components/chat/AgentBootstrapComposer.vue";

afterEach(() => {
  document.body.innerHTML = "";
});

/*
  上游 agents/new/page.tsx 在 agent 还没建出来这一步用的是裸
  `PromptInput` + `PromptInputTextarea` + `PromptInputSubmit`：一个文本框、一个
  发送键，没有附件/语音/润色/模式/模型选择器。这几条断言钉住的正是「只有这两样」，
  防止有人把完整 ChatComposer 的控件又搬回来。
*/
describe("agent bootstrap composer", () => {
  it("renders only a textarea and a submit button — no other composer controls", () => {
    const wrapper = mount(AgentBootstrapComposer);
    expect(wrapper.findAll("textarea")).toHaveLength(1);
    expect(wrapper.findAll("button")).toHaveLength(1);
    expect(wrapper.find("input[type=file]").exists()).toBe(false);
    expect(wrapper.get("textarea").attributes("placeholder")).toBe(
      "Describe the agent you want — I'll help you create it through conversation.",
    );
  });

  /*
    上游是 `<PromptInputTextarea autoFocus>`，而 React 的 autoFocus 是 commit 阶段
    imperative 调 `.focus()`。HTML 的 `autofocus` 属性对加载完成后才插入的元素基本
    不生效，所以这里必须真的把焦点放上去——写成属性会静默地不聚焦。
  */
  it("focuses the textarea on mount, the way React's autoFocus does", () => {
    const wrapper = mount(AgentBootstrapComposer, { attachTo: document.body });
    expect(document.activeElement).toBe(wrapper.get("textarea").element);
    wrapper.unmount();
  });

  it("submits trimmed text on Enter and clears the draft", async () => {
    const wrapper = mount(AgentBootstrapComposer);
    const textarea = wrapper.get("textarea");
    await textarea.setValue("  hello agent  ");
    await textarea.trigger("keydown", { key: "Enter" });

    expect(wrapper.emitted("send")).toEqual([["hello agent"]]);
    expect((textarea.element as HTMLTextAreaElement).value).toBe("");
  });

  it("does not submit on Shift+Enter, empty text, or while composing an IME candidate", async () => {
    const wrapper = mount(AgentBootstrapComposer);
    const textarea = wrapper.get("textarea");

    await textarea.trigger("keydown", { key: "Enter" });
    expect(wrapper.emitted("send")).toBeUndefined();

    await textarea.setValue("draft");
    await textarea.trigger("keydown", { key: "Enter", shiftKey: true });
    expect(wrapper.emitted("send")).toBeUndefined();

    await textarea.trigger("compositionstart");
    await textarea.trigger("keydown", { key: "Enter" });
    expect(wrapper.emitted("send")).toBeUndefined();
    await textarea.trigger("compositionend");
  });

  it("submits via the form and disables both controls while disabled", async () => {
    const wrapper = mount(AgentBootstrapComposer, {
      props: { disabled: true },
    });
    const textarea = wrapper.get("textarea");
    const button = wrapper.get("button");
    // 输入框用 readonly（见 tests/guards/textarea-lock.test.ts）；按钮仍是 disabled。
    expect(textarea.attributes("readonly")).toBeDefined();
    expect(textarea.attributes("aria-disabled")).toBe("true");
    expect(button.attributes("disabled")).toBeDefined();
    expect(button.attributes("aria-label")).toBe("Submit");

    // happy-dom 不会对 `button.trigger("click")` 跑原生的 submit-button
    // activation behavior（只对真 MouseEvent 生效），所以走 `form.trigger("submit")`
    // 而不是点按钮本身——这是仓库里提交表单类组件测试的通用写法。
    await wrapper.setProps({ disabled: false });
    await textarea.setValue("go");
    await wrapper.get("form").trigger("submit");
    expect(wrapper.emitted("send")).toEqual([["go"]]);
  });
});
