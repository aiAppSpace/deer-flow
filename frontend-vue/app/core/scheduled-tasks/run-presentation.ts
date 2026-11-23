import type { Component } from "vue";
import {
  Ban,
  CircleCheck,
  CircleDashed,
  CirclePause,
  CircleX,
  Clock,
  CircleHelp,
  LoaderCircle,
  Play,
  TriangleAlert,
} from "lucide-vue-next";
import type { Translations } from "@/core/i18n/locales/types";
import { requestedScheduleStop, type GoalOutcome } from "./goal-outcome";
import { isActiveRun } from "@/core/scheduled-tasks/types";
import type { ScheduledTaskRun } from "./types";
import { fill } from "./presentation";
/** "Run 3", "Trial run", or "Scheduled run" for a scheduled row that never launched. */
export function runLabel(
  run: Pick<ScheduledTaskRun, "trigger" | "run_number">,
  t: Translations,
): string {
  const st = t.scheduledTasks;
  if (run.trigger === "manual") {
    return st.runTrigger.manual;
  }
  return typeof run.run_number === "number"
    ? fill(st.history.runNumber, { n: run.run_number })
    : st.runTrigger.scheduled;
}

export function goalText(goal: GoalOutcome, t: Translations): string {
  const st = t.scheduledTasks;
  if (goal.kind === "met") {
    return st.goal.met;
  }
  if (goal.kind === "unchecked") {
    return st.goal.unchecked;
  }
  return st.runStatus.unmet;
}

/** The goal's reason as a readable line, when the host gave a known code. */
export function goalReason(
  goal: GoalOutcome | null,
  t: Translations,
): string | null {
  if (!goal || goal.kind === "met" || !goal.reasonKey) {
    return null;
  }
  return t.scheduledTasks.goal.reasons[goal.reasonKey];
}

export function runIcon(
  run: ScheduledTaskRun,
  goal: GoalOutcome | null,
): { icon: Component; className: string } {
  if (isActiveRun(run)) {
    return run.status === "queued"
      ? { icon: Clock, className: "text-muted-foreground" }
      : { icon: LoaderCircle, className: "animate-spin text-sky-600" };
  }
  if (requestedScheduleStop(run)) {
    return { icon: CirclePause, className: "text-sky-600" };
  }
  if (goal?.kind === "unmet") {
    return { icon: TriangleAlert, className: "text-amber-600" };
  }
  if (goal?.kind === "unchecked") {
    return { icon: CircleHelp, className: "text-muted-foreground" };
  }
  switch (run.status) {
    case "failed":
      return { icon: CircleX, className: "text-destructive" };
    case "interrupted":
      return { icon: Ban, className: "text-amber-600" };
    case "skipped":
      return { icon: CircleDashed, className: "text-muted-foreground" };
    default:
      return run.trigger === "manual"
        ? { icon: Play, className: "text-muted-foreground" }
        : { icon: CircleCheck, className: "text-emerald-600" };
  }
}
