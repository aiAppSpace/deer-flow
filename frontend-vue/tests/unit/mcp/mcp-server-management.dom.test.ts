/*
  【文件职责】     守住 MCP server 的增/改/删：校验在哪一步拦住、错误说的是哪一条。
  【架构位置】     测试
  【依赖关系】     ToolSettings.vue · core/mcp/parse · composables/useMCPConfig
  【边界与注意】   这一屏的校验有**四种拦法**，每一种给的是不同的话：
                   解析不了（六种错误码）、加的时候重名、改的时候一次改了多个、
                   改的时候把名字改了。任何一种说错话，用户都不知道自己该改哪儿。

                   失败时对话框**不关**——用户改了半天的 JSON 不能就这么没了。
*/

import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

const mcp = vi.hoisted(() => ({
  config: undefined as unknown as { value: unknown },
  mutate: vi.fn(),
  pending: undefined as unknown as { value: boolean },
  toggle: vi.fn(),
}));
vi.mock("@/composables/useMCPConfig", async () => {
  const { ref: makeRef } = await import("vue");
  mcp.config = makeRef({ mcp_servers: {} });
  mcp.pending = makeRef(false);
  return {
    useMCPConfig: () => ({
      config: mcp.config,
      loading: makeRef(false),
      fetching: makeRef(false),
      error: makeRef(null),
      refetch: vi.fn(),
      toggle: mcp.toggle,
      pending: makeRef(false),
      mutationError: makeRef(null),
    }),
    useMCPServerMutations: () => ({
      mutateAsync: mcp.mutate,
      isPending: mcp.pending,
      error: makeRef(null),
    }),
  };
});
vi.mock("@/composables/useSettingsPermissions", async () => {
  const { computed, ref: makeRef } = await import("vue");
  const permissions = makeRef({
    state: "ready",
    adminRequired: false,
    canManageMcp: true,
  });
  return {
    useSettingsPermissions: () => ({
      permissions,
      canManageMcp: computed(() => permissions.value.canManageMcp),
      canReadMcp: makeRef(true),
      canManageSkills: makeRef(true),
      canReadSkills: makeRef(true),
    }),
  };
});

import ToolSettings from "@/components/workspace/settings/ToolSettings.vue";
import { enUS } from "@/core/i18n/locales/en-US";

const labels = enUS.settings.tools;

