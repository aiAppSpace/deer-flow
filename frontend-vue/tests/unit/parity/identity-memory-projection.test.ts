import { describe, expect, it } from "vitest";
import {
  buildIdentityRegistry,
  type RequestIdentityDecision,
} from "../../e2e-parity/support/identity-registry";
import { projectIdentityNetwork } from "../../e2e-parity/support/identity-projection";
import { projectNetwork } from "../../e2e-parity/support/capture-network";
import { memoryFixture } from "./identity-memory-fixtures";
import { humanFixture } from "./identity-human-fixtures";

const node = (value: unknown, path: readonly (string | number)[]): unknown => {
  if (!path.length) return value;
  const [key, ...rest] = path;
  if (!Array.isArray(value)) return undefined;
  if (value[0] === "object" && typeof key === "string")
    return node(
      (value[1] as [string, unknown][]).find(([name]) => name === key)?.[1],
      rest,
    );
  if (value[0] === "array" && typeof key === "number")
    return node((value[1] as unknown[])[key], rest);
};
const project = (input: ReturnType<typeof memoryFixture>) =>
  projectIdentityNetwork(
    input.network,
    input.appBase,
    buildIdentityRegistry(input),
  );
describe("Memory fact projections remain exact and cumulative", () => {
  it("replaces both generated leaves while preserving literal and repeated raw content", () => {
    const input = memoryFixture("import", [
      "generated",
      "generated",
      "literal",
    ]);
    const before = JSON.stringify(input);
    const registry = buildIdentityRegistry(input);
    expect(registry.errors).toEqual([]);
    const output = projectIdentityNetwork(
      input.network,
      input.appBase,
      registry,
    );
    expect(output.observationErrors).toEqual([]);
    const fact = JSON.parse(output.requestFacts[1]!);
    for (const index of [0, 1])
      expect(node(fact.body[1], ["facts", index, "id"])).toEqual(
        registry.memory!.facts[index]!.identity,
      );
    expect(node(fact.body[1], ["facts", 2, "id"])).toEqual([
      "string",
      input.raws[2],
    ]);
    expect(node(fact.body[1], ["facts", 0, "content"])).toEqual([
      "string",
      input.raws[0],
    ]);
    expect(node(fact.body[1], ["facts", 0, "unknown", "id"])).toEqual([
      "string",
      input.raws[0],
    ]);
    expect(output.requestBodies[0]).toEqual({
      key: output.requests[1],
      body: JSON.stringify(fact.body),
    });
    expect(JSON.stringify(input)).toBe(before);
  });
  it.each([{ kinds: [] }, { kinds: ["literal", "literal"] }] as const)(
    "keeps zero-generated $kinds bodies fully literal without empty decisions",
    ({ kinds }) => {
      const input = memoryFixture("import", kinds),
        result = project(input),
        literal = projectNetwork(input.network, input.appBase);
      expect(result.observationErrors).toEqual([]);
      expect(result.requestBodies).toEqual(literal.requestBodies);
      expect(result.requestFacts[1]).toEqual(literal.requestFacts[1]);
    },
  );
  it("keeps both retry occurrences and their failed/successful response pairing", () => {
    const input = memoryFixture("retry", ["generated", "generated"]),
      result = project(input);
    expect(result.observationErrors).toEqual([]);
    expect(result.requestBodies).toHaveLength(2);
    expect(result.requestBodies[0]).toEqual(result.requestBodies[1]);
    expect(
      result.requestFacts
        .slice(1)
        .map((text) => JSON.parse(text).response.status),
    ).toEqual([503, 200]);
  });
  it.each([
    "missing-leaf",
    "duplicate",
    "wrong-index",
    "wrong-role",
    "wrong-kind",
    "literal-slot",
    "body-content",
    "membership",
    "extra-membership",
  ])("rolls back every request for %s", (change) => {
    const input = memoryFixture("import", [
        "generated",
        "generated",
        "literal",
      ]),
      registry = buildIdentityRegistry(input);
    expect(registry.errors).toEqual([]);
    const map = registry.requestDecisions as Map<
      number,
      RequestIdentityDecision[]
    >;
    const decisions = structuredClone(map.get(1)!);
    if (change === "missing-leaf") decisions.pop();
    if (change === "duplicate") decisions.push(structuredClone(decisions[0]!));
    if (change === "wrong-index")
      Object.assign(decisions[0]!.slot, { path: ["facts", 9, "id"] });
    if (change === "wrong-role")
      Object.assign(decisions[0]!.slot, { role: "input-message" });
    if (change === "wrong-kind")
      decisions[0]!.identity = registry.entities[0]!.identity;
    if (change === "literal-slot") {
      Object.assign(decisions[0]!.slot, { path: ["facts", 2, "id"] });
      decisions[0]!.raw = input.raws[2]!;
    }
    if (change === "body-content")
      Object.assign(decisions[0]!.slot, { path: ["facts", 0, "content"] });
    if (change === "membership")
      Object.assign(registry.memory!, { requests: [] });
    if (change === "extra-membership")
      Object.assign(registry.memory!, { requests: [1, 999] });
    map.set(1, decisions);
    const result = projectIdentityNetwork(
        input.network,
        input.appBase,
        registry,
      ),
      literal = projectNetwork(input.network, input.appBase);
    expect(result.observationErrors.length).toBeGreaterThan(0);
    expect(result.requests).toEqual(literal.requests);
    expect(result.requestBodies).toEqual(literal.requestBodies);
    expect(result.requestFacts).toEqual(literal.requestFacts);
  });
  it("supports Memory and ordinary human decisions in the same complete capture", () => {
    const input = humanFixture(),
      memory = memoryFixture();
    input.expectations.memory = memory.expectations.memory;
    for (const row of memory.identity.receipts.filter((row) =>
      row.packet?.event.startsWith("memory."),
    )) {
      const event = structuredClone(row);
      event.sequence = input.identity.receipts.length;
      event.dispatchedAt += 2000;
      event.packet!.at += 2000;
      input.identity.receipts.push(event);
    }
    const request = { ...memory.requests[0]!, sequence: 2, startedAt: 4100 };
    input.network.requests.push(request);
    const registry = buildIdentityRegistry(input);
    expect(registry.errors).toEqual([]);
    expect(registry.humans).toHaveLength(1);
    expect(registry.memory!.facts).toHaveLength(2);
    const result = projectIdentityNetwork(
      input.network,
      input.appBase,
      registry,
    );
    expect(result.observationErrors).toEqual([]);
    expect(
      node(JSON.parse(result.requestFacts[1]!).body[1], [
        "input",
        "messages",
        0,
        "id",
      ]),
    ).toEqual(registry.humans[0]!.identity);
    expect(
      node(JSON.parse(result.requestFacts[2]!).body[1], ["facts", 0, "id"]),
    ).toEqual(registry.memory!.facts[0]!.identity);
    input.identity.receipts.find(
      (row) => row.packet?.event === "memory.fact",
    )!.packet!.values.raw = input.human;
    memory.body.facts[0]!.id = input.human;
    request.bodyBase64 = Buffer.from(JSON.stringify(memory.body)).toString(
      "base64",
    );
    expect(buildIdentityRegistry(input).errors).toContain(
      "identity raw claimed by incompatible sources or kinds",
    );
  });
});
