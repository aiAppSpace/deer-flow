import { flushPromises, mount } from "@vue/test-utils";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { computed, defineComponent, h, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({
  list: vi.fn(),
  importPackage: vi.fn(),
  exportPackage: vi.fn(),
  handoff: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("@/core/agents/api", async () => ({
  ...(await vi.importActual<typeof import("@/core/agents/api")>(
    "@/core/agents/api",
  )),
  listAgents: api.list,
  importAgentPackage: api.importPackage,
  exportAgentPackage: api.exportPackage,
}));
vi.mock("@/core/agents/package-download", async () => ({
  ...(await vi.importActual<typeof import("@/core/agents/package-download")>(
    "@/core/agents/package-download",
  )),
  handOffAgentPackageDownload: api.handoff,
}));
vi.mock("@/core/workspace-shell/toast", () => ({
  useWorkspaceToast: () => api.toast,
}));
vi.mock("@/composables/useWorkspaceFeatures", () => ({
  useAgentsApiEnabled: () => ({
    loaded: ref(true),
    agentsApiEnabled: ref(true),
  }),
}));
vi.mock("@/composables/useModels", () => ({
  useModels: () => ({ models: ref([]), loading: ref(false), error: ref(null) }),
}));
import AgentPage from "@/pages/workspace/agents/index.vue";
import { enUS } from "@/core/i18n/locales/en-US";
const agent = {
  name: "reviewer",
  display_name: "Code Reviewer",
  description: "Reviews",
  model: null,
  tool_groups: null,
  skills: null,
};
const cleanups: (() => void)[] = [];
const NuxtLink = defineComponent({
  props: ["to"],
  setup(props, { slots }) {
    return () => h("a", { href: props.to }, slots.default?.());
  },
});
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = mount(AgentPage, {
    attachTo: document.body,
    global: {
      plugins: [[VueQueryPlugin, { queryClient: client }]],
      stubs: { NuxtLink, AgentSettingsDialog: true },
    },
  });
  cleanups.push(() => {
    wrapper.unmount();
    client.clear();
  });
  return wrapper;
}
function dialogButton(label: string) {
  return [
    ...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button'),
  ].find((button) => button.textContent?.trim() === label)!;
}
async function choose(wrapper: ReturnType<typeof mount>, document: unknown) {
  const input = wrapper.get<HTMLInputElement>('input[type="file"]');
  Object.defineProperty(input.element, "files", {
    configurable: true,
    value: [{ text: async () => JSON.stringify(document) }],
  });
  await input.trigger("change");
  await flushPromises();
}
beforeEach(() => {
  api.list.mockReset().mockResolvedValue([agent]);
  api.importPackage.mockReset();
  api.exportPackage.mockReset();
  api.handoff.mockReset();
  api.toast.error.mockReset();
  api.toast.success.mockReset();
  vi.stubGlobal("definePageMeta", vi.fn());
  vi.stubGlobal("useNuxtApp", () => ({
    $i18n: { t: computed(() => enUS), locale: ref("en-US") },
  }));
});
afterEach(() => {
  cleanups.splice(0).forEach((fn) => fn());
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});
describe("Agent definition package page", () => {
  it("preserves an untrusted package on409 so the user can rename and retry without overwriting", async () => {
    const packageDocument = {
      format: "deerflow.custom-agent",
      version: 1,
      agent: {
        name: "reviewer",
        display_name: "Readable",
        unknown: "backend validates",
      },
    };
    api.importPackage
      .mockRejectedValueOnce(
        Object.assign(new Error("Name already exists"), { status: 409 }),
      )
      .mockResolvedValueOnce({ ...agent, name: "reviewer-copy" });
    const wrapper = setup();
    await flushPromises();
    await choose(wrapper, packageDocument);
    expect(
      (
        globalThis.document.querySelector(
          "#agent-import-name",
        ) as HTMLInputElement
      ).value,
    ).toBe("reviewer");
    dialogButton(enUS.agents.importAgent).click();
    await flushPromises();
    expect(api.importPackage).toHaveBeenNthCalledWith(
      1,
      packageDocument,
      "reviewer",
    );
    expect(api.toast.error).toHaveBeenCalledWith("Name already exists");
    expect(globalThis.document.querySelector('[role="dialog"]')).toBeTruthy();
    const name =
      globalThis.document.querySelector<HTMLInputElement>(
        "#agent-import-name",
      )!;
    name.value = "  reviewer-copy  ";
    name.dispatchEvent(new Event("input", { bubbles: true }));
    await flushPromises();
    dialogButton(enUS.agents.importAgent).click();
    await flushPromises();
    expect(api.importPackage).toHaveBeenNthCalledWith(
      2,
      packageDocument,
      "reviewer-copy",
    );
    expect(api.list).toHaveBeenCalledTimes(2);
    expect(globalThis.document.querySelector('[role="dialog"]')).toBeNull();
  });
  it("downloads the backend portable definition under its stable name", async () => {
    const definition = {
      format: "deerflow.custom-agent",
      version: 1,
      agent: {
        name: "reviewer",
        display_name: "Portable",
        description: "server definition",
      },
    };
    api.exportPackage.mockResolvedValueOnce(definition);
    const wrapper = setup();
    await flushPromises();
    await wrapper
      .get(`button[aria-label="${enUS.agents.exportAgent}"]`)
      .trigger("click");
    await flushPromises();
    expect(api.exportPackage).toHaveBeenCalledWith("reviewer", {
      signal: expect.any(AbortSignal),
    });
    expect(api.handoff).toHaveBeenCalledWith(definition, "reviewer");
    expect(
      wrapper.find('a[href="/workspace/agents/reviewer/chats/new"]').exists(),
    ).toBe(true);
  });
  it("does not create a download after the exporting card is unmounted", async () => {
    let release!: (value: unknown) => void;
    api.exportPackage.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const wrapper = setup();
    await flushPromises();
    await wrapper
      .get(`button[aria-label="${enUS.agents.exportAgent}"]`)
      .trigger("click");
    const signal = api.exportPackage.mock.calls[0]![1].signal as AbortSignal;
    wrapper.unmount();
    expect(signal.aborted).toBe(true);
    release({ agent: { name: "reviewer" } });
    await flushPromises();
    expect(api.handoff).not.toHaveBeenCalled();
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
async function choosePending(
  wrapper: ReturnType<typeof mount>,
  promise: Promise<string>,
) {
  const input = wrapper.get<HTMLInputElement>('input[type="file"]');
  Object.defineProperty(input.element, "files", {
    configurable: true,
    value: [{ text: () => promise }],
  });
  await input.trigger("change");
}
for (const outcome of ["success", "failure"] as const) {
  it(`ignores an older file read ${outcome} after another package is selected`, async () => {
    const wrapper = setup();
    await flushPromises();
    const old = deferred<string>();
    await choosePending(wrapper, old.promise);
    await choose(wrapper, { agent: { name: "latest-package" } });
    if (outcome === "success")
      old.resolve(JSON.stringify({ agent: { name: "obsolete-package" } }));
    else old.reject(new Error("obsolete file"));
    await flushPromises();
    expect(
      document.querySelector<HTMLInputElement>("#agent-import-name")?.value,
    ).toBe("latest-package");
    expect(api.toast.error).not.toHaveBeenCalled();
  });
  it(`ignores an old import ${outcome} after the dialog closes and another package opens`, async () => {
    const wrapper = setup();
    await flushPromises();
    const old = deferred<typeof agent>();
    api.importPackage.mockReturnValueOnce(old.promise);
    await choose(wrapper, { agent: { name: "first-package" } });
    dialogButton(enUS.agents.importAgent).click();
    await flushPromises();
    expect(api.importPackage).toHaveBeenCalledTimes(1);
    document
      .querySelector<HTMLButtonElement>(
        `[role="dialog"] button[aria-label="${enUS.primitives.close}"]`,
      )!
      .click();
    await flushPromises();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    await choose(wrapper, { agent: { name: "latest-package" } });
    if (outcome === "success") old.resolve(agent);
    else old.reject(new Error("obsolete import"));
    await flushPromises();
    expect(
      document.querySelector<HTMLInputElement>("#agent-import-name")?.value,
    ).toBe("latest-package");
    expect(api.toast.success).not.toHaveBeenCalled();
    expect(api.toast.error).not.toHaveBeenCalled();
  });
}
