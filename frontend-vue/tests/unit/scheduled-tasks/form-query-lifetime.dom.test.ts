import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { ref } from "vue";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import Form from "@/components/workspace/scheduled-tasks/ScheduledTaskFormDialog.vue";
import { enUS } from "@/core/i18n/locales/en-US";
import {
  createWorkspaceToastStore,
  workspaceToastKey,
} from "@/core/workspace-shell/toast";

const transport = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/core/api/fetcher", () => ({ fetch: transport.fetch }));
vi.mock("@/core/config", () => ({ getBackendBaseURL: () => "" }));
vi.mock("@/core/scheduled-tasks/schedule", async (original) => ({
  ...(await original<typeof import("@/core/scheduled-tasks/schedule")>()),
  timezoneOptions: () => ["UTC"],
}));
const cleanups: (() => void)[] = [];
beforeEach(() => {
  transport.fetch.mockReset().mockImplementation(async (url: string) => {
    if (url === "/api/features")
      return Response.json({ agents_api: { enabled: true } });
    if (url === "/api/agents") return Response.json({ agents: [] });
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal("useNuxtApp", () => ({
    $i18n: { t: ref(enUS), locale: ref("en-US") },
  }));
});
afterEach(async () => {
  cleanups.splice(0).forEach((dispose) => dispose());
  await flushPromises();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const toast = createWorkspaceToastStore();
  const wrapper = mount(Form, {
    attachTo: document.body,
    props: { request: null, toolEnabled: true },
    global: {
      plugins: [[VueQueryPlugin, { queryClient: client }]],
      provide: { [workspaceToastKey as symbol]: toast },
    },
  });
  cleanups.push(() => {
    wrapper.unmount();
    client.clear();
    toast.clear();
  });
  return { wrapper, client };
}
const paths = () => transport.fetch.mock.calls.map(([url]) => url);

it("discovers agents only while the task form is open, including invalidation and reopen", async () => {
  const { wrapper, client } = setup();
  await flushPromises();
  expect(paths()).toEqual([]);
  await wrapper.setProps({ request: { mode: "create" } });
  await vi.waitFor(() =>
    expect(paths()).toEqual(["/api/features", "/api/agents"]),
  );
  await wrapper.setProps({ request: null });
  await client.invalidateQueries();
  await flushPromises();
  expect(paths()).toEqual(["/api/features", "/api/agents"]);
  await wrapper.setProps({ request: { mode: "create" } });
  await vi.waitFor(() =>
    expect(paths().filter((url) => url === "/api/features")).toHaveLength(2),
  );
  await vi.waitFor(() =>
    expect(paths().filter((url) => url === "/api/agents")).toHaveLength(2),
  );
});

it("does not load the agent list when capability discovery finishes after closing", async () => {
  let release!: (response: Response) => void;
  transport.fetch.mockImplementationOnce(
    () =>
      new Promise<Response>((resolve) => {
        release = resolve;
      }),
  );
  const { wrapper } = setup();
  await wrapper.setProps({ request: { mode: "create" } });
  await vi.waitFor(() => expect(paths()).toEqual(["/api/features"]));
  await wrapper.setProps({ request: null });
  release(Response.json({ agents_api: { enabled: true } }));
  await flushPromises();
  expect(paths()).toEqual(["/api/features"]);
});
