import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

import ChatComposer from "@/components/chat/ChatComposer.vue";
import { enUS } from "@/core/i18n/locales/en-US";
import {
  createWorkspaceToastStore,
  workspaceToastKey,
} from "@/core/workspace-shell/toast";

const toastStore = createWorkspaceToastStore();
const wrappers: ReturnType<typeof mount>[] = [];
const clients: QueryClient[] = [];

const compactThreadContext = vi.hoisted(() => vi.fn());

vi.mock("@/core/threads/api", () => ({ compactThreadContext }));
// These tests own composer presentation/commands, while session behavior has its own suite.
vi.mock("@/composables/useAuthSession", () => ({
  useAuthSession: () => ({
    session: ref({ tag: "unauthenticated" }),
    isFetching: ref(false),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/core/skills/api", () => ({ loadSkills: vi.fn(async () => []) }));
vi.mock("@/core/models/api", () => ({
  loadModels: vi.fn(async () => ({ models: [] })),
}));
vi.mock("@/core/uploads/api", () => ({
  getUploadLimits: vi.fn(async () => ({
    max_files: 10,
    max_file_size: 100 * 1024 * 1024,
    max_total_size: 100 * 1024 * 1024,
  })),
  uploadFiles: vi.fn(),
}));

vi.mock("@/core/features/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/core/features/api")>()),
  fetchConversationReferencesCapability: vi.fn(async () => ({
    enabled: false,
    maxReferences: 0,
  })),
}));

function mountComposer() {
  const queryClient = new QueryClient();
  clients.push(queryClient);
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  vi.stubGlobal("useNuxtApp", () => ({
    $i18n: { t: ref(enUS), locale: ref("en-US") },
  }));
  const wrapper = mount(ChatComposer, {
    props: {
      threadKey: "thread-1",
      targetThreadId: "thread-1",
      agentName: "research-agent",
      streaming: false,
      uploading: false,
      promptHistory: [],
      context: { mode: "flash", model_name: "gpt-5" },
    },
    global: {
      provide: { [workspaceToastKey as symbol]: toastStore },
      plugins: [[VueQueryPlugin, { queryClient }]],
      stubs: {
        ReferenceAttachment: true,
        ConfettiButton: true,
        GoalStatus: true,
      },
    },
  });
  wrappers.push(wrapper);
  return { wrapper, invalidate };
}

afterEach(async () => {
  wrappers.splice(0).forEach((wrapper) => {
    if (wrapper.exists()) wrapper.unmount();
  });
  clients.splice(0).forEach((client) => client.clear());
  await flushPromises();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("ChatComposer /compact", () => {
  beforeEach(() => {
    toastStore.clear();
    compactThreadContext.mockReset();
    sessionStorage.clear();
  });

  it("keeps slash options owned by the textbox across blur and reopen", async () => {
    const { wrapper } = mountComposer();
    const input = wrapper.get('textarea[name="message"]');
    await input.setValue("/go");
    await input.trigger("focus");
    const list = wrapper.get('[role="listbox"]');
    const option = wrapper.get('[role="option"]');
    expect((option.element as HTMLElement).tabIndex).toBe(-1);
    expect(input.attributes("aria-controls")).toBe(list.attributes("id"));
    expect(input.attributes("aria-activedescendant")).toBe(
      option.attributes("id"),
    );
    await input.trigger("blur");
    expect(wrapper.get('[role="listbox"]').element).toBe(list.element);
    expect(input.attributes("aria-controls")).toBeUndefined();
    await input.trigger("focus");
    expect(wrapper.get('[role="listbox"]').element).toBe(list.element);
    await input.trigger("keydown", { key: "Tab" });
    expect((input.element as HTMLTextAreaElement).value).toBe("/goal ");
  });

  it("executes the Gateway command once, clears the draft and invalidates all five caches", async () => {
    let resolveCompact!: (value: Record<string, unknown>) => void;
    compactThreadContext.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCompact = resolve;
        }),
    );
    const { wrapper, invalidate } = mountComposer();
    const textarea = wrapper.get('textarea[name="message"]');
    await textarea.setValue("/compact");

    await wrapper.get("form").trigger("submit");
    await wrapper.get("form").trigger("submit");
    expect(compactThreadContext).toHaveBeenCalledTimes(1);
    expect(wrapper.get("form").attributes("aria-busy")).toBe("true");
    resolveCompact({ compacted: true });
    await flushPromises();

    expect(compactThreadContext).toHaveBeenCalledWith("thread-1", {
      signal: expect.any(AbortSignal),
      agentName: "research-agent",
      modelName: "gpt-5",
    });
    expect((textarea.element as HTMLTextAreaElement).value).toBe("");
    expect(toastStore.toasts.value).toEqual([
      {
        id: expect.any(Number),
        kind: "success",
        message: enUS.inputBox.compactSuccess,
      },
    ]);
    expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toEqual(
      [
        ["threads", "searchInfinite"],
        ["thread", "thread-1"],
        ["thread-messages", "thread-1"],
        ["thread", "metadata", "thread-1"],
        ["thread-token-usage", "thread-1"],
      ],
    );
    wrapper.unmount();
  });

  it("keeps the command editable and shows the exact backend detail on failure", async () => {
    compactThreadContext.mockRejectedValue(
      new Error("Thread has a run in flight. Compact after the run finishes."),
    );
    const { wrapper } = mountComposer();
    const textarea = wrapper.get('textarea[name="message"]');
    await textarea.setValue("/context compact");
    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect((textarea.element as HTMLTextAreaElement).value).toBe(
      "/context compact",
    );
    expect(toastStore.toasts.value).toEqual([
      {
        id: expect.any(Number),
        kind: "error",
        message: "Thread has a run in flight. Compact after the run finishes.",
      },
    ]);
    wrapper.unmount();
  });
});
