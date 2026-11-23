import { describe, expect, it } from "vitest";
import {
  initialFormState,
  validateForm,
  createPayload,
  updatePayload,
} from "@/core/scheduled-tasks/form-state";
import { task } from "./fixtures";
const initial = () => initialFormState({ mode: "create" }, "(copy)").state;
const complete = () => ({ ...initial(), title: "Daily", prompt: "Summarize" });
const valid = { maxRuns: null, endAt: null };
describe("current scheduler form contract", () => {
  it("starts fresh with the default agent and lets the schedule input fill timezone", () => {
    expect(initial()).toMatchObject({
      contextMode: "fresh_thread_per_run",
      chatId: "",
      assistantId: "lead_agent",
      schedule: { timezone: "" },
    });
  });
  it.each(["title", "prompt"] as const)("requires %s", (field) => {
    expect(validateForm({ ...complete(), [field]: "" })).toEqual({
      ok: false,
      error: "required",
    });
  });
  it("requires a schedule and a reused target", () => {
    expect(
      validateForm({
        ...complete(),
        schedule: { schedule_type: "once", schedule_spec: {}, timezone: "UTC" },
      }).ok,
    ).toBe(false);
    expect(
      validateForm({ ...complete(), contextMode: "reuse_thread" }).ok,
    ).toBe(false);
    expect(
      validateForm({
        ...complete(),
        contextMode: "reuse_thread",
        chatId: "thread",
      }).ok,
    ).toBe(true);
  });
  it("includes explicit null thread for fresh and a target only for reuse", () => {
    expect(
      createPayload({ ...complete(), chatId: "stale" }, valid),
    ).toMatchObject({ thread_id: null, assistant_id: "lead_agent" });
    expect(
      createPayload(
        { ...complete(), contextMode: "reuse_thread", chatId: "thread" },
        valid,
      ),
    ).toMatchObject({ thread_id: "thread" });
  });
  it("preserves once precision through creation and untouched PATCH", () => {
    const source = task({
      schedule_type: "once",
      schedule_spec: { run_at: "2030-01-01T09:00:43.123Z" },
    });
    const state = initialFormState({ mode: "edit", task: source }, "").state;
    expect(createPayload(state, valid).schedule_spec.run_at).toBe(
      source.schedule_spec.run_at,
    );
    expect(
      updatePayload(source, state, valid, { includeStopCondition: true }),
    ).toEqual({});
  });
  it("preserves original interval seconds", () => {
    const source = task({
      schedule_type: "interval",
      schedule_spec: { every_seconds: 91 },
    });
    const state = initialFormState({ mode: "edit", task: source }, "").state;
    expect(createPayload(state, valid).schedule_spec.every_seconds).toBe(91);
    expect(
      updatePayload(source, state, valid, { includeStopCondition: true }),
    ).toEqual({});
  });
  it("keeps canonical equivalent cron out of PATCH so completed tasks are not rearmed", () => {
    const source = task({
      status: "completed",
      schedule_spec: { cron: "0 09 * * 0,6" },
    });
    const state = initialFormState({ mode: "edit", task: source }, "").state;
    state.schedule.schedule_spec = { cron: "0 9 * * 6,0" };
    expect(
      updatePayload(source, state, valid, { includeStopCondition: true }),
    ).toEqual({});
  });
  it("sends only changed fields and omission preserves default assistant", () => {
    const source = task();
    const state = initialFormState({ mode: "edit", task: source }, "").state;
    state.title = "Renamed";
    expect(
      updatePayload(source, state, valid, { includeStopCondition: true }),
    ).toEqual({ title: "Renamed" });
    state.assistantId = "custom";
    expect(
      updatePayload(source, state, valid, { includeStopCondition: true }),
    ).toEqual({ title: "Renamed", assistant_id: "custom" });
  });
  it("clears goal, stop rule and safety caps with null", () => {
    const source = task({
      goal_objective: "Find it",
      stop_condition: "Published",
      max_runs: 3,
      end_at: "2030-01-10T09:00:32Z",
    });
    const state = initialFormState({ mode: "edit", task: source }, "").state;
    state.goal = "";
    state.stopCondition = "";
    state.maxRuns = "";
    state.endAtLocal = "";
    expect(
      updatePayload(source, state, valid, { includeStopCondition: true }),
    ).toEqual({
      goal_objective: null,
      stop_condition: null,
      max_runs: null,
      end_at: null,
    });
  });
  it("does not touch stop condition while chat tools are unavailable", () => {
    const source = task({ stop_condition: "Published" });
    const state = initialFormState({ mode: "edit", task: source }, "").state;
    state.stopCondition = "";
    expect(
      updatePayload(source, state, valid, { includeStopCondition: false }),
    ).toEqual({});
  });
  it("rejects goals on reused conversations and clears an existing goal when switching", () => {
    expect(
      validateForm({
        ...complete(),
        contextMode: "reuse_thread",
        chatId: "thread",
        goal: "Find it",
      }),
    ).toEqual({ ok: false, error: "goalNeedsFresh" });
    const source = task({ goal_objective: "Find it" });
    const state = initialFormState({ mode: "edit", task: source }, "").state;
    Object.assign(state, {
      contextMode: "reuse_thread",
      chatId: "thread",
      goal: "",
    });
    expect(
      updatePayload(source, state, valid, { includeStopCondition: true }),
    ).toEqual({
      context_mode: "reuse_thread",
      thread_id: "thread",
      goal_objective: null,
    });
  });
  it.each(["0", "1.5", "bad"])("rejects invalid max runs %s", (maxRuns) => {
    expect(validateForm({ ...complete(), maxRuns })).toEqual({
      ok: false,
      error: "invalidMaxRuns",
    });
  });
  it("preserves an untouched DST fold and fractional end time", () => {
    const source = task({
      timezone: "America/New_York",
      end_at: "2030-11-03T06:30:45.123Z",
    });
    const state = initialFormState({ mode: "edit", task: source }, "").state;
    const checked = validateForm(state, source.end_at);
    expect(checked).toEqual({ ok: true, maxRuns: null, endAt: source.end_at });
    if (checked.ok)
      expect(
        updatePayload(source, state, checked, { includeStopCondition: true }),
      ).toEqual({});
  });
  it("rejects nonexistent end wall time", () => {
    expect(
      validateForm({
        ...complete(),
        endAtLocal: "2030-03-10T02:30",
        schedule: { ...initial().schedule, timezone: "America/New_York" },
      }),
    ).toEqual({ ok: false, error: "invalidEndAt" });
  });
  it("changed end time and schedule sends only those fields", () => {
    const source = task();
    const state = initialFormState({ mode: "edit", task: source }, "").state;
    state.schedule = {
      ...state.schedule,
      schedule_spec: { cron: "0 10 * * 1" },
    };
    expect(
      updatePayload(
        source,
        state,
        { maxRuns: null, endAt: "2030-01-03T12:00:00Z" },
        { includeStopCondition: true },
      ),
    ).toEqual({
      schedule_spec: { cron: "0 10 * * 1" },
      timezone: "UTC",
      end_at: "2030-01-03T12:00:00Z",
    });
  });
});
