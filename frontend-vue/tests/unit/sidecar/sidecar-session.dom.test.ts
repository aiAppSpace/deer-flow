import { flushPromises } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope, nextTick, ref, type EffectScope } from "vue";

import { useSidecarSession } from "@/composables/useSidecarSession";
import { enUS } from "@/core/i18n/locales/en-US";

const mocks = vi.hoisted(() => ({
  findLatestSidecarThread: vi.fn(),
  createSidecarThread: vi.fn(),
  uploadFiles: vi.fn(),
  uploadLimits: undefined as
    | { max_files: number; max_file_size: number; max_total_size: number }
    | undefined,
  fetchWithAuth: vi.fn(),
  stream: undefined as
    | {
        messages: { value: unknown[] };
        isStreaming: { value: boolean };
        isUploading: { value: boolean };
        isHistoryLoading: { value: boolean };
        error: { value: unknown };
        sendMessage: ReturnType<typeof vi.fn>;
      }
    | undefined,
}));

vi.mock("@/core/sidecar/api", () => ({
  findLatestSidecarThread: mocks.findLatestSidecarThread,
  createSidecarThread: mocks.createSidecarThread,
}));
vi.mock("@/core/uploads/api", () => ({
  uploadFiles: mocks.uploadFiles,
}));
vi.mock("@/core/api/fetcher", () => ({ fetch: mocks.fetchWithAuth }));
vi.mock("@/core/config", () => ({ getBackendBaseURL: () => "" }));
vi.mock("@/composables/useUploads", () => ({
  useUploadLimits: () => ({
    data: { value: mocks.uploadLimits },
  }),
}));
vi.mock("@/composables/useThreadStream", async () => {
  const { ref: vueRef } = await import("vue");
  return {
    useThreadStream: () => {
      const stream = {
        messages: vueRef([]),
        isStreaming: vueRef(false),
        isUploading: vueRef(false),
        isHistoryLoading: vueRef(false),
        error: vueRef(null),
        sendMessage: vi.fn(),
      };
      mocks.stream = stream;
      return stream;
    },
  };
});

