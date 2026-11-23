import { VueQueryPlugin, type QueryClient } from "@tanstack/vue-query";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { computed, defineComponent, h, ref } from "vue";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

vi.mock("vue-router", () => ({
  onBeforeRouteLeave: vi.fn(),
  onBeforeRouteUpdate: vi.fn(),
}));
vi.mock("@/core/api/fetcher", () => ({ fetch: vi.fn() }));
vi.mock("@/core/config", () => ({ getBackendBaseURL: () => "" }));

import { fetch } from "@/core/api/fetcher";
import { artifactKeys } from "@/core/artifacts/query-keys";
import { classifyArtifact } from "@/core/artifacts/policy";
import { useArtifactFileContent } from "@/composables/useArtifactFileContent";
import { useArtifactDraft } from "@/composables/useArtifactDraft";
import type { Message } from "@/core/types/message";

const mockedFetch = vi.mocked(fetch);
const clients: QueryClient[] = [];
const wrappers: VueWrapper[] = [];
let install: (app: unknown) => void;
const path = "/mnt/user-data/outputs/note.txt";
const revision = "a".repeat(64);

beforeAll(async () => {
  vi.stubGlobal("defineNuxtPlugin", (plugin: (app: unknown) => void) => plugin);
  install = (await import("@/plugins/vue-query"))
    .default as unknown as typeof install;
});

function visibility(state: "hidden" | "visible") {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: state,
  });
  document.dispatchEvent(new Event("visibilitychange", { bubbles: true }));
}

function response(content: string, sha = revision) {
  return new Response(content, {
    headers: { etag: `"${sha}"`, "content-length": String(content.length) },
  });
}

function observe(selected = path, sharedClient?: QueryClient) {
  let queryClient!: QueryClient;
  install({
    vueApp: {
      use(_plugin: unknown, options: { queryClient: QueryClient }) {
        queryClient = options.queryClient;
      },
    },
  });
  if (sharedClient) queryClient = sharedClient;
  // Preserve the production retry predicate; only remove its waiting delay.
  queryClient.setQueryDefaults(artifactKeys.root(), { retryDelay: 0 });
  clients.push(queryClient);
  const selection = ref({ selected, threadId: "thread-a", isMock: false });
  const streaming = ref(false);
  const messages = ref<Message[]>([]);
  const writeComplete = ref(false);
  const onLoaded = vi.fn();
  let owner!: ReturnType<typeof useArtifactFileContent>;
  let draft!: ReturnType<typeof useArtifactDraft>;
  const wrapper = mount(
    defineComponent({
      setup() {
        draft = useArtifactDraft();
        owner = useArtifactFileContent({
          selection,
          policy: computed(() => classifyArtifact(selection.value.selected)),
          streaming,
          messages,
          writeComplete,
          onLoaded(current, loaded) {
            onLoaded(current, loaded);
            if (loaded.sha256 && !loaded.truncated)
              draft.reconcile(current.selected, {
                content: loaded.content,
                sha256: loaded.sha256,
              });
          },
        });
        return () => h("output", owner.content.value || owner.error.value);
      },
    }),
    { global: { plugins: [[VueQueryPlugin, { queryClient }]] } },
  );
  wrappers.push(wrapper);
  return {
    owner,
    draft,
    wrapper,
    selection,
    streaming,
    messages,
    writeComplete,
    onLoaded,
    queryClient,
  };
}

beforeEach(() => {
  visibility("visible");
  mockedFetch
    .mockReset()
    .mockImplementation(async () => response("server one"));
});

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  clients.splice(0).forEach((client) => client.clear());
  vi.restoreAllMocks();
});

