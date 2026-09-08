import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

import HumanInputCard from "@/components/chat/HumanInputCard.vue";
import MessageList from "@/components/chat/MessageList.vue";
import { enUS } from "@/core/i18n/locales/en-US";
import type {
  HumanInputRequest,
  HumanInputResponse,
} from "@/core/messages/human-input";
import type { Message } from "@/core/types/message";
import {
  createWorkspaceToastStore,
  workspaceToastKey,
} from "@/core/workspace-shell/toast";

const toastStore = createWorkspaceToastStore();

const request: HumanInputRequest = {
  version: 1,
  kind: "human_input_request",
  source: "ask_clarification",
  request_id: "request-1",
  question: "Which audience?",
  input_mode: "free_text",
};
const requestMessage = {
  id: "tool-request-1",
  type: "tool",
  name: "ask_clarification",
  content: "Waiting for clarification",
  artifact: { human_input: request },
} as unknown as Message;
const response: HumanInputResponse = {
  version: 1,
  kind: "human_input_response",
  source: "ask_clarification",
  request_id: "request-1",
  response_kind: "text",
  value: "Executive team",
};
const hiddenResponseMessage = {
  id: "human-response-1",
  type: "human",
  content:
    'For your clarification "Which audience?", my answer is: Executive team',
  additional_kwargs: {
    hide_from_ui: true,
    human_input_response: response,
  },
} as unknown as Message;

function mountHumanInput(
  submitHumanInput: (
    request: HumanInputRequest,
    response: HumanInputResponse,
  ) => boolean | Promise<boolean>,
  overrides: Record<string, unknown> = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return mount(MessageList, {
    props: {
      messages: [requestMessage],
      rawMessages: [requestMessage],
      streaming: false,
      loading: false,
      threadId: "thread-1",
      interactive: true,
      submitHumanInput,
      ...overrides,
    },
    global: {
      provide: { [workspaceToastKey as symbol]: toastStore },
      plugins: [[VueQueryPlugin, { queryClient }]],
      stubs: {
        StreamMarkdown: { template: "<div />" },
        ReferenceAttachment: true,
        WorkspaceChangesBadge: true,
        SubtaskCard: true,
      },
    },
  });
}

/*
  提交一律走表单的 submit 事件，不要 `button.trigger("click")`。实测（坑 76）：
  happy-dom 只在收到真正的 MouseEvent（或元素自己的 `.click()`）时才跑 submit 按钮的
  activation behavior，`@vue/test-utils` 的 `trigger("click")` 派发的是普通 Event，
  于是表单的 submit 根本不发——同一个组件在真实浏览器里是好的。
*/
async function submitCard(wrapper: ReturnType<typeof mountHumanInput>) {
  await wrapper.getComponent(HumanInputCard).get("form").trigger("submit");
}

