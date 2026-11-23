/** Exercise real timeline copy availability, not an unconsumed SDK metadata helper. */
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MessageList from "@/components/chat/MessageList.vue";
import type { Message } from "@/core/types/message";
import {
  createWorkspaceToastStore,
  workspaceToastKey,
} from "@/core/workspace-shell/toast";

const clipboard = vi.hoisted(() => ({ writeTextToClipboard: vi.fn() }));
vi.mock("@/core/clipboard", () => clipboard);
vi.mock("@/components/chat/MessageMarkdown.vue", () => ({
  default: { props: ["content"], template: "<div>{{ content }}</div>" },
}));
const wrappers: ReturnType<typeof mount>[] = [];
const clients: QueryClient[] = [];
beforeEach(() =>
  clipboard.writeTextToClipboard.mockReset().mockResolvedValue(true),
);
afterEach(async () => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  clients.splice(0).forEach((client) => client.clear());
  await flushPromises();
});
const human: Message = { type: "human", id: "human-1", content: "Question" };
const completed: Message = {
  type: "ai",
  id: "answer-1",
  content: "Completed answer",
  additional_kwargs: { reasoning_content: "Completed thought" },
};
const live: Message = {
  type: "ai",
  id: "answer-2",
  content: "Streaming answer",
  additional_kwargs: { reasoning_content: "Live thought" },
};
const hidden: Message = {
  type: "human",
  id: "hidden",
  content: "Save agent",
  additional_kwargs: { hide_from_ui: true },
};
function render(messages: Message[], ids: string[] = [], streaming = true) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  clients.push(client);
  const wrapper = mount(MessageList, {
    props: {
      messages,
      rawMessages: messages,
      streaming,
      loading: false,
      threadId: "copy-owner",
      activeRunId: "active-run",
      streamingMessageIds: new Set(ids),
    },
    global: {
      plugins: [[VueQueryPlugin, { queryClient: client }]],
      provide: { [workspaceToastKey as symbol]: createWorkspaceToastStore() },
      stubs: {
        ReferenceAttachment: true,
        WorkspaceChangesBadge: true,
        SubtaskCard: true,
      },
    },
  });
  wrappers.push(wrapper);
  return wrapper;
}
function copyButtons(wrapper: ReturnType<typeof render>) {
  return wrapper.findAll(
    '[data-testid="assistant-turn-actions"] button[aria-label="Copy to clipboard"]',
  );
}

describe("actual assistant copy owner", () => {
  it.each([
    ["a new run has not yielded any answer", [human, completed]],
    ["a hidden control input has been appended", [human, completed, hidden]],
    [
      "an optimistic visible input is waiting",
      [
        human,
        completed,
        { type: "human", id: "optimistic", content: "Continue" },
      ],
    ],
  ] as const)(
    "keeps a completed answer copyable when %s",
    async (_name, messages) => {
      const wrapper = render([...messages] as Message[]);
      await flushPromises();
      expect(copyButtons(wrapper)).toHaveLength(1);
      await copyButtons(wrapper)[0]!.trigger("click");
      await flushPromises();
      expect(clipboard.writeTextToClipboard).toHaveBeenCalledExactlyOnceWith(
        "Completed answer",
      );
    },
  );

  it.each([false, true])(
    "hides the current live answer copy action, hidden control=%s, then restores it on settlement",
    async (withHidden) => {
      const wrapper = render(
        [human, live, ...(withHidden ? [hidden] : [])],
        [live.id!],
      );
      await flushPromises();
      expect(copyButtons(wrapper)).toHaveLength(0);
      expect(clipboard.writeTextToClipboard).not.toHaveBeenCalled();
      await wrapper.setProps({
        streaming: false,
        streamingMessageIds: new Set<string>(),
      });
      expect(copyButtons(wrapper)).toHaveLength(1);
      await copyButtons(wrapper)[0]!.trigger("click");
      await flushPromises();
      expect(clipboard.writeTextToClipboard).toHaveBeenCalledExactlyOnceWith(
        "Streaming answer",
      );
    },
  );

  it("a later processing group cannot take the completed answer's copy action", async () => {
    const tool: Message = {
      type: "ai",
      id: "tool-ai",
      content: "",
      tool_calls: [{ id: "call", name: "bash", args: {} }],
    };
    const wrapper = render([human, completed, tool], [tool.id!]);
    await flushPromises();
    expect(copyButtons(wrapper)).toHaveLength(1);
    await copyButtons(wrapper)[0]!.trigger("click");
    await flushPromises();
    expect(clipboard.writeTextToClipboard).toHaveBeenCalledExactlyOnceWith(
      "Completed answer",
    );
  });

  it("an optimistic row after a live assistant cannot make that unfinished answer copyable", async () => {
    const wrapper = render(
      [
        human,
        completed,
        live,
        { type: "human", id: "optimistic", content: "Continue" },
      ],
      [live.id!],
    );
    await flushPromises();
    expect(copyButtons(wrapper)).toHaveLength(1);
    await copyButtons(wrapper)[0]!.trigger("click");
    await flushPromises();
    expect(clipboard.writeTextToClipboard).toHaveBeenCalledExactlyOnceWith(
      "Completed answer",
    );
  });
});
