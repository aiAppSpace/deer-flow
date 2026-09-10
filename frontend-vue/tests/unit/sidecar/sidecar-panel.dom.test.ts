import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, nextTick, ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SidecarPanel from "@/components/workspace/sidecar/SidecarPanel.vue";
import HumanInputCard from "@/components/chat/HumanInputCard.vue";
import { enUS } from "@/core/i18n/locales/en-US";
import type { Message } from "@/core/types/message";
import {
  createWorkspaceToastStore,
  workspaceToastKey,
} from "@/core/workspace-shell/toast";

const toastStore = createWorkspaceToastStore();

const mocks = vi.hoisted(() => ({
  sendMessage: vi.fn(),
  loadModels: vi.fn(),
}));

vi.mock("@/core/models/api", () => ({ loadModels: mocks.loadModels }));
vi.mock("@/composables/useThreadStream", async () => {
  const { ref: vueRef } = await import("vue");
  return {
    useThreadStream: () => ({
      messages: vueRef([]),
      isStreaming: vueRef(false),
      isUploading: vueRef(false),
      isHistoryLoading: vueRef(false),
      error: vueRef(null),
      sendMessage: mocks.sendMessage,
    }),
  };
});

const MessageListStub = defineComponent({
  name: "MessageList",
  props: {
    threadId: { type: String, default: null },
    threadError: { default: null },
    submitHumanInput: { type: Function, default: undefined },
  },
  template: '<div data-testid="message-list-stub" />',
});

function makeSession() {
  const input = ref("");
  return {
    threadId: ref<string | null>("sidecar-1"),
    input,
    selectedFiles: ref<File[]>([]),
    submissionPending: ref(false),
    deleting: ref(false),
    submissionError: ref<unknown>(null),
    fileError: ref(""),
    errorMessage: ref(""),
    phase: ref("ready"),
    ready: ref(true),
    stream: {
      messages: ref([]),
      isStreaming: ref(false),
      isHistoryLoading: ref(false),
      error: ref<unknown>(new Error("sidecar run failed")),
    },
    submit: vi.fn(async () => true),
    submitHumanInput: vi.fn(async () => true),
    setInput: vi.fn((value: string) => {
      input.value = value;
    }),
    addFiles: vi.fn(),
    removeFile: vi.fn(),
    deleteThread: vi.fn(async () => true),
  };
}

/*
  面板通过 useModels 取模型目录（与 ChatComposer / AgentChat 同一个 Vue Query
  owner），所以挂载必须带上 provider——否则 useQuery 拿不到 client，整棵树在
  setup 阶段就抛。`retry: false` + mock 掉的 loadModels 保证它不会真的去连 :3000。
*/
function queryPlugins() {
  return [
    [
      VueQueryPlugin,
      {
        queryClient: new QueryClient({
          defaultOptions: { queries: { retry: false } },
        }),
      },
    ] as const,
  ];
}

function mountPanel(
  session = makeSession(),
  references: unknown[] = [],
  /** 只有档位相关的用例需要换 mode；其余照旧拿 pro。 */
  context: Record<string, unknown> = { model_name: "reasoner", mode: "pro" },
) {
  const wrapper = mount(SidecarPanel, {
    props: {
      references,
      context,
      active: true,
      session,
    },
    global: {
      provide: { [workspaceToastKey as symbol]: toastStore },
      plugins: queryPlugins() as never,
      stubs: {
        MessageList: MessageListStub,
        ReferenceAttachment: true,
      },
    },
  });
  return { wrapper, session };
}

