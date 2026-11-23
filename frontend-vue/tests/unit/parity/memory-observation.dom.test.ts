import { beforeEach, afterEach, it, expect, vi as mock } from "vitest";
import {
  createMemoryImportObservation,
  PARITY_OBSERVATION_CAPABILITY as CAPABILITY,
  PARITY_OBSERVATION_EVENT as EVENT,
  type ObservationPacket,
} from "@/core/diagnostics/parity-observation";
import { normalizeMemoryPayload } from "@/core/memory/schema";
const payload = {
  version: "1.0",
  lastUpdated: "",
  user: {},
  history: {},
  facts: [],
};
let packets: ObservationPacket[];
let capability: { version: number; token: string; action: string };
const receive = (event: Event) =>
  packets.push((event as CustomEvent<ObservationPacket>).detail);
beforeEach(() => {
  packets = [];
  capability = { version: 1, token: "memory-capture", action: "file-0" };
  Object.defineProperty(window, CAPABILITY, {
    configurable: true,
    value: capability,
  });
  window.addEventListener(EVENT, receive);
});
afterEach(() => {
  window.removeEventListener(EVENT, receive);
  Reflect.deleteProperty(window, CAPABILITY);
  mock.restoreAllMocks();
});
it("normalizer records actual retained/generated IDs with original input indexes", () => {
  const seen: { index: number; raw: string; generated: boolean }[] = [];
  const result = normalizeMemoryPayload(
    {
      ...payload,
      facts: [null, { id: " kept ", content: "same" }, { content: "same" }],
    },
    {
      invalidFactStrategy: "drop",
      onFactIdentity: (identity) => seen.push(identity),
    },
  )!;
  expect(seen).toEqual([
    { index: 1, raw: "kept", generated: false },
    { index: 2, raw: result.facts[1]!.id, generated: true },
  ]);
  expect(result.facts).toHaveLength(2);
  expect(Object.isFrozen(seen[0])).toBe(true);
});
it("a throwing callback cannot change normalized product output", () => {
  const input = {
    ...payload,
    facts: [{ id: "kept", content: " text ", extra: { unknown: true } }],
  };
  expect(
    normalizeMemoryPayload(input, {
      onFactIdentity: () => {
        throw new Error("observer failed");
      },
    }),
  ).toEqual(normalizeMemoryPayload(input));
});
it("disabled observation and background normalization publish nothing", () => {
  Reflect.deleteProperty(window, CAPABILITY);
  expect(createMemoryImportObservation()).toBeNull();
  Object.defineProperty(window, CAPABILITY, {
    configurable: true,
    value: capability,
  });
  expect(
    normalizeMemoryPayload({ ...payload, facts: [{ content: "background" }] }),
  ).not.toBeNull();
  expect(packets).toEqual([]);
});
it("only actual selection admits local normalization; choice origin survives async completion", () => {
  const owner = createMemoryImportObservation()!;
  const choice = owner.begin()!;
  const result = normalizeMemoryPayload(
    {
      ...payload,
      facts: [
        { content: "private content" },
        { id: "literal", content: "private content" },
      ],
    },
    { onFactIdentity: choice.fact },
  )!;
  const pending = { memory: result };
  choice.retain(pending);
  expect(packets).toEqual([]);
  capability.action = "later-completion";
  owner.select(pending);
  const facts = packets.filter((p) => p.event === "memory.fact");
  expect(facts.map((p) => p.values)).toEqual([
    { index: 0, raw: result.facts[0]!.id, generated: true },
    { index: 1, raw: "literal", generated: false },
  ]);
  expect(facts.map((p) => p.action)).toEqual(["file-0", "file-0"]);
  expect(packets.filter((p) => p.event === "memory.select")).toHaveLength(1);
  expect(JSON.stringify(packets)).not.toContain("private content");
  owner.select(pending);
  expect(packets.filter((p) => p.event === "memory.fact")).toHaveLength(2);
  owner.select(null);
  owner.select(pending);
  expect(packets.filter((p) => p.event === "memory.fact")).toHaveLength(2);
  expect(packets.filter((p) => p.event === "memory.retire")).toHaveLength(1);
  expect(packets.filter((p) => p.event === "memory.select")).toHaveLength(2);
});
it("partial normalization of a rejected payload is not admitted", () => {
  const owner = createMemoryImportObservation()!;
  const choice = owner.begin()!;
  expect(
    normalizeMemoryPayload(
      { ...payload, facts: [{ content: "unused" }, null] },
      { onFactIdentity: choice.fact },
    ),
  ).toBeNull();
  expect(packets).toEqual([]);
  owner.select(null);
  expect(packets).toEqual([]);
});
it("distinct selected files never merge equal fact IDs or content", () => {
  const owner = createMemoryImportObservation()!;
  const first = owner.begin()!;
  first.fact({ index: 0, raw: "fact_collision", generated: true });
  const a = {};
  first.retain(a);
  owner.select(a);
  capability.action = "file-1";
  const second = owner.begin()!;
  second.fact({ index: 0, raw: "fact_collision", generated: true });
  const b = {};
  second.retain(b);
  owner.select(b);
  const facts = packets.filter((p) => p.event === "memory.fact");
  expect(facts.map((p) => p.action)).toEqual(["file-0", "file-1"]);
  expect(new Set(facts.map((p) => p.instance)).size).toBe(2);
  expect(packets.filter((p) => p.event === "memory.retire")).toHaveLength(1);
});
it("bounded pending evidence reports overflow only when actually selected", () => {
  const owner = createMemoryImportObservation()!;
  const choice = owner.begin()!;
  for (let index = 0; index < 4097; index++)
    choice.fact({ index, raw: `fact-${index}`, generated: true });
  const pending = {};
  choice.retain(pending);
  expect(packets).toEqual([]);
  owner.select(pending);
  expect(packets.filter((p) => p.event === "invalid")).toHaveLength(1);
  expect(packets.filter((p) => p.event === "memory.fact")).toHaveLength(4096);
  expect(
    packets.find((p) => p.event === "memory.select")?.values.factCount,
  ).toBe(4097);
});
it("a selected object without its exact local receipt is invalid, never guessed", () => {
  const owner = createMemoryImportObservation()!;
  owner.select({});
  expect(packets.filter((p) => p.event === "invalid")).toHaveLength(1);
  expect(packets.filter((p) => p.event === "memory.fact")).toEqual([]);
});
it("capture replacement cannot adopt an earlier file read", () => {
  const owner = createMemoryImportObservation()!;
  const choice = owner.begin()!;
  choice.fact({ index: 0, raw: "old-fact", generated: true });
  const pending = {};
  choice.retain(pending);
  capability.token = "next-capture";
  owner.select(pending);
  expect(packets).toEqual([]);
});

