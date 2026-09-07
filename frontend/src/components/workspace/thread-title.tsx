import type { BaseStream } from "@langchain/langgraph-sdk";
import { useEffect } from "react";

import { useI18n } from "@/core/i18n/hooks";
import type { AgentThreadState } from "@/core/threads";

import { useThreadChat } from "./chats";
import { FlipDisplay } from "./flip-display";

export function ThreadTitle({
  threadId,
  thread,
}: {
  className?: string;
  threadId: string;
  thread: BaseStream<AgentThreadState>;
}) {
  const { t } = useI18n();
  const { isNewThread } = useThreadChat();
  useEffect(() => {
    // Precedence, best-known first. "Loading..." is a placeholder for a name we
    // do not have yet, so it must not overwrite one we do: the previous order
    // let it win outright, which flashed `Loading... - DeerFlow` over `New Chat`
    // during the new-chat handoff. Next's route announcer (aria-live=assertive)
    // reads document.title on navigation, so that flash was announced and then
    // left standing — the user hears "Loading..." and never hears a correction
    // (WCAG 4.1.3). Measured on the parity harness: the announcer's text was
    // the last non-deterministic thing left in this scenario.
    let _title: string;
    if (thread.values?.title) {
      _title = thread.values.title;
    } else if (isNewThread) {
      _title = t.pages.newChat;
    } else if (thread.isThreadLoading) {
      _title = "Loading...";
    } else {
      _title = t.pages.untitled;
    }
    document.title = `${_title} - ${t.pages.appName}`;
  }, [
    isNewThread,
    t.pages.newChat,
    t.pages.untitled,
    t.pages.appName,
    thread.isThreadLoading,
    thread.values,
  ]);

  if (!thread.values?.title) {
    return null;
  }
  return (
    <FlipDisplay uniqueKey={threadId}>
      {thread.values.title ?? "Untitled"}
    </FlipDisplay>
  );
}
