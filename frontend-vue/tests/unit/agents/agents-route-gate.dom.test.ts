import { QueryClient, VueQueryPlugin, useQuery } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { computed, defineComponent, h, onUnmounted, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/core/api/fetcher", () => ({ fetch: vi.fn() }));
vi.mock("@/core/config", () => ({ getBackendBaseURL: () => "" }));

import { fetch as fetcher } from "@/core/api/fetcher";
import { enUS } from "@/core/i18n/locales/en-US";
import { FEATURES_QUERY_KEYS } from "@/core/features/query-keys";
import AgentsRoute from "@/pages/workspace/agents.vue";

const mockedFetch = vi.mocked(fetcher);
const cleanups: (() => void)[] = [];
function mountRoute() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const lifecycle = { mounted: 0, disposed: 0, signals: [] as AbortSignal[] };
  // The native spec verifies the actual generated route tree. This replacement
  // for NuxtPage isolates admission: setup, state, I/O and disposal all belong
  // to the business child and must not exist before it is admitted.
  const BusinessChild = defineComponent({
    setup() {
      lifecycle.mounted++;
      const draft = ref("");
      onUnmounted(() => lifecycle.disposed++);
      useQuery({
        queryKey: ["route-business", lifecycle.mounted],
        queryFn: ({ signal }) => {
          lifecycle.signals.push(signal);
          return new Promise<never>(() => {});
        },
      });
      return () =>
        h("input", {
          placeholder: "business-draft",
          value: draft.value,
          onInput: (event: Event) => {
            draft.value = (event.target as HTMLInputElement).value;
          },
        });
    },
  });
  const wrapper = mount(AgentsRoute, {
    global: {
      plugins: [[VueQueryPlugin, { queryClient }]],
      stubs: { NuxtPage: BusinessChild },
    },
  });
  cleanups.push(() => {
    wrapper.unmount();
    queryClient.clear();
  });
  return { wrapper, queryClient, lifecycle };
}
function answer(enabled: boolean) {
  return Response.json({ agents_api: { enabled } });
}

beforeEach(() => {
  mockedFetch.mockReset();
  localStorage.clear();
  vi.stubGlobal("definePageMeta", vi.fn());
  vi.stubGlobal("useNuxtApp", () => ({ $i18n: { t: computed(() => enUS) } }));
});
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  vi.unstubAllGlobals();
});

describe("Agents route admission owner", () => {
  it("replaces pending with disabled without mounting business setup or I/O", async () => {
    let release!: (response: Response) => void;
    mockedFetch.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    const { wrapper, lifecycle } = mountRoute();
    expect(wrapper.text()).toBe(enUS.common.loading);
    expect(wrapper.find("input").exists()).toBe(false);
    expect(lifecycle.mounted).toBe(0);
    expect(lifecycle.signals).toEqual([]);
    release(answer(false));
    await flushPromises();
    expect(wrapper.text()).toContain(enUS.agents.featureDisabledTitle);
    expect(wrapper.text()).toContain(enUS.agents.featureDisabledDescription);
    expect(lifecycle.mounted).toBe(0);
    expect(lifecycle.signals).toEqual([]);
  });

  it("retires the admitted subtree, its local state and active I/O when permission changes", async () => {
    mockedFetch.mockResolvedValue(answer(true));
    const { wrapper, queryClient, lifecycle } = mountRoute();
    await flushPromises();
    expect(lifecycle.mounted).toBe(1);
    expect(lifecycle.signals).toHaveLength(1);
    await wrapper.get("input").setValue("retired draft");
    queryClient.setQueryData(FEATURES_QUERY_KEYS.agentsApi, false);
    await flushPromises();
    expect(wrapper.find("input").exists()).toBe(false);
    expect(lifecycle.disposed).toBe(1);
    expect(lifecycle.signals[0]!.aborted).toBe(true);
    expect(wrapper.text()).toContain(enUS.agents.featureDisabledTitle);
    queryClient.setQueryData(FEATURES_QUERY_KEYS.agentsApi, true);
    await flushPromises();
    expect(lifecycle.mounted).toBe(2);
    expect(lifecycle.signals).toHaveLength(2);
    expect(wrapper.get<HTMLInputElement>("input").element.value).toBe("");
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });

  for (const cached of [undefined, true, false]) {
    it(`waits for discovery before applying failed-query cache fallback ${cached}`, async () => {
      if (cached !== undefined)
        localStorage.setItem("deerflow.features.agents_api", String(cached));
      let reject!: (cause: Error) => void;
      mockedFetch.mockReturnValue(
        new Promise((_resolve, fail) => {
          reject = fail;
        }),
      );
      const { wrapper, lifecycle } = mountRoute();
      expect(wrapper.text()).toBe(enUS.common.loading);
      expect(lifecycle.mounted).toBe(0);
      reject(new Error("Feature discovery unavailable"));
      await flushPromises();
      if (cached === false) {
        expect(wrapper.text()).toContain(enUS.agents.featureDisabledTitle);
        expect(lifecycle.mounted).toBe(0);
      } else {
        expect(wrapper.find("input").exists()).toBe(true);
        expect(lifecycle.mounted).toBe(1);
      }
      expect(mockedFetch).toHaveBeenCalledTimes(1);
    });
  }

  it("lets a definitive live answer override a disabled cold-start cache", async () => {
    localStorage.setItem("deerflow.features.agents_api", "false");
    mockedFetch.mockResolvedValue(answer(true));
    const { wrapper, lifecycle } = mountRoute();
    await flushPromises();
    expect(wrapper.find("input").exists()).toBe(true);
    expect(lifecycle.mounted).toBe(1);
    expect(localStorage.getItem("deerflow.features.agents_api")).toBe("true");
  });
});
