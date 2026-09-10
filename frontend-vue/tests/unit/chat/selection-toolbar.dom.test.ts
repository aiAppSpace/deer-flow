/*
  【文件职责】     守住划词工具条的锚定、翻转、按钮组成与「什么时候不该出现」。
  【架构位置】     测试
  【主要导出】     无
  【依赖关系】     MessageList.vue
  【边界与注意】   对照台账**只看得见其中一样**：工具条的可访问性树（wave 30 把一步
                   `select-text` 挂进 streaming-reasoning-order 之后）。它看不见的是
                   位置——工具条不是 settle 锚点，而 sampleGeometry 只量 settle 里的
                   `visible` 锚点（capture.ts 的函数头写着为什么）。实测同一段选区
                   上游画在 (367,197)、本仓改之前画在 (955,642)，台账两边都是 0 行。
                   所以 x/y/placement 只能由这个文件守。

                   选区是**浏览器状态**不是 DOM 状态，happy-dom 里 Range 的
                   getBoundingClientRect 恒为全 0，造不出「贴着视口顶端」这种场景。
                   所以这里把 getSelection 换成一份可控的替身，被测的是
                   onSelection 里那段判据本身：谁能起工具条、锚在哪、往哪翻。
*/

import { flushPromises, mount } from "@vue/test-utils";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

import MessageList from "@/components/chat/MessageList.vue";
import { enUS } from "@/core/i18n/locales/en-US";
import type { Message } from "@/core/types/message";
import {
  createWorkspaceToastStore,
  workspaceToastKey,
} from "@/core/workspace-shell/toast";
import { installAnimationFrameStub } from "../../support/animation-frame-stub";

const toastStore = createWorkspaceToastStore();

class ResizeObserverStub {
  observe() {}
  disconnect() {}
  unobserve() {}
}

let animationFrames: ReturnType<typeof installAnimationFrameStub>;

beforeEach(() => {
  toastStore.clear();
  vi.stubGlobal("useNuxtApp", () => ({
    $i18n: { t: ref(enUS), locale: ref("en-US") },
  }));
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  animationFrames = installAnimationFrameStub();
});

afterEach(() => {
  animationFrames.cleanup();
  vi.unstubAllGlobals();
  // 坑 130：工具条是 fixed 的，留在 body 上会遮住下一条用例。
  document.body.innerHTML = "";
});

const CONVERSATION: Message[] = [
  { id: "human-1", type: "human", content: [{ type: "text", text: "Who?" }] },
  { id: "ai-1", type: "ai", content: "I am DeerFlow, a super agent." },
];

type ListProps = InstanceType<typeof MessageList>["$props"];

function mountList(props: Partial<ListProps> = {}) {
  return mount(MessageList, {
    props: {
      messages: CONVERSATION,
      // 坑 121：Vue 把「没传」的 Boolean prop 变成 false，所以全部显式传。
      streaming: false,
      loading: false,
      interactive: true,
      isMock: false,
      isAdmin: false,
      threadId: "thread-1",
      selectionMode: "main",
      ...props,
    },
    attachTo: document.body,
    global: {
      provide: { [workspaceToastKey as symbol]: toastStore },
      plugins: [[VueQueryPlugin, { queryClient: new QueryClient() }]],
    },
  });
}

type SelectionStub = {
  text: string;
  anchorNode: Node | null;
  focusNode?: Node | null;
  rect?: { left: number; width: number; top: number; bottom: number };
  isCollapsed?: boolean;
  rangeCount?: number;
};

const removeAllRanges = vi.fn();

function stubSelection(stub: SelectionStub) {
  const rect = stub.rect ?? { left: 200, width: 120, top: 300, bottom: 318 };
  const selection = {
    toString: () => stub.text,
    isCollapsed: stub.isCollapsed ?? false,
    rangeCount: stub.rangeCount ?? 1,
    anchorNode: stub.anchorNode,
    focusNode: stub.focusNode === undefined ? stub.anchorNode : stub.focusNode,
    getRangeAt: () => ({ getBoundingClientRect: () => rect }),
    removeAllRanges,
  };
  vi.stubGlobal("getSelection", () => selection);
  return selection;
}

