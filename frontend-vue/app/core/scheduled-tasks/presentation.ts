import type { Translations } from "@/core/i18n/locales/types";
import { pathOfThread } from "@/core/threads/utils";
import type { TaskActionBlockReason } from "./actions";
import type { ScheduledTask } from "./types";
/** The built-in agent; shown as "Default agent", never by this id. */
export const DEFAULT_ASSISTANT_ID = "lead_agent";

export function isDefaultAgent(assistantId: string | null | undefined) {
  return !assistantId || assistantId === DEFAULT_ASSISTANT_ID;
}

/** Route of a chat that belongs to `task` (custom-agent chats live under the agent). */
export function taskChatPath(
  threadId: string,
  task: Pick<ScheduledTask, "assistant_id">,
): string {
  return pathOfThread(
    threadId,
    isDefaultAgent(task.assistant_id)
      ? null
      : { agent_name: task.assistant_id ?? undefined },
  );
}

/** Fill `{name}` placeholders. */
export function fill(
  template: string,
  params: Record<string, string | number>,
): string {
  return template.replace(/\{([a-z_]+)\}/gi, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/**
 * Runs more often than hourly: an interval under an hour, or a cron whose
 * minute field is not a single number (the backend's `is_frequent_schedule`).
 * Chat-created tasks on such a schedule must keep a safety cap.
 */
export function isFrequentSchedule(
  scheduleType: ScheduledTask["schedule_type"],
  spec: Record<string, unknown>,
): boolean {
  if (scheduleType === "interval") {
    const seconds = spec.every_seconds;
    return typeof seconds === "number" && seconds < 3600;
  }
  if (scheduleType === "cron") {
    const minute =
      typeof spec.cron === "string" ? spec.cron.trim().split(/\s+/)[0] : "";
    return !/^[0-9]+$/.test(minute ?? "");
  }
  return false;
}

export type StatusTab = "all" | "active" | "paused" | "finished";

/** The status tab a task belongs to (besides "all"). */
export function statusTabOf(
  task: Pick<ScheduledTask, "status">,
): Exclude<StatusTab, "all"> {
  switch (task.status) {
    case "paused":
      return "paused";
    case "completed":
    case "failed":
    case "cancelled":
      return "finished";
    default:
      return "active";
  }
}

export function blockReasonText(
  reason: TaskActionBlockReason | undefined,
  t: Translations,
): string | null {
  const st = t.scheduledTasks;
  switch (reason) {
    case "running":
      return st.actions.busyRunning;
    case "queued":
      return st.actions.busyQueued;
    case "queuedNoPause":
      return st.actions.busyQueuedPaused;
    case "alreadyQueued":
      return st.actions.alreadyQueued;
    case "createBlocked":
      return st.page.createBlocked;
    default:
      return null;
  }
}
