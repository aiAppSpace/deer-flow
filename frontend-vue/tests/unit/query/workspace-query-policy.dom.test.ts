import { VueQueryPlugin, type QueryClient } from "@tanstack/vue-query";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

vi.mock("@/core/api/fetcher", () => ({ fetch: vi.fn() }));
vi.mock("@/core/workspace-shell/toast", () => ({
  useWorkspaceToast: () => ({
    message: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    dismiss: vi.fn(),
  }),
}));
vi.mock("@/core/config", () => ({ getBackendBaseURL: () => "" }));
vi.mock("@/composables/useCapabilities", () => ({
  useCapabilityUser: () =>
    ref({ id: "query-policy-owner", system_role: "admin" }),
}));

import { fetch } from "@/core/api/fetcher";
import { useAgents } from "@/composables/useAgents";
import { useBrowserControlEnabled } from "@/composables/useWorkspaceFeatures";
import { useSkillsCatalog } from "@/composables/useSkillsCatalog";
import { useMemory } from "@/composables/useMemory";
import { useLarkIntegrationFlow } from "@/composables/useLarkIntegrationFlow";
import { useModels } from "@/composables/useModels";
import { useProject } from "@/composables/useProjects";
import { UnauthorizedError } from "@/core/api/errors";
import { useScopedMCPConfig } from "@/composables/useScopedMCPConfig";

const mockedFetch = vi.mocked(fetch);
const clients: QueryClient[] = [];
const wrappers: VueWrapper[] = [];
let installQueryPlugin: (app: unknown) => void;
let version = 1;

beforeAll(async () => {
  vi.stubGlobal(
    "defineNuxtPlugin",
    (install: (app: unknown) => void) => install,
  );
  installQueryPlugin = (await import("@/plugins/vue-query"))
    .default as unknown as (app: unknown) => void;
});

function client() {
  let queryClient!: QueryClient;
  installQueryPlugin({
    vueApp: {
      use(_plugin: unknown, options: { queryClient: QueryClient }) {
        queryClient = options.queryClient;
      },
    },
  });
  clients.push(queryClient);
  return queryClient;
}

function observe<T>(
  factory: () => T,
  text: (owner: T) => unknown,
  queryClient = client(),
) {
  let owner!: T;
  const wrapper = mount(
    defineComponent({
      setup() {
        owner = factory();
        return () => h("output", JSON.stringify(text(owner)));
      },
    }),
    { global: { plugins: [[VueQueryPlugin, { queryClient }]] } },
  );
  wrappers.push(wrapper);
  return { owner, wrapper, queryClient };
}

function visibility(state: "hidden" | "visible") {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: state,
  });
  document.dispatchEvent(new Event("visibilitychange", { bubbles: true }));
}

function response(path: string, status = 200) {
  const section = { summary: "", updatedAt: "" };
  const body =
    path === "/api/agents"
      ? { agents: [{ name: `version-${version}` }] }
      : path === "/api/skills"
        ? { skills: [{ name: `version-${version}`, enabled: true }] }
        : path === "/api/features"
          ? { browser_control: { enabled: version === 2 } }
          : path === "/api/memory"
            ? {
                version: "2.0",
                revision: version,
                lastUpdated: "2026-10-10T00:00:00Z",
                user: {
                  workContext: section,
                  personalContext: section,
                  topOfMind: section,
                  cognitiveStyle: section,
                },
                history: {
                  recentMonths: section,
                  earlierContext: section,
                  longTermBackground: section,
                },
                facts: [],
              }
            : {
                mcp_servers: {
                  [`version-${version}`]: { command: "demo", enabled: true },
                },
              };
  return new Response(
    JSON.stringify(status === 200 ? body : { detail: "policy HTTP failure" }),
    { status },
  );
}

beforeEach(() => {
  version = 1;
  visibility("visible");
  mockedFetch
    .mockReset()
    .mockImplementation(async (input) => response(String(input)));
});

afterAll(() => vi.unstubAllGlobals());

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  clients.splice(0).forEach((queryClient) => queryClient.clear());
  vi.restoreAllMocks();
});