/** 起一次划词：把选区替身装好，再在那一轮的容器上派发 mouseup。 */
async function selectInTurn(
  wrapper: ReturnType<typeof mountList>,
  stub: Omit<SelectionStub, "anchorNode"> & { anchorNode?: Node | null },
) {
  const turn = wrapper.get("[data-assistant-turn]");
  stubSelection({
    anchorNode: stub.anchorNode ?? turn.element.firstChild,
    ...stub,
  });
  await turn.trigger("mouseup");
  await flushPromises();
}

function toolbar(wrapper: ReturnType<typeof mountList>) {
  return wrapper.find("[data-sidecar-selection-toolbar]");
}

describe("selection toolbar anchoring", () => {
  it("anchors on the selection and sits above it when there is room", async () => {
    const wrapper = mountList();
    await flushPromises();

    await selectInTurn(wrapper, {
      text: "I am DeerFlow",
      rect: { left: 200, width: 120, top: 300, bottom: 318 },
    });

    const bar = toolbar(wrapper);
    expect(bar.exists()).toBe(true);
    // 中线 200 + 120/2；上沿 300 - 8。
    expect(bar.attributes("style")).toContain("left: 260px");
    expect(bar.attributes("style")).toContain("top: 292px");
    expect(bar.classes()).toContain("-translate-x-1/2");
    expect(bar.classes()).toContain("-translate-y-full");
    expect(bar.classes()).not.toContain("translate-y-0");
  });

  /*
    翻转的判据是 `rect.top - 8 - 48 >= 0`（上游 message-list.tsx:711）。
    top=55 差一点点放不下，正好压住边界：56 就够了。
  */
  it("flips below the selection when it is too close to the viewport top", async () => {
    const wrapper = mountList();
    await flushPromises();

    await selectInTurn(wrapper, {
      text: "I am DeerFlow",
      rect: { left: 100, width: 40, top: 55, bottom: 73 },
    });

    const bar = toolbar(wrapper);
    expect(bar.attributes("style")).toContain("left: 120px");
    // 下沿 73 + 8。
    expect(bar.attributes("style")).toContain("top: 81px");
    expect(bar.classes()).toContain("translate-y-0");
    expect(bar.classes()).not.toContain("-translate-y-full");
  });

  it("stays above at exactly the boundary", async () => {
    const wrapper = mountList();
    await flushPromises();

    await selectInTurn(wrapper, {
      text: "I am DeerFlow",
      rect: { left: 100, width: 40, top: 56, bottom: 74 },
    });

    expect(toolbar(wrapper).classes()).toContain("-translate-y-full");
  });
});

describe("selection toolbar contents", () => {
  it("renders both actions with an icon plus a close button", async () => {
    const wrapper = mountList();
    await flushPromises();
    await selectInTurn(wrapper, { text: "I am DeerFlow" });

    const buttons = toolbar(wrapper).findAll("button");
    expect(buttons).toHaveLength(3);
    expect(buttons[0]!.text()).toBe(enUS.sidecar.addToConversation);
    expect(buttons[0]!.find("svg").exists()).toBe(true);
    expect(buttons[1]!.text()).toBe(enUS.sidecar.askInSideChat);
    expect(buttons[1]!.find("svg").exists()).toBe(true);
    expect(buttons[2]!.attributes("aria-label")).toBe(enUS.common.close);
  });

  it("closes on the close button without emitting a selection action", async () => {
    const wrapper = mountList();
    await flushPromises();
    await selectInTurn(wrapper, { text: "I am DeerFlow" });

    await toolbar(wrapper).findAll("button")[2]!.trigger("click");
    await flushPromises();

    expect(toolbar(wrapper).exists()).toBe(false);
    expect(wrapper.emitted("selectionAdd")).toBeUndefined();
    expect(wrapper.emitted("selectionAsk")).toBeUndefined();
  });

  /*
    上游三颗按钮都写了 `onMouseDown={(event) => event.preventDefault()}`：
    默认的 mousedown 会先折叠选区，高亮跟着消失。
  */
  it("keeps the selection alive by preventing mousedown on every button", async () => {
    const wrapper = mountList();
    await flushPromises();
    await selectInTurn(wrapper, { text: "I am DeerFlow" });

    for (const button of toolbar(wrapper).findAll("button")) {
      const event = new MouseEvent("mousedown", {
        bubbles: true,
        cancelable: true,
      });
      button.element.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    }
  });

  it("hides the side-chat action on the sidecar surface", async () => {
    const wrapper = mountList({ selectionMode: "sidecar" });
    await flushPromises();
    await selectInTurn(wrapper, { text: "I am DeerFlow" });

    const labels = toolbar(wrapper)
      .findAll("button")
      .map((button) => button.text());
    expect(labels).toContain(enUS.sidecar.addToConversation);
    expect(labels).not.toContain(enUS.sidecar.askInSideChat);
  });

  it("emits the quoted context without the toolbar's own coordinates", async () => {
    const wrapper = mountList();
    await flushPromises();
    await selectInTurn(wrapper, { text: "I am DeerFlow" });

    await toolbar(wrapper).findAll("button")[1]!.trigger("click");
    await flushPromises();

    const emitted = wrapper.emitted("selectionAsk");
    expect(emitted).toHaveLength(1);
    expect(Object.keys(emitted![0]![0] as object).sort()).toEqual([
      "displayIndex",
      "message",
      "selectedText",
    ]);
    expect(toolbar(wrapper).exists()).toBe(false);
  });
});