describe("SidecarPanel session adapter", () => {
  beforeEach(() => {
    mocks.sendMessage.mockReset();
    mocks.loadModels.mockReset().mockResolvedValue({ models: [] });
    vi.stubGlobal("useNuxtApp", () => ({
      $i18n: { t: ref(enUS), locale: ref("en-US") },
    }));
  });

  it("passes the sidecar thread, run error, and HIL submitter to MessageList", async () => {
    const { wrapper, session } = mountPanel();
    const messageList = wrapper.findComponent(MessageListStub);

    expect(messageList.props("threadId")).toBe("sidecar-1");
    expect(messageList.props("threadError")).toBe(session.stream.error.value);
    expect(messageList.props("submitHumanInput")).toBe(
      session.submitHumanInput,
    );
  });

  it("uses the session draft, preserves IME composition, and submits once after composition", async () => {
    const { wrapper, session } = mountPanel();
    const textarea = wrapper.get("textarea[name='message']");
    await textarea.setValue("输入中的问题");
    expect(session.input.value).toBe("输入中的问题");

    await textarea.trigger("compositionstart");
    await textarea.trigger("keydown", { key: "Enter", isComposing: true });
    expect(session.submit).not.toHaveBeenCalled();

    await textarea.trigger("compositionend");
    await textarea.trigger("keydown", { key: "Enter" });
    expect(session.submit).toHaveBeenCalledTimes(1);
  });

  it("forwards selected files, exposes removable chips, and reports busy state", async () => {
    const session = makeSession();
    const file = new File(["hello"], "notes.txt");
    session.selectedFiles.value = [file];
    session.submissionPending.value = true;
    const { wrapper } = mountPanel(session);

    expect(wrapper.get("form").attributes("aria-busy")).toBe("true");
    // readonly，不是 disabled（见 tests/guards/textarea-lock.test.ts）。
    expect(wrapper.get("textarea[name='message']").attributes("readonly")).toBe(
      "",
    );
    expect(
      wrapper.get("textarea[name='message']").attributes("aria-disabled"),
    ).toBe("true");
    expect(wrapper.get("button[type='submit']").attributes("disabled")).toBe(
      "",
    );
    expect(wrapper.text()).toContain("notes.txt");
    await wrapper.get("button[aria-label='Remove notes.txt']").trigger("click");
    expect(session.removeFile).toHaveBeenCalledWith(file);

    const input = wrapper.get("input[type='file']");
    Object.defineProperty(input.element, "files", {
      configurable: true,
      value: [file],
    });
    await input.trigger("change");
    expect(session.addFiles).toHaveBeenCalledWith([file]);

    session.submissionPending.value = false;
    session.stream.isStreaming.value = true;
    await nextTick();
    expect(wrapper.get("form").attributes("aria-busy")).toBe("true");
    // readonly，不是 disabled（见 tests/guards/textarea-lock.test.ts）。
    expect(wrapper.get("textarea[name='message']").attributes("readonly")).toBe(
      "",
    );
    expect(
      wrapper.get("textarea[name='message']").attributes("aria-disabled"),
    ).toBe("true");
  });

  /*
    **发送中要转圈。**

    上游 sidecar-panel.tsx:653 给 `PromptInputSubmit` 传的 status 是
    `thread.isLoading || creatingThread || queuedSubmit ? "submitted" : "ready"`，
    而 `submitted` 那一支画的是 `<Loader2Icon className="size-4 animate-spin" />`。
    wave 71 在 ChatComposer 里记过一句「submitted 分支够不着」——那只对
    chat-page.tsx 那个调用点成立，**sidecar 这个调用点传的就是它**。
    改走 primitive 之前这颗键恒为箭头：点下去之后没有任何进行中的反馈。

    钉 `animate-spin` 而不是钉图标组件名：用户看见的是"它在转"。
  */
  it("swaps the submit arrow for a spinner while a submission is in flight", async () => {
    const session = makeSession();
    const { wrapper } = mountPanel(session);
    const submit = () => wrapper.get("button[type='submit']");

    expect(submit().find(".animate-spin").exists()).toBe(false);

    session.submissionPending.value = true;
    await nextTick();
    expect(submit().find(".animate-spin").exists()).toBe(true);

    session.submissionPending.value = false;
    session.stream.isStreaming.value = true;
    await nextTick();
    expect(submit().find(".animate-spin").exists()).toBe(true);

    session.stream.isStreaming.value = false;
    await nextTick();
    expect(submit().find(".animate-spin").exists()).toBe(false);
  });

  it("uses the shared composer surface as the single focus-ring owner", () => {
    const { wrapper } = mountPanel();
    const surface = wrapper.get("[data-testid='sidecar-composer-surface']");
    expect(surface.classes()).toContain(
      "has-[[data-slot=input-group-control]:focus-visible]:ring-[3px]",
    );
    expect(
      wrapper.get("textarea[name='message']").attributes("data-slot"),
    ).toBe("input-group-control");
    expect(surface.find("[data-slot='input-group-body']").exists()).toBe(true);
    // footer 也是 InputGroupAddon，必须带 role="group"（见 SidecarPanel.vue 那条注释）。
    const footer = surface.get("[data-slot='input-group-footer']");
    expect(footer.attributes("role")).toBe("group");
    /*
      上游 sidecar 的 composer **没有**免责声明——那一段只在主输入框上
      （chat-page.tsx）。本仓原来两处都画，于是 sidecar 面板的可访问性树里多出
      一个 React 没有的 paragraph。这条断言反过来钉住「不许再长回来」。
    */
    expect(
      wrapper.find("[data-testid='sidecar-composer-disclaimer']").exists(),
    ).toBe(false);
    expect(wrapper.text()).not.toContain(enUS.inputBox.disclaimer);
  });

  /*
    可访问名来自 **placeholder**，不是 aria-label。上游的 PromptInputTextarea 只给
    placeholder（prompt-input.tsx:963 那一支没有 aria-label），于是读屏器念的是
    「Ask a deeper follow-up...」——带省略号。本仓原来额外挂了一个
    `sidecar.inputLabel`（"Ask a deeper follow-up"，没有省略号，而且是本仓自造的
    词条，上游词典里根本没有这一项），aria-label 一旦存在就顶掉 placeholder，
    两个应用于是念出两个名字。这条用例保留原来的意图——名字要在面板隐藏再打开
    之后保持不变——只是把被测的载体换成 placeholder。
  */
  it("names the composer by its placeholder, stably across hide and reopen", async () => {
    const { wrapper } = mountPanel();
    const textarea = wrapper.get("textarea[name='message']");
    expect(textarea.attributes("aria-label")).toBeUndefined();
    expect(textarea.attributes("placeholder")).toBe(enUS.sidecar.placeholder);
    await wrapper.setProps({ active: false });
    await wrapper.setProps({ active: true });
    expect(
      wrapper.get("textarea[name='message']").attributes("placeholder"),
    ).toBe(enUS.sidecar.placeholder);
  });

  it("runs required-form, false-checkbox, retry, thread-error, and refresh HIL through the sidecar session", async () => {
    const request = {
      version: 2,
      kind: "human_input_request",
      source: "ask_clarification",
      request_id: "sidecar-request-1",
      question: "Confirm delivery",
      input_mode: "form",
      fields: [
        { name: "owner", label: "Owner", type: "text", required: true },
        {
          name: "approved",
          label: "Approved",
          type: "checkbox",
          required: false,
        },
      ],
    } as const;
    const requestMessage = {
      id: "sidecar-tool-1",
      type: "tool",
      name: "ask_clarification",
      content: "Waiting for clarification",
      artifact: { human_input: request },
    } as unknown as Message;
    const session = makeSession();
    session.stream.messages.value = [requestMessage];
    session.submitHumanInput
      .mockResolvedValueOnce(false)
      .mockResolvedValue(true);
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const wrapper = mount(SidecarPanel, {
      props: {
        references: [],
        context: { model_name: "reasoner", mode: "pro" },
        active: true,
        session,
      },
      global: {
        provide: { [workspaceToastKey as symbol]: toastStore },
        plugins: [[VueQueryPlugin, { queryClient }]],
        stubs: {
          StreamMarkdown: { template: "<div />" },
          ReferenceAttachment: true,
          WorkspaceChangesBadge: true,
          SubtaskCard: true,
        },
      },
    });
    const card = wrapper.getComponent(HumanInputCard);

    // 走表单 submit，不用 button click：happy-dom 只对真 MouseEvent 跑
    // activation behavior，VTU 的 trigger("click") 派发的是普通 Event（坑 76）。
    await card.get("form").trigger("submit");
    expect(card.get("[role='alert']").text()).toContain("required");
    expect(session.submitHumanInput).not.toHaveBeenCalled();

    const owner = card.get("input[type='text']");
    await owner.setValue("Dana");
    await card.get("form").trigger("submit");
    await flushPromises();
    expect(session.submitHumanInput).toHaveBeenCalledWith(
      expect.objectContaining({ request_id: "sidecar-request-1" }),
      expect.objectContaining({
        value:
          'Owner: Dana; Approved: no [values: {"owner":"Dana","approved":false}]',
      }),
    );
    expect(card.props("pending")).toBe(false);
    expect((owner.element as HTMLInputElement).value).toBe("Dana");

    await card.get("form").trigger("submit");
    await flushPromises();
    expect(card.props("pending")).toBe(true);
    session.stream.error.value = new Error("sidecar run failed again");
    await nextTick();
    expect(card.props("pending")).toBe(false);
    expect((owner.element as HTMLInputElement).value).toBe("Dana");

    await card.get("form").trigger("submit");
    await flushPromises();
    const acceptedResponse = session.submitHumanInput.mock.calls.at(-1)?.[1];
    session.stream.messages.value = [
      requestMessage,
      {
        id: "sidecar-response-1",
        type: "human",
        content: "Hidden response",
        additional_kwargs: {
          hide_from_ui: true,
          human_input_response: acceptedResponse,
        },
      } as Message,
    ];
    await flushPromises();
    expect(wrapper.text()).toContain("Answered:");
    // 答过之后表单仍然挂着（禁用），不是被一行文字替换掉。
    const answeredOwner = wrapper.get("input[type='text']");
    expect(answeredOwner.attributes("disabled")).toBeDefined();
  });

  /*
    头部这一簇钉的是 sidecar-panel.tsx:527 的四条合同。对照场景 `sidecar-chat`
    只走得到**草稿态**（还没有 sidecar thread），所以「有 thread 时关闭按钮还在不在」
    这条只能在这里钉——而它恰好是原来那处 v-if/v-else 造成的功能缺失：
    本仓一旦建出 thread，面板上就再也没有关闭按钮了。
  */
  it("always offers close, and only offers delete once a thread exists", async () => {
    const withThread = mountPanel();
    expect(
      withThread.wrapper.find('[data-testid="sidecar-close-button"]').exists(),
    ).toBe(true);
    expect(
      withThread.wrapper.find('[data-testid="sidecar-delete-button"]').exists(),
    ).toBe(true);

    const draftSession = makeSession();
    draftSession.threadId.value = null;
    const draft = mountPanel(draftSession);
    expect(
      draft.wrapper.find('[data-testid="sidecar-close-button"]').exists(),
    ).toBe(true);
    expect(
      draft.wrapper.find('[data-testid="sidecar-delete-button"]').exists(),
    ).toBe(false);
  });

  it("names the close button with common.close, not the side-chat label", () => {
    const { wrapper } = mountPanel();
    const close = wrapper.get('[data-testid="sidecar-close-button"]');
    expect(close.attributes("aria-label")).toBe(enUS.common.close);
    expect(close.attributes("aria-label")).not.toBe(enUS.sidecar.close);
  });

  it("closes an existing side chat but discards a draft that has no thread", async () => {
    const withThread = mountPanel();
    await withThread.wrapper
      .get('[data-testid="sidecar-close-button"]')
      .trigger("click");
    expect(withThread.wrapper.emitted("close")).toHaveLength(1);
    expect(withThread.wrapper.emitted("discard")).toBeUndefined();

    const draftSession = makeSession();
    draftSession.threadId.value = null;
    const draft = mountPanel(draftSession);
    await draft.wrapper
      .get('[data-testid="sidecar-close-button"]')
      .trigger("click");
    expect(draft.wrapper.emitted("discard")).toHaveLength(1);
    expect(draft.wrapper.emitted("close")).toBeUndefined();
  });

  it("titles the header with sidecar.title and subtitles it three ways", async () => {
    const withThread = mountPanel();
    expect(withThread.wrapper.text()).toContain(enUS.sidecar.title);
    // 原来这里画的是 emptyTitle——同一颗面板在两个应用里叫的名字不一样。
    expect(withThread.wrapper.text()).toContain(enUS.sidecar.continuing);

    const draftSession = makeSession();
    draftSession.threadId.value = null;
    const draft = mountPanel(draftSession);
    expect(draft.wrapper.text()).toContain(enUS.sidecar.noContext);
    expect(draft.wrapper.text()).not.toContain(enUS.sidecar.continuing);

    const quoted = mountPanel(makeSession(), [
      { id: 1, context: { content: "a" } },
      { id: 2, context: { content: "b" } },
    ]).wrapper;
    expect(quoted.text()).toContain("2 selected text fragments");
    expect(quoted.text()).not.toContain(enUS.sidecar.continuing);
  });

  it("shows the empty state instead of the message list until a thread exists", () => {
    const withThread = mountPanel();
    expect(withThread.wrapper.findComponent(MessageListStub).exists()).toBe(
      true,
    );
    expect(withThread.wrapper.text()).not.toContain(
      enUS.sidecar.emptyDescription,
    );

    const draftSession = makeSession();
    draftSession.threadId.value = null;
    const draft = mountPanel(draftSession);
    expect(draft.wrapper.findComponent(MessageListStub).exists()).toBe(false);
    expect(draft.wrapper.text()).toContain(enUS.sidecar.emptyTitle);
    expect(draft.wrapper.text()).toContain(enUS.sidecar.emptyDescription);
  });
});

