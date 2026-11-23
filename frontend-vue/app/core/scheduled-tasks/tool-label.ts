import type { Translations } from "@/core/i18n";

const SCHEDULE_TASK_LABEL_KEYS = {
  create: "scheduleTaskCreate",
  update: "scheduleTaskUpdate",
  list: "scheduleTaskList",
  pause: "scheduleTaskPause",
  resume: "scheduleTaskResume",
  delete: "scheduleTaskDelete",
  note: "scheduleTaskNote",
  trial: "scheduleTaskTrial",
} as const;

export function scheduleToolLabel(
  name: string,
  args: Record<string, unknown> | null | undefined,
  result: unknown,
  t: Translations,
): string | null {
  if (name !== "schedule_task" && name !== "stop_scheduled_task") return null;
  if (
    (typeof result === "string" && result.trim() !== "") ||
    (typeof result === "object" &&
      result !== null &&
      ("error" in result || "code" in result))
  ) {
    return t.toolCalls.scheduleTaskFailed;
  }
  if (name === "stop_scheduled_task") return t.toolCalls.stopScheduledTask;
  const action = args?.action;
  const key =
    typeof action === "string" &&
    Object.hasOwn(SCHEDULE_TASK_LABEL_KEYS, action)
      ? SCHEDULE_TASK_LABEL_KEYS[
          action as keyof typeof SCHEDULE_TASK_LABEL_KEYS
        ]
      : "scheduleTaskGeneric";
  return t.toolCalls[key];
}
