import { describe, expect, it } from "vitest";
import { statusTabOf } from "@/core/scheduled-tasks/presentation";
import { matchesScheduledTaskQuery } from "@/core/scheduled-tasks/search";
import { availableActions } from "@/core/scheduled-tasks/actions";
import { task } from "./fixtures";
describe("current scheduler tabs and search", () => {
  it.each([
    ["enabled", "active"],
    ["running", "active"],
    ["paused", "paused"],
    ["completed", "finished"],
    ["failed", "finished"],
    ["cancelled", "finished"],
  ] as const)("maps %s to %s", (status, tab) =>
    expect(statusTabOf(task({ status }))).toBe(tab),
  );
  it("searches the current React title and instructions contract", () => {
    const value = task({
      title: "Digest",
      prompt: "Check release",
      stop_condition: "Published",
    });
    expect(matchesScheduledTaskQuery(value, "CHECK")).toBe(true);
    expect(matchesScheduledTaskQuery(value, "digest")).toBe(true);
    expect(matchesScheduledTaskQuery(value, "none")).toBe(false);
  });
  it("allows queued deletion and pause to cancel waiting occurrences", () => {
    const actions = availableActions(task({ active_run_status: "queued" }), {
      createBlocked: false,
    });
    expect(actions.pause.disabled).toBe(false);
    expect(actions.delete.disabled).toBe(false);
    expect(actions.edit.reason).toBe("queued");
    expect(actions.runNow.reason).toBe("alreadyQueued");
  });
  it("blocks deletion while starting or running", () => {
    for (const active_run_status of ["launching", "running"] as const)
      expect(
        availableActions(task({ active_run_status }), { createBlocked: false })
          .delete.reason,
      ).toBe("running");
  });
  it("allows a paused task to run one trial while scheduler creation is off", () => {
    const actions = availableActions(task({ status: "paused" }), {
      createBlocked: true,
    });
    expect(actions.runNow.disabled).toBe(false);
    expect(actions.duplicate.reason).toBe("createBlocked");
  });
});
