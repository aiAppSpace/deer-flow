import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

import ChatComposer from "@/components/chat/ChatComposer.vue";
import { enUS } from "@/core/i18n/locales/en-US";
import {
  buildComposerDraftKey,
  writeComposerDraft,
} from "@/core/threads/composer-draft";
import { findSuggestionTemplatePlaceholder } from "@/core/suggestions/placeholders";
import {
  createWorkspaceToastStore,
  workspaceToastKey,
} from "@/core/workspace-shell/toast";

const toastStore = createWorkspaceToastStore();

const mocks = vi.hoisted(() => ({
  loadSkills: vi.fn(),
  loadModels: vi.fn(),
  getUploadLimits: vi.fn(),
  uploadFiles: vi.fn(),
  polishInputDraft: vi.fn(),
  fetchWithAuth: vi.fn(),
}));

const NativeURL = URL;
const createObjectURL = vi.fn((file: File) => `blob:${file.name}`);
const revokeObjectURL = vi.fn();

vi.mock("@/core/skills/api", () => ({ loadSkills: mocks.loadSkills }));
vi.mock("@/core/models/api", () => ({ loadModels: mocks.loadModels }));
vi.mock("@/core/uploads/api", () => ({
  getUploadLimits: mocks.getUploadLimits,
  uploadFiles: mocks.uploadFiles,
}));
vi.mock("@/core/input-polish/api", () => ({
  polishInputDraft: mocks.polishInputDraft,
}));
vi.mock("@/core/api/fetcher", () => ({ fetch: mocks.fetchWithAuth }));

function mountComposer(
  submitMessage = vi.fn(async (_text, _files, options) => {
    options.onAccepted();
    return true;
  }),
  props: { isWelcome?: boolean; showWelcomeSuggestions?: boolean } = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = mount(ChatComposer, {
    props: {
      threadKey: "thread-1",
      targetThreadId: "thread-1",
      userId: "user-1",
      agentName: null,
      streaming: false,
      uploading: false,
      promptHistory: [],
      context: { model_name: "reasoner", mode: "pro" },
      submitMessage,
      ...props,
    },
    global: {
      provide: { [workspaceToastKey as symbol]: toastStore },
      plugins: [[VueQueryPlugin, { queryClient }]],
      stubs: {
        ReferenceAttachment: true,
        ConfettiButton: {
          template:
            '<button type="button" data-effect="confetti-button" @click="$emit(\'click\', $event)"><slot /></button>',
        },
        GoalStatus: true,
      },
    },
  });
  return { wrapper, submitMessage };
}

async function selectFile(
  wrapper: ReturnType<typeof mount>["wrapper"],
  file: File,
) {
  const input = wrapper.get("input[type='file']");
  Object.defineProperty(input.element, "files", {
    configurable: true,
    value: [file],
  });
  await input.trigger("change");
}

