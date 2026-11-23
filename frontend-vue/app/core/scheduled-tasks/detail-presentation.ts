import type { Translations } from "@/core/i18n/locales/types";
import {
  displayTimeZone,
  formatTaskTime,
  formatWithViewerTime,
} from "./format";
import { isTaskBusy, type ScheduledTask } from "./types";
import { fill } from "./presentation";
const TERMINAL = new Set(["completed", "failed", "cancelled"]);
export function nextRunLine(
  task: ScheduledTask,
  t: Translations,
  locale: string,
  now: Date = new Date(),
): string | null {
  const st = t.scheduledTasks;
  const at = (iso: string) =>
    formatWithViewerTime(iso, displayTimeZone(task), {
      locale,
      labels: st.time,
      now,
    });
  if (isTaskBusy(task)) {
    return st.list.runningNow;
  }
  if (task.active_run_status === "queued") {
    return st.actions.alreadyQueued;
  }
  if (TERMINAL.has(task.status)) {
    return st.detail.noMoreRuns;
  }
  const future =
    task.next_run_at && Date.parse(task.next_run_at) > now.getTime()
      ? task.next_run_at
      : null;
  if (task.status === "paused") {
    return future
      ? `${st.detail.notWhilePaused} · ${fill(st.detail.ifResumed, { time: at(future) })}`
      : st.detail.notWhilePaused;
  }
  if (!task.next_run_at) {
    return null;
  }
  const neverRan = task.run_count === 0 && !task.last_run_at;
  return fill(neverRan ? st.detail.firstRun : st.detail.next, {
    time: at(task.next_run_at),
  });
}

/**
 * The "Stops when" lines: the user's stop condition (with when it was met),
 * else what ends the task; then the safety cap with runs used.
 */
export function stopLines(
  task: ScheduledTask,
  t: Translations,
  locale: string,
  {
    toolEnabled,
    reachedAt,
  }: { toolEnabled: boolean; reachedAt: string | null },
): { primary: string; reached: string | null; secondary: string[] } {
  const st = t.scheduledTasks;
  const tz = displayTimeZone(task);
  const at = (iso: string) =>
    formatTaskTime(iso, { timeZone: tz, locale, labels: st.time });
  const used = task.automatic_runs_used ?? 0;
  const max = task.max_runs ?? null;
  const end = task.end_at ?? null;
  const condition =
    toolEnabled && task.stop_condition?.trim() ? task.stop_condition : null;

  const capLine = (): string | null => {
    if (max != null && end) {
      return fill(st.stop.capBoth, { max, time: at(end) });
    }
    if (max != null) {
      return used > 0
        ? fill(st.stop.capRunsUsed, { used, max })
        : fill(st.stop.capRuns, { max });
    }
    if (end) {
      return fill(st.stop.capEnd, { time: at(end) });
    }
    return null;
  };

  const secondary: string[] = [];
  let primary: string;
  if (condition) {
    primary = fill(st.stop.pausesItself, { condition });
    const cap = capLine();
    if (cap) secondary.push(cap);
  } else if (max != null || end) {
    primary =
      max != null && end
        ? fill(st.stop.capBoth, { max, time: at(end) })
        : max != null
          ? fill(st.stop.afterRuns, { max })
          : fill(st.stop.atTime, { time: at(end ?? "") });
    if (max != null && used > 0) {
      secondary.push(fill(st.stop.capRunsUsed, { used, max }));
    }
  } else {
    primary = st.stop.noRule;
  }
  if (max != null) {
    secondary.push(st.stop.trialsDontCount);
  }
  if (task.goal_objective) {
    secondary.push(st.stop.autoPauseRule);
  }
  return {
    primary,
    reached:
      condition && reachedAt
        ? fill(st.stop.reached, {
            time: formatTaskTime(reachedAt, {
              timeZone: tz,
              locale,
              labels: st.timeInline,
            }),
          })
        : null,
    secondary,
  };
}
