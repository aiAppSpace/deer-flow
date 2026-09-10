/*
  【文件职责】     固定browser WS 单一 owner、重连、pending navigate 与 stale generation 合同。
  【架构位置】     测试
  【主要导出】     无；Vitest cases
  【依赖关系】     app/core/browser/connection.ts
  【边界与注意】   使用确定性 fake socket/timer；不是 Gateway 或生产网络证明。
*/

import { describe, expect, it, vi } from "vitest";

import {
  BROWSER_RECONNECT_BASE_DELAY_MS,
  BROWSER_RECONNECT_MAX_ATTEMPTS,
  BrowserConnectionController,
  type BrowserSocketLike,
} from "@/core/browser/connection";

class FakeSocket implements BrowserSocketLike {
  readonly sent: string[] = [];
  readyState = 0;
  binaryType: BinaryType = "blob";
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  closed = false;

  constructor(readonly url: string) {}

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.closed = true;
    this.readyState = 3;
  }

  open() {
    this.readyState = 1;
    this.onopen?.(new Event("open"));
  }

  message(data: string | Blob | ArrayBuffer) {
    this.onmessage?.(new MessageEvent("message", { data }));
  }

  fail() {
    this.onerror?.(new Event("error"));
  }

  serverClose(code = 1006, reason = "") {
    this.readyState = 3;
    this.onclose?.({ code, reason } as CloseEvent);
  }
}

function createHarness() {
  const sockets: FakeSocket[] = [];
  const timers: Array<{
    callback: () => void;
    delay: number;
    cancelled: boolean;
  }> = [];
  const fallbackNavigate = vi.fn();
  const frames: Array<Blob | ArrayBuffer | string> = [];
  const controller = new BrowserConnectionController({
    buildUrl: (threadId, seedUrl) =>
      `ws://gateway/${threadId}?seed=${seedUrl ?? ""}`,
    createSocket: (url) => {
      const socket = new FakeSocket(url);
      sockets.push(socket);
      return socket;
    },
    setTimer: (callback, delay) => {
      timers.push({ callback, delay, cancelled: false });
      return timers.length - 1;
    },
    clearTimer: (handle) => {
      const timer = timers[Number(handle)];
      if (timer) timer.cancelled = true;
    },
    onFallbackNavigate: fallbackNavigate,
    onFrame: (frame) => frames.push(frame),
  });
  return { controller, sockets, timers, fallbackNavigate, frames };
}

function runTimer(
  timers: ReturnType<typeof createHarness>["timers"],
  index: number,
) {
  const timer = timers[index];
  expect(timer).toBeDefined();
  expect(timer?.cancelled).toBe(false);
  timer?.callback();
}