/*
  sidecar 的模式菜单与主输入框是同一份产品决策，上游两处逐字同构
  （sidecar-panel.tsx 的 SidecarModeMenu 与 input-box.tsx 的模式菜单）。
  本仓这一支原来是 w-32 的裸标签列表：同一个下拉在主输入框里读得出
  「Flash 快速高效……」，在 sidecar 里只读得出「Flash」。
*/
describe("SidecarPanel 模式菜单", () => {
  beforeEach(() => {
    mocks.sendMessage.mockReset();
    vi.stubGlobal("useNuxtApp", () => ({
      $i18n: { t: ref(enUS), locale: ref("en-US") },
    }));
  });

  async function openModeMenu(supportsThinking: boolean) {
    mocks.loadModels.mockReset().mockResolvedValue({
      models: [
        {
          id: "reasoner",
          name: "reasoner",
          model: "Reasoner",
          display_name: "Reasoner",
          supports_thinking: supportsThinking,
        },
      ],
    });
    const { wrapper } = mountPanel();
    await flushPromises();
    await wrapper.get('[data-testid="sidecar-mode-trigger"]').trigger("click");
    await flushPromises();
    return wrapper;
  }

  function radioItems() {
    return [
      ...document.querySelectorAll<HTMLElement>('[role="menuitemradio"]'),
    ];
  }

  it("titles the group and spells out every mode", async () => {
    const wrapper = await openModeMenu(true);

    const menu = document.querySelector('[role="menu"]');
    expect(menu?.textContent).toContain(enUS.inputBox.mode);
    expect(radioItems()).toHaveLength(4);
    expect(radioItems()[0]!.textContent).toContain(
      enUS.inputBox.flashModeDescription,
    );
    expect(radioItems()[3]!.textContent).toContain(
      enUS.inputBox.ultraModeDescription,
    );
    // 标题不是菜单项：它不该进方向键序列。
    expect(menu?.querySelectorAll('[role="menuitem"]')).toHaveLength(0);
    wrapper.unmount();
    document.body.innerHTML = "";
  });

  /*
    模型不支持 thinking 时只留 Flash。selectMode 会把别的档位经 resolvedMode
    拉回 flash，所以列出来的是一个点了不肯 checked 的 radio。两边同改。
  */
  it("lists only flash when the model cannot think", async () => {
    const wrapper = await openModeMenu(false);

    expect(radioItems()).toHaveLength(1);
    expect(radioItems()[0]!.textContent).toContain(enUS.inputBox.flashMode);
    wrapper.unmount();
    document.body.innerHTML = "";
  });

  /*
    每一档一个图标、只有 ultra 是金色，与上游 sidecar-panel.tsx:770 及主输入框那份
    同源。**对照台账看不见这一簇**：lucide 的 svg 不进可访问性树，菜单也不是几何
    锚点，`.golden-text` 换的是 -webkit-text-fill-color 连颜色取样都读不到。

    这里同时是**复合输入框那一份的真 DOM 代理**：happy-dom 下 ChatComposer 的
    dropdown 打不开（理由写在 composer-mode-icons.dom.test.ts），两处的模板是同一份
    写法，菜单项这一层就在这里守。

    图标身份不按 lucide 的内部 class 断言——那是组件库实现细节。断言的是四个 svg
    各不相同，加上产品自己写的两处着色。
  */
  it("paints the mode menu with one icon per mode and gold only on ultra", async () => {
    const wrapper = await openModeMenu(true);
    const items = radioItems();

    /*
      每一项里有**两个** svg：primitive 自带的选中勾在前面，档位图标在后面。
      按 `mr-2` 取的是档位那一个——拿 querySelector("svg") 会一直拿到那个勾，
      于是「四个图标各不相同」变成「四个勾都一样」，用例恒红或恒绿都不测产品。
    */
    const glyphs = items.map((item) => {
      const icon = item.querySelector('svg[class*="mr-2"]');
      expect(icon, `${item.textContent} has no mode icon`).not.toBeNull();
      expect(icon!.getAttribute("class")).toContain("mr-2 size-4");
      return icon!.innerHTML;
    });
    expect(new Set(glyphs).size).toBe(4);

    // 夹具的 context 是 pro，所以选中的是 pro 那一条。
    const selected = items.find(
      (item) => item.getAttribute("data-state") === "checked",
    )!;
    expect(selected.textContent).toContain(enUS.inputBox.proMode);
    expect(selected.className).toContain("text-accent-foreground");

    const ultra = items.find((item) =>
      item.textContent?.startsWith(enUS.inputBox.ultraMode),
    )!;
    // 没被选中时 ultra 不上金色——金色是「当前档位」的标记，不是这一行的装饰。
    expect(ultra.className).toContain("text-muted-foreground/65");
    expect(ultra.querySelector(".golden-text")).toBeNull();

    wrapper.unmount();
    document.body.innerHTML = "";
  });

  it("turns ultra gold once it is the active mode", async () => {
    mocks.loadModels.mockReset().mockResolvedValue({
      models: [
        {
          id: "reasoner",
          name: "reasoner",
          model: "Reasoner",
          display_name: "Reasoner",
          supports_thinking: true,
        },
      ],
    });
    const { wrapper } = mountPanel(makeSession(), [], {
      model_name: "reasoner",
      mode: "ultra",
    });
    await flushPromises();

    const trigger = wrapper.get('[data-testid="sidecar-mode-trigger"]');
    expect(trigger.get("svg").classes()).toContain("text-[#dabb5e]");
    expect(trigger.get("div:nth-child(2)").classes()).toContain("golden-text");

    await trigger.trigger("click");
    await flushPromises();

    const ultra = radioItems().find((item) =>
      item.textContent?.startsWith(enUS.inputBox.ultraMode),
    )!;
    expect(ultra.className).toContain("text-accent-foreground");
    expect(ultra.querySelector(".golden-text")).not.toBeNull();
    expect(
      ultra.querySelector('svg[class*="mr-2"]')!.getAttribute("class"),
    ).toContain("text-[#dabb5e]");

    wrapper.unmount();
    document.body.innerHTML = "";
  });
});
