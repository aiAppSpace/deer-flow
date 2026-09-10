/*
  【文件职责】     守住会话目录的出现条件、刻度上限与跳转。
  【架构位置】     测试
  【依赖关系】     MessageList.vue · ConversationOutline.vue
  【边界与注意】   出现条件是**够长才出现**：少于 5 轮滚一下就到了，多一个浮层只是挡路。
                   刻度封顶 24 根：不封顶的话一条两百轮的会话会画出两百根 0.5px 横杠，
                   糊成一片。收起时那一列刻度是纯装饰，读屏器不该逐条念。
*/

import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

vi.mock("@/core/skills/api", () => ({
  installSkill: vi.fn(),
  SkillRequestError: class extends Error {
    get isAdminRequired() {
      return false;
    }
  },
}));

import MessageList from "@/components/chat/MessageList.vue";
import { enUS } from "@/core/i18n/locales/en-US";
import type { Message } from "@/core/types/message";
import {
  createWorkspaceToastStore,
  workspaceToastKey,
} from "@/core/workspace-shell/toast";
import { installAnimationFrameStub } from "../../support/animation-frame-stub";

class ResizeObserverStub {
  observe() {}
  disconnect() {}
  unobserve() {}
}

let animationFrames: ReturnType<typeof installAnimationFrameStub>;
const toastStore = createWorkspaceToastStore();

beforeEach(() => {
  vi.stubGlobal("useNuxtApp", () => ({
    $i18n: { t: ref(enUS), locale: ref("en-US") },
  }));
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  animationFrames = installAnimationFrameStub();
});
afterEach(() => {
  animationFrames.cleanup();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

/** 造 n 轮「提问 + 回答」。 */
function turns(count: number): Message[] {
  return Array.from({ length: count }, (_, index) => [
    { id: `human-${index}`, type: "human", content: `Question ${index}` },
    { id: `ai-${index}`, type: "ai", content: `Answer ${index}` },
  ]).flat() as unknown as Message[];
}

type ListProps = InstanceType<typeof MessageList>["$props"];

function mountList(props: Partial<ListProps> & Pick<ListProps, "messages">) {
  return mount(MessageList, {
    attachTo: document.body,
    props: {
      streaming: false,
      loading: false,
      threadId: "thread-1",
      enableConversationOutline: true,
      ...props,
    },
    global: { provide: { [workspaceToastKey as symbol]: toastStore } },
  });
}

const trigger = () =>
  document.body.querySelector<HTMLElement>(
    '[data-testid="conversation-outline-trigger"]',
  );

describe("会话目录", () => {
  it.each([
    ["4 轮不出现", 4, false],
    ["5 轮出现", 5, true],
  ])("%s", async (_label, count, expected) => {
    const wrapper = mountList({ messages: turns(count) });
    await flushPromises();
    expect(trigger() !== null).toBe(expected);
    wrapper.unmount();
  });

  it("没开开关时一律不出现", async () => {
    const wrapper = mountList({
      messages: turns(20),
      enableConversationOutline: false,
    });
    await flushPromises();
    expect(trigger()).toBeNull();
    wrapper.unmount();
  });

  it("刻度封顶 24 根，且整列对读屏器隐藏", async () => {
    const wrapper = mountList({ messages: turns(200) });
    await flushPromises();
    const ticks = trigger()!.querySelector<HTMLElement>(
      '[data-testid="conversation-outline-ticks"]',
    )!;
    expect(ticks.children).toHaveLength(24);
    // 整列是纯装饰：读屏器逐条念二十四个小横杠毫无意义。
    expect(ticks.getAttribute("aria-hidden")).toBe("true");
    wrapper.unmount();
  });

  it("章数少于上限时按实际根数画", async () => {
    const wrapper = mountList({ messages: turns(7) });
    await flushPromises();
    expect(
      trigger()!.querySelector('[data-testid="conversation-outline-ticks"]')!
        .children,
    ).toHaveLength(7);
    wrapper.unmount();
  });

  it("展开后每一章一条，标题是那次提问", async () => {
    const wrapper = mountList({ messages: turns(6) });
    await flushPromises();
    trigger()!.click();
    await flushPromises();
    await wrapper.vm.$nextTick();
    const menu = document.body.querySelector(
      '[data-testid="conversation-outline-menu"]',
    )!;
    expect(menu.querySelectorAll('[role="menuitem"]')).toHaveLength(6);
    expect(menu.textContent).toContain("Question 0");
    expect(menu.textContent).toContain("Question 5");
    wrapper.unmount();
  });

  it("点一章会滚过去，并把它标成当前", async () => {
    const scrolled: unknown[] = [];
    Element.prototype.scrollIntoView = function (
      this: Element,
      ...args: unknown[]
    ) {
      scrolled.push({ index: this.getAttribute("data-index"), args });
    } as never;
    const wrapper = mountList({ messages: turns(6) });
    await flushPromises();
    trigger()!.click();
    await flushPromises();
    await wrapper.vm.$nextTick();

    const items = [
      ...document.body.querySelectorAll<HTMLElement>(
        '[data-testid="conversation-outline-menu"] [role="menuitem"]',
      ),
    ];
    // reka 的菜单项走 click 触发 select；pointerup 不够。
    items[2]!.click();
    await flushPromises();
    await wrapper.vm.$nextTick();

    // 第三章对应第 5 组（每轮两组：human 在偶数位）。
    expect(
      scrolled.some((entry) => (entry as { index: string }).index === "4"),
    ).toBe(true);
    expect(
      document.body.querySelector('[aria-current="location"]')?.textContent,
    ).toContain("Question 2");
    wrapper.unmount();
  });

  /*
    切走再切回来时，上一条会话选中的那一章不该在新会话里继续高亮。
    两条会话的消息 id 完全可能撞上（都是后端各自生成的），只比 chapterId
    的话，B 的同名那一章会莫名其妙地亮着。
  */
  it("切换会话后高亮落空，不会错标到另一条会话的同名章", async () => {
    Element.prototype.scrollIntoView = function () {} as never;
    const wrapper = mountList({ messages: turns(6) });
    await flushPromises();
    trigger()!.click();
    await flushPromises();
    await wrapper.vm.$nextTick();
    [
      ...document.body.querySelectorAll<HTMLElement>(
        '[data-testid="conversation-outline-menu"] [role="menuitem"]',
      ),
    ][2]!.click();
    await flushPromises();
    expect(document.body.querySelector('[aria-current="location"]')).not.toBe(
      null,
    );

    // 同样的消息 id，只是换了一条会话。
    await wrapper.setProps({ threadId: "thread-2", messages: turns(6) });
    await flushPromises();
    await wrapper.vm.$nextTick();
    expect(document.body.querySelector('[aria-current="location"]')).toBeNull();
    wrapper.unmount();
  });
});
