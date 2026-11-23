import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ref } from "vue";

import MentionPicker from "@/components/chat/MentionPicker.vue";
import type { AgentThread } from "@/core/threads/types";

const mocks = vi.hoisted(() => ({ search: vi.fn(), archived: vi.fn() }));
vi.mock("@/core/api/api-client", () => ({
  getAPIClient: () => ({ threads: { search: mocks.search } }),
}));
vi.mock("@/core/threads/api", async (original) => ({
  ...(await original<typeof import("@/core/threads/api")>()),
  searchThreadsByArchive: mocks.archived,
}));
vi.mock("@/composables/useFrontendExtensions", () => ({
  useExtensionMentions: () => ({
    items: ref([]),
    failed: ref(false),
    loading: ref(false),
    retry: vi.fn(),
  }),
}));
vi.mock("@/composables/useProjectDocuments", () => ({
  useInfiniteProjectDocuments: () => ({
    data: ref(undefined),
    isPending: ref(false),
    isError: ref(false),
    hasNextPage: ref(false),
    isFetchingNextPage: ref(false),
    refetch: vi.fn(),
    fetchNextPage: vi.fn(),
  }),
}));

function thread(
  id: string,
  metadata: Record<string, unknown> = {},
): AgentThread {
  return {
    thread_id: id,
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
    status: "idle",
    metadata,
    values: { title: id, messages: [] },
    interrupts: {},
  };
}
let wrapper: ReturnType<typeof mount> | undefined;
let client: QueryClient;
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mocks.search.mockReset().mockResolvedValue([
    thread("current-thread"),
    thread("active-conversation"),
    thread("archived-conversation", { archived: true }),
    thread("hidden-sidecar", {
      deerflow_sidecar: true,
      parent_thread_id: "current-thread",
    }),
  ]);
  mocks.archived.mockReset().mockResolvedValue([thread("active-conversation")]);
});
afterEach(() => {
  wrapper?.unmount();
  client.clear();
});

it("admits archived conversations only after capability enable, excludes self/sidecars and emits the selected identity", async () => {
  wrapper = mount(MentionPicker, {
    props: {
      listId: "reference-picker",
      query: "",
      skills: [],
      selectedSkills: [],
      selectedExtensions: [],
      references: [],
      capability: { enabled: false, maxReferences: 4, isLoading: false },
      threadId: "current-thread",
      busy: false,
      error: null,
    },
    global: { plugins: [[VueQueryPlugin, { queryClient: client }]] },
  });
  await flushPromises();
  expect(mocks.search).not.toHaveBeenCalled();
  expect(mocks.archived).not.toHaveBeenCalled();
  await wrapper.setProps({
    capability: { enabled: true, maxReferences: 4, isLoading: false },
  });
  await flushPromises();
  expect(wrapper.text()).toContain("archived-conversation");
  expect(wrapper.text()).toContain("active-conversation");
  expect(wrapper.text()).not.toContain("current-thread");
  expect(wrapper.text()).not.toContain("hidden-sidecar");
  expect(mocks.search).toHaveBeenCalledTimes(1);
  expect(mocks.archived).not.toHaveBeenCalled();
  const option = wrapper
    .findAll('[role="option"]')
    .find((node) => node.text().includes("archived-conversation"));
  expect(option).toBeDefined();
  await option!.trigger("click");
  expect(wrapper.emitted("select")?.[0]?.[0]).toMatchObject({
    kind: "conversation",
    reference: {
      threadId: "archived-conversation",
      title: "archived-conversation",
    },
  });
});
