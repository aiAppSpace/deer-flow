import { describe, expect, it, vi } from "vitest";

const http = vi.hoisted(() => ({
  fetch: vi.fn(async () => new Response(null, { status: 204 })),
}));
vi.mock("@/core/api/fetcher", () => ({ fetch: http.fetch }));
vi.mock("@/core/config", () => ({ getBackendBaseURL: () => "" }));

import { GatewayResponseError } from "@/core/api/errors";
import {
  deleteThreadCascade,
  findSidecarThreadIdsForParent,
} from "@/core/threads/delete";
import type { AgentThread } from "@/core/threads/types";

function sidecar(id: string, parent = "main-1"): AgentThread {
  return {
    thread_id: id,
    created_at: "2026-08-21T00:00:00Z",
    updated_at: "2026-08-21T00:00:00Z",
    status: "idle",
    metadata: { deerflow_sidecar: true, parent_thread_id: parent },
    values: { title: `Side ${id}`, messages: [] },
    interrupts: {},
  };
}

/** 只翻页的那条路径上任何一次删除都是错的，让它自己喊出来。 */
async function neverDeletes(): Promise<never> {
  throw new Error("这条路径不该删任何线程");
}

describe("main-thread cascade deletion", () => {
  it("searches every raw page and advances offset by backend rows", async () => {
    const search = vi
      .fn()
      .mockResolvedValueOnce([sidecar("side-1"), sidecar("other", "other")])
      .mockResolvedValueOnce([sidecar("side-2")]);

    await expect(
      findSidecarThreadIdsForParent(
        // 这一条只翻页，不删；`delete` 给个哨兵，被调到就是回归。
        { threads: { search, delete: vi.fn(neverDeletes) } },
        "main-1",
        2,
      ),
    ).resolves.toEqual(["side-1", "side-2"]);
    expect(search).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ offset: 2, limit: 2 }),
    );
  });

  it("deletes sidecars concurrently before the main thread", async () => {
    const order: string[] = [];
    const client = {
      threads: {
        search: vi
          .fn()
          .mockResolvedValue([sidecar("side-1"), sidecar("side-2")]),
        delete: vi.fn(async (id: string) => {
          order.push(id);
        }),
      },
    };

    await expect(deleteThreadCascade(client, "main-1")).resolves.toEqual([
      "side-1",
      "side-2",
      "main-1",
    ]);
    expect(new Set(order.slice(0, 2))).toEqual(new Set(["side-1", "side-2"]));
    expect(order.at(-1)).toBe("main-1");
  });

  it("matches React: reports failed sidecars and still deletes the requested parent", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const deleted: string[] = [];
    const failure = new GatewayResponseError("delete failed", 503, null, "");
    const client = {
      threads: {
        search: vi
          .fn()
          .mockResolvedValue([sidecar("side-ok"), sidecar("side-bad")]),
        delete: vi.fn(async (id: string) => {
          if (id === "side-bad") throw failure;
          deleted.push(id);
        }),
      },
    };
    try {
      await expect(deleteThreadCascade(client, "main-1")).resolves.toEqual([
        "side-ok",
        "main-1",
      ]);
      expect(deleted).toEqual(["side-ok", "main-1"]);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("orphaned sidecar threads may remain"),
        [{ threadId: "side-bad", reason: failure }],
      );
    } finally {
      warn.mockRestore();
    }
  });

  it("matches React: reports sidecar discovery failure and still deletes the parent", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const failure = new Error("search unavailable");
    const client = {
      threads: {
        search: vi.fn().mockRejectedValue(failure),
        delete: vi.fn().mockResolvedValue(undefined),
      },
    };
    try {
      await expect(deleteThreadCascade(client, "main-1")).resolves.toEqual([
        "main-1",
      ]);
      expect(client.threads.delete).toHaveBeenCalledExactlyOnceWith("main-1");
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("skipping cascade cleanup"),
        failure,
      );
    } finally {
      warn.mockRestore();
    }
  });

  it("does not complete while local cleanup failed and retries cleanup after a remote 404", async () => {
    const remote = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(
        new GatewayResponseError("not found", 404, null, ""),
      );
    const client = {
      threads: { search: vi.fn().mockResolvedValue([]), delete: remote },
    };
    http.fetch.mockResolvedValueOnce(
      Response.json({ detail: "Cleanup failed" }, { status: 500 }),
    );
    await expect(deleteThreadCascade(client, "main-1")).rejects.toMatchObject({
      failedThreadIds: ["main-1"],
      message: "Cleanup failed",
    });
    await expect(deleteThreadCascade(client, "main-1")).resolves.toEqual([
      "main-1",
    ]);
    expect(remote).toHaveBeenCalledTimes(2);
    expect(http.fetch).toHaveBeenLastCalledWith("/api/threads/main-1", {
      method: "DELETE",
    });
  });

  it("treats a raced 404 sidecar delete as the desired idempotent result", async () => {
    const client = {
      threads: {
        search: vi.fn().mockResolvedValue([sidecar("already-gone")]),
        delete: vi.fn(async (id: string) => {
          if (id === "already-gone") {
            throw new GatewayResponseError("not found", 404, null, "");
          }
        }),
      },
    };
    await expect(deleteThreadCascade(client, "main-1")).resolves.toEqual([
      "already-gone",
      "main-1",
    ]);
  });
});
