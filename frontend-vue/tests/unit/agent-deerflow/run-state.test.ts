import { describe, expect, it, vi } from "vitest";

import {
  hydrateDeerFlowRunInput,
  loadDeerFlowRunState,
} from "@/core/agent-deerflow/run-state";

const handle = { threadId: "thread-1", runId: "run-1" };
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status });

describe("run input hydration", () => {
  it("rescues the original rich human before AI replay without duplicating durable IDs", () => {
    const old = { id: "old", type: "human", content: "old" };
    const human = {
      id: "human-1",
      type: "human",
      content: [{ type: "text", text: "question" }],
      additional_kwargs: { files: [{ path: "/mnt/a" }] },
    };
    const run = { kwargs: { input: { messages: [old, human, human] } } };
    const values = { title: "retained", messages: [old] };
    const hydrated = hydrateDeerFlowRunInput(values, run);
    expect(hydrated).toEqual({ title: "retained", messages: [old, human] });
    expect(hydrateDeerFlowRunInput(hydrated, run)).toEqual(hydrated);
    expect(values.messages).toEqual([old]);
  });

  it("loads both owned resources with the same cancellation signal", async () => {
    const signal = new AbortController().signal;
    const fetchImpl = vi.fn(async (url: RequestInfo | string) =>
      String(url).endsWith("/state")
        ? json({ values: { messages: [] } })
        : json({
            kwargs: {
              input: { messages: [{ id: "h", type: "human", content: "hi" }] },
            },
          }),
    );
    expect(
      await loadDeerFlowRunState({
        baseUrl: "/api/langgraph",
        handle,
        signal,
        fetchImpl,
      }),
    ).toMatchObject({ messages: [{ id: "h" }] });
    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      "/api/langgraph/threads/thread-1/state",
      "/api/langgraph/threads/thread-1/runs/run-1",
    ]);
    for (const [, init] of fetchImpl.mock.calls as unknown as [
      string,
      RequestInit,
    ][]) {
      expect(init.signal).toBe(signal);
    }
  });

  it("an evicted run record falls back to durable values, but failed durable reads remain errors", async () => {
    const make = (stateStatus: number) =>
      vi.fn(async (url: RequestInfo | string) =>
        String(url).endsWith("/state")
          ? json({ values: { title: "durable" } }, stateStatus)
          : json({ detail: "run evicted" }, 404),
      );
    const options = {
      baseUrl: "/api/langgraph",
      handle,
      signal: new AbortController().signal,
    };
    await expect(
      loadDeerFlowRunState({ ...options, fetchImpl: make(200) }),
    ).resolves.toEqual({ title: "durable" });
    await expect(
      loadDeerFlowRunState({ ...options, fetchImpl: make(503) }),
    ).rejects.toMatchObject({ status: 503 });
  });

  it("never absorbs abort as an unavailable run record", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new DOMException("aborted", "AbortError");
    });
    await expect(
      loadDeerFlowRunState({
        baseUrl: "/api/langgraph",
        handle,
        signal: new AbortController().signal,
        fetchImpl,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it.each([401, 403, 503])(
    "does not hide run-record HTTP %s as an evicted record",
    async (status) => {
      const fetchImpl = vi.fn(async (url: RequestInfo | string) =>
        String(url).endsWith("/state")
          ? json({ values: {} })
          : json({ detail: "unavailable" }, status),
      );
      await expect(
        loadDeerFlowRunState({
          baseUrl: "/api/langgraph",
          handle,
          signal: new AbortController().signal,
          fetchImpl,
        }),
      ).rejects.toMatchObject({ status });
    },
  );

  it("does not hide a run-record network failure", async () => {
    const failure = new TypeError("network unavailable");
    const fetchImpl = vi.fn(async (url: RequestInfo | string) => {
      if (String(url).endsWith("/state")) return json({ values: {} });
      throw failure;
    });
    await expect(
      loadDeerFlowRunState({
        baseUrl: "/api/langgraph",
        handle,
        signal: new AbortController().signal,
        fetchImpl,
      }),
    ).rejects.toBe(failure);
  });
});
