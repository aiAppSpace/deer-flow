import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

import ChatComposer from "@/components/chat/ChatComposer.vue";
import { enUS } from "@/core/i18n/locales/en-US";
import {
  createWorkspaceToastStore,
  workspaceToastKey,
} from "@/core/workspace-shell/toast";

const toastStore = createWorkspaceToastStore();

const compactThreadContext = vi.hoisted(() => vi.fn());

vi.mock("@/core/threads/api", () => ({ compactThreadContext }));
vi.mock("@/core/skills/api", () => ({ loadSkills: vi.fn(async () => []) }));
vi.mock("@/core/models/api", () => ({
  loadModels: vi.fn(async () => ({ models: [] })),
}));
vi.mock("@/core/uploads/api", () => ({
  getUploadLimits: vi.fn(async () => undefined),
  uploadFiles: vi.fn(),
}));

function mountComposer() {
  const queryClient = new QueryClient();
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
  return { wrapper, invalidate };
}

describe("ChatComposer /compact", () => {
  beforeEach(() => {
    toastStore.clear();
    compactThreadContext.mockReset();
    sessionStorage.clear();
  });

  it("executes the Gateway command once, clears the draft and invalidates all six caches", async () => {
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
        ["threads", "search"],
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
