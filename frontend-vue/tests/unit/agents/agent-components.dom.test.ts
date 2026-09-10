/*
  【文件职责】     固定Agent card 与 capability settings 的用户可见 DOM/exact payload。
  【架构位置】     Vue DOM test
  【主要导出】     无；Vitest cases
  【依赖关系】     AgentCard · AgentSettingsDialog · i18n
  【边界与注意】   badges 保序不去重；unsupported capability 提交 null 清除，不保留 stale override。
*/

import { flushPromises, mount } from "@vue/test-utils";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
  设置对话框里那块 subagent 访问绑定要读 subagent 目录（wave：#4887）。
  目录本身另有用例，这里只喂一份固定数据，让绑定那几条断言有东西可选。
*/
const subagentsApi = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("@/core/subagents/api", () => ({
  listSubagents: subagentsApi.list,
  createManagedSubagent: vi.fn(),
  updateManagedSubagent: vi.fn(),
  deleteManagedSubagent: vi.fn(),
}));

import AgentCard from "@/components/workspace/agents/AgentCard.vue";
import AgentSettingsDialog from "@/components/workspace/agents/AgentSettingsDialog.vue";
import type { Agent } from "@/core/agents/types";
import { enUS } from "@/core/i18n/locales/en-US";
import type { Model } from "@/core/models/types";

const agent: Agent = {
  name: "reviewer",
  description: "Reviews code",
  model: "reasoning",
  tool_groups: ["browser", "file:read", "browser"],
  skills: ["review", "review", "long-skill-name"],
  model_settings: { temperature: 0, max_tokens: 200_000 },
  thinking_enabled: false,
  reasoning_effort: "high",
  // 没碰绑定那一块 → 继承全部，送的是 null 而不是 []。
  allowed_subagents: null,
};

const models: Model[] = [
  {
    id: "basic",
    name: "basic",
    model: "provider/basic",
    display_name: "Basic",
    supports_thinking: false,
    supports_reasoning_effort: false,
  },
  {
    id: "reasoning",
    name: "reasoning",
    model: "provider/reasoning",
    display_name: "Reasoning",
    supports_thinking: true,
    supports_reasoning_effort: true,
  },
];

const SUBAGENT_BASE = {
  display_name: null,
  description: "",
  system_prompt: null,
  tools: null,
  disallowed_tools: null,
  skills: null,
  model: "inherit",
  max_turns: 50,
  timeout_seconds: 900,
  source: "managed" as const,
  editable: true,
  config_overrides: {},
};

const SUBAGENT_CATALOG = [
  {
    name: "researcher",
    display_name: "Researcher",
    description: "Reads sources.",
    system_prompt: null,
    tools: null,
    disallowed_tools: null,
    skills: null,
    model: "inherit",
    max_turns: 50,
    timeout_seconds: 900,
    enabled: true,
    source: "managed" as const,
    editable: true,
    conflict: false,
    config_overrides: {},
  },
  // 禁用的和名字冲突的都选不中：冲突那条压根没进运行时。
  { name: "disabled-one", enabled: false, conflict: false },
  { name: "conflicting-one", enabled: true, conflict: true },
].map((item, index) =>
  index === 0
    ? item
    : {
        ...SUBAGENT_BASE,
        ...item,
      },
);

