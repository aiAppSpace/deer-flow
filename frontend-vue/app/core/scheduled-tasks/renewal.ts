import type { ScheduledTask, ScheduledTaskRenewal } from "./types";
export function renewalFromForm(
  task: Pick<ScheduledTask, "max_runs" | "end_at">,
  form: {
    maxRuns: string;
    removeMaxRuns: boolean;
    endAt: string | null;
    removeEndAt: boolean;
  },
): ScheduledTaskRenewal | "invalid" {
  const renewal: ScheduledTaskRenewal = {};
  if (form.removeMaxRuns) {
    renewal.max_runs = null;
  } else if (form.maxRuns.trim() !== "") {
    const value = Number(form.maxRuns);
    if (!Number.isInteger(value) || value < 1) {
      return "invalid";
    }
    if (value !== task.max_runs) {
      renewal.max_runs = value;
    }
  }
  if (form.removeEndAt) {
    renewal.end_at = null;
  } else if (form.endAt) {
    const changed =
      !task.end_at || Date.parse(form.endAt) !== Date.parse(task.end_at);
    if (changed) {
      renewal.end_at = form.endAt;
    }
  }
  return renewal;
}
