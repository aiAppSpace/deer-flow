import { describe, expect, it } from "vitest";
import {
  initialFormState,
  copyTitle,
  createPayload,
} from "@/core/scheduled-tasks/form-state";
import { task } from "./fixtures";
describe("duplicate current scheduled task", () => {
  it("copies all task inputs with a localized title suffix", () => {
    const original = task({
      assistant_id: "research",
      goal_objective: "Find it",
      stop_condition: "Published",
      max_runs: 6,
      end_at: "2030-01-15T09:00:00Z",
      timezone: "Asia/Shanghai",
    });
    const edit = initialFormState(
      { mode: "edit", task: original },
      "(copy)",
    ).state;
    const copy = initialFormState(
      { mode: "duplicate", task: original },
      "(copy)",
      new Date("2030-01-01"),
    ).state;
    expect(copy.title).toBe("Daily digest (copy)");
    expect({ ...copy, title: edit.title }).toEqual(edit);
  });
  it("keeps a reused chat ID and custom agent", () => {
    const state = initialFormState(
      {
        mode: "duplicate",
        task: task({
          context_mode: "reuse_thread",
          thread_id: "chat",
          assistant_id: "analyst",
        }),
      },
      "(copy)",
    ).state;
    expect(createPayload(state, { maxRuns: null, endAt: null })).toMatchObject({
      context_mode: "reuse_thread",
      thread_id: "chat",
      assistant_id: "analyst",
    });
  });
  it("preserves interval seconds and timezone", () => {
    const state = initialFormState(
      {
        mode: "duplicate",
        task: task({
          schedule_type: "interval",
          schedule_spec: { every_seconds: 91 },
          timezone: "Asia/Shanghai",
        }),
      },
      "(copy)",
    ).state;
    expect(state.schedule).toEqual({
      schedule_type: "interval",
      schedule_spec: { cron: undefined, run_at: undefined, every_seconds: 91 },
      timezone: "Asia/Shanghai",
    });
  });
  it("formats English and Chinese suffixes", () => {
    expect(copyTitle("Daily", "(copy)")).toBe("Daily (copy)");
    expect(copyTitle("日报", "（副本）")).toBe("日报（副本）");
  });
  it("drops only past end time on duplication and surfaces that fact", () => {
    const source = task({ end_at: "2029-01-01T00:00:00Z", max_runs: 4 });
    const result = initialFormState(
      { mode: "duplicate", task: source },
      "(copy)",
      new Date("2030-01-01"),
    );
    expect(result.endAtDropped).toBe(true);
    expect(result.state.endAtLocal).toBe("");
    expect(result.state.maxRuns).toBe("4");
  });
  it("keeps past end time visible while editing", () => {
    const result = initialFormState(
      { mode: "edit", task: task({ end_at: "2029-01-01T00:00:00Z" }) },
      "",
      new Date("2030-01-01"),
    );
    expect(result.endAtDropped).toBe(false);
    expect(result.state.endAtLocal).not.toBe("");
  });
});