beforeEach(() => {
  mcp.mutate.mockReset();
  mcp.mutate.mockResolvedValue({ mcp_servers: {} });
  mcp.pending.value = false;
  mcp.config.value = {
    mcp_servers: {
      github: { enabled: true, description: "GitHub tools", command: "npx" },
    },
  };
  vi.stubGlobal("useNuxtApp", () => ({
    $i18n: { t: ref(enUS), locale: ref("en-US") },
  }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

function mountTools() {
  return mount(ToolSettings, { attachTo: document.body });
}

const definitionBox = () =>
  document.body.querySelector<HTMLTextAreaElement>(
    `textarea[aria-label="${labels.serverDefinitionLabel}"]`,
  )!;
const buttonWithText = (text: string) =>
  [...document.body.querySelectorAll("button")].find(
    (button) => button.textContent?.trim() === text,
  );
const definitionError = () =>
  document.body
    .querySelector('[data-testid="mcp-definition-error"]')
    ?.textContent?.trim() ?? "";

async function openAdd(wrapper: ReturnType<typeof mountTools>) {
  document.body
    .querySelector<HTMLElement>('[data-testid="mcp-add-server"]')!
    .click();
  await flushPromises();
  await wrapper.vm.$nextTick();
}

async function typeDefinition(
  wrapper: ReturnType<typeof mountTools>,
  value: string,
) {
  const box = definitionBox();
  box.value = value;
  box.dispatchEvent(new Event("input", { bubbles: true }));
  await flushPromises();
  await wrapper.vm.$nextTick();
}

async function save(wrapper: ReturnType<typeof mountTools>) {
  buttonWithText(enUS.common.save)!.click();
  await flushPromises();
  await wrapper.vm.$nextTick();
}

describe("MCP server 增删改", () => {
  it("粘一段 README 里的 JSON 就能加进来", async () => {
    const wrapper = mountTools();
    await openAdd(wrapper);
    await typeDefinition(
      wrapper,
      '{"mcpServers": {"fs": {"command": "npx", "args": ["-y", "fs"]}}}',
    );
    await save(wrapper);
    expect(mcp.mutate).toHaveBeenCalledWith({
      operation: "create",
      servers: {
        // 刚粘进来的默认启用。
        fs: {
          enabled: true,
          description: "",
          command: "npx",
          args: ["-y", "fs"],
        },
      },
    });
    wrapper.unmount();
  });

  it.each([
    ["空白", "   ", labels.definitionEmpty],
    ["不是 JSON", "{oops", labels.definitionInvalidJson],
    ["顶层不是对象", "[1]", labels.definitionRootNotObject],
    ["一个 server 都没有", "{}", labels.definitionNoServers],
  ])("%s 时说清是哪种问题，且不发请求", async (_label, input, message) => {
    const wrapper = mountTools();
    await openAdd(wrapper);
    await typeDefinition(wrapper, input);
    await save(wrapper);
    expect(definitionError()).toBe(message);
    expect(mcp.mutate).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("某一条不是对象时把名字说出来", async () => {
    const wrapper = mountTools();
    await openAdd(wrapper);
    await typeDefinition(wrapper, '{"broken": "npx"}');
    await save(wrapper);
    expect(definitionError()).toBe(
      labels.definitionServerNotObject.replace("{name}", "broken"),
    );
    wrapper.unmount();
  });

  it("加一条重名的会被拦住：后端会覆盖，而用户以为在新增", async () => {
    const wrapper = mountTools();
    await openAdd(wrapper);
    await typeDefinition(wrapper, '{"github": {"command": "npx"}}');
    await save(wrapper);
    expect(definitionError()).toBe(
      labels.serverAlreadyExists.replace("{name}", "github"),
    );
    expect(mcp.mutate).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("编辑预填这条配置本身，保存发的是 update", async () => {
    const wrapper = mountTools();
    document.body
      .querySelector<HTMLElement>(
        `button[aria-label="${enUS.common.edit} github"]`,
      )!
      .click();
    await flushPromises();
    await wrapper.vm.$nextTick();
    // 预填的是包着 mcpServers 的那种格式，与粘贴框接受的一致。
    expect(JSON.parse(definitionBox().value)).toEqual({
      mcpServers: {
        github: { enabled: true, description: "GitHub tools", command: "npx" },
      },
    });

    await typeDefinition(
      wrapper,
      '{"mcpServers": {"github": {"enabled": false, "description": "d", "command": "uvx"}}}',
    );
    await save(wrapper);
    expect(mcp.mutate).toHaveBeenCalledWith({
      operation: "update",
      serverName: "github",
      server: { enabled: false, description: "d", command: "uvx" },
    });
    wrapper.unmount();
  });

  it.each([
    [
      "一次改了两个",
      '{"mcpServers": {"github": {"command": "a"}, "other": {"command": "b"}}}',
      labels.editSingleServer,
    ],
    [
      "把名字改了",
      '{"mcpServers": {"renamed": {"command": "a"}}}',
      labels.editServerNameMismatch.replace("{name}", "github"),
    ],
  ])("编辑时%s会被拦住", async (_label, input, message) => {
    const wrapper = mountTools();
    document.body
      .querySelector<HTMLElement>(
        `button[aria-label="${enUS.common.edit} github"]`,
      )!
      .click();
    await flushPromises();
    await typeDefinition(wrapper, input);
    await save(wrapper);
    expect(definitionError()).toBe(message);
    expect(mcp.mutate).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("删除要先确认，提示里带上名字", async () => {
    const wrapper = mountTools();
    document.body
      .querySelector<HTMLElement>(
        `button[aria-label="${enUS.common.delete} github"]`,
      )!
      .click();
    await flushPromises();
    await wrapper.vm.$nextTick();
    expect(document.body.textContent).toContain(
      labels.removeServerDescription.replace("{name}", "github"),
    );
    expect(mcp.mutate).not.toHaveBeenCalled();

    buttonWithText(enUS.common.delete)!.click();
    await flushPromises();
    expect(mcp.mutate).toHaveBeenCalledWith({
      operation: "delete",
      serverName: "github",
    });
    wrapper.unmount();
  });

  it("空名字的 server 在界面上有个说法", async () => {
    mcp.config.value = {
      mcp_servers: { "": { enabled: true, description: "" } },
    };
    const wrapper = mountTools();
    await flushPromises();
    expect(wrapper.text()).toContain(labels.unnamedServer);
    wrapper.unmount();
  });

  it("保存失败时对话框不关，错误显示在里面", async () => {
    mcp.mutate.mockRejectedValueOnce(new Error("gateway refused"));
    const wrapper = mountTools();
    await openAdd(wrapper);
    await typeDefinition(wrapper, '{"fs": {"command": "npx"}}');
    await save(wrapper);
    // 用户改了半天的 JSON 不能就这么没了。
    expect(definitionBox()).not.toBeNull();
    expect(definitionError()).toContain("gateway refused");
    wrapper.unmount();
  });
});