beforeEach(() => {
  subagentsApi.list.mockReset();
  subagentsApi.list.mockResolvedValue(SUBAGENT_CATALOG);
  vi.stubGlobal("useNuxtApp", () => ({ $i18n: { t: ref(enUS) } }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

/*
  agent 名与描述都是**用户自己填的、长度不可控**的文本，卡片上分别被
  `truncate` 与 `line-clamp-2` 截掉，本仓原来没有任何办法看到全文
  （上游 agent-card.tsx:141/157 各包一层只在真截断时才出的 TruncatedTooltip）。

  这一条对照台账看不见：tooltip 挂的是 `aria-describedby`，不是可访问名，
  而且它只在 pointerenter 量出「真的被截断了」之后才渲染内容——
  aria 快照与几何档都是静态取一次，两处都够不着。
*/
describe("AgentCard 的截断提示", () => {
  it("把被截断的名字与描述包进 TruncatedTooltip", () => {
    const wrapper = mount(AgentCard, { props: { agent } });

    const triggers = wrapper.findAll("[data-slot='tooltip-trigger']");
    expect(triggers).toHaveLength(2);
    expect(triggers[0]?.classes()).toContain("truncate");
    expect(triggers[1]?.classes()).toContain("line-clamp-2");
  });

  /*
    页脚三颗键此前整个绕开 Button primitive：聊天键**没有图标**，
    设置键画的是**文字字符 `⚙`**、删除键是 `×`——不是图标组件，
    字形随系统 emoji 字体变；删除键还用 `text-red-600`（固定色）
    而不是 `text-destructive`（CSS 变量，深色主题下跟着变）。
  */
  it("页脚三颗键画的是图标，不是文字字符", () => {
    const wrapper = mount(AgentCard, { props: { agent } });

    expect(wrapper.find(".lucide-message-square").exists()).toBe(true);
    expect(wrapper.find(".lucide-settings-2").exists()).toBe(true);
    expect(wrapper.find(".lucide-trash-2").exists()).toBe(true);
    expect(wrapper.text()).not.toContain("⚙");
    expect(wrapper.text()).not.toContain("×");
  });

  it("删除键用主题变量色，不是固定红", () => {
    const wrapper = mount(AgentCard, { props: { agent } });
    const remove = wrapper.get(
      `[aria-label="${enUS.agents.delete}: ${agent.name}"]`,
    );

    expect(remove.classes()).toContain("text-destructive");
    expect(remove.classes()).not.toContain("text-red-600");
  });

  it("没量到截断之前不渲染 tooltip 内容", () => {
    // happy-dom 里 scrollWidth/clientWidth 都是 0，量出来就是「没截断」。
    const wrapper = mount(AgentCard, { props: { agent } });
    expect(wrapper.html()).not.toContain("tooltip-content");
  });
});

describe("AgentCard", () => {
  it("renders the exact model, ordered duplicate skills, and ordered duplicate groups", () => {
    const wrapper = mount(AgentCard, {
      props: { agent },
      global: { stubs: { NuxtLink: { template: "<a><slot /></a>" } } },
    });

    expect(wrapper.get('[data-testid="agent-model"]').text()).toBe("reasoning");
    expect(
      wrapper
        .findAll('[data-testid="agent-tool-group"]')
        .map((row) => row.text()),
    ).toEqual(["browser", "file:read", "browser"]);
    expect(
      wrapper.findAll('[data-testid="agent-skill"]').map((row) => row.text()),
    ).toEqual(["review", "review", "long-skill-name"]);
  });

  it("keeps null and empty tool-group filters visibly distinct", async () => {
    const wrapper = mount(AgentCard, {
      props: { agent: { ...agent, tool_groups: null } },
      global: { stubs: { NuxtLink: { template: "<a><slot /></a>" } } },
    });
    expect(wrapper.get('[data-testid="agent-tool-groups-all"]').text()).toBe(
      "All configured tool groups",
    );

    await wrapper.setProps({ agent: { ...agent, tool_groups: [] } });
    expect(wrapper.get('[data-testid="agent-tool-groups-none"]').text()).toBe(
      "No configured tool groups",
    );
  });
});

/**
 * 对话框内容 portal 到 body，模型/思考/推理三个下拉是 ui/select 而不是原生
 * `<select>`，所以这里既不能用 wrapper 子树查询，也不能用 setValue。
 * Reka 的 SelectItem 只在 pointerup 上提交，happy-dom 的 `.click()` 不会派发它。
 */
function inDialog<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  expect(element, `${selector} not found in the document`).not.toBeNull();
  return element!;
}

async function chooseOption(testId: string, label: string) {
  // Reka 的 combobox trigger 走 pointerdown 打开，happy-dom 不派发指针事件，
  // 所以用它同样支持的键盘入口（OPEN_KEYS）。
  inDialog(`[data-testid="${testId}"]`).dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
  );
  await flushPromises();
  const option = [
    ...document.querySelectorAll<HTMLElement>('[data-slot="select-item"]'),
  ].find((candidate) => candidate.textContent?.trim().startsWith(label));
  expect(option, `no select option matching ${label}`).toBeTruthy();
  option!.dispatchEvent(new Event("pointerup", { bubbles: true }));
  await flushPromises();
}

async function mountSettings(props: Record<string, unknown>) {
  const wrapper = mount(AgentSettingsDialog, {
    attachTo: document.body,
    props,
    global: {
      plugins: [
        [
          VueQueryPlugin,
          {
            queryClient: new QueryClient({
              defaultOptions: { queries: { retry: false } },
            }),
          },
        ],
      ],
    },
  });
  // portal 的内容要等一次 flush 才进 body。
  await flushPromises();
  return wrapper;
}

describe("AgentSettingsDialog", () => {
  it("emits false, zero, reasoning effort, and max tokens without truthy fallback", async () => {
    const wrapper = await mountSettings({ agent, models });

    inDialog<HTMLFormElement>('[role="dialog"] form').dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    await flushPromises();
    expect(wrapper.emitted("save")?.[0]?.[0]).toEqual({
      model: "reasoning",
      model_settings: { temperature: 0, max_tokens: 200_000 },
      thinking_enabled: false,
      reasoning_effort: "high",
      // 没碰绑定那一块 → 继承全部，送的是 null 而不是 []。
      allowed_subagents: null,
    });
  });

  it("hides unsupported controls and emits null to clear their stale values", async () => {
    const wrapper = await mountSettings({ agent, models });
    await chooseOption("agent-settings-model", "Basic");

    expect(
      document.querySelector('[data-testid="agent-settings-thinking"]'),
    ).toBeNull();
    expect(
      document.querySelector('[data-testid="agent-settings-reasoning"]'),
    ).toBeNull();
    inDialog<HTMLFormElement>('[role="dialog"] form').dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    await flushPromises();
    expect(wrapper.emitted("save")?.[0]?.[0]).toMatchObject({
      model: "basic",
      thinking_enabled: null,
      reasoning_effort: null,
      // 没碰绑定那一块 → 继承全部，送的是 null 而不是 []。
      allowed_subagents: null,
    });
  });

  it("submits number-input values through the actual save button", async () => {
    const wrapper = await mountSettings({ agent, models });
    await chooseOption("agent-settings-model", "Basic");
    const temperature = inDialog<HTMLInputElement>(
      '[data-testid="agent-settings-temperature"]',
    );
    temperature.value = "0";
    temperature.dispatchEvent(new Event("input", { bubbles: true }));
    const maxTokens = inDialog<HTMLInputElement>(
      '[data-testid="agent-settings-max-tokens"]',
    );
    maxTokens.value = "200000";
    maxTokens.dispatchEvent(new Event("input", { bubbles: true }));
    await flushPromises();
    inDialog('[data-testid="agent-settings-save"]').click();
    await flushPromises();

    expect(wrapper.emitted("save")?.[0]?.[0]).toEqual({
      model: "basic",
      model_settings: { temperature: 0, max_tokens: 200000 },
      thinking_enabled: null,
      reasoning_effort: null,
      // 没碰绑定那一块 → 继承全部，送的是 null 而不是 []。
      allowed_subagents: null,
    });
  });

  /*
    subagent 访问绑定（#4887）。三态与 subagent 自己的 tools/skills 同构：
    `null` 全都给、`[]` 一个都不给、`[...]` 只给这几个。
  */
  it("送出 subagent 绑定的三态，并且只让能选的进列表", async () => {
    const wrapper = await mountSettings({
      agent: { ...agent, allowed_subagents: ["researcher", "deleted-one"] },
      models,
    });

    // selected 模式：列表里是目录中「启用且不冲突」的那些。
    const list = inDialog<HTMLElement>('[data-testid="subagent-access-list"]');
    expect(list.textContent).toContain("Researcher");
    // 禁用的和名字冲突的选不中——冲突那条压根没进运行时。
    expect(list.textContent).not.toContain("disabled-one");
    expect(list.textContent).not.toContain("conflicting-one");
    /*
      已经绑上、但目录里已经没有的名字仍然显示且保持勾选：静默丢掉的话，
      用户一保存就删掉了一条自己没动过的绑定。
    */
    expect(list.textContent).toContain("deleted-one");
    expect(list.textContent).toContain(enUS.settings.subagents.missing);

    inDialog<HTMLFormElement>('[role="dialog"] form').dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    await flushPromises();
    expect(
      (wrapper.emitted("save")?.[0]?.[0] as { allowed_subagents: unknown })
        .allowed_subagents,
    ).toEqual(["researcher", "deleted-one"]);
  });

  it("绑定为空数组时进入「一个都不给」，而不是「全都给」", async () => {
    const wrapper = await mountSettings({
      agent: { ...agent, allowed_subagents: [] },
      models,
    });
    expect(
      document.body.querySelector('[data-testid="subagent-access-list"]'),
    ).toBeNull();
    inDialog<HTMLFormElement>('[role="dialog"] form').dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    await flushPromises();
    // `[]` 与 `null` 一旦混掉，一个本该什么都不能调的 agent 会变成全都能调。
    expect(
      (wrapper.emitted("save")?.[0]?.[0] as { allowed_subagents: unknown })
        .allowed_subagents,
    ).toEqual([]);
  });

  it("keeps model/save failures visible and locks conflicting actions while pending", async () => {
    await mountSettings({
      agent,
      models,
      pending: true,
      modelError: "Failed to load model capabilities: Forbidden",
      submitError: "Failed to save model settings: Conflict",
    });
    expect(inDialog('[role="alert"]').textContent).toContain("Forbidden");
    // 关闭按钮是唯一不该被锁的出口：pending 期间用户仍然要能退出对话框。
    const locked = [
      ...inDialog('[role="dialog"]').querySelectorAll<HTMLButtonElement>(
        "button",
      ),
    ].filter((button) => button.dataset.slot !== "dialog-close");
    expect(locked.length).toBeGreaterThan(0);
    expect(locked.every((button) => button.disabled)).toBe(true);
  });
});
