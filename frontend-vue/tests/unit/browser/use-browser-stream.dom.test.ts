/*
  【文件职责】     固定 useBrowserStream 对 Vue scope、frame buffer 与 controller 的唯一适配路径。
  【架构位置】     测试
  【主要导出】     无；Vitest cases
  【依赖关系】     useBrowserStream.ts · fake WebSocket · happy-dom
  【边界与注意】   fake transport；握手权限与真实 binary frame 由 real-Gateway gate 证明。
*/

import { mount } from "@vue/test-utils";
import { defineComponent, h, toRef } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useBrowserStream } from "@/components/workspace/browser-view/useBrowserStream";

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
}

const sockets: FakeWebSocket[] = [];

describe("useBrowserStream", () => {
  beforeEach(() => {
    sockets.length = 0;
    vi.stubGlobal("WebSocket", FakeWebSocket);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:browser-frame");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(16);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("keeps a static last frame when Live is disabled, then clears it on thread change", async () => {
    let stream!: ReturnType<typeof useBrowserStream>;
    const Host = defineComponent({
      props: {
        threadId: { type: String, required: true },
        enabled: { type: Boolean, required: true },
        seed: { type: String, default: undefined },
      },
      setup(props) {
        stream = useBrowserStream(
          toRef(props, "threadId"),
          toRef(props, "enabled"),
          toRef(props, "seed"),
        );
        return () => h("div");
      },
    });
    const wrapper = mount(Host, {
      props: {
        threadId: "thread-a",
        enabled: true,
        seed: "https://seed.example",
      },
    });

    expect(sockets).toHaveLength(1);
    expect(
      stream.sendInput({ type: "navigate", url: "https://queued.example" }),
    ).toBe("queued");
    sockets[0]?.open();
    expect(sockets[0]?.sent.map((frame) => JSON.parse(frame))).toEqual([
      { type: "navigate", url: "https://queued.example" },
    ]);
    sockets[0]?.message(new Blob(["jpeg"], { type: "image/jpeg" }));
    expect(stream.frameUrl.value).toBe("blob:browser-frame");

    await wrapper.setProps({ enabled: false });
    expect(sockets[0]?.closed).toBe(true);
    expect(stream.status.value).toBe("idle");
    expect(stream.frameUrl.value).toBe("blob:browser-frame");

    await wrapper.setProps({ threadId: "thread-b" });
    await wrapper.setProps({ enabled: true });
    expect(stream.frameUrl.value).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:browser-frame");
    expect(sockets).toHaveLength(2);

    wrapper.unmount();
    expect(sockets[1]?.closed).toBe(true);
  });

  it("ignores stale Gateway state after a reactive thread switch", async () => {
    let stream!: ReturnType<typeof useBrowserStream>;
    const Host = defineComponent({
      props: { threadId: { type: String, required: true } },
      setup(props) {
        stream = useBrowserStream(toRef(props, "threadId"), toRef(true));
        return () => h("div");
      },
    });
    const wrapper = mount(Host, { props: { threadId: "thread-a" } });
    const stale = sockets[0]!;

    await wrapper.setProps({ threadId: "thread-b" });
    stale.message(
      JSON.stringify({ type: "url", url: "https://stale.example" }),
    );
    expect(stream.liveUrl.value).toBeNull();
    expect(sockets).toHaveLength(2);
    wrapper.unmount();
  });
});
