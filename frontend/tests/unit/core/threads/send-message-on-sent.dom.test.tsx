import { afterEach, beforeEach, expect, rs, test } from "@rstest/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";

import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";
import type { ObservationPacket } from "@/core/diagnostics/parity-observation";
import { I18nContext } from "@/core/i18n/context";
import { enUS } from "@/core/i18n/locales/en-US";
import { DEFAULT_LOCAL_SETTINGS } from "@/core/settings/local";
import type { UploadResponse } from "@/core/uploads/api";
import { AttachmentUploadSession } from "@/core/uploads/attachment-upload-session";

// onSent tells callers they may drop one-time composer state (quotes,
// references, staged files, the stored draft). It must not fire for a send
// whose attachments never upload, or a retry goes out without that context.

const mocks = rs.hoisted(() => ({
  events: [] as string[],
  submit: rs.fn(async () => undefined),
  toastError: rs.fn(),
}));

rs.mock("sonner", () => ({ toast: { error: mocks.toastError } }));

rs.mock("@langchain/langgraph-sdk/react", () => ({
  useStream: () => ({
    isLoading: false,
    messages: [],
    stop: rs.fn(async () => undefined),
    submit: mocks.submit,
    values: { artifacts: [], messages: [], title: "", todos: [] },
  }),
}));

const UPLOAD_RESPONSE: UploadResponse = {
  success: true,
  files: [
    {
      filename: "report.pdf",
      size: 42,
      path: "/data/uploads/report.pdf",
      virtual_path: "/mnt/user-data/uploads/report.pdf",
      artifact_url: "/api/threads/thread-1/artifacts/report.pdf",
    },
  ],
  message: "ok",
  skipped_files: [],
};

const MESSAGE_WITH_FILE: PromptInputMessage = {
  text: "Compare these",
  files: [
    {
      type: "file",
      url: "blob:report",
      mediaType: "application/pdf",
      filename: "report.pdf",
      file: new File(["%PDF"], "report.pdf", { type: "application/pdf" }),
    },
  ],
};

