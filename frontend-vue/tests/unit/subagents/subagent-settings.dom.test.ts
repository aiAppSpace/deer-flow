/*
  【文件职责】     守住 subagent 设置屏：谁能写、哪些条目能写、冲突时怎么办、删除怎么确认。
  【架构位置】     测试
  【依赖关系】     SubagentSettings.vue · composables/useSubagents · useSettingsPermissions
  【边界与注意】   写入权限有两层：**用户是不是管理员**，和**这一条能不能改**
                   （builtin/config 来自代码和配置文件）。两层各有样本——
                   只测管理员那层的话，一个管理员就能"编辑"一条内置 subagent。

                   删除走本仓的确认对话框而不是 `window.confirm`（上游用的是后者），
                   所以这里断言的是那个对话框，不是 confirm 的 stub。
*/

import { flushPromises, mount } from "@vue/test-utils";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

const api = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("@/core/subagents/api", () => ({
  listSubagents: api.list,
  createManagedSubagent: api.create,
  updateManagedSubagent: api.update,
  deleteManagedSubagent: api.remove,
}));

const permissions = vi.hoisted(() => ({
  canManage: undefined as unknown as { value: boolean },
}));
vi.mock("@/composables/useSettingsPermissions", async () => {
  const { ref: makeRef } = await import("vue");
  permissions.canManage = makeRef(true);
  return {
    useSettingsPermissions: () => ({
      canManageMcp: permissions.canManage,
      canReadMcp: makeRef(true),
      canManageSkills: permissions.canManage,
      canReadSkills: makeRef(true),
    }),
  };
});
vi.mock("@/composables/useModels", () => ({
  useModels: () => ({ models: ref([]) }),
}));

import SubagentSettings from "@/components/workspace/settings/SubagentSettings.vue";
import { enUS } from "@/core/i18n/locales/en-US";
import type { Subagent } from "@/core/subagents";
import {
  createWorkspaceToastStore,
  workspaceToastKey,
} from "@/core/workspace-shell/toast";

let toastStore = createWorkspaceToastStore();

function subagent(overrides: Partial<Subagent> = {}): Subagent {
  return {
    name: "researcher",
    display_name: "Researcher",
    description: "Reads sources and summarises them.",
    system_prompt: "You research.",
    tools: null,
    disallowed_tools: null,
    skills: null,
    model: "inherit",
    max_turns: 50,
    timeout_seconds: 900,
    enabled: true,
    source: "managed",
    editable: true,
    conflict: false,
    config_overrides: {},
    ...overrides,
  };
}

beforeEach(() => {
  toastStore = createWorkspaceToastStore();
  permissions.canManage.value = true;
  api.list.mockReset();
  api.create.mockReset();
  api.update.mockReset();
  api.remove.mockReset();
  vi.stubGlobal("useNuxtApp", () => ({
    $i18n: { t: ref(enUS), locale: ref("en-US") },
  }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

function mountSettings() {
  return mount(SubagentSettings, {
    attachTo: document.body,
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
      provide: { [workspaceToastKey as symbol]: toastStore },
    },
  });
}

const row = (name: string) =>
  document.body.querySelector<HTMLElement>(`[data-testid="subagent-${name}"]`);

describe("SubagentSettings：谁能写", () => {
  it("非管理员看得见目录，但没有任何写入控件，并说清为什么", async () => {
    permissions.canManage.value = false;
    api.list.mockResolvedValue([subagent()]);
    const wrapper = mountSettings();
    await flushPromises();
    expect(wrapper.text()).toContain("Researcher");
    expect(wrapper.text()).toContain(enUS.settings.subagents.adminNote);
    expect(wrapper.find('[data-testid="subagent-create"]').exists()).toBe(
      false,
    );
    expect(row("researcher")!.querySelector("button")).toBeNull();
    wrapper.unmount();
  });

  it("管理员对不可编辑的条目同样没有写入控件", async () => {
    api.list.mockResolvedValue([
      subagent({ name: "builtin-one", source: "builtin", editable: false }),
      subagent({ name: "managed-one", source: "managed", editable: true }),
    ]);
    const wrapper = mountSettings();
    await flushPromises();
    // editable 是后端算好的结论，前端不自己从 source 推。
    expect(row("builtin-one")!.querySelector("button")).toBeNull();
    expect(row("managed-one")!.querySelector("button")).not.toBeNull();
    wrapper.unmount();
  });

  it("名字冲突时禁用启停：这一条压根没进运行时", async () => {
    api.list.mockResolvedValue([subagent({ conflict: true })]);
    const wrapper = mountSettings();
    await flushPromises();
    expect(wrapper.text()).toContain(enUS.settings.subagents.conflict);
    const toggle = row("researcher")!.querySelector('[role="switch"]')!;
    expect(toggle.getAttribute("data-disabled")).not.toBeNull();
    wrapper.unmount();
  });
});

describe("SubagentSettings", () => {
  it("列出来源徽章和 config.yaml 的覆盖项", async () => {
    api.list.mockResolvedValue([
      subagent({
        source: "config",
        editable: false,
        config_overrides: { model: "gpt-x", tools: ["a", "b"] },
      }),
    ]);
    const wrapper = mountSettings();
    await flushPromises();
    expect(wrapper.text()).toContain(enUS.settings.subagents.sourceConfig);
    expect(wrapper.text()).toContain("model=gpt-x");
    // 数组摊平成逗号串，而不是 [object Object] 或 JSON 引号。
    expect(wrapper.text()).toContain("tools=a, b");
    wrapper.unmount();
  });

  it("空目录说一句话，不是一片空白", async () => {
    api.list.mockResolvedValue([]);
    const wrapper = mountSettings();
    await flushPromises();
    expect(wrapper.text()).toContain(enUS.settings.subagents.empty);
    wrapper.unmount();
  });

  it("加载失败时把后端那句话显示出来", async () => {
    api.list.mockRejectedValue(new Error("gateway down"));
    const wrapper = mountSettings();
    await flushPromises();
    expect(wrapper.text()).toContain("gateway down");
    wrapper.unmount();
  });

  it("切开关发的是 enabled，成功后提示", async () => {
    api.list.mockResolvedValue([subagent({ enabled: true })]);
    api.update.mockResolvedValue(subagent({ enabled: false }));
    const wrapper = mountSettings();
    await flushPromises();
    await wrapper.find('[role="switch"]').trigger("click");
    await flushPromises();
    expect(api.update).toHaveBeenCalledWith("researcher", { enabled: false });
    expect(toastStore.toasts.value.at(-1)?.message).toBe(
      enUS.settings.subagents.saved,
    );
    wrapper.unmount();
  });

  it("删除要先确认，确认前不发请求", async () => {
    api.list.mockResolvedValue([subagent()]);
    api.remove.mockResolvedValue(undefined);
    const wrapper = mountSettings();
    await flushPromises();

    await row("researcher")!
      .querySelector<HTMLElement>(`button[aria-label="${enUS.common.delete}"]`)!
      .click();
    await flushPromises();
    expect(api.remove).not.toHaveBeenCalled();
    // 走的是本仓的确认对话框，不是 window.confirm。
    expect(document.body.textContent).toContain(
      enUS.settings.subagents.deleteConfirm,
    );

    const confirm = [...document.body.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === enUS.common.delete,
    )!;
    confirm.click();
    await flushPromises();
    expect(api.remove).toHaveBeenCalledWith("researcher");
    expect(toastStore.toasts.value.at(-1)?.message).toBe(
      enUS.settings.subagents.deleted,
    );
    wrapper.unmount();
  });
});
