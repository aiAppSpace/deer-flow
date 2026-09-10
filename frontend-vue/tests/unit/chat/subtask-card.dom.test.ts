/*
  【文件职责】     钉住子任务卡片的构成与分支：折叠头、元数据的可见时机、展开区的步骤。
  【架构位置】     测试
  【主要导出】     无
  【依赖关系】     SubtaskCard.vue · MessageList.vue · ui/chain-of-thought
  【边界与注意】   断言尽量落在**上游能对上的那一层**：描述文字在 ChainOfThoughtStep
                   的 label 格子里、元数据只在折叠态、终态各自的步骤。这些都是台账
                   量不到的（卡片默认折叠、对照夹具只有 failed 一条路径），所以只能
                   在这里钉。
*/

import { flushPromises, mount } from "@vue/test-utils";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

import MessageList from "@/components/chat/MessageList.vue";
import SubtaskCard from "@/components/chat/SubtaskCard.vue";
import { enUS } from "@/core/i18n/locales/en-US";
import type { Subtask } from "@/core/tasks/types";
import type { ToolCall } from "@/core/types/message";
import {
  createWorkspaceToastStore,
  workspaceToastKey,
} from "@/core/workspace-shell/toast";

const toastStore = createWorkspaceToastStore();

const fetchedSteps = [
  { message_index: 1, kind: "ai" as const, text: "Planning the search" },
  {
    message_index: 2,
    kind: "tool" as const,
    text: "found sources",
    tool_name: "web_search",
  },
];
const { fetchSubtaskSteps } = vi.hoisted(() => ({
  fetchSubtaskSteps: vi.fn(),
}));
vi.mock("@/core/tasks/api", () => ({ fetchSubtaskSteps }));

class ResizeObserverStub {
  observe() {}
  disconnect() {}
  unobserve() {}
}