function reference(id = 1) {
  return {
    id,
    context: {
      type: "referenced_message" as const,
      label: `Selected assistant text #${id}`,
      messageId: `message-${id}`,
      role: "assistant" as const,
      content: `Context ${id}`,
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("useSidecarSession", () => {
  let scope: EffectScope;

  beforeEach(() => {
    mocks.findLatestSidecarThread.mockReset().mockResolvedValue(null);
    mocks.createSidecarThread
      .mockReset()
      .mockResolvedValue({ thread_id: "sidecar-1" });
    mocks.uploadFiles.mockReset();
    mocks.uploadLimits = undefined;
    mocks.fetchWithAuth
      .mockReset()
      .mockResolvedValue(new Response(null, { status: 204 }));
    mocks.stream = undefined;
    scope = effectScope();
  });

  afterEach(() => scope.stop());

  function setup() {
    const parentThreadId = ref<string | null>("parent-1");
    const ownerKey = ref("alice:agent-a");
    const parentMessages = ref([]);
    const sidecarThreadId = ref<string | null>(null);
    const references = ref([reference()]);
    const context = ref({ model_name: "reasoner", mode: "pro" });
    const readonly = ref(false);
    const session = scope.run(() =>
      useSidecarSession({
        parentThreadId,
        ownerKey,
        parentMessages,
        sidecarThreadId,
        references,
        context,
        readonly,
        onReferencesAccepted(accepted) {
          const acceptedIds = new Set(accepted.map((item) => item.id));
          references.value = references.value.filter(
            (item) => !acceptedIds.has(item.id),
          );
        },
      }),
    )!;
    return {
      parentThreadId,
      ownerKey,
      readonly,
      sidecarThreadId,
      references,
      session,
      stream: mocks.stream!,
    };
  }

  it("retires a late restore and isolates drafts when the same parent changes Agent", async () => {
    const oldRestore = deferred<{ thread_id: string } | null>();
    mocks.findLatestSidecarThread
      .mockReturnValueOnce(oldRestore.promise)
      .mockResolvedValueOnce({ thread_id: "sidecar-agent-b" })
      .mockResolvedValueOnce({ thread_id: "sidecar-agent-a" });
    const { session, ownerKey, parentThreadId, sidecarThreadId } = setup();
    const oldSignal = mocks.findLatestSidecarThread.mock.calls[0]![0]
      .signal as AbortSignal;
    session.input.value = "Agent A draft";
    const file = new File(["Agent A"], "a.txt");
    session.addFiles([file]);
    ownerKey.value = "alice:agent-b";
    expect(oldSignal.aborted).toBe(true);
    expect(parentThreadId.value).toBe("parent-1");
    expect(session.input.value).toBe("");
    expect(session.selectedFiles.value).toEqual([]);
    await flushPromises();
    expect(sidecarThreadId.value).toBe("sidecar-agent-b");
    oldRestore.resolve({ thread_id: "sidecar-old" });
    await flushPromises();
    expect(sidecarThreadId.value).toBe("sidecar-agent-b");
    ownerKey.value = "alice:agent-a";
    expect(session.input.value).toBe("Agent A draft");
    expect(session.selectedFiles.value).toEqual([file]);
    await flushPromises();
    expect(sidecarThreadId.value).toBe("sidecar-agent-a");
  });

  it("uploads selected files to the restored-or-created thread and clears only on acceptance", async () => {
    const file = new File(["hello"], "notes.txt");
    mocks.uploadFiles.mockResolvedValue({
      success: true,
      files: [
        {
          filename: "notes.txt",
          size: file.size,
          path: "/tmp/notes.txt",
          virtual_path: "/mnt/user-data/uploads/notes.txt",
          artifact_url: "/artifact",
        },
      ],
      message: "ok",
      skipped_files: [],
    });
    const { session, stream, references } = setup();
    await flushPromises();
    session.input.value = "Review it";
    session.addFiles([file]);
    stream.sendMessage.mockImplementation(
      async (_threadId, _message, _context, options) => {
        options.onAccepted();
        return true;
      },
    );

    await expect(session.submit()).resolves.toBe(true);
    expect(mocks.uploadFiles).toHaveBeenCalledWith("sidecar-1", [file]);
    expect(stream.sendMessage).toHaveBeenCalledWith(
      "sidecar-1",
      {
        text: "Review it",
        files: [
          {
            filename: "notes.txt",
            size: file.size,
            path: "/mnt/user-data/uploads/notes.txt",
            status: "uploaded",
          },
        ],
      },
      undefined,
      expect.objectContaining({
        additionalInputMessages: expect.any(Array),
        additionalKwargs: expect.objectContaining({
          sidecar_visible_message: true,
        }),
        onAccepted: expect.any(Function),
      }),
    );
    expect(session.input.value).toBe("");
    expect(session.selectedFiles.value).toEqual([]);
    expect(references.value).toEqual([]);
  });

  it("keeps the draft after run failure and reuses its successful upload", async () => {
    const file = new File(["hello"], "notes.txt");
    mocks.uploadFiles.mockResolvedValue({
      success: true,
      files: [
        {
          filename: "notes.txt",
          size: file.size,
          path: "/tmp/notes.txt",
          virtual_path: "/mnt/user-data/uploads/notes.txt",
          artifact_url: "/artifact",
        },
      ],
      message: "ok",
      skipped_files: [],
    });
    const { session, stream } = setup();
    await flushPromises();
    session.input.value = "Retry me";
    session.addFiles([file]);
    stream.sendMessage
      .mockRejectedValueOnce(new Error("run rejected"))
      .mockImplementationOnce(
        async (_threadId, _message, _context, options) => {
          options.onAccepted();
          return true;
        },
      );

    await expect(session.submit()).resolves.toBe(false);
    expect(session.input.value).toBe("Retry me");
    expect(session.selectedFiles.value).toEqual([file]);

    await expect(session.submit()).resolves.toBe(true);
    expect(mocks.uploadFiles).toHaveBeenCalledTimes(1);
    expect(session.input.value).toBe("");
    expect(session.selectedFiles.value).toEqual([]);
  });

  it("drops duplicate submission and ignores stale upload results after a route change", async () => {
    const upload = deferred<{
      success: boolean;
      files: Array<{
        filename: string;
        size: number;
        path: string;
        virtual_path: string;
        artifact_url: string;
      }>;
      message: string;
      skipped_files: string[];
    }>();
    const file = new File(["old"], "old.txt");
    mocks.uploadFiles.mockReturnValue(upload.promise);
    const { session, stream, parentThreadId } = setup();
    await flushPromises();
    session.input.value = "Old route draft";
    session.addFiles([file]);

    const first = session.submit();
    await expect(session.submit()).resolves.toBe(false);
    parentThreadId.value = "parent-2";
    await nextTick();
    upload.resolve({
      success: true,
      files: [
        {
          filename: "old.txt",
          size: file.size,
          path: "/tmp/old.txt",
          virtual_path: "/mnt/user-data/uploads/old.txt",
          artifact_url: "/artifact",
        },
      ],
      message: "ok",
      skipped_files: [],
    });
    await expect(first).resolves.toBe(false);
    expect(stream.sendMessage).not.toHaveBeenCalled();

    parentThreadId.value = "parent-1";
    await nextTick();
    expect(session.input.value).toBe("Old route draft");
    expect(session.selectedFiles.value).toEqual([file]);
  });

  it("submits HIL to the sidecar thread, reports false on failure, and allows retry", async () => {
    mocks.findLatestSidecarThread.mockResolvedValue({
      thread_id: "restored-sidecar",
    });
    const { session, stream } = setup();
    await flushPromises();
    const request = {
      version: 2 as const,
      kind: "human_input_request" as const,
      source: "ask_clarification" as const,
      request_id: "request-1",
      question: "Ship it?",
      input_mode: "form" as const,
      fields: [
        {
          name: "approved",
          label: "Approved",
          type: "checkbox" as const,
          required: false,
        },
      ],
    };
    const response = {
      version: 1 as const,
      kind: "human_input_response" as const,
      source: "ask_clarification" as const,
      request_id: "request-1",
      response_kind: "text" as const,
      value: 'Approved: no [values: {"approved":false}]',
    };
    stream.sendMessage
      .mockResolvedValueOnce(false)
      .mockImplementationOnce(
        async (_threadId, _message, _context, options) => {
          options.onAccepted();
          return true;
        },
      );

    await expect(session.submitHumanInput(request, response)).resolves.toBe(
      false,
    );
    await expect(session.submitHumanInput(request, response)).resolves.toBe(
      true,
    );
    expect(stream.sendMessage).toHaveBeenLastCalledWith(
      "restored-sidecar",
      { text: expect.stringContaining("false") },
      undefined,
      expect.objectContaining({
        additionalInputMessages: [
          expect.objectContaining({
            additional_kwargs: expect.objectContaining({
              sidecar_context: true,
              parent_thread_id: "parent-1",
            }),
          }),
        ],
        additionalKwargs: expect.objectContaining({
          sidecar_visible_message: true,
          referenced_message_count: 1,
          hide_from_ui: true,
          human_input_response: response,
        }),
        onAccepted: expect.any(Function),
      }),
    );
  });

  it("blocks sidecar mutation handlers in read-only mode while allowing restored history", async () => {
    mocks.findLatestSidecarThread.mockResolvedValue({
      thread_id: "restored-sidecar",
    });
    const { session, stream, readonly } = setup();
    await flushPromises();
    readonly.value = true;
    session.setInput("Forbidden");
    session.addFiles([new File(["x"], "read-only.txt")]);
    expect(session.selectedFiles.value).toEqual([]);
    await expect(session.submit()).resolves.toBe(false);
    await expect(
      session.submitHumanInput(
        {
          kind: "human_input_request",
          id: "read-only",
          title: "Question",
          questions: [],
        } as never,
        {
          kind: "human_input_response",
          request_id: "read-only",
          answers: [],
        } as never,
      ),
    ).resolves.toBe(false);
    await expect(session.ensureThread([reference()])).resolves.toBeNull();
    await expect(session.deleteThread()).resolves.toBe(false);
    expect(stream.sendMessage).not.toHaveBeenCalled();
    expect(mocks.fetchWithAuth).not.toHaveBeenCalled();
    expect(session.threadId.value).toBe("restored-sidecar");
  });

  it("resets delete ownership on a parent switch and ignores the old completion", async () => {
    mocks.findLatestSidecarThread.mockResolvedValue({
      thread_id: "restored-sidecar",
    });
    const deletion = deferred<Response>();
    mocks.fetchWithAuth.mockReturnValueOnce(deletion.promise);
    const { session, parentThreadId } = setup();
    await flushPromises();
    const pending = session.deleteThread();
    expect(session.deleting.value).toBe(true);
    parentThreadId.value = "parent-2";
    expect(session.deleting.value).toBe(false);
    expect(mocks.fetchWithAuth.mock.calls[0]![1].signal.aborted).toBe(true);
    await nextTick();
    expect(session.deleting.value).toBe(false);
    session.setInput("New parent draft");
    deletion.resolve(new Response(null, { status: 204 }));
    await expect(pending).resolves.toBe(false);
    expect(session.input.value).toBe("New parent draft");
  });

  /*
    这一层会产出上屏文案，所以它必须走词典。三条原来都是写死的英文字面量——
    `.ts` 不在 i18n source guard 的扫描面内（它只扫产品 SFC），所以没人拦。

    三条正反都断言（坑 57）：只断言「等于词典那句」的话，把词典项改成同一串英文
    也照样绿；所以同时断言**不等于**原来那句自造的英文。
  */
  it("takes the upload-violation copy from the dictionary, one message per violation code", async () => {
    mocks.uploadLimits = {
      max_files: 1,
      max_file_size: 10,
      max_total_size: 15,
    };
    const { session } = setup();

    session.addFiles([
      new File(["0123456789abc"], "big.txt"),
      new File(["x"], "second.txt"),
    ]);
    await flushPromises();
    const firstMessage = session.fileError.value;
    expect(firstMessage).not.toBe("");
    // 原来无论哪种违规都拼这一句，忽略 violation.code。
    expect(firstMessage).not.toContain(" exceeds ");
    expect([
      enUS.uploads.tooManyFiles(2, 1),
      enUS.uploads.totalSizeTooLarge(2, "15 B"),
      enUS.uploads.filesTooLarge("big.txt", "10 B"),
    ]).toContain(firstMessage);
  });

  it("asks for context with the upstream key instead of a hand-written sentence", async () => {
    const { session, references } = setup();
    references.value = [];
    mocks.findLatestSidecarThread.mockResolvedValue(null);

    await expect(session.ensureThread([])).rejects.toThrow(
      enUS.sidecar.noContext,
    );
    await expect(session.ensureThread([])).rejects.not.toThrow(
      "Select text before starting a side chat.",
    );
  });

  it("falls back to sidecar.sendFailed when the rejection is not an Error", async () => {
    const { session } = setup();
    // 非 Error 抛值走 errorMessage 的兜底那一支；原来兜底是写死的 "Request failed"。
    mocks.createSidecarThread.mockRejectedValue("boom");
    session.setInput("hello");

    expect(await session.submit()).toBe(false);
    await flushPromises();

    expect(session.errorMessage.value).toBe(enUS.sidecar.sendFailed);
    expect(session.errorMessage.value).not.toBe("Request failed");
  });
});
