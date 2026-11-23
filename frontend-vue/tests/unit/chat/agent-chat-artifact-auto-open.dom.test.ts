import { mount } from "@vue/test-utils";
import { defineComponent, h, nextTick, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useChatPanels } from "@/composables/useChatPanels";
import { buildWriteFileArtifactURL } from "@/core/artifacts/utils";
import type { Message } from "@/core/types/message";

vi.mock("@/composables/useSidecarSession", () => ({
  useSidecarSession: () => ({ restore: vi.fn(async () => null) }),
}));

const write: Message = {
  id: "write-message",
  type: "ai",
  content: "",
  tool_calls: [
    {
      id: "write-call",
      name: "write_file",
      args: { path: "/mnt/user-data/outputs/report.md", content: "Report" },
    },
  ],
};
const result: Message = {
  id: "write-result",
  type: "tool",
  tool_call_id: "write-call",
  name: "write_file",
  content: "OK",
};
const wrappers: ReturnType<typeof mount>[] = [];
function harness(initialMessages: Message[] = [], streaming = true) {
  const messages = ref(initialMessages);
  const isStreaming = ref(streaming);
  const routeThreadId = ref<string | null>("thread-a");
  const ownerKey = ref("alice:agent-a");
  let panels!: ReturnType<typeof useChatPanels>;
  let openArtifact!: ReturnType<typeof vi.spyOn>;
  const Host = defineComponent({
    setup() {
      panels = useChatPanels({
        threadId: routeThreadId,
        ownerKey,
        draftThreadId: ref("draft"),
        readonly: ref(false),
        context: ref({}),
        messages,
        authoritativeArtifacts: ref([]),
        browserEnabled: ref(false),
        stream: { messages, isStreaming, isHistoryLoading: ref(false) },
      });
      openArtifact = vi.spyOn(panels.artifactPanel, "select");
      return () => h("div");
    },
  });
  const wrapper = mount(Host);
  wrappers.push(wrapper);
  async function update(nextMessages: Message[], loading = isStreaming.value) {
    messages.value = nextMessages;
    isStreaming.value = loading;
    await nextTick();
  }
  return {
    wrapper,
    update,
    openArtifact,
    routeThreadId,
    ownerKey,
    artifactPanel: panels.artifactPanel,
  };
}
async function advance(ms: number) {
  await vi.advanceTimersByTimeAsync(ms);
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  vi.useRealTimers();
});

describe("actual mounted AgentChat artifact selection owner", () => {
  it("retires an automatic-open timer when the same thread changes Agent", async () => {
    const subject = harness();
    await subject.update([write]);
    await advance(50);
    subject.ownerKey.value = "alice:agent-b";
    await advance(100);
    expect(subject.openArtifact).not.toHaveBeenCalled();
  });
  it("cancels a short pending write when its result arrives before 100ms", async () => {
    const subject = harness();
    await subject.update([write]);
    await advance(50);
    await subject.update([write, result]);
    await advance(200);
    expect(subject.openArtifact).not.toHaveBeenCalled();
  });
  it("opens a still-last pending write only after the full 100ms", async () => {
    const subject = harness();
    await subject.update([write]);
    await advance(99);
    expect(subject.openArtifact).not.toHaveBeenCalled();
    await advance(1);
    expect(subject.openArtifact).toHaveBeenCalledExactlyOnceWith(
      buildWriteFileArtifactURL({
        filepath: "/mnt/user-data/outputs/report.md",
        messageId: "write-message",
        toolCallId: "write-call",
      }),
      true,
    );
  });
  it("cancels when a different last tool takes over", async () => {
    const subject = harness();
    await subject.update([write]);
    await advance(50);
    await subject.update([
      write,
      {
        id: "read-message",
        type: "ai",
        content: "",
        tool_calls: [
          {
            id: "read-call",
            name: "read_file",
            args: { path: "/mnt/user-data/outputs/report.md" },
          },
        ],
      },
    ]);
    await advance(200);
    expect(subject.openArtifact).not.toHaveBeenCalled();
  });
  it("does not auto-open a completed ordinary historical write", async () => {
    const subject = harness([write, result], false);
    await advance(200);
    expect(subject.openArtifact).not.toHaveBeenCalled();
  });
  it("opens a successful finalize result independently of streaming", async () => {
    const finalize: Message = {
      id: "finalize-message",
      type: "ai",
      content: "",
      tool_calls: [
        {
          id: "finalize-call",
          name: "finalize_artifact_write",
          args: { path: "/mnt/user-data/outputs/report.md" },
        },
      ],
    };
    const finalized: Message = {
      id: "finalized",
      type: "tool",
      tool_call_id: "finalize-call",
      name: "finalize_artifact_write",
      content: "OK: artifact written",
    };
    const subject = harness([finalize, finalized], false);
    await advance(99);
    expect(subject.openArtifact).not.toHaveBeenCalled();
    await advance(1);
    expect(subject.openArtifact).toHaveBeenCalledExactlyOnceWith(
      "/mnt/user-data/outputs/report.md",
      true,
    );
  });
  it("cancels the pending selection when the mounted owner retires", async () => {
    const subject = harness();
    await subject.update([write]);
    await advance(50);
    subject.wrapper.unmount();
    await advance(200);
    expect(subject.openArtifact).not.toHaveBeenCalled();
  });
  it("retires a pending write when streaming ends before 100ms", async () => {
    const subject = harness();
    await subject.update([write]);
    await advance(50);
    await subject.update([write], false);
    await advance(200);
    expect(subject.openArtifact).not.toHaveBeenCalled();
  });
  it("cancels if automatic selection is disabled before the timer expires", async () => {
    const subject = harness();
    await subject.update([write]);
    await advance(50);
    subject.artifactPanel.autoSelect.value = false;
    await nextTick();
    await advance(200);
    expect(subject.openArtifact).not.toHaveBeenCalled();
  });
  it("does not select an already selected artifact again", async () => {
    const subject = harness();
    subject.artifactPanel.selectedArtifact.value = buildWriteFileArtifactURL({
      filepath: "/mnt/user-data/outputs/report.md",
      messageId: "write-message",
      toolCallId: "write-call",
    });
    await subject.update([write]);
    await advance(200);
    expect(subject.openArtifact).not.toHaveBeenCalled();
  });

  it("does not treat a received empty result as a pending tool", async () => {
    const subject = harness();
    await subject.update([write, { ...result, content: "" }]);
    await advance(200);
    expect(subject.openArtifact).not.toHaveBeenCalled();
  });

  it.each(["Permission denied", '{"ok":true}', ""])(
    "does not auto-open an unsuccessful finalize result: %s",
    async (content) => {
      const subject = harness(
        [
          {
            id: "finalize-message",
            type: "ai",
            content: "",
            tool_calls: [
              {
                id: "finalize-call",
                name: "finalize_artifact_write",
                args: { path: "/mnt/user-data/outputs/report.md" },
              },
            ],
          },
          {
            id: "finalized",
            type: "tool",
            tool_call_id: "finalize-call",
            content,
          },
        ],
        false,
      );
      await advance(200);
      expect(subject.openArtifact).not.toHaveBeenCalled();
    },
  );
});
