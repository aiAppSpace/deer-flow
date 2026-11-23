import type { InfiniteThreadsData } from "@/core/threads/infinite";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import { afterEach, expect, it, vi } from "vitest";
import { useThreads } from "@/composables/useThreads";
import { resetWorkspaceQueries } from "@/core/auth/workspace-queries";
import type { AgentThread } from "@/core/threads/types";

const transport = vi.hoisted(() => ({ updateState: vi.fn(), patch: vi.fn() }));
vi.mock("@/core/api/api-client", () => ({
  getAPIClient: () => ({ threads: { updateState: transport.updateState } }),
}));
vi.mock("@/core/threads/api", async (original) => ({
  ...(await original<typeof import("@/core/threads/api")>()),
  patchThreadMetadata: transport.patch,
}));
afterEach(() => vi.restoreAllMocks());

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  let threads!: ReturnType<typeof useThreads>;
  const wrapper = mount(
    defineComponent({
      setup() {
        threads = useThreads({ enabled: false });
        return () => h("div");
      },
    }),
    { global: { plugins: [[VueQueryPlugin, { queryClient: client }]] } },
  );
  const key = client.getQueryCache().getAll()[0]!.queryKey;
  const seed = (title: string) => {
    const data = {
      pages: [
        {
          threads: [
            {
              thread_id: "shared-id",
              metadata: { deerflow_pinned: false },
              values: { title, messages: [] },
              status: "idle",
            } as unknown as AgentThread,
          ],
          nextOffset: null,
        },
      ],
      pageParams: [0],
    };
    client.setQueryData(key, data);
    return client.getQueryData<InfiniteThreadsData>(key);
  };
  seed("Account A");
  return {
    client,
    wrapper,
    threads,
    key,
    seed,
    close: () => {
      wrapper.unmount();
      client.clear();
    },
  };
}

it.each(["rename", "pin"] as const)(
  "rejects a late %s response after the real workspace owner reset",
  async (operation) => {
    const pending = deferred();
    transport.updateState.mockReset().mockReturnValue(pending.promise);
    transport.patch.mockReset().mockReturnValue(pending.promise);
    const host = setup();
    try {
      await flushPromises();
      const result = (
        operation === "rename"
          ? host.threads.rename("shared-id", "Old draft")
          : host.threads.setPinned("shared-id", true)
      ).then(
        () => null,
        (error: unknown) => error,
      );
      await resetWorkspaceQueries(host.client);
      const accountB = host.seed("Account B");
      await flushPromises();
      const cancel = vi.spyOn(host.client, "cancelQueries");
      const invalidate = vi.spyOn(host.client, "invalidateQueries");
      pending.resolve();
      expect(await result).toMatchObject({ name: "AbortError" });
      expect(host.client.getQueryData(host.key)).toBe(accountB);
      expect(cancel).not.toHaveBeenCalled();
      expect(invalidate).not.toHaveBeenCalled();
    } finally {
      host.close();
    }
  },
);

it("checks rename ownership again after awaiting cancellation of old list requests", async () => {
  transport.updateState.mockReset().mockResolvedValue(undefined);
  const host = setup();
  const cancellation = deferred();
  try {
    const cancel = vi
      .spyOn(host.client, "cancelQueries")
      .mockImplementationOnce(() => cancellation.promise);
    const result = host.threads.rename("shared-id", "Old draft").then(
      () => null,
      (error: unknown) => error,
    );
    await flushPromises();
    expect(cancel).toHaveBeenCalledTimes(1);
    await resetWorkspaceQueries(host.client);
    const accountB = host.seed("Account B");
    const invalidate = vi.spyOn(host.client, "invalidateQueries");
    cancellation.resolve();
    expect(await result).toMatchObject({ name: "AbortError" });
    expect(host.client.getQueryData(host.key)).toBe(accountB);
    expect(invalidate).not.toHaveBeenCalled();
  } finally {
    cancellation.resolve();
    host.close();
  }
});

it("still updates pin state for the live account", async () => {
  transport.patch.mockReset().mockResolvedValue(undefined);
  const host = setup();
  try {
    await flushPromises();
    await host.threads.setPinned("shared-id", true);
    expect(transport.patch).toHaveBeenCalledWith("shared-id", {
      deerflow_pinned: true,
    });
    expect(
      host.client.getQueryData<InfiniteThreadsData>(host.key)?.pages[0]
        ?.threads[0]?.metadata?.deerflow_pinned,
    ).toBe(true);
  } finally {
    host.close();
  }
});
