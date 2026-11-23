/*
  【文件职责】     记忆面板的呈现层对齐：摘要区是 markdown、筛选是单选组、事实行四项
                   元数据、以及按钮名字带正文。
  【架构位置】     L3 测试
  【依赖关系】     components/workspace/settings/MemorySettings.vue
  【边界与注意】   摘要合同使用真实异步 Markdown 渲染器，验证标题层级、引用块与 raw
                   HTML 的 DOM 结果；筛选、metadata 与按钮名合同只保留正文边界。
                   每条用例结束都卸载组件，再清理 globals 与 DOM。
*/

import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

import MemorySettings from "@/components/workspace/settings/MemorySettings.vue";
import { enUS } from "@/core/i18n/locales/en-US";
import type { UserMemory } from "@/core/memory/types";
import {
  createWorkspaceToastStore,
  workspaceToastKey,
} from "@/core/workspace-shell/toast";

const toastStore = createWorkspaceToastStore();

const memoryFactory = vi.hoisted(() => vi.fn());
vi.mock("@/composables/useMemory", () => ({ useMemory: memoryFactory }));
vi.mock("@/composables/useSettingsDialog", () => ({
  useSettingsDialog: () => ({ close: vi.fn() }),
}));

const MEMORY: UserMemory = {
  version: "2.0",
  revision: 4,
  lastUpdated: "2026-08-22T00:00:00Z",
  user: {
    workContext: {
      summary: "Vue parity",
      updatedAt: "2026-08-22T00:00:00Z",
    },
    personalContext: { summary: "", updatedAt: "" },
    topOfMind: { summary: "Recent work", updatedAt: "2026-08-22T00:00:00Z" },
    cognitiveStyle: { summary: "", updatedAt: "" },
  },
  history: {
    recentMonths: { summary: "Settings", updatedAt: "2026-08-22T00:00:00Z" },
    earlierContext: { summary: "", updatedAt: "" },
    longTermBackground: { summary: "", updatedAt: "" },
  },
  facts: [
    {
      id: "fact-a",
      content: "Prefers Chinese for commit messages",
      category: "preference",
      confidence: 0.92,
      createdAt: "2026-08-22T00:00:00Z",
      source: "manual",
    },
    {
      id: "fact-b",
      content: "Works in the monorepo",
      category: "context",
      confidence: 0.7,
      createdAt: "2026-08-22T00:00:00Z",
      source: "thread-42",
    },
  ],
};

function mutation() {
  return {
    isPending: ref(false),
    error: ref<Error | null>(null),
    mutateAsync: vi.fn().mockResolvedValue(MEMORY),
  };
}

/*
  摘要渲染跨越两层 defineAsyncComponent 与模块加载，flushPromises 不代表加载完成。
  真实渲染合同等待可见标题；其它合同不启动与其断言无关的异步模块链。
*/
async function settleMarkdown(wrapper: ReturnType<typeof mount>) {
  await flushPromises();
  await vi.waitFor(
    () =>
      expect(wrapper.find('[data-testid="memory-summary"] h2').exists()).toBe(
        true,
      ),
    { timeout: 5_000 },
  );
}

function mountMemory({ renderMarkdown = false } = {}) {
  memoryFactory.mockReturnValue({
    memory: ref(MEMORY),
    loading: ref(false),
    fetching: ref(false),
    error: ref<Error | null>(null),
    refetch: vi.fn(),
    clear: mutation(),
    create: mutation(),
    remove: mutation(),
    importDocument: mutation(),
    exportDocument: mutation(),
    update: mutation(),
  });
  return mount(MemorySettings, {
    attachTo: document.body,
    global: {
      provide: { [workspaceToastKey as symbol]: toastStore },
      stubs: {
        NuxtLink: { template: '<a :href="to"><slot /></a>', props: ["to"] },
        MessageMarkdown: renderMarkdown
          ? false
          : {
              name: "MessageMarkdown",
              props: ["content"],
              template: "<div>{{ content }}</div>",
            },
      },
    },
  });
}

beforeEach(() => {
  vi.stubGlobal("useNuxtApp", () => ({
    $i18n: { t: ref(enUS), locale: ref("en-US") },
  }));
  vi.stubGlobal("navigateTo", vi.fn());
});

enableAutoUnmount((unmountAll) => {
  afterEach(() => {
    unmountAll();
    toastStore.clear();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });
});