describe("production workspace QueryClient policies", () => {
  it("refreshes an active Agent list on native document focus", async () => {
    const { wrapper } = observe(
      () => useAgents({ enabled: true }),
      (owner) => owner.agents.value,
    );
    await vi.waitFor(() => expect(wrapper.text()).toContain("version-1"));
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    visibility("hidden");
    version = 2;
    visibility("visible");
    await vi.waitFor(() => expect(wrapper.text()).toContain("version-2"));
    expect(mockedFetch).toHaveBeenCalledTimes(2);
  });

  it("refreshes independently stale feature discovery on focus without automatic retry", async () => {
    const { owner, wrapper } = observe(
      useBrowserControlEnabled,
      (feature) => feature.enabled.value,
    );
    await vi.waitFor(() => expect(owner.loaded.value).toBe(true));
    expect(wrapper.text()).toBe("false");
    visibility("hidden");
    version = 2;
    visibility("visible");
    await vi.waitFor(() => expect(wrapper.text()).toBe("true"));
    expect(mockedFetch).toHaveBeenCalledTimes(2);
    mockedFetch.mockRejectedValue(new TypeError("transport disconnected"));
    await owner.refresh();
    expect(owner.isError.value).toBe(true);
    expect(owner.fetchStatus.value).toBe("idle");
    expect(mockedFetch).toHaveBeenCalledTimes(3);
  });

  it("retains the five-minute skills freshness window but refreshes stale skills on focus", async () => {
    const { wrapper } = observe(
      useSkillsCatalog,
      (owner) => owner.skills.value,
    );
    await vi.waitFor(() => expect(wrapper.text()).toContain("version-1"));
    const fetchedAt = Date.now();
    visibility("hidden");
    version = 2;
    visibility("visible");
    await flushPromises();
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain("version-1");
    vi.spyOn(Date, "now").mockReturnValue(fetchedAt + 5 * 60 * 1000 + 1);
    visibility("hidden");
    visibility("visible");
    await vi.waitFor(() => expect(wrapper.text()).toContain("version-2"));
    expect(mockedFetch).toHaveBeenCalledTimes(2);
  });

  it("refreshes Memory returned by another tab while the panel remains mounted", async () => {
    const { owner, wrapper } = observe(
      useMemory,
      (memory) => memory.memory.value?.revision,
    );
    await vi.waitFor(() => expect(owner.memory.value?.revision).toBe(1));
    visibility("hidden");
    version = 2;
    visibility("visible");
    await vi.waitFor(() => expect(wrapper.text()).toBe("2"));
    expect(mockedFetch).toHaveBeenCalledTimes(2);
  });

  it("refreshes the actual scoped MCP owner on focus", async () => {
    const { wrapper } = observe(
      () => useScopedMCPConfig("user"),
      (owner) => owner.query.data.value,
    );
    await vi.waitFor(() => expect(wrapper.text()).toContain("version-1"));
    visibility("hidden");
    version = 2;
    visibility("visible");
    await vi.waitFor(() => expect(wrapper.text()).toContain("version-2"));
    expect(mockedFetch).toHaveBeenCalledTimes(2);
  });

  for (const [name, factory] of [
    ["Agents", () => useAgents({ enabled: true })],
    ["Memory", useMemory],
  ] as const) {
    it(`${name} retries a transient connection failure using the production default`, async () => {
      mockedFetch.mockRejectedValueOnce(
        new TypeError("connection interrupted"),
      );
      const { queryClient } = observe<unknown>(factory, () => null);
      await vi.waitFor(() => expect(mockedFetch).toHaveBeenCalledTimes(2), {
        timeout: 2_500,
      });
      await vi.waitFor(() =>
        expect(queryClient.getQueryCache().getAll()[0]?.state.status).toBe(
          "success",
        ),
      );
    });
    it(`${name} never retries a deliberate HTTP failure`, async () => {
      mockedFetch.mockImplementation(async (input) =>
        response(String(input), 503),
      );
      const { queryClient } = observe<unknown>(factory, () => null);
      await vi.waitFor(() =>
        expect(queryClient.getQueryCache().getAll()[0]?.state.status).toBe(
          "error",
        ),
      );
      expect(queryClient.getQueryCache().getAll()[0]?.state.fetchStatus).toBe(
        "idle",
      );
      expect(mockedFetch).toHaveBeenCalledTimes(1);
    });
  }
  it("retains the scheduled form Agent list's deliberate no-retry policy", async () => {
    mockedFetch.mockRejectedValue(new TypeError("transport disconnected"));
    const { queryClient } = observe(
      () => useAgents({ enabled: true, retry: false }),
      () => null,
    );
    await vi.waitFor(() =>
      expect(queryClient.getQueryCache().getAll()[0]?.state.status).toBe(
        "error",
      ),
    );
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });

  for (const failure of ["transport", "HTTP503", "unauthorized"] as const) {
    it(`Models ${failure} follows its explicit single-retry/Unauthorized policy`, async () => {
      if (failure === "transport")
        mockedFetch.mockRejectedValueOnce(new TypeError("connection reset"));
      else if (failure === "HTTP503")
        mockedFetch.mockResolvedValueOnce(response("/api/models", 503));
      else mockedFetch.mockRejectedValueOnce(new UnauthorizedError());
      mockedFetch.mockResolvedValue(response("/api/models"));
      const { owner, queryClient } = observe(useModels, () => null);
      await vi.waitFor(() => expect(owner.fetching.value).toBe(false), {
        timeout: 2500,
      });
      expect(mockedFetch).toHaveBeenCalledTimes(
        failure === "unauthorized" ? 1 : 2,
      );
      expect(queryClient.getQueryCache().getAll()[0]?.state.status).toBe(
        failure === "unauthorized" ? "error" : "success",
      );
      visibility("hidden");
      visibility("visible");
      await flushPromises();
      expect(mockedFetch).toHaveBeenCalledTimes(
        failure === "unauthorized" ? 1 : 2,
      );
    });
  }

  it("does not retry Project detail even for a transport failure", async () => {
    mockedFetch.mockRejectedValue(new TypeError("connection reset"));
    const { owner } = observe(
      () => useProject("project-policy"),
      () => null,
    );
    await vi.waitFor(() => expect(owner.fetchStatus.value).toBe("idle"));
    expect(owner.isError.value).toBe(true);
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });
  it("Lark status refreshes on focus and retries only transient transport failure", async () => {
    mockedFetch.mockRejectedValueOnce(new TypeError("connection reset"));
    const { owner, wrapper, queryClient } = observe(
      useLarkIntegrationFlow,
      (flow) => flow.status.value,
    );
    await vi.waitFor(() => expect(owner.loading.value).toBe(false), {
      timeout: 2500,
    });
    expect(mockedFetch).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain("version-1");
    visibility("hidden");
    version = 2;
    visibility("visible");
    await vi.waitFor(() => expect(wrapper.text()).toContain("version-2"));
    expect(mockedFetch).toHaveBeenCalledTimes(3);
    mockedFetch.mockImplementation(async (input) =>
      response(String(input), 503),
    );
    await owner.load();
    expect(queryClient.getQueryCache().getAll()[0]?.state.status).toBe("error");
    expect(owner.fetching.value).toBe(false);
    expect(mockedFetch).toHaveBeenCalledTimes(4);
  });
});
