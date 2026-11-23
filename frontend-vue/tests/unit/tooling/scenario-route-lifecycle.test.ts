import { EventEmitter } from "node:events";
import type { Page, Route } from "@playwright/test";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  applyScenarioBackend,
  type ParityScenario,
} from "../../e2e-parity/support/scenarios";

afterEach(() => vi.useRealTimers());
function setup() {
  const events = new EventEmitter();
  let closed = false;
  let handler: ((route: Route) => Promise<unknown>) | undefined;
  const page = Object.assign(events, {
    isClosed: () => closed,
    route: async (_pattern: unknown, callback: typeof handler) => {
      handler = callback;
    },
  }) as unknown as Page;
  const scenario: ParityScenario = {
    id: "delay-owner",
    title: "Owned delayed route",
    backend: "gateway",
    path: "/",
    settle: [],
    routes: [{ pattern: "**/api/agents", delayMs: 15_000, json: [] }],
  };
  const fulfill = vi.fn(async () => undefined);
  return {
    install: () => applyScenarioBackend(page, scenario),
    run: () => handler!({ fulfill } as unknown as Route),
    fulfill,
    close: () => {
      closed = true;
      events.emit("close");
    },
    listeners: () => events.listenerCount("close"),
  };
}

describe("delayed route owner lifecycle", () => {
  it("retains the exact live 15-second response contract", async () => {
    vi.useFakeTimers();
    const owner = setup();
    await owner.install();
    const pending = owner.run();
    await vi.advanceTimersByTimeAsync(14_999);
    expect(owner.fulfill).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(owner.fulfill).toHaveBeenCalledWith({
      status: 200,
      contentType: "application/json",
      headers: undefined,
      body: "[]",
    });
    expect(owner.listeners()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("cancels this page's timer without fulfilling its disposed request", async () => {
    vi.useFakeTimers();
    const owner = setup();
    await owner.install();
    const pending = owner.run();
    expect(owner.listeners()).toBe(1);
    owner.close();
    await pending;
    expect(owner.fulfill).not.toHaveBeenCalled();
    expect(owner.listeners()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(owner.fulfill).not.toHaveBeenCalled();
  });
  it("does not publish for an already-closed page", async () => {
    vi.useFakeTimers();
    const owner = setup();
    await owner.install();
    owner.close();
    await owner.run();
    expect(owner.fulfill).not.toHaveBeenCalled();
    expect(owner.listeners()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});
