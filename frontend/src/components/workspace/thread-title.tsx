import type { BaseStream } from "@langchain/langgraph-sdk";
import { useEffect } from "react";

import { useI18n } from "@/core/i18n/hooks";
import type { AgentThreadState } from "@/core/threads";
import { cn } from "@/lib/utils";

import { useThreadChat } from "./chats";
import { FlipDisplay } from "./flip-display";

export type ThreadTitleProps = {
  className?: string;
  threadId: string;
  thread: BaseStream<AgentThreadState>;
  canonicalTitle?: string;
};

export function ThreadTitle({
  className,
  threadId,
  thread,
  canonicalTitle,
}: ThreadTitleProps) {
  const { t } = useI18n();
  const { isNewThread } = useThreadChat();
  const title = canonicalTitle?.length ? canonicalTitle : thread.values?.title;

  useEffect(() => {
    // Precedence, best-known first. "Loading..." is a placeholder for a name we
    // do not have yet, so it must not overwrite one we do: the previous order
    // let it win outright, which flashed `Loading... - DeerFlow` over `New Chat`
    // during the new-chat handoff. Next's route announcer (aria-live=assertive)
    // reads document.title on navigation, so that flash was announced and then
    // left standing — the user hears "Loading..." and never hears a correction
    // (WCAG 4.1.3). Measured on the parity harness: the announcer's text was
    // the last non-deterministic thing left in this scenario.
    //
    // `title` (not `thread.values?.title`) is #5045's source: it prefers the
    // canonical title so a rename stays in sync. That only changes *which*
    // known name wins — the ordering below is what keeps the placeholder from
    // outranking any of them.
    let _title: string;
    if (title) {
      _title = title;
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
    title,
  ]);

  if (!title) {
    return null;
  }
  return (
    <FlipDisplay
      uniqueKey={threadId}
      className={cn("min-w-0 [&>div]:truncate", className)}
    >
      {title}
    </FlipDisplay>
  );
}
