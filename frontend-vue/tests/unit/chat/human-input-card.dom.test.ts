/*
  【文件职责】     钉住 HumanInputCard 的协议提交、必填校验、无障碍属性与三种状态角标。
  【架构位置】     unit test (dom)
  【主要导出】     无；Vitest cases
  【依赖关系】     app/components/chat/HumanInputCard.vue
  【边界与注意】   **提交一律 `form.trigger("submit")`，不要 `button.trigger("click")`。**
                   实测（坑 76）：happy-dom 只在收到真正的 `MouseEvent`（或元素自己的
                   `.click()`）时才跑 submit 按钮的 activation behavior；
                   `@vue/test-utils` 的 `trigger("click")` 派发的是普通 `Event`，
                   于是表单的 submit 事件根本不发——同一个组件在真实浏览器里是好的。
                   三种事件在本仓 happy-dom 上的实测值：MouseEvent=提交、
                   `.click()`=提交、`new Event("click")`=**不提交**。

                   卡片里的 `MessageMarkdown` 里套着一个 `defineAsyncComponent`
                   （StreamMarkdown）。本文件**不断言问题文案**（那部分由 e2e 覆盖），
                   所以直接把 MessageMarkdown 整个 stub 掉。不 stub 的话那条动态
                   import 会在用例跑完之后才 resolve，撞上已经拆掉的测试环境，
                   报成 `EnvironmentTeardownError`——2026-09-02 实测过一次，
                   出不出现取决于机器负载，是一条真的 flake 源。
*/