describe("composer submission and stale lifecycle", () => {
  beforeEach(() => {
    toastStore.clear();
    sessionStorage.clear();
    vi.stubGlobal("useNuxtApp", () => ({
      $i18n: { t: ref(enUS), locale: ref("en-US") },
    }));
    mocks.loadSkills
      .mockReset()
      .mockResolvedValue([{ name: "enabled", description: "", enabled: true }]);
    mocks.loadModels.mockReset().mockResolvedValue({
      models: [
        {
          id: "reasoner",
          name: "reasoner",
          model: "provider-reasoner",
          display_name: "Reasoner",
          supports_thinking: true,
          supports_reasoning_effort: true,
        },
      ],
      token_usage: { enabled: true },
    });
    mocks.getUploadLimits.mockReset().mockResolvedValue(undefined);
    mocks.uploadFiles.mockReset();
    mocks.polishInputDraft.mockReset();
    mocks.fetchWithAuth.mockReset();
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
    vi.stubGlobal(
      "URL",
      class extends NativeURL {
        static createObjectURL = createObjectURL;
        static revokeObjectURL = revokeObjectURL;
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    // 确认框现在 portal 到 body：不清掉，下一条用例会读到上一条留下的浮层。
    document.body.innerHTML = "";
  });

  it("renders the complete React welcome suggestion row in source order", async () => {
    const { wrapper } = mountComposer(undefined, { isWelcome: true });
    await flushPromises();

    const suggestions = wrapper.get("[data-testid='welcome-suggestions']");
    expect(
      suggestions.findAll("button").map((button) => button.text()),
    ).toEqual(["Surprise", "Write", "Research", "Collect", "Learn", "Create"]);
    expect(suggestions.findAll("svg")).toHaveLength(6);
    expect(wrapper.findAll("[data-slot='suggestions-list']")).toHaveLength(1);
  });

  it("fills a welcome suggestion and selects its placeholder without sending", async () => {
    const submitMessage = vi.fn();
    const { wrapper } = mountComposer(submitMessage, { isWelcome: true });
    await flushPromises();

    const suggestions = wrapper.get("[data-testid='welcome-suggestions']");
    const research = suggestions
      .findAll("button")
      .find((button) => button.text() === "Research");
    expect(research).toBeDefined();
    await research!.trigger("click");
    await flushPromises();

    const textarea = wrapper.get("textarea").element as HTMLTextAreaElement;
    const prompt = enUS.inputBox.suggestions[1]!.prompt;
    const placeholder = findSuggestionTemplatePlaceholder(prompt);
    expect(textarea.value).toBe(prompt);
    expect(textarea.selectionStart).toBe(placeholder?.start);
    expect(textarea.selectionEnd).toBe(placeholder?.end);
    expect(submitMessage).not.toHaveBeenCalled();
  });

  it("opens Create and fills the selected creation prompt without sending", async () => {
    const submitMessage = vi.fn();
    const { wrapper } = mountComposer(submitMessage, { isWelcome: true });
    await flushPromises();

    await wrapper
      .get("[data-testid='welcome-create-trigger']")
      .trigger("click");
    await flushPromises();
    const webpage = document.querySelector<HTMLButtonElement>(
      "[data-testid='welcome-create-webpage']",
    );
    expect(webpage).not.toBeNull();
    webpage!.click();
    await flushPromises();

    const textarea = wrapper.get("textarea").element as HTMLTextAreaElement;
    expect(textarea.value).toBe(
      (enUS.inputBox.suggestionsCreate[0] as { prompt: string }).prompt,
    );
    expect(submitMessage).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("keeps text and files on upload failure", async () => {
    mocks.uploadFiles.mockRejectedValue(new Error("Upload rejected"));
    const { wrapper, submitMessage } = mountComposer();
    await flushPromises();
    await wrapper.get("textarea[name='message']").setValue("Review this file");
    await selectFile(wrapper, new File(["hello"], "notes.txt"));
    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(submitMessage).not.toHaveBeenCalled();
    expect((wrapper.get("textarea").element as HTMLTextAreaElement).value).toBe(
      "Review this file",
    );
    expect(wrapper.text()).toContain("notes.txt");
    expect(toastStore.toasts.value).toEqual([
      { id: expect.any(Number), kind: "error", message: "Upload rejected" },
    ]);
  });

  it("renders an image attachment inside the composer surface with a thumbnail and removable state", async () => {
    const { wrapper } = mountComposer();
    await flushPromises();
    await selectFile(
      wrapper,
      new File(["image"], "cat.png", { type: "image/png" }),
    );
    await flushPromises();

    const surface = wrapper.get("[data-testid='composer-surface']");
    expect(surface.classes()).toContain(
      "has-[[data-slot=input-group-control]:focus-visible]:ring-[3px]",
    );
    expect(
      wrapper.get("[data-testid='composer-bottom-background']").classes(),
    ).toEqual(expect.arrayContaining(["absolute", "-bottom-[17px]", "h-4"]));
    expect(
      wrapper.get("[data-testid='composer-disclaimer']").classes(),
    ).toEqual(
      expect.arrayContaining(["absolute", "top-full", "right-0", "left-0"]),
    );
    expect(wrapper.get("textarea").attributes("data-slot")).toBe(
      "input-group-control",
    );
    expect(surface.find("[data-slot='input-group-body']").exists()).toBe(true);
    expect(surface.find("[data-slot='input-group-footer']").exists()).toBe(
      true,
    );
    const attachment = surface.get("[data-testid='composer-attachment']");
    expect(attachment.text()).toContain("cat.png");
    expect(attachment.get("img").attributes("src")).toBe("blob:cat.png");
    expect(createObjectURL).toHaveBeenCalledTimes(1);

    await attachment.get("button").trigger("click");
    await flushPromises();
    expect(surface.find("[data-testid='composer-attachment']").exists()).toBe(
      false,
    );
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:cat.png");
  });

  it("reuses an uploaded file after send failure and clears only on run acceptance", async () => {
    mocks.uploadFiles.mockResolvedValue({
      success: true,
      files: [
        {
          filename: "notes.txt",
          size: 5,
          path: "/tmp/notes.txt",
          virtual_path: "/mnt/user-data/uploads/notes.txt",
          artifact_url: "/artifact",
        },
      ],
      message: "ok",
      skipped_files: [],
    });
    const submitMessage = vi
      .fn()
      .mockRejectedValueOnce(new Error("Run rejected"))
      .mockImplementationOnce(async (_text, _files, options) => {
        options.onAccepted();
        return true;
      });
    const { wrapper } = mountComposer(submitMessage);
    await flushPromises();
    await wrapper.get("textarea[name='message']").setValue("Review this file");
    await selectFile(wrapper, new File(["hello"], "notes.txt"));

    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(wrapper.text()).toContain("notes.txt");
    expect((wrapper.get("textarea").element as HTMLTextAreaElement).value).toBe(
      "Review this file",
    );

    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(mocks.uploadFiles).toHaveBeenCalledTimes(1);
    expect(submitMessage).toHaveBeenCalledTimes(2);
    expect((wrapper.get("textarea").element as HTMLTextAreaElement).value).toBe(
      "",
    );
    expect(wrapper.text()).not.toContain("notes.txt");
  });

  /*
    上游那个确认框是**真的** `<Dialog>`（input-box.tsx:2765）：portal 出去、有遮罩、
    有焦点陷阱与关闭键，标题/描述由 DialogTitle + DialogDescription 提供。所以这里
    只能从 `document` 上找它——portal 出去的内容不在 wrapper 的子树里。

    本仓原来是 `absolute bottom-full` 的手搓副本：`aria-label` 顶替标题、没有遮罩、
    Escape 关不掉、Tab 会直接走进底下的输入框。它还多渲染一段待发正文，上游没有。
  */
  it("offers append, replace, and cancel in a real dialog, then sends the selected result", async () => {
    const submitMessage = vi.fn(async (_text, _files, options) => {
      options.onAccepted();
      return true;
    });
    const { wrapper } = mountComposer(submitMessage);
    await flushPromises();
    const textarea = wrapper.get("textarea[name='message']");
    await textarea.setValue("Existing draft");

    const offer = (value: string) =>
      (
        wrapper.vm as unknown as { offerFollowup(value: string): void }
      ).offerFollowup(value);
    const dialog = () => document.querySelector('[role="dialog"]');
    /* 关闭键排在 slot **之后**，所以取消/追加/替换仍然是 0/1/2。 */
    const footerButton = (index: number) =>
      dialog()!.querySelectorAll("button")[index] as HTMLButtonElement;

    offer("Suggested question");
    await flushPromises();

    expect(dialog()).not.toBeNull();
    expect(dialog()!.getAttribute("aria-modal")).toBe("true");
    expect(dialog()!.textContent).toContain(enUS.inputBox.followupConfirmTitle);
    expect(dialog()!.textContent).toContain(
      enUS.inputBox.followupConfirmDescription,
    );
    // 上游只画标题和描述，不把待发的那句再念一遍。
    expect(dialog()!.textContent).not.toContain("Suggested question");
    // 手搓副本没有的那颗关闭键。
    expect(document.querySelector('[data-slot="dialog-close"]')).not.toBeNull();

    footerButton(0).click();
    await flushPromises();
    expect(dialog()).toBeNull();
    expect((textarea.element as HTMLTextAreaElement).value).toBe(
      "Existing draft",
    );
    expect(submitMessage).not.toHaveBeenCalled();

    offer("Suggested question");
    await flushPromises();
    footerButton(1).click();
    await flushPromises();
    expect(submitMessage).toHaveBeenLastCalledWith(
      "Existing draft\nSuggested question",
      [],
      expect.objectContaining({ onAccepted: expect.any(Function) }),
    );

    await textarea.setValue("Another draft");
    offer("Replacement");
    await flushPromises();
    footerButton(2).click();
    await flushPromises();
    expect(submitMessage).toHaveBeenLastCalledWith(
      "Replacement",
      [],
      expect.objectContaining({ onAccepted: expect.any(Function) }),
    );
  });

  /*
    关闭键与 Escape 走的是 `update:open`，不是页脚那颗 Cancel（它直接调
    `resolveFollowup('cancel')`）。**这一条是负向验证抓出来的**：把
    `@update:open` 改成空函数，上面那条用例照样全绿——手搓副本时代根本没有这条路径，
    换成真 Dialog 之后它才存在，于是也从来没被测过。
  */
  it("closes from the dialog's own close button, not just the footer", async () => {
    const { wrapper } = mountComposer();
    await flushPromises();
    // 草稿是空的时候 offerFollowup 直接发出去，根本不问——先占住草稿。
    const textarea = wrapper.get("textarea[name='message']");
    await textarea.setValue("Existing draft");
    (
      wrapper.vm as unknown as { offerFollowup(value: string): void }
    ).offerFollowup("Suggested question");
    await flushPromises();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();

    (
      document.querySelector('[data-slot="dialog-close"]') as HTMLElement
    ).click();
    await flushPromises();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    // 关掉不等于发出去：草稿原样留着。
    expect((textarea.element as HTMLTextAreaElement).value).toBe(
      "Existing draft",
    );
  });

  /*
    上游 `showFollowups`（input-box.tsx:1981）里有两条判据只有 composer 自己看得见：
    斜杠目录开着、或者挂着一个技能 chip。本仓的 chip 画在 AgentChat 里，所以这两条
    必须由 composer 发上来，否则目录展开时 chip 会压在它上面。
  */
  it("tells the host when the slash catalog covers the follow-up chips", async () => {
    const { wrapper } = mountComposer();
    await flushPromises();
    expect(wrapper.emitted("followupsSuppressedChange")).toEqual([[false]]);

    const textarea = wrapper.get("textarea[name='message']");
    await textarea.trigger("focus");
    await textarea.setValue("/");
    await flushPromises();
    expect(wrapper.emitted("followupsSuppressedChange")).toEqual([
      [false],
      [true],
    ]);

    await textarea.setValue("");
    await flushPromises();
    expect(wrapper.emitted("followupsSuppressedChange")).toEqual([
      [false],
      [true],
      [false],
    ]);
  });

  it("keeps new-session drafts isolated and rejects a stale accepted callback after route change", async () => {
    mocks.uploadFiles.mockResolvedValue({
      success: true,
      files: [
        {
          filename: "thread-one.txt",
          size: 3,
          path: "/tmp/thread-one.txt",
          virtual_path: "/mnt/user-data/uploads/thread-one.txt",
          artifact_url: "/artifact",
        },
      ],
      message: "ok",
      skipped_files: [],
    });
    let accept!: () => void;
    let resolveSubmit!: (value: boolean) => void;
    const submitMessage = vi.fn(
      (_text, _files, options) =>
        new Promise<boolean>((resolve) => {
          accept = options.onAccepted;
          resolveSubmit = resolve;
        }),
    );
    const { wrapper } = mountComposer(submitMessage);
    await flushPromises();
    const textarea = wrapper.get("textarea[name='message']");
    await textarea.setValue("Thread one draft");
    await selectFile(wrapper, new File(["one"], "thread-one.txt"));
    await wrapper.get("form").trigger("submit");
    expect(submitMessage).toHaveBeenCalledTimes(1);

    await wrapper.setProps({
      threadKey: "thread-2",
      targetThreadId: "thread-2",
    });
    await flushPromises();
    expect((textarea.element as HTMLTextAreaElement).value).toBe("");
    expect(wrapper.text()).not.toContain("thread-one.txt");

    accept();
    resolveSubmit(true);
    await flushPromises();
    await wrapper.setProps({
      threadKey: "thread-1",
      targetThreadId: "thread-1",
    });
    await flushPromises();
    expect((textarea.element as HTMLTextAreaElement).value).toBe(
      "Thread one draft",
    );
    expect(wrapper.text()).toContain("thread-one.txt");
  });

  it("drops duplicate submits while the first request is in flight", async () => {
    let accept!: () => void;
    let resolveSubmit!: (value: boolean) => void;
    const submitMessage = vi.fn(
      (_text, _files, options) =>
        new Promise<boolean>((resolve) => {
          accept = options.onAccepted;
          resolveSubmit = resolve;
        }),
    );
    const { wrapper } = mountComposer(submitMessage);
    await flushPromises();
    await wrapper.get("textarea[name='message']").setValue("Only once");
    await wrapper.get("form").trigger("submit");
    await wrapper.get("form").trigger("submit");
    expect(submitMessage).toHaveBeenCalledTimes(1);
    expect(Object.values(sessionStorage).join("\n")).not.toContain("Only once");

    accept();
    resolveSubmit(true);
    await flushPromises();
    expect((wrapper.get("textarea").element as HTMLTextAreaElement).value).toBe(
      "",
    );
  });

  it("does not recreate an ordinary draft after storage is explicitly cleared", async () => {
    const { wrapper } = mountComposer();
    await flushPromises();
    await wrapper
      .get("textarea[name='message']")
      .setValue("Discard this draft");
    expect(Object.values(sessionStorage).join("\n")).toContain(
      "Discard this draft",
    );

    sessionStorage.clear();
    globalThis.dispatchEvent(new Event("pagehide"));
    wrapper.unmount();
    expect(sessionStorage.length).toBe(0);
  });

  it("does not let a polish result write into another route", async () => {
    let resolvePolish!: (value: {
      rewritten_text: string;
      changed: boolean;
    }) => void;
    mocks.polishInputDraft.mockImplementation(
      () => new Promise((resolve) => (resolvePolish = resolve)),
    );
    const { wrapper } = mountComposer();
    await flushPromises();
    await wrapper.get("textarea[name='message']").setValue("Old route draft");
    await wrapper.get("[data-testid='polish-input-button']").trigger("click");
    await wrapper.setProps({
      threadKey: "thread-2",
      targetThreadId: "thread-2",
    });
    resolvePolish({ rewritten_text: "Stale rewrite", changed: true });
    await flushPromises();

    expect((wrapper.get("textarea").element as HTMLTextAreaElement).value).toBe(
      "",
    );
  });

  it("invalidates polish and goal results when polishing is cancelled or the route changes", async () => {
    let resolvePolish!: (value: {
      rewritten_text: string;
      changed: boolean;
    }) => void;
    mocks.polishInputDraft.mockImplementation(
      () => new Promise((resolve) => (resolvePolish = resolve)),
    );
    let resolveGoal!: (value: Response) => void;
    mocks.fetchWithAuth.mockImplementation(
      () => new Promise<Response>((resolve) => (resolveGoal = resolve)),
    );
    const { wrapper } = mountComposer();
    await flushPromises();
    const textarea = wrapper.get("textarea[name='message']");
    await textarea.setValue("Polish me");
    await wrapper.get("[data-testid='polish-input-button']").trigger("click");

    /*
      润色进行中整个输入框是锁住的，提交/停止按钮也一样——React 的 composerLocked
      就包含 polishingInput。所以放弃一次在途润色的唯一入口是那颗取消按钮，
      不是「停止」。
    */
    expect(
      wrapper.get("button[type='submit']").attributes("disabled"),
    ).toBeDefined();
    await wrapper
      .get("[data-testid='cancel-polish-input-button']")
      .trigger("click");
    resolvePolish({ rewritten_text: "Stale polish", changed: true });
    await flushPromises();
    expect((textarea.element as HTMLTextAreaElement).value).toBe("Polish me");

    wrapper.unmount();
    const { wrapper: goalWrapper } = mountComposer();
    await flushPromises();
    await goalWrapper
      .get("textarea[name='message']")
      .setValue("/goal Ship the release");
    await goalWrapper.get("form").trigger("submit");
    await vi.waitFor(() =>
      expect(mocks.fetchWithAuth).toHaveBeenCalledTimes(1),
    );
    await goalWrapper.setProps({
      threadKey: "thread-2",
      targetThreadId: "thread-2",
    });
    resolveGoal(
      new Response(
        JSON.stringify({ goal: { objective: "Ship the release" } }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    await flushPromises();
    expect(goalWrapper.emitted("goalChange")).toBeUndefined();
    expect(
      (goalWrapper.get("textarea").element as HTMLTextAreaElement).value,
    ).toBe("");
  });

  it("degrades a disabled saved skill to editable slash text after catalog load", async () => {
    writeComposerDraft(
      sessionStorage,
      buildComposerDraftKey({
        userId: "user-1",
        agentName: null,
        threadId: "thread-1",
      }),
      { text: "Analyze it", skillName: "disabled-skill" },
    );
    const { wrapper } = mountComposer();
    await flushPromises();
    expect((wrapper.get("textarea").element as HTMLTextAreaElement).value).toBe(
      "/disabled-skill Analyze it",
    );
  });

  it("waits for the agent default before selecting a catalog fallback model", async () => {
    mocks.loadModels.mockResolvedValue({
      models: [
        {
          id: "flash",
          name: "flash",
          model: "provider-flash",
          display_name: "Flash",
          supports_thinking: false,
          supports_reasoning_effort: false,
        },
        {
          id: "agent-reasoner",
          name: "agent-reasoner",
          model: "provider-reasoner",
          display_name: "Agent Reasoner",
          supports_thinking: true,
          supports_reasoning_effort: true,
        },
      ],
      token_usage: { enabled: true },
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = mount(ChatComposer, {
      props: {
        threadKey: "thread-1",
        targetThreadId: "thread-1",
        userId: "user-1",
        agentName: "researcher",
        defaultModelName: null,
        modelSelectionReady: false,
        streaming: false,
        uploading: false,
        promptHistory: [],
        context: {},
      },
      global: {
        provide: { [workspaceToastKey as symbol]: toastStore },
        plugins: [[VueQueryPlugin, { queryClient }]],
        stubs: {
          ReferenceAttachment: true,
          ConfettiButton: true,
          GoalStatus: true,
        },
      },
    });
    await flushPromises();
    expect(wrapper.emitted("contextChange")).toBeUndefined();

    await wrapper.setProps({ defaultModelName: "agent-reasoner" });
    await flushPromises();
    expect(wrapper.emitted("contextChange")).toBeUndefined();

    await wrapper.setProps({ modelSelectionReady: true });
    await flushPromises();
    expect(wrapper.emitted("contextChange")?.at(-1)?.[0]).toMatchObject({
      model_name: "agent-reasoner",
      mode: "pro",
    });
  });

  /*
    上游 input-box.tsx:2142 在这个下拉列表上写死了
    `aria-label="Skill suggestions"`（未接入词典）。本仓这里原来完全没有
    aria-label。按 `deerflow-untranslated-primitive-names` 的既定规矩，
    Vue 用 `primitives.skillSuggestions` 照抄同一串英文。

    wave 21 起这一屏进了对照取样面（sidebar 场景的 steps 里打一个 `/`），
    所以台账也盯着它了；这条用例留着，因为台账只比两个应用、不回答
    「这串英文是不是照抄的」。**先 focus 再写值**：显示条件里有焦点态，
    `setValue` 不会触发 focus。
  */
  it("names the slash-skill suggestion listbox to match React's hardcoded label", async () => {
    const { wrapper } = mountComposer();
    await flushPromises();

    const textarea = wrapper.get("textarea[name='message']");
    await textarea.trigger("focus");
    await textarea.setValue("/en");
    await flushPromises();

    const listbox = wrapper.get("[role='listbox']");
    expect(listbox.attributes("aria-label")).toBe("Skill suggestions");
  });

  /*
    上游 handleSubmit 的第一支就是「正在流式输出时说一句话再退出」
    （input-box.tsx:1165）。本仓原来是静默 return：回车没反应，用户不知道为什么。
    只有回车走得到这里——按钮在流式态被 onSubmitButtonClick 拦成「停止」。
  */
  it("tells the user to wait instead of submitting during a stream", async () => {
    const { wrapper, submitMessage } = mountComposer(undefined, {
      streaming: true,
    });
    await flushPromises();

    await wrapper.get("textarea[name='message']").setValue("Second question");
    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(submitMessage).not.toHaveBeenCalled();
    expect(toastStore.toasts.value).toEqual([
      {
        id: expect.any(Number),
        kind: "info",
        message: enUS.inputBox.pleaseWaitStreaming,
      },
    ]);
  });

  /*
    未填的建议占位符：上游先 toast.warning 再选中它（input-box.tsx:1071）。
    本仓原来只选中，`inputBox.suggestionPlaceholderRequired` 因此是死词条。
  */
  it("warns about an unresolved suggestion placeholder while selecting it", async () => {
    const { wrapper, submitMessage } = mountComposer();
    await flushPromises();

    const draft = "Summarize [topic] for me";
    const textarea = wrapper.get("textarea[name='message']");
    await textarea.setValue(draft);
    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(submitMessage).not.toHaveBeenCalled();
    expect(toastStore.toasts.value).toEqual([
      {
        id: expect.any(Number),
        // 上游 input-box.tsx:1074 是 `toast.warning`；wave 73 起本仓有 warning 档。
        kind: "warning",
        message: enUS.inputBox.suggestionPlaceholderRequired,
      },
    ]);
    const placeholder = findSuggestionTemplatePlaceholder(draft);
    const element = textarea.element as HTMLTextAreaElement;
    expect(element.selectionStart).toBe(placeholder?.start);
    expect(element.selectionEnd).toBe(placeholder?.end);
  });

  /*
    API 说「没改动」时上游不落草稿、只 toast（input-box.tsx:1656）。本仓原来
    无条件 `input.value = result.rewritten_text`，既不看 `.changed` 也不 trim，
    而且把按钮留在「撤销」——用户为一次什么都没发生的润色拿到一个撤销按钮。
  */
  it("keeps the draft and drops the undo affordance when polishing changed nothing", async () => {
    mocks.polishInputDraft.mockResolvedValue({
      rewritten_text: "  Polish me  ",
      changed: false,
    });
    const { wrapper } = mountComposer();
    await flushPromises();

    const textarea = wrapper.get("textarea[name='message']");
    await textarea.setValue("Polish me");
    await wrapper.get("[data-testid='polish-input-button']").trigger("click");
    await flushPromises();

    expect((textarea.element as HTMLTextAreaElement).value).toBe("Polish me");
    expect(toastStore.toasts.value).toEqual([
      {
        id: expect.any(Number),
        kind: "info",
        message: enUS.inputBox.inputPolishNoChanges,
      },
    ]);
    /*
      **钉可访问名，不钉可见文字。** 上游这颗键三态都只有一颗图标
      （input-box.tsx:2354），名字来自 aria-label；本仓原来多渲染了一段
      「优化输入」，那段文字本身就是落差，拿它当断言等于把落差写进合同。
    */
    const button = wrapper.get("[data-testid='polish-input-button']");
    expect(button.attributes("aria-label")).toBe(enUS.inputBox.inputPolish);
    expect(button.text()).toBe("");
    expect(button.find(".lucide-sparkles").exists()).toBe(true);
  });

  it("applies a trimmed rewrite and offers undo when polishing did change the draft", async () => {
    mocks.polishInputDraft.mockResolvedValue({
      rewritten_text: "  Polished draft  ",
      changed: true,
    });
    const { wrapper } = mountComposer();
    await flushPromises();

    const textarea = wrapper.get("textarea[name='message']");
    await textarea.setValue("Polish me");
    await wrapper.get("[data-testid='polish-input-button']").trigger("click");
    await flushPromises();

    expect((textarea.element as HTMLTextAreaElement).value).toBe(
      "Polished draft",
    );
    expect(toastStore.toasts.value).toEqual([]);
    const button = wrapper.get("[data-testid='polish-input-button']");
    expect(button.attributes("aria-label")).toBe(enUS.inputBox.inputPolishUndo);
    expect(button.text()).toBe("");
    // 上游撤销态换的是 Undo2Icon，不是继续画 SparklesIcon。
    expect(button.find(".lucide-undo-2").exists()).toBe(true);
    expect(button.find(".lucide-sparkles").exists()).toBe(false);
  });

  /*
    **这一条钉的是一次数据丢失。** 上游 input-box.tsx:1339 的撤销判据里有一条
    「输入框现在的文本仍逐字等于那一版改写」，本仓原来只看「这一轮润色发生过」。
    差别在用户润色完接着往下打字的时候：那颗键仍写着「撤销优化」，按下去会把
    **改写之后新输入的内容一起**换回润色前那一版，而且没有二次撤销。
  */
  it("retires the undo affordance once the polished draft is edited", async () => {
    mocks.polishInputDraft.mockResolvedValue({
      rewritten_text: "Polished draft",
      changed: true,
    });
    const { wrapper } = mountComposer();
    await flushPromises();

    const textarea = wrapper.get("textarea[name='message']");
    await textarea.setValue("Polish me");
    await wrapper.get("[data-testid='polish-input-button']").trigger("click");
    await flushPromises();

    await textarea.setValue("Polished draft, and then some");
    await flushPromises();

    const button = wrapper.get("[data-testid='polish-input-button']");
    expect(button.attributes("aria-label")).toBe(enUS.inputBox.inputPolish);
    expect(button.find(".lucide-undo-2").exists()).toBe(false);

    // 按下去不该回滚：这一颗现在是「再润色一次」。
    await button.trigger("click");
    await flushPromises();
    expect((textarea.element as HTMLTextAreaElement).value).not.toBe(
      "Polish me",
    );

    // 改回一模一样的那一版，撤销又回来——它是无状态比较，不是一次性开关。
    await textarea.setValue("Polished draft");
    await flushPromises();
    expect(
      wrapper
        .get("[data-testid='polish-input-button']")
        .attributes("aria-label"),
    ).toBe(enUS.inputBox.inputPolishUndo);
  });

  /*
    润色**进行中**的那一屏。对照台账看不见它：胶囊只在一次请求飞在路上的那几百
    毫秒里存在，而对照场景没有一个停在那个瞬间；`sampleGeometry` 又只量场景的
    落点锚（线索 137）。三条都是那几百毫秒里才分叉的：

    ① 上游 input-box.tsx:2236 的胶囊是 `role="status" aria-live="polite"`，
       本仓原来两个都没有——润色是个没有其它可见反馈的异步动作，读屏器用户
       此前听不到它开始、也听不到它结束。
    ② 取消键在**胶囊里**，不是在页脚顶替优化键。
    ③ 页脚那颗优化键原地不动，只换成转圈图标。
  */
  it("announces the in-flight polish and keeps the toolbar button in place", async () => {
    // 请求一直飞着，把组件按在「润色中」这一态上。
    mocks.polishInputDraft.mockReturnValue(new Promise(() => {}));
    const { wrapper } = mountComposer();
    await flushPromises();

    await wrapper.get("textarea[name='message']").setValue("Polish me");
    await wrapper.get("[data-testid='polish-input-button']").trigger("click");
    await flushPromises();

    const pill = wrapper.get("[role='status']");
    expect(pill.attributes("aria-live")).toBe("polite");
    expect(pill.text()).toContain(enUS.inputBox.inputPolishing);
    expect(pill.find(".lucide-loader-circle").exists()).toBe(true);

    // 取消键在胶囊里，而且是图标键（上游只放一颗 XIcon）。
    const cancel = pill.get("[data-testid='cancel-polish-input-button']");
    expect(cancel.attributes("aria-label")).toBe(
      enUS.inputBox.inputPolishCancel,
    );
    expect(cancel.text()).toBe("");

    // 页脚那颗还在，只是换了图标并禁用。
    const button = wrapper.get("[data-testid='polish-input-button']");
    expect(button.attributes("disabled")).toBeDefined();
    expect(button.find(".lucide-loader-circle").exists()).toBe(true);
    expect(button.find(".lucide-sparkles").exists()).toBe(false);

    // 点一下取消，胶囊消失、优化键回到初始态。
    await cancel.trigger("click");
    await flushPromises();
    expect(wrapper.find("[role='status']").exists()).toBe(false);
    expect(
      wrapper
        .get("[data-testid='polish-input-button']")
        .attributes("aria-label"),
    ).toBe(enUS.inputBox.inputPolish);
  });

  /*
    `/goal <objective>` 写到上限的 90% 之后，工具条右侧出现 length/max 计数器
    （上游 input-box.tsx:2649），超限时换成 text-destructive。
  */
  it("shows the goal length counter only near the limit and flags going over", async () => {
    const { wrapper } = mountComposer();
    await flushPromises();

    const textarea = wrapper.get("textarea[name='message']");
    await textarea.setValue(`/goal ${"a".repeat(3599)}`);
    expect(wrapper.find("[data-testid='goal-length-counter']").exists()).toBe(
      false,
    );

    await textarea.setValue(`/goal ${"a".repeat(3600)}`);
    const counter = wrapper.get("[data-testid='goal-length-counter']");
    expect(counter.text()).toBe("3600/4000");
    expect(counter.attributes("aria-label")).toBe(
      "Goal length: 3600/4000 characters",
    );
    expect(counter.classes()).toContain("text-muted-foreground");

    await textarea.setValue(`/goal ${"a".repeat(4001)}`);
    expect(
      wrapper.get("[data-testid='goal-length-counter']").classes(),
    ).toContain("text-destructive");
  });
});
