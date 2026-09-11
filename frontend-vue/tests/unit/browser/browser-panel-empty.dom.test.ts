/*
  【文件职责】     钉住 browser 面板「还没有画面」那一支的空状态。
  【架构位置】     L3 单元测试
  【主要导出】     无；Vitest cases
  【依赖关系】     app/components/workspace/browser-view/BrowserPanel.vue
  【边界与注意】   这一支**对照台账测不到**：`browser-feature` 场景只断言触发器可见，
                   从来没打开过面板；就算打开，面板一进来就去连实时浏览器，
                   两个应用回落到静态的时机不一定同步，拿它当锚点会得到一份
                   随机变红的门禁。所以这里用组件测试钉。

                   原来这一支是一行居中文字（`grid place-items-center`），
                   上游是 `ConversationEmptyState`：图标 + 标题 + 说明三件
                   （browser-view-panel.tsx:440）。缺的是图标与整条说明。

                   live / static 两态都要断言（坑 57）：只断言 live 那半边的话，
                   把三目写成恒真也照样绿。
*/

import { flushPromises, mount } from "@vue/test-utils";
import { ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

import BrowserPanel from "@/components/workspace/browser-view/BrowserPanel.vue";
import { enUS } from "@/core/i18n/locales/en-US";

const navigateResult = vi.hoisted(() =>
  vi.fn<
    () => Promise<{ url: string; title: string; screenshot: string | null }>
  >(),
);

vi.mock("@tanstack/vue-query", () => ({
  useMutation: () => ({ mutateAsync: navigateResult, isPending: ref(false) }),
}));

vi.mock("@/components/workspace/browser-view/useBrowserStream", async () => {
  const { ref: vueRef } = await import("vue");
  return {
    useBrowserStream: () => ({
      status: vueRef("idle"),
      frameUrl: vueRef(null),
      liveUrl: vueRef(null),
      title: vueRef(""),
      tabs: vueRef([]),
      error: vueRef(null),
      rejectedUrl: vueRef(null),
      reconnectAttempt: vueRef(0),
      canRetry: vueRef(false),
      fallbackNavigate: vueRef(null),
      sendInput: vi.fn(),
      retry: vi.fn(),
      clearError: vi.fn(),
    }),
  };
});

function mountPanel() {
  return mount(BrowserPanel, {
    props: { threadId: "thread-1", active: true, frame: null },
  });
}

describe("BrowserPanel empty state", () => {
  beforeEach(() => {
    vi.stubGlobal("useNuxtApp", () => ({
      $i18n: { t: ref(enUS), locale: ref("en-US") },
    }));
  });

  it("uses the shared empty-state shape with an icon, a title and a description", () => {
    const wrapper = mountPanel();
    const heading = wrapper.get("h3");

    // 面板一进来 requestedLive 是 true，与上游 useState(true) 同一个起点。
    expect(heading.text()).toBe(enUS.browser.connectingFrame);
    expect(wrapper.text()).toContain(enUS.browser.connectingFrameDescription);

    const emptyState = heading.element.closest("div")?.parentElement;
    expect(emptyState?.className).toContain("items-center");
    expect(emptyState?.className).toContain("p-8");
    // 上游给这一处额外加的定位类，靠 cn 合进基线。
    expect(emptyState?.className).toContain("absolute");
    expect(emptyState?.className).toContain("m-auto");
    // 图标那一层：原来这一支一个图标都没有。
    expect(emptyState?.querySelector(".text-muted-foreground svg")).not.toBe(
      null,
    );
  });

  it("switches both the title and the description when live is turned off", async () => {
    const wrapper = mountPanel();
    await wrapper
      .get(`button[title='${enUS.browser.stopLiveControl}']`)
      .trigger("click");

    expect(wrapper.get("h3").text()).toBe(enUS.browser.noFrame);
    expect(wrapper.text()).toContain(enUS.browser.noFrameDescription);
    expect(wrapper.text()).not.toContain(enUS.browser.connectingFrame);
  });

  /*
    **导航成功、但一张图都没截到**——这一支原来什么都不说：`localFrame` 置空、
    面板变白，空状态照旧写着「暂无浏览器活动 / 在上方输入网址…」，
    而用户刚刚就是输完网址按了回车。上游这一支有话说（`toast.warning`），
    只是这个面板整体不走 toast（理由在 BrowserPanel.vue 的文件头），
    所以同一句话放进空状态的说明位。

    负向验证：把 `navigatedWithoutFrame.value = nextFrame === null` 去掉，
    这条立刻红（说明位退回 noFrameDescription）。
  */
  it("导航成功却没有截图时，空状态说明换成那句话而不是「输入网址」", async () => {
    navigateResult.mockResolvedValue({
      url: "https://example.com/",
      title: "Example",
      screenshot: null,
    });
    const wrapper = mountPanel();
    await wrapper
      .get(`button[title='${enUS.browser.stopLiveControl}']`)
      .trigger("click");
    await wrapper
      .get(`input[placeholder='${enUS.browser.urlPlaceholder}']`)
      .setValue("https://example.com");
    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(wrapper.text()).toContain(enUS.browser.navigatedNoScreenshot);
    expect(wrapper.text()).not.toContain(enUS.browser.noFrameDescription);
    // 不是错误：那条 role="alert" 不许出现。
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });

  it("keeps the stage on its own layer so the frame sits on neutral-900", () => {
    // 上游 main 是 neutral-950、里面的舞台是 neutral-900；本仓原来压成一层，
    // 画面背后露出来的于是是 neutral-950。
    const stage = mountPanel().get('[data-testid="browser-stage"]');
    expect(stage.attributes("class")).toContain("bg-neutral-900");
    expect(stage.element.parentElement?.className).toContain("bg-neutral-950");
  });
});
