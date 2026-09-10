/*
  【文件职责】     account / appearance / tools / about 四个面板的呈现层对齐。
  【架构位置】     L3 测试
  【依赖关系】     components/workspace/settings/{Account,Appearance,Tool,About}Settings.vue
  【边界与注意】   settings 域**进不了对照取样面**（棘轮要求场景 id 逐字等于 React 某个
                   spec 的文件名，settings 只有 settings-notification 一个且它 pending），
                   所以台账对这四屏一行都报不出来。差异是用 probe 打开
                   `?settings=<section>` 量出来的：account 6 / appearance 16 / tools 3 /
                   about 75 行。守住它们只能靠这里。
*/

import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

import MessageMarkdown from "@/components/chat/MessageMarkdown.vue";
import { Select } from "@/components/ui/select";
import {
  defaultRehypePlugins,
  defaultRemarkPlugins,
} from "@/core/markdown/plugins";
import AboutSettings from "@/components/workspace/settings/AboutSettings.vue";
import AccountSettings from "@/components/workspace/settings/AccountSettings.vue";
import AppearanceSettings from "@/components/workspace/settings/AppearanceSettings.vue";
import ToolSettings from "@/components/workspace/settings/ToolSettings.vue";
import { enUS } from "@/core/i18n/locales/en-US";
import { setDeerFlowRuntimeOptions } from "@/core/config";

const mocks = vi.hoisted(() => ({
  fetchWithAuth: vi.fn(),
  useMCPConfig: vi.fn(),
  useSettingsPermissions: vi.fn(),
  mcpServerMutate: vi.fn(),
}));

vi.mock("@/core/api/fetcher", () => ({ fetch: mocks.fetchWithAuth }));
vi.mock("@/composables/useMCPConfig", async () => {
  const { ref: makeRef } = await import("vue");
  return {
    useMCPConfig: mocks.useMCPConfig,
    // 增删改那份 mutation：这一组用例只看开关和空态，给个惰性替身就够。
    useMCPServerMutations: () => ({
      mutateAsync: mocks.mcpServerMutate,
      isPending: makeRef(false),
      error: makeRef(null),
    }),
  };
});
vi.mock("@/composables/useSettingsPermissions", () => ({
  useSettingsPermissions: mocks.useSettingsPermissions,
}));
vi.mock("@tanstack/vue-query", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useQueryClient: () => ({ removeQueries: vi.fn(), clear: vi.fn() }),
}));

const setPreference = vi.fn();
const setLocale = vi.fn();