function stubUploadFetch(upload: () => Promise<Response>) {
  rs.stubGlobal("fetch", async (input: unknown) => {
    const url = String(input);
    if (/\/api\/threads\/[^/]+\/uploads$/.test(url)) {
      mocks.events.push("upload");
      return upload();
    }
    if (/\/api\/threads\/[^/]+\/messages\/page/.test(url)) {
      return new Response(
        JSON.stringify({ data: [], has_more: false, next_before_seq: null }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    throw new Error(`Unexpected fetch: ${url}`);
  });
}

function createWrapper(queryClient: QueryClient) {
  return function SendMessageTestWrapper({
    children,
  }: {
    children: ReactNode;
  }) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(
        I18nContext.Provider,
        {
          value: { locale: "en-US", setLocale: () => undefined, t: enUS },
        },
        children,
      ),
    );
  };
}

async function flushFrames() {
  for (let index = 0; index < 6; index += 1) {
    await act(async () => undefined);
  }
}

async function renderThreadStream() {
  const { useThreadStream } = await import("@/core/threads/hooks");
  const rendered = renderHook(
    () =>
      useThreadStream({
        context: DEFAULT_LOCAL_SETTINGS.context,
        isMock: false,
        threadId: "thread-1",
      }),
    {
      wrapper: createWrapper(
        new QueryClient({ defaultOptions: { queries: { retry: false } } }),
      ),
    },
  );
  await flushFrames();
  return rendered;
}

beforeEach(() => {
  mocks.events = [];
  mocks.toastError.mockReset();
  mocks.submit.mockReset();
  mocks.submit.mockImplementation(async () => {
    mocks.events.push("submit");
  });
});

test("does not replace a file failure whose message matches a session diagnostic", async () => {
  stubUploadFetch(async () => new Response("{}"));
  const { result } = await renderThreadStream();
  const cause = new Error("Attachments are not ready");
  const attachmentUploads = new AttachmentUploadSession(async () => {
    throw cause;
  });
  const onSent = rs.fn();
  await act(async () => {
    await expect(
      result.current.sendMessage("thread-1", MESSAGE_WITH_FILE, undefined, {
        attachmentUploads,
        onSent,
      }),
    ).rejects.toMatchObject({ code: "failed", cause });
  });
  expect(mocks.toastError).toHaveBeenCalledWith(cause.message);
  expect(mocks.submit).not.toHaveBeenCalled();
  expect(onSent).not.toHaveBeenCalled();
});

test("localizes a session state error using its type", async () => {
  stubUploadFetch(async () => new Response("{}"));
  const { result } = await renderThreadStream();
  const attachmentUploads = new AttachmentUploadSession();
  attachmentUploads.deactivate();
  await act(async () => {
    await expect(
      result.current.sendMessage("thread-1", MESSAGE_WITH_FILE, undefined, {
        attachmentUploads,
      }),
    ).rejects.toMatchObject({ code: "inactive" });
  });
  expect(mocks.toastError).toHaveBeenCalledWith(enUS.uploads.notReady);
  expect(mocks.submit).not.toHaveBeenCalled();
});

afterEach(() => {
  rs.unstubAllGlobals();
});

test("does not report a send whose attachment upload fails", async () => {
  stubUploadFetch(
    async () =>
      new Response(JSON.stringify({ detail: "disk full" }), { status: 500 }),
  );
  const { result } = await renderThreadStream();
  const onSent = rs.fn();

  let sendError: unknown;
  await act(async () => {
    await result.current
      .sendMessage("thread-1", MESSAGE_WITH_FILE, undefined, { onSent })
      .catch((error: unknown) => {
        sendError = error;
      });
  });

  expect(sendError).toBeInstanceOf(Error);
  expect(mocks.events).toEqual(["upload"]);
  expect(onSent).not.toHaveBeenCalled();
});

test("reports the send after its attachments upload, right before the run is submitted", async () => {
  let finishUpload!: () => void;
  stubUploadFetch(
    () =>
      new Promise<Response>((resolve) => {
        finishUpload = () =>
          resolve(
            new Response(JSON.stringify(UPLOAD_RESPONSE), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          );
      }),
  );
  const { result } = await renderThreadStream();
  const onSent = rs.fn(() => {
    mocks.events.push("onSent");
  });

  let sendPromise: Promise<unknown> | undefined;
  act(() => {
    sendPromise = result.current.sendMessage(
      "thread-1",
      MESSAGE_WITH_FILE,
      undefined,
      { onSent },
    );
  });
  await flushFrames();
  expect(onSent).not.toHaveBeenCalled();

  finishUpload();
  await act(async () => {
    await sendPromise;
  });

  expect(mocks.events).toEqual(["upload", "onSent", "submit"]);
  expect(onSent).toHaveBeenCalledTimes(1);
});

test("reports a text-only send before the run is submitted", async () => {
  stubUploadFetch(async () => {
    throw new Error("no upload expected");
  });
  const { result } = await renderThreadStream();
  const onSent = rs.fn(() => {
    mocks.events.push("onSent");
  });

  await act(async () => {
    await result.current.sendMessage(
      "thread-1",
      { text: "Hello", files: [] },
      undefined,
      { onSent },
    );
  });

  expect(mocks.events).toEqual(["onSent", "submit"]);
});

test("observes the actual new human producer without claiming additional input identities", async () => {
  const capability = "__deerflow_parity_capture_v1__";
  const eventName = "deerflow:parity-identity:v1";
  const packets: ObservationPacket[] = [];
  const receive = (event: Event) =>
    packets.push((event as CustomEvent<(typeof packets)[number]>).detail);
  Object.defineProperty(window, capability, {
    configurable: true,
    value: { version: 1, token: "human-capture", action: "send:0" },
  });
  window.addEventListener(eventName, receive);
  stubUploadFetch(async () => {
    throw new Error("no upload expected");
  });
  const view = await renderThreadStream();
  try {
    await act(async () => {
      await view.result.current.sendMessage(
        "thread-1",
        { text: "Hello", files: [] },
        undefined,
        {
          additionalInputMessages: [
            {
              type: "human",
              id: "historical-context",
              content: "Additional context",
            },
          ],
        },
      );
    });
    expect(packets).toHaveLength(3);
    expect(packets[2]).toMatchObject({
      event: "run.bind",
      instance: packets[0]!.instance,
      values: { thread: "thread-1", assistant: "lead_agent" },
    });
    expect(packets[0]).toMatchObject({
      event: "human.allocate",
      values: {
        thread: "thread-1",
        raw: expect.stringMatching(/^local-human-/),
      },
    });
    expect(mocks.submit).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            id: packets[0]?.values.raw,
            type: "human",
          }),
          expect.objectContaining({ id: "historical-context", type: "human" }),
        ]),
      }),
      expect.objectContaining({ threadId: "thread-1" }),
    );
    expect(packets[1]).toMatchObject({
      event: "human.submission",
      values: {
        raw: packets[0]!.values.raw,
        thread: "thread-1",
        index: 1,
        messageCount: 2,
        keySource: "none",
        key: null,
      },
    });
    expect(packets[1]).toMatchObject({
      instance: packets[0]!.instance,
    });
  } finally {
    view.unmount();
    window.removeEventListener(eventName, receive);
    Reflect.deleteProperty(window, capability);
  }
});

