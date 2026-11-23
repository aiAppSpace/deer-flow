import { describe, expect, it } from "vitest";
import type { Message } from "@/core/types/message";
import { getAssistantTurnUsageMessages } from "@/core/messages/derived-state";
import { getMessageGroups } from "@/core/messages/utils";

function message(type: "human" | "ai", id: string, content: string): Message {
  return { type, id, content };
}

describe("the message projections consumed by the Vue timeline", () => {
  it("preserves a thousand turns while the final live group changes", () => {
    const messages = Array.from({ length: 1000 }, (_, index) => [
      message("human", `h-${index}`, `question ${index}`),
      message("ai", `a-${index}`, `answer ${index}`),
    ]).flat();
    const before = getMessageGroups(messages);
    const next = getMessageGroups(
      [...messages.slice(0, -1), message("ai", "a-999", "updated live text")],
      { isCurrentTurnLoading: true },
    );
    expect(next).toHaveLength(2000);
    expect(next.slice(0, -1)).toEqual(before.slice(0, -1));
    expect(next.at(-1)).toMatchObject({
      id: "a-999",
      type: "assistant:processing",
      messages: [{ content: "updated live text" }],
    });
    expect(before.at(-1)?.messages[0]?.content).toBe("answer 999");
  });

  it("updates same-ID historical content without retaining an obsolete group", () => {
    const human = message("human", "h", "question");
    const first = getMessageGroups([human, message("ai", "a", "original")]);
    const refreshed = getMessageGroups([
      human,
      message("ai", "a", "corrected"),
    ]);
    expect(first[1]?.messages[0]?.content).toBe("original");
    expect(refreshed[1]?.messages[0]?.content).toBe("corrected");
  });

  it("prepends older history without treating its answer as the current live group", () => {
    const groups = getMessageGroups(
      [
        message("human", "old-h", "older question"),
        message("ai", "old-a", "older answer"),
        message("human", "new-h", "current question"),
        message("ai", "new-a", "current answer"),
      ],
      { isCurrentTurnLoading: true },
    );
    expect(groups.map((group) => [group.id, group.type])).toEqual([
      ["old-h", "human"],
      ["old-a", "assistant"],
      ["new-h", "human"],
      ["new-a", "assistant:processing"],
    ]);
    expect(
      getAssistantTurnUsageMessages(groups).map(
        (rows) => rows?.map((row) => row.id) ?? null,
      ),
    ).toEqual([null, ["old-a"], null, ["new-a"]]);
  });

  it("keeps hidden controls out of grouping while tool calls, results and answer snapshots advance", () => {
    const human = message("human", "h", "question");
    const call: Message = {
      type: "ai",
      id: "call-ai",
      content: "",
      tool_calls: [{ id: "call", name: "bash", args: {} }],
    };
    const result: Message = {
      type: "tool",
      id: "result",
      tool_call_id: "call",
      content: "done",
    };
    const hidden: Message = {
      type: "ai",
      id: "summary",
      name: "summary",
      content: "hidden",
    };
    const answer = message("ai", "answer", "Answer");
    const active = getMessageGroups([human, call, result, hidden, answer], {
      isCurrentTurnLoading: true,
    });
    expect(active.map((group) => group.messages.map((row) => row.id))).toEqual([
      ["h"],
      ["call-ai", "result", "answer"],
    ]);
    const settled = getMessageGroups([human, call, result, hidden, answer]);
    expect(settled.map((group) => group.messages.map((row) => row.id))).toEqual(
      [["h"], ["call-ai", "result"], ["answer"]],
    );
    expect(
      getAssistantTurnUsageMessages(settled).map(
        (rows) => rows?.map((row) => row.id) ?? null,
      ),
    ).toEqual([null, null, ["call-ai", "answer"]]);
  });

  it("recomputes turn usage from current messages after a tail update", () => {
    const old = [
      message("human", "h1", "one"),
      message("ai", "a1", "first"),
      message("human", "h2", "two"),
      message("ai", "a2", "second"),
    ];
    const before = getAssistantTurnUsageMessages(getMessageGroups(old));
    const after = getAssistantTurnUsageMessages(
      getMessageGroups([...old.slice(0, -1), message("ai", "a2", "updated")]),
    );
    expect(after[1]).toEqual(before[1]);
    expect(after[3]?.[0]?.content).toBe("updated");
    expect(before[3]?.[0]?.content).toBe("second");
  });
});
