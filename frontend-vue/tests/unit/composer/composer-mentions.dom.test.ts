import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reactive, ref } from "vue";
import ChatComposer from "@/components/chat/ChatComposer.vue";
import { enUS } from "@/core/i18n/locales/en-US";
import { referenceToken } from "@/core/mentions/inline-references";
import type { getUploadLimits } from "@/core/uploads/api";
import {
  readProjectAttachments,
  stageProjectAttachment,
} from "@/core/projects/composer-attach";
import {
  buildComposerDraftKey,
  readComposerDraft,
} from "@/core/threads/composer-draft";
import {
  createWorkspaceToastStore,
  workspaceToastKey,
} from "@/core/workspace-shell/toast";

const mocks = vi.hoisted(() => ({
  skills: vi.fn(),
  models: vi.fn(),
  limits: vi.fn<typeof getUploadLimits>(),
  upload: vi.fn(),
  attach: vi.fn(),
  capability: vi.fn(),
  polish: vi.fn(),
  fetchMore: vi.fn(),
  documentsHasMore: false,
  documentsLoadingMore: false,
}));
vi.mock("@/core/skills/api", () => ({ loadSkills: mocks.skills }));
vi.mock("@/core/models/api", () => ({ loadModels: mocks.models }));
vi.mock("@/core/uploads/api", () => ({
  getUploadLimits: mocks.limits,
  uploadFiles: mocks.upload,
}));
vi.mock("@/core/input-polish/api", () => ({ polishInputDraft: mocks.polish }));
vi.mock("@/core/projects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/core/projects")>()),
  attachProjectDocument: mocks.attach,
}));
vi.mock("@/core/features/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/core/features/api")>()),
  fetchConversationReferencesCapability: mocks.capability,
}));
vi.mock("@/composables/useFrontendExtensions", () => ({
  useExtensionMentions: () => ({
    items: ref([
      {
        namespace: "example.plugin",
        provider: "records",
        id: "record-1",
        label: "Plugin result",
      },
    ]),
    failed: ref(false),
    loading: ref(false),
    retry: vi.fn(),
  }),
}));
vi.mock("@/composables/useAuthSession", () => ({
  useAuthSession: () => ({
    session: ref({ tag: "anonymous" }),
    isFetching: ref(false),
  }),
}));
vi.mock("@/composables/useProjectDocuments", () => ({
  useInfiniteProjectDocuments: () => ({
    data: ref({
      pages: [
        {
          documents: [
            {
              id: "doc-1",
              name: "Shelf title.txt",
              size_bytes: 2,
              content_missing: false,
            },
          ],
        },
      ],
    }),
    isPending: ref(false),
    isError: ref(false),
    hasNextPage: ref(mocks.documentsHasMore),
    isFetchingNextPage: ref(mocks.documentsLoadingMore),
    refetch: vi.fn(),
    fetchNextPage: mocks.fetchMore,
  }),
}));
vi.mock("@/composables/useThreads", () => ({
  useThreads: () =>
    reactive({
      threads: Array.from({ length: 4 }, (_, i) => ({
        thread_id: `source-${i}`,
        values: { title: `Source ${i}` },
        metadata: {},
      })),
      loading: false,
      error: null,
      hasMore: false,
      loadingMore: false,
      loadInitial: vi.fn(),
      loadMore: vi.fn(),
    }),
}));
const toast = createWorkspaceToastStore();
const wrappers: ReturnType<typeof mount>[] = [];
function mountComposer(
  submitMessage = vi.fn(async (_text, _files, options) => {
    options.onAccepted();
    return true;
  }),
  extra: Record<string, unknown> = {},
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = mount(ChatComposer, {
    attachTo: document.body,
    props: {
      threadKey: "thread-1",
      targetThreadId: "thread-1",
      userId: "u1",
      streaming: false,
      uploading: false,
      promptHistory: [],
      modelSelectionReady: true,
      context: { model_name: "reasoner", mode: "pro" },
      submitMessage,
      ...extra,
    },
    global: {
      plugins: [[VueQueryPlugin, { queryClient: client }]],
      provide: { [workspaceToastKey as symbol]: toast },
    },
  });
  wrappers.push(wrapper);
  return { wrapper, submitMessage, client };
}
const option = (
  wrapper: ReturnType<typeof mountComposer>["wrapper"],
  label: string,
) =>
  wrapper.findAll("[role=option]").find((item) => item.text().includes(label))!;
