import type { Component } from "vue";
import {
  Ban,
  Bot,
  CalendarClock,
  CircleCheck,
  CirclePause,
  CircleX,
  Clock,
  LoaderCircle,
  TriangleAlert,
} from "lucide-vue-next";
import type { Translations } from "@/core/i18n/locales/types";
import { displayTimeZone, formatTaskTime } from "./format";
import { agentStopTime, describeTaskOutcome } from "./goal-outcome";
import { presentTaskStatus } from "./status";
import { isTaskBusy, type ScheduledTask } from "./types";
import { fill } from "./presentation";
export type TaskLineTone = "neutral" | "ok" | "info" | "warn" | "danger";

export type TaskStatusLine = {
  text: string;
  tone: TaskLineTone;
  icon: Component;
};

/**
 * The one status line under a task in the list: when it runs next, that it is
 * running now, or who stopped it and why. Never an ISO time or enum name.
 */
export function taskListStatusLine(
  task: ScheduledTask,
  t: Translations,
  locale: string,
  now: Date = new Date(),
): TaskStatusLine {
  const st = t.scheduledTasks;
  const time = (iso: string | null | undefined) =>
    iso
      ? formatTaskTime(iso, {
          timeZone: displayTimeZone(task),
          locale,
          labels: st.time,
          now,
        })
      : "";
  if (isTaskBusy(task)) {
    return { text: st.list.runningNow, tone: "info", icon: LoaderCircle };
  }
  if (task.active_run_status === "queued") {
    return { text: st.actions.alreadyQueued, tone: "info", icon: Clock };
  }
  const status = presentTaskStatus(task);
  switch (status.key) {
    case "active": {
      const next = time(task.next_run_at);
      return next
        ? { text: fill(st.list.next, { time: next }), tone: "ok", icon: Clock }
        : { text: st.status.enabled, tone: "ok", icon: CalendarClock };
    }
    case "pausedByAgent": {
      const at = time(agentStopTime(task));
      return {
        text: at
          ? fill(st.list.pausedByAgentOn, { time: at })
          : st.status.pausedByAgent,
        tone: "info",
        icon: Bot,
      };
    }
    case "autoPaused":
      return {
        text: st.list.autoPausedLine,
        tone: "warn",
        icon: TriangleAlert,
      };
    case "paused":
      return { text: st.status.paused, tone: "neutral", icon: CirclePause };
    case "finished": {
      const outcome = describeTaskOutcome(task, [], now);
      if (outcome?.kind === "limitReached") {
        return {
          text: fill(st.list.finishedLimit, { max: outcome.max }),
          tone: "neutral",
          icon: CircleCheck,
        };
      }
      if (outcome?.kind === "endReached") {
        return {
          text: st.list.finishedEnd,
          tone: "neutral",
          icon: CircleCheck,
        };
      }
      return { text: st.status.completed, tone: "neutral", icon: CircleCheck };
    }
    case "failed":
      return { text: st.status.failed, tone: "danger", icon: CircleX };
    case "cancelled":
      return { text: st.status.cancelled, tone: "neutral", icon: Ban };
    case "running":
      return { text: st.list.runningNow, tone: "info", icon: LoaderCircle };
  }
}

export const TONE_CLASS: Record<TaskLineTone, string> = {
  neutral: "text-muted-foreground",
  ok: "text-emerald-700 dark:text-emerald-400",
  info: "text-sky-700 dark:text-sky-400",
  warn: "text-amber-700 dark:text-amber-400",
  danger: "text-destructive",
};
