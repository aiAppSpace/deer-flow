import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
/*
  【文件职责】     守住 MCP server 的增/改/删：校验在哪一步拦住、错误说的是哪一条。
  【架构位置】     测试
  【依赖关系】     MCPPluginManager.vue · core/mcp/parse · composables/useScopedMCPConfig
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
  error: undefined as unknown as { value: Error | null },
  toggle: vi.fn(),
}));
vi.mock("@/composables/useScopedMCPConfig", async () => {
  const { ref: makeRef, computed: makeComputed } = await import("vue");
  mcp.config = makeRef({ mcp_servers: {} });
  mcp.pending = makeRef(false);
  mcp.error = makeRef<Error | null>(null);
  return {
    useScopedMCPConfig: () => ({
      query: {
        data: mcp.config,
        isError: makeComputed(() => mcp.error.value !== null),
        isLoading: makeRef(false),
        error: mcp.error,
      },
      mutation: { mutateAsync: mcp.mutate, isPending: mcp.pending },
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

import MCPPluginManager from "@/components/workspace/capabilities/MCPPluginManager.vue";
import { MCPConfigRequestError } from "@/core/mcp/api";
import { enUS } from "@/core/i18n/locales/en-US";

const labels = enUS.settings.tools;

beforeEach(() => {
  mcp.mutate.mockReset();
  mcp.mutate.mockResolvedValue({ mcp_servers: {} });
  mcp.pending.value = false;
  mcp.error.value = null;
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
  return mount(MCPPluginManager, {
    global: { plugins: [[VueQueryPlugin, { queryClient: new QueryClient() }]] },
    props: { scope: "deployment" },
    attachTo: document.body,
  });
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
    .querySelector('[role="dialog"] [role="alert"]')
    ?.textContent?.trim() ?? "";

async function openAdd(wrapper: ReturnType<typeof mountTools>) {
  document.body
    .querySelector<HTMLElement>(
      `button[aria-label^="${enUS.capabilities.addPlugin}"]`,
    )!
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
  it("keeps the bounded editor native and preserves the complete draft through resize", async () => {
    const server = {
      enabled: true,
      description: "完整配置 🙂",
      command: "npx",
      headers: Object.fromEntries(
        Array.from({ length: 80 }, (_, index) => [
          `X-Field-${index}`,
          `完整值-${index}`,
        ]),
      ),
    };
    mcp.config.value = { mcp_servers: { github: server } };
    const wrapper = mountTools();
    try {
      document.body
        .querySelector<HTMLElement>(
          `button[aria-label^="${enUS.common.edit} github ("]`,
        )!
        .click();
      await flushPromises();
      const box = definitionBox();
      expect(JSON.parse(box.value)).toEqual({ mcpServers: { github: server } });
      // DOM tests guard the actual primitive's capacity policy and value owner;
      // browser reflow tests alone establish physical geometry and native pan.
      expect(box.classList.contains("h-96")).toBe(true);
      expect(box.classList.contains("min-h-0")).toBe(true);
      expect(box.classList.contains("max-h-[calc(100dvh-4rem-2px)]")).toBe(
        true,
      );
      expect(box.classList.contains("sm:max-h-[calc(100dvh-5rem-2px)]")).toBe(
        true,
      );
      expect(box.classList.contains("overflow-auto")).toBe(true);
      expect(box.closest('[role="dialog"]')?.classList).toContain(
        "overflow-y-auto",
      );
      const draft = JSON.stringify({
        mcpServers: { github: { ...server, description: "编辑后 🙂" } },
      });
      await typeDefinition(wrapper, draft);
      window.dispatchEvent(new Event("resize"));
      await flushPromises();
      expect(definitionBox()).toBe(box);
      expect(box.value).toBe(draft);
      expect(mcp.mutate).not.toHaveBeenCalled();
      await save(wrapper);
      expect(mcp.mutate).toHaveBeenCalledExactlyOnceWith({
        operation: "update",
        serverName: "github",
        server: { ...server, description: "编辑后 🙂" },
      });
    } finally {
      wrapper.unmount();
    }
  });
  it.each([
    [new MCPConfigRequestError(403, "Admin only"), labels.adminRequired],
    [
      new MCPConfigRequestError(503, "Gateway unavailable"),
      `${enUS.common.error} Gateway unavailable`,
    ],
  ])(
    "renders the current React error copy and removes mutation controls for %s",
    async (error, message) => {
      mcp.error.value = error;
      const wrapper = mountTools();
      await flushPromises();
      expect(wrapper.get('[role="alert"]').text()).toBe(message);
      expect(
        wrapper.find('button[aria-label^="Add MCP plugin"]').exists(),
      ).toBe(false);
      expect(wrapper.find('[role="switch"]').exists()).toBe(false);
      wrapper.unmount();
    },
  );
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
        `button[aria-label^="${enUS.common.edit} github ("]`,
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
        `button[aria-label^="${enUS.common.edit} github ("]`,
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
        `button[aria-label^="${enUS.common.delete} github ("]`,
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

describe("actual MCP settings controls while a scoped mutation is pending", () => {
  it("locks the toggle and management actions until the one mutation finishes", async () => {
    let finish!: () => void;
    mcp.mutate.mockImplementation(() => {
      mcp.pending.value = true;
      return new Promise<void>((resolve) => {
        finish = () => {
          mcp.pending.value = false;
          resolve();
        };
      });
    });
    const wrapper = mountTools();
    await flushPromises();
    const toggle = wrapper.get('[role="switch"]');
    await toggle.trigger("click");
    await flushPromises();
    expect(toggle.attributes("disabled")).toBeDefined();
    await toggle.trigger("click");
    expect(mcp.mutate).toHaveBeenCalledTimes(1);
    expect(mcp.mutate).toHaveBeenCalledWith({
      operation: "toggle",
      serverName: "github",
      enabled: false,
    });
    expect(
      wrapper
        .get(`button[aria-label^="${enUS.common.edit}"]`)
        .attributes("disabled"),
    ).toBeDefined();
    finish();
    await flushPromises();
    expect(toggle.attributes("disabled")).toBeUndefined();
    wrapper.unmount();
  });
});
