/*
  【文件职责】     固定BrowserPanel 的 live/static、REST、geometry、keyboard 与 IME 接线。
  【架构位置】     测试
  【主要导出】     无；Vitest cases
  【依赖关系】     BrowserPanel.vue · Vue Query · fake WebSocket/Gateway fetch
  【边界与注意】   DOM/Mock 证明；不混称真实 Gateway 或真实生产 browser runtime。
*/

import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import BrowserPanel from "@/components/workspace/browser-view/BrowserPanel.vue";
import type { BrowserViewFrame } from "@/core/browser/frame";

class FakeWebSocket {
  static readonly OPEN = 1;
  readonly sent: string[] = [];
  readyState = 0;
  binaryType: BinaryType = "blob";
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  closed = false;

  constructor(readonly url: string) {
    sockets.push(this);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.closed = true;
    this.readyState = 3;
  }

  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.(new Event("open"));
  }

  message(data: string | Blob | ArrayBuffer) {
    this.onmessage?.(new MessageEvent("message", { data }));
  }

  serverClose(code = 1006, reason = "") {
    this.readyState = 3;
    this.onclose?.({ code, reason } as CloseEvent);
  }
}

const sockets: FakeWebSocket[] = [];
const animationFrames: FrameRequestCallback[] = [];

function mountPanel(
  frame: BrowserViewFrame | null = {
    screenshot: "/mnt/user-data/outputs/.browser-frames/static.png",
    url: "https://static.example/start",
    title: "Static title",
  },
) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  const wrapper = mount(BrowserPanel, {
    props: { threadId: "thread-a", active: true, frame },
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  });
  return { wrapper, queryClient };
}

/** 发出去的输入帧：形状由协议定，这里只要能按键名取值。 */
type InputFrame = Record<string, unknown>;

function parsedInputs(socket = sockets.at(-1)) {
  return socket?.sent.map((value) => JSON.parse(value) as InputFrame) ?? [];
}

function setImageGeometry(
  element: HTMLImageElement,
  options: {
    width: number;
    height: number;
    naturalWidth: number;
    naturalHeight: number;
    left?: number;
    top?: number;
  },
) {
  Object.defineProperty(element, "naturalWidth", {
    configurable: true,
    value: options.naturalWidth,
  });
  Object.defineProperty(element, "naturalHeight", {
    configurable: true,
    value: options.naturalHeight,
  });
  element.getBoundingClientRect = () =>
    ({
      left: options.left ?? 0,
      top: options.top ?? 0,
      width: options.width,
      height: options.height,
      right: (options.left ?? 0) + options.width,
      bottom: (options.top ?? 0) + options.height,
      x: options.left ?? 0,
      y: options.top ?? 0,
      toJSON: () => ({}),
    }) as DOMRect;
}

