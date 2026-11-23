import type { ScheduledTaskPayload, ScheduledTaskUpdatePayload } from "./api";
import {
  editedZonedLocalToUtcIso,
  hasScheduleSpec,
  onceRunAtInstant,
  parseCron,
  serializeCron,
  utcToZonedLocalInput,
} from "./cron";
import { browserTimeZone } from "./format";
import type { ScheduleValue } from "./schedule";
import type { ScheduledTask } from "./types";
const DEFAULT_ASSISTANT_ID = "lead_agent";
export type TaskFormMode = "create" | "edit" | "duplicate";

export type TaskFormRequest = {
  mode: TaskFormMode;
  /** Source task for edit and duplicate. */
  task?: ScheduledTask;
  /** Field to focus when the dialog opens. */
  focus?: "goal";
};

type ContextMode = ScheduledTask["context_mode"];

export type TaskFormState = {
  title: string;
  prompt: string;
  stopCondition: string;
  goal: string;
  maxRuns: string;
  /** datetime-local wall value in the schedule's timezone; "" = no end time. */
  endAtLocal: string;
  schedule: ScheduleValue;
  assistantId: string;
  contextMode: ContextMode;
  chatId: string;
};

const DEFAULT_SCHEDULE: ScheduleValue = {
  schedule_type: "cron",
  schedule_spec: { cron: "0 9 * * *" },
  timezone: "",
};

function scheduleOf(task: ScheduledTask): ScheduleValue {
  const spec = task.schedule_spec as {
    cron?: unknown;
    run_at?: unknown;
    every_seconds?: unknown;
  };
  return {
    schedule_type: task.schedule_type,
    schedule_spec: {
      cron: typeof spec.cron === "string" ? spec.cron : undefined,
      run_at: typeof spec.run_at === "string" ? spec.run_at : undefined,
      every_seconds:
        typeof spec.every_seconds === "number" ? spec.every_seconds : undefined,
    },
    timezone: task.timezone || browserTimeZone(),
  };
}

/** "Daily report (copy)" / "日报（副本）": a half-width suffix gets a space. */
export function copyTitle(title: string, suffix: string): string {
  return suffix.startsWith("(") ? `${title} ${suffix}` : `${title}${suffix}`;
}

export function initialFormState(
  request: TaskFormRequest,
  copySuffix: string,
  now: Date = new Date(),
): { state: TaskFormState; endAtDropped: boolean } {
  const task = request.task;
  if (!task || request.mode === "create") {
    return {
      state: {
        title: "",
        prompt: "",
        stopCondition: "",
        goal: "",
        maxRuns: "",
        endAtLocal: "",
        schedule: DEFAULT_SCHEDULE,
        assistantId: DEFAULT_ASSISTANT_ID,
        contextMode: "fresh_thread_per_run",
        chatId: "",
      },
      endAtDropped: false,
    };
  }
  const schedule = scheduleOf(task);
  const endAtPassed =
    request.mode === "duplicate" &&
    task.end_at != null &&
    Date.parse(task.end_at) <= now.getTime();
  return {
    state: {
      title:
        request.mode === "duplicate"
          ? copyTitle(task.title, copySuffix)
          : task.title,
      prompt: task.prompt,
      stopCondition: task.stop_condition ?? "",
      goal: task.goal_objective ?? "",
      maxRuns: task.max_runs != null ? String(task.max_runs) : "",
      endAtLocal:
        task.end_at && !endAtPassed
          ? utcToZonedLocalInput(task.end_at, schedule.timezone)
          : "",
      schedule,
      assistantId: task.assistant_id ?? DEFAULT_ASSISTANT_ID,
      contextMode: task.context_mode,
      chatId: task.thread_id ?? "",
    },
    endAtDropped: endAtPassed,
  };
}

function sameSchedule(task: ScheduledTask, value: ScheduleValue): boolean {
  if (task.schedule_type !== value.schedule_type) return false;
  if ((task.timezone || "UTC") !== (value.timezone || "UTC")) return false;
  const spec = task.schedule_spec;
  const next = value.schedule_spec;
  switch (value.schedule_type) {
    case "once":
      return (
        typeof spec.run_at === "string" &&
        typeof next.run_at === "string" &&
        Date.parse(onceRunAtInstant(spec.run_at, task.timezone || "UTC")) ===
          Date.parse(onceRunAtInstant(next.run_at, value.timezone || "UTC"))
      );
    case "interval":
      return spec.every_seconds === next.every_seconds;
    case "cron": {
      // The schedule input re-serializes a cron it shows as a preset
      // ("0 09 * * 0,6" -> "0 9 * * 6,0"); compare that form, so an untouched
      // schedule is never re-sent and never re-arms a finished task.
      const canonical = (cron: unknown) => {
        if (typeof cron !== "string") return "";
        const { preset, parts } = parseCron(cron);
        return serializeCron(preset, parts).split(/\s+/).join(" ");
      };
      return canonical(spec.cron) === canonical(next.cron);
    }
  }
}

