import { getAssistantTurnUsageMessages } from "@/core/messages/derived-state";
import { describe, expect, test } from "vitest";
import type { Message } from "@/core/types/message";
import {
  getMessageGroups,
  getLatestEditableTurn,
  getBranchableAssistantGroupIds,
} from "@/core/messages/utils";
import {
  SCHEDULED_ORIGIN_KEY,
  scheduledOriginOf,
} from "@/core/scheduled-tasks/messages";
import {
  loadScheduledThread,
  SCHEDULED_GOAL_NOTES_CONTRACT,
  withOrdinaryHumanTurn,
} from "../../helpers/scheduled-fixtures";
describe("scheduled task cards and run prompts", () => {
  const taskView = (id: string, title = "Release checklist") => ({
    id,
    title,
    status: "enabled",
    schedule_type: "cron",
    schedule_spec: { cron: "0 9 * * 1-5" },
    timezone: "Asia/Shanghai",
  });
  const call = (id: string, args: Record<string, unknown>) =>
    ({
      id: `ai-${id}`,
      type: "ai",
      content: "",
      tool_calls: [{ id, name: "schedule_task", args }],
    }) as Message;
  const result = (id: string, payload: unknown) =>
    ({
      id: `tool-${id}`,
      type: "tool",
      name: "schedule_task",
      tool_call_id: id,
      content: typeof payload === "string" ? payload : JSON.stringify(payload),
    }) as Message;
  const human = { id: "human", type: "human", content: "Every weekday at 9" };
  const reply = { id: "reply", type: "ai", content: "Done." };

  test.each(["create", "update", "trial"])(
    "a %s result yields a card group after its processing group",
    (action) => {
      const groups = getMessageGroups([
        human,
        call("c1", { action }),
        result("c1", { action, display: "card", task: taskView("task-1") }),
        reply,
      ] as Message[]);
      expect(groups.map((group) => group.type)).toEqual([
        "human",
        "assistant:processing",
        "assistant:scheduled-task",
        "assistant",
      ]);
      // The step stays in its processing group for the tool label.
      expect(groups[1]?.messages.map((message) => message.id)).toContain(
        "tool-c1",
      );
      const card = groups[2];
      expect(
        card?.type === "assistant:scheduled-task" &&
          card.scheduleResult.task.id,
      ).toBe("task-1");
    },
  );

  test.each([
    ["a list", { action: "list", display: "card", tasks: [] }],
    [
      "an error",
      {
        error: "Ask the user which timezone to use.",
        code: "timezone_required",
      },
    ],
    ["unparsable text", "Scheduled task task-1 created"],
  ])("%s yields no card", (_name, payload) => {
    const groups = getMessageGroups([
      human,
      call("c1", { action: "list" }),
      result("c1", payload),
      reply,
    ] as Message[]);
    expect(groups.map((group) => group.type)).not.toContain(
      "assistant:scheduled-task",
    );
  });

  test("two results for the same task in one turn keep only the last card", () => {
    const groups = getMessageGroups([
      human,
      call("c1", { action: "create" }),
      result("c1", {
        action: "create",
        display: "card",
        task: taskView("task-1", "First"),
      }),
      call("c2", { action: "update" }),
      result("c2", {
        action: "update",
        display: "card",
        task: taskView("task-1", "Renamed"),
      }),
      call("c3", { action: "create" }),
      result("c3", {
        action: "create",
        display: "card",
        task: taskView("task-2", "Other"),
      }),
      reply,
    ] as Message[]);
    const cards = groups.flatMap((group) =>
      group.type === "assistant:scheduled-task" ? [group.scheduleResult] : [],
    );
    expect(cards.map((card) => [card.task.id, card.task.title])).toEqual([
      ["task-1", "Renamed"],
      ["task-2", "Other"],
    ]);
  });

  test("cards in different turns are kept", () => {
    const groups = getMessageGroups([
      human,
      call("c1", { action: "create" }),
      result("c1", { action: "create", display: "card", task: taskView("t") }),
      reply,
      { id: "human-2", type: "human", content: "Run it now" },
      call("c2", { action: "trial" }),
      result("c2", { action: "trial", display: "card", task: taskView("t") }),
      { id: "reply-2", type: "ai", content: "Started." },
    ] as Message[]);
    expect(
      groups.filter((group) => group.type === "assistant:scheduled-task"),
    ).toHaveLength(2);
  });

  test("a sibling tool result after a card joins the processing group", () => {
    const groups = getMessageGroups([
      human,
      {
        id: "ai-both",
        type: "ai",
        content: "",
        tool_calls: [
          { id: "c1", name: "schedule_task", args: { action: "create" } },
          { id: "c2", name: "web_search", args: { query: "x" } },
        ],
      },
      result("c1", { action: "create", display: "card", task: taskView("t") }),
      {
        id: "tool-c2",
        type: "tool",
        name: "web_search",
        tool_call_id: "c2",
        content: "[]",
      },
      reply,
    ] as Message[]);
    expect(groups[1]?.messages.map((message) => message.id)).toEqual([
      "ai-both",
      "tool-c1",
      "tool-c2",
    ]);
    expect(groups[2]?.messages.map((message) => message.id)).toEqual([
      "tool-c1",
    ]);
  });

  test("a scheduled launch stays a human group with its origin and is not editable", () => {
    const fixture = loadScheduledThread("minute-run");
    const groups = getMessageGroups(fixture.messages);
    const humans = groups.filter((group) => group.type === "human");
    expect(humans).toHaveLength(1);
    const origin = humans[0]?.type === "human" && humans[0].scheduledOrigin;
    expect(origin).toMatchObject({
      task_title: "发布清单未完成项提醒",
      run_number: 2,
      trigger: "scheduled",
      stop_condition: "清单中所有条目都已完成（没有未勾选项）",
    });
    expect(getLatestEditableTurn(groups, false)).toBeNull();
    // The same thread with an ordinary user message is editable.
    expect(
      getLatestEditableTurn(
        getMessageGroups(withOrdinaryHumanTurn(fixture.messages)),
        false,
      )?.humanMessage.id,
    ).toBe(humans[0]?.id);
  });

  test("scheduledOriginOf ignores ordinary and malformed messages", () => {
    expect(scheduledOriginOf(human as Message)).toBeNull();
    expect(
      scheduledOriginOf({
        ...human,
        additional_kwargs: { [SCHEDULED_ORIGIN_KEY]: "task-1" },
      } as Message),
    ).toBeNull();
    expect(
      scheduledOriginOf({
        ...reply,
        additional_kwargs: { [SCHEDULED_ORIGIN_KEY]: { task_id: "t" } },
      } as Message),
    ).toBeNull();
    expect(
      scheduledOriginOf({
        ...human,
        additional_kwargs: {
          [SCHEDULED_ORIGIN_KEY]: { task_id: "t", standing_notes: ["a", 1] },
        },
      } as Message),
    ).toMatchObject({
      task_id: "t",
      trigger: "scheduled",
      run_number: null,
      stop_condition: null,
      standing_notes: ["a"],
    });
  });

  test("SCHEDULED_ORIGIN_KEY matches the backend contract", () => {
    expect(SCHEDULED_ORIGIN_KEY).toBe(
      SCHEDULED_GOAL_NOTES_CONTRACT.scheduled_origin_key,
    );
  });

  test("a run thread's turn usage and branching match an ordinary turn", () => {
    const fixture = loadScheduledThread("minute-run");
    const scheduled = getMessageGroups(fixture.messages);
    const ordinary = getMessageGroups(withOrdinaryHumanTurn(fixture.messages));
    expect(scheduled.map((group) => group.type)).toEqual(
      ordinary.map((group) => group.type),
    );
    const usageIds = (groups: typeof scheduled) =>
      getAssistantTurnUsageMessages(groups).map((messages) =>
        messages?.map((message) => message.id),
      );
    expect(usageIds(scheduled)).toEqual(usageIds(ordinary));
    expect([...getBranchableAssistantGroupIds(scheduled, false)]).toEqual([
      ...getBranchableAssistantGroupIds(ordinary, false),
    ]);
  });

  test("a card group does not split the turn's usage or hide its final answer", () => {
    // Live: create (after a read_file), trial, edit, pause and resume.
    const fixture = loadScheduledThread("weekday-chat");
    const groups = getMessageGroups(fixture.messages);
    const turn = [
      "human",
      "assistant:processing",
      "assistant:scheduled-task",
      "assistant",
    ];
    expect(groups.map((group) => group.type)).toEqual(
      Array.from({ length: 5 }, () => turn).flat(),
    );
    const usage = getAssistantTurnUsageMessages(groups);
    expect(usage[2]).toBeNull();
    // The create turn: the read_file call, the schedule_task call, the reply.
    expect(usage[3]?.map((message) => message.id)).toEqual([
      "lc_run--01a11061-400e-7982-8069-f72fa84b8751",
      "lc_run--01a11061-4b2d-7c70-9d7a-22394f32b6c9",
      "lc_run--01a11062-4f24-70a3-a118-57c8024d40bd",
    ]);
    // Every turn's final answer stays branchable, one per turn.
    const replies = fixture.messages
      .filter(
        (message) =>
          message.type === "ai" &&
          !(message as { tool_calls?: unknown[] }).tool_calls?.length,
      )
      .map((message) => message.id);
    expect(replies).toHaveLength(5);
    expect([...getBranchableAssistantGroupIds(groups, false)]).toEqual(replies);
    expect(getLatestEditableTurn(groups, false)?.humanMessage.id).toBe(
      "local-human-5735ca25-a414-4b81-b042-4bf61c8eeaa8",
    );
  });
});
