import { flushPromises, mount } from "@vue/test-utils";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import {
  computed,
  defineComponent,
  h,
  reactive,
  ref,
  type Component,
  type Ref,
} from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PluginPage from "@/components/workspace/extensions/PluginPage.vue";
import PluginNavigation from "@/components/workspace/extensions/PluginNavigation.vue";
import ConversationExtensionActions from "@/components/workspace/extensions/ConversationExtensionActions.vue";
import ThreadActionsMenu from "@/components/workspace/ThreadActionsMenu.vue";
import {
  useExtensionMentions,
  useFrontendExtensions,
} from "@/composables/useFrontendExtensions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { enUS } from "@/core/i18n/locales/en-US";
import { zhCN } from "@/core/i18n/locales/zh-CN";
import { resetWorkspaceQueries } from "@/core/auth/workspace-queries";
import type {
  FrontendContribution,
  FrontendExtension,
  SurfaceContext,
} from "@/core/extensions/contracts";
import type { LoadedContribution } from "@/core/extensions/registry";
import type { AgentThread } from "@/core/threads/types";

const state = vi.hoisted(() => ({
  user: undefined as unknown as Ref<{ id: string } | null>,
  entries: [] as FrontendContribution[],
  extensions: {} as Record<string, FrontendExtension>,
  request: vi.fn(),
  load: vi.fn(),
  getThread: vi.fn(),
  getState: vi.fn(),
  toast: { error: vi.fn(), info: vi.fn() },
}));
vi.mock("@/composables/useCapabilities", () => ({
  useCapabilityUser: () => state.user,
}));
vi.mock("@/composables/useSettingsPermissions", () => ({
  useSettingsPermissions: () => ({
    session: computed(() => ({ tag: "authenticated", user: state.user.value })),
  }),
}));
vi.mock("@/core/api/fetcher", () => ({ fetch: state.request }));
vi.mock("@/core/config", () => ({ getBackendBaseURL: () => "" }));
vi.mock("@/core/api", () => ({
  getAPIClient: () => ({
    threads: { get: state.getThread, getState: state.getState },
  }),
}));
vi.mock("@/core/extensions/registry", async () => ({
  ...(await vi.importActual<typeof import("@/core/extensions/registry")>(
    "@/core/extensions/registry",
  )),
  loadFrontendExtensions: state.load,
}));
vi.mock("@/core/workspace-shell/toast", () => ({
  useWorkspaceToast: () => state.toast,
}));
vi.mock("@/composables/useWorkspaceSidebar", () => ({
  useWorkspaceSidebar: () => ({
    open: ref(true),
    mobileOpen: ref(false),
    collapsed: ref(false),
    toggleSidebar: vi.fn(),
    closeMobileSidebar: vi.fn(),
  }),
}));
const locale = ref("en-US");
const route = reactive({
  path: "/workspace/extensions/community.example/library",
});
const push = vi.fn();
const cleanups: (() => void)[] = [];
function setup(component: Component, props: Record<string, unknown> = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = mount(component, {
    props,
    attachTo: document.body,
    global: {
      plugins: [[VueQueryPlugin, { queryClient: client }]],
      stubs: {
        NuxtLink: defineComponent({
          props: ["to"],
          setup:
            (props, { slots }) =>
            () =>
              h("a", { href: props.to }, slots.default?.()),
        }),
      },
    },
  });
  cleanups.push(() => {
    wrapper.unmount();
    client.clear();
  });
  return { wrapper, client };
}
function entry(namespace = "community.example"): FrontendContribution {
  return {
    namespace,
    viewer_id: "u1",
    module: namespace,
    entry: `/api/plugins/modules/${namespace}/${"a".repeat(64)}.mjs`,
    title: namespace,
    description: "",
    settings: { enabled: true },
    backend_actions: ["save"],
  };
}
function extension(namespace = "community.example"): FrontendExtension {
  return { apiVersion: 1, module: namespace };
}
const thread = {
  thread_id: "t1",
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
  status: "idle",
  metadata: {},
  values: { title: "Thread", messages: [] },
  interrupts: {},
} as AgentThread;
const answer = { id: "answer", type: "ai" as const, content: "Visible" };
async function openActions(wrapper: ReturnType<typeof setup>["wrapper"]) {
  await wrapper
    .get('button[aria-label="Bookmark"]')
    .trigger("keydown", { key: "Enter" });
  await flushPromises();
  const item = document.querySelector<HTMLElement>('[role="menuitem"]');
  expect(item?.textContent).toContain("Save answer");
  item!.click();
  await flushPromises();
}
beforeEach(() => {
  vi.clearAllMocks();
  state.user = ref({ id: "u1" });
  state.entries = [entry()];
  state.extensions = { "community.example": extension() };
  state.load.mockImplementation(async (entries: FrontendContribution[]) =>
    entries.map((entry) => ({
      ...entry,
      extension: state.extensions[entry.namespace],
    })),
  );
  state.request.mockImplementation(async (url: string) =>
    url === "/api/plugins"
      ? Response.json(state.entries)
      : Response.json({ saved: true }),
  );
  locale.value = "en-US";
  push.mockReset();
  vi.stubGlobal("useNuxtApp", () => ({
    $i18n: {
      locale,
      t: computed(() => (locale.value === "zh-CN" ? zhCN : enUS)),
    },
  }));
  vi.stubGlobal("useRouter", () => ({ push }));
  vi.stubGlobal("useRoute", () => route);
});
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("real extension page and navigation hosts", () => {
  it("discards an importer that finishes after account invalidation and shares discovery between hosts", async () => {
    let release!: (entries: LoadedContribution[]) => void;
    state.load.mockReturnValueOnce(
      new Promise<LoadedContribution[]>((resolve) => {
        release = resolve;
      }),
    );
    const Host = defineComponent({
      setup() {
        useFrontendExtensions();
        useFrontendExtensions();
        return () => h("p", "Workspace");
      },
    });
    const { client } = setup(Host);
    await flushPromises();
    expect(state.request).toHaveBeenCalledTimes(1);
    await resetWorkspaceQueries(client);
    release([{ ...entry(), extension: extension() }]);
    await flushPromises();
    expect(client.getQueryData(["frontend-extensions", "u1"])).toBeUndefined();
  });
  it("mounts the installed page, remounts on locale change and disposes once per host", async () => {
    const dispose = vi.fn();
    const contexts: SurfaceContext[] = [];
    state.extensions["community.example"]!.surfaces = [
      {
        id: "library",
        slot: "page",
        title: "Library",
        navigation: { label: "Bookmarks", labelZh: "书签", icon: "bookmark" },
        mount(root, context) {
          contexts.push(context);
          root.textContent = `PLUGIN ${context.locale}`;
          return { dispose };
        },
      },
    ];
    const { wrapper } = setup(PluginPage, {
      namespace: "community.example",
      surfaceId: "library",
    });
    await flushPromises();
    expect(wrapper.get("h1").text()).toBe("Bookmarks");
    expect(
      wrapper.get('section[aria-label="Library"] > div').element.shadowRoot
        ?.textContent,
    ).toBe("PLUGIN en-US");
    locale.value = "zh-CN";
    await flushPromises();
    expect(wrapper.get("h1").text()).toBe("书签");
    expect(contexts[0]!.signal.aborted).toBe(true);
    expect(dispose).toHaveBeenCalledTimes(1);
    wrapper.unmount();
    expect(contexts[1]!.signal.aborted).toBe(true);
    expect(dispose).toHaveBeenCalledTimes(2);
  });
  it("shows the unavailable fallback for unknown namespace/surface and isolates a throwing mount", async () => {
    const { wrapper } = setup(PluginPage, {
      namespace: "unknown",
      surfaceId: "missing",
    });
    await flushPromises();
    expect(wrapper.text()).toContain(enUS.extensions.pageUnavailableHint);
    expect(
      wrapper.find('a[href="/workspace/capabilities?tab=extensions"]').exists(),
    ).toBe(true);
    expect(
      wrapper
        .findAll("button")
        .some((button) => button.text() === enUS.extensions.reload),
    ).toBe(true);
    state.extensions["community.example"]!.surfaces = [
      {
        id: "library",
        slot: "page",
        title: "Library",
        mount(root) {
          root.textContent = "partial";
          throw Error("broken");
        },
      },
    ];
    const broken = setup(PluginPage, {
      namespace: "community.example",
      surfaceId: "library",
    }).wrapper;
    await flushPromises();
    expect(broken.get('[role="alert"]').text()).toBe(
      enUS.extensions.viewFailed,
    );
    expect(broken.get("section > div").element.shadowRoot?.textContent).toBe(
      "",
    );
  });
  it("renders only declared navigation, highlights the route, and refuses a mismatched viewer", async () => {
    state.extensions["community.example"]!.surfaces = [
      {
        id: "library",
        slot: "page",
        title: "Library",
        navigation: { label: "Bookmarks" },
        mount: () => ({ dispose() {} }),
      },
      {
        id: "private",
        slot: "page",
        title: "Private",
        mount: () => ({ dispose() {} }),
      },
    ];
    const { wrapper } = setup(PluginNavigation);
    await flushPromises();
    expect(wrapper.findAll("a")).toHaveLength(1);
    expect(wrapper.get("a").attributes("href")).toBe(route.path);
    expect(wrapper.get("a").attributes("data-active")).toBe("true");
    state.user.value = { id: "u2" };
    await flushPromises();
    expect(wrapper.findAll("a")).toHaveLength(0);
    expect(state.load).toHaveBeenCalledTimes(1);
  });
  it("aborts a live navigation on unmount and ignores late thread metadata", async () => {
    let context!: SurfaceContext;
    let release!: (value: unknown) => void;
    state.getThread.mockReturnValueOnce(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    state.extensions["community.example"]!.surfaces = [
      {
        id: "library",
        slot: "page",
        title: "Library",
        mount(_root, current) {
          context = current;
          return { dispose() {} };
        },
      },
    ];
    const { wrapper } = setup(PluginPage, {
      namespace: "community.example",
      surfaceId: "library",
    });
    await flushPromises();
    const pending = context.openConversation!("legacy-bookmark");
    wrapper.unmount();
    release({
      thread_id: "legacy-bookmark",
      metadata: { agent_name: "researcher" },
    });
    await expect(pending).rejects.toThrow();
    expect(push).not.toHaveBeenCalled();
    expect(state.getThread.mock.calls[0]![1].signal.aborted).toBe(true);
  });
});

describe("extension mention owner", () => {
  it("debounces provider searches and drops stale query/thread results and post-unmount work", async () => {
    vi.useFakeTimers();
    const releases: ((items: { id: string; label: string }[]) => void)[] = [];
    const signals: AbortSignal[] = [];
    const search = vi.fn((_query: string, context: { signal: AbortSignal }) => {
      signals.push(context.signal);
      return new Promise<{ id: string; label: string }[]>((resolve) => {
        releases.push(resolve);
      });
    });
    state.extensions["community.example"]!.mentionProviders = [
      { id: "people", label: "People", search },
    ];
    const query = ref("a");
    const threadId = ref("thread-a");
    let mentions!: ReturnType<typeof useExtensionMentions>;
    const Host = defineComponent({
      setup() {
        mentions = useExtensionMentions(threadId, query);
        return () =>
          h("p", mentions.items.value.map((item) => item.label).join(","));
      },
    });
    const { wrapper } = setup(Host);
    await flushPromises();
    await vi.advanceTimersByTimeAsync(150);
    expect(search).toHaveBeenCalledTimes(1);
    query.value = "alice";
    threadId.value = "thread-b";
    expect(signals[0]!.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(150);
    releases[0]!([{ id: "stale", label: "Stale" }]);
    releases[1]!([{ id: "alice", label: "Alice" }]);
    await flushPromises();
    expect(mentions.items.value.map((item) => item.label)).toEqual(["Alice"]);
    expect(search.mock.calls[1]![0]).toBe("alice");
    query.value = "next";
    expect(mentions.items.value.map((item) => item.label)).toEqual(["Alice"]);
    expect(mentions.loading.value).toBe(false);
    await vi.advanceTimersByTimeAsync(150);
    wrapper.unmount();
    expect(signals[2]!.aborted).toBe(true);
    releases[2]!([{ id: "late", label: "Late" }]);
    await flushPromises();
    expect(mentions.items.value).toEqual([]);
    vi.clearAllTimers();
    vi.useRealTimers();
  });
  it.each(["locale", "thread", "viewer", "installed snapshot"])(
    "preserves settled candidates during refresh but clears them when the %s changes",
    async (change) => {
      vi.useFakeTimers();
      try {
        const search = vi.fn(async () => [{ id: "alice", label: "Alice" }]);
        state.extensions["community.example"]!.mentionProviders = [
          { id: "people", label: "People", search },
        ];
        const query = ref("a");
        const threadId = ref("thread-a");
        let mentions!: ReturnType<typeof useExtensionMentions>;
        const Host = defineComponent({
          setup() {
            mentions = useExtensionMentions(threadId, query);
            return () =>
              h("p", mentions.items.value.map((item) => item.label).join(","));
          },
        });
        const { client } = setup(Host);
        await flushPromises();
        await vi.advanceTimersByTimeAsync(150);
        await flushPromises();
        expect(mentions.items.value.map((item) => item.label)).toEqual([
          "Alice",
        ]);
        expect(mentions.loading.value).toBe(false);
        query.value = "ali";
        expect(mentions.items.value.map((item) => item.label)).toEqual([
          "Alice",
        ]);
        expect(mentions.loading.value).toBe(false);
        if (change === "locale") locale.value = "zh-CN";
        else if (change === "thread") threadId.value = "thread-b";
        else if (change === "viewer") state.user.value = { id: "u2" };
        else client.setQueryData(["frontend-extensions", "u1"], []);
        await flushPromises();
        expect(mentions.items.value).toEqual([]);
      } finally {
        vi.clearAllTimers();
        vi.useRealTimers();
      }
    },
  );
});

describe("conversation extension actions in actual toolbar and sidebar menu", () => {
  function register(
    execute = vi.fn(async (_context, services) => {
      await services.callBackend("save", {});
      services.showMessage("Saved");
    }),
  ) {
    state.extensions["community.example"]!.conversationActions = () => ({
      label: "Bookmark",
      icon: "bookmark",
      actions: [
        {
          id: "save",
          label: "Save answer",
          icon: "bookmark",
          available: (settings) => settings.enabled === true,
          execute,
        },
      ],
    });
    return execute;
  }
  it.each([false, true])(
    "keeps a sidebar action alive when the dropdown closes, but cancels when its conversation row unmounts: %s",
    async (unmountRow) => {
      let finish!: (value: unknown) => void;
      state.getState.mockReturnValueOnce(
        new Promise((resolve) => {
          finish = resolve;
        }),
      );
      register(
        vi.fn(async (context, services) => {
          const answer = await services.latestVisibleAnswer(context);
          await services.callBackend("save", { answer });
          services.showMessage("Saved");
        }),
      );
      const { wrapper } = setup(ThreadActionsMenu, { thread, pinned: false });
      await flushPromises();
      await wrapper
        .get('button[aria-label="More"]')
        .trigger("keydown", { key: "Enter" });
      await flushPromises();
      const sub = [
        ...document.querySelectorAll<HTMLElement>('[role="menuitem"]'),
      ].find((item) => item.textContent?.trim() === "Bookmark");
      expect(sub).toBeDefined();
      sub!.click();
      await flushPromises();
      const action = [
        ...document.querySelectorAll<HTMLElement>('[role="menuitem"]'),
      ].find((item) => item.textContent?.trim() === "Save answer");
      expect(action).toBeDefined();
      action!.click();
      await flushPromises();
      expect(state.getState).toHaveBeenCalledWith(thread.thread_id);
      expect(wrapper.findComponent(ConversationExtensionActions).exists()).toBe(
        false,
      );
      if (unmountRow) wrapper.unmount();
      finish({ values: { messages: [answer] } });
      await flushPromises();
      const post = state.request.mock.calls.filter(
        ([, init]) => init?.method === "POST",
      );
      expect(post).toHaveLength(unmountRow ? 0 : 1);
      if (unmountRow) expect(state.toast.info).not.toHaveBeenCalled();
      else expect(state.toast.info).toHaveBeenCalledWith("Saved");
    },
  );
  it("executes the toolbar action through the allowlisted viewer-bound bridge and hides empty conversations", async () => {
    const execute = register();
    const { wrapper } = setup(ConversationExtensionActions, {
      context: { thread, messages: [answer] },
    });
    await flushPromises();
    await openActions(wrapper);
    expect(execute.mock.calls[0]![0]).toEqual({ thread, messages: [answer] });
    expect(state.request).toHaveBeenCalledWith(
      "/api/plugins/community.example/actions/save",
      expect.objectContaining({
        headers: {
          "Content-Type": "application/json",
          "X-Deerflow-Plugin-Viewer": "u1",
        },
      }),
    );
    expect(state.toast.info).toHaveBeenCalledWith("Saved");
    await wrapper.setProps({ context: { thread, messages: [] } });
    expect(wrapper.findAll("button")).toHaveLength(0);
  });
  it("renders a submenu inside the conversation row menu", async () => {
    register();
    const Host = defineComponent({
      setup: () => () =>
        h(
          DropdownMenu,
          { defaultOpen: true },
          {
            default: () => [
              h(DropdownMenuTrigger, {}, { default: () => "Row menu" }),
              h(
                DropdownMenuContent,
                {},
                {
                  default: () =>
                    h(ConversationExtensionActions, {
                      context: { thread },
                      placement: "menu",
                    }),
                },
              ),
            ],
          },
        ),
    });
    setup(Host);
    await flushPromises();
    expect(
      document.querySelector('[role="menuitem"][aria-haspopup="menu"]')
        ?.textContent,
    ).toContain("Bookmark");
  });
  it("suppresses stale action notifications after synchronous account cache invalidation", async () => {
    let release!: () => void;
    const execute = vi.fn(async (_context, services) => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      services.showMessage("Old account saved");
    });
    register(execute);
    const { wrapper, client } = setup(ConversationExtensionActions, {
      context: { thread, messages: [answer] },
    });
    await flushPromises();
    await openActions(wrapper);
    await resetWorkspaceQueries(client);
    release();
    await flushPromises();
    expect(state.toast.info).not.toHaveBeenCalled();
    expect(state.toast.error).not.toHaveBeenCalled();
  });
  it("reports a permitted server error and contains a broken sibling action factory", async () => {
    register();
    state.entries.push(entry("broken"));
    state.extensions.broken = {
      ...extension("broken"),
      conversationActions() {
        throw Error("invalid plugin");
      },
    };
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    state.request.mockImplementation(async (url: string) =>
      url === "/api/plugins"
        ? Response.json(state.entries)
        : Response.json({ detail: "Access denied" }, { status: 403 }),
    );
    const { wrapper } = setup(ConversationExtensionActions, {
      context: { thread, messages: [answer] },
    });
    await flushPromises();
    expect(wrapper.findAll("button")).toHaveLength(1);
    await openActions(wrapper);
    expect(state.toast.error).toHaveBeenCalledWith(
      enUS.extensions.actionFailed,
    );
  });
});