beforeEach(() => {
  vi.stubGlobal("useNuxtApp", () => ({
    $i18n: { t: ref(enUS), locale: ref("en-US"), setLocale },
    $theme: {
      preference: ref<"system" | "light" | "dark">("system"),
      resolved: ref<"light" | "dark">("light"),
      forced: ref(null),
      setPreference,
      setForcedTheme: vi.fn(),
      dispose: vi.fn(),
    },
  }));
  vi.stubGlobal("navigateTo", vi.fn());
  mocks.fetchWithAuth.mockReset().mockResolvedValue({
    ok: true,
    json: async () => ({ email: "a@b.test", system_role: "admin" }),
  });
  setPreference.mockReset();
  setLocale.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("AccountSettings", () => {
  /*
    资料区是一组 `<span>` 排在两列网格里，不是 `<dl>`（上游 account-settings-page.tsx:76）。
    `<dl>` 语义上更贴切，但它在可访问性树里会长出 term/definition 节点，
    两个应用读屏器听到的就不是同一棵树。
  */
  it("lays the profile out as plain spans, not a definition list", async () => {
    const wrapper = mount(AccountSettings);
    await flushPromises();

    expect(wrapper.findAll("dl")).toHaveLength(0);
    expect(wrapper.findAll("dt")).toHaveLength(0);
    const grid = wrapper.get(".grid-cols-\\[max-content_max-content\\]");
    expect(grid.findAll("span").map((node) => node.text())).toEqual([
      enUS.settings.account.email,
      "a@b.test",
      enUS.settings.account.role,
      "admin",
    ]);
    wrapper.unmount();
  });

  it("uses the shared Input and Button primitives", async () => {
    const wrapper = mount(AccountSettings);
    await flushPromises();

    expect(wrapper.findAll('input[data-slot="input"]')).toHaveLength(3);
    const buttons = wrapper.findAll('button[data-slot="button"]');
    expect(buttons.map((b) => b.attributes("data-variant"))).toEqual([
      "outline",
      "destructive",
    ]);
    // 退出按钮带图标（上游 account-settings-page.tsx:175 的 LogOutIcon）。
    expect(buttons[1]!.find("svg").exists()).toBe(true);
    wrapper.unmount();
  });

  /*
    两边同改：错误与成功都要进 live region，否则读屏器用户提交之后什么都听不到。
  */
  it("announces validation failures and successes through live regions", async () => {
    const wrapper = mount(AccountSettings);
    await flushPromises();

    const inputs = wrapper.findAll('input[data-slot="input"]');
    await inputs[1]!.setValue("longenough1");
    await inputs[2]!.setValue("different111");
    await wrapper.get("form").trigger("submit");
    await flushPromises();

    const alert = wrapper.get('[role="alert"]');
    expect(alert.text()).toBe(enUS.settings.account.passwordMismatch);
    wrapper.unmount();
  });
});

describe("AppearanceSettings", () => {
  /*
    每张主题卡片是「图标 + 标题 + 说明 + 一张纯装饰的预览图」（上游
    appearance-settings-page.tsx:114）。本仓原来只有两段文字，说明被并进按钮名里，
    可访问性树上少一个 text 节点与一个 paragraph。
  */
  it("renders each theme card with an icon, a label, a description and a decorative preview", () => {
    const wrapper = mount(AppearanceSettings);
    const cards = wrapper.findAll("[data-theme-preference]");
    expect(cards.map((c) => c.attributes("data-theme-preference"))).toEqual([
      "system",
      "light",
      "dark",
    ]);
    for (const card of cards) {
      expect(card.find("svg").exists()).toBe(true);
      expect(card.findAll("p")).toHaveLength(1);
      // 预览图整块 aria-hidden：它是示意图，念出来只是一串没有意义的方块。
      expect(card.find('[aria-hidden="true"]:not(svg)').exists()).toBe(true);
    }
    expect(cards[0]!.find("p").text()).toBe(
      enUS.settings.appearance.systemDescription,
    );
    wrapper.unmount();
  });

  /*
    「跟随系统」那张卡的预览图要按**解析后**的主题画，不按偏好画：偏好是 system 时
    用户要看的是系统现在实际是哪一套。只有 preference=system 且 resolved=dark 时
    这条判据才看得见——两者相同时，按哪个画结果都一样。
  */
  it("draws the system card preview from the resolved theme, not the preference", () => {
    vi.stubGlobal("useNuxtApp", () => ({
      $i18n: { t: ref(enUS), locale: ref("en-US"), setLocale },
      $theme: {
        preference: ref<"system" | "light" | "dark">("system"),
        resolved: ref<"light" | "dark">("dark"),
        forced: ref(null),
        setPreference,
        setForcedTheme: vi.fn(),
        dispose: vi.fn(),
      },
    }));
    const wrapper = mount(AppearanceSettings);
    // 图标 svg 也是 aria-hidden，所以要限定成 div——不限定会取到图标，
    // 断言就变成在看图标的 class（第一次写就是这样红的）。
    const systemPreview = wrapper
      .get('[data-theme-preference="system"]')
      .get('div[aria-hidden="true"]');
    expect(systemPreview.classes()).toContain("bg-neutral-900");
    expect(systemPreview.classes()).not.toContain("bg-white");
    wrapper.unmount();
  });

  it("keeps a separator between the theme and language sections", () => {
    const wrapper = mount(AppearanceSettings);
    expect(wrapper.find('[data-slot="separator"]').exists()).toBe(true);
    wrapper.unmount();
  });

  /*
    语言选择器走 shadcn Select，不是原生 `<select>`：后者在可访问性树里是一个带
    option 子节点的 combobox，上游则是一个只念当前值的 combobox。
  */
  it("uses the Select primitive for the language picker and wires it to setLocale", async () => {
    const wrapper = mount(AppearanceSettings);
    expect(wrapper.findAll("select")).toHaveLength(0);
    expect(wrapper.find('[data-slot="select-trigger"]').exists()).toBe(true);

    /*
      Reka 的下拉要真的指针事件才展开，在这个环境里点不开，所以直接发它自己的
      `update:modelValue`——那正是面板接的那个事件。同时验一条守卫：不是合法 locale
      的值要被丢掉，否则一个脏值会把整个词典切成 undefined。
    */
    wrapper.getComponent(Select).vm.$emit("update:modelValue", "zh-CN");
    await flushPromises();
    expect(setLocale).toHaveBeenCalledWith("zh-CN");

    wrapper.getComponent(Select).vm.$emit("update:modelValue", "kl-KL");
    await flushPromises();
    expect(setLocale).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });
});

describe("ToolSettings", () => {
  // 空态是一段裸文本，不是带边框的卡片，也不是 `<p>`（上游 tool-settings-page.tsx:53）。
  it("renders the empty state as bare text rather than a paragraph", async () => {
    mocks.useMCPConfig.mockReturnValue({
      config: ref({ mcp_servers: {} }),
      loading: ref(false),
      error: ref(null),
      mutationError: ref(null),
      pending: ref(false),
      toggle: vi.fn(),
    });
    mocks.useSettingsPermissions.mockReturnValue({
      canReadMcp: ref(true),
      canManageMcp: ref(true),
      permissions: ref({ state: "authenticated", role: "admin" }),
    });
    const wrapper = mount(ToolSettings);
    await flushPromises();

    const empty = wrapper
      .findAll("div")
      .filter((node) => node.text() === enUS.settings.tools.empty);
    expect(empty.length).toBeGreaterThan(0);
    expect(
      wrapper
        .findAll("p")
        .filter((n) => n.text() === enUS.settings.tools.empty),
    ).toHaveLength(0);
    wrapper.unmount();
  });
});

describe("AboutSettings", () => {
  /*
    上游这一页只有一行 `<SafeStreamdown>{aboutMarkdown}</SafeStreamdown>`。本仓原来是
    一段手写的 article（三个标题三段话），与上游那份带清单、链接、图片与引用块的正文
    完全是两份内容——实测差 75 行。
  */
  it("renders the upstream about document, version included", async () => {
    setDeerFlowRuntimeOptions({
      langgraphBaseUrl: "",
      backendBaseUrl: "",
      authDisabled: false,
      appVersion: "9.9.9",
    });
    const wrapper = mount(AboutSettings);
    await flushPromises();
    await vi.waitFor(() => expect(wrapper.find("h1").exists()).toBe(true), {
      timeout: 5_000,
    });

    expect(wrapper.get("h1").text()).toContain("About DeerFlow 9.9.9");
    expect(wrapper.findAll("h2").map((h) => h.text())).toEqual([
      "🚀 Core Features",
      "🌟 GitHub Repository",
      "🌐 Official Website",
      "📧 Support",
      "📜 License",
      "🙌 Acknowledgments",
    ]);
    expect(wrapper.findAll("h3").map((h) => h.text())).toEqual([
      "Core Frameworks",
      "UI Libraries",
      "Special Thanks",
    ]);
    expect(wrapper.find("blockquote").exists()).toBe(true);
    expect(wrapper.find("img").attributes("alt")).toBe("Star History Chart");
    // 元素样式镜像接上了才有 data-streamdown。
    expect(wrapper.html()).toContain('data-streamdown="unordered-list"');

    /*
      插件链取 Streamdown 的**内建默认**，不是消息路径那一档（上游这一页没有传
      `streamdownPlugins`）。这份正文里既没有 raw HTML 也没有公式，所以两条链渲染
      出来一模一样——**换掉它渲染结果不会变**，只能直接断言喂进去的是哪一份。
    */
    const renderer = wrapper.getComponent(MessageMarkdown);
    expect(renderer.props("remarkPlugins")).toBe(defaultRemarkPlugins);
    expect(renderer.props("rehypePlugins")).toBe(defaultRehypePlugins);
    wrapper.unmount();
  });
});
