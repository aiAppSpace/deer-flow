/*
  【文件职责】     守住托管 subagent 编辑器：必填、名字规则、三态落到请求体上。
  【架构位置】     测试
  【依赖关系】     SubagentEditorDialog.vue · composables/useSubagents
  【边界与注意】   保存键的禁用条件要与后端的必填**一致**：少一条，用户点下去
                   只会拿到一个 422，而界面上没有任何地方说过哪里不对。
                   所以每一条必填各有一个样本。
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
vi.mock("@/composables/useModels", () => ({
  useModels: () => ({ models: ref([]) }),
}));

import SubagentEditorDialog from "@/components/workspace/settings/subagents/SubagentEditorDialog.vue";
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
    description: "Reads sources.",
    system_prompt: "You research.",
    tools: ["read", "search"],
    disallowed_tools: null,
    skills: [],
    model: "inherit",
    max_turns: 20,
    timeout_seconds: 300,
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
  api.create.mockReset();
  api.update.mockReset();
  api.create.mockResolvedValue(subagent());
  api.update.mockResolvedValue(subagent());
  vi.stubGlobal("useNuxtApp", () => ({
    $i18n: { t: ref(enUS), locale: ref("en-US") },
  }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

function mountEditor(value: Subagent | "new" | null) {
  return mount(SubagentEditorDialog, {
    props: { value },
    attachTo: document.body,
    global: {
      plugins: [[VueQueryPlugin, { queryClient: new QueryClient() }]],
      provide: { [workspaceToastKey as symbol]: toastStore },
    },
  });
}

const field = (label: string) => {
  const wrap = [...document.body.querySelectorAll("label")].find(
    (node) => node.querySelector("span")?.textContent?.trim() === label,
  );
  return wrap?.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    "input, textarea",
  );
};
const saveButton = () =>
  [...document.body.querySelectorAll("button")].find(
    (button) => button.textContent?.trim() === enUS.common.save,
  )!;

async function type(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string,
) {
  element.value = value;
  element.dispatchEvent(new Event("input", { bubbles: true }));
  await flushPromises();
}

describe("SubagentEditorDialog", () => {
  it("编辑时名字禁用：改名等于删了重建，不是同一件事", async () => {
    const wrapper = mountEditor(subagent());
    await flushPromises();
    expect(field(enUS.settings.subagents.name)!.disabled).toBe(true);
    // 新建时可改，并给出命名规则提示。
    wrapper.unmount();
    const fresh = mountEditor("new");
    await flushPromises();
    expect(field(enUS.settings.subagents.name)!.disabled).toBe(false);
    expect(document.body.textContent).toContain(
      enUS.settings.subagents.nameHint,
    );
    fresh.unmount();
  });

  it("把已有值填回表单，三态各归各位", async () => {
    const wrapper = mountEditor(
      subagent({ tools: ["read", "search"], skills: [] }),
    );
    await flushPromises();
    expect(field(enUS.settings.subagents.maxTurns)!.value).toBe("20");
    expect(field(enUS.settings.subagents.timeout)!.value).toBe("300");
    /*
      tools 有内容 → selected，名字串填在那个输入框里；skills 是 [] → none。
      两个模式下拉的当前值也要不一样——它们是「全都给」和「一个都不给」的
      唯一区别所在。
    */
    const nameInputs = [
      ...document.body.querySelectorAll<HTMLInputElement>(
        `input[placeholder="${enUS.settings.subagents.listNamesPlaceholder}"]`,
      ),
    ];
    expect(nameInputs).toHaveLength(1);
    expect(nameInputs[0]!.value).toBe("read, search");
    expect(document.body.textContent).toContain(
      enUS.settings.subagents.listModeSelected,
    );
    expect(document.body.textContent).toContain(
      enUS.settings.subagents.listModeNone,
    );
    wrapper.unmount();
  });

  it.each([
    ["名字为空", enUS.settings.subagents.name, ""],
    ["名字带空格", enUS.settings.subagents.name, "bad name"],
    ["描述为空", enUS.settings.subagents.descriptionLabel, "   "],
    ["系统提示为空", enUS.settings.subagents.systemPrompt, "  "],
    ["轮数不是正整数", enUS.settings.subagents.maxTurns, "0"],
    ["超时不是正整数", enUS.settings.subagents.timeout, "-5"],
  ])("%s 时保存键禁用", async (_label, fieldLabel, value) => {
    const wrapper = mountEditor("new");
    await flushPromises();
    // 先填一份合法的，再把这一项改坏——否则分不清是这一项还是别的项挡住了。
    await type(field(enUS.settings.subagents.name)!, "ok-name");
    await type(field(enUS.settings.subagents.descriptionLabel)!, "does things");
    await type(field(enUS.settings.subagents.systemPrompt)!, "be useful");
    expect(saveButton().hasAttribute("disabled")).toBe(false);

    await type(field(fieldLabel)!, value);
    expect(saveButton().hasAttribute("disabled")).toBe(true);
    wrapper.unmount();
  });

  it("新建时把三态送进请求体，空显示名送 null", async () => {
    const wrapper = mountEditor("new");
    await flushPromises();
    await type(field(enUS.settings.subagents.name)!, " ok-name ");
    await type(
      field(enUS.settings.subagents.descriptionLabel)!,
      " does things ",
    );
    await type(field(enUS.settings.subagents.systemPrompt)!, " be useful ");
    saveButton().click();
    await flushPromises();

    expect(api.create).toHaveBeenCalledWith({
      name: "ok-name",
      display_name: null,
      description: "does things",
      system_prompt: "be useful",
      model: "inherit",
      // 默认三态是「全部」，送的是 null 而不是 []。
      tools: null,
      skills: null,
      max_turns: 50,
      timeout_seconds: 900,
    });
    expect(toastStore.toasts.value.at(-1)?.message).toBe(
      enUS.settings.subagents.created,
    );
    wrapper.unmount();
  });

  it("编辑时用原来的名字发 PUT，请求体里没有 name", async () => {
    const wrapper = mountEditor(subagent({ name: "researcher" }));
    await flushPromises();
    await type(field(enUS.settings.subagents.displayName)!, "New label");
    saveButton().click();
    await flushPromises();
    const [name, request] = api.update.mock.calls[0]!;
    expect(name).toBe("researcher");
    expect("name" in request).toBe(false);
    expect(request.display_name).toBe("New label");
    wrapper.unmount();
  });

  it("保存失败把后端那句话说出来，对话框不关", async () => {
    api.update.mockRejectedValueOnce(new Error("name already exists"));
    const wrapper = mountEditor(subagent());
    await flushPromises();
    saveButton().click();
    await flushPromises();
    expect(toastStore.toasts.value.at(-1)?.message).toBe("name already exists");
    expect(wrapper.emitted("close")).toBeUndefined();
    wrapper.unmount();
  });
});