async function open(wrapper: ReturnType<typeof mountComposer>["wrapper"]) {
  await wrapper.get("[data-testid=mention-button]").trigger("click");
  await flushPromises();
}
beforeEach(() => {
  sessionStorage.clear();
  toast.clear();
  vi.clearAllMocks();
  mocks.documentsHasMore = false;
  mocks.documentsLoadingMore = false;
  vi.stubGlobal("useNuxtApp", () => ({
    $i18n: { t: ref(enUS), locale: ref("en-US") },
  }));
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("[]", { status: 200 })),
  );
  mocks.skills.mockResolvedValue([
    { name: "analysis", description: "Analyze", enabled: true },
  ]);
  mocks.models.mockResolvedValue({
    models: [
      {
        name: "reasoner",
        model: "provider",
        display_name: "Reasoner",
        supports_thinking: true,
        supports_reasoning_effort: true,
        reasoning_effort_values: ["low", "medium", "max"],
        default_reasoning_effort: "max",
      },
    ],
    token_usage: { enabled: false },
  });
  mocks.limits.mockResolvedValue({
    max_files: 10,
    max_file_size: 50 * 1024 * 1024,
    max_total_size: 100 * 1024 * 1024,
  });
  mocks.capability.mockResolvedValue({ enabled: true, maxReferences: 3 });
  mocks.attach.mockResolvedValue({
    filename: "server-collision-2.txt",
    size_bytes: 2,
    virtual_path: "/mnt/uploads/server-collision-2.txt",
    artifact_url: "/a",
  });
});
afterEach(() => {
  for (const wrapper of wrappers.splice(0)) wrapper.unmount();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("composer real mention consumer", () => {
  it("repositions references within the native clipping region when only layout changes", async () => {
    const observers: {
      callback: ResizeObserverCallback;
      targets: Element[];
      disconnect: ReturnType<typeof vi.fn<() => void>>;
    }[] = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        entry: (typeof observers)[number];
        constructor(callback: ResizeObserverCallback) {
          this.entry = { callback, targets: [], disconnect: vi.fn() };
          observers.push(this.entry);
        }
        observe(target: Element) {
          this.entry.targets.push(target);
        }
        disconnect() {
          this.entry.disconnect();
        }
      },
    );
    vi.stubGlobal("innerHeight", 800);
    const { wrapper } = mountComposer();
    await flushPromises();
    const root = wrapper.element as HTMLElement;
    const clip = document.createElement("main");
    clip.style.overflowY = "auto";
    root.before(clip);
    clip.append(root);
    vi.spyOn(clip, "getBoundingClientRect").mockReturnValue({
      top: 120,
      bottom: 800,
    } as DOMRect);
    Object.defineProperty(clip, "clientHeight", {
      configurable: true,
      value: 680,
    });
    let top = 300;
    vi.spyOn(root, "getBoundingClientRect").mockImplementation(
      () => ({ top, bottom: 780 }) as DOMRect,
    );
    await open(wrapper);
    const popup = wrapper.get('[data-testid="mention-picker"]').element
      .parentElement!;
    popup.style.marginBottom = "8px";
    window.dispatchEvent(new Event("resize"));
    await flushPromises();
    expect(popup.style.maxHeight).toBe("168px");
    top = 220;
    popup.style.marginBottom = "16px";
    for (const observer of observers.filter((item) =>
      item.targets.includes(root),
    ))
      observer.callback([], {} as ResizeObserver);
    await flushPromises();
    expect(popup.style.maxHeight).toBe("80px");
    const picker = popup.firstElementChild!;
    const option = picker.querySelector<HTMLElement>("button[role=option]")!;
    Object.defineProperty(option, "offsetHeight", {
      configurable: true,
      value: 104,
    });
    for (const observer of observers.filter((item) =>
      item.targets.includes(picker),
    ))
      observer.callback([], {} as ResizeObserver);
    await flushPromises();
    expect(popup.classList.contains("relative")).toBe(true);
    expect(popup.classList.contains("absolute")).toBe(false);
    expect(popup.style.maxHeight).toBe("672px");
    top = 300;
    for (const observer of observers.filter((item) =>
      item.targets.includes(root),
    ))
      observer.callback([], {} as ResizeObserver);
    await flushPromises();
    expect(popup.classList.contains("absolute")).toBe(true);
    expect(popup.classList.contains("relative")).toBe(false);
    expect(popup.style.maxHeight).toBe("160px");
    wrapper.unmount();
    expect(
      observers.every((item) => item.disconnect.mock.calls.length === 1),
    ).toBe(true);
  });
  it("keeps a button-open reference picker through native textarea selection and Tab keyup", async () => {
    const { wrapper } = mountComposer(undefined, { isWelcome: true });
    await flushPromises();
    await open(wrapper);
    const textarea = wrapper.get("textarea");
    (textarea.element as HTMLTextAreaElement).focus();
    await textarea.trigger("select");
    await textarea.trigger("selectionchange");
    await textarea.trigger("keyup", { key: "Tab" });
    await flushPromises();
    expect(wrapper.find('[data-testid="mention-picker"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="welcome-suggestions"]').isVisible()).toBe(
      false,
    );
  });
  it("dismisses references only on an outside pointerdown, not focus leaving or an inside pointer", async () => {
    const { wrapper } = mountComposer();
    await flushPromises();
    await open(wrapper);
    const outside = document.createElement("button");
    document.body.append(outside);
    outside.focus();
    await flushPromises();
    expect(wrapper.find('[data-testid="mention-picker"]').exists()).toBe(true);
    await wrapper.get('[data-testid="mention-picker"]').trigger("pointerdown");
    expect(wrapper.find('[data-testid="mention-picker"]').exists()).toBe(true);
    outside.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    await flushPromises();
    expect(wrapper.find('[data-testid="mention-picker"]').exists()).toBe(false);
  });
  it("updates a mid-draft mention when a collapsed native caret moves without input or select", async () => {
    const { wrapper } = mountComposer();
    await flushPromises();
    const textarea = wrapper.get("textarea");
    const element = textarea.element as HTMLTextAreaElement;
    await textarea.setValue("Before @ana after");
    await flushPromises();
    element.focus();
    // Happy DOM emits select for a collapsed setSelectionRange; Chromium's
    // native arrows emit only selectionchange. Supply that event's snapshot.
    let caret = 11;
    Object.defineProperties(element, {
      selectionStart: { configurable: true, get: () => caret },
      selectionEnd: { configurable: true, get: () => caret },
    });
    await textarea.trigger("selectionchange");
    await flushPromises();
    expect(option(wrapper, "analysis")).toBeDefined();
    expect(textarea.attributes("aria-activedescendant")).toBeTruthy();
    caret = 0;
    await textarea.trigger("selectionchange");
    await flushPromises();
    expect(wrapper.find('[data-testid="mention-picker"]').exists()).toBe(false);
    caret = 11;
    await textarea.trigger("selectionchange");
    await flushPromises();
    expect(option(wrapper, "analysis")).toBeDefined();
    await textarea.trigger("keydown", { key: "Escape" });
    await textarea.trigger("selectionchange");
    await flushPromises();
    expect(wrapper.find('[data-testid="mention-picker"]').exists()).toBe(false);
  });
  it("hides welcome suggestions while references are open and restores them on close", async () => {
    const { wrapper } = mountComposer(undefined, { isWelcome: true });
    await flushPromises();
    expect(wrapper.get('[data-testid="welcome-suggestions"]').isVisible()).toBe(
      true,
    );
    await open(wrapper);
    expect(wrapper.find('[data-testid="mention-picker"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="welcome-suggestions"]').isVisible()).toBe(
      false,
    );
    await wrapper.get('button[aria-label="Close references"]').trigger("click");
    await flushPromises();
    expect(wrapper.find('[data-testid="mention-picker"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="welcome-suggestions"]').isVisible()).toBe(
      true,
    );
  });
  it("opens with @ at the caret, selects a skill by keyboard, and emits activation metadata", async () => {
    const { wrapper, submitMessage } = mountComposer();
    await flushPromises();
    const textarea = wrapper.get("textarea");
    await textarea.setValue("@ana");
    (textarea.element as HTMLTextAreaElement).setSelectionRange(4, 4);
    await textarea.trigger("keyup", { key: "a" });
    await flushPromises();
    expect(wrapper.find("[data-testid=mention-picker]").exists()).toBe(true);
    expect(textarea.attributes("aria-activedescendant")).toBeTruthy();
    await textarea.trigger("keydown", { key: "Enter" });
    await flushPromises();
    expect(
      wrapper.get("[data-testid=inline-skill-reference]").text(),
    ).toContain("analysis");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(submitMessage).toHaveBeenCalledWith(
      "@analysis",
      [],
      expect.objectContaining({
        humanMessageId: expect.any(String),
        additionalKwargs: { skill_references: ["analysis"] },
        conversationReferences: [],
      }),
    );
  });
  it("passes a complete reference snapshot to the event host and retires only after acceptance", async () => {
    const { wrapper } = mountComposer(undefined, { submitMessage: undefined });
    await flushPromises();
    await open(wrapper);
    await option(wrapper, "analysis").trigger("click");
    await flushPromises();
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    const event = wrapper.emitted("send")?.[0];
    expect(event?.[0]).toBe("@analysis");
    expect(event?.[1]).toEqual([]);
    expect(event?.[2]).toMatchObject({
      humanMessageId: expect.any(String),
      additionalKwargs: { skill_references: ["analysis"] },
      conversationReferences: [],
      onAccepted: expect.any(Function),
    });
    expect(wrapper.find("[data-testid=inline-skill-reference]").exists()).toBe(
      true,
    );
    (event?.[2] as { onAccepted: () => void }).onAccepted();
    await flushPromises();
    expect(wrapper.find("[data-testid=inline-skill-reference]").exists()).toBe(
      false,
    );
  });
  it("keeps a goal command draft until its event host accepts the new run", async () => {
    const { wrapper } = mountComposer(undefined, { submitMessage: undefined });
    await flushPromises();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ goal: { objective: "Finish the report" } }),
      ),
    );
    await wrapper.get("textarea").setValue("/goal Finish the report");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    const event = wrapper.emitted("send")?.[0];
    expect(event).toEqual([
      "Finish the report",
      [],
      {
        humanMessageId: expect.any(String),
        signal: expect.any(AbortSignal),
        runSnapshot: {
          context: { model_name: "reasoner", mode: "pro" },
          model: expect.any(Object),
        },
        onAccepted: expect.any(Function),
      },
    ]);
    expect((wrapper.get("textarea").element as HTMLTextAreaElement).value).toBe(
      "/goal Finish the report",
    );
    (event![2] as { onAccepted: () => void }).onAccepted();
    await flushPromises();
    expect((wrapper.get("textarea").element as HTMLTextAreaElement).value).toBe(
      "",
    );
  });
  it("blocks denied run starts and goal preparation without changing the draft", async () => {
    const { wrapper, submitMessage } = mountComposer(undefined, {
      canCreateRuns: false,
    });
    await flushPromises();
    const button = wrapper.get("button[type=submit]");
    expect(button.attributes("disabled")).toBeDefined();
    expect(button.attributes("aria-label")).toBe(
      enUS.inputBox.startTurnUnavailable,
    );
    expect(button.attributes("title")).toBe(enUS.inputBox.startTurnUnavailable);
    await wrapper.get("textarea").setValue("/goal Finish the report");
    const fetcher = vi.mocked(fetch);
    fetcher.mockClear();
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(fetcher).not.toHaveBeenCalled();
    expect(submitMessage).not.toHaveBeenCalled();
    expect((wrapper.get("textarea").element as HTMLTextAreaElement).value).toBe(
      "/goal Finish the report",
    );
    expect(toast.toasts.value.at(-1)).toMatchObject({
      kind: "info",
      message: enUS.inputBox.startTurnUnavailable,
    });
    await wrapper.get("textarea").setValue("ordinary message");
    await wrapper.get("textarea").trigger("keydown", { key: "Enter" });
    await flushPromises();
    expect(submitMessage).not.toHaveBeenCalled();
    await wrapper.setProps({ canCreateRuns: true });
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(submitMessage).toHaveBeenCalled();
  });
  it.each(["status", "clear"])(
    "allows /goal %s without run-create permission",
    async (command) => {
      const { wrapper, submitMessage } = mountComposer(undefined, {
        canCreateRuns: false,
      });
      await flushPromises();
      const fetcher = vi.fn(async () => Response.json({ goal: null }));
      vi.stubGlobal("fetch", fetcher);
      await wrapper
        .get("textarea")
        .setValue(command === "status" ? "/goal" : "/goal clear");
      await wrapper.get("form").trigger("submit");
      await flushPromises();
      expect(fetcher).toHaveBeenCalledWith(
        expect.stringContaining("/goal"),
        expect.objectContaining({
          method: command === "status" ? "GET" : "DELETE",
        }),
      );
      expect(submitMessage).not.toHaveBeenCalled();
      expect(
        (wrapper.get("textarea").element as HTMLTextAreaElement).value,
      ).toBe("");
    },
  );
  it("preserves the active run when cancellation is denied", async () => {
    const { wrapper } = mountComposer(undefined, {
      streaming: true,
      canStopStreaming: false,
    });
    await flushPromises();
    const button = wrapper.get("button[type=submit]");
    expect(button.attributes("disabled")).toBeDefined();
    expect(button.attributes("aria-label")).toBe(
      enUS.inputBox.stopStreamingUnavailable,
    );
    expect(button.attributes("title")).toBe(
      enUS.inputBox.stopStreamingUnavailable,
    );
    await button.trigger("click");
    expect(wrapper.emitted("stop")).toBeUndefined();
    await wrapper.setProps({ canStopStreaming: true });
    await button.trigger("click");
    expect(wrapper.emitted("stop")).toHaveLength(1);
  });
  it("renders removable staged attachments without a source document", async () => {
    stageProjectAttachment("thread-1", {
      filename: "attached.txt",
      virtual_path: "/mnt/uploads/attached.txt",
      size_bytes: 2,
      artifact_url: "/a",
    });
    const { wrapper } = mountComposer();
    await flushPromises();
    expect(
      wrapper.get("[data-testid=project-attachment-chip]").text(),
    ).toContain("attached.txt");
    await wrapper
      .get(`button[aria-label="${enUS.inputBox.removeProjectAttachment}"]`)
      .trigger("click");
    expect(readProjectAttachments("thread-1")).toEqual([]);
    expect(wrapper.find("[data-testid=project-attachment-chip]").exists()).toBe(
      false,
    );
  });
  it("reports the current localized plugin reference limit before dispatch", async () => {
    const { wrapper, submitMessage } = mountComposer();
    await flushPromises();
    const text = Array.from({ length: 17 }, (_, i) =>
      referenceToken(
        "extension",
        JSON.stringify(["example.plugin", "records", `record-${i}`]),
        `Record ${i}`,
      ),
    ).join(" ");
    (
      wrapper.vm as unknown as { replaceDraft: (text: string) => void }
    ).replaceDraft(text);
    await flushPromises();
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(submitMessage).not.toHaveBeenCalled();
    expect(toast.toasts.value.at(-1)).toMatchObject({
      kind: "warning",
      message: enUS.inputBox.mentionExtensionsLimit,
    });
    expect(wrapper.text()).toContain("Record 16");
  });
  it("keeps 3 conversation grants separate from plugin display metadata and disables the fourth", async () => {
    const { wrapper, submitMessage } = mountComposer();
    await flushPromises();
    for (let i = 0; i < 3; i++) {
      await open(wrapper);
      await option(wrapper, `Source ${i}`).trigger("click");
      await flushPromises();
    }
    await open(wrapper);
    expect(option(wrapper, "Source 3").attributes("disabled")).toBeDefined();
    await option(wrapper, "Plugin result").trigger("click");
    await flushPromises();
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    const payload = submitMessage.mock.calls[0]![2];
    expect(payload.conversationReferences).toEqual([
      "source-0",
      "source-1",
      "source-2",
    ]);
    expect(payload.additionalKwargs.conversation_references).toHaveLength(3);
    expect(payload.additionalKwargs.extension_mentions).toEqual([
      {
        namespace: "example.plugin",
        provider: "records",
        id: "record-1",
        label: "Plugin result",
      },
    ]);
  });
  it("keeps failed discovery references visible, blocks sending, and retries discovery explicitly", async () => {
    mocks.capability.mockRejectedValueOnce(new Error("discovery unavailable"));
    const { wrapper, submitMessage } = mountComposer();
    await flushPromises();
    const text = referenceToken("conversation", "source-0", "Known source");
    (
      wrapper.vm as unknown as { replaceDraft(text: string): void }
    ).replaceDraft(text);
    await flushPromises();
    expect(
      wrapper.get("[data-testid=conversation-reference-chip]").text(),
    ).toContain("Known source");
    expect(
      wrapper.get("button[type=submit]").attributes("disabled"),
    ).toBeDefined();
    const retry = wrapper.get("[data-testid=retry-conversation-capability]");
    expect(wrapper.find("[data-testid=mention-picker]").exists()).toBe(false);
    await retry.trigger("click");
    await flushPromises();
    await vi.waitFor(() => expect(mocks.capability).toHaveBeenCalledTimes(2));
    await vi.waitFor(() =>
      expect(
        wrapper.get("button[type=submit]").attributes("disabled"),
      ).toBeUndefined(),
    );
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(submitMessage.mock.calls[0]![2].conversationReferences).toEqual([
      "source-0",
    ]);
  });
  it("locks the inline editor while a project file is ingested and uses the backend filename", async () => {
    let finish!: (value: unknown) => void;
    mocks.attach.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const { wrapper, submitMessage } = mountComposer(undefined, {
      projectId: "project-1",
    });
    await flushPromises();
    await open(wrapper);
    await option(wrapper, "analysis").trigger("click");
    await flushPromises();
    await open(wrapper);
    await option(wrapper, "Shelf title.txt").trigger("click");
    await flushPromises();
    expect(
      wrapper
        .get("[role=textbox][contenteditable]")
        .attributes("contenteditable"),
    ).toBe("false");
    expect(
      wrapper.get("[data-testid=composer-mode-trigger]").attributes("disabled"),
    ).toBeDefined();
    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    await flushPromises();
    expect(wrapper.find("[data-testid=mention-picker]").exists()).toBe(true);
    finish({
      filename: "server-collision-2.txt",
      size_bytes: 2,
      virtual_path: "/mnt/uploads/server-collision-2.txt",
      artifact_url: "/a",
    });
    await flushPromises();
    expect(mocks.attach).toHaveBeenCalledWith("project-1", "doc-1", "thread-1");
    expect(wrapper.emitted("referenceFileAttached")).toHaveLength(1);
    expect(
      wrapper
        .get("[role=textbox][contenteditable]")
        .attributes("contenteditable"),
    ).toBe("true");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(submitMessage.mock.calls[0]![2].additionalKwargs.files).toEqual([
      {
        filename: "server-collision-2.txt",
        path: "/mnt/uploads/server-collision-2.txt",
        size: 2,
        status: "uploaded",
      },
    ]);
    expect(readProjectAttachments("thread-1")).toEqual([]);
  });
  it("preserves edited text and a newer staged revision when an older send is accepted", async () => {
    const staged = {
      filename: "file.txt",
      size_bytes: 2,
      virtual_path: "/mnt/file.txt",
      artifact_url: "/a",
      source_document_id: "doc-1",
      source_project_id: "p",
    };
    stageProjectAttachment("thread-1", staged);
    let accept!: () => void;
    const submitMessage = vi.fn(async (_text, _files, options) => {
      accept = options.onAccepted;
      return true;
    });
    const { wrapper } = mountComposer(submitMessage);
    await flushPromises();
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    const editor = wrapper.get("[role=textbox][contenteditable]");
    editor.element.textContent = "Later draft";
    await editor.trigger("input");
    await flushPromises();
    const newer = stageProjectAttachment("thread-1", staged);
    accept();
    await flushPromises();
    expect(editor.text()).toContain("Later draft");
    expect(readProjectAttachments("thread-1")).toEqual([newer]);
    const key = buildComposerDraftKey({ userId: "u1", threadId: "thread-1" });
    expect(readComposerDraft(sessionStorage, key)?.text).toContain(
      "Later draft",
    );
  });
  it("uses the same human ID for an unchanged failed retry and a new ID after editing", async () => {
    const submitMessage = vi.fn().mockRejectedValue(new Error("not accepted"));
    const { wrapper } = mountComposer(submitMessage);
    await flushPromises();
    await wrapper.get("textarea").setValue("same draft");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(submitMessage.mock.calls[0]![2].humanMessageId).toBe(
      submitMessage.mock.calls[1]![2].humanMessageId,
    );
    await wrapper.get("textarea").setValue("edited draft");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(submitMessage.mock.calls[2]![2].humanMessageId).not.toBe(
      submitMessage.mock.calls[1]![2].humanMessageId,
    );
  });
  it("keeps conversation grants and staged files after failure, then retires only after an accepted resubmit", async () => {
    const staged = stageProjectAttachment("thread-1", {
      filename: "attached.txt",
      size_bytes: 2,
      virtual_path: "/mnt/attached.txt",
      artifact_url: "/a",
    });
    const submit = vi
      .fn()
      .mockRejectedValueOnce(new Error("Run rejected"))
      .mockImplementationOnce(async (_text, _files, options) => {
        options.onAccepted();
        return true;
      });
    const { wrapper } = mountComposer(submit);
    await flushPromises();
    await open(wrapper);
    await option(wrapper, "Source 0").trigger("click");
    await flushPromises();
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(toast.toasts.value.at(-1)).toMatchObject({
      kind: "error",
      message: "Run rejected",
    });
    expect(readProjectAttachments("thread-1")).toEqual([staged]);
    expect(
      wrapper.get("[data-testid='conversation-reference-chip']").text(),
    ).toContain("Source 0");
    expect(
      wrapper.get("[data-testid='project-attachment-chip']").text(),
    ).toContain("attached.txt");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    const first = submit.mock.calls[0]![2];
    const second = submit.mock.calls[1]![2];
    expect(second.humanMessageId).toBe(first.humanMessageId);
    expect(second.conversationReferences).toEqual(["source-0"]);
    expect(second.additionalKwargs).toEqual(first.additionalKwargs);
    expect(readProjectAttachments("thread-1")).toEqual([]);
    expect(
      wrapper.find("[data-testid='conversation-reference-chip']").exists(),
    ).toBe(false);
    expect(
      wrapper.find("[data-testid='project-attachment-chip']").exists(),
    ).toBe(false);
  });
  it("keeps a reattached revision even when the accepted draft itself has not changed", async () => {
    const file = {
      filename: "file.txt",
      size_bytes: 1,
      virtual_path: "/mnt/file.txt",
      artifact_url: "/a",
      source_document_id: "doc-1",
      source_project_id: "p",
    };
    stageProjectAttachment("thread-1", file);
    let accept!: () => void;
    const send = vi.fn(async (_text, _files, options) => {
      accept = options.onAccepted;
      return true;
    });
    const { wrapper } = mountComposer(send);
    await flushPromises();
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    const newer = stageProjectAttachment("thread-1", file);
    accept();
    await flushPromises();
    expect(readProjectAttachments("thread-1")).toEqual([newer]);
    expect(
      wrapper.get("[data-testid=project-attachment-chip]").text(),
    ).toContain("file.txt");
  });
  it("moves a prepared new conversation's complete draft before route adoption", async () => {
    const { wrapper } = mountComposer(undefined, {
      threadKey: "new",
      targetThreadId: "draft-id",
      projectId: "p",
      ensureThread: async () => "real-id",
    });
    await flushPromises();
    await wrapper.get("textarea").setValue("New conversation draft");
    await open(wrapper);
    await option(wrapper, "Shelf title.txt").trigger("click");
    await flushPromises();
    const key = buildComposerDraftKey({ userId: "u1", threadId: "real-id" });
    expect(readComposerDraft(sessionStorage, key)?.text).toContain(
      "New conversation draft",
    );
    await wrapper.setProps({ threadKey: "real-id", targetThreadId: "real-id" });
    await flushPromises();
    expect(wrapper.get("[role=textbox]").text()).toContain(
      "New conversation draft",
    );
    expect(readProjectAttachments("real-id")).toHaveLength(1);
  });
  it("automatic model normalization never emits an explicit preference update", async () => {
    const { wrapper } = mountComposer(undefined, { context: { mode: "pro" } });
    await flushPromises();
    expect(wrapper.emitted("contextChange")).toBeUndefined();
    expect(wrapper.emitted("resolveContext")?.at(-1)?.[0]).toMatchObject({
      model_name: "reasoner",
      mode: "pro",
    });
    const model = {
      id: "alternate",
      name: "alternate",
      display_name: "Alternate",
      model: "provider",
      supports_thinking: false,
      supports_reasoning_effort: false,
    };
    wrapper
      .findComponent({ name: "ComposerModelSelector" })
      .vm.$emit("select", model);
    await flushPromises();
    expect(wrapper.emitted("contextChange")?.at(-1)?.[0]).toEqual({
      model_name: "alternate",
      mode: "flash",
    });
  });
});

