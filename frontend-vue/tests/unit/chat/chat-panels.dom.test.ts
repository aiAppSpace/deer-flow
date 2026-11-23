import { mount } from "@vue/test-utils";
import { defineComponent, h, nextTick, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useChatPanels } from "@/composables/useChatPanels";
import type { Message } from "@/core/types/message";

const session = vi.hoisted(() => ({ restore: vi.fn() }));
vi.mock("@/composables/useSidecarSession", () => ({
  useSidecarSession: () => session,
}));
const wrappers: ReturnType<typeof mount>[] = [];
function harness() {
  const threadId = ref<string | null>("thread-a");
  const ownerKey = ref("alice:agent-a");
  const browserEnabled = ref(true);
  const messages = ref<Message[]>([]);
  let panels!: ReturnType<typeof useChatPanels>;
  const wrapper = mount(
    defineComponent({
      setup() {
        panels = useChatPanels({
          threadId,
          ownerKey,
          draftThreadId: ref("draft-a"),
          readonly: ref(false),
          context: ref({}),
          messages,
          authoritativeArtifacts: ref([]),
          browserEnabled,
          stream: {
            messages,
            isStreaming: ref(false),
            isHistoryLoading: ref(false),
          },
        });
        return () => h("div");
      },
    }),
  );
  wrappers.push(wrapper);
  return { wrapper, panels, threadId, ownerKey, browserEnabled, messages };
}
beforeEach(() => {
  session.restore.mockResolvedValue(null);
});
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  vi.resetAllMocks();
});
describe("chat panel coordination owner", () => {
  it("preserves sidecar > browser > artifact priority and the latent artifact-open state", async () => {
    const { panels } = harness();
    panels.openBrowser();
    panels.showArtifacts();
    expect(panels.activePanel.value).toBe("browser");
    expect(panels.artifactPanel.open.value).toBe(true);
    panels.sidecar.open.value = true;
    expect(panels.activePanel.value).toBe("sidecar");
    panels.sidecar.close();
    panels.toggleBrowser();
    expect(panels.activePanel.value).toBe("artifacts");
  });

  it("honors the existing artifact draft owner before switching to browser/details", () => {
    const { panels } = harness();
    panels.artifactPanel.setOpen(true);
    vi.spyOn(panels.artifactPanel, "close").mockReturnValue(false);
    panels.openBrowser();
    expect(panels.browserOpen.value).toBe(false);
    expect(
      panels.messageDetails.select({
        id: "detail",
        title: "Tool",
        content: defineComponent(() => () => null),
      }),
    ).toBe(false);
    expect(panels.messageDetails.open.value).toBe(false);
    expect(panels.activePanel.value).toBe("artifacts");
  });

  it("reconciles new wire frames without replacing a newer REST frame on an unchanged message", async () => {
    const { panels, messages } = harness();
    messages.value = [
      {
        type: "tool",
        tool_call_id: "browser-call",
        content: "",
        additional_kwargs: {
          browser_view: { screenshot: "wire-a", url: "https://a.example" },
        },
      },
    ];
    await nextTick();
    expect(panels.browserOpen.value).toBe(true);
    expect(panels.browserFrame.value?.screenshot).toBe("wire-a");
    panels.acceptBrowserFrame({
      screenshot: "rest-b",
      url: "https://b.example",
    });
    panels.toggleBrowser();
    messages.value = [...messages.value];
    await nextTick();
    expect(panels.browserFrame.value?.screenshot).toBe("rest-b");
    expect(panels.browserOpen.value).toBe(false);
  });

  it("closes unavailable browser presentation, preserves its frame, and clears it on thread switch", async () => {
    const subject = harness();
    subject.panels.openBrowserFrame({ screenshot: "frame" });
    subject.browserEnabled.value = false;
    await nextTick();
    expect(subject.panels.browserOpen.value).toBe(false);
    expect(subject.panels.browserFrame.value?.screenshot).toBe("frame");
    subject.threadId.value = "thread-b";
    await nextTick();
    expect(subject.panels.browserFrame.value).toBeNull();
  });

  it("admits one force restore and rejects a late restore after its conversation retires", async () => {
    const subject = harness();
    let resolve!: (id: string) => void;
    session.restore.mockReturnValue(
      new Promise<string>((accept) => {
        resolve = accept;
      }),
    );
    const pending = subject.panels.toggleSidecar();
    const duplicate = subject.panels.toggleSidecar();
    expect(session.restore).toHaveBeenCalledOnce();
    expect(subject.panels.sidecarReconciling.value).toBe(true);
    subject.threadId.value = "thread-b";
    expect(subject.panels.sidecarReconciling.value).toBe(false);
    await nextTick();
    resolve("sidecar-old");
    await Promise.all([pending, duplicate]);
    expect(subject.panels.sidecar.open.value).toBe(false);
    expect(subject.panels.sidecarReconciling.value).toBe(false);
  });

  it("retires browser, references and force restore when the same thread changes Agent", async () => {
    const subject = harness();
    subject.panels.openBrowserFrame({ screenshot: "agent-a-frame" });
    subject.panels.sidecar.addContextToConversation({
      type: "referenced_message",
      role: "assistant",
      label: "Agent A",
      content: "Agent A context",
    });
    let resolve!: (id: string) => void;
    session.restore.mockReturnValue(
      new Promise<string>((accept) => {
        resolve = accept;
      }),
    );
    const pending = subject.panels.toggleSidecar();
    subject.ownerKey.value = "alice:agent-b";
    expect(subject.threadId.value).toBe("thread-a");
    expect(subject.panels.browserFrame.value).toBeNull();
    expect(subject.panels.browserOpen.value).toBe(false);
    expect(subject.panels.sidecar.conversationQuotes.value).toEqual([]);
    expect(subject.panels.sidecarReconciling.value).toBe(false);
    resolve("sidecar-agent-a");
    await pending;
    expect(subject.panels.sidecar.open.value).toBe(false);
  });

  it("keeps the sidecar owner while a draft adopts its exact thread URL", async () => {
    const subject = harness();
    subject.threadId.value = null;
    await nextTick();
    subject.panels.sidecar.addContextToConversation({
      type: "referenced_message",
      role: "assistant",
      label: "Draft reference",
      content: "Keep this reference",
    });
    let resolve!: (id: string) => void;
    session.restore.mockReturnValue(
      new Promise<string>((accept) => {
        resolve = accept;
      }),
    );
    const pending = subject.panels.toggleSidecar();
    subject.threadId.value = "draft-a";
    expect(subject.panels.sidecarReconciling.value).toBe(true);
    expect(subject.panels.sidecar.conversationQuotes.value).toHaveLength(1);
    resolve("sidecar-draft");
    await pending;
    expect(subject.panels.sidecar.open.value).toBe(true);
    expect(session.restore).toHaveBeenCalledOnce();
  });

  it("selects details through the shared owner and closes details on another panel", async () => {
    const { panels } = harness();
    panels.openBrowser();
    expect(
      panels.messageDetails.select({
        id: "detail",
        title: "Tool",
        content: defineComponent(() => () => null),
      }),
    ).toBe(true);
    expect(panels.activePanel.value).toBe("details");
    expect(panels.browserOpen.value).toBe(false);
    panels.showArtifacts();
    await nextTick();
    expect(panels.messageDetails.open.value).toBe(false);
    expect(panels.activePanel.value).toBe("artifacts");
  });
});
