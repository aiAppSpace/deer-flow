import { beforeEach, expect, rs, test } from "@rstest/core";

import {
  deleteThreadWithSidecars,
  findSidecarThreadIdsForParent,
} from "@/core/threads/hooks";
import type { AgentThread } from "@/core/threads/types";

const cleanupFetch = rs.hoisted(() => rs.fn());
rs.mock("@/core/api/fetcher", () => ({ fetch: cleanupFetch }));
beforeEach(() => {
  cleanupFetch
    .mockReset()
    .mockResolvedValue(new Response(null, { status: 204 }));
});

function makeThread(
  threadId: string,
  metadata: Record<string, unknown> = {},
): AgentThread {
  return {
    thread_id: threadId,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    metadata,
    status: "idle",
    values: { title: threadId, messages: [] },
  } as unknown as AgentThread;
}

test("finds only sidecar threads attached to the deleted parent thread", async () => {
  const search = rs.fn().mockResolvedValueOnce([
    makeThread("sidecar-1", {
      deerflow_sidecar: true,
      parent_thread_id: "parent-1",
    }),
    makeThread("sidecar-other-parent", {
      deerflow_sidecar: true,
      parent_thread_id: "parent-2",
    }),
    makeThread("primary-1"),
  ]);

  await expect(
    findSidecarThreadIdsForParent(
      {
        threads: {
          search,
        },
      },
      "parent-1",
    ),
  ).resolves.toEqual(["sidecar-1"]);

  expect(search).toHaveBeenCalledWith({
    metadata: {
      deerflow_sidecar: true,
      parent_thread_id: "parent-1",
    },
    limit: 100,
    offset: 0,
    sortBy: "updated_at",
    sortOrder: "desc",
    select: ["thread_id", "metadata"],
  });
});

test("deletes parent and sidecars exactly once through the canonical thread API", async () => {
  const search = rs.fn().mockResolvedValueOnce([
    makeThread("sidecar-1", {
      deerflow_sidecar: true,
      parent_thread_id: "parent-1",
    }),
  ]);
  const deleteThread = rs.fn().mockResolvedValue(undefined);

  await expect(
    deleteThreadWithSidecars(
      {
        threads: {
          search,
          delete: deleteThread,
        },
      },
      "parent-1",
    ),
  ).resolves.toEqual(["sidecar-1"]);

  expect(cleanupFetch).toHaveBeenCalledTimes(2);
  expect(cleanupFetch).toHaveBeenNthCalledWith(
    1,
    expect.stringContaining("/api/threads/sidecar-1"),
    { method: "DELETE" },
  );
  expect(cleanupFetch).toHaveBeenNthCalledWith(
    2,
    expect.stringContaining("/api/threads/parent-1"),
    { method: "DELETE" },
  );
  expect(deleteThread).toHaveBeenCalledTimes(2);
  expect(deleteThread).toHaveBeenNthCalledWith(1, "sidecar-1");
  expect(deleteThread).toHaveBeenNthCalledWith(2, "parent-1");
});