test("a failed upload retains human allocation evidence without pretending a run was submitted", async () => {
  const capability = "__deerflow_parity_capture_v1__";
  const eventName = "deerflow:parity-identity:v1";
  const packets: { event: string; values: Record<string, unknown> }[] = [];
  const receive = (event: Event) =>
    packets.push((event as CustomEvent<(typeof packets)[number]>).detail);
  Object.defineProperty(window, capability, {
    configurable: true,
    value: { version: 1, token: "human-failed", action: "send:0" },
  });
  window.addEventListener(eventName, receive);
  stubUploadFetch(
    async () =>
      new Response(JSON.stringify({ detail: "disk full" }), { status: 500 }),
  );
  const view = await renderThreadStream();
  try {
    await act(async () => {
      await expect(
        view.result.current.sendMessage("thread-1", MESSAGE_WITH_FILE),
      ).rejects.toThrow();
    });
    expect(packets.map((packet) => packet.event)).toEqual(["human.allocate"]);
    expect(mocks.submit).not.toHaveBeenCalled();
  } finally {
    view.unmount();
    window.removeEventListener(eventName, receive);
    Reflect.deleteProperty(window, capability);
  }
});

test.each(["same-capture", "replacement", "enabled-late"])(
  "preserves the original send source across an awaited upload: %s",
  async (mode) => {
    const capability = "__deerflow_parity_capture_v1__";
    const eventName = "deerflow:parity-identity:v1";
    const packets: ObservationPacket[] = [];
    const receive = (event: Event) =>
      packets.push((event as CustomEvent<ObservationPacket>).detail);
    const scope = { version: 1, token: "send-origin", action: "send:0" };
    if (mode !== "enabled-late")
      Object.defineProperty(window, capability, {
        configurable: true,
        value: scope,
      });
    window.addEventListener(eventName, receive);
    let resolveUpload!: (response: Response) => void;
    stubUploadFetch(
      () =>
        new Promise((resolve) => {
          resolveUpload = resolve;
        }),
    );
    const view = await renderThreadStream();
    try {
      let pending!: Promise<unknown>;
      act(() => {
        pending = view.result.current.sendMessage(
          "thread-1",
          MESSAGE_WITH_FILE,
        );
      });
      await flushFrames();
      expect(mocks.submit).not.toHaveBeenCalled();
      scope.action = "later-step";
      if (mode !== "same-capture")
        Object.defineProperty(window, capability, {
          configurable: true,
          value: { ...scope, token: "replacement" },
        });
      resolveUpload(Response.json(UPLOAD_RESPONSE));
      await act(async () => {
        await pending;
      });
      expect(mocks.submit).toHaveBeenCalledTimes(1);
      expect(mocks.events).toEqual(["upload", "submit"]);
      if (mode === "same-capture") {
        expect(packets.map((packet) => packet.event)).toEqual([
          "human.allocate",
          "human.submission",
          "run.bind",
        ]);
        expect(packets[2]).toMatchObject({
          action: "later-step",
          values: { sourceAction: "send:0" },
        });
        expect(packets[1]).toMatchObject({
          action: "send:0",
          at: packets[0]!.at,
          instance: packets[0]!.instance,
        });
      } else
        expect(packets.map((packet) => packet.event)).toEqual(
          mode === "enabled-late" ? [] : ["human.allocate"],
        );
    } finally {
      view.unmount();
      window.removeEventListener(eventName, receive);
      Reflect.deleteProperty(window, capability);
    }
  },
);

test.each(["onSent", "messages", "context", "transport"])(
  "preserves %s errors and distinguishes submission attempts from acceptance",
  async (failure) => {
    const capability = "__deerflow_parity_capture_v1__";
    const eventName = "deerflow:parity-identity:v1";
    const packets: ObservationPacket[] = [];
    const receive = (event: Event) =>
      packets.push((event as CustomEvent<ObservationPacket>).detail);
    Object.defineProperty(window, capability, {
      configurable: true,
      value: { version: 1, token: "send-failure", action: "send:0" },
    });
    window.addEventListener(eventName, receive);
    stubUploadFetch(async () => {
      throw new Error("unexpected upload");
    });
    const view = await renderThreadStream();
    const cause = new Error(failure);
    if (failure === "transport") mocks.submit.mockRejectedValueOnce(cause);
    let caught: unknown;
    try {
      await act(async () => {
        await view.result.current
          .sendMessage(
            "thread-1",
            { text: "Hello", files: [] },
            {
              get detail() {
                if (failure === "context") throw cause;
                return "kept";
              },
            },
            {
              onSent() {
                if (failure === "onSent") throw cause;
              },
              get additionalInputMessages() {
                if (failure === "messages") throw cause;
                return [];
              },
            },
          )
          .catch((error: unknown) => {
            caught = error;
          });
      });
      expect(caught).toBe(cause);
      expect(packets.map((packet) => packet.event)).toEqual(
        failure === "transport"
          ? ["human.allocate", "human.submission", "run.bind"]
          : ["human.allocate"],
      );
      expect(mocks.submit).toHaveBeenCalledTimes(
        failure === "transport" ? 1 : 0,
      );
    } finally {
      view.unmount();
      window.removeEventListener(eventName, receive);
      Reflect.deleteProperty(window, capability);
    }
  },
);
