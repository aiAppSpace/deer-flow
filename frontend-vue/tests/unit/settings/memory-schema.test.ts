import { describe, expect, it } from "vitest";
import { normalizeMemoryPayload } from "@/core/memory/schema";
const envelope = () => ({
  version: "2.0",
  revision: 7,
  lastUpdated: "",
  user: {},
  history: {},
  facts: [],
});
describe("memory import contract", () => {
  it.each([null, [], "memory", 42, true])("rejects non-object roots", (value) =>
    expect(normalizeMemoryPayload(value)).toBeNull(),
  );
  it.each(["version", "lastUpdated", "user", "history", "facts"])(
    "requires the %s envelope field",
    (field) => {
      const value = Object.fromEntries(
        Object.entries(envelope()).filter(([key]) => key !== field),
      );
      expect(normalizeMemoryPayload(value)).toBeNull();
    },
  );
  it.each([
    [-1, 0],
    [2, 1],
    ["0.4", 0.4],
    ["invalid", 0.5],
    [Infinity, 0.5],
  ])("normalizes legacy confidence %s", (confidence, expected) => {
    expect(
      normalizeMemoryPayload({
        ...envelope(),
        facts: [{ content: "Keep", confidence }],
      })!.facts[0]!.confidence,
    ).toBe(expected);
  });
  it("preserves duplicate IDs and content for Gateway validation", () => {
    const facts = [
      { id: "same", content: "Same", sourceError: "Learned", extra: 3 },
      { id: "same", content: "Same" },
    ];
    const memory = normalizeMemoryPayload({ ...envelope(), facts })!;
    expect(memory.facts).toHaveLength(2);
    expect(memory.facts[0]).toMatchObject({
      id: "same",
      content: "Same",
      sourceError: "Learned",
      extra: 3,
    });
  });
});
