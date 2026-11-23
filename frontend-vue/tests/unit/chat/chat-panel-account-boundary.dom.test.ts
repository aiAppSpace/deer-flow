import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h, nextTick, ref } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useChatPanels } from "@/composables/useChatPanels";
import { useUserPreferencesBoundary } from "@/composables/useUserPreferencesBoundary";
import type { Message } from "@/core/types/message";

const mocks = vi.hoisted(() => ({ restore: vi.fn() }));
vi.mock("@/composables/useSidecarSession", () => ({
  useSidecarSession: () => ({ restore: mocks.restore }),
}));
vi.mock("@/core/settings/user-preferences", () => ({
  startUserPreferences: () =>
    Object.assign(() => undefined, { activate: () => undefined }),
}));
const wrappers: ReturnType<typeof mount>[] = [];
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  vi.resetAllMocks();
});

describe("chat panels under the production workspace account boundary", () => {
  it("disposes the old panel owner before shared reads reset and remounts a clean owner", async () => {
    const owner = ref<string | undefined>("alice");
    const panels: ReturnType<typeof useChatPanels>[] = [];
    const Consumer = defineComponent({
      setup() {
        const messages = ref<Message[]>([]);
        panels.push(
          useChatPanels({
            threadId: ref("same-thread"),
            draftThreadId: ref("draft"),
            readonly: ref(false),
            context: ref({}),
            messages,
            authoritativeArtifacts: ref([]),
            browserEnabled: ref(true),
            stream: {
              messages,
              isStreaming: ref(false),
              isHistoryLoading: ref(false),
            },
          }),
        );
        return () => h("output", owner.value);
      },
    });
    let finishReset!: () => void;
    const reset = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishReset = resolve;
        }),
    );
    const wrapper = mount(
      defineComponent({
        setup() {
          // UserPreferencesBoundary.vue uses this exact ready-gated slot chain.
          const { ready } = useUserPreferencesBoundary(owner, reset);
          return () => (ready.value ? h(Consumer) : null);
        },
      }),
    );
    wrappers.push(wrapper);
    const old = panels[0]!;
    old.openBrowserFrame({ screenshot: "alice" });
    let finishRestore!: (id: string) => void;
    mocks.restore.mockReturnValue(
      new Promise<string>((resolve) => {
        finishRestore = resolve;
      }),
    );
    const restoring = old.toggleSidecar();
    owner.value = "bob";
    await nextTick();
    expect(wrapper.find("output").exists()).toBe(false);
    expect(reset).toHaveBeenCalledOnce();
    expect(old.browserFrame.value).toBeNull();
    expect(old.sidecarReconciling.value).toBe(false);
    finishRestore("alice-sidecar");
    await restoring;
    expect(old.sidecar.open.value).toBe(false);
    finishReset();
    await flushPromises();
    expect(wrapper.text()).toBe("bob");
    expect(panels).toHaveLength(2);
    expect(panels[1]!.browserFrame.value).toBeNull();
    expect(panels[1]!.sidecar.open.value).toBe(false);
    expect(panels[1]!.sidecar.conversationQuotes.value).toEqual([]);
  });
});
