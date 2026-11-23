import { describe, expect, it } from "vitest";
import { buildIdentityRegistry } from "../../e2e-parity/support/identity-registry";
import { memoryFixture } from "./identity-memory-fixtures";

const reject = (input: ReturnType<typeof memoryFixture>) => {
  const result = buildIdentityRegistry(input);
  expect(result.errors.length).toBeGreaterThan(0);
  expect(result.requestDecisions.size).toBe(0);
};
describe("one declared Memory source with complete dispatch/request candidate domain", () => {
  it.each(["import", "preview", "cancel", "rejected", "retry"] as const)(
    "admits the independent %s outcome",
    (mode) => {
      const input = memoryFixture(mode),
        result = buildIdentityRegistry(input);
      expect(result.errors).toEqual([]);
      expect(result.memory?.requests).toEqual(
        input.requests.map((row) => row.sequence),
      );
      expect(result.memory?.facts.length).toBe(mode === "rejected" ? 0 : 2);
      for (const row of input.requests)
        expect(result.requestDecisions.get(row.sequence)).toHaveLength(1);
      if (mode === "retry")
        expect(input.requests.map((row) => row.response?.status)).toEqual([
          503, 200,
        ]);
    },
  );
  it.each([
    { kinds: [] },
    { kinds: ["literal", "literal"] },
    { kinds: ["generated", "generated"] },
  ] as const)("retains the full $kinds fact vector", ({ kinds }) => {
    const input = memoryFixture("import", kinds),
      result = buildIdentityRegistry(input);
    expect(result.errors).toEqual([]);
    expect(result.memory?.facts).toHaveLength(kinds.length);
    expect(result.memory?.requests).toEqual([1]);
    const generated = kinds.filter((kind) => kind === "generated").length;
    if (generated)
      expect(result.requestDecisions.get(1)).toHaveLength(generated);
    else expect(result.requestDecisions.has(1)).toBe(false);
  });
  it("does not require select to carry the cached file origin action", () => {
    const input = memoryFixture();
    expect(
      input.identity.receipts.find(
        (row) => row.packet?.event === "memory.select",
      )!.packet!.action,
    ).toBe("preview");
    expect(buildIdentityRegistry(input).errors).toEqual([]);
  });
  it("preserves same-source retire/reselect without redefining facts", () => {
    const input = memoryFixture();
    input.emit("memory.select", { factCount: 2 }, "reselect", 2500);
    input.expectations.memory!.terminal = "active";
    expect(buildIdentityRegistry(input).errors).toEqual([]);
  });
  it("does not turn input storage order into source/request pairing", () => {
    const input = memoryFixture("retry");
    input.identity.receipts.reverse();
    input.network.requests.reverse();
    expect(buildIdentityRegistry(input).errors).toEqual([]);
  });
  it.each(["memory.choice", "memory.fact", "memory.select", "memory.dispatch"])(
    "rejects missing %s evidence",
    (event) => {
      const input = memoryFixture();
      input.identity.receipts.splice(
        input.identity.receipts.findIndex((row) => row.packet?.event === event),
        1,
      );
      reject(input);
    },
  );
  it.each(["choice", "fact", "select", "retire"])(
    "rejects duplicate %s evidence",
    (event) => {
      const input = memoryFixture();
      const packet = input.identity.receipts.find(
        (row) => row.packet?.event === `memory.${event}`,
      )!.packet!;
      input.emit(
        `memory.${event}`,
        { ...packet.values },
        packet.action!,
        packet.at,
      );
      reject(input);
    },
  );
  it.each([
    "index",
    "generated",
    "literal",
    "count",
    "action",
    "origin",
    "producer",
    "source",
  ])("rejects wrong fact/source %s", (change) => {
    const input = memoryFixture();
    const fact = input.identity.receipts.find(
      (row) => row.packet?.event === "memory.fact",
    )!.packet!;
    if (change === "index") fact.values.index = 1;
    if (change === "generated") fact.values.generated = false;
    if (change === "literal")
      input.identity.receipts.filter(
        (row) => row.packet?.event === "memory.fact",
      )[1]!.packet!.values.raw = "wrong-literal";
    if (change === "count")
      input.identity.receipts.find(
        (row) => row.packet?.event === "memory.choice",
      )!.packet!.values.factCount = 3;
    if (change === "action") fact.action = "other-file";
    if (change === "origin") fact.at = 1801;
    if (change === "producer") fact.producer = "memory:settings";
    if (change === "source") fact.instance = 6;
    reject(input);
  });
  it.each([
    "retired",
    "unselected",
    "unowned",
    "unknown",
    "pre-aborted",
    "late",
    "action",
    "extra",
  ])("retains the %s dispatch as unresolved evidence", (change) => {
    const input = memoryFixture();
    const row = input.identity.receipts.find(
      (row) => row.packet?.event === "memory.dispatch",
    )!;
    if (["retired", "unselected", "unowned", "unknown"].includes(change))
      row.packet!.values.state = change;
    if (change === "pre-aborted") row.packet!.values.preAborted = true;
    if (change === "late") row.sequence = 1000;
    if (change === "action") row.packet!.action = "other-confirm";
    if (change === "extra")
      input.emit(
        "memory.dispatch",
        { state: "unowned", preAborted: false },
        "confirm",
        2100,
        8,
        "memory:settings",
      );
    reject(input);
  });
  it.each([
    "missing",
    "extra",
    "bad-extra",
    "child",
    "worker",
    "unknown",
    "navigation",
    "early",
    "no-time",
    "zero-time",
  ])("rejects %s Request evidence without filtering candidates", (change) => {
    const input = memoryFixture();
    const row = input.requests[0]!;
    if (change === "missing") input.network.requests.pop();
    if (change === "extra") input.addRequest(2150);
    if (change === "bad-extra") input.addRequest(2150).bodyBase64 = null;
    if (change === "child") row.source = "child-frame";
    if (change === "worker") row.source = "service-worker";
    if (change === "unknown") row.source = "unknown";
    if (change === "navigation") row.navigation = true;
    if (change === "early") row.startedAt = 1700;
    if (change === "no-time") row.startedAt = null;
    if (change === "zero-time") row.startedAt = 0;
    reject(input);
  });
  it("rejects a timing prefix contradiction even with equal final counts", () => {
    const input = memoryFixture("retry");
    input.requests[1]!.startedAt = 2150;
    reject(input);
  });
  it.each([
    "generated",
    "literal",
    "length",
    "type",
    "swap",
    "missing-body",
    "duplicate-key",
  ])("rejects the wrong %s wire slot", (change) => {
    const input = memoryFixture();
    if (change === "generated") input.body.facts[0]!.id = "other";
    if (change === "literal") input.body.facts[1]!.id = "other";
    if (change === "length") input.body.facts.pop();
    if (change === "type") Object.assign(input.body.facts[0]!, { id: 1 });
    if (change === "swap") input.body.facts.reverse();
    input.updateBodies();
    if (change === "missing-body") input.requests[0]!.bodyBase64 = null;
    if (change === "duplicate-key")
      input.requests[0]!.bodyBase64 = Buffer.from(
        '{"facts":[],"facts":[]}',
      ).toString("base64");
    reject(input);
  });
  it("does not admit a request from a selected preview without a dispatch", () => {
    const input = memoryFixture("preview");
    input.addRequest(2200);
    reject(input);
  });
  it.each(["generated", "literal", "thread"])(
    "rejects incompatible %s raw claims",
    (collision) => {
      const input = memoryFixture("import", [
        "generated",
        collision === "generated" ? "generated" : "literal",
      ]);
      const target = collision === "thread" ? input.raw : input.raws[1]!;
      input.identity.receipts.find(
        (row) => row.packet?.event === "memory.fact",
      )!.packet!.values.raw = target;
      input.body.facts[0]!.id = target;
      input.updateBodies();
      reject(input);
    },
  );
  it("retains repeated literal references without deduplicating occurrences", () => {
    const input = memoryFixture("import", ["literal", "literal"]);
    Object.assign(input.expectations.memory!.file!.facts[1]!.source, {
      raw: input.raws[0]!,
    });
    input.identity.receipts.filter(
      (row) => row.packet?.event === "memory.fact",
    )[1]!.packet!.values.raw = input.raws[0]!;
    input.body.facts[1]!.id = input.raws[0]!;
    input.updateBodies();
    const result = buildIdentityRegistry(input);
    expect(result.errors).toEqual([]);
    expect(result.memory!.facts).toHaveLength(2);
    expect(result.requestDecisions.has(1)).toBe(false);
  });
  it.each(["undeclared", "unstable-account", "another-file", "wrong-terminal"])(
    "does not silently accept %s scope",
    (change) => {
      const input = memoryFixture();
      if (change === "undeclared") delete input.expectations.memory;
      if (change === "unstable-account")
        Object.assign(input.expectations.memory!, { stableAccount: false });
      if (change === "another-file")
        input.emit("memory.choice", { factCount: 2 }, "file", 2400, 6);
      if (change === "wrong-terminal")
        input.expectations.memory!.terminal = "active";
      reject(input);
    },
  );
});
