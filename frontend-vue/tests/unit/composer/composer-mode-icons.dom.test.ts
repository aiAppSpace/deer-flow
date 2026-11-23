/*
  【文件职责】     守住模式触发器与模式菜单里的每档图标，以及 ultra 的金色。
  【架构位置】     测试
  【主要导出】     无
  【依赖关系】     ChatComposer.vue · app/assets/css/main.css
  【边界与注意】   **这一整簇对照台账天生看不见**，三条原因各自独立：lucide 的 svg
                   不进可访问性树；模式菜单不是几何锚点（几何只在 settle 的 visible
                   锚点上取样）；`.golden-text` 换的是 `-webkit-text-fill-color`，
                   连颜色取样都读不到它。所以判据只能是「上游画了什么」
                   （input-box.tsx:2393 的四条 `mode === …`）。

                   图标身份不按 lucide 的内部 class 断言——那是组件库实现细节，
                   升一次版就会红。断言的是**四档画出来的 svg 各不相同**，
                   加上 ultra 那两处产品自己写的着色 class。
*/

import { readFileSync } from "node:fs";

import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

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
  context: Record<string, unknown>,
  extra: Record<string, unknown> = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  clients.push(queryClient);
  const wrapper = mount(ChatComposer, {
    props: {
      threadKey: "mode-thread",
      targetThreadId: "mode-thread",
      userId: null,
      agentName: null,
      streaming: false,
      uploading: false,
      disabled: false,
      promptHistory: [],
      context,
      modelSelectionReady: true,
      submitMessage: vi.fn(async () => true),
      ...extra,
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
    // 菜单 portal 到 body 上；不 attach 的话触发器在游离的 div 里，点了不展开。
    attachTo: document.body,
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

const MODES = ["flash", "thinking", "pro", "ultra"] as const;

async function triggerOf(mode: string) {
  const wrapper = mountComposer({ mode, model_name: "scenario" });
  await flushPromises();
  return wrapper.get("[data-testid='composer-mode-trigger']");
}

describe("composer mode icons", () => {
  it("draws a distinct icon for each of the four modes", async () => {
    const drawn = new Map<string, string>();
    for (const mode of MODES) {
      const trigger = await triggerOf(mode);
      const icon = trigger.find("svg");
      expect(icon.exists(), `${mode} has no icon`).toBe(true);
      drawn.set(mode, icon.element.innerHTML);
    }
    // 四档四个图标：上游是 Zap / Lightbulb / GraduationCap / Rocket。
    expect(new Set(drawn.values()).size).toBe(4);
  });

  it("paints only ultra gold", async () => {
    const ultra = await triggerOf("ultra");
    expect(ultra.get("svg").classes()).toContain("text-[#dabb5e]");
    expect(ultra.get("div:nth-child(2)").classes()).toContain("golden-text");

    const pro = await triggerOf("pro");
    expect(pro.get("svg").classes()).not.toContain("text-[#dabb5e]");
    expect(pro.get("div:nth-child(2)").classes()).not.toContain("golden-text");
  });

  /*
    没有显式 mode 时上游四条 `mode === …` 全不成立，图标和文字都不画。本仓的触发器
    在这一态下是一颗无名空按钮，加了图标以后必须仍然是空的——否则两边的按钮一个
    有内容一个没有。
  */
  it("draws nothing in the trigger before a mode has been chosen", async () => {
    const wrapper = mountComposer({});
    await flushPromises();
    const trigger = wrapper.get("[data-testid='composer-mode-trigger']");
    expect(trigger.find("svg").exists()).toBe(false);
    expect(trigger.text()).toBe("");
  });

  /*
    菜单的打开、选择与关闭由 composer-workflow.dom.test.ts 经过真实 DropdownMenu
    primitive 覆盖；这里专门守住触发器各档的图标和 ultra 着色。
  */
  /*
    提交键的三态（wave 43）。上游 `PromptInputSubmit`（prompt-input.tsx:1093）：
    streaming → Square、**error → XIcon**、其余 → ArrowUp；`error` 由
    `chat-page.tsx` 的 `thread.error ? "error" : …` 给。本仓原来只有两态，
    出错之后那颗键照样画箭头——而本仓把流错误只送进 toaster，toast 一过期
    界面上就不再有任何痕迹了。

    **三态都要断**（坑 57）：只断「出错时画 X」的话，把图标写死成 X 也照样绿。
    可访问名也一起钉：上游只有 streaming 改成 "Stop"，出错态仍然叫 "Submit"。
  */
  it("draws three distinct submit icons for ready / streaming / errored", async () => {
    const marks = new Map<string, string>();
    for (const [name, extra] of [
      ["ready", {}],
      ["streaming", { streaming: true }],
      ["errored", { errored: true }],
    ] as const) {
      const wrapper = mountComposer({ mode: "chat" }, extra);
      await flushPromises();
      const button = wrapper.get('button[type="submit"]');
      marks.set(name, button.find("svg").html());
      expect(button.attributes("aria-label")).toBe(
        name === "streaming" ? "Stop" : "Submit",
      );
      wrapper.unmount();
    }
    const drawn = [...marks.values()];
    expect(new Set(drawn).size, "三态必须画出三个不同的图标").toBe(3);
    // 流式优先于出错：run 还在跑的时候那颗键得是"停止"，不能变成 X。
    const both = mountComposer(
      { mode: "chat" },
      { streaming: true, errored: true },
    );
    await flushPromises();
    expect(both.get('button[type="submit"]').find("svg").html()).toBe(
      marks.get("streaming"),
    );
    both.unmount();
  });

  it("keeps the same per-item icon markup in the composer menu", () => {
    const source = readFileSync("app/components/chat/ChatComposer.vue", "utf8");
    // 缩进不进判据：prettier 换一次折行就会把写死的空白串打断。
    expect(source).toMatch(/<component\s+:is="mode\.icon"/);
    expect(source).toMatch(/'text-\[#dabb5e\]'/);
    expect(source).toMatch(/'text-accent-foreground'/);
    expect(source).toMatch(/'text-muted-foreground\/65'/);
    expect(source).toMatch(/'golden-text'/);
  });

  /*
    坑 124：happy-dom project 里 import.meta.url 是 http URL，
    readFileSync 拿它会抛 "The URL must be of scheme file"。用相对工作目录的路径。
  */
  it("ships the golden gradient the class refers to", () => {
    const css = readFileSync("app/assets/css/main.css", "utf8");
    expect(css).toContain(".golden-text {");
    // 与上游 globals.css:405 逐字一致：三个色标决定它长什么样。
    expect(css).toContain(
      "linear-gradient(135deg, #d19e1d 0%, #e9c665 50%, #e3a812 100%)",
    );
    expect(css).toContain("-webkit-text-fill-color: transparent;");
  });
});