it("keeps the exact identity code-unit limit and explicitly invalidates the next unit", () => {
  const owner = createMemoryImportObservation()!;
  const choice = owner.begin()!;
  const raw = "x".repeat(1_048_576);
  choice.fact({ index: 0, raw, generated: false });
  choice.fact({ index: 1, raw: "y", generated: false });
  const pending = {};
  choice.retain(pending);
  owner.select(pending);
  expect(
    packets.filter((p) => p.event === "memory.fact").map((p) => p.values),
  ).toEqual([{ index: 0, raw, generated: false }]);
  expect(packets.filter((p) => p.event === "invalid")).toHaveLength(1);
  expect(
    packets.find((p) => p.event === "memory.select")?.values.factCount,
  ).toBe(2);
});

function retainedImport(
  owner: NonNullable<ReturnType<typeof createMemoryImportObservation>>,
) {
  const choice = owner.begin()!;
  const memory = normalizeMemoryPayload(
    { ...payload, facts: [{ id: "literal", content: "not observed" }] },
    { onFactIdentity: choice.fact },
  )!;
  const pending = { memory };
  choice.retain(pending, memory);
  return { choice, memory, pending };
}
it("dispatch follows the exact selected memory object and never re-reads its facts", () => {
  const owner = createMemoryImportObservation()!;
  const { memory, pending } = retainedImport(owner);
  owner.select(pending);
  Object.defineProperty(memory, "facts", {
    get() {
      throw new Error("second read");
    },
  });
  capability.action = "confirm";
  owner.dispatch(memory, false);
  owner.dispatch(memory, true);
  const choice = packets.find((p) => p.event === "memory.choice")!;
  const calls = packets.filter((p) => p.event === "memory.dispatch");
  expect(calls.map((p) => p.values)).toEqual([
    { state: "selected", preAborted: false },
    { state: "selected", preAborted: true },
  ]);
  expect(calls.map((p) => p.instance)).toEqual([
    choice.instance,
    choice.instance,
  ]);
  expect(calls.map((p) => p.action)).toEqual(["confirm", "confirm"]);
  expect(choice.action).toBe("file-0");
  expect(packets.filter((p) => p.event === "memory.fact")).toHaveLength(1);
});
it("unselected and retired consumers remain visible without publishing unused facts", () => {
  const owner = createMemoryImportObservation()!;
  const { memory, pending } = retainedImport(owner);
  owner.dispatch(memory, false);
  expect(packets.map((p) => p.event)).toEqual(["memory.dispatch"]);
  owner.select(pending);
  owner.dispatch(memory, false);
  owner.select(null);
  owner.dispatch(memory, false);
  owner.select(pending);
  owner.dispatch(memory, false);
  expect(
    packets
      .filter((p) => p.event === "memory.dispatch")
      .map((p) => p.values.state),
  ).toEqual(["unselected", "selected", "retired", "selected"]);
  expect(packets.filter((p) => p.event === "memory.fact")).toHaveLength(1);
});
it("clones and other owners never acquire an import receipt by content equality", () => {
  const owner = createMemoryImportObservation()!;
  const { memory, pending } = retainedImport(owner);
  owner.select(pending);
  owner.dispatch(structuredClone(memory), false);
  createMemoryImportObservation()!.dispatch(memory, false);
  const calls = packets.filter((p) => p.event === "memory.dispatch");
  expect(calls.map((p) => p.values.state)).toEqual(["unowned", "unowned"]);
  expect(calls.every((p) => p.producer === "memory:settings")).toBe(true);
});
it.each(["pending", "memory"] as const)(
  "a duplicate %s key is invalid and cannot rebind either key",
  (key) => {
    const owner = createMemoryImportObservation()!;
    const first = retainedImport(owner);
    owner.select(first.pending);
    const firstInstance = packets.find(
      (p) => p.event === "memory.choice",
    )!.instance;
    const second = owner.begin()!;
    second.fact({ index: 0, raw: "second", generated: false });
    const pending = key === "pending" ? first.pending : {};
    const memory = key === "memory" ? first.memory : {};
    second.retain(pending, memory);
    expect(packets.filter((p) => p.event === "invalid")).toHaveLength(1);
    owner.dispatch(first.memory, false);
    expect(
      packets.filter((p) => p.event === "memory.dispatch").at(-1)?.instance,
    ).toBe(firstInstance);
    if (key === "pending") {
      owner.dispatch(memory, false);
      expect(packets.at(-1)?.values.state).toBe("unowned");
    } else {
      owner.select(pending);
      expect(packets.at(-1)?.event).toBe("invalid");
    }
  },
);
it("retaining the same receipt twice is idempotent and capture replacement retires dispatch observation", () => {
  const owner = createMemoryImportObservation()!;
  const { choice, pending, memory } = retainedImport(owner);
  choice.retain(pending, memory);
  owner.select(pending);
  owner.dispatch(memory, false);
  const count = packets.length;
  capability.token = "replacement";
  owner.dispatch(memory, false);
  expect(packets).toHaveLength(count);
  expect(packets.filter((p) => p.event === "invalid")).toEqual([]);
});
