import { describe, expect, it } from "vitest";
import { enUS, zhCN } from "@/core/i18n";
import { scheduleToolLabel } from "@/core/scheduled-tasks/tool-label";

describe.each([enUS, zhCN])("scheduled tool labels", (t) => {
  it.each([
    ["create", "scheduleTaskCreate"],
    ["update", "scheduleTaskUpdate"],
    ["list", "scheduleTaskList"],
    ["pause", "scheduleTaskPause"],
    ["resume", "scheduleTaskResume"],
    ["delete", "scheduleTaskDelete"],
    ["note", "scheduleTaskNote"],
    ["trial", "scheduleTaskTrial"],
  ] as const)(
    "labels the %s action with a successful parsed result",
    (action, key) => {
      expect(
        scheduleToolLabel("schedule_task", { action }, { action }, t),
      ).toBe(t.toolCalls[key]);
    },
  );

  it.each(["toString", "constructor", "unknown", undefined])(
    "uses the generic label for an unsupported action %s",
    (action) => {
      expect(scheduleToolLabel("schedule_task", { action }, undefined, t)).toBe(
        t.toolCalls.scheduleTaskGeneric,
      );
    },
  );

  it.each(["invalid arguments", { error: null }, { code: "forbidden" }])(
    "shows failure for a rejected result before selecting a success label",
    (result) => {
      for (const name of ["schedule_task", "stop_scheduled_task"]) {
        expect(scheduleToolLabel(name, { action: "create" }, result, t)).toBe(
          t.toolCalls.scheduleTaskFailed,
        );
      }
    },
  );

  it("labels stopping a schedule and ignores unrelated tool names", () => {
    expect(scheduleToolLabel("stop_scheduled_task", null, undefined, t)).toBe(
      t.toolCalls.stopScheduledTask,
    );
    expect(scheduleToolLabel("schedule_task", null, "   ", t)).toBe(
      t.toolCalls.scheduleTaskGeneric,
    );
    expect(
      scheduleToolLabel("other", { action: "create" }, { error: 1 }, t),
    ).toBeNull();
  });
});
