/*
  【文件职责】     守住输入框的只读形状、语音按钮锁定与推理选项的实际交互。
  【架构位置】     测试
  【主要导出】     无
  【依赖关系】     ChatComposer.vue
  【边界与注意】   挂载实际 ChatComposer，检查渲染、原生禁用态、颜色与命令；
                   语音识别和会话生命周期由各自 owner 的独立回归负责。
*/

import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computed, h, ref, type VNode } from "vue";

import ChatComposer from "@/components/chat/ChatComposer.vue";
import { enUS } from "@/core/i18n/locales/en-US";
import {
  createWorkspaceToastStore,
  workspaceToastKey,
} from "@/core/workspace-shell/toast";

const toastStore = createWorkspaceToastStore();
const wrappers: ReturnType<typeof mount>[] = [];
const clients: QueryClient[] = [];

const mocks = vi.hoisted(() => ({
  loadSkills: vi.fn(),
  loadModels: vi.fn(),
  getUploadLimits: vi.fn(),
  uploadFiles: vi.fn(),
  polishInputDraft: vi.fn(),
  fetchWithAuth: vi.fn(),
  voiceSupported: true,
  toggleVoice: vi.fn(),
}));

// The consumer must forward its lock even when the client voice owner supports
// speech. The real voice owner has separate recognition/lifecycle regressions.
vi.mock("@/composables/useComposerVoice", () => ({
  useComposerVoice: () => ({
    listening: ref(false),
    supported: computed(() => mocks.voiceSupported),
    toggle: mocks.toggleVoice,
    stop: vi.fn(),
  }),
}));

vi.mock("@/core/features/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/core/features/api")>()),
  fetchConversationReferencesCapability: vi.fn(async () => ({
    enabled: false,
    maxReferences: 0,
  })),
}));

// These tests own composer presentation/commands, while session behavior has its own suite.
vi.mock("@/composables/useAuthSession", () => ({
  useAuthSession: () => ({
    session: ref({ tag: "unauthenticated" }),
    isFetching: ref(false),
    refresh: vi.fn(),
  }),
}));

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
  props: Record<string, unknown>,
  slots: Record<string, (props: { disabled: boolean }) => VNode> = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  clients.push(queryClient);
  const wrapper = mount(ChatComposer, {
    attachTo: document.body,
    slots,
    props: {
      threadKey: "demo-thread",
      targetThreadId: "demo-thread",
      userId: null,
      agentName: null,
      streaming: false,
      uploading: false,
      promptHistory: [],
      context: {},
      /* 案例页上 agentResolved 恒为 true（没有 agentName），照抄。 */
      modelSelectionReady: true,
      submitMessage: vi.fn(async () => true),
      ...props,
    },
    global: {
      provide: { [workspaceToastKey as symbol]: toastStore },
      plugins: [
        [
          VueQueryPlugin,
          {
            queryClient,
          },
        ],
      ],
      stubs: { ReferenceAttachment: true, GoalStatus: true },
    },
  });
  wrappers.push(wrapper);
  return wrapper;
}

beforeEach(() => {
  sessionStorage.clear();
  vi.stubGlobal("useNuxtApp", () => ({
    $i18n: { t: ref(enUS), locale: ref("en-US") },
  }));
  mocks.loadSkills.mockReset().mockResolvedValue([]);
  mocks.loadModels.mockReset().mockResolvedValue({
    models: [
      {
        id: "scenario",
        name: "scenario",
        model: "provider-scenario",
        display_name: "Scenario Model",
        supports_thinking: true,
        supports_reasoning_effort: true,
      },
    ],
    token_usage: { enabled: true },
  });
  mocks.getUploadLimits.mockReset().mockResolvedValue({
    max_files: 10,
    max_file_size: 100 * 1024 * 1024,
    max_total_size: 100 * 1024 * 1024,
  });
  mocks.uploadFiles.mockReset();
  mocks.polishInputDraft.mockReset();
  mocks.fetchWithAuth.mockReset();
  mocks.voiceSupported = true;
  mocks.toggleVoice.mockReset();
});

