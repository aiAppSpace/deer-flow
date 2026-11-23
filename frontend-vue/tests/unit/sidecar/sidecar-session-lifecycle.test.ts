import { describe, expect, it, vi } from "vitest";

import { createSidecarSessionLifecycle } from "@/core/sidecar/session-lifecycle";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

const context = {
  type: "referenced_message" as const,
  label: "Selected assistant text #1",
  messageId: "message-1",
  role: "assistant" as const,
  content: "Use this context.",
};

describe("sidecar session lifecycle", () => {
  it("restores before creating and coalesces concurrent ensure calls", async () => {
    const restore = deferred<{ thread_id: string } | null>();
    const create = deferred<{ thread_id: string }>();
    const findLatest = vi.fn(() => restore.promise);
    const createThread = vi.fn(() => create.promise);
    let threadId: string | null = null;
    const states: string[] = [];
    const lifecycle = createSidecarSessionLifecycle({
      parentThreadId: "parent-1",
      getThreadId: () => threadId,
      setThreadId: (value) => {
        threadId = value;
      },
      findLatest,
      createThread,
      onStateChange: (state) => states.push(state.phase),
    });

    const first = lifecycle.ensure([context]);
    const second = lifecycle.ensure([context]);

    expect(findLatest).toHaveBeenCalledTimes(1);
    expect(createThread).not.toHaveBeenCalled();
    expect(lifecycle.state.phase).toBe("restoring");

    restore.resolve(null);
    await vi.waitFor(() => expect(createThread).toHaveBeenCalledTimes(1));
    expect(createThread).toHaveBeenCalledWith({
      parentThreadId: "parent-1",
      signal: expect.any(AbortSignal),
      context: [context],
    });

    create.resolve({ thread_id: "sidecar-1" });
    await expect(Promise.all([first, second])).resolves.toEqual([
      "sidecar-1",
      "sidecar-1",
    ]);
    expect(threadId).toBe("sidecar-1");
    expect(lifecycle.state.phase).toBe("ready");
    expect(states).toEqual(["restoring", "idle", "creating", "ready"]);
  });

  it("adopts a restored thread and never creates a duplicate", async () => {
    const createThread = vi.fn();
    let threadId: string | null = null;
    const lifecycle = createSidecarSessionLifecycle({
      parentThreadId: "parent-1",
      getThreadId: () => threadId,
      setThreadId: (value) => {
        threadId = value;
      },
      findLatest: vi.fn(async () => ({ thread_id: "restored-sidecar" })),
      createThread,
    });

    await expect(lifecycle.ensure([context])).resolves.toBe("restored-sidecar");
    expect(createThread).not.toHaveBeenCalled();
    expect(lifecycle.state.phase).toBe("ready");
  });

  it("surfaces restore errors and does not create on an unknown restore result", async () => {
    const createThread = vi.fn();
    const lifecycle = createSidecarSessionLifecycle({
      parentThreadId: "parent-1",
      getThreadId: () => null,
      setThreadId: vi.fn(),
      findLatest: vi.fn(async () => {
        throw new Error("restore unavailable");
      }),
      createThread,
    });

    await expect(lifecycle.ensure([context])).rejects.toThrow(
      "restore unavailable",
    );
    expect(createThread).not.toHaveBeenCalled();
    expect(lifecycle.state).toMatchObject({
      phase: "error",
      error: expect.any(Error),
    });
  });

  it("ignores stale restore and create results after disposal", async () => {
    const restore = deferred<{ thread_id: string } | null>();
    const setThreadId = vi.fn();
    let requestSignal: AbortSignal | undefined;
    const lifecycle = createSidecarSessionLifecycle({
      parentThreadId: "parent-1",
      getThreadId: () => null,
      setThreadId,
      findLatest: vi.fn(({ signal }) => {
        requestSignal = signal;
        return restore.promise;
      }),
      createThread: vi.fn(),
    });

    const pending = lifecycle.restore();
    lifecycle.dispose();
    expect(requestSignal?.aborted).toBe(true);
    restore.resolve({ thread_id: "stale-sidecar" });

    await expect(pending).resolves.toBeNull();
    expect(setThreadId).not.toHaveBeenCalled();
    expect(lifecycle.state.phase).toBe("idle");
  });

  it("cancels a pending create without adopting a late sidecar from the previous owner", async () => {
    const create = deferred<{ thread_id: string }>();
    let requestSignal: AbortSignal | undefined;
    const setThreadId = vi.fn();
    const lifecycle = createSidecarSessionLifecycle({
      parentThreadId: "parent-a",
      getThreadId: () => null,
      setThreadId,
      findLatest: async () => null,
      createThread: ({ signal }) => {
        requestSignal = signal;
        return create.promise;
      },
    });
    const pending = lifecycle.ensure(context);
    await vi.waitFor(() => expect(requestSignal).toBeInstanceOf(AbortSignal));
    lifecycle.dispose();
    expect(requestSignal?.aborted).toBe(true);
    create.resolve({ thread_id: "late-a" });
    await expect(pending).resolves.toBeNull();
    expect(setThreadId).not.toHaveBeenCalled();
  });

  it("force restore clears a cached id when the backend no longer has it", async () => {
    let threadId: string | null = "deleted-elsewhere";
    const lifecycle = createSidecarSessionLifecycle({
      parentThreadId: "parent-1",
      getThreadId: () => threadId,
      setThreadId: (value) => {
        threadId = value;
      },
      findLatest: vi.fn(async () => null),
      createThread: vi.fn(),
    });

    await expect(lifecycle.restore({ force: true })).resolves.toBeNull();
    expect(threadId).toBeNull();
    expect(lifecycle.state.phase).toBe("idle");
  });
});
