/** Actual AgentChat consumer; only unrelated owners/transport/heavy child views are stubbed. */
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { mount, shallowMount } from "@vue/test-utils";
import { afterEach, beforeEach, vi } from "vitest";
import { defineComponent, h, reactive, ref, type Component } from "vue";
import type { RouteLocationNormalizedLoaded, Router } from "vue-router";

import AgentChat from "@/components/chat/AgentChat.vue";
import type { useThreadStream } from "@/composables/useThreadStream";
import type { Message } from "@/core/types/message";
import type { AgentThread } from "@/core/threads/types";
import {
  createWorkspaceToastStore,
  workspaceToastKey,
} from "@/core/workspace-shell/toast";

const agentChatTransport = vi.hoisted(() => ({
  fetch: vi.fn(),
  usage: vi.fn(),
  models: vi.fn(),
  createThread: vi.fn(),
}));
export { agentChatTransport };
vi.mock("@/core/api/fetcher", () => ({ fetch: agentChatTransport.fetch }));
vi.mock("@/core/models/api", () => ({ loadModels: agentChatTransport.models }));
vi.mock("@/core/api/api-client", () => ({
  getAPIClient: () => ({
    threads: { create: agentChatTransport.createThread },
  }),
}));

export const agentChatCallbacks: Partial<
  Parameters<typeof useThreadStream>[0]
> = {};
export const agentChatAccount = ref<{
  tag: "authenticated";
  user: { id: string };
}>({ tag: "authenticated", user: { id: "alice" } });
vi.mock("@/composables/useThreadStream", () => ({
  useThreadStream: (options: Parameters<typeof useThreadStream>[0]) => {
    for (const key of Object.keys(agentChatCallbacks))
      Reflect.deleteProperty(agentChatCallbacks, key);
    Object.assign(agentChatCallbacks, options);
    return agentChatStream;
  },
}));
vi.mock("@/composables/useAuthSession", () => ({
  useAuthSession: () => ({ session: agentChatAccount }),
}));
vi.mock("@/composables/useThreads", () => ({
  useThreads: () => agentChatThreads,
}));
vi.mock("@/composables/useChatAgent", () => ({
  useChatAgent: () => ({ agent: ref(null), resolved: ref(true) }),
}));
export const agentChatBrowserControlEnabled = ref(false);
vi.mock("@/composables/useWorkspaceFeatures", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/composables/useWorkspaceFeatures")
  >()),
  useBrowserControlEnabled: () => ({
    browserControlEnabled: agentChatBrowserControlEnabled,
  }),
  useKnowledgeBaseEnabled: () => ({ scopeSelectionEnabled: ref(false) }),
}));
vi.mock("@/composables/useConversationKnowledgeScope", () => ({
  useConversationKnowledgeScope: () => ({
    selection: ref(null),
    snapshot: () => null,
    agentKnowledgeEnabled: ref(false),
  }),
}));
vi.mock("@/composables/useThreadTokenUsage", () => ({
  useThreadTokenUsage: () => ({
    usage: ref(null),
    refetch: agentChatTransport.usage,
  }),
}));
export const agentChatMetadata = ref<AgentThread | null>();
vi.mock("@/composables/useThreadMetadata", () => ({
  useThreadMetadata: () => ({
    data: agentChatMetadata,
    error: ref(null),
    isFetching: ref(false),
  }),
}));
vi.mock("@/composables/useThreadActivity", () => ({
  useMarkOpenThreadRead: () => vi.fn(),
}));
vi.mock("@/composables/useActiveThreadRun", () => ({
  useActiveThreadRun: vi.fn(),
}));
vi.mock("@/composables/useThreadScheduledTasks", () => ({
  useThreadScheduledTaskEvents: () => ({ data: ref([]) }),
  useScheduleToolResultRefresh: vi.fn(),
}));
vi.mock("@/composables/useWorkspaceSidebar", () => ({
  useWorkspaceSidebar: () => ({
    mobileOpen: ref(false),
    toggleSidebar: vi.fn(),
  }),
}));
const panelHarness = vi.hoisted(() => ({
  enabled: false,
  current: null as ReturnType<
    typeof import("@/composables/useChatPanels").useChatPanels
  > | null,
}));
function currentRealPanels() {
  return panelHarness.current;
}
vi.mock("@/composables/useChatPanels", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/composables/useChatPanels")>();
  return {
    useChatPanels: (...args: Parameters<typeof actual.useChatPanels>) => {
      if (panelHarness.enabled) {
        panelHarness.current = actual.useChatPanels(...args);
        return panelHarness.current;
      }
      return {
        artifactPanel: {
          panelSize: ref(35),
          artifacts: ref([]),
          selectedArtifact: ref(null),
        },
        sidecar: {
          sidecarThreadId: ref(null),
          conversationQuotes: ref([]),
          clearConversationQuotes: vi.fn(),
        },
        sidecarSession: { ready: ref(false) },
        browserOpen: ref(false),
        browserFrame: ref(null),
        sidecarReconciling: ref(false),
        messageDetails: { selectedDetail: ref(null) },
        activePanel: ref(null),
        panelOpen: ref(false),
      };
    },
  };
});

