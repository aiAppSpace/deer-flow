import { flushPromises, mount } from "@vue/test-utils";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { computed, reactive, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({
  fetch: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
  access: { value: undefined as unknown },
}));
vi.mock("@/core/api/fetcher", () => ({ fetch: api.fetch }));
vi.mock("@/core/config", () => ({ getBackendBaseURL: () => "" }));
vi.mock("@/core/workspace-shell/toast", () => ({
  useWorkspaceToast: () => api.toast,
}));
vi.mock("@/composables/useSettingsPermissions", () => ({
  useSettingsPermissions: () => ({ authDisabled: false, session: api.access }),
}));
import PluginGallery from "@/components/workspace/capabilities/PluginGallery.vue";
import { enUS } from "@/core/i18n/locales/en-US";
import { capabilityCopy } from "@/core/capabilities/copy";
import type { PluginManifest } from "@/core/capabilities/types";
const plugin: PluginManifest = {
  schema_version: 1,
  id: "search",
  version: "1",
  name: { "en-US": "Search plugin" },
  description: { "en-US": "Research documents" },
  setup: { "en-US": "Set an endpoint" },
  category: "research",
  kind: "mcp",
  adapter: "mcp",
  source: "https://example.com/source",
  icon: null,
  aliases: ["lookup"],
  auth_methods: [],
  contributions: ["tools"],
  config_schema: {
    type: "object",
    properties: { name: { type: "string" }, url: { type: "string" } },
    required: ["name", "url"],
  },
};
const route = reactive({
  path: "/workspace/capabilities",
  query: {} as Record<string, string>,
});
const replace = vi.fn();
const cleanups: (() => void)[] = [];
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = mount(PluginGallery, {
    props: { query: "" },
    attachTo: document.body,
    global: { plugins: [[VueQueryPlugin, { queryClient: client }]] },
  });
  cleanups.push(() => {
    wrapper.unmount();
    client.clear();
  });
  return wrapper;
}
beforeEach(() => {
  api.access = ref({
    tag: "authenticated",
    user: { id: "member", system_role: "user" },
  });
  route.query = {};
  replace.mockReset();
  api.toast.success.mockReset();
  vi.stubGlobal("useNuxtApp", () => ({
    $i18n: { t: computed(() => enUS), locale: ref("en-US") },
  }));
  vi.stubGlobal("useRoute", () => route);
  vi.stubGlobal("useRouter", () => ({ replace }));
  api.fetch.mockReset().mockImplementation(async (url, init) => {
    if (url === "/api/capabilities/catalog") return Response.json([plugin]);
    if (url === "/api/capabilities/installations/mcp?scope=all")
      return Response.json({
        items: [
          {
            id: "deployment:search",
            plugin_id: "search",
            adapter: "mcp",
            name: "Shared search",
            description: "Safe status only",
            installed: true,
            enabled: true,
            scope: "deployment",
            selectable: true,
            auth_status: "configured",
          },
        ],
        can_manage: false,
      });
    if (url === "/api/capabilities/installations" && init?.method === "POST")
      return Response.json({ items: [], can_manage: true });
    if (url.includes("/api/mcp/")) return Response.json({ mcp_servers: {} });
    throw new Error(`Unexpected request ${url}`);
  });
});
afterEach(() => {
  cleanups.splice(0).forEach((fn) => fn());
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});
describe("real capability plugin gallery", () => {
  it("renders sanitized platform status for a member without requesting privileged config", async () => {
    const wrapper = setup();
    await flushPromises();
    expect(wrapper.text()).toContain("Shared search");
    expect(wrapper.text()).toContain("Safe status only");
    const paths = api.fetch.mock.calls.map(([url]) => url);
    expect(paths).toContain("/api/mcp/personal/config");
    expect(paths).not.toContain("/api/mcp/config");
    expect(
      wrapper
        .findAll(`button[aria-label^="${enUS.capabilities.addPlugin}"]`)
        .map((button) => button.attributes("aria-label")),
    ).toEqual([
      `${enUS.capabilities.addPlugin} (${capabilityCopy("en-US").personalTitle})`,
    ]);
  });
  it("lets administrators manage both deployment and personal config", async () => {
    api.access = ref({
      tag: "authenticated",
      user: { id: "admin", system_role: "admin" },
    });
    setup();
    await flushPromises();
    expect(api.fetch.mock.calls.map(([url]) => url)).toEqual(
      expect.arrayContaining(["/api/mcp/config", "/api/mcp/personal/config"]),
    );
  });
  it("supports a direct catalog deep link, saves only the personal installation and closes without dropping other query", async () => {
    route.query = { tab: "plugins", plugin: "search", keep: "yes" };
    setup();
    await flushPromises();
    const name =
      document.querySelector<HTMLInputElement>("#plugin-field-name")!;
    expect(name.value).toBe("search");
    const url = document.querySelector<HTMLInputElement>("#plugin-field-url")!;
    url.value = "https://mcp.example.test/api";
    url.dispatchEvent(new Event("input", { bubbles: true }));
    document
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flushPromises();
    const call = api.fetch.mock.calls.find(
      ([, init]) => init?.method === "POST",
    )!;
    expect(JSON.parse(call[1].body)).toMatchObject({
      plugin_id: "search",
      scope: "user",
      name: "search",
      configuration: {
        type: "http",
        enabled: true,
        url: "https://mcp.example.test/api",
      },
    });
    expect(replace).toHaveBeenCalledWith({
      path: route.path,
      query: { tab: "plugins", keep: "yes" },
    });
    expect(api.toast.success).toHaveBeenCalledOnce();
  });
  it("shows catalog failure without inventing available adapters", async () => {
    api.fetch.mockImplementationOnce(async () =>
      Response.json({ detail: "offline" }, { status: 503 }),
    );
    const wrapper = setup();
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toBe(
      capabilityCopy("en-US").catalogError,
    );
    expect(api.fetch.mock.calls.map(([url]) => url)).not.toContain(
      "/api/capabilities/installations/mcp?scope=all",
    );
  });
});