describe("when the toolbar must not appear", () => {
  it("ignores selections inside a human turn", async () => {
    const wrapper = mountList();
    await flushPromises();

    const human = wrapper.get('[data-role="human"]');
    stubSelection({ text: "Who?", anchorNode: human.element.firstChild });
    await human.trigger("mouseup");
    await flushPromises();

    expect(toolbar(wrapper).exists()).toBe(false);
  });

  /*
    中间过程组（工具步骤那一片）里划词，上游同样不给工具条：它的 onMouseUp 只挂在
    `group.type === "assistant"` 的组上，而工具步骤走的是 assistant:processing。

    这一条是负向验证逼出来的：只有上面那条「人类轮次」用例时，把
    `group?.type !== "assistant"` 整句删掉**照样全绿**——人类组会被后一句
    `message.type !== "ai"` 顺手挡住，两条判据在那个输入上重叠了。
    processing 组的 messages[0] 恰恰**是**一条 ai 消息，只有它能把两条判据分开。
  */
  it("ignores selections inside an intermediate processing group", async () => {
    const wrapper = mountList({
      messages: [
        {
          id: "human-1",
          type: "human",
          content: [{ type: "text", text: "Go" }],
        },
        {
          id: "ai-tooling",
          type: "ai",
          content: "",
          tool_calls: [{ id: "call-1", name: "bash", args: { cmd: "ls" } }],
        },
      ],
    });
    await flushPromises();

    const group = wrapper.get('[data-index="1"]');
    expect(group.attributes("data-assistant-turn")).toBeUndefined();
    stubSelection({ text: "ls", anchorNode: group.element.firstChild });
    await group.trigger("mouseup");
    await flushPromises();

    expect(toolbar(wrapper).exists()).toBe(false);
  });

  /*
    上游的判据是 `thread.isLoading`，挡的是**整屏**，不只是正在流的那一轮
    （message-list.tsx:656）。所以这一对用的是两轮会话、划的是**已经结束**的
    第一轮：只有「流着的时候整屏都不给划」才能让上面那条红、下面那条绿。

    第二轮的 ai 消息在流式期间进的是 assistant:processing 组
    （core/messages/utils.ts:155 的 isUnresolvedAssistantText），本来就没有
    data-assistant-turn，拿它当锚点会退化成在测分组而不是在测这条判据。
  */
  const twoTurns: Message[] = [
    { id: "human-1", type: "human", content: [{ type: "text", text: "Who?" }] },
    { id: "ai-1", type: "ai", content: "I am DeerFlow, a super agent." },
    {
      id: "human-2",
      type: "human",
      content: [{ type: "text", text: "More?" }],
    },
    { id: "ai-2", type: "ai", content: "Still answering." },
  ];

  it("ignores selections on a settled turn while the thread is streaming", async () => {
    const wrapper = mountList({ messages: twoTurns, streaming: true });
    await flushPromises();
    await selectInTurn(wrapper, { text: "I am DeerFlow" });

    expect(toolbar(wrapper).exists()).toBe(false);
  });

  it("opens on that same turn once the thread has settled", async () => {
    const wrapper = mountList({ messages: twoTurns, streaming: false });
    await flushPromises();
    await selectInTurn(wrapper, { text: "I am DeerFlow" });

    expect(toolbar(wrapper).exists()).toBe(true);
  });

  it("ignores selections when the surface has no selection mode", async () => {
    const wrapper = mountList({ selectionMode: undefined });
    await flushPromises();
    await selectInTurn(wrapper, { text: "I am DeerFlow" });

    expect(toolbar(wrapper).exists()).toBe(false);
  });

  /*
    起点在这一轮之外。上游先查 anchorNode 再查 focusNode，两条分支的处理还不一样：
    anchor 在外是**直接 return**（连既有的工具条都不动），focus 在外才清掉。
    少了这一条用例，「把 anchor 那次检查整段删掉」会是一条假绿——下面那条 leak
    用例只把 focusNode 挪了出去。
  */
  it("ignores a selection that starts outside the turn", async () => {
    const wrapper = mountList();
    await flushPromises();

    const turn = wrapper.get("[data-assistant-turn]");
    stubSelection({
      text: "Who? I am DeerFlow",
      anchorNode: document.body,
      focusNode: turn.element.firstChild,
    });
    await turn.trigger("mouseup");
    await flushPromises();

    expect(toolbar(wrapper).exists()).toBe(false);
  });

  /*
    漏到别的轮次里时**要说一句**（上游 `message-list.tsx:693` 的 `toast.info`）：
    引用会有歧义，静默不弹工具条看起来像划词坏了。
  */
  it("drops the toolbar when the selection leaks into another turn, and says why", async () => {
    const wrapper = mountList();
    await flushPromises();

    const turn = wrapper.get("[data-assistant-turn]");
    stubSelection({
      text: "Who? I am DeerFlow",
      anchorNode: turn.element.firstChild,
      focusNode: document.body,
    });
    await turn.trigger("mouseup");
    await flushPromises();

    expect(toolbar(wrapper).exists()).toBe(false);
    expect(toastStore.toasts.value).toEqual([
      {
        id: expect.any(Number),
        kind: "info",
        message: enUS.sidecar.selectionCrossesMessages,
      },
    ]);
  });

  it("drops the toolbar on an empty or collapsed selection", async () => {
    const wrapper = mountList();
    await flushPromises();
    await selectInTurn(wrapper, { text: "I am DeerFlow" });
    expect(toolbar(wrapper).exists()).toBe(true);

    await selectInTurn(wrapper, { text: "   " });
    expect(toolbar(wrapper).exists()).toBe(false);
  });

  it("closes on Escape", async () => {
    const wrapper = mountList();
    await flushPromises();
    await selectInTurn(wrapper, { text: "I am DeerFlow" });
    expect(toolbar(wrapper).exists()).toBe(true);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await flushPromises();

    expect(toolbar(wrapper).exists()).toBe(false);
  });

  /*
    滚动必须收起：坐标是 mouseup 那一刻的视口坐标，页面一滚工具条就与被引用的
    文字脱节。上游听的是 window 的**捕获**阶段，因为真正在滚的是会话流那个容器。
  */
  it("closes when any ancestor scrolls", async () => {
    const wrapper = mountList();
    await flushPromises();
    await selectInTurn(wrapper, { text: "I am DeerFlow" });
    expect(toolbar(wrapper).exists()).toBe(true);

    wrapper
      .get("[data-assistant-turn]")
      .element.dispatchEvent(new Event("scroll", { bubbles: false }));
    await flushPromises();

    expect(toolbar(wrapper).exists()).toBe(false);
  });
});

/*
  归属判定的回归守卫。此前这里按 `text(message).includes(selectedText)` 找消息，
  比的是 markdown **源码**；选区里是**渲染之后**的文字，一段跨越行内标记的选区
  在源码里不是子串，于是本仓静默不弹工具条，而上游只看 anchor/focus 在不在这一轮里。
*/
describe("selection spanning inline markup", () => {
  it("still opens for a selection that is not a substring of the markdown source", async () => {
    const wrapper = mountList({
      messages: [
        {
          id: "human-1",
          type: "human",
          content: [{ type: "text", text: "?" }],
        },
        { id: "ai-1", type: "ai", content: "this is **bold** text" },
      ],
    });
    await flushPromises();
    await selectInTurn(wrapper, { text: "is bold te" });

    expect(toolbar(wrapper).exists()).toBe(true);
  });
});