describe("artifact panel's actual Query lifecycle", () => {
  it("refreshes changed content on native visibility restoration while preserving a dirty draft", async () => {
    const { wrapper, draft, owner } = observe();
    await vi.waitFor(() => expect(wrapper.text()).toBe("server one"));
    draft.update(path, "unsaved draft");
    visibility("hidden");
    mockedFetch.mockImplementation(async () =>
      response("server two", "b".repeat(64)),
    );
    await flushPromises();
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    visibility("visible");
    await vi.waitFor(() => expect(owner.content.value).toBe("server two"));
    expect(mockedFetch).toHaveBeenCalledTimes(2);
    expect(draft.records[path]?.draftContent).toBe("unsaved draft");
    expect(draft.records[path]?.remoteContent).toBe("server two");
    expect(draft.records[path]?.conflict).toBe(true);
  });

  it("uses production transport-only retry and never retries an HTTP response", async () => {
    mockedFetch.mockRejectedValueOnce(new TypeError("connection reset"));
    const { owner } = observe();
    await vi.waitFor(() => expect(owner.content.value).toBe("server one"));
    expect(mockedFetch).toHaveBeenCalledTimes(2);
    mockedFetch.mockImplementation(
      async () =>
        new Response(JSON.stringify({ detail: "server failure" }), {
          status: 500,
        }),
    );
    await owner.reload();
    await vi.waitFor(() =>
      expect(owner.error.value).toBe("Failed to load artifact: 500"),
    );
    expect(mockedFetch).toHaveBeenCalledTimes(3);
  });

  it("preserves separate preview/full keys and resets full selection on thread or mock changes", async () => {
    mockedFetch.mockImplementation(async (_url, init) =>
      init?.headers
        ? new Response("short", {
            status: 206,
            headers: { "content-range": "bytes 0-4/10" },
          })
        : response("whole file"),
    );
    const { owner, selection, queryClient } = observe();
    await vi.waitFor(() => expect(owner.truncated.value).toBe(true));
    await owner.loadFull();
    await vi.waitFor(() => expect(owner.content.value).toBe("whole file"));
    expect(owner.fullContentLoaded.value).toBe(true);
    expect(mockedFetch).toHaveBeenCalledTimes(2);
    const key = { filepath: path, threadId: "thread-a", isMock: false };
    expect(
      queryClient.getQueryData(artifactKeys.content({ ...key, full: false })),
    ).toMatchObject({ content: "short", truncated: true });
    expect(
      queryClient.getQueryData(artifactKeys.content({ ...key, full: true })),
    ).toMatchObject({ content: "whole file", truncated: false });
    owner.acknowledgeSaved({ content: "saved whole", sha256: "d".repeat(64) });
    await vi.waitFor(() => expect(owner.content.value).toBe("saved whole"));
    expect(owner.fullContentLoaded.value).toBe(true);
    expect(mockedFetch).toHaveBeenCalledTimes(2);
    expect(
      queryClient.getQueryData(artifactKeys.content({ ...key, full: true })),
    ).toMatchObject({ content: "saved whole", sha256: "d".repeat(64) });
    expect(
      queryClient.getQueryData(artifactKeys.content({ ...key, full: false })),
    ).toMatchObject({ content: "short", truncated: true });
    selection.value = { ...selection.value, threadId: "thread-b" };
    await vi.waitFor(() => expect(mockedFetch).toHaveBeenCalledTimes(3));
    expect(mockedFetch.mock.calls.at(-1)?.[1]?.headers).toEqual({
      Range: "bytes=0-1048575",
    });
    await vi.waitFor(() => expect(owner.truncated.value).toBe(true));
    selection.value = { ...selection.value, isMock: true };
    await vi.waitFor(() => expect(mockedFetch).toHaveBeenCalledTimes(4));
    expect(String(mockedFetch.mock.calls.at(-1)?.[0])).toContain("/mock/api/");
  });

  it("aborts old selection and disposal work even when a transport resolves after ignoring cancellation", async () => {
    let settle!: (response: Response) => void;
    mockedFetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          settle = resolve;
        }),
    );
    const { owner, selection, wrapper, onLoaded } = observe();
    await flushPromises();
    const firstSignal = mockedFetch.mock.calls[0]?.[1]?.signal;
    selection.value = {
      ...selection.value,
      selected: "/mnt/user-data/outputs/new.txt",
    };
    await vi.waitFor(() => expect(owner.content.value).toBe("server one"));
    expect(firstSignal?.aborted).toBe(true);
    settle(response("late old content"));
    await flushPromises();
    expect(owner.content.value).toBe("server one");
    expect(
      onLoaded.mock.calls.every(([current]) => current.selected !== path),
    ).toBe(true);
    let afterDispose!: (response: Response) => void;
    mockedFetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          afterDispose = resolve;
        }),
    );
    void owner.reload();
    await flushPromises();
    const signal = mockedFetch.mock.calls.at(-1)?.[1]?.signal;
    const publications = onLoaded.mock.calls.length;
    wrapper.unmount();
    expect(signal?.aborted).toBe(true);
    afterDispose(response("late disposed content"));
    await flushPromises();
    expect(onLoaded).toHaveBeenCalledTimes(publications);
  });

  it("does not cancel and duplicate a stale full-file read when its canonical key already has cached data", async () => {
    const { owner, queryClient } = observe();
    await vi.waitFor(() => expect(owner.content.value).toBe("server one"));
    queryClient.setQueryData(
      artifactKeys.content({
        filepath: path,
        threadId: "thread-a",
        isMock: false,
        full: true,
      }),
      {
        content: "cached full",
        url: "/full",
        sha256: revision,
        truncated: false,
        previewBytes: 11,
        totalBytes: 11,
      },
    );
    let settle!: (response: Response) => void;
    mockedFetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          settle = resolve;
        }),
    );
    const loaded = owner.loadFull();
    await flushPromises();
    expect(mockedFetch).toHaveBeenCalledTimes(2);
    expect(mockedFetch.mock.calls[1]?.[1]?.signal?.aborted).toBe(false);
    settle(response("fresh full"));
    await loaded;
    await vi.waitFor(() => expect(owner.content.value).toBe("fresh full"));
  });

  it("remembers the last full-file selection across A to B to A without granting full reads to another file or thread", async () => {
    mockedFetch.mockImplementation(async (_url, init) =>
      init?.headers
        ? new Response("short", {
            status: 206,
            headers: { "content-range": "bytes 0-4/10" },
          })
        : response("whole file"),
    );
    const { owner, selection } = observe();
    await vi.waitFor(() => expect(owner.truncated.value).toBe(true));
    await owner.loadFull();
    expect(mockedFetch).toHaveBeenCalledTimes(2);
    const select = async (next: typeof selection.value, full: boolean) => {
      const calls = mockedFetch.mock.calls.length;
      selection.value = next;
      await vi.waitFor(() =>
        expect(mockedFetch).toHaveBeenCalledTimes(calls + 1),
      );
      expect(mockedFetch.mock.calls.at(-1)?.[1]?.headers).toEqual(
        full ? undefined : { Range: "bytes=0-1048575" },
      );
      await vi.waitFor(() =>
        expect(owner.content.value).toBe(full ? "whole file" : "short"),
      );
    };
    await select(
      {
        selected: "/mnt/user-data/outputs/b.txt",
        threadId: "thread-a",
        isMock: false,
      },
      false,
    );
    await select({ selected: path, threadId: "thread-a", isMock: false }, true);
    // React selects full content by path/thread; mock remains a separate cache
    // key, but does not change that explicit full-file selection.
    await select({ selected: path, threadId: "thread-a", isMock: true }, true);
    await select({ selected: path, threadId: "thread-b", isMock: true }, false);
    await select({ selected: path, threadId: "thread-a", isMock: false }, true);
  });

  it("deduplicates shared canonical reads and only aborts after the final observer disposes", async () => {
    let settle!: (response: Response) => void;
    mockedFetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          settle = resolve;
        }),
    );
    const first = observe();
    const second = observe(path, first.queryClient);
    await flushPromises();
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    const signal = mockedFetch.mock.calls[0]?.[1]?.signal;
    first.wrapper.unmount();
    expect(signal?.aborted).toBe(false);
    settle(response("shared content"));
    await vi.waitFor(() =>
      expect(second.owner.content.value).toBe("shared content"),
    );
    let disposed!: (response: Response) => void;
    mockedFetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          disposed = resolve;
        }),
    );
    void second.owner.reload();
    await flushPromises();
    const finalSignal = mockedFetch.mock.calls.at(-1)?.[1]?.signal;
    second.wrapper.unmount();
    expect(finalSignal?.aborted).toBe(true);
    disposed(response("late disposed"));
    await flushPromises();
  });

  it("acknowledges saved content in the current canonical cache and fences a late read", async () => {
    const { owner, queryClient } = observe();
    await vi.waitFor(() => expect(owner.content.value).toBe("server one"));
    let settle!: (response: Response) => void;
    mockedFetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          settle = resolve;
        }),
    );
    void owner.reload();
    await flushPromises();
    const signal = mockedFetch.mock.calls.at(-1)?.[1]?.signal;
    owner.acknowledgeSaved({
      content: "saved content",
      sha256: "c".repeat(64),
    });
    expect(signal?.aborted).toBe(true);
    await vi.waitFor(() => expect(owner.content.value).toBe("saved content"));
    settle(response("old server read"));
    await flushPromises();
    expect(owner.content.value).toBe("saved content");
    expect(
      queryClient.getQueryData(
        artifactKeys.content({
          filepath: path,
          threadId: "thread-a",
          isMock: false,
          full: false,
        }),
      ),
    ).toMatchObject({
      content: "saved content",
      truncated: false,
      sha256: "c".repeat(64),
    });
  });

  it("reloads once when the run settles and keeps write-file drafts out of HTTP and focus queries", async () => {
    const { owner, streaming, selection, messages, writeComplete } = observe();
    await vi.waitFor(() => expect(owner.content.value).toBe("server one"));
    streaming.value = true;
    await flushPromises();
    streaming.value = false;
    await vi.waitFor(() => expect(mockedFetch).toHaveBeenCalledTimes(2));
    messages.value = [
      {
        id: "ai",
        type: "ai",
        content: "",
        tool_calls: [
          {
            id: "call",
            name: "write_file",
            args: { content: "draft from stream" },
          },
        ],
      },
    ];
    selection.value = {
      ...selection.value,
      selected: `write-file:${path}?message_id=ai&tool_call_id=call`,
    };
    await vi.waitFor(() =>
      expect(owner.content.value).toBe("draft from stream"),
    );
    visibility("hidden");
    visibility("visible");
    streaming.value = true;
    await flushPromises();
    streaming.value = false;
    await flushPromises();
    expect(mockedFetch).toHaveBeenCalledTimes(2);
    expect(owner.fullContentLoaded.value).toBe(false);
    const writingMessage = messages.value[0];
    if (writingMessage?.type !== "ai")
      throw new Error("Missing writing AI message");
    writingMessage.tool_calls![0]!.args.content = "stream updated";
    await vi.waitFor(() => expect(owner.content.value).toBe("stream updated"));
    expect(mockedFetch).toHaveBeenCalledTimes(2);
    writeComplete.value = true;
    expect(owner.fullContentLoaded.value).toBe(true);
  });
});
