import type { Message } from "@langchain/langgraph-sdk";
import { afterEach, beforeEach, expect, it, rs } from "@rstest/core";
import {
  cleanup,
  render,
  fireEvent,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";

import { MessageList } from "@/components/workspace/messages/message-list";
import { I18nContext } from "@/core/i18n/context";
import { enUS } from "@/core/i18n/locales/en-US";
import type { MessageGroup } from "@/core/messages/utils";

const clipboard = {
  writeText: rs.fn<Clipboard["writeText"]>(() => Promise.resolve()),
};
beforeEach(() => {
  rs.spyOn(navigator.clipboard, "writeText").mockImplementation(
    clipboard.writeText,
  );
});

const selectReasoning = rs.hoisted(() =>
  rs.fn((messages: Message[]) =>
    messages.find((message) => message.additional_kwargs?.reasoning_content),
  ),
);

rs.mock("@/components/workspace/messages/message-group", () => ({
  MessageGroup: () => null,
  getMessageGroupReasoningMessage: selectReasoning,
}));
rs.mock("@/components/ai-elements/conversation", () => ({
  ConversationScrollButton: () => null,
  Conversation: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  ConversationContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));
rs.mock("@/components/workspace/messages/virtual-message-list", () => ({
  VirtualMessageList: ({
    groups,
    renderGroup,
  }: {
    groups: MessageGroup[];
    renderGroup: (group: MessageGroup, index: number) => ReactNode;
  }) => (
    <div>
      {groups.map((group, index) => (
        <div key={group.id}>{renderGroup(group, index)}</div>
      ))}
    </div>
  ),
}));
rs.mock("@/components/workspace/messages/message-list-item", () => ({
  MessageListItem: () => null,
}));
rs.mock("@/components/workspace/messages/subtask-card", () => ({
  SubtaskCard: () => null,
}));

afterEach(() => {
  cleanup();
  rs.restoreAllMocks();
  selectReasoning.mockClear();
  clipboard.writeText.mockClear();
});

function reasoningMessage(kind: "processing" | "subagent", duration?: number) {
  return {
    id: "reasoning",
    run_id: "historical-run",
    type: "ai",
    content: "",
    additional_kwargs: {
      reasoning_content: "Consider the question.",
      ...(duration === undefined ? {} : { turn_duration: duration }),
    },
    ...(kind === "subagent"
      ? {
          tool_calls: [
            {
              id: "task",
              name: "task",
              args: { prompt: "Research", subagent_type: "general-purpose" },
            },
          ],
        }
      : {}),
  } satisfies Message & { run_id: string };
}

const getMessagesMetadata = () => undefined;
function view(
  messages: Message[],
  isLoading: boolean,
  revision = 0,
  metadata: (
    message: Message,
  ) =>
    | { streamMetadata: Record<string, unknown> }
    | undefined = getMessagesMetadata,
) {
  return (
    <I18nContext.Provider
      value={{ locale: "en-US", setLocale: () => undefined, t: enUS }}
    >
      <MessageList
        className={`revision-${revision}`}
        threadId="reasoning-cache"
        thread={
          {
            messages,
            isLoading,
            isThreadLoading: false,
            values: {},
            getMessagesMetadata: metadata,
          } as unknown as React.ComponentProps<typeof MessageList>["thread"]
        }
      />
    </I18nContext.Provider>
  );
}

for (const kind of ["processing", "subagent"] as const) {
  for (const isLoading of [true, false]) {
    it(`skips unused ${kind} targets: loading=${isLoading}`, () => {
      render(view([reasoningMessage(kind)], isLoading));
      expect(selectReasoning).not.toHaveBeenCalled();
    });
  }

  it(`reuses ${kind} targets and invalidates changed messages`, () => {
    const message = reasoningMessage(kind, 31);
    const messages = [message];
    const { rerender } = render(view(messages, false));
    expect(selectReasoning).toHaveBeenCalledTimes(1);
    for (let revision = 1; revision <= 5; revision++) {
      rerender(view(messages, false, revision));
    }
    expect(selectReasoning).toHaveBeenCalledTimes(1);
    const changed = {
      ...message,
      additional_kwargs: {
        ...message.additional_kwargs,
        reasoning_content: "Updated reasoning.",
      },
    };
    rerender(view([changed], false));
    expect(selectReasoning).toHaveBeenCalledTimes(2);
    expect(selectReasoning.mock.calls.at(-1)?.[0][0]).toBe(changed);
  });
}

it("reuses historical targets across actual streaming message updates", () => {
  const history: Message[] = [
    { id: "old-human", type: "human", content: "Previous question" },
    reasoningMessage("processing", 31),
    { id: "new-human", type: "human", content: "Next question" },
  ];
  const live = (chunk: number): Message => ({
    id: "live-reasoning",
    type: "ai",
    content: "",
    additional_kwargs: { reasoning_content: `Live reasoning ${chunk}` },
  });
  const { rerender } = render(view([...history, live(0)], true));
  expect(selectReasoning).toHaveBeenCalledTimes(1);
  for (let chunk = 1; chunk <= 5; chunk++) {
    rerender(view([...history, live(chunk)], true));
  }
  expect(selectReasoning).toHaveBeenCalledTimes(1);
});

const copyHuman: Message = {
  type: "human",
  id: "human-copy",
  content: "Question",
};
const copyCompleted: Message = {
  type: "ai",
  id: "completed-copy",
  content: "Completed answer",
  additional_kwargs: { reasoning_content: "Completed thought" },
};
const copyLive: Message = {
  type: "ai",
  id: "live-copy",
  content: "Streaming answer",
  additional_kwargs: { reasoning_content: "Live thought" },
};
const copyHidden: Message = {
  type: "human",
  id: "hidden-copy",
  content: "Save agent",
  additional_kwargs: { hide_from_ui: true },
};
const copyOptimistic: Message = {
  type: "human",
  id: "optimistic-copy",
  content: "Continue",
};
const copyTool: Message = {
  type: "ai",
  id: "tool-copy",
  content: "",
  tool_calls: [{ id: "call", name: "bash", args: {} }],
};
for (const [name, messages, liveIds] of [
  ["new run waiting", [copyHuman, copyCompleted], []],
  ["hidden control", [copyHuman, copyCompleted, copyHidden], []],
  ["visible optimistic input", [copyHuman, copyCompleted, copyOptimistic], []],
  [
    "later live processing",
    [copyHuman, copyCompleted, copyTool],
    ["tool-copy"],
  ],
  [
    "live answer before optimistic input",
    [copyHuman, copyCompleted, copyLive, copyOptimistic],
    ["live-copy"],
  ],
] as const) {
  it(`reference copy ownership: ${name}`, async () => {
    render(
      view([...messages], true, 0, (message) =>
        liveIds.some((id) => id === message.id)
          ? { streamMetadata: { langgraph_node: "agent" } }
          : undefined,
      ),
    );
    expect(
      screen.getAllByRole("button", { name: "Copy to clipboard" }),
    ).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Copy to clipboard" }));
    await waitFor(() =>
      expect(clipboard.writeText).toHaveBeenCalledExactlyOnceWith(
        "Completed answer",
      ),
    );
  });
}
for (const hidden of [false, true]) {
  it(`reference live answer has no copy until settled, hidden=${hidden}`, async () => {
    const messages = [copyHuman, copyLive, ...(hidden ? [copyHidden] : [])];
    const metadata = (message: Message) =>
      message.id === "live-copy"
        ? { streamMetadata: { langgraph_node: "agent" } }
        : undefined;
    const subject = render(view(messages, true, 0, metadata));
    expect(
      screen.queryByRole("button", { name: "Copy to clipboard" }),
    ).toBeNull();
    subject.rerender(view(messages, false, 1, metadata));
    fireEvent.click(screen.getByRole("button", { name: "Copy to clipboard" }));
    await waitFor(() =>
      expect(clipboard.writeText).toHaveBeenCalledExactlyOnceWith(
        "Streaming answer",
      ),
    );
  });
}
