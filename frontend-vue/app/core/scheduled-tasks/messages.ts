import type { Message } from "@/core/types/message";
import { SCHEDULED_ORIGIN_KEY } from "@/core/contracts/backend.gen";
import type { ScheduledOrigin } from "./types";
import {
  parseScheduleToolResult,
  SCHEDULE_TASK_TOOL_NAME,
  type ScheduleToolResult,
} from "./tool-result";

export { SCHEDULED_ORIGIN_KEY };

function stringOr<T>(value: unknown, fallback: T): string | T {
  return typeof value === "string" ? value : fallback;
}

/** The scheduled-launch origin of a human message, or null for ordinary input. */
export function scheduledOriginOf(message: Message): ScheduledOrigin | null {
  if (message.type !== "human") {
    return null;
  }
  const raw: unknown = message.additional_kwargs?.[SCHEDULED_ORIGIN_KEY];
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return null;
  }
  const origin = raw as Record<string, unknown>;
  if (typeof origin.task_id !== "string" || !origin.task_id) {
    return null;
  }
  return {
    task_id: origin.task_id,
    task_run_id: stringOr(origin.task_run_id, ""),
    trigger: origin.trigger === "manual" ? "manual" : "scheduled",
    run_number:
      typeof origin.run_number === "number" ? origin.run_number : null,
    scheduled_for: stringOr(origin.scheduled_for, ""),
    timezone: stringOr(origin.timezone, ""),
    schedule_type:
      origin.schedule_type === "once" ||
      origin.schedule_type === "cron" ||
      origin.schedule_type === "interval"
        ? origin.schedule_type
        : null,
    task_title: stringOr(origin.task_title, ""),
    instructions: stringOr(origin.instructions, ""),
    stop_condition: stringOr(origin.stop_condition, null),
    standing_notes: Array.isArray(origin.standing_notes)
      ? origin.standing_notes.filter(
          (note): note is string => typeof note === "string",
        )
      : [],
  };
}

/** A `schedule_task` tool message whose result renders as a card. */
export function scheduleCardResultOf(
  message: Message,
): ScheduleToolResult | null {
  if (message.type !== "tool" || message.name !== SCHEDULE_TASK_TOOL_NAME) {
    return null;
  }
  return parseScheduleToolResult(message.content);
}
