/*
  【文件职责】     守住输入框「打开新会话时光标已经在里面」这件事。
  【架构位置】     测试
  【主要导出】     无
  【依赖关系】     ChatComposer.vue · AgentChat.vue
  【边界与注意】   **对照台账、几何、aria 三样都看不见这条差异**：`document.activeElement`
                   不进 aria 快照，也不是盒模型量（第八类差异）。wave 28 的 probe 量到
                   上游打开 /workspace/chats/new 之后焦点在 composer 的 textarea 上、
                   本仓在 body，靠的正是在 probe 里加一行 activeElement。

                   所以这一条只能由单测守：挂载后直接读 `document.activeElement`，
                   而且必须 `attachTo: document.body`——游离在文档外的元素 focus()
                   是 no-op，不挂上去这条用例会恒绿。
*/

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

/* 线索 121：没传的 Boolean prop 会被 Vue 变成 false，每一个都显式传上。 */
function mountComposer(props: Record<string, unknown>) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  clients.push(queryClient);
  const wrapper = mount(ChatComposer, {
    attachTo: document.body,
    props: {
      threadKey: "new",
      targetThreadId: "thread-1",
      userId: null,
      agentName: null,
      streaming: false,
      uploading: false,
      disabled: false,
      isWelcome: true,
      modelSelectionReady: true,
      showWelcomeSuggestions: true,
      promptHistory: [],
      context: {},
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
  mocks.loadModels
    .mockReset()
    .mockResolvedValue({ models: [], token_usage: { enabled: false } });
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

describe("composer autoFocus", () => {
  it("focuses the textarea on mount, the way React's autoFocus does", () => {
    const wrapper = mountComposer({ autoFocus: true });
    expect(document.activeElement).toBe(wrapper.get("textarea").element);
    wrapper.unmount();
  });

  it("leaves focus alone when autoFocus is not asked for", () => {
    const wrapper = mountComposer({ autoFocus: false });
    expect(document.activeElement).not.toBe(wrapper.get("textarea").element);
    wrapper.unmount();
  });

  // AgentChat mount-time request and route reuse are exercised in agent-chat-consumer-contracts.dom.test.ts.
});