describe("Human Input state machine", () => {
  beforeEach(() => {
    toastStore.clear();
    vi.stubGlobal("useNuxtApp", () => ({
      $i18n: { t: ref(enUS), locale: ref("en-US") },
    }));
  });

  /*
    提交**抛异常**（不是 resolve(false)）时上游 `message-list.tsx:590` 会
    `toast.error(...)`；本仓此前只把 pending 清掉，卡片自己重新可用，用户看不到
    任何解释。这一条与下面那条 resolve(false) 的回滚是两条不同的路径：
    resolve(false) 是「后端明确拒收」，由调用方自己播报；抛异常是「根本没送到」。
  */
  it("announces a submit that threw, instead of silently re-enabling the card", async () => {
    const submit = vi.fn(async () => {
      throw new Error("Gateway unreachable");
    });
    const wrapper = mountHumanInput(submit);
    await wrapper.get("textarea").setValue("Executive team");
    await submitCard(wrapper);
    await flushPromises();

    expect(wrapper.getComponent(HumanInputCard).props("pending")).toBe(false);
    expect(toastStore.toasts.value).toEqual([
      { id: expect.any(Number), kind: "error", message: "Gateway unreachable" },
    ]);
  });

  it("rolls a failed submit back to editable state and preserves the answer for retry", async () => {
    const submit = vi
      .fn(
        async (_request: HumanInputRequest, _response: HumanInputResponse) =>
          true,
      )
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const wrapper = mountHumanInput(submit);
    const textarea = wrapper.get("textarea");
    await textarea.setValue("Executive team");
    await submitCard(wrapper);
    await flushPromises();

    expect(wrapper.getComponent(HumanInputCard).props("pending")).toBe(false);
    expect((textarea.element as HTMLTextAreaElement).value).toBe(
      "Executive team",
    );

    await submitCard(wrapper);
    await flushPromises();
    expect(wrapper.getComponent(HumanInputCard).props("pending")).toBe(true);
    await wrapper.setProps({
      rawMessages: [requestMessage, hiddenResponseMessage],
    });
    await flushPromises();
    expect(wrapper.text()).toContain("Answered: Executive team");
    /*
      答过之后卡片是**叠加**不是替换：文本框仍然挂着（禁用、清空），右上角多一枚
      角标。上游 human-input-card.tsx 从不因为 answeredResponse 卸载控件——
      本仓此前一有 answered 就把整个卡片体换成一行文字。
    */
    const answeredTextarea = wrapper.get("textarea");
    expect(answeredTextarea.attributes("readonly")).toBeDefined();
    expect(answeredTextarea.attributes("aria-disabled")).toBe("true");
    expect((answeredTextarea.element as HTMLTextAreaElement).value).toBe("");
  });

  it("clears pending on a new thread error or thread switch without erasing form state", async () => {
    let resolveSubmit!: (value: boolean) => void;
    const submit = vi.fn(
      () => new Promise<boolean>((resolve) => (resolveSubmit = resolve)),
    );
    const wrapper = mountHumanInput(submit);
    const textarea = wrapper.get("textarea");
    await textarea.setValue("Keep this answer");
    await submitCard(wrapper);
    expect(wrapper.getComponent(HumanInputCard).props("pending")).toBe(true);

    await wrapper.setProps({ threadError: new Error("Run failed") });
    await flushPromises();
    expect(wrapper.getComponent(HumanInputCard).props("pending")).toBe(false);
    expect((textarea.element as HTMLTextAreaElement).value).toBe(
      "Keep this answer",
    );

    await submitCard(wrapper);
    expect(wrapper.getComponent(HumanInputCard).props("pending")).toBe(true);
    await wrapper.setProps({ threadId: "thread-2" });
    await flushPromises();
    expect(wrapper.getComponent(HumanInputCard).props("pending")).toBe(false);

    await submitCard(wrapper);
    await wrapper.setProps({ streaming: true });
    await wrapper.setProps({ streaming: false });
    await flushPromises();
    expect(wrapper.getComponent(HumanInputCard).props("pending")).toBe(false);
    resolveSubmit(false);
  });

  it("marks the card read-only when the list is not interactive", async () => {
    /*
      上游的 readOnly 是 `!onSubmit`，调用点在 isMock / STATIC_WEBSITE_ONLY 时
      不传 onSubmit（chat-page.tsx:348、sidecar-panel.tsx:587）；本仓的对应信号是
      `interactive === false`，由 MessageList 转成卡片的 read-only prop。
      少了这条转发，`humanInput.readOnly` 这枚角标永远不会上屏。
    */
    const wrapper = mountHumanInput(
      vi.fn(async () => true),
      {
        interactive: false,
      },
    );
    const card = wrapper.getComponent(HumanInputCard);

    expect(card.props("readOnly")).toBe(true);
    expect(card.text()).toContain(enUS.humanInput.readOnly);
    expect(card.get("textarea").attributes("readonly")).toBeDefined();
    expect(card.get("textarea").attributes("aria-disabled")).toBe("true");
  });

  it("does not let a hidden control message close an open request", async () => {
    /*
      HIL 状态机的 legacy 兜底把「请求之后出现的任意**可见** human 消息」当成对
      最新未答请求的回答。可见性判据必须是 isHiddenFromUIMessage，不是
      deriveHumanInputThreadState 的默认值——后者只看 hide_from_ui，看不见
      正文只有 `<slash_skill_activation>` 的那种人类消息。判据取窄一档的后果是
      用户在待答卡片之后触发一次斜杠技能，卡片就被静默判成已答。
    */
    const slashActivation = {
      id: "human-slash-1",
      type: "human",
      content: "<slash_skill_activation>研报</slash_skill_activation>",
    } as unknown as Message;
    const wrapper = mountHumanInput(
      vi.fn(async () => true),
      {
        messages: [requestMessage, slashActivation],
        rawMessages: [requestMessage, slashActivation],
      },
    );
    const card = wrapper.getComponent(HumanInputCard);

    expect(card.props("answered")).toBeUndefined();
    expect(card.props("active")).toBe(true);
  });

  it("suspends the card while a run is in flight and restores it when settled", async () => {
    /*
      上游把 `thread.isLoading` 直接并进卡片的 disabled
      （message-list.tsx:1119）。本仓的对应量是 `streaming`——两处独立调用点确认了
      这条映射：`getLatestEditableTurn(groups, thread.isLoading)` 与
      `useStableMessageGroups(messages, thread.isLoading)`，Vue 两处传的都是 streaming。

      A/B 两半都要断言。只断言「流式时禁用」的话，一个把 active 永久写死成 false 的
      实现也能绿——而那是比不修更糟的回归。
    */
    const streamingWrapper = mountHumanInput(
      vi.fn(async () => true),
      {
        streaming: true,
      },
    );
    expect(streamingWrapper.getComponent(HumanInputCard).props("active")).toBe(
      false,
    );

    const settledWrapper = mountHumanInput(
      vi.fn(async () => true),
      {
        streaming: false,
      },
    );
    expect(settledWrapper.getComponent(HumanInputCard).props("active")).toBe(
      true,
    );
  });

  it("hides the edit-and-rerun entry while a request is still open", async () => {
    /*
      上游 chat-page.tsx:345 的 canEdit 里有一条 `!hasOpenHumanInputCard`：
      重跑会把待答请求所在的回合整个作废，而卡片还在屏幕上等人回答。
      A/B 两半都要断言——只断言「没有按钮」的话，任何让 editable 落空的写法
      都能让它假绿。
    */
    const humanTurn = {
      id: "human-turn-1",
      type: "human",
      content: [{ type: "text", text: "Which audience?" }],
    } as unknown as Message;
    const aiTurn = {
      id: "ai-turn-1",
      type: "ai",
      content: "Some answer",
    } as unknown as Message;

    const settled = mountHumanInput(
      vi.fn(async () => true),
      {
        messages: [humanTurn, aiTurn],
        rawMessages: [humanTurn, aiTurn],
      },
    );
    const editSelector = `button[aria-label="${enUS.messages.actions.editAndRerun}"]`;
    expect(settled.find(editSelector).exists()).toBe(true);

    const waiting = mountHumanInput(
      vi.fn(async () => true),
      {
        messages: [humanTurn, aiTurn, requestMessage],
        rawMessages: [humanTurn, aiTurn, requestMessage],
      },
    );
    expect(waiting.find(editSelector).exists()).toBe(false);
  });

  it("does not draw the clarification tool result a second time", async () => {
    /*
      上游 assistant:clarification 分支**只**渲染 HumanInputCard；本仓的通用 tool
      分支会把同一条消息再画一个 `<details>`，可访问性树上多出一行
      `group: ask_clarification result`——与之前 assistant:subagent 那一处是同一个
      形状的重复渲染（对照台账上 `ariaOnlyVue - group: ask_clarification result`）。
    */
    const wrapper = mountHumanInput(vi.fn(async () => true));

    expect(wrapper.getComponent(HumanInputCard).exists()).toBe(true);
    expect(wrapper.findAll("details")).toHaveLength(0);
  });

  it("keeps the regenerate entry on the latest assistant turn behind an open card", async () => {
    /*
      「最新 assistant 回合」按类型回溯，不按位置。A/B 两半都要断言：只断言
      「有按钮」的话，一个永远显示的实现也能绿。
    */
    const humanTurn = {
      id: "human-turn-1",
      type: "human",
      content: [{ type: "text", text: "Which audience?" }],
    } as unknown as Message;
    const aiTurn = {
      id: "ai-turn-1",
      type: "ai",
      content: "Some answer",
    } as unknown as Message;
    const regenerateSelector = `button[aria-label="${enUS.messages.actions.regenerate}"]`;

    const settled = mountHumanInput(
      vi.fn(async () => true),
      {
        messages: [humanTurn, aiTurn],
        rawMessages: [humanTurn, aiTurn],
      },
    );
    expect(settled.find(regenerateSelector).exists()).toBe(true);

    // clarification 组挂在 assistant 组后面，入口仍然要在。
    const waiting = mountHumanInput(
      vi.fn(async () => true),
      {
        messages: [humanTurn, aiTurn, requestMessage],
        rawMessages: [humanTurn, aiTurn, requestMessage],
      },
    );
    expect(waiting.find(regenerateSelector).exists()).toBe(true);

    // 流式进行中上游返回 null，入口收起。
    const streamingWrapper = mountHumanInput(
      vi.fn(async () => true),
      {
        messages: [humanTurn, aiTurn],
        rawMessages: [humanTurn, aiTurn],
        streaming: true,
      },
    );
    expect(streamingWrapper.find(regenerateSelector).exists()).toBe(false);
  });

  it("recovers answered state from the persisted hidden Gateway response after refresh", async () => {
    const wrapper = mountHumanInput(vi.fn(async () => true));
    await wrapper.setProps({
      rawMessages: [requestMessage, hiddenResponseMessage],
    });
    await flushPromises();

    expect(wrapper.getComponent(HumanInputCard).props("answered")).toEqual(
      response,
    );
    expect(wrapper.text()).toContain("Answered: Executive team");
    /*
      答过之后卡片是**叠加**不是替换：文本框仍然挂着（禁用、清空），右上角多一枚
      角标。上游 human-input-card.tsx 从不因为 answeredResponse 卸载控件——
      本仓此前一有 answered 就把整个卡片体换成一行文字。
    */
    const answeredTextarea = wrapper.get("textarea");
    expect(answeredTextarea.attributes("readonly")).toBeDefined();
    expect(answeredTextarea.attributes("aria-disabled")).toBe("true");
    expect((answeredTextarea.element as HTMLTextAreaElement).value).toBe("");
  });
});
