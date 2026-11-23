import { mount } from "@vue/test-utils";
import { defineComponent, h, nextTick, ref } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  useChatConversationActions,
  type ChatConversationActionsOptions,
} from "@/composables/useChatConversationActions";
import type { ChatSubmissionOwner } from "@/composables/useChatThreadOwner";
import type { SidecarReference } from "@/composables/useSidecar";
import {
  KNOWLEDGE_SCOPE_KEY,
  type KnowledgeScopeSnapshot,
} from "@/core/knowledge";
import { enUS } from "@/core/i18n/locales/en-US";
import type { Message } from "@/core/types/message";

const api = vi.hoisted(() => ({ branch: vi.fn(), fetch: vi.fn() }));
vi.mock("@/core/threads/api", () => ({ branchThreadFromTurn: api.branch }));
vi.mock("@/core/api/fetcher", () => ({ fetch: api.fetch }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
}
const wrappers: ReturnType<typeof mount>[] = [];
function harness() {
  const threadId = ref<string | null>("thread-a");
  const startedThreadId = ref<string | null>(null);
  const userId = ref<string | null>("alice");
  const agentName = ref<string | null>(null);
  const bootstrap = ref(false);
  const readonly = ref(false);
  const revision = ref(0);
  const knowledgeScope = ref<KnowledgeScopeSnapshot | null>({
    version: 1,
    mode: "selected",
    dataset_ids: ["alpha"],
  });
  const messages = ref<Message[]>([{ type: "ai", content: "Completed" }]);
  const capture = (): ChatSubmissionOwner => ({
    revision: revision.value,
    threadId: threadId.value ?? "draft-a",
    userId: userId.value,
    agentName: agentName.value,
    projectId: null,
  });
  const owns = (owner: ChatSubmissionOwner) =>
    owner.revision === revision.value && owner.userId === userId.value;
  const owner = {
    draftThreadId: ref("draft-a"),
    preparedThreadId: ref<string | null>(null),
    capture,
    owns,
    assertCurrent: (snapshot: ChatSubmissionOwner) => {
      if (!owns(snapshot)) throw new DOMException("Changed", "AbortError");
    },
    ensureThread: vi.fn(async () => threadId.value ?? "draft-a"),
    reset: vi.fn(() => {
      revision.value++;
    }),
  };
  const sidecar = {
    conversationQuotes: ref<SidecarReference[]>([]),
    clearConversationQuotes: vi.fn((accepted?: readonly SidecarReference[]) => {
      const ids = new Set(accepted?.map((item) => item.id));
      sidecar.conversationQuotes.value =
        sidecar.conversationQuotes.value.filter((item) => !ids.has(item.id));
    }),
  };
  const stream = {
    sendMessage: vi.fn<ChatConversationActionsOptions["stream"]["sendMessage"]>(
      async () => true,
    ),
    regenerateMessage:
      vi.fn<ChatConversationActionsOptions["stream"]["regenerateMessage"]>(),
    editAndRegenerateMessage: vi.fn<
      ChatConversationActionsOptions["stream"]["editAndRegenerateMessage"]
    >(async () => true),
    stop: vi.fn(async () => {}),
    resetView: vi.fn(),
  };
  const threads = { upsertCreated: vi.fn() };
  const navigate = vi.fn(async () => {});
  const toast = { error: vi.fn(() => 0), success: vi.fn(() => 0) };
  const usage = { refetch: vi.fn(async () => undefined) };
  const config = ref({ enabled: true, max_suggestions: 3 });
  const suggestions = {
    data: config,
    refetch: vi.fn(async () => ({ data: config.value })),
  };
  let actions!: ReturnType<typeof useChatConversationActions>;
  const wrapper = mount(
    defineComponent({
      setup() {
        actions = useChatConversationActions({
          threadId,
          threadTitle: ref("Current chat"),
          startedThreadId,
          userId,
          agentName,
          readonly,
          bootstrap,
          context: ref({ model_name: "model-a" }),
          messages,
          knowledgeScope,
          copy: ref(enUS),
          submissionOwner: owner,
          stream,
          sidecar,
          threads,
          suggestions,
          usage,
          toast,
          navigate,
        });
        return () => h("div");
      },
    }),
  );
  wrappers.push(wrapper);
  return {
    actions,
    wrapper,
    threadId,
    startedThreadId,
    userId,
    agentName,
    bootstrap,
    readonly,
    revision,
    knowledgeScope,
    messages,
    owner,
    sidecar,
    stream,
    threads,
    navigate,
    toast,
    usage,
    config,
  };
}
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  vi.resetAllMocks();
});

