/*
  【文件职责】     守住 /workspace/agents/new 命名步骤与上游 page.tsx 的逐条对应。
  【架构位置】     测试
  【主要导出】     无
  【依赖关系】     @nuxt/test-utils/runtime · app/pages/workspace/agents/new.vue
  【边界与注意】   这一屏**进不了对照取样面**：覆盖率棘轮要求场景 id 逐字等于
                   `frontend/tests/e2e/*.spec.ts` 的文件名，而上游没有任何一条 spec
                   走到 `/workspace/agents/new`（坑 107）。wave 28 的 probe 实测出
                   9 行差异，这个文件就是那 9 行的守卫——**台账永远不会替它变红**。

                   AgentChat 与 agents API 都被换掉：前者是整条会话流，挂进来会把
                   「命名步骤画了什么」的用例拖成一次应用启动；后者要走网络。
                   API 用 importOriginal 保留真的错误类——页面靠 `instanceof` 与
                   `reason` 分支选文案，工厂函数自己造一个假类会让分支全部落进兜底。
*/

import { flushPromises } from "@vue/test-utils";
import { mountSuspended, mockNuxtImport } from "@nuxt/test-utils/runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import NewAgentPage from "@/pages/workspace/agents/new.vue";
import { enUS } from "@/core/i18n/locales/en-US";

const { navigateToMock, checkAgentNameMock } = vi.hoisted(() => ({
  navigateToMock: vi.fn(),
  checkAgentNameMock: vi.fn(),
}));

mockNuxtImport("navigateTo", () => navigateToMock);

vi.mock("@/core/agents/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/core/agents/api")>();
  return { ...actual, checkAgentName: checkAgentNameMock };
});

vi.mock("@/components/chat/AgentChat.vue", () => ({
  default: {
    name: "AgentChatStub",
    props: { agentName: { type: String, default: "" }, bootstrap: Boolean },
    template:
      '<div data-testid="agent-chat-stub">{{ agentName }}/{{ bootstrap }}</div>',
  },
}));

