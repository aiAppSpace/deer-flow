/** Conversation commands own their pending work, snapshots and cancellation.
 * This adapter delegates all run/session changes to the existing stream and thread owner.
 */
import {
  computed,
  onMounted,
  onScopeDispose,
  ref,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from "vue";
import type { useThreadStream } from "@/composables/useThreadStream";
import type { useChatThreadOwner } from "@/composables/useChatThreadOwner";
import type { useSidecar } from "@/composables/useSidecar";
import type { useThreads } from "@/composables/useThreads";
import type { Translations } from "@/core/i18n";
import type { WorkspaceToastStore } from "@/core/workspace-shell/toast";
import {
  KNOWLEDGE_SCOPE_KEY,
  type KnowledgeScopeSnapshot,
} from "@/core/knowledge";
import {
  buildReferenceMessageMetadata,
  type SidecarContext,
} from "@/core/sidecar";
import {
  buildHumanInputResponseText,
  type HumanInputRequest,
  type HumanInputResponse,
} from "@/core/messages/human-input";
import { textOfMessage, type FileInMessage } from "@/core/messages/utils";
import type { Message } from "@/core/types/message";
import type {
  ComposerHostSnapshot,
  ComposerSubmitOptions,
} from "@/core/threads/composer-submit";
import { branchThreadFromTurn } from "@/core/threads/api";
import {
  DEFAULT_MAX_SUGGESTIONS,
  type SuggestionsConfigResponse,
} from "@/core/suggestions/api";
import { fetch as fetchWithAuth } from "@/core/api/fetcher";
import { getBackendBaseURL } from "@/core/config";
import { createAsyncGeneration } from "@/core/async/generation";
import type { NewChatFocusHandoff } from "@/core/threads/new-chat";

export interface ChatConversationActionsOptions {
  threadId: MaybeRefOrGetter<string | null>;
  threadTitle: MaybeRefOrGetter<string | null | undefined>;
  agentName: MaybeRefOrGetter<string | null | undefined>;
  userId: MaybeRefOrGetter<string | null>;
  readonly: MaybeRefOrGetter<boolean>;
  bootstrap: MaybeRefOrGetter<boolean | undefined>;
  startedThreadId: MaybeRefOrGetter<string | null>;
  context: MaybeRefOrGetter<Record<string, unknown>>;
  messages: MaybeRefOrGetter<readonly Message[]>;
  knowledgeScope: MaybeRefOrGetter<KnowledgeScopeSnapshot | null>;
  copy: MaybeRefOrGetter<Translations>;
  submissionOwner: Pick<
    ReturnType<typeof useChatThreadOwner>,
    "capture" | "owns" | "assertCurrent" | "ensureThread" | "reset"
  >;
  stream: Pick<
    ReturnType<typeof useThreadStream>,
    | "sendMessage"
    | "regenerateMessage"
    | "editAndRegenerateMessage"
    | "stop"
    | "resetView"
  >;
  sidecar: Pick<
    ReturnType<typeof useSidecar>,
    "conversationQuotes" | "clearConversationQuotes"
  >;
  threads: Pick<ReturnType<typeof useThreads>, "upsertCreated">;
  suggestions: {
    data: MaybeRefOrGetter<SuggestionsConfigResponse | undefined>;
    refetch: (options?: {
      cancelRefetch?: boolean;
    }) => Promise<{ data: SuggestionsConfigResponse | undefined }>;
  };
  usage: { refetch: () => Promise<unknown> };
  toast: Pick<WorkspaceToastStore, "error" | "success">;
  navigate: (path: string) => unknown | Promise<unknown>;
  focusComposer?: () => void;
  resetComposer?: () => void;
}

export function useChatConversationActions(
  options: ChatConversationActionsOptions,
) {
  const routeThreadId = computed(() => toValue(options.threadId));
  const isDemo = computed(() => toValue(options.readonly));
  const context = computed(() => toValue(options.context));
  const visibleMessages = computed(() => toValue(options.messages));
  const currentKnowledgeScopeSnapshot = computed(() =>
    toValue(options.knowledgeScope),
  );
  const { submissionOwner, stream, sidecar, threads, toast } = options;
  const suggestionsConfigQuery = options.suggestions;
  const threadTokenUsageQuery = options.usage;
  const followups = ref<string[]>([]);
  const followupsLoading = ref(false);
  const mainTailRequest = ref(0);
  const maxSuggestions = computed(
    () =>
      toValue(suggestionsConfigQuery.data)?.max_suggestions ??
      DEFAULT_MAX_SUGGESTIONS,
  );
  const suggestionGeneration = createAsyncGeneration();
  let suggestionController: AbortController | null = null;
  const branchPending = ref(false);
  let activeBranch: object | null = null;
  let disposed = false;
  function cancelSuggestions(clear = true) {
    suggestionGeneration.invalidate();
    suggestionController?.abort();
    suggestionController = null;
    followupsLoading.value = false;
    if (clear) followups.value = [];
  }
  function quotePrompt(contexts: SidecarContext[]): Message {
    const blocks = contexts.flatMap((item, index) => [
      `<referenced_message index="${index + 1}" label="${item.label.replaceAll('"', "&quot;")}">`,
      `Role: ${item.role === "user" ? "User" : "Assistant"}`,
      item.messageId ? `Message ID: ${item.messageId}` : "",
      "",
      item.content,
      "</referenced_message>",
      "",
    ]);
    return {
      type: "human",
      content: [
        {
          type: "text",
          text: [
            contexts.length === 1
              ? "The user added the following quoted context to this conversation."
              : `The user added the following ${contexts.length} quoted contexts to this conversation.`,
            "Use the referenced_message blocks as reference material for the user's next message.",
            "",
            ...blocks,
          ].join("\n"),
        },
      ],
      additional_kwargs: {
        hide_from_ui: true,
        conversation_quote_context: true,
        referenced_message_ids: contexts.map((item) => item.messageId ?? ""),
        referenced_message_roles: contexts.map((item) => item.role),
        quote_context_count: contexts.length,
      },
    } as Message;
  }

  function recentConversation(
    messages: readonly Message[] = visibleMessages.value,
  ) {
    return messages
      .filter((message) => message.type === "human" || message.type === "ai")
      .map((message) => ({
        role: message.type === "human" ? "user" : "assistant",
        content: textOfMessage(message),
      }))
      .filter((message) => message.content.trim())
      .slice(-6);
  }

  async function refreshPostRun(
    targetThreadId: string | null,
    completedMessages: readonly Message[],
  ) {
    if (toValue(options.bootstrap) || !targetThreadId) return;
    const owner = submissionOwner.capture();
    const modelName = context.value.model_name;
    // The just-completed run is the authoritative suggestion input. Capture it
    // before metadata/token refreshes can re-read an eventually-consistent
    // thread snapshot and temporarily replace the visible history.
    const messages = recentConversation(completedMessages);
    const scope = `${targetThreadId}\u0000${toValue(options.agentName) ?? "lead-agent"}`;
    const token = suggestionGeneration.begin(scope);
    suggestionController?.abort();
    const controller = new AbortController();
    suggestionController = controller;

    if (
      controller.signal.aborted ||
      !submissionOwner.owns(owner) ||
      (routeThreadId.value ?? toValue(options.startedThreadId)) !==
        targetThreadId ||
      !suggestionGeneration.isCurrent(token, scope)
    ) {
      return;
    }
    await threadTokenUsageQuery.refetch();
    const config =
      toValue(suggestionsConfigQuery.data) ??
      (await suggestionsConfigQuery.refetch({ cancelRefetch: false })).data;
    if (
      controller.signal.aborted ||
      !submissionOwner.owns(owner) ||
      !suggestionGeneration.isCurrent(token, scope) ||
      !config?.enabled
    ) {
      return;
    }
    if (messages.length === 0) return;
    followupsLoading.value = true;
    followups.value = [];
    try {
      const response = await fetchWithAuth(
        `${getBackendBaseURL()}/api/threads/${encodeURIComponent(targetThreadId)}/suggestions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages,
            n: maxSuggestions.value,
            model_name: modelName,
          }),
          signal: controller.signal,
        },
      );
      if (!response.ok) return;
      const body = (await response.json()) as { suggestions?: unknown[] };
      if (
        controller.signal.aborted ||
        !submissionOwner.owns(owner) ||
        (routeThreadId.value ?? toValue(options.startedThreadId)) !==
          targetThreadId ||
        !suggestionGeneration.isCurrent(token, scope)
      ) {
        return;
      }
      followups.value = (body.suggestions ?? [])
        .flatMap((value) =>
          typeof value === "string" && value.trim() ? [value.trim()] : [],
        )
        .slice(0, maxSuggestions.value);
    } catch {
      if (
        !controller.signal.aborted &&
        submissionOwner.owns(owner) &&
        suggestionGeneration.isCurrent(token, scope)
      ) {
        followups.value = [];
      }
    } finally {
      if (
        submissionOwner.owns(owner) &&
        suggestionGeneration.isCurrent(token, scope)
      ) {
        followupsLoading.value = false;
      }
      if (suggestionController === controller) suggestionController = null;
    }
  }

  watch(
    [
      routeThreadId,
      () => toValue(options.agentName),
      () => toValue(options.userId),
    ],
    (
      [nextThreadId, nextAgentName, nextUserId],
      [previousThreadId, previousAgentName, previousUserId],
    ) => {
      // `new` adopts the same thread id produced by onStart. That URL update is
      // not a conversation switch and must not abort the post-run suggestion
      // request already owned by that thread.
      const adoptingStartedThread =
        previousThreadId === null &&
        nextThreadId === toValue(options.startedThreadId) &&
        nextAgentName === previousAgentName &&
        nextUserId === previousUserId;
      if (adoptingStartedThread) return;

      cancelSuggestions();
      activeBranch = null;
      branchPending.value = false;
    },
    { flush: "sync" },
  );

  async function ensureThread() {
    if (isDemo.value)
      throw new Error(toValue(options.copy).common.notAvailableInDemoMode);
    return submissionOwner.ensureThread();
  }

  function captureComposerSubmission(): ComposerHostSnapshot {
    const owner = submissionOwner.capture();
    const quotes = [...sidecar.conversationQuotes.value];
    const contexts = quotes.map((quote) => quote.context);
    const knowledgeSnapshot = currentKnowledgeScopeSnapshot.value;
    return {
      ...JSON.parse(
        JSON.stringify({
          ...(contexts.length
            ? { additionalInputMessages: [quotePrompt(contexts)] }
            : {}),
          additionalKwargs: {
            ...(contexts.length ? buildReferenceMessageMetadata(contexts) : {}),
            ...(knowledgeSnapshot
              ? { [KNOWLEDGE_SCOPE_KEY]: knowledgeSnapshot }
              : {}),
          },
        }),
      ),
      onAccepted: () => {
        if (submissionOwner.owns(owner))
          sidecar.clearConversationQuotes(quotes);
      },
    };
  }

  async function send(
    text: string,
    files: FileInMessage[],
    submitOptions?: Partial<ComposerSubmitOptions> & {
      signal?: AbortSignal;
      reportFailure?: boolean;
    },
  ) {
    if (isDemo.value) return false;
    const owner = submissionOwner.capture();
    const hostSnapshot =
      submitOptions?.hostSnapshot ?? captureComposerSubmission();
    const submittedOptions = {
      ...submitOptions,
      additionalKwargs: {
        ...submitOptions?.additionalKwargs,
        ...hostSnapshot.additionalKwargs,
      },
    };

    cancelSuggestions();
    mainTailRequest.value += 1;
    try {
      const targetThreadId = await submissionOwner.ensureThread(owner);
      submissionOwner.assertCurrent(owner);
      const accepted = await stream.sendMessage(
        targetThreadId,
        { text, files },
        undefined,
        {
          additionalInputMessages: hostSnapshot.additionalInputMessages,
          humanMessageId: submittedOptions.humanMessageId,
          additionalKwargs: submittedOptions.additionalKwargs,
          conversationReferences: submittedOptions.conversationReferences,
          signal: submittedOptions.signal,
          runSnapshot: submittedOptions.runSnapshot,
          onAccepted: () => {
            if (!submissionOwner.owns(owner)) return;
            hostSnapshot.onAccepted?.();
            submittedOptions.onAccepted?.();
          },
        },
      );
      if (!accepted || !submissionOwner.owns(owner)) return false;
      return true;
    } catch (error) {
      if (submitOptions) throw error;
      if (submissionOwner.owns(owner)) {
        toast.error(
          error instanceof Error
            ? error.message
            : toValue(options.copy).common.requestFailed,
        );
      }
      return false;
    }
  }
  async function respondHumanInput(
    request: HumanInputRequest,
    response: HumanInputResponse,
  ) {
    if (isDemo.value) return false;
    const targetThreadId = routeThreadId.value;
    if (!targetThreadId) return false;
    let accepted = false;
    const dispatched = await stream.sendMessage(
      targetThreadId,
      { text: buildHumanInputResponseText(request, response) },
      undefined,
      {
        additionalKwargs: {
          hide_from_ui: true,
          human_input_response: response,
          ...(currentKnowledgeScopeSnapshot.value
            ? { [KNOWLEDGE_SCOPE_KEY]: currentKnowledgeScopeSnapshot.value }
            : {}),
        },
        onAccepted: () => {
          accepted = true;
        },
      },
    );
    return dispatched && accepted;
  }

  async function stopRun() {
    cancelSuggestions(false);
    await stream.stop();
  }

  async function branch(messageId: string, messageIds: string[]) {
    if (isDemo.value || branchPending.value || !routeThreadId.value) return;
    const owner = submissionOwner.capture();
    const operation = {};
    activeBranch = operation;
    const title = toValue(options.threadTitle) ?? undefined;
    let result: Awaited<ReturnType<typeof branchThreadFromTurn>>;
    branchPending.value = true;
    try {
      result = await branchThreadFromTurn(owner.threadId, {
        messageId,
        messageIds,
        title,
      });
    } catch (error) {
      if (!disposed && submissionOwner.owns(owner))
        toast.error(
          error instanceof Error
            ? error.message
            : toValue(options.copy).conversation.branchFailed,
        );
      return;
    } finally {
      // A retired branch cannot clear a newer owner's pending indicator.
      if (activeBranch === operation) {
        activeBranch = null;
        branchPending.value = false;
      }
    }
    if (disposed || !submissionOwner.owns(owner)) return;
    threads.upsertCreated(
      result.thread_id,
      title ?? toValue(options.copy).pages.untitled,
      owner.agentName,
    );
    toast.success(toValue(options.copy).conversation.branchCreated);
    const path = owner.agentName
      ? `/workspace/agents/${encodeURIComponent(owner.agentName)}/chats/${result.thread_id}`
      : `/workspace/chats/${result.thread_id}`;
    await options.navigate(path);
  }
  async function regenerate(messageId: string, messageIds: string[]) {
    if (isDemo.value) return;
    if (routeThreadId.value) {
      await stream.regenerateMessage(
        routeThreadId.value,
        messageId,
        messageIds,
      );
    }
  }
  async function editAndRegenerateMessage(
    messageId: string,
    replacementText: string,
    messageIds: string[],
  ): Promise<boolean> {
    if (isDemo.value || !routeThreadId.value) return false;
    const owner = submissionOwner.capture();
    const knowledgeScope = currentKnowledgeScopeSnapshot.value;
    const additionalKwargs = knowledgeScope
      ? { [KNOWLEDGE_SCOPE_KEY]: JSON.parse(JSON.stringify(knowledgeScope)) }
      : undefined;
    const accepted = await stream.editAndRegenerateMessage(
      owner.threadId,
      messageId,
      replacementText,
      messageIds,
      additionalKwargs,
    );
    return accepted && submissionOwner.owns(owner);
  }
  function resetNewChat() {
    cancelSuggestions();
    activeBranch = null;
    branchPending.value = false;
    stream.resetView();
    submissionOwner.reset();
  }
  function handleNewChat(event: Event) {
    const handoff = (event as CustomEvent<NewChatFocusHandoff | undefined>)
      .detail;
    // Only the interactive main/Agent conversation at the committed new route
    // may claim deletion completion. Sidecars do not use this command owner.
    if (
      handoff &&
      (isDemo.value ||
        toValue(options.bootstrap) ||
        routeThreadId.value !== null ||
        (toValue(options.agentName) ?? null) !== handoff.agentName)
    )
      return;
    resetNewChat();
    if (!handoff) return;
    sidecar.clearConversationQuotes();
    options.resetComposer?.();
    const owner = submissionOwner.capture();
    let consumed = false;
    handoff.claim(() => {
      if (consumed) return;
      consumed = true;
      if (
        !disposed &&
        submissionOwner.owns(owner) &&
        !isDemo.value &&
        !toValue(options.bootstrap)
      )
        options.focusComposer?.();
    });
  }
  onMounted(() =>
    globalThis.addEventListener("deerflow:new-chat", handleNewChat),
  );

  onScopeDispose(() => {
    disposed = true;
    activeBranch = null;
    branchPending.value = false;
    globalThis.removeEventListener("deerflow:new-chat", handleNewChat);
    cancelSuggestions();
  });
  return {
    followups,
    followupsLoading,
    mainTailRequest,
    branchPending,
    refreshPostRun,
    ensureThread,
    captureComposerSubmission,
    send,
    respondHumanInput,
    stopRun,
    branch,
    regenerate,
    editAndRegenerateMessage,
    resetNewChat,
  };
}
