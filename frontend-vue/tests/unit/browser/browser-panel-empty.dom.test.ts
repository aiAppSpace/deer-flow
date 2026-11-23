/*
  【文件职责】     固定 BrowserPanel 无画面时的 live/static 空状态和导航反馈。
  【架构位置】     Vue DOM 单元测试；浏览器联动由 e2e-parity 独立覆盖。
  【主要导出】     无；Vitest cases
  【依赖关系】     BrowserPanel · navigation mutation · browser stream mock
  【边界与注意】   两种模式均检查图标、标题、说明；无截图导航通过 toast 反馈。
*/

import { flushPromises, mount } from "@vue/test-utils";
import { ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createWorkspaceToastStore,
  workspaceToastKey,
} from "@/core/workspace-shell/toast";
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

const toast = createWorkspaceToastStore();
function mountPanel() {
  return mount(BrowserPanel, {
    props: { threadId: "thread-1", active: true, frame: null },
    global: { provide: { [workspaceToastKey as symbol]: toast } },
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

  // 导航成功但无截图时，与 React 一样发出 warning toast，保留原空状态说明。
  it("reports a successful navigation without a screenshot through the shared warning toast", async () => {
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

    expect(
      toast.toasts.value.some(
        (item) =>
          item.kind === "warning" &&
          item.message === enUS.browser.navigatedNoScreenshot,
      ),
    ).toBe(true);
    expect(wrapper.text()).toContain(enUS.browser.noFrameDescription);
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