import { mount } from "@vue/test-utils";
import { nextTick, ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

import HumanInputCard from "@/components/chat/HumanInputCard.vue";
import { enUS } from "@/core/i18n/locales/en-US";
import type {
  HumanInputRequest,
  HumanInputResponse,
} from "@/core/messages/human-input";

const freeText: HumanInputRequest = {
  version: 1,
  kind: "human_input_request",
  source: "ask_clarification",
  request_id: "clarification-1",
  question: "Which audience should this target?",
  input_mode: "free_text",
};

const choice: HumanInputRequest = {
  version: 1,
  kind: "human_input_request",
  source: "ask_clarification",
  request_id: "choice-1",
  question: "Choose a region",
  input_mode: "single_choice",
  options: [
    { id: "apac", label: "APAC", value: "apac" },
    { id: "emea", label: "EMEA", value: "emea" },
  ],
};

function mountCard(
  request: HumanInputRequest,
  props: Record<string, unknown> = {},
) {
  return mount(HumanInputCard, {
    props: { request, active: true, pending: false, ...props },
    global: { stubs: { MessageMarkdown: true } },
  });
}

describe("HumanInputCard", () => {
  beforeEach(() => {
    vi.stubGlobal("useNuxtApp", () => ({
      $i18n: { t: ref(enUS), locale: ref("en-US") },
    }));
  });

  it("submits a free-text answer through the structured response contract", async () => {
    const wrapper = mountCard(freeText);

    await wrapper.get("textarea").setValue("Executive leadership");
    await wrapper.get("form").trigger("submit");

    expect(wrapper.emitted("submit")?.[0]?.[0]).toEqual({
      version: 1,
      kind: "human_input_response",
      source: "ask_clarification",
      request_id: "clarification-1",
      response_kind: "text",
      value: "Executive leadership",
    });
  });

  it("does not submit free text while an IME composition or keyCode 229 is active", async () => {
    const wrapper = mountCard({ ...freeText, request_id: "clarification-ime" });
    const textarea = wrapper.get("textarea");
    await textarea.setValue("中文回答");

    await textarea.trigger("compositionstart");
    await textarea.trigger("keydown", { key: "Enter" });
    expect(wrapper.emitted("submit")).toBeUndefined();

    await textarea.trigger("compositionend");
    await textarea.trigger("keydown", { key: "Enter", keyCode: 229 });
    expect(wrapper.emitted("submit")).toBeUndefined();

    textarea.element.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      }),
    );
    await nextTick();
    expect(wrapper.emitted("submit")?.[0]?.[0]).toMatchObject({
      request_id: "clarification-ime",
      value: "中文回答",
    });
  });

  it("keeps checkbox defaults explicit and blocks an incomplete required form", async () => {
    const wrapper = mountCard({
      version: 2,
      kind: "human_input_request",
      source: "ask_clarification",
      request_id: "clarification-form",
      question: "Confirm delivery details",
      input_mode: "form",
      fields: [
        {
          name: "approved",
          label: "Approved",
          type: "checkbox",
          required: false,
        },
        { name: "owner", label: "Owner", type: "text", required: true },
      ],
    });

    await wrapper.get("form").trigger("submit");
    expect(wrapper.get("[role='alert']").text()).toContain("required");
    expect(wrapper.emitted("submit")).toBeUndefined();

    await wrapper.get("input[type='text']").setValue("Dana");
    await wrapper.get("form").trigger("submit");
    expect(wrapper.emitted("submit")?.[0]?.[0]).toMatchObject({
      request_id: "clarification-form",
      response_kind: "text",
      value:
        'Approved: no; Owner: Dana [values: {"approved":false,"owner":"Dana"}]',
    });
  });

  it("treats a required unchecked checkbox as unsatisfied and keeps form state for retry", async () => {
    const wrapper = mountCard({
      version: 2,
      kind: "human_input_request",
      source: "ask_clarification",
      request_id: "must-agree",
      question: "Confirm the release",
      input_mode: "form",
      fields: [
        { name: "owner", label: "Owner", type: "text", required: true },
        {
          name: "approved",
          label: "I approve this release",
          type: "checkbox",
          required: true,
        },
      ],
    });
    const owner = wrapper.get("input[type='text']");
    await owner.setValue("Dana");
    await wrapper.get("form").trigger("submit");

    expect(wrapper.emitted("submit")).toBeUndefined();
    expect(
      wrapper.get("input[type='checkbox']").attributes("aria-invalid"),
    ).toBe("true");
    expect((owner.element as HTMLInputElement).value).toBe("Dana");

    await wrapper.get("input[type='checkbox']").setValue(true);
    await wrapper.get("form").trigger("submit");
    expect(wrapper.emitted("submit")?.[0]?.[0]).toMatchObject({
      request_id: "must-agree",
      value:
        'Owner: Dana; I approve this release: yes [values: {"owner":"Dana","approved":true}]',
    });
  });

  it("submits a single choice and toggles multi-select options as pressed buttons", async () => {
    const choiceWrapper = mountCard(choice);
    const optionButtons = choiceWrapper.findAll("button");
    expect(optionButtons).toHaveLength(2);
    await optionButtons[1]!.trigger("click");
    expect(choiceWrapper.emitted("submit")?.[0]?.[0]).toMatchObject({
      response_kind: "option",
      option_id: "emea",
      value: "emea",
    });

    const formWrapper = mountCard({
      version: 2,
      kind: "human_input_request",
      source: "ask_clarification",
      request_id: "multi-1",
      question: "Choose channels",
      input_mode: "form",
      fields: [
        { name: "owner", label: "Owner", type: "text", required: true },
        {
          name: "channels",
          label: "Channels",
          type: "multi_select",
          required: true,
          options: [
            { id: "email", label: "Email", value: "email" },
            { id: "web", label: "Web", value: "web" },
          ],
        },
      ],
    });
    await formWrapper.get("input[type='text']").setValue("Dana");

    /*
      上游的 multi_select 是一组 `aria-pressed` 的 Button（放在 role="group" 里），
      不是原生 `<select multiple>`；本仓此前用的是后者，于是同一个字段在两个应用里
      连控件类型都不一样。
    */
    const group = formWrapper.get("[role='group']");
    const toggles = group.findAll("button");
    expect(toggles.map((t) => t.attributes("aria-pressed"))).toEqual([
      "false",
      "false",
    ]);
    await toggles[0]!.trigger("click");
    await toggles[1]!.trigger("click");
    expect(
      formWrapper
        .get("[role='group']")
        .findAll("button")[0]!
        .attributes("aria-pressed"),
    ).toBe("true");

    await formWrapper.get("form").trigger("submit");
    expect(formWrapper.emitted("submit")?.[0]?.[0]).toMatchObject({
      response_kind: "text",
      value:
        'Owner: Dana; Channels: email, web [values: {"owner":"Dana","channels":["email","web"]}]',
    });
  });

  it("blocks a whitespace-only required field instead of submitting blanks", async () => {
    const wrapper = mountCard({
      version: 2,
      kind: "human_input_request",
      source: "ask_clarification",
      request_id: "blank-owner",
      question: "Who owns this?",
      input_mode: "form",
      fields: [{ name: "owner", label: "Owner", type: "text", required: true }],
    });

    await wrapper.get("input[type='text']").setValue("   ");
    await wrapper.get("form").trigger("submit");

    expect(wrapper.emitted("submit")).toBeUndefined();
    expect(wrapper.get("[role='alert']").text()).toContain("required");
  });

  it("reports an empty optional form instead of submitting an empty value block", async () => {
    const wrapper = mountCard({
      version: 2,
      kind: "human_input_request",
      source: "ask_clarification",
      request_id: "all-optional",
      question: "Anything to add?",
      input_mode: "form",
      fields: [{ name: "note", label: "Note", type: "text", required: false }],
    });

    await wrapper.get("form").trigger("submit");

    /*
      提交值永远长成 `${summary} [values: {…}]`，所以拿它判空等于永远判不出空。
      本仓此前正是如此，于是这一步会把 " [values: {}]" 提交上去。
    */
    expect(wrapper.emitted("submit")).toBeUndefined();
    expect(wrapper.get("[role='alert']").text()).toBe(
      enUS.humanInput.emptyError,
    );
  });

  it("omits aria-required and aria-invalid instead of rendering them false", async () => {
    const wrapper = mountCard({
      version: 2,
      kind: "human_input_request",
      source: "ask_clarification",
      request_id: "aria-form",
      question: "Details",
      input_mode: "form",
      /*
        `required: false` 必须**显式写出来**。写成不带 required 的字段，
        `field.required` 是 undefined，Vue 本来就会省略属性——于是
        「`|| undefined` 有没有」这条变异根本看不见（负向验证一次假绿，坑 57 第二种）。
      */
      fields: [
        { name: "note", label: "Note", type: "text", required: false },
        { name: "owner", label: "Owner", type: "text", required: true },
      ],
    });

    const [note, owner] = wrapper.findAll("input[type='text']");
    expect(note!.attributes("aria-required")).toBeUndefined();
    expect(note!.attributes("aria-invalid")).toBeUndefined();
    expect(owner!.attributes("aria-required")).toBe("true");
    expect(owner!.attributes("aria-invalid")).toBeUndefined();
  });

  it("points an invalid control at the error node and clears it once refilled", async () => {
    const wrapper = mountCard({
      version: 2,
      kind: "human_input_request",
      source: "ask_clarification",
      request_id: "describedby-form",
      question: "Details",
      input_mode: "form",
      fields: [{ name: "owner", label: "Owner", type: "text", required: true }],
    });

    await wrapper.get("form").trigger("submit");
    const owner = wrapper.get("input[type='text']");
    const describedBy = owner.attributes("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(wrapper.get("[role='alert']").attributes("id")).toBe(describedBy);

    // 最后一个非法字段被填上，错误随即消失——上游不等下一次提交。
    await owner.setValue("Dana");
    expect(wrapper.find("[role='alert']").exists()).toBe(false);
    expect(owner.attributes("aria-describedby")).toBeUndefined();
  });

  it("keeps the answered card interactive-shaped, badged and disabled", async () => {
    const answered: HumanInputResponse = {
      version: 1,
      kind: "human_input_response",
      source: "ask_clarification",
      request_id: "choice-1",
      response_kind: "option",
      option_id: "emea",
      value: "EMEA",
    };
    const wrapper = mountCard(choice, { answered });

    // 状态是叠加不是替换：选项按钮仍在，只是全部禁用。
    const buttons = wrapper.findAll("button");
    expect(buttons).toHaveLength(2);
    expect(buttons.every((b) => b.attributes("disabled") !== undefined)).toBe(
      true,
    );
    expect(wrapper.text()).toContain(enUS.humanInput.answered);
    expect(wrapper.text()).toContain(enUS.humanInput.answeredValue("EMEA"));
    expect(wrapper.find("[data-slot='badge']").exists()).toBe(true);
  });

  it("badges a read-only card and disables its controls", () => {
    const wrapper = mountCard(freeText, { active: false, readOnly: true });

    expect(wrapper.text()).toContain(enUS.humanInput.readOnly);
    // readonly，不是 disabled：锁住一个正被聚焦的控件会永久夺走焦点，
    // 判据与守卫 tests/guards/textarea-lock.test.ts 同一条。
    expect(wrapper.get("textarea").attributes("readonly")).toBeDefined();
    expect(wrapper.get("textarea").attributes("aria-disabled")).toBe("true");
    expect(
      wrapper.get("button[type='submit']").attributes("disabled"),
    ).toBeDefined();
  });

  it("refuses to submit text that was composed before the card went inactive", async () => {
    /*
      守卫要够得着才测得到。原来这条用的是一张**空**的只读卡片，于是
      `handleTextSubmit` 在 `text.trim()` 那一步就返回了，`submitResponse` 里的
      `isDisabled` 守卫压根没被读到——把守卫整段删掉用例照样绿（坑 74）。
      先在可提交状态下打好字，再让卡片失活，守卫才是这条路径上唯一的拦截点。
    */
    const wrapper = mountCard(freeText);
    await wrapper.get("textarea").setValue("Executive leadership");
    await wrapper.setProps({ active: false, readOnly: true });

    await wrapper.get("form").trigger("submit");
    expect(wrapper.emitted("submit")).toBeUndefined();
  });

  it("clears the composed text once the answer is accepted", async () => {
    const wrapper = mountCard(freeText);
    await wrapper.get("textarea").setValue("Executive leadership");
    await wrapper.get("form").trigger("submit");
    expect(wrapper.emitted("submit")).toHaveLength(1);

    await wrapper.setProps({
      pending: false,
      answered: {
        version: 1,
        kind: "human_input_response",
        source: "ask_clarification",
        request_id: "clarification-1",
        response_kind: "text",
        value: "Executive leadership",
      },
    });

    expect((wrapper.get("textarea").element as HTMLTextAreaElement).value).toBe(
      "",
    );
  });

  it("renders choice options as full-width outline buttons above the other-answer form", () => {
    const wrapper = mountCard({
      ...choice,
      request_id: "choice-other",
      input_mode: "choice_with_other",
    });

    const optionButtons = wrapper
      .findAll("button")
      .filter((button) => button.attributes("type") === "button");
    expect(optionButtons).toHaveLength(2);
    for (const button of optionButtons) {
      expect(button.attributes("class")).toContain("min-h-11");
      expect(button.attributes("data-variant")).toBe("outline");
    }
    // choice_with_other 同时给出「其它答案」文本框，并带一个 sr-only 标签。
    expect(wrapper.get("label.sr-only").text()).toBe(
      enUS.humanInput.otherLabel,
    );
    expect(wrapper.get("textarea").attributes("placeholder")).toBe(
      enUS.humanInput.otherPlaceholder,
    );
  });
});