describe("MemorySettings 呈现层", () => {
  it("renders the summaries as a markdown document, empty sections included", async () => {
    const wrapper = mountMemory({ renderMarkdown: true });
    await settleMarkdown(wrapper);

    const block = wrapper.get('[data-testid="memory-summary"]');
    // 分组标题是 h2、小节标题是 h3——本仓原来一个分组标题都没有。
    expect(block.findAll("h2").map((h) => h.text())).toEqual([
      enUS.settings.memory.markdown.overview,
      enUS.settings.memory.markdown.userContext,
      enUS.settings.memory.markdown.historyBackground,
    ]);
    expect(block.findAll("h3").map((h) => h.text())).toEqual([
      enUS.settings.memory.markdown.work,
      enUS.settings.memory.markdown.personal,
      enUS.settings.memory.markdown.topOfMind,
      enUS.settings.memory.markdown.cognitiveStyle,
      enUS.settings.memory.markdown.recentMonths,
      enUS.settings.memory.markdown.earlierContext,
      enUS.settings.memory.markdown.longTermBackground,
    ]);
    // 引用块与行内代码是 markdown 渲染出来的，不是手写的。
    expect(block.findAll("blockquote").length).toBe(3);
    expect(block.findAll("hr").length).toBe(2);
    // 空小节出现，写成灰掉的 (empty)——rehype-raw 没接上时这里会是一串转义源码。
    expect(block.html()).toContain(
      `<span class="text-muted-foreground">${enUS.settings.memory.markdown.empty}</span>`,
    );
    expect(block.html()).not.toContain("&lt;span");
    // 粗体走 Streamdown 的镜像（span.font-semibold），不是裸 <strong>。
    expect(block.findAll("strong")).toHaveLength(0);
    expect(block.html()).toContain('data-streamdown="strong"');
  });

  it("shows relative times, not the raw ISO timestamps the Gateway sends", async () => {
    const wrapper = mountMemory({ renderMarkdown: true });
    await settleMarkdown(wrapper);

    expect(wrapper.text()).not.toContain("2026-08-22T00:00:00Z");
    expect(wrapper.get('[data-testid="memory-summary"]').text()).toContain(
      "ago",
    );
  });

  /*
    三颗筛选按钮是**单选组**（上游用的是 ToggleGroup type="single"，Radix 把子项
    改写成 role=radio）。Reka 的 ToggleGroupItem 恒定走 Toggle，只给 aria-pressed，
    所以这三个属性是从外面覆盖上去的——覆盖不生效时这条会红（坑 102）。
  */
  it("renders the filter as a radio group, not three toggle buttons", async () => {
    const wrapper = mountMemory();
    await flushPromises();

    const radios = wrapper.findAll('[role="radio"]');
    expect(radios.map((radio) => radio.text())).toEqual([
      enUS.settings.memory.filterAll,
      enUS.settings.memory.filterFacts,
      enUS.settings.memory.filterSummaries,
    ]);
    expect(radios.map((radio) => radio.attributes("aria-checked"))).toEqual([
      "true",
      "false",
      "false",
    ]);
    expect(
      radios.every((radio) => radio.attributes("aria-pressed") === undefined),
    ).toBe(true);

    await radios[1]!.trigger("click");
    await flushPromises();
    expect(
      wrapper
        .findAll('[role="radio"]')
        .map((r) => r.attributes("aria-checked")),
    ).toEqual(["false", "true", "false"]);
    expect(wrapper.find('[data-testid="memory-summary"]').exists()).toBe(false);
  });

  it("keeps the search box a plain textbox", async () => {
    const wrapper = mountMemory();
    await flushPromises();
    const search = wrapper.get('[data-testid="memory-search"]');
    expect(search.attributes("type")).not.toBe("search");
  });

  /*
    四项元数据各有自己的规则：category 首字母大写、confidence 念**档位**、
    createdAt 走相对时间、source 是 manual 时念 manualFactSource、否则是一条
    能点进那条会话的链接。本仓原来四项全是原样输出。
  */
  it("presents the four fact metadata fields the way upstream does", async () => {
    const wrapper = mountMemory();
    await flushPromises();

    const factA = wrapper.get('[data-testid="memory-fact-fact-a"]');
    expect(factA.text()).toContain("Category: Preference");
    expect(factA.text()).toContain("Confidence: Very high");
    expect(factA.text()).not.toContain("0.92");
    expect(factA.text()).toContain(enUS.settings.memory.manualFactSource);
    expect(factA.find("a").exists()).toBe(false);

    const factB = wrapper.get('[data-testid="memory-fact-fact-b"]');
    expect(factB.text()).toContain("Confidence: High");
    const link = factB.get("a");
    expect(link.text()).toBe(enUS.settings.memory.markdown.table.view);
    expect(link.attributes("href")).toContain("thread-42");
  });

  /*
    元数据在上、正文在下（上游 memory-settings-page.tsx:665）。本仓原来倒过来。
  */
  it("puts the metadata row above the fact content", async () => {
    const wrapper = mountMemory();
    await flushPromises();
    const text = wrapper.get('[data-testid="memory-fact-fact-a"]').text();
    expect(text.indexOf("Category:")).toBeLessThan(
      text.indexOf("Prefers Chinese"),
    );
  });

  /*
    一页上有三对同名的 Edit / Delete，读屏器听到的是「Edit, Edit, Edit」。两边同改成
    带正文的名字（2026-09-02）。图标按钮本身不该有可见文字，否则名字会被念两遍。
  */
  it("names each row's icon buttons after the fact they act on", async () => {
    const wrapper = mountMemory();
    await flushPromises();

    const labels = wrapper
      .findAll('[data-testid^="memory-fact-"] button')
      .map((button) => button.attributes("aria-label"));
    expect(labels).toEqual([
      "Edit: Prefers Chinese for commit messages",
      "Delete: Prefers Chinese for commit messages",
      "Edit: Works in the monorepo",
      "Delete: Works in the monorepo",
    ]);
    expect(new Set(labels).size).toBe(labels.length);
    for (const button of wrapper.findAll(
      '[data-testid^="memory-fact-"] button',
    )) {
      expect(button.text()).toBe("");
      expect(button.attributes("title")).toBe(button.attributes("aria-label"));
    }
  });
});
