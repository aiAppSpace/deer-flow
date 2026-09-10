/*
  【文件职责】     钉住「后端还没给 turn_duration 时，这一轮的耗时由前端自己量」。
  【架构位置】     单测（dom）
  【主要导出】     无
  【依赖关系】     components/chat/MessageList.vue
  【边界与注意】   后端把 `turn_duration` 写在 AI 消息的 additional_kwargs 里，但那要等
                   这一轮落库、再被历史查询取回来才有值——**刚跑完的这一轮拿不到**。
                   上游 message-list.tsx:339 因此在 streaming 的下降沿自己量一次墙钟先顶上。

                   本仓此前没有这条兜底，于是「首次提交后」那一屏上游显示
                   `Completed in <1s`、本仓一个字都没有（wave 175 记的那一行台账；
                   当时判成「取到的时长有没有值」，是判错了——**是缺功能**）。

                   五条各钉一件事：兜底会顶上**并且挂在 assistant 组上**、后端的值优先、
                   出错时不画、**出错的那一轮压根不记**（错误后来消失了也不该冒出来）、
                   **上一轮记下的时长在这一轮出错时要藏起来**。

                   写入侧与渲染侧各有一道 threadError 判断，**必须各有一条用例单独逼出来**
                   ——只写前四条时，把渲染侧那道删掉照样全绿。

                   **第六条是被一次假绿逼出来的，别删。** 第一版照抄上游把键写成
                   `${threadId}:${group.id}`，五条单测全绿，**真应用一个字都不显示**：
                   实测下降沿那一刻 `threadId` 还是空串，渲染时才是真 id，键永远对不上
                   （与 wave 158/175 同一族的 id 交接）。单测当时全都在 threadId 从头到尾
                   不变的前提下跑，照不出这件事。

                   前两条的第一版都太松，是被变异当场抓到的：把落点改成 human 组，
                   红的是「不会两个都画」那条而不是第一条——因为第一条只问了
                   「页面上有没有 run-duration」，没问它**挂在哪儿**；而把写入侧那道
                   threadError 判断删掉时四条全绿，因为渲染侧还有一道同样的判断兜着。
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

function messages(turnDuration?: number): Message[] {
  return [
    { id: "human-1", type: "human", content: "Ping from the user" },
    {
      id: "ai-1",
      type: "ai",
      run_id: "run-1",
      content: "Hello from DeerFlow!",
      additional_kwargs:
        turnDuration === undefined ? {} : { turn_duration: turnDuration },
      feedback: null,
    },
  ] as unknown as Message[];
}

type ListProps = InstanceType<typeof MessageList>["$props"];

function mountList(
  /* 这一组用例全部围着 `streaming` 的下降沿转，所以它和 messages 一样是必给的。 */
  props: Partial<ListProps> & Pick<ListProps, "messages" | "streaming">,
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return mount(MessageList, {
    props: {
      rawMessages: props.messages,
      loading: false,
      threadId: "thread-1",
      interactive: true,
      ...props,
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

describe("这一轮刚跑完、后端还没给时长", () => {
  beforeEach(() => {
    vi.stubGlobal("useNuxtApp", () => ({
      $i18n: { t: ref(enUS), locale: ref("en-US") },
    }));
  });

  it("streaming 落下时前端自己量一次，先顶上", async () => {
    const wrapper = mountList({ messages: messages(), streaming: true });
    await flushPromises();
    // 还在跑的时候不该有终态时长。
    expect(wrapper.find("[data-testid='run-duration']").exists()).toBe(false);

    await wrapper.setProps({ streaming: false });
    await flushPromises();

    const duration = wrapper.get("[data-testid='run-duration']");
    expect(duration.text()).toContain(
      enUS.runDuration.completedIn(enUS.runDuration.lessThanSecond),
    );
    /*
      **还要问它挂在哪儿。** 只问「页面上有没有」的话，把落点改成 human 组也照样绿
      ——每个组都会渲染 `durations[index]`，时长挂错组一样画得出来。
    */
    expect(duration.element.parentElement?.textContent ?? "").not.toContain(
      "Ping from the user",
    );
  });

  it("后端给了值就用后端的，不会两个都画", async () => {
    const wrapper = mountList({ messages: messages(19), streaming: true });
    await flushPromises();
    await wrapper.setProps({ streaming: false });
    await flushPromises();

    const rows = wrapper.findAll("[data-testid='run-duration']");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.text()).toContain(enUS.runDuration.seconds(19));
    expect(rows[0]!.text()).not.toContain(enUS.runDuration.lessThanSecond);
  });

  it("出错时不画", async () => {
    const wrapper = mountList({
      messages: messages(),
      streaming: true,
      threadError: new Error("boom"),
    });
    await flushPromises();
    await wrapper.setProps({ streaming: false });
    await flushPromises();

    expect(wrapper.find("[data-testid='run-duration']").exists()).toBe(false);
  });

  it("出错的那一轮压根不记——错误后来消失了也不该冒出来", async () => {
    /*
      上一条只证明了**渲染侧**那道 threadError 判断在起作用；写入侧那道单独删掉时它照样绿。
      这一条把错误清掉，逼出「当时到底记没记」——失败的 run 不该在事后变出一个耗时。
    */
    const wrapper = mountList({
      messages: messages(),
      streaming: true,
      threadError: new Error("boom"),
    });
    await flushPromises();
    await wrapper.setProps({ streaming: false });
    await flushPromises();
    await wrapper.setProps({ threadError: undefined });
    await flushPromises();

    expect(wrapper.find("[data-testid='run-duration']").exists()).toBe(false);
  });

  it("上一轮记下的时长，在这一轮出错时要藏起来", async () => {
    /*
      这一条逼的是**渲染侧**那道 threadError 判断。前四条都逼不出它：写入侧那道
      已经把出错的轮次挡在外面了，于是删掉渲染侧那道也照样全绿。
      要区分两者，就得让「记下来的是一轮成功的 run，而现在线程是错的」。
    */
    const wrapper = mountList({ messages: messages(), streaming: true });
    await flushPromises();
    await wrapper.setProps({ streaming: false });
    await flushPromises();
    expect(wrapper.find("[data-testid='run-duration']").exists()).toBe(true);

    await wrapper.setProps({ threadError: new Error("boom") });
    await flushPromises();
    expect(wrapper.find("[data-testid='run-duration']").exists()).toBe(false);
  });

  it("threadId 在这一轮跑完之后才交接过来，时长照样显示", async () => {
    /*
      新建会话那条路上就是这个时序：run 结束时这个组件拿到的 threadId 还是空的，
      真 id 稍后才交接过来。**这一条是上面那次假绿的判据**——键里但凡带上 threadId，
      写进去的和读出来的就对不上，这一条会红。
    */
    const wrapper = mountList({
      messages: messages(),
      streaming: true,
      threadId: "",
    });
    await flushPromises();
    await wrapper.setProps({ streaming: false });
    await flushPromises();
    await wrapper.setProps({ threadId: "thread-1" });
    await flushPromises();

    expect(wrapper.get("[data-testid='run-duration']").text()).toContain(
      enUS.runDuration.completedIn(enUS.runDuration.lessThanSecond),
    );
  });

  it("换到另一个真会话时，上一个会话量出来的秒数不复用", async () => {
    /*
      上游把 threadId 拼进键就是为了这件事。本仓的键只有 group.id，所以这条判据改由
      「真 id 之间切换时清空」保证——**得有一条用例钉住它**，否则那个 watch 删掉也全绿。
    */
    const wrapper = mountList({
      messages: messages(),
      streaming: true,
      threadId: "thread-1",
    });
    await flushPromises();
    await wrapper.setProps({ streaming: false });
    await flushPromises();
    expect(wrapper.find("[data-testid='run-duration']").exists()).toBe(true);

    await wrapper.setProps({ threadId: "thread-2" });
    await flushPromises();
    expect(wrapper.find("[data-testid='run-duration']").exists()).toBe(false);
  });
});
