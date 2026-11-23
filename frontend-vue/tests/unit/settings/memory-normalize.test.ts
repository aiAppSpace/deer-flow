import { describe, expect, it } from "vitest";
import { normalizeMemoryPayload } from "@/core/memory/schema";
import {
  buildMemorySectionGroups,
  isMemorySummaryEmpty,
} from "@/core/memory/document";
import { enUS } from "@/core/i18n/locales/en-US";

const envelope = () => ({
  version: "1.0",
  lastUpdated: "",
  revision: 7,
  user: {},
  history: {},
  facts: [],
});
describe("current Gateway/React memory normalization", () => {
  it("defaults legacy sections including thinking style and preserves forward fields", () => {
    const value = {
      ...envelope(),
      future: { enabled: true },
      user: {
        cognitiveStyle: {
          summary: "Explain the cause",
          updatedAt: "",
          future: "kept",
        },
      },
    };
    const memory = normalizeMemoryPayload(value)!;
    expect(memory.revision).toBe(7);
    expect(memory.future).toEqual({ enabled: true });
    expect(memory.user.workContext).toEqual({ summary: "", updatedAt: "" });
    expect(memory.user.cognitiveStyle).toEqual({
      summary: "Explain the cause",
      updatedAt: "",
      future: "kept",
    });
    const labels = {
      ...enUS.settings.memory.markdown,
      lastUpdated: enUS.common.lastUpdated,
    };
    expect(
      buildMemorySectionGroups(memory, labels)[0]!.sections,
    ).toContainEqual({
      title: labels.cognitiveStyle,
      summary: "Explain the cause",
      updatedAt: "",
    });
    expect(isMemorySummaryEmpty(memory)).toBe(false);
  });
  it("normalizes recoverable legacy facts without discarding metadata", () => {
    const memory = normalizeMemoryPayload({
      ...envelope(),
      facts: [
        {
          content: "  Remember  ",
          confidence: "0",
          sourceError: 3,
          metadata: { preserved: true },
        },
      ],
    })!;
    expect(memory.facts[0]).toMatchObject({
      content: "Remember",
      category: "context",
      confidence: 0,
      createdAt: "",
      source: "unknown",
      metadata: { preserved: true },
    });
    expect(memory.facts[0]!.id).toMatch(/^fact_/);
    expect(memory.facts[0]).not.toHaveProperty("sourceError");
  });
  it.each([
    null,
    [],
    { ...envelope(), facts: [null] },
    { ...envelope(), facts: [{ content: "   " }] },
  ])("rejects an invalid user import envelope/fact", (value) =>
    expect(normalizeMemoryPayload(value)).toBeNull(),
  );
  it("drops only unrecoverable facts on background reads", () => {
    const memory = normalizeMemoryPayload(
      { ...envelope(), facts: [null, { content: "kept" }] },
      { invalidFactStrategy: "drop" },
    )!;
    expect(memory.facts).toHaveLength(1);
    expect(memory.facts[0]!.content).toBe("kept");
  });
});