afterEach(async () => {
  wrappers.splice(0).forEach((wrapper) => {
    if (wrapper.exists()) wrapper.unmount();
  });
  clients.splice(0).forEach((client) => client.clear());
  await flushPromises();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("read-only composer", () => {
  it("keeps knowledge scope between mode and effort in native control order and forwards its lock", async () => {
    const wrapper = mountComposer(
      { disabled: false, context: { mode: "pro", model_name: "scenario" } },
      {
        knowledgeScopeControl: ({ disabled }) =>
          h(
            "button",
            {
              type: "button",
              disabled,
              "data-testid": "knowledge-scope-trigger",
            },
            "Knowledge",
          ),
      },
    );
    await flushPromises();
    const controls = wrapper
      .findAll("button")
      .map((button) => button.attributes("data-testid"));
    const mode = controls.indexOf("composer-mode-trigger");
    const scope = controls.indexOf("knowledge-scope-trigger");
    const effort = controls.indexOf("composer-reasoning-effort-trigger");
    expect(mode).toBeGreaterThanOrEqual(0);
    expect(scope).toBeGreaterThan(mode);
    expect(effort).toBeGreaterThan(scope);
    const button = wrapper.get('[data-testid="knowledge-scope-trigger"]');
    expect(button.attributes("disabled")).toBeUndefined();
    await wrapper.setProps({ disabled: true });
    expect(button.attributes("disabled")).toBeDefined();
  });

  /*
    `aria-disabled` 是**向下继承**的：挂在表单上，可访问性树里连里面两个
    `role="group"` 的 addon 都会被标成 disabled，还会替没被禁用的控件宣布不可用。
    上游 input-box.tsx 一处都没写，它把 disabled 逐个发给真正的控件。
  */
  it("does not mark the whole form aria-disabled", async () => {
    const wrapper = mountComposer({ disabled: true });
    await flushPromises();

    const form = wrapper.get("form");
    expect(form.attributes("aria-disabled")).toBeUndefined();
    expect(form.classes()).toContain("pointer-events-none");
  });

  it("passes the composer's disabled down to a supported voice button", async () => {
    const wrapper = mountComposer({ disabled: false });
    const button = wrapper.get("[data-testid='voice-input-button']");
    expect(button.attributes("disabled")).toBeUndefined();
    await button.trigger("click");
    expect(mocks.toggleVoice).toHaveBeenCalledTimes(1);
    await wrapper.setProps({ disabled: true });
    expect(button.attributes("disabled")).toBeDefined();
    await button.trigger("click");
    expect(mocks.toggleVoice).toHaveBeenCalledTimes(1);
    await wrapper.setProps({ disabled: false });
    expect(button.attributes("disabled")).toBeUndefined();
    await button.trigger("click");
    expect(mocks.toggleVoice).toHaveBeenCalledTimes(2);
  });

  it("disables voice when the client owner does not support speech", () => {
    mocks.voiceSupported = false;
    const wrapper = mountComposer({ disabled: false });
    expect(
      wrapper.get("[data-testid='voice-input-button']").attributes("disabled"),
    ).toBeDefined();
    expect(mocks.toggleVoice).not.toHaveBeenCalled();
  });

  it("disables the mode trigger when read-only", async () => {
    const enabled = mountComposer({ disabled: false });
    await flushPromises();
    expect(
      enabled
        .get("[data-testid='composer-mode-trigger']")
        .attributes("disabled"),
    ).toBeUndefined();

    // 上游 input-box.tsx:2391 的 PromptInputActionMenuTrigger 传的是 composerLocked。
    const wrapper = mountComposer({ disabled: true });
    await flushPromises();
    expect(
      wrapper
        .get("[data-testid='composer-mode-trigger']")
        .attributes("disabled"),
    ).toBeDefined();
  });

  /*
    模型目录**不按 disabled 关掉**。关掉它的后果不是少一个请求：模式触发器的
    文字来自 context.mode，而 context.mode 是目录到位后由「自动选模型」那一步
    写进去的；模型触发器写的是 display_name。目录不来，两颗按钮都没有名字。
  */
  it("still names the mode and model triggers when read-only", async () => {
    const wrapper = mountComposer({ disabled: true });
    /* 坑 115：flushPromises 等不到动态 import 与 query 的解析，用 vi.waitFor。 */
    await vi.waitFor(
      async () => {
        await flushPromises();
        expect(wrapper.emitted("resolveContext")).toBeTruthy();
      },
      { timeout: 3_000 },
    );

    // 上游 getResolvedMode(undefined, supportsThinking) 给出 "pro"。
    const latest = wrapper.emitted("resolveContext")!.at(-1)![0];
    expect(latest).toMatchObject({ model_name: "scenario", mode: "pro" });

    await wrapper.setProps({ context: latest as Record<string, unknown> });
    await flushPromises();

    expect(wrapper.get("[data-testid='composer-mode-trigger']").text()).toBe(
      enUS.inputBox.proMode,
    );
    expect(wrapper.text()).toContain("Scenario Model");
  });
});

describe("reasoning effort selection presentation", () => {
  it("colors the selected effort and updates selection through the actual menu", async () => {
    const wrapper = mountComposer({
      context: { model_name: "scenario", mode: "pro", reasoning_effort: "low" },
    });
    await vi.waitFor(() =>
      expect(
        wrapper
          .find("[data-testid='composer-reasoning-effort-trigger']")
          .exists(),
      ).toBe(true),
    );
    await wrapper
      .get("[data-testid='composer-reasoning-effort-trigger']")
      .trigger("keydown", { key: "Enter" });
    await flushPromises();
    const items = () =>
      Array.from(
        document.querySelectorAll<HTMLElement>("[role='menuitemradio']"),
      );
    expect(items().length).toBeGreaterThan(1);
    const low = items().find((item) =>
      item.textContent?.includes(enUS.inputBox.reasoningEffortLowDescription),
    )!;
    const high = items().find((item) =>
      item.textContent?.includes(enUS.inputBox.reasoningEffortHighDescription),
    )!;
    expect(low.getAttribute("aria-checked")).toBe("true");
    expect(low.classList.contains("text-accent-foreground")).toBe(true);
    expect(high.getAttribute("aria-checked")).toBe("false");
    expect(high.classList.contains("text-muted-foreground/65")).toBe(true);
    high.click();
    await flushPromises();
    const next = wrapper.emitted("contextChange")?.at(-1)?.[0];
    expect(next).toEqual({ reasoning_effort: "high" });
    await wrapper.setProps({
      context: {
        model_name: "scenario",
        mode: "pro",
        ...(next as Record<string, unknown>),
      },
    });
    await wrapper
      .get("[data-testid='composer-reasoning-effort-trigger']")
      .trigger("keydown", { key: "Enter" });
    await flushPromises();
    const selected = items().find(
      (item) => item.getAttribute("aria-checked") === "true",
    )!;
    expect(selected.textContent).toContain(
      enUS.inputBox.reasoningEffortHighDescription,
    );
    expect(selected.classList.contains("text-accent-foreground")).toBe(true);
    for (const item of items().filter((item) => item !== selected))
      expect(item.classList.contains("text-muted-foreground/65")).toBe(true);
  });
});