beforeEach(() => {
  fetchSubtaskSteps.mockReset();
  vi.stubGlobal("useNuxtApp", () => ({
    $i18n: { t: ref(enUS), locale: ref("en-US") },
  }));
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** `token_usage.enabled` 与模型显示名都从这份 /api/models 响应来。 */
function mountCard(
  props: InstanceType<typeof SubtaskCard>["$props"],
  models: { enabled: boolean; withModel?: boolean } = { enabled: false },
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  queryClient.setQueryData(["models"], {
    models: models.withModel
      ? [
          {
            id: "m1",
            name: "claude-sonnet",
            model: "claude-sonnet",
            display_name: "Claude Sonnet",
          },
        ]
      : [],
    token_usage: { enabled: models.enabled },
  });
  return mount(SubtaskCard, {
    attachTo: document.body,
    props,
    global: {
      provide: { [workspaceToastKey as symbol]: toastStore },
      plugins: [[VueQueryPlugin, { queryClient }]],
    },
  });
}

describe("SubtaskCard", () => {
  it("shows the streaming shine border only while a subtask is in progress", async () => {
    const wrapper = mountCard({
      taskId: "task-streaming",
      description: "Draft the plan",
      prompt: "Draft the plan",
      pendingStatus: "in_progress",
      isLoading: true,
    });
    expect(wrapper.find('[data-effect="shine-border"]').exists()).toBe(true);

    await wrapper.setProps({ pendingStatus: "completed", isLoading: false });
    expect(wrapper.find('[data-effect="shine-border"]').exists()).toBe(false);
    wrapper.unmount();
  });

  /*
    环境光那层无论什么状态都渲染，只有 in_progress 才加 `.enabled`——上游写的是
    `cn("ambilight z-[-1]", status === "in_progress" ? "enabled" : "")`。
    只在 in_progress 时才 v-if 出来是不一样的：卡片的子节点数会跟着状态变。
  */
  it("always renders the ambilight layer and only enables it while running", async () => {
    const wrapper = mountCard({
      taskId: "task-ambilight",
      description: "Draft the plan",
      prompt: "Draft the plan",
      pendingStatus: "in_progress",
      isLoading: true,
    });
    expect(wrapper.find(".ambilight").classes()).toContain("enabled");

    await wrapper.setProps({ pendingStatus: "completed", isLoading: false });
    expect(wrapper.find(".ambilight").exists()).toBe(true);
    expect(wrapper.find(".ambilight").classes()).not.toContain("enabled");
    wrapper.unmount();
  });

  it("renders normalized terminal metadata and backfills history on expand", async () => {
    fetchSubtaskSteps.mockResolvedValue(fetchedSteps);
    const liveTask: Subtask = {
      id: "task-1",
      status: "completed",
      subagent_type: "research",
      description: "Research competitors",
      prompt: "Compare the market",
      modelName: "claude-sonnet",
      usage: { inputTokens: 800, outputTokens: 400, totalTokens: 1200 },
      result: "Three competitors found.",
    };
    const wrapper = mountCard(
      {
        taskId: "task-1",
        threadId: "thread-1",
        runId: "run-1",
        description: "Research competitors",
        prompt: "Compare the market",
        liveTask,
        terminal: {
          status: "completed",
          result: "Three competitors found.",
          modelName: "claude-sonnet",
          usage: { inputTokens: 800, outputTokens: 400, totalTokens: 1200 },
        },
        pendingStatus: "completed",
        isLoading: false,
      },
      { enabled: true, withModel: true },
    );

    expect(wrapper.text()).toContain("Research competitors");
    // 模型名走 /api/models 的 display_name，不是裸的后端 name。
    expect(wrapper.text()).toContain("Claude Sonnet");
    // token 标签带单位，不是裸数字。
    expect(wrapper.text()).toContain(`1,200 ${enUS.tokenUsage.label}`);
    expect(wrapper.text()).toContain(enUS.subtasks.completed);

    const toggle = wrapper.get('[data-testid="subtask-toggle"]');
    await toggle.trigger("click");
    await flushPromises();
    expect(fetchSubtaskSteps).toHaveBeenCalledWith(
      "thread-1",
      "run-1",
      "task-1",
    );
    // AI 步骤与结果都走 MessageMarkdown（上游是 MarkdownContent），渲染器是
    // 异步加载的，所以等它出来再断言。
    await vi.waitFor(
      () => expect(wrapper.text()).toContain("Planning the search"),
      { timeout: 2_000 },
    );
    expect(wrapper.text()).toContain("web_search");
    expect(wrapper.text()).toContain("Three competitors found.");
    expect(toggle.attributes("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(toggle.element);
    wrapper.unmount();
  });

  /*
    折叠头右侧那组 model / token / 状态**只在折叠态**存在，上游是
    `{collapsed && (<div …>)}`。展开后它整块消失，只留下 chevron。
  */
  it("drops the collapsed metadata row once the card is expanded", async () => {
    fetchSubtaskSteps.mockResolvedValue([]);
    const wrapper = mountCard(
      {
        taskId: "task-meta",
        threadId: "thread-1",
        runId: "run-1",
        description: "Research competitors",
        prompt: "Compare the market",
        terminal: {
          status: "completed",
          modelName: "claude-sonnet",
          usage: { inputTokens: 8, outputTokens: 4, totalTokens: 12 },
        },
        pendingStatus: "completed",
        isLoading: false,
      },
      { enabled: true, withModel: true },
    );
    expect(wrapper.text()).toContain("Claude Sonnet");

    await wrapper.get('[data-testid="subtask-toggle"]').trigger("click");
    await flushPromises();
    expect(wrapper.text()).not.toContain("Claude Sonnet");
    expect(wrapper.text()).not.toContain(`12 ${enUS.tokenUsage.label}`);
    wrapper.unmount();
  });

  /* token 用量没开时整个标签不出现——上游用 tokenUsageEnabled 把它整段关掉。 */
  it("hides the token label when the server disables token usage", () => {
    const wrapper = mountCard(
      {
        taskId: "task-no-usage",
        description: "Research competitors",
        prompt: "Compare the market",
        terminal: {
          status: "completed",
          usage: { inputTokens: 8, outputTokens: 4, totalTokens: 12 },
        },
        pendingStatus: "completed",
        isLoading: false,
      },
      { enabled: false },
    );
    expect(wrapper.text()).not.toContain(enUS.tokenUsage.label);
    expect(wrapper.text()).not.toContain("12");
    wrapper.unmount();
  });

  /*
    停在半路的任务展开后要有一条红色步骤说明为什么。上游在 message-list 构造
    Subtask 时把 pending failed 的 error 预填成 `t.subtasks.failed`；本仓此前
    view model 里没有这个回落，展开后那条步骤是空的。
  */
  it("explains a stopped subtask with a red failure step when expanded", async () => {
    fetchSubtaskSteps.mockResolvedValue([]);
    const wrapper = mountCard({
      taskId: "task-stopped",
      threadId: "thread-1",
      runId: "run-1",
      description: "Research stopped reload regression",
      prompt: "Investigate the stopped card.",
      pendingStatus: "failed",
      isLoading: false,
    });
    await wrapper.get('[data-testid="subtask-toggle"]').trigger("click");
    await flushPromises();
    const red = wrapper.findAll(".text-red-500").map((node) => node.text());
    expect(red.join(" ")).toContain(enUS.subtasks.failed);
    wrapper.unmount();
  });

  /*
    折叠头那颗 ClipboardList **不能带 size 类**。上游把它当元素传给
    ChainOfThoughtStep（Step 只给自己的默认 Dot 补 size-4），最终尺寸由 Button 的
    `[&_svg:not([class*='size-'])]:size-4` 决定 —— 一旦调用点"顺手"补一个 size 类，
    那条规则就选不中它，图标从 16px 变回 lucide 默认的 24px，整行高度跟着变。
  */
  it("leaves the header icon unsized so the button rule can size it", () => {
    const wrapper = mountCard({
      taskId: "task-icon",
      description: "Research competitors",
      prompt: "Compare the market",
      pendingStatus: "failed",
      isLoading: false,
    });
    const icon = wrapper.get(".lucide-clipboard-list");
    expect(icon.classes().some((name) => name.startsWith("size-"))).toBe(false);
    wrapper.unmount();
  });

  it("shows a retry action when historical step loading fails", async () => {
    fetchSubtaskSteps.mockRejectedValueOnce(new Error("events unavailable"));
    const wrapper = mountCard({
      taskId: "task-2",
      threadId: "thread-1",
      runId: "run-2",
      description: "Research",
      prompt: "Research",
      pendingStatus: "failed",
      isLoading: false,
    });
    await wrapper.get('[data-testid="subtask-toggle"]').trigger("click");
    await flushPromises();
    expect(wrapper.get('[data-testid="subtask-steps-retry"]').text()).toContain(
      enUS.subtasks.retry,
    );
    wrapper.unmount();
  });
});

describe("MessageList subtask group header", () => {
  function mountList(toolCalls: ToolCall[]) {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(["models"], {
      models: [],
      token_usage: { enabled: false },
    });
    return mount(MessageList, {
      props: {
        messages: [
          {
            id: "assistant-subagent",
            type: "ai",
            content: "",
            tool_calls: toolCalls,
          },
        ],
        streaming: false,
        loading: false,
        threadId: "thread-1",
      },
      global: {
        provide: { [workspaceToastKey as symbol]: toastStore },
        plugins: [[VueQueryPlugin, { queryClient }]],
      },
    });
  }

  const call = (id: string, description: string): ToolCall => ({
    id,
    name: "task",
    args: { subagent_type: "general-purpose", description, prompt: "Go" },
    type: "tool_call",
  });

  /*
    count===1 时 `subtasks.executing` 既不插数字也不加复数。这一行以前整个不存在，
    对照台账上 `- text: Executing subtask` 就是它。
  */
  it("labels a single subtask group without a count", () => {
    const wrapper = mountList([call("call-1", "Research one thing")]);
    expect(wrapper.text()).toContain(enUS.subtasks.executing(1));
    expect(wrapper.text()).toContain("Executing subtask");
    wrapper.unmount();
  });

  it("counts parallel subtasks in the same assistant message", () => {
    const wrapper = mountList([
      call("call-1", "Research one thing"),
      call("call-2", "Research another"),
    ]);
    expect(wrapper.text()).toContain(enUS.subtasks.executing(2));
    wrapper.unmount();
  });

  /*
    子任务组里的 tool 结果只喂给卡片，不再单独画一个 `<details>`。上游
    assistant:subagent 分支只遍历 ai 消息，tool 消息从不进入渲染。
  */
  it("does not render the task tool result a second time", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(["models"], {
      models: [],
      token_usage: { enabled: false },
    });
    const wrapper = mount(MessageList, {
      props: {
        messages: [
          {
            id: "assistant-subagent",
            type: "ai",
            content: "",
            tool_calls: [call("call-1", "Research one thing")],
          },
          {
            id: "tool-result",
            type: "tool",
            name: "task",
            tool_call_id: "call-1",
            content: "Task Succeeded. Result: All good.",
            additional_kwargs: { subagent_status: "completed" },
          },
        ],
        streaming: false,
        loading: false,
        threadId: "thread-1",
      },
      global: {
        provide: { [workspaceToastKey as symbol]: toastStore },
        plugins: [[VueQueryPlugin, { queryClient }]],
      },
    });
    // 卡片本体在；tool 结果那条独立的 details 不在。
    expect(wrapper.find('[data-testid="subtask-toggle"]').exists()).toBe(true);
    expect(wrapper.findAll("details")).toHaveLength(0);
    wrapper.unmount();
  });

  it("leaves messages without task tool calls unlabelled", () => {
    const wrapper = mountList([
      {
        id: "call-x",
        name: "web_search",
        args: { query: "deerflow" },
        type: "tool_call",
      },
    ]);
    expect(wrapper.text()).not.toContain("Executing");
    wrapper.unmount();
  });
});