function normalizeText(value: string): string | null {
  const text = value.trim();
  return text ? text : null;
}

export type FormValidation =
  | { ok: true; maxRuns: number | null; endAt: string | null }
  | {
      ok: false;
      error: "required" | "invalidMaxRuns" | "invalidEndAt" | "goalNeedsFresh";
    };

/**
 * `storedEndAt` is the source task's end time (edit and duplicate): kept
 * as is while the end-time field still shows it.
 */
export function validateForm(
  state: TaskFormState,
  storedEndAt?: string | null,
): FormValidation {
  if (
    !state.title.trim() ||
    !state.prompt.trim() ||
    !hasScheduleSpec(state.schedule.schedule_spec) ||
    (state.contextMode === "reuse_thread" && !state.chatId.trim())
  ) {
    return { ok: false, error: "required" };
  }
  let maxRuns: number | null = null;
  if (state.maxRuns.trim() !== "") {
    const value = Number(state.maxRuns);
    if (!Number.isInteger(value) || value < 1) {
      return { ok: false, error: "invalidMaxRuns" };
    }
    maxRuns = value;
  }
  let endAt: string | null = null;
  if (state.endAtLocal) {
    endAt = editedZonedLocalToUtcIso(
      state.endAtLocal,
      state.schedule.timezone || browserTimeZone(),
      storedEndAt,
    );
    if (!endAt) {
      return { ok: false, error: "invalidEndAt" };
    }
  }
  if (state.contextMode === "reuse_thread" && normalizeText(state.goal)) {
    return { ok: false, error: "goalNeedsFresh" };
  }
  return { ok: true, maxRuns, endAt };
}

/** Full create body (also used by Duplicate). */
export function createPayload(
  state: TaskFormState,
  valid: { maxRuns: number | null; endAt: string | null },
): ScheduledTaskPayload {
  const reuse = state.contextMode === "reuse_thread";
  const payload: ScheduledTaskPayload = {
    context_mode: state.contextMode,
    thread_id: reuse ? state.chatId.trim() : null,
    assistant_id: state.assistantId,
    title: state.title.trim(),
    prompt: state.prompt,
    schedule_type: state.schedule.schedule_type,
    schedule_spec: state.schedule.schedule_spec,
    timezone: state.schedule.timezone || "UTC",
  };
  const goal = reuse ? null : normalizeText(state.goal);
  if (goal) payload.goal_objective = goal;
  if (valid.maxRuns != null) payload.max_runs = valid.maxRuns;
  if (valid.endAt) payload.end_at = valid.endAt;
  const stop = normalizeText(state.stopCondition);
  if (stop) payload.stop_condition = stop;
  return payload;
}

/**
 * PATCH body: only what changed. Clearing the goal, stop condition, run limit
 * or end time sends `null`; the schedule is sent (with its timezone) only
 * when it changed, so an untouched one-time instant is never re-submitted.
 */
export function updatePayload(
  task: ScheduledTask,
  state: TaskFormState,
  valid: { maxRuns: number | null; endAt: string | null },
  { includeStopCondition }: { includeStopCondition: boolean },
): ScheduledTaskUpdatePayload {
  const updates: ScheduledTaskUpdatePayload = {};
  const title = state.title.trim();
  if (title !== task.title) updates.title = title;
  if (state.prompt !== task.prompt) updates.prompt = state.prompt;
  if (!sameSchedule(task, state.schedule)) {
    updates.schedule_spec = state.schedule.schedule_spec;
    updates.timezone = state.schedule.timezone || "UTC";
  }
  if (state.assistantId !== (task.assistant_id ?? DEFAULT_ASSISTANT_ID)) {
    updates.assistant_id = state.assistantId;
  }
  const reuse = state.contextMode === "reuse_thread";
  if (state.contextMode !== task.context_mode) {
    updates.context_mode = state.contextMode;
    updates.thread_id = reuse ? state.chatId.trim() : null;
  } else if (reuse && state.chatId.trim() !== (task.thread_id ?? "")) {
    updates.thread_id = state.chatId.trim();
  }
  const goal = reuse ? null : normalizeText(state.goal);
  if (goal !== (task.goal_objective ?? null)) updates.goal_objective = goal;
  if (includeStopCondition) {
    const stop = normalizeText(state.stopCondition);
    if (stop !== (task.stop_condition ?? null)) updates.stop_condition = stop;
  }
  if (valid.maxRuns !== (task.max_runs ?? null)) {
    updates.max_runs = valid.maxRuns;
  }
  // The input has minute precision: an untouched end time with seconds must
  // not count as a change.
  const minute = (iso: string) => Math.floor(Date.parse(iso) / 60_000);
  const endChanged =
    valid.endAt === null
      ? task.end_at != null
      : !task.end_at || minute(valid.endAt) !== minute(task.end_at);
  if (endChanged) updates.end_at = valid.endAt;
  return updates;
}