describe("BrowserPanel behavior", () => {
  beforeEach(() => {
    sockets.length = 0;
    animationFrames.length = 0;
    vi.stubGlobal("WebSocket", FakeWebSocket);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      animationFrames.push(callback);
      return animationFrames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:live-frame");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("queues connecting navigation and converges live URL/title from Gateway events", async () => {
    const { wrapper } = mountPanel();
    const input = wrapper.get(
      'input[placeholder="Enter a URL and press Enter"]',
    );
    await input.setValue("connecting.example/next");
    await wrapper.get("form").trigger("submit");
    expect(parsedInputs(sockets[0])).toEqual([]);

    sockets[0]?.open();
    expect(parsedInputs(sockets[0])).toEqual([
      { type: "navigate", url: "https://connecting.example/next" },
    ]);
    sockets[0]?.message(
      JSON.stringify({ type: "url", url: "https://resolved.example/final" }),
    );
    sockets[0]?.message(
      JSON.stringify({
        type: "tabs",
        tabs: [
          {
            index: 0,
            title: "Gateway title",
            url: "https://resolved.example/final",
            active: true,
          },
        ],
      }),
    );
    await nextTick();

    const mode = wrapper.get('[data-testid="browser-mode"]');
    expect(mode.text()).toBe("Live");
    expect(mode.attributes("data-variant")).toBe("default");
    expect(mode.attributes("title")).toBe("Stop live control");
    /*
      头部那一格是**面板标签**，不是页面标题：上游 browser-view-panel.tsx:342 画的
      就是 `t.common.browser`，和左边的 MonitorIcon 是一对。Gateway 报上来的页面
      标题只剩 `<img alt>` 一个出口。两半都断言（坑 57）：只断言 "Browser" 在，
      把标题重新接回头部也照样绿。
    */
    expect(wrapper.get("header").text()).toContain("Browser");
    expect(wrapper.get("header").text()).not.toContain("Gateway title");
    expect((input.element as HTMLInputElement).value).toBe(
      "https://resolved.example/final",
    );

    sockets[0]?.serverClose();
    await nextTick();
    // 上游两态：请求了 Live 但还没连上就是 "…"，不报重连次数。
    expect(wrapper.get('[data-testid="browser-mode"]').text()).toBe("…");
    await wrapper.setProps({ active: false });
    expect(sockets[0]?.closed).toBe(true);
    wrapper.unmount();
  });

  it("maps click/move/wheel to content pixels and forwards keydown/IME once", async () => {
    const { wrapper } = mountPanel();
    sockets[0]?.open();
    await nextTick();
    const image = wrapper.get('img[alt="Static title"]');
    setImageGeometry(image.element as HTMLImageElement, {
      width: 1000,
      height: 500,
      naturalWidth: 500,
      naturalHeight: 1000,
    });

    await image.trigger("click", { clientX: 100, clientY: 250 });
    await image.trigger("mousemove", { clientX: 100, clientY: 250 });
    expect(parsedInputs()).toEqual([]);

    await image.trigger("click", { clientX: 500, clientY: 250 });
    await image.trigger("mousemove", { clientX: 500, clientY: 250 });
    animationFrames.shift()?.(16);
    expect(parsedInputs()).toEqual([
      { type: "click", nx: 0.5, ny: 0.5 },
      { type: "move", nx: 0.5, ny: 0.5 },
    ]);

    const stage = wrapper.get('[data-testid="browser-stage"]');
    const wheel = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      clientX: 500,
      clientY: 250,
      deltaX: 1,
      deltaY: 2,
      deltaMode: 1,
    });
    stage.element.dispatchEvent(wheel);
    animationFrames.shift()?.(32);
    expect(wheel.defaultPrevented).toBe(true);
    expect(parsedInputs().at(-1)).toEqual({
      type: "wheel",
      dx: 32,
      dy: 64,
      nx: 0.5,
      ny: 0.5,
    });

    const panel = wrapper.get('[data-testid="browser-panel"]');
    const keydown = new KeyboardEvent("keydown", {
      key: "a",
      bubbles: true,
      cancelable: true,
    });
    panel.element.dispatchEvent(keydown);
    expect(keydown.defaultPrevented).toBe(true);
    expect(parsedInputs().at(-1)).toEqual({ type: "text", text: "a" });
    panel.element.dispatchEvent(
      new KeyboardEvent("keyup", { key: "a", bubbles: true }),
    );
    expect(parsedInputs().filter((event) => event.text === "a")).toHaveLength(
      1,
    );

    const localShortcut = new KeyboardEvent("keydown", {
      key: "l",
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });
    panel.element.dispatchEvent(localShortcut);
    expect(localShortcut.defaultPrevented).toBe(false);

    panel.element.dispatchEvent(
      new CompositionEvent("compositionstart", { bubbles: true }),
    );
    panel.element.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      }),
    );
    const compositionEnd = new CompositionEvent("compositionend", {
      bubbles: true,
    });
    Object.defineProperty(compositionEnd, "data", { value: "你" });
    panel.element.dispatchEvent(compositionEnd);
    expect(parsedInputs().at(-1)).toEqual({ type: "text", text: "你" });
    wrapper.unmount();
  });

  it("falls back to REST after bounded WS failure, exposes errors, and retries", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: "Browser navigation failed" }), {
          status: 502,
          statusText: "Bad Gateway",
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            screenshot:
              "/mnt/user-data/outputs/.browser-frames/rest-success.png",
            url: "https://rest.example/final",
            title: "REST title",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const { wrapper } = mountPanel(null);
    await wrapper
      .get('input[placeholder="Enter a URL and press Enter"]')
      .setValue("https://fallback.example");
    await wrapper.get("form").trigger("submit");

    const delays = [800, 1600, 3200, 6400, 10_000, 10_000];
    for (const delay of delays) {
      sockets.at(-1)?.serverClose(4501);
      await vi.advanceTimersByTimeAsync(delay);
    }
    sockets.at(-1)?.serverClose(4501);
    await nextTick();
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "/api/threads/thread-a/browser/navigate",
    );
    expect(wrapper.get('[role="alert"]').text()).toContain(
      "Browser navigation failed",
    );
    const staticMode = wrapper.get('[data-testid="browser-mode"]');
    expect(staticMode.text()).toBe("Live");
    expect(staticMode.attributes("data-variant")).toBe("ghost");
    expect(staticMode.attributes("title")).toBe("Take live control");

    await wrapper.get('button[aria-label="Retry navigation"]').trigger("click");
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(wrapper.emitted("frame")?.at(-1)?.[0]).toEqual({
      screenshot: "/mnt/user-data/outputs/.browser-frames/rest-success.png",
      url: "https://rest.example/final",
      title: "REST title",
    });
    // 页面标题唯一的出口：上游 `alt={frame?.title ?? "Browser view"}`。
    expect(wrapper.get("img").attributes("alt")).toBe("REST title");
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    wrapper.unmount();
  });
});
