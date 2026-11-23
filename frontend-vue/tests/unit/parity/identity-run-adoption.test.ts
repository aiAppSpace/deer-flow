import { describe, expect, it } from "vitest";
import {
  buildIdentityRegistry,
  type IdentityExpectations,
} from "../../e2e-parity/support/identity-registry";
import type {
  IdentityPacket,
  IdentityReceipt,
} from "../../e2e-parity/support/identity-receipts";
import { projectIdentityNetwork } from "../../e2e-parity/support/identity-projection";
import { projectNetwork } from "../../e2e-parity/support/capture-network";
import { humanFixture } from "./identity-human-fixtures";
import { replayRegistryFixture } from "./identity-replay-fixtures";

function fixture(kind: "human" | "edit" | "regenerate" = "human", vue = true) {
  const f =
    kind === "human" ? humanFixture(vue) : replayRegistryFixture(kind, vue);
  const request = "request" in f ? f.request : f.run;
  request.response = {
    status: 200,
    headers: {
      "content-type": "text/event-stream",
      "content-location": `/api/threads/${f.raw}/runs/new-run`,
    },
  };
  const initial = buildIdentityRegistry(f);
  expect(initial.errors).toEqual([]);
  const sourceSequence =
    kind === "human"
      ? initial.humans[0]!.submission.sequence
      : initial.replay!.candidate.source.submission.sequence;
  const source = f.identity.receipts.find(
    (row) => row.sequence === sourceSequence,
  )!;
  const expected: IdentityExpectations = {
    ...f.expectations,
    runs: [
      {
        slot: "created-run",
        submission:
          kind === "human"
            ? { kind: "human", slot: "first-human" }
            : {
                kind: "replay",
                slot: initial.replay!.candidate.expectation.slot,
              },
      },
    ],
    runObservation: vue ? "adapter" : "sdk",
  };
  const fixtureStartedAt = request.startedAt;
  if (fixtureStartedAt === null || !Number.isFinite(fixtureStartedAt))
    throw new Error("run adoption fixture needs an observed request start");
  const clock =
    Math.max(
      ...f.identity.receipts.map((row) => row.dispatchedAt),
      fixtureStartedAt,
    ) + 100;
  const add = (name: string, values: IdentityPacket["values"], at: number) => {
    const row: IdentityReceipt = {
      ...source,
      sequence: Math.max(...f.identity.receipts.map((row) => row.sequence)) + 1,
      action: "runtime-phase",
      dispatchedAt: at,
      packet: {
        ...source.packet!,
        action: "runtime-phase",
        event: name,
        at,
        values,
      },
    };
    f.identity.receipts.push(row);
    return row;
  };
  const bind = add(
    "run.bind",
    {
      thread: f.raw,
      assistant: "lead_agent",
      sourceAction: source.packet!.action,
    },
    clock,
  );
  const called = add(
    "run.called",
    { transport: vue ? "adapter" : "sdk", state: "active" },
    clock + 10,
  );
  request.startedAt = clock + 20;
  const received = add(
    "run.received",
    { thread: f.raw, run: "new-run", state: "active" },
    clock + 30,
  );
  const delivered = add(
    "run.delivered",
    { thread: f.raw, run: "new-run", state: "active" },
    clock + 40,
  );
  return {
    ...f,
    expectations: expected,
    request,
    source,
    bind,
    called,
    received,
    delivered,
    add,
    clock,
  };
}
function rejects(f: ReturnType<typeof fixture>) {
  const registry = buildIdentityRegistry(f);
  expect(registry.errors.length).toBeGreaterThan(0);
  expect(registry.runAdoptions).toEqual([]);
  expect(registry.requestDecisions.size).toBe(0);
  const projected = projectIdentityNetwork(f.network, f.appBase, registry);
  const raw = projectNetwork(f.network, f.appBase);
  expect(projected.requests).toEqual(raw.requests);
  expect(projected.requestBodies).toEqual(raw.requestBodies);
  expect(projected.requestFacts).toEqual(raw.requestFacts);
}
describe("whole run phase domain bound to an independent submission", () => {
  it.each(["human", "edit", "regenerate"] as const)(
    "admits %s on both transports with current phase actions",
    (kind) => {
      for (const vue of [false, true]) {
        const f = fixture(kind, vue),
          before = JSON.stringify(f.network);
        const registry = buildIdentityRegistry(f);
        expect(registry.errors).toEqual([]);
        expect(registry.runAdoptions).toHaveLength(1);
        const adoption = registry.runAdoptions[0]!;
        expect(adoption.source.sequence).toBe(f.source.sequence);
        expect(adoption.run.candidate.request).toBe(f.request);
        expect(adoption.received.packet).toBe(f.received.packet);
        expect(adoption.retirement).toBeNull();
        expect(JSON.stringify(f.network)).toBe(before);
      }
    },
  );
  it("retirement after delivery bounds validity without retroactive rejection", () => {
    const f = fixture();
    const retired = f.add("run.retire", {}, f.clock + 50);
    const registry = buildIdentityRegistry(f);
    expect(registry.errors).toEqual([]);
    expect(registry.runAdoptions[0]!.retirement?.packet).toBe(retired.packet);
  });
  it("array storage order does not select an owner", () => {
    const f = fixture("edit");
    f.identity.receipts.reverse();
    expect(buildIdentityRegistry(f).errors).toEqual([]);
  });
  it.each(["bind", "called", "received", "delivered"] as const)(
    "missing %s cannot grant partial decisions",
    (name) => {
      const f = fixture();
      f.identity.receipts.splice(f.identity.receipts.indexOf(f[name]), 1);
      rejects(f);
    },
  );
  it.each(["bind", "called", "received", "delivered"] as const)(
    "duplicate %s is unresolved",
    (name) => {
      const f = fixture();
      f.add(f[name].packet!.event, { ...f[name].packet!.values }, f.clock + 50);
      rejects(f);
    },
  );
  it.each([
    "producer",
    "instance",
    "document",
    "transport",
    "source-action",
    "thread",
    "run",
    "received-state",
    "delivered-state",
    "early-retire",
    "double-retire",
    "unowned",
    "undeclared",
    "missing-transport",
    "wrong-transport",
    "missing-run",
    "reverse-order",
    "invalid-clock",
    "late-request",
    "unobserved-request-start",
    "nan-request-start",
    "infinite-request-start",
    "zero-request-start",
    "negative-request-start",
    "unknown-phase",
  ])("rejects %s while preserving all three raw views", (change) => {
    const f = fixture();
    switch (change) {
      case "producer":
        f.called.packet!.producer = "replay";
        break;
      case "instance":
        f.called.packet!.instance += 1;
        break;
      case "document":
        f.called.document = "other-document";
        break;
      case "transport":
        f.called.packet!.values.transport = "sdk";
        break;
      case "source-action":
        f.bind.packet!.values.sourceAction = "wrong-source";
        break;
      case "thread":
        f.received.packet!.values.thread = "other-thread";
        break;
      case "run":
        f.delivered.packet!.values.run = "old-run";
        break;
      case "received-state":
        f.received.packet!.values.state = "retired";
        break;
      case "delivered-state":
        f.delivered.packet!.values.state = "ambiguous";
        break;
      case "early-retire":
        f.add("run.retire", {}, f.clock + 25);
        break;
      case "double-retire":
        f.add("run.retire", {}, f.clock + 50);
        f.add("run.retire", {}, f.clock + 60);
        break;
      case "unowned": {
        const row = f.add(
          "run.unowned",
          { transport: "adapter" },
          f.clock + 50,
        );
        row.packet!.producer = "run";
        break;
      }
      case "undeclared": {
        const row = f.add(
          "run.bind",
          { ...f.bind.packet!.values },
          f.clock + 50,
        );
        row.packet!.instance += 10;
        break;
      }
      case "missing-transport":
        delete f.expectations.runObservation;
        break;
      case "wrong-transport":
        f.expectations.runObservation = "sdk";
        break;
      case "missing-run":
        f.expectations.runs = [];
        break;
      case "reverse-order": {
        const sequence = f.received.sequence;
        f.received.sequence = f.called.sequence;
        f.called.sequence = sequence;
        break;
      }
      case "invalid-clock":
        f.received.packet!.at = Number.NaN;
        break;
      case "late-request":
        f.request.startedAt = f.clock + 100;
        break;
      case "unobserved-request-start":
        f.request.startedAt = null;
        break;
      case "nan-request-start":
        f.request.startedAt = Number.NaN;
        break;
      case "infinite-request-start":
        f.request.startedAt = Number.POSITIVE_INFINITY;
        break;
      case "zero-request-start":
        f.request.startedAt = 0;
        break;
      case "negative-request-start":
        f.request.startedAt = -1;
        break;
      case "unknown-phase":
        f.received.packet!.event = "run.invented";
        break;
    }
    rejects(f);
  });
});
