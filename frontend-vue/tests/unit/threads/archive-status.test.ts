import { afterEach, expect, test, vi } from "vitest";
import {
  fetchInfiniteThreadsPage,
  getInfiniteThreadsNextPageParam,
} from "@/core/threads/infinite";
import type { AgentThread } from "@/core/threads/types";

afterEach(() => vi.unstubAllGlobals());

test.each([false, true])(
  "preserves status through the real archive transport on every page (archived=%s)",
  async (archived) => {
    const thread = (id: string, sidecar = false) =>
      ({
        thread_id: id,
        status: "busy",
        metadata: sidecar ? { deerflow_sidecar: true } : {},
      }) as AgentThread;
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([thread("sidecar", true), thread("first")]),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([thread("second")]), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetch);
    const search = vi.fn();
    const page = await fetchInfiniteThreadsPage(
      { threads: { search } },
      {
        archived,
        status: "busy",
        metadata: { agent_name: "helper" },
      },
      7,
      2,
    );
    expect(search).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(
      fetch.mock.calls.map(([url, init]) => ({
        url,
        method: init.method,
        body: JSON.parse(init.body),
        credentials: init.credentials,
      })),
    ).toEqual([
      {
        url: "/api/threads/search",
        method: "POST",
        credentials: "include",
        body: {
          archived,
          status: "busy",
          metadata: { agent_name: "helper" },
          limit: 2,
          offset: 7,
        },
      },
      {
        url: "/api/threads/search",
        method: "POST",
        credentials: "include",
        body: {
          archived,
          status: "busy",
          metadata: { agent_name: "helper" },
          limit: 1,
          offset: 9,
        },
      },
    ]);
    expect(page.threads.map((item) => item.thread_id)).toEqual([
      "first",
      "second",
    ]);
    expect(getInfiniteThreadsNextPageParam(page)).toBe(10);
  },
);