describe("BrowserConnectionController", () => {
  it("queues only the latest connecting navigate and flushes it exactly once", () => {
    const { controller, sockets } = createHarness();
    controller.start("thread-a", "https://seed.example/path");

    expect(
      controller.sendInput({ type: "navigate", url: "https://one.example" }),
    ).toBe("queued");
    expect(
      controller.sendInput({ type: "navigate", url: "https://two.example" }),
    ).toBe("queued");
    expect(sockets[0]?.sent).toEqual([]);

    sockets[0]?.open();
    expect(sockets[0]?.sent.map((frame) => JSON.parse(frame))).toEqual([
      { type: "navigate", url: "https://two.example" },
    ]);

    sockets[0]?.open();
    expect(sockets[0]?.sent).toHaveLength(1);
    expect(
      controller.sendInput({ type: "navigate", url: "https://three.example" }),
    ).toBe("sent");
    expect(sockets[0]?.sent.map((frame) => JSON.parse(frame))).toEqual([
      { type: "navigate", url: "https://two.example" },
      { type: "navigate", url: "https://three.example" },
    ]);
  });

  it("uses one bounded exponential reconnect path for error and close", () => {
    const { controller, sockets, timers, fallbackNavigate } = createHarness();
    controller.start("thread-a");
    controller.sendInput({ type: "navigate", url: "https://pending.example" });

    for (let attempt = 0; attempt < BROWSER_RECONNECT_MAX_ATTEMPTS; attempt++) {
      const socket = sockets[attempt]!;
      socket.fail();
      socket.serverClose();
      expect(timers).toHaveLength(attempt + 1);
      expect(timers[attempt]?.delay).toBe(
        Math.min(BROWSER_RECONNECT_BASE_DELAY_MS * 2 ** attempt, 10_000),
      );
      expect(controller.snapshot.status).toBe("reconnecting");
      runTimer(timers, attempt);
    }

    sockets[BROWSER_RECONNECT_MAX_ATTEMPTS]?.serverClose(4501);
    expect(timers).toHaveLength(BROWSER_RECONNECT_MAX_ATTEMPTS);
    expect(controller.snapshot.status).toBe("error");
    expect(controller.snapshot.canRetry).toBe(true);
    expect(controller.snapshot.error).toMatch(/4501|unavailable/i);
    expect(fallbackNavigate).toHaveBeenCalledOnce();
    expect(fallbackNavigate).toHaveBeenCalledWith({
      type: "navigate",
      url: "https://pending.example",
    });

    controller.retry();
    expect(controller.snapshot.status).toBe("connecting");
    expect(controller.snapshot.reconnectAttempt).toBe(0);
    expect(sockets).toHaveLength(BROWSER_RECONNECT_MAX_ATTEMPTS + 2);
  });

  it("cancels timers and ignores old sockets across thread, close, and dispose", () => {
    const { controller, sockets, timers } = createHarness();
    controller.start("thread-a", "https://a.example");
    const stale = sockets[0]!;
    controller.sendInput({ type: "navigate", url: "https://old.example" });
    stale.serverClose();
    expect(timers).toHaveLength(1);

    controller.start("thread-b", "https://b.example");
    expect(timers[0]?.cancelled).toBe(true);
    expect(stale.closed).toBe(true);
    stale.open();
    stale.message(
      JSON.stringify({ type: "url", url: "https://stale.example" }),
    );
    expect(controller.snapshot.liveUrl).toBeNull();
    expect(sockets[1]?.sent).toEqual([]);

    controller.stop();
    expect(controller.snapshot.status).toBe("idle");
    sockets[1]?.serverClose();
    expect(timers).toHaveLength(1);

    controller.dispose();
    expect(() => controller.retry()).not.toThrow();
    expect(sockets).toHaveLength(2);
  });

  it("normalizes equivalent seeds and steers a real seed change in band", () => {
    const { controller, sockets } = createHarness();
    controller.start("thread-a", "https://example.com/path/#one");
    sockets[0]?.open();

    controller.updateSeed("https://example.com/path/");
    expect(sockets[0]?.sent).toEqual([]);

    controller.updateSeed("https://example.com/other");
    expect(sockets[0]?.sent.map((frame) => JSON.parse(frame))).toEqual([
      { type: "navigate", url: "https://example.com/other" },
    ]);

    sockets[0]?.message(
      JSON.stringify({ type: "url", url: "https://example.com/redirected#x" }),
    );
    controller.updateSeed("https://example.com/redirected/");
    expect(sockets[0]?.sent).toHaveLength(1);
  });

  it("keeps binary frames separate and converges URL, title, and tabs from Gateway JSON", () => {
    const { controller, sockets, frames } = createHarness();
    controller.start("thread-a");
    sockets[0]?.open();
    const blob = new Blob(["jpeg"], { type: "image/jpeg" });
    const bytes = new ArrayBuffer(4);
    sockets[0]?.message(blob);
    sockets[0]?.message(bytes);
    sockets[0]?.message(
      JSON.stringify({ type: "frame", data: "legacy-base64" }),
    );
    sockets[0]?.message(
      JSON.stringify({ type: "url", url: "https://example.com/final" }),
    );
    sockets[0]?.message(
      JSON.stringify({
        type: "tabs",
        tabs: [
          {
            index: 0,
            title: "Final title",
            url: "https://example.com/final",
            active: true,
          },
        ],
      }),
    );

    expect(frames).toEqual([blob, bytes, "legacy-base64"]);
    expect(controller.snapshot.liveUrl).toBe("https://example.com/final");
    expect(controller.snapshot.title).toBe("Final title");
    expect(controller.snapshot.tabs).toHaveLength(1);
  });
});
