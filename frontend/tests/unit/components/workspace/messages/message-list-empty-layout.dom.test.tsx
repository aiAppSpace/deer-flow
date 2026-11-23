import type { Message } from "@langchain/langgraph-sdk";
import { afterEach, expect, it, rs } from "@rstest/core";
import { cleanup, render } from "@testing-library/react";
import type { ComponentProps } from "react";

import { MessageList } from "@/components/workspace/messages/message-list";
import { I18nContext } from "@/core/i18n/context";
import { enUS } from "@/core/i18n/locales/en-US";
import type { MessageGroup } from "@/core/messages/utils";
import type { ScheduledTaskEvent } from "@/core/scheduled-tasks/events";

rs.mock("@/components/workspace/messages/message-group", () => ({
  MessageGroup: () => null,
  getMessageGroupReasoningMessage: () => undefined,
}));
rs.mock("@/components/ai-elements/conversation", () => ({
  Conversation: (props: ComponentProps<"div">) => <div {...props} />,
  ConversationContent: (props: ComponentProps<"div">) => (
    <div {...props} data-testid="content-boundary" />
  ),
}));
rs.mock("@/components/workspace/messages/virtual-message-list", () => ({
  VirtualMessageList: ({
    groups,
    renderGroup,
  }: {
    groups: MessageGroup[];
    renderGroup: (group: MessageGroup, index: number) => React.ReactNode;
  }) => <div data-testid="rows-boundary">{groups.map(renderGroup)}</div>,
}));
rs.mock("@/components/workspace/messages/message-list-item", () => ({
  MessageListItem: ({ message }: { message: Message }) => (
    <div>{typeof message.content === "string" ? message.content : null}</div>
  ),
}));
rs.mock("@/components/workspace/messages/subtask-card", () => ({
  SubtaskCard: () => null,
}));
rs.mock("next/link", () => ({
  default: (props: ComponentProps<"a">) => <a {...props} />,
}));

afterEach(cleanup);
const event: ScheduledTaskEvent = {
  id: "paused-event",
  task_id: "schedule",
  event: "task_stopped",
  reason_code: "agent_stop",
  task_title: "Daily review",
  stop_condition: null,
  run_thread_id: null,
  run_number: null,
  run_status: null,
  max_runs: null,
  end_at: null,
  schedule_type: null,
  after_run_id: null,
  created_at: "2026-10-10T00:00:00Z",
};
type Props = ComponentProps<typeof MessageList>;
const getMessagesMetadata = () => undefined;
function view(
  options: {
    messages?: Message[];
    loading?: boolean;
    history?: boolean;
    historyLoading?: boolean;
    events?: ScheduledTaskEvent[];
  } = {},
) {
  return (
    <I18nContext.Provider
      value={{ locale: "en-US", setLocale: () => undefined, t: enUS }}
    >
      <MessageList
        threadId="empty-layout"
        testId="message-owner"
        paddingBottom={24}
        scheduledTaskEvents={options.events}
        hasMoreHistory={options.history}
        isHistoryLoading={options.historyLoading}
        thread={
          {
            messages: options.messages ?? [],
            isLoading: options.loading ?? false,
            isThreadLoading: false,
            values: {},
            getMessagesMetadata,
          } as unknown as Props["thread"]
        }
      />
    </I18nContext.Provider>
  );
}

it("retires only empty timeline gutters while preserving the owner through real content and activity", () => {
  const result = render(view());
  const owner = result.getByTestId("message-owner");
  const content = result.getByTestId("content-boundary");
  const expectGutters = (present: boolean) => {
    expect(result.getByTestId("message-owner")).toBe(owner);
    expect(result.getByTestId("content-boundary")).toBe(content);
    expect(content.classList.contains("pt-8")).toBe(present);
    expect(
      Boolean(
        content.lastElementChild
          ?.getAttribute("style")
          ?.includes("height: 24px"),
      ),
    ).toBe(present);
  };
  expectGutters(false);
  result.rerender(
    view({
      messages: [{ id: "human", type: "human", content: "A real message" }],
    }),
  );
  expect(content.textContent).toContain("A real message");
  expectGutters(true);
  result.rerender(view({ loading: true }));
  expect(result.getByTestId("run-activity")).toBeTruthy();
  expectGutters(true);
  result.rerender(view({ history: true }));
  expect(content.textContent).toContain("Load more");
  expectGutters(true);
  result.rerender(view({ historyLoading: true }));
  expect(content.querySelector("button")?.disabled).toBe(true);
  expectGutters(true);
  result.rerender(view({ events: [event] }));
  expect(content.textContent).toContain("Daily review");
  expectGutters(true);
  result.rerender(view());
  expectGutters(false);
});