describe("conversation command ownership", () => {
  it("captures quote/knowledge before preparation and retires only accepted quote identities", async () => {
    const subject = harness();
    subject.sidecar.conversationQuotes.value = [
      {
        id: 1,
        context: {
          type: "referenced_message",
          role: "assistant",
          label: "First",
          content: "Quoted",
          messageId: "m1",
        },
      },
    ];
    const snapshot = subject.actions.captureComposerSubmission();
    subject.knowledgeScope.value!.dataset_ids![0] = "changed";
    subject.sidecar.conversationQuotes.value.push({
      id: 2,
      context: {
        type: "referenced_message",
        role: "user",
        label: "Second",
        content: "New",
      },
    });
    expect(snapshot.additionalKwargs?.[KNOWLEDGE_SCOPE_KEY]).toMatchObject({
      dataset_ids: ["alpha"],
    });
    expect(
      snapshot.additionalInputMessages?.[0]?.additional_kwargs,
    ).toMatchObject({ hide_from_ui: true, quote_context_count: 1 });
    snapshot.onAccepted?.();
    expect(
      subject.sidecar.conversationQuotes.value.map((item) => item.id),
    ).toEqual([2]);
  });

  it("rejects an old owner after asynchronous preparation without sending or notifying the next account", async () => {
    const subject = harness();
    const prepared = deferred<string>();
    subject.owner.ensureThread.mockImplementationOnce(() => prepared.promise);
    const pending = subject.actions.send("Question", []);
    subject.userId.value = "bob";
    prepared.resolve("thread-a");
    expect(await pending).toBe(false);
    expect(subject.stream.sendMessage).not.toHaveBeenCalled();
    expect(subject.toast.error).not.toHaveBeenCalled();
  });

  it("preserves wire IDs, additional grants and the single stream submission entry", async () => {
    const subject = harness();
    await subject.actions.send("Question", [], {
      humanMessageId: "human-a",
      conversationReferences: ["reference-a"],
      additionalKwargs: { explicit: true },
    });
    expect(subject.stream.sendMessage).toHaveBeenCalledOnce();
    expect(subject.stream.sendMessage.mock.calls[0]).toMatchObject([
      "thread-a",
      { text: "Question", files: [] },
      undefined,
      {
        humanMessageId: "human-a",
        conversationReferences: ["reference-a"],
        additionalKwargs: {
          explicit: true,
          [KNOWLEDGE_SCOPE_KEY]: { dataset_ids: ["alpha"] },
        },
      },
    ]);
    expect(subject.actions.mainTailRequest.value).toBe(1);
  });

  it("keeps branch pending through the request and clears it before navigation", async () => {
    const subject = harness();
    const result = deferred<{ thread_id: string }>();
    api.branch.mockReturnValue(result.promise);
    subject.navigate.mockImplementation(async () => {
      expect(subject.actions.branchPending.value).toBe(false);
      expect(subject.toast.success).toHaveBeenCalledExactlyOnceWith(
        enUS.conversation.branchCreated,
      );
    });
    const pending = subject.actions.branch("message-a", ["message-a"]);
    expect(subject.actions.branchPending.value).toBe(true);
    result.resolve({ thread_id: "branched" });
    await pending;
    expect(subject.threads.upsertCreated).toHaveBeenCalledExactlyOnceWith(
      "branched",
      "Current chat",
      null,
    );
    expect(api.branch).toHaveBeenCalledWith(
      "thread-a",
      expect.objectContaining({ title: "Current chat" }),
    );
    expect(subject.navigate).toHaveBeenCalledExactlyOnceWith(
      "/workspace/chats/branched",
    );
  });

  it("admits only one branch while its owner is pending", async () => {
    const subject = harness();
    const result = deferred<{ thread_id: string }>();
    api.branch.mockReturnValue(result.promise);
    const pending = subject.actions.branch("message-a", ["message-a"]);
    const duplicate = subject.actions.branch("message-a", ["message-a"]);
    expect(api.branch).toHaveBeenCalledOnce();
    result.resolve({ thread_id: "branched" });
    await Promise.all([pending, duplicate]);
  });

  it("clears branch pending and preserves the visible failure on rejection", async () => {
    const subject = harness();
    api.branch.mockRejectedValue(new Error("Branch unavailable"));
    await subject.actions.branch("message-a", ["message-a"]);
    expect(subject.actions.branchPending.value).toBe(false);
    expect(subject.toast.error).toHaveBeenCalledExactlyOnceWith(
      "Branch unavailable",
    );
    expect(subject.navigate).not.toHaveBeenCalled();
  });

  it("announces the localized branch failure when transport throws no message", async () => {
    const subject = harness();
    api.branch.mockRejectedValue({ status: 503 });
    await subject.actions.branch("message-a", ["message-a"]);
    expect(subject.actions.branchPending.value).toBe(false);
    expect(subject.toast.error).toHaveBeenCalledExactlyOnceWith(
      enUS.conversation.branchFailed,
    );
    expect(subject.navigate).not.toHaveBeenCalled();
    expect(subject.toast.success).not.toHaveBeenCalled();
  });

  it("retires branch results across owner changes without upserting or navigating", async () => {
    const subject = harness();
    const result = deferred<{ thread_id: string }>();
    api.branch.mockReturnValue(result.promise);
    const pending = subject.actions.branch("message-a", ["message-a"]);
    subject.userId.value = "bob";
    expect(subject.actions.branchPending.value).toBe(false);
    await nextTick();
    result.resolve({ thread_id: "branched" });
    await pending;
    expect(subject.threads.upsertCreated).not.toHaveBeenCalled();
    expect(subject.navigate).not.toHaveBeenCalled();
    expect(subject.toast.success).not.toHaveBeenCalled();
  });

  it("aborts suggestion work when the account changes", async () => {
    const subject = harness();
    const response = deferred<Response>();
    api.fetch.mockReturnValue(response.promise);
    const pending = subject.actions.refreshPostRun(
      "thread-a",
      subject.messages.value,
    );
    await nextTick();
    const signal = api.fetch.mock.calls[0]?.[1]?.signal as AbortSignal;
    expect(signal.aborted).toBe(false);
    subject.userId.value = "bob";
    expect(signal.aborted).toBe(true);
    response.resolve(Response.json({ suggestions: ["Old account"] }));
    await pending;
    expect(subject.actions.followups.value).toEqual([]);
    expect(subject.actions.followupsLoading.value).toBe(false);
  });

  it("retains pending suggestions during exact new-thread URL adoption", async () => {
    const subject = harness();
    subject.threadId.value = null;
    await nextTick();
    subject.startedThreadId.value = "draft-a";
    const response = deferred<Response>();
    api.fetch.mockReturnValue(response.promise);
    const pending = subject.actions.refreshPostRun(
      "draft-a",
      subject.messages.value,
    );
    await nextTick();
    const signal = api.fetch.mock.calls[0]?.[1]?.signal as AbortSignal;
    subject.threadId.value = "draft-a";
    await nextTick();
    expect(signal.aborted).toBe(false);
    response.resolve(Response.json({ suggestions: ["Follow up"] }));
    await pending;
    expect(subject.actions.followups.value).toEqual(["Follow up"]);
  });

  it("clears the loading chip and retires old suggestions before sending a new message", async () => {
    const subject = harness();
    const response = deferred<Response>();
    api.fetch.mockReturnValue(response.promise);
    const pending = subject.actions.refreshPostRun(
      "thread-a",
      subject.messages.value,
    );
    await nextTick();
    const signal = api.fetch.mock.calls[0]?.[1]?.signal as AbortSignal;
    expect(subject.actions.followupsLoading.value).toBe(true);
    await subject.actions.send("Next question", []);
    expect(signal.aborted).toBe(true);
    expect(subject.actions.followupsLoading.value).toBe(false);
    response.resolve(Response.json({ suggestions: ["Old suggestion"] }));
    await pending;
    expect(subject.actions.followups.value).toEqual([]);
  });

  it("keeps bootstrap outside suggestion work and delegates explicit stop/reset", async () => {
    const subject = harness();
    subject.bootstrap.value = true;
    await subject.actions.refreshPostRun("thread-a", subject.messages.value);
    expect(subject.usage.refetch).not.toHaveBeenCalled();
    expect(api.fetch).not.toHaveBeenCalled();
    await subject.actions.stopRun();
    expect(subject.stream.stop).toHaveBeenCalledOnce();
    globalThis.dispatchEvent(new Event("deerflow:new-chat"));
    expect(subject.stream.resetView).toHaveBeenCalledOnce();
    expect(subject.owner.reset).toHaveBeenCalledOnce();
    subject.wrapper.unmount();
    globalThis.dispatchEvent(new Event("deerflow:new-chat"));
    expect(subject.stream.resetView).toHaveBeenCalledOnce();
  });
});
