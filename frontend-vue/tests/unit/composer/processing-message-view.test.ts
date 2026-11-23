import { describe, expect, it } from "vitest";

import { deriveProcessingMessageView } from "@/core/messages/processing";
import type { Message } from "@/core/types/message";

const weatherMessages = [
  {
    id: "weather-plan",
    type: "ai",
    content: "",
    additional_kwargs: {
      reasoning_content: "I should find a current source before answering.",
    },
    tool_calls: [
      {
        id: "weather-search",
        name: "web_search",
        args: { query: "today's weather" },
      },
    ],
  },
  {
    id: "weather-search-result",
    type: "tool",
    name: "web_search",
    tool_call_id: "weather-search",
    content: JSON.stringify([
      { title: "Shanghai weather", url: "https://weather.example/shanghai" },
    ]),
  },
  {
    id: "weather-synthesis",
    type: "ai",
    content: "",
    additional_kwargs: {
      reasoning_content: "The result is current; now synthesize the answer.",
    },
  },
  {
    id: "weather-answer",
    type: "ai",
    content: "Shanghai is cloudy today, with a high near 29°C.",
  },
] as unknown as Message[];

describe("processing message view", () => {
  it("correlates tool results once and preserves React step ordering", () => {
    const view = deriveProcessingMessageView(weatherMessages);

    expect(view.steps.map((step) => step.type)).toEqual([
      "reasoning",
      "toolCall",
      "reasoning",
      "assistantText",
    ]);
    expect(view.collapsibleSteps.map((step) => step.id)).toEqual([
      "weather-plan",
    ]);
    expect(view.lastToolCall).toMatchObject({
      id: "weather-search",
      name: "web_search",
      result: [
        {
          title: "Shanghai weather",
          url: "https://weather.example/shanghai",
        },
      ],
    });
    expect(view.trailingReasoning?.id).toBe("weather-synthesis");
    expect(view.answerAfterReasoning.map((step) => step.id)).toEqual([
      "weather-answer-content",
    ]);
  });

  it("keeps assistant text before trailing reasoning in its original position", () => {
    const view = deriveProcessingMessageView([
      {
        id: "before",
        type: "ai",
        content: "Let me inspect the source first.",
      },
      {
        id: "reasoning",
        type: "ai",
        content: "Final answer",
        additional_kwargs: { reasoning_content: "Synthesize evidence." },
      },
    ] as unknown as Message[]);

    expect(view.visibleBeforeTrailingReasoning.map((step) => step.id)).toEqual([
      "before-content",
    ]);
    expect(view.answerAfterReasoning.map((step) => step.id)).toEqual([
      "reasoning-content",
    ]);
  });
});

it("associates registry entries by tool call without leaking other calls", () => {
  const artifact = {
    handle: "art_one",
    tool_name: "make_report",
    tool_call_id: "make-1",
    call_index: 0,
    artifact_type: "file",
    display_name: "report.csv",
    real_ref: "/outputs/report.csv",
  };
  const view = deriveProcessingMessageView(
    [
      {
        id: "ai",
        type: "ai",
        content: "",
        tool_calls: [{ id: "make-1", name: "make_report", args: {} }],
      },
    ],
    [artifact, { ...artifact, handle: "unrelated", tool_call_id: "other" }],
  );
  expect(view.lastToolCall?.artifacts).toEqual([artifact]);
});
it("normalizes omitted or null mid-stream tool arguments before rendering", () => {
  for (const args of [null, undefined]) {
    const view = deriveProcessingMessageView([
      {
        id: "ai",
        type: "ai",
        content: "",
        tool_calls: [{ id: "call", name: "make_report", args }],
      },
    ] as unknown as Message[]);
    expect(view.lastToolCall?.args).toEqual({});
  }
});
