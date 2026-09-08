/*
  【文件职责】     钉住「没有 id 的人类消息不提供『改完重跑』」。
  【架构位置】     单测（dom）
  【主要导出】     无
  【依赖关系】     components/chat/MessageList.vue
  【边界与注意】   判据是**行为**的，不是「照抄上游多一项条件」：改完重跑要把这条消息的
                   id 发回后端，**没有 id 就根本寻址不到**，那颗键点了也没用。

                   这一条是 wave 180 实测逼出来的。新建会话刚发出第一条时，那条人类消息
                   还没有后端给的 id；`editable` 因此是 null，于是
                   `editable?.humanMessage.id === message.id` 变成
                   `undefined === undefined`——**相等**，键就画出来了。
                   上游同一处有 `Boolean(msg.id)` 挡着（message-list.tsx:1025），
                   实测两个应用的 groups 一模一样、上游不画本仓画，差的就是这一项。

                   **没做成源码扫描**：仓里同形的 `a?.x.id === b.id` 还有三处，
                   都是两边成对、右侧恒有值的正常写法。要给它们开豁免的判据是错判据（坑 180）。
*/
import { flushPromises, mount } from "@vue/test-utils";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

import MessageList from "@/components/chat/MessageList.vue";
import { enUS } from "@/core/i18n/locales/en-US";
import type { Message } from "@/core/types/message";
import {
  createWorkspaceToastStore,
  workspaceToastKey,
} from "@/core/workspace-shell/toast";

const toastStore = createWorkspaceToastStore();

function turn(humanId: string | undefined): Message[] {
  return [
    { ...(humanId ? { id: humanId } : {}), type: "human", content: "Hello" },
    {
      id: "msg-ai-1",
      type: "ai",
      run_id: "run-1",
      content: "Hello from DeerFlow!",
      additional_kwargs: {},
      feedback: null,
    },
  ] as unknown as Message[];
}

function mountList(messages: Message[]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return mount(MessageList, {
    props: {
      messages,
      rawMessages: messages,
      streaming: false,
      loading: false,
      threadId: "thread-1",
      interactive: true,
    },
    global: {
      provide: { [workspaceToastKey as symbol]: toastStore },
      plugins: [[VueQueryPlugin, { queryClient }]],
      stubs: {
        StreamMarkdown: { template: "<div data-testid='markdown' />" },
        ReferenceAttachment: true,
        WorkspaceChangesBadge: true,
        SubtaskCard: true,
      },
    },
  });
}

function editButtons(wrapper: ReturnType<typeof mountList>) {
  return wrapper
    .findAll("button")
    .filter(
      (button) =>
        button.attributes("aria-label") === enUS.messages.actions.editAndRerun,
    );
}

describe("改完重跑要有 id 才给", () => {
  beforeEach(() => {
    vi.stubGlobal("useNuxtApp", () => ({
      $i18n: { t: ref(enUS), locale: ref("en-US") },
    }));
  });

  it("人类消息还没有 id 时不给这颗键", async () => {
    const wrapper = mountList(turn(undefined));
    await flushPromises();
    expect(editButtons(wrapper)).toHaveLength(0);
  });

  it("有 id 就照常给", async () => {
    const wrapper = mountList(turn("msg-human-1"));
    await flushPromises();
    expect(editButtons(wrapper)).toHaveLength(1);
  });
});