describe("follow-up suppression owned by the composer", () => {
  it("emits while the reference picker is open and restores suggestions on Escape and disposal", async () => {
    const { wrapper } = mountComposer();
    await flushPromises();
    expect(wrapper.emitted("followupsSuppressedChange")?.at(-1)).toEqual([
      false,
    ]);
    await open(wrapper);
    expect(wrapper.emitted("followupsSuppressedChange")?.at(-1)).toEqual([
      true,
    ]);
    await wrapper
      .get("[data-testid=mention-picker] input")
      .trigger("keydown", { key: "Escape" });
    await flushPromises();
    expect(wrapper.emitted("followupsSuppressedChange")?.at(-1)).toEqual([
      false,
    ]);
    await open(wrapper);
    expect(wrapper.emitted("followupsSuppressedChange")?.at(-1)).toEqual([
      true,
    ]);
    wrapper.unmount();
    wrappers.splice(wrappers.indexOf(wrapper), 1);
    expect(wrapper.emitted("followupsSuppressedChange")?.at(-1)).toEqual([
      false,
    ]);
  });
});

it("shows matching disabled affordance while mention pagination is in flight", async () => {
  mocks.documentsHasMore = true;
  mocks.documentsLoadingMore = true;
  const { wrapper } = mountComposer(undefined, { projectId: "project-1" });
  await flushPromises();
  await open(wrapper);
  const more = wrapper
    .findAll("button")
    .find((button) => button.text() === enUS.inputBox.mentionLoadMore)!;
  expect(more.attributes("disabled")).toBeDefined();
  expect(more.classes()).toEqual(
    expect.arrayContaining([
      "disabled:cursor-not-allowed",
      "disabled:opacity-50",
    ]),
  );
  await more.trigger("click");
  expect(mocks.fetchMore).not.toHaveBeenCalled();
});

