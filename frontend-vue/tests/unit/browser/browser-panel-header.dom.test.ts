/*
  【文件职责】     钉住 browser 面板头部与舞台遮罩里**对照台账看不见**的那几条。
  【架构位置】     L3 单元测试
  【主要导出】     无；Vitest cases
  【依赖关系】     app/components/workspace/browser-view/BrowserPanel.vue
  【边界与注意】   `browser-feature` 现在会点开面板取样，所以头部的可访问名、禁用态与
                   几何都由对照门禁守着了。这里补的是**取样那一屏之外**的东西：

                   - 禁用判据（③）：取样时 requestedLive 恒为 true，两边都不禁用，
                     台账看不见「本仓还多要求 status==='open'」这条差异。
                   - 地址栏转圈（⑤）与舞台遮罩（⑥）：都要先发起一次导航或先有画面，
                     取样那一屏两个条件都不成立。
                   - 聚焦全选（⑨）与 `tabindex`（⑯）：一个要交互，一个只在静态态才分叉。

                   每条都断言两半（坑 57）：只断言「live 时不禁用」的话，把 disabled
                   写死成 false 也照样绿。
*/

import { mount } from "@vue/test-utils";
import { nextTick, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import BrowserPanel from "@/components/workspace/browser-view/BrowserPanel.vue";
import type { BrowserViewFrame } from "@/core/browser/frame";
import { enUS } from "@/core/i18n/locales/en-US";

const harness = vi.hoisted(() => {
  return {
    status: { value: "connecting" as string },
    frameUrl: { value: null as string | null },
    liveUrl: { value: null as string | null },
    error: { value: null as string | null },
    canRetry: { value: false },
    isPending: { value: false },
    sendInput: vi.fn(() => "sent" as const),
  };
});

vi.mock("@tanstack/vue-query", async () => {
  const { ref: vueRef } = await import("vue");
  const isPending = vueRef(false);
  harness.isPending = isPending;
  return {
    useMutation: () => ({
      mutateAsync: vi.fn(async () => ({
        screenshot: null,
        url: "https://example.com",
        title: "",
      })),
      isPending,
    }),
  };
});

vi.mock("@/components/workspace/browser-view/useBrowserStream", async () => {
  const { ref: vueRef } = await import("vue");
  const status = vueRef("connecting");
  const frameUrl = vueRef<string | null>(null);
  const liveUrl = vueRef<string | null>(null);
  const error = vueRef<string | null>(null);
  const canRetry = vueRef(false);
  harness.status = status;
  harness.frameUrl = frameUrl;
  harness.liveUrl = liveUrl;
  harness.error = error;
  harness.canRetry = canRetry;
  return {
    useBrowserStream: () => ({
      status,
      frameUrl,
      liveUrl,
      title: vueRef(""),
      tabs: vueRef([]),
      error,
      rejectedUrl: vueRef(null),
      reconnectAttempt: vueRef(0),
      canRetry,
      fallbackNavigate: vueRef(null),
      sendInput: harness.sendInput,
      retry: vi.fn(),
      clearError: vi.fn(),
    }),
  };
});

const STATIC_FRAME: BrowserViewFrame = {
  screenshot: "/mnt/user-data/outputs/.browser-frames/static.png",
  url: "https://static.example/start",
  title: "Static title",
};

function mountPanel(frame: BrowserViewFrame | null = null) {
  return mount(BrowserPanel, {
    props: { threadId: "thread-1", active: true, frame },
  });
}

function historyButtons(wrapper: ReturnType<typeof mountPanel>) {
  return [
    wrapper.get(`button[title='${enUS.browser.back}']`),
    wrapper.get(`button[title='${enUS.browser.forward}']`),
  ];
}

async function goStatic(wrapper: ReturnType<typeof mountPanel>) {
  await wrapper
    .get(`button[title='${enUS.browser.stopLiveControl}']`)
    .trigger("click");
}

describe("BrowserPanel header", () => {
  beforeEach(() => {
    harness.status.value = "connecting";
    harness.frameUrl.value = null;
    harness.liveUrl.value = null;
    harness.error.value = null;
    harness.canRetry.value = false;
    harness.isPending.value = false;
    harness.sendInput.mockClear();
    harness.sendInput.mockReturnValue("sent");
    vi.stubGlobal("useNuxtApp", () => ({
      $i18n: { t: ref(enUS), locale: ref("en-US") },
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("gates back/forward on the requested mode, not on the connection being open", () => {
    // 上游 `disabled={!live}`：连接中也让点，事件在 socket 那头自己丢掉。
    const wrapper = mountPanel();
    expect(harness.status.value).toBe("connecting");
    for (const button of historyButtons(wrapper))
      expect(button.attributes("disabled")).toBeUndefined();
  });

  it("disables back/forward once live control is handed back", async () => {
    const wrapper = mountPanel();
    await goStatic(wrapper);
    for (const button of historyButtons(wrapper))
      expect(button.attributes("disabled")).toBeDefined();
  });

  it("keeps the two history buttons in their own container so no header gap splits them", () => {
    const [back, forward] = historyButtons(mountPanel());
    const container = back!.element.parentElement;
    expect(container).toBe(forward!.element.parentElement);
    expect(container?.tagName.toLowerCase()).toBe("div");
    expect(container?.className).toContain("shrink-0");
    // 上游把这层放在 header 里，header 的 gap-2 因此只作用到容器外面。
    expect(container?.parentElement?.tagName.toLowerCase()).toBe("header");
  });

  it("shows the address-bar spinner for the live navigation window and clears it on the reported URL", async () => {
    vi.useFakeTimers();
    const wrapper = mountPanel();
    const form = wrapper.get("form");
    expect(form.find(".animate-spin").exists()).toBe(false);

    await wrapper
      .get(`input[placeholder='${enUS.browser.urlPlaceholder}']`)
      .setValue("example.com");
    await form.trigger("submit");
    expect(form.find(".animate-spin").exists()).toBe(true);

    // 上游的窗口是 1200ms（browser-view-panel.tsx:164）。
    vi.advanceTimersByTime(1199);
    await nextTick();
    expect(form.find(".animate-spin").exists()).toBe(true);
    vi.advanceTimersByTime(1);
    await nextTick();
    expect(form.find(".animate-spin").exists()).toBe(false);
  });

  it("clears the navigation spinner as soon as the live page reports its URL", async () => {
    vi.useFakeTimers();
    const wrapper = mountPanel();
    const form = wrapper.get("form");
    await wrapper
      .get(`input[placeholder='${enUS.browser.urlPlaceholder}']`)
      .setValue("example.com");
    await form.trigger("submit");
    expect(form.find(".animate-spin").exists()).toBe(true);

    harness.liveUrl.value = "https://example.com/landed";
    await nextTick();
    expect(form.find(".animate-spin").exists()).toBe(false);
  });

  it("veils the stage while connecting, but only once there is a frame to veil", async () => {
    // 没有画面那一支归空状态管；两个都画会叠出一层白纱。
    const empty = mountPanel(null);
    expect(empty.find(".backdrop-blur-\\[1px\\]").exists()).toBe(false);

    const wrapper = mountPanel(STATIC_FRAME);
    expect(wrapper.find(".backdrop-blur-\\[1px\\]").exists()).toBe(true);

    harness.status.value = "open";
    await nextTick();
    expect(wrapper.find(".backdrop-blur-\\[1px\\]").exists()).toBe(false);
  });

  it("selects the whole address on focus so a typed URL replaces it", async () => {
    const wrapper = mountPanel(STATIC_FRAME);
    const input = wrapper.get(
      `input[placeholder='${enUS.browser.urlPlaceholder}']`,
    ).element as HTMLInputElement;
    expect(input.value).toBe(STATIC_FRAME.url);
    const select = vi.spyOn(input, "select");
    input.dispatchEvent(new FocusEvent("focus"));
    expect(select).toHaveBeenCalledOnce();
  });

  it("names the address bar with its placeholder, not with an aria-label", () => {
    /*
      上游这颗输入框的可访问名来自 placeholder。挂 aria-label 会把它顶掉——
      对照场景的锚点就是 `role=textbox / name="Enter a URL and press Enter"`，
      加回来那条锚点当场取不到；这里再钉一次，好让变异跑得起单测。
    */
    const input = mountPanel().get("input");
    expect(input.attributes("aria-label")).toBeUndefined();
    expect(input.attributes("placeholder")).toBe(enUS.browser.urlPlaceholder);
  });

  it("takes the history and mode names from title, and keeps the close name explicit", () => {
    // 上游 Back/Forward/Live 三颗的名字来自 `title`；关闭那颗上游一个名字都没有，
    // 是 WCAG 4.1.2 缺陷，已按「两边同改」在 frontend/ 补上 `t.common.closeBrowser`。
    const wrapper = mountPanel();
    for (const button of historyButtons(wrapper))
      expect(button.attributes("aria-label")).toBeUndefined();
    const mode = wrapper.get('[data-testid="browser-mode"]');
    expect(mode.attributes("aria-label")).toBeUndefined();
    expect(mode.attributes("title")).toBe(enUS.browser.stopLiveControl);
    expect(
      wrapper
        .get(`button[aria-label='${enUS.browser.close}']`)
        .attributes("title"),
    ).toBeUndefined();
  });

  it("stops treating the address bar as under edit once the form is submitted", async () => {
    /*
      提交等于「这一版我说完了」：之后 Gateway 报上来的真实 URL 必须能写回地址栏。
      不清编辑态的话 liveUrl 那条 watch 会一直提前返回，地址栏永远停在用户敲的那一版。
      （这条路径原来没有守卫：既有用例都是 setValue 直接提交，从来没聚焦过，
      于是 editingUrl 本来就是 false，改坏了也看不出来——坑 74。）
    */
    const wrapper = mountPanel();
    const input = wrapper.get("input");
    await input.trigger("focus");
    await input.setValue("example.com");
    await wrapper.get("form").trigger("submit");

    harness.liveUrl.value = "https://example.com/landed";
    await nextTick();
    expect((input.element as HTMLInputElement).value).toBe(
      "https://example.com/landed",
    );
  });

  it("hands live control back when the socket cannot take the navigation", async () => {
    // 同样是坑 74：既有的 REST 回落用例走的是重连预算耗尽那条 watch，
    // 碰不到 navigate() 里这一支。
    const wrapper = mountPanel();
    harness.sendInput.mockReturnValue("unavailable");
    await wrapper.get("input").setValue("example.com");
    await wrapper.get("form").trigger("submit");
    await nextTick();

    const mode = wrapper.get('[data-testid="browser-mode"]');
    expect(mode.attributes("data-variant")).toBe("ghost");
    expect(mode.attributes("title")).toBe(enUS.browser.takeLiveControl);
  });

  /*
    第⑧类之外的一条：**放弃重连之后那颗键在说反话。** 上游只有三态，耗尽后停在
    `closed`，标签同样是 "…"——那是「还在连」的意思，而 `scheduleReconnect` 已经
    彻底 return。上游按两边同改在放弃时退出 live 模式（`onReconnectExhausted`）；
    本仓不能走那条路（`stop()` 会把快照重置，连带抹掉下面的 alert 与重试），
    所以本仓只把标签改诚实。

    两半都断言（坑 57）：只钉「error 时不画 …」的话，把 liveLabel 写死成 Live
    也照样绿——所以连着钉住「连接中仍然画 …」。
  */
  it("stops rendering the connecting ellipsis once the stream has given up", async () => {
    const wrapper = mountPanel();
    const mode = () => wrapper.get("[data-testid='browser-mode']");
    expect(mode().text()).toContain("…");
    expect(mode().text()).not.toContain(enUS.browser.live);

    harness.status.value = "error";
    harness.error.value = "Live browser connection closed.";
    harness.canRetry.value = true;
    await nextTick();

    expect(mode().text()).not.toContain("…");
    expect(mode().text()).toContain(enUS.browser.live);
    // live 模式还开着，所以 title 仍是「停止」而不是「接管」。
    expect(mode().attributes("title")).toBe(enUS.browser.stopLiveControl);
    // 失败的事实与出路留在内联提示里——这正是本仓与上游有意分叉的那一处，
    // 改标签不许把它一起改没了。
    const alert = wrapper.get("[role='alert']");
    expect(alert.text()).toContain("Live browser connection closed.");
    expect(
      alert.find(`button[aria-label='${enUS.browser.retryLive}']`).exists(),
    ).toBe(true);
  });

  it("only makes the panel a focus target while it is forwarding keys", async () => {
    // 上游 `tabIndex={live ? 0 : undefined}`：静态态下面板不该抢 Tab 序。
    const wrapper = mountPanel();
    const panel = wrapper.get('[data-testid="browser-panel"]');
    expect(panel.attributes("tabindex")).toBe("0");
    await goStatic(wrapper);
    expect(panel.attributes("tabindex")).toBeUndefined();
  });
});