beforeEach(() => {
  navigateToMock.mockReset();
  checkAgentNameMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function mountPage() {
  const wrapper = await mountSuspended(NewAgentPage, {
    route: "/workspace/agents/new",
    attachTo: document.body,
  });
  await flushPromises();
  return wrapper;
}

const continueButton = (wrapper: Awaited<ReturnType<typeof mountPage>>) =>
  wrapper
    .findAll("button")
    .find((button) => button.text() === enUS.agents.nameStepContinue)!;

describe("new agent name step", () => {
  it("renders the upstream header above the form", async () => {
    const wrapper = await mountPage();

    const back = wrapper.find(
      `button[aria-label="${enUS.agents.backToGallery}"]`,
    );
    expect(back.exists()).toBe(true);
    expect(wrapper.get("h1").text()).toBe(enUS.agents.createPageTitle);
    // 步骤标题是 h2：h1 归 header 所有（上游 page.tsx 的 header/main 分工）。
    expect(wrapper.get("h2").text()).toBe(enUS.agents.nameStepTitle);
  });

  it("sends the back control to the agent gallery", async () => {
    const wrapper = await mountPage();

    await wrapper
      .get(`button[aria-label="${enUS.agents.backToGallery}"]`)
      .trigger("click");
    expect(navigateToMock).toHaveBeenCalledWith("/workspace/agents");
  });

  /*
    可访问名来自 placeholder，**不是** aria-label：上游那颗 Input 只有 placeholder。
    本仓原来挂了 aria-label，于是同一颗输入框两边念出来的名字不同。
  */
  it("names the field with the placeholder only", async () => {
    const wrapper = await mountPage();

    const input = wrapper.get("input");
    expect(input.attributes("placeholder")).toBe(
      enUS.agents.nameStepPlaceholder,
    );
    expect(input.attributes("aria-label")).toBeUndefined();
  });

  it("focuses the field on mount", async () => {
    const wrapper = await mountPage();

    expect(document.activeElement).toBe(wrapper.get("input").element);
  });

  it("keeps Continue disabled until the field has a value", async () => {
    const wrapper = await mountPage();

    expect(continueButton(wrapper).attributes("disabled")).toBeDefined();
    await wrapper.get("input").setValue("reviewer");
    expect(continueButton(wrapper).attributes("disabled")).toBeUndefined();
  });

  it("rejects an invalid name without asking the backend", async () => {
    const wrapper = await mountPage();

    await wrapper.get("input").setValue("bad name!");
    await continueButton(wrapper).trigger("click");
    await flushPromises();

    expect(checkAgentNameMock).not.toHaveBeenCalled();
    expect(wrapper.get('[role="alert"]').text()).toBe(
      enUS.agents.nameStepInvalidError,
    );
  });

  it("clears the error as soon as the field changes", async () => {
    const wrapper = await mountPage();

    await wrapper.get("input").setValue("bad name!");
    await continueButton(wrapper).trigger("click");
    await flushPromises();
    expect(wrapper.find('[role="alert"]').exists()).toBe(true);

    await wrapper.get("input").setValue("good-name");
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });

  it("reports a taken name", async () => {
    checkAgentNameMock.mockResolvedValue({ available: false, name: "taken" });
    const wrapper = await mountPage();

    await wrapper.get("input").setValue("taken");
    await continueButton(wrapper).trigger("click");
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toBe(
      enUS.agents.nameStepAlreadyExistsError,
    );
  });

  /*
    `backend_unreachable` 与 `request_failed` 走**不同**的文案，与上游 catch 同构：
    后端连不上和后端拒绝这个名字，用户能做的事完全不同。本仓此前把前者并进了通用
    兜底，`agents.nameStepNetworkError` 因此零消费。
  */
  it("distinguishes an unreachable backend from a rejected name", async () => {
    const { AgentNameCheckError } = await import("@/core/agents/api");
    checkAgentNameMock.mockRejectedValue(
      new AgentNameCheckError("down", "backend_unreachable"),
    );
    const wrapper = await mountPage();

    await wrapper.get("input").setValue("reviewer");
    await continueButton(wrapper).trigger("click");
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toBe(
      enUS.agents.nameStepNetworkError,
    );
  });

  it("surfaces a backend detail when the request itself failed", async () => {
    const { AgentNameCheckError } = await import("@/core/agents/api");
    checkAgentNameMock.mockRejectedValue(
      new AgentNameCheckError("nope", "request_failed", "name too long"),
    );
    const wrapper = await mountPage();

    await wrapper.get("input").setValue("reviewer");
    await continueButton(wrapper).trigger("click");
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toBe(
      enUS.agents.nameStepCheckErrorWithDetail.replace(
        "{detail}",
        "name too long",
      ),
    );
  });

  it("falls back to the generic message when there is no detail", async () => {
    const { AgentNameCheckError } = await import("@/core/agents/api");
    checkAgentNameMock.mockRejectedValue(
      new AgentNameCheckError(
        "Failed to check agent name: Bad Gateway",
        "request_failed",
      ),
    );
    const wrapper = await mountPage();

    await wrapper.get("input").setValue("reviewer");
    await continueButton(wrapper).trigger("click");
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toBe(
      enUS.agents.nameStepCheckError,
    );
  });

  it("explains a disabled agents API", async () => {
    const { AgentsApiDisabledError } = await import("@/core/agents/api");
    checkAgentNameMock.mockRejectedValue(new AgentsApiDisabledError("off"));
    const wrapper = await mountPage();

    await wrapper.get("input").setValue("reviewer");
    await continueButton(wrapper).trigger("click");
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toBe(
      enUS.agents.nameStepApiDisabledError,
    );
  });

  /*
    回车提交走 keydown，不是原生 form submit——上游没有 `<form>` 也没有 `required`，
    留着原生校验会在空值回车时弹一个上游根本没有的浏览器气泡。
  */
  it("submits on Enter and ignores Enter during IME composition", async () => {
    checkAgentNameMock.mockResolvedValue({ available: true, name: "reviewer" });
    const wrapper = await mountPage();
    const input = wrapper.get("input");
    await input.setValue("reviewer");

    await input.trigger("compositionstart");
    await input.trigger("keydown", { key: "Enter" });
    await flushPromises();
    expect(checkAgentNameMock).not.toHaveBeenCalled();

    await input.trigger("compositionend");
    await input.trigger("keydown", { key: "Enter" });
    await flushPromises();
    expect(checkAgentNameMock).toHaveBeenCalledWith("reviewer");
  });

  it("keeps the button label while checking and hands off once available", async () => {
    let settle: (value: unknown) => void = () => {};
    checkAgentNameMock.mockReturnValue(
      new Promise((resolve) => {
        settle = resolve;
      }),
    );
    const wrapper = await mountPage();

    await wrapper.get("input").setValue("reviewer");
    await continueButton(wrapper).trigger("click");
    await flushPromises();

    // 上游检查中只置灰不换字；agents 下的 nameStepChecking 在两边都零消费
    // （不写成带点的完整 key：unused 扫描器会把注释也算成引用）。
    const button = continueButton(wrapper);
    expect(button.text()).toBe(enUS.agents.nameStepContinue);
    expect(button.attributes("disabled")).toBeDefined();

    settle({ available: true, name: "reviewer" });
    await flushPromises();

    expect(wrapper.get('[data-testid="agent-chat-stub"]').text()).toBe(
      "reviewer/true",
    );
  });
});