it("reference highlight changes for moving mouse or pen, not stationary reflow or touch", async () => {
  const { wrapper } = mountComposer();
  await flushPromises();
  await open(wrapper);
  const search = wrapper.get('[role="combobox"]');
  const skill = option(wrapper, "analysis");
  const file = option(wrapper, "Shelf title.txt");
  await search.trigger("keydown", { key: "ArrowDown" });
  expect(search.attributes("aria-activedescendant")).toBe(
    file.attributes("id"),
  );
  await skill.trigger("mouseenter");
  await skill.trigger("pointermove", {
    pointerType: "mouse",
    movementX: 0,
    movementY: 0,
  });
  expect(search.attributes("aria-activedescendant")).toBe(
    file.attributes("id"),
  );
  await skill.trigger("pointermove", {
    pointerType: "mouse",
    movementX: 2,
    movementY: 0,
  });
  expect(search.attributes("aria-activedescendant")).toBe(
    skill.attributes("id"),
  );
  await file.trigger("pointermove", {
    pointerType: "touch",
    movementX: 2,
    movementY: 0,
  });
  expect(search.attributes("aria-activedescendant")).toBe(
    skill.attributes("id"),
  );
  await file.trigger("pointermove", {
    pointerType: "pen",
    movementX: 0,
    movementY: 2,
  });
  expect(search.attributes("aria-activedescendant")).toBe(
    file.attributes("id"),
  );
  expect(file.attributes("aria-selected")).toBe("false");
});