export const completedChatMessages: Message[] = [
  { id: "human-1", type: "human", content: "Question" },
  { id: "answer-1", type: "ai", content: "Completed answer" },
];
function streamFixture() {
  return {
    messages: ref<Message[]>([...completedChatMessages]),
    state: ref({}),
    isStreaming: ref(false),
    isUploading: ref(false),
    activeRunId: ref<string | null>(null),
    streamingMessageIds: ref<ReadonlySet<string>>(new Set()),
    error: ref(null),
    isHistoryLoading: ref(false),
    isHistorySettled: ref(true),
    hasMoreHistory: ref(false),
    isHistoryLoadingMore: ref(false),
    historyError: ref(null),
    subtasks: ref([]),
    sendMessage: vi.fn<ReturnType<typeof useThreadStream>["sendMessage"]>(
      async () => true,
    ),
    regenerateMessage: vi.fn(),
    editAndRegenerateMessage: vi.fn(),
    stop: vi.fn(),
    resetView: vi.fn(),
    joinRun: vi.fn(),
    loadMoreHistory: vi.fn(),
  };
}
export const agentChatStream = streamFixture();
export function deferredChatResponse<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
}
const wrappers: ReturnType<typeof shallowMount>[] = [];
const clients: QueryClient[] = [];
export function mountAgentChatHarness(
  props: {
    demo?: boolean;
    bootstrap?: boolean;
    agentName?: string | null;
  } = {},
  options: {
    threadId?: string;
    realPanels?: boolean;
    panelStubs?: Record<string, Component | boolean>;
    realComposer?: boolean;
    sibling?: Component;
    router?: Router;
    displayedRoute?: RouteLocationNormalizedLoaded;
  } = {},
) {
  const route = reactive({
    params: {
      thread_id: options.threadId ?? "thread-a",
      agent_name: props.agentName ?? undefined,
    },
    query: {} as Record<string, string>,
    get fullPath() {
      return this.path;
    },
    path: props.agentName
      ? `/workspace/agents/${props.agentName}/chats/${options.threadId ?? "thread-a"}`
      : `/workspace/chats/${options.threadId ?? "thread-a"}`,
  });
  if (options.threadId === "new") agentChatStream.messages.value = [];
  const currentRoute =
    options.displayedRoute ??
    (options.router
      ? {
          get params() {
            return options.router!.currentRoute.value.params;
          },
          get query() {
            return options.router!.currentRoute.value.query;
          },
          get path() {
            return options.router!.currentRoute.value.path;
          },
          get fullPath() {
            return options.router!.currentRoute.value.fullPath;
          },
        }
      : route);
  vi.stubGlobal("useRoute", () => currentRoute);
  const router = {
    currentRoute: { value: route },
    replace: vi.fn(async (path: string) => {
      if (options.realComposer) {
        route.path = path;
        route.params.thread_id = path.split("/").at(-1)!;
      }
    }),
    push: vi.fn(),
  };
  vi.stubGlobal("useRouter", () => options.router ?? router);
  vi.stubGlobal("useHead", vi.fn());
  const offerFollowup = vi.fn();
  const composer = defineComponent({
    name: "FollowupComposerConsumer",
    props: {
      context: { type: Object, default: () => ({}) },
      targetThreadId: String,
      autoFocus: Boolean,
      isWelcome: Boolean,
      ensureThread: Function,
    },
    emits: ["followups-suppressed-change", "context-change", "goal-change"],
    setup(_, { expose, slots }) {
      expose({ offerFollowup, replaceDraft: vi.fn() });
      return () =>
        h("div", { "data-testid": "composer-consumer" }, [
          slots.extraHeader
            ? h(
                "div",
                { "data-testid": "composer-extra-header" },
                slots.extraHeader(),
              )
            : null,
        ]);
    },
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  clients.push(queryClient);
  panelHarness.enabled = options.realPanels === true;
  panelHarness.current = null;
  let wrapper: ReturnType<typeof shallowMount>;
  try {
    const mountConsumer =
      options.realPanels || options.realComposer ? mount : shallowMount;
    const root: Component = options.sibling
      ? defineComponent({
          setup: () => () =>
            h("div", [h(AgentChat, props), h(options.sibling!)]),
        })
      : AgentChat;
    wrapper = mountConsumer(root, {
      props,
      ...(options.realPanels || options.realComposer
        ? { attachTo: document.body }
        : {}),
      global: {
        provide: { [workspaceToastKey as symbol]: createWorkspaceToastStore() },
        plugins: [[VueQueryPlugin, { queryClient }]],
        renderStubDefaultSlot: true,
        stubs: {
          // Real panel mode mounts the production layout and resizable
          // primitive; unrelated heavy views remain explicit stubs.
          // Mount the real layout; stub only the unrelated named child views.
          ...(options.realPanels || options.realComposer
            ? Object.fromEntries(
                [
                  "AgentBootstrapComposer",
                  "AgentWelcome",
                  "MessageList",
                  "Alert",
                  "AlertDescription",
                  "DropdownMenu",
                  "DropdownMenuContent",
                  "DropdownMenuItem",
                  "DropdownMenuTrigger",
                  "AuroraText",
                  "SidebarTrigger",
                  "Tooltip",
                  "TooltipContent",
                  "TooltipTrigger",
                  "ContextUsageBadge",
                  "ThreadArchiveStatus",
                  "ProjectAffiliationBadge",
                  "ThreadBackgroundTasks",
                  "ThreadSubagentBatches",
                  "GoalStatus",
                  "TodoList",
                  "TokenUsageIndicator",
                  "ArtifactOverview",
                  "ArtifactTrigger",
                  "BrowserTrigger",
                  "ExportTrigger",
                  "ConversationExtensionActions",
                  "ThreadScheduledTasksButton",
                  "MessageDetailsPanel",
                  "SidecarTrigger",
                  "KnowledgeScopeSelector",
                  "FlipDisplay",
                ].map((name) => [name, true]),
              )
            : {}),
          WorkspacePanels: options.realPanels
            ? false
            : { template: "<div><slot name='main' /></div>" },
          ...(options.realPanels ? { ResizablePanels: false } : {}),
          ChatComposer: options.realComposer ? false : composer,
          ...(options.realComposer
            ? {
                DropdownMenu: false,
                DropdownMenuContent: false,
                DropdownMenuItem: false,
                DropdownMenuTrigger: false,
                Tooltip: false,
                TooltipContent: false,
                TooltipTrigger: false,
              }
            : {}),
          Suggestion: false,
          Suggestions: false,
          Button: false,
          Primitive: false,
          ScrollArea: { template: "<div><slot /></div>" },
          ...options.panelStubs,
        },
      },
    });
  } finally {
    panelHarness.enabled = false;
  }
  wrappers.push(wrapper);
  return {
    wrapper,
    root: wrapper,
    router,
    queryClient,
    route,
    offerFollowup,
    composer: () => wrapper.findComponent(composer),
    panels: currentRealPanels(),
  };
}
export function finishAgentChat(
  messages: readonly Message[] = completedChatMessages,
) {
  agentChatCallbacks.onFinish?.({}, messages);
}
export const agentChatThreads = reactive({
  threads: [] as AgentThread[],
  upsert: vi.fn(),
  upsertCreated: vi.fn(),
  remove: vi.fn(),
});
beforeEach(() => {
  panelHarness.enabled = false;
  panelHarness.current = null;
  agentChatBrowserControlEnabled.value = false;
  Object.assign(agentChatStream, streamFixture());
  agentChatThreads.threads = [];
  agentChatMetadata.value = undefined;
  agentChatThreads.upsert = vi.fn();
  agentChatThreads.upsertCreated = vi.fn();
  agentChatThreads.remove = vi.fn().mockResolvedValue(undefined);
  localStorage.clear();
  window.dispatchEvent(
    new StorageEvent("storage", { key: null, storageArea: localStorage }),
  );
  agentChatAccount.value = { tag: "authenticated", user: { id: "alice" } };
  agentChatTransport.models.mockResolvedValue({
    models: [],
    token_usage: { enabled: false },
  });
  agentChatTransport.createThread.mockImplementation(
    async ({ threadId }: { threadId: string }) => ({
      thread_id: threadId,
      metadata: {},
      values: { messages: [] },
    }),
  );
  agentChatTransport.usage.mockResolvedValue(undefined);
  agentChatTransport.fetch.mockImplementation(async (url: string) => {
    if (url.endsWith("/api/suggestions/config")) {
      return new Response(
        JSON.stringify({ enabled: true, max_suggestions: 3 }),
      );
    }
    return new Response(JSON.stringify({ suggestions: ["Next question"] }));
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ values: {} }))),
  );
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
});
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => {
    if (wrapper.exists()) wrapper.unmount();
  });
  clients.splice(0).forEach((client) => client.clear());
  vi.restoreAllMocks();
  vi.resetAllMocks();
});
