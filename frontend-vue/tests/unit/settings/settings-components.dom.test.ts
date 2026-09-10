/*
  【文件职责】     固定Memory/Skills/MCP 设置页的预览确认、权限与 exact mutation DOM 行为。
  【架构位置】     Vue DOM test
  【主要导出】     无；Vitest cases
  【依赖关系】     Settings components · mocked query owners · i18n
  【边界与注意】   无效 import 必须零请求；普通用户只能读 skills 且不得触发 admin-only MCP I/O。
*/

import { flushPromises, mount } from "@vue/test-utils";
import { ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import MemorySettings from "@/components/workspace/settings/MemorySettings.vue";
import SkillSettings from "@/components/workspace/settings/SkillSettings.vue";
import ToolSettings from "@/components/workspace/settings/ToolSettings.vue";
import { enUS } from "@/core/i18n/locales/en-US";
import type { UserMemory } from "@/core/memory/types";
import {
  createWorkspaceToastStore,
  workspaceToastKey,
} from "@/core/workspace-shell/toast";

const toastStore = createWorkspaceToastStore();

const memoryFactory = vi.hoisted(() => vi.fn());
const permissionsFactory = vi.hoisted(() => vi.fn());
const skillsFactory = vi.hoisted(() => vi.fn());
const mcpFactory = vi.hoisted(() => vi.fn());

vi.mock("@/composables/useMemory", () => ({ useMemory: memoryFactory }));
vi.mock("@/composables/useSettingsPermissions", () => ({
  useSettingsPermissions: permissionsFactory,
}));
vi.mock("@/composables/useSkillSettings", () => ({
  useSkillSettings: skillsFactory,
}));
vi.mock("@/composables/useMCPConfig", async () => {
  const { ref: makeRef } = await import("vue");
  return {
    useMCPConfig: mcpFactory,
    // 增删改那份 mutation：这一组用例只看权限与开关，给个惰性替身就够。
    useMCPServerMutations: () => ({
      mutateAsync: vi.fn(),
      isPending: makeRef(false),
      error: makeRef(null),
    }),
  };
});
vi.mock("@/composables/useSettingsDialog", () => ({
  useSettingsDialog: () => ({ close: vi.fn() }),
}));

const memory: UserMemory = {
  version: "2.0",
  revision: 4,
  lastUpdated: "2026-08-22T00:00:00Z",
  user: {
    workContext: { summary: "Vue parity", updatedAt: "2026-08-22" },
    personalContext: { summary: "", updatedAt: "" },
    topOfMind: { summary: "Recent work", updatedAt: "2026-08-22" },
  },
  history: {
    recentMonths: { summary: "Settings", updatedAt: "2026-08-22" },
    earlierContext: { summary: "", updatedAt: "" },
    longTermBackground: { summary: "", updatedAt: "" },
  },
  facts: [
    {
      id: "fact-a",
      content: "Explicit zero is valid",
      category: "contract",
      confidence: 0.8,
      createdAt: "2026-08-22",
      source: "manual",
      revision: 2,
    },
  ],
};

function mutation(result: UserMemory = memory) {
  return {
    isPending: ref(false),
    error: ref<Error | null>(null),
    mutateAsync: vi.fn().mockResolvedValue(result),
  };
}

function memoryOwner() {
  return {
    memory: ref(memory),
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
  };
}

function permissions(admin: boolean) {
  const value = {
    state: "authenticated" as const,
    role: admin ? ("admin" as const) : ("user" as const),
    canReadSkills: true,
    canManageSkills: admin,
    canReadMcp: admin,
    canManageMcp: admin,
    adminRequired: !admin,
  };
  return {
    permissions: ref(value),
    canReadSkills: ref(true),
    canManageSkills: ref(admin),
    canReadMcp: ref(admin),
    canManageMcp: ref(admin),
  };
}

function selectFile(wrapper: ReturnType<typeof mount>, file: object) {
  const input = wrapper.get('[data-testid="memory-import-file"]');
  Object.defineProperty(input.element, "files", {
    configurable: true,
    value: [file],
  });
  return input.trigger("change");
}

beforeEach(() => {
  /*
    locale 不能省：记忆面板用它把时间戳格式化成「about 1 month ago」
    （core/utils/datetime 的 formatTimeAgo，与 React 逐字一致）。
    只喂 `t` 的话组件在读 `$i18n.locale.value` 时直接抛。
  */
  vi.stubGlobal("useNuxtApp", () => ({
    $i18n: { t: ref(enUS), locale: ref("en-US") },
  }));
  vi.stubGlobal("navigateTo", vi.fn());
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

/**
 * SettingsActionDialog 现在建在 ui/dialog · ui/alert-dialog 上：内容 portal 到 body，
 * 破坏性确认是 alertdialog、带表单的是 dialog（alertdialog 只该用于「确认/取消」两个
 * 出口的中断，装表单会让读屏器把整张表单读成一条警告）。
 */
function portalDialog(role: "dialog" | "alertdialog" = "dialog") {
  const element = document.querySelector<HTMLElement>(`[role="${role}"]`);
  expect(element, `no [role="${role}"] in the document`).not.toBeNull();
  return element!;
}

function dialogButtons(role: "dialog" | "alertdialog" = "dialog") {
  return [...portalDialog(role).querySelectorAll<HTMLButtonElement>("button")];
}

function inPortal<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  expect(element, `${selector} not found in the document`).not.toBeNull();
  return element!;
}

function setPortalValue(selector: string, value: string) {
  const field = inPortal<HTMLInputElement | HTMLTextAreaElement>(selector);
  field.value = value;
  field.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("MemorySettings", () => {
  it("rejects malformed and structurally invalid imports without a network request", async () => {
    const owner = memoryOwner();
    memoryFactory.mockReturnValue(owner);
    const wrapper = mount(MemorySettings, {
      attachTo: document.body,
      global: { provide: { [workspaceToastKey as symbol]: toastStore } },
    });

    await selectFile(wrapper, {
      name: "malformed.json",
      text: vi.fn().mockResolvedValue("{oops"),
    });
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain("malformed-json");
    expect(owner.importDocument.mutateAsync).not.toHaveBeenCalled();

    await selectFile(wrapper, {
      name: "partial.json",
      text: vi.fn().mockResolvedValue(JSON.stringify({ version: "2.0" })),
    });
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain("missing-field");
    expect(owner.importDocument.mutateAsync).not.toHaveBeenCalled();
  });

  it("shows complete import preview and warnings before one confirmed request", async () => {
    const owner = memoryOwner();
    memoryFactory.mockReturnValue(owner);
    const wrapper = mount(MemorySettings, {
      attachTo: document.body,
      global: { provide: { [workspaceToastKey as symbol]: toastStore } },
    });
    const imported = {
      ...memory,
      futureRoot: true,
      facts: [memory.facts[0], { ...memory.facts[0], id: "fact-b" }],
    };
    await selectFile(wrapper, {
      name: "memory.json",
      text: vi.fn().mockResolvedValue(JSON.stringify(imported)),
    });
    await flushPromises();

    const dialog = portalDialog();
    expect(dialog.textContent).toContain("memory.json");
    expect(dialog.textContent).toContain("2.0");
    expect(dialog.textContent).toContain("2026-08-22T00:00:00Z");
    expect(
      inPortal('[data-testid="memory-import-extra-warning"]').textContent,
    ).toContain("Gateway");
    expect(
      inPortal('[data-testid="memory-import-duplicate-warning"]').textContent,
    ).toContain("different");
    expect(owner.importDocument.mutateAsync).not.toHaveBeenCalled();
    dialogButtons()
      .find((button) => button.textContent?.trim() === "Import")!
      .click();
    await flushPromises();
    expect(owner.importDocument.mutateAsync).toHaveBeenCalledTimes(1);
    expect(owner.importDocument.mutateAsync).toHaveBeenCalledWith(imported);
  });

  /*
    六条**成功播报**（上游 memory-settings-page.tsx 的 :396 / :435 / :445 / :457 /
    :510 / :513）。本仓此前一条都没有——删掉一条记忆、清空整份文档、导入一份文件，
    屏幕上除了对话框关掉之外没有任何确认。

    交接文档把这几条词条记成「上游自己也零消费」，**记错了**：只有 `rawJson` 是，
    其余五条上游都在 toast，再加上被 `common.exportSuccess` 同名叶子遮蔽的
    `exportSuccess`，一共六条（wave 34 复量）。

    这一屏进不了对照台账：settings 的七个面板里只有 `settings-notification` 有合法的
    场景 id（棘轮要求 id 逐字等于 React spec 文件名），memory 面板没有。
  */
  it("announces every successful memory write", async () => {
    const owner = memoryOwner();
    memoryFactory.mockReturnValue(owner);
    const wrapper = mount(MemorySettings, {
      attachTo: document.body,
      global: { provide: { [workspaceToastKey as symbol]: toastStore } },
    });
    const messages = () => toastStore.toasts.value.map((item) => item.message);

    // 删一条事实
    toastStore.clear();
    // 删除键的名字是 `factActionLabel(t.common.delete, fact)`，没有 testid。
    await wrapper.findAll('button[aria-label^="Delete"]')[0]!.trigger("click");
    await flushPromises();
    dialogButtons("alertdialog")[1]!.click();
    await flushPromises();
    expect(messages()).toEqual([enUS.settings.memory.factDeleteSuccess]);

    // 清空整份文档
    toastStore.clear();
    await wrapper.get('[data-testid="memory-clear-open"]').trigger("click");
    await flushPromises();
    dialogButtons("alertdialog")[1]!.click();
    await flushPromises();
    expect(messages()).toEqual([enUS.settings.memory.clearAllSuccess]);
  });

  it("retains failed destructive dialogs and sends exact create/edit confidence zero", async () => {
    const owner = memoryOwner();
    owner.clear.mutateAsync.mockRejectedValue(new Error("Conflict detail"));
    memoryFactory.mockReturnValue(owner);
    const wrapper = mount(MemorySettings, {
      attachTo: document.body,
      global: { provide: { [workspaceToastKey as symbol]: toastStore } },
    });

    await wrapper.get('[data-testid="memory-clear-open"]').trigger("click");
    await flushPromises();
    dialogButtons("alertdialog")[1]!.click();
    await flushPromises();
    expect(portalDialog("alertdialog").textContent).toContain(
      "Conflict detail",
    );

    dialogButtons("alertdialog")[0]!.click();
    await flushPromises();
    await wrapper.get('[data-testid="memory-add-fact"]').trigger("click");
    await flushPromises();
    setPortalValue('[data-testid="memory-fact-content"]', "Zero");
    setPortalValue('[data-testid="memory-fact-confidence"]', "0");
    await flushPromises();
    dialogButtons()[1]!.click();
    await flushPromises();
    expect(owner.create.mutateAsync).toHaveBeenCalledWith({
      content: "Zero",
      category: "context",
      confidence: 0,
    });

    await wrapper.get('button[aria-label^="Edit:"]').trigger("click");
    await flushPromises();
    setPortalValue('[data-testid="memory-fact-confidence"]', "0");
    await flushPromises();
    dialogButtons()[1]!.click();
    await flushPromises();
    expect(owner.update.mutateAsync).toHaveBeenCalledWith({
      factId: "fact-a",
      input: { confidence: 0 },
    });
  });

  it("distinguishes a non-empty no-match search from fully empty memory", async () => {
    const owner = memoryOwner();
    memoryFactory.mockReturnValue(owner);
    const wrapper = mount(MemorySettings, {
      attachTo: document.body,
      global: { provide: { [workspaceToastKey as symbol]: toastStore } },
    });
    await wrapper.get('[data-testid="memory-search"]').setValue("absent");
    expect(wrapper.find('[data-testid="memory-no-matches"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('[data-testid="memory-empty"]').exists()).toBe(false);
  });
});

describe("role-aware skill and MCP settings", () => {
  it("keeps ordinary-user skills readable but disables mutation and does not expose MCP data", () => {
    permissionsFactory.mockReturnValue(permissions(false));
    skillsFactory.mockReturnValue({
      skills: ref([
        {
          name: "review",
          description: "Review",
          category: "public",
          license: null,
          enabled: true,
          editable: false,
        },
      ]),
      loading: ref(false),
      error: ref(null),
      pending: ref(false),
      toggle: vi.fn(),
    });
    mcpFactory.mockReturnValue({
      config: ref(undefined),
      loading: ref(false),
      error: ref(null),
      mutationError: ref(null),
      pending: ref(false),
      toggle: vi.fn(),
    });
    const skill = mount(SkillSettings, {
      // 本地安装 .skill 会弹提示，所以这一屏现在要有 toast owner。
      global: { provide: { [workspaceToastKey as symbol]: toastStore } },
    });
    expect(skill.text()).toContain("review");
    expect(skill.get('[role="switch"]').attributes("disabled")).toBeDefined();
    expect(skill.find('[data-testid="skills-admin-required"]').exists()).toBe(
      true,
    );
    const tool = mount(ToolSettings);
    expect(tool.find('[data-testid="mcp-admin-required"]').exists()).toBe(true);
    expect(tool.find('[role="switch"]').exists()).toBe(false);
  });

  it("lets admin toggle once while keeping server response ownership in the composable", async () => {
    permissionsFactory.mockReturnValue(permissions(true));
    const skillToggle = vi.fn().mockResolvedValue(undefined);
    const mcpToggle = vi.fn().mockResolvedValue(undefined);
    skillsFactory.mockReturnValue({
      skills: ref([
        {
          name: "review",
          description: "Review",
          category: "public",
          license: null,
          enabled: true,
          editable: false,
        },
      ]),
      loading: ref(false),
      error: ref(null),
      pending: ref(false),
      toggle: skillToggle,
    });
    mcpFactory.mockReturnValue({
      config: ref({
        mcp_servers: { docs: { enabled: true, description: "Docs" } },
      }),
      loading: ref(false),
      error: ref(null),
      mutationError: ref(null),
      pending: ref(false),
      toggle: mcpToggle,
    });
    // Switch 是受控的：视觉状态只跟随服务端真相，点击只发出请求。
    const skill = mount(SkillSettings, {
      // 本地安装 .skill 会弹提示，所以这一屏现在要有 toast owner。
      global: { provide: { [workspaceToastKey as symbol]: toastStore } },
    });
    await skill.get('[role="switch"]').trigger("click");
    expect(skillToggle).toHaveBeenCalledWith("review", false);
    const tool = mount(ToolSettings);
    await tool.get('[role="switch"]').trigger("click");
    expect(mcpToggle).toHaveBeenCalledWith("docs", false);
  });
});
