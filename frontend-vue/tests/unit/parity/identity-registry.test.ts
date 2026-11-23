import { describe, expect, it } from "vitest";
import { buildIdentityRegistry } from "../../e2e-parity/support/identity-registry";
import { fixture, packet, literalFixture } from "./identity-fixtures";

describe("initial thread registry and exact consumer admission", () => {
  it("keeps an independently declared persisted fixture literal while checking its owner", () => {
    const result = buildIdentityRegistry(literalFixture());
    expect(result.errors).toEqual([]);
    expect(result.entities).toHaveLength(1);
    expect(result.entities[0]!.literal).toBe(true);
    expect(result.requestDecisions.size).toBe(0);
  });
  it.each(["draft", "mock"])(
    "rejects a persisted fixture presented with wrong %s intent",
    (field) => {
      const input = literalFixture();
      packet(input, "thread.select").values[field] = true;
      expect(buildIdentityRegistry(input).errors.length).toBeGreaterThan(0);
    },
  );
  it("does not confuse a large local association number with too many receipts", () => {
    const input = fixture();
    for (const row of input.identity.receipts)
      if (row.packet) {
        row.packet.instance = 40000;
        if ("allocation" in row.packet.values)
          row.packet.values.allocation = 40001;
        if ("lease" in row.packet.values) row.packet.values.lease = 40002;
      }
    expect(buildIdentityRegistry(input).errors).toEqual([]);
  });
  it("requires the first thread to retire before selecting a different entity", () => {
    const input = fixture();
    const scope = { ...input.scope, projectIntent: "project-B" };
    input.expectations.threads = [
      ...input.expectations.threads,
      { ...input.expectations.threads[0]!, ...scope, slot: "second-owner" },
    ];
    input.event(
      "thread.allocate",
      { allocation: 1, raw: "other", reason: "initial", ...scope },
      1000,
    );
    input.event("thread.bind", {
      allocation: 1,
      raw: "other",
      project: "project-B",
    });
    input.event("thread.select", {
      raw: "other",
      draft: true,
      mock: false,
      ...scope,
    });
    input.event("lease.retire", { lease: 1, epoch: 1 });
    input.event("lease.select", {
      lease: 2,
      epoch: 1,
      allocation: 1,
      raw: "other",
      ...scope,
    });
    input.event("uploads.limits", {
      lease: 2,
      epoch: 1,
      raw: "other",
      state: "selected",
    });
    input.network.requests.push({
      ...input.network.requests[0]!,
      sequence: 1,
      url: input.network.requests[0]!.url.replace(input.raw, "other"),
    });
    expect(buildIdentityRegistry(input).errors.length).toBeGreaterThan(0);
  });
  it.each([false, true])(
    "admits exact selected or early candidate lease (candidate=%s)",
    (candidate) => {
      const input = fixture(candidate);
      const result = buildIdentityRegistry(input);
      expect(result.errors).toEqual([]);
      expect(result.sourceNetwork).toBe(input.network);
      expect(result.entities).toHaveLength(1);
      expect(result.requestDecisions.get(0)).toEqual([
        {
          slot: { kind: "path", index: 3 },
          raw: input.raw,
          identity: result.entities[0]!.identity,
        },
      ]);
    },
  );
  it("uses independent initial-entry semantics, never origin action or allocation numbers", () => {
    const react = fixture();
    const vue = fixture(true);
    for (const row of vue.identity.receipts)
      if (row.packet) {
        row.packet.instance = 91;
        if ("allocation" in row.packet.values)
          row.packet.values.allocation = 12;
        if ("lease" in row.packet.values) row.packet.values.lease = 33;
        if ("raw" in row.packet.values)
          row.packet.values.raw = "another-thread";
      }
    vue.network.requests[0]!.url = vue.network.requests[0]!.url.replace(
      vue.raw,
      "another-thread",
    );
    const a = buildIdentityRegistry(react),
      b = buildIdentityRegistry(vue);
    expect(a.errors).toEqual([]);
    expect(b.errors).toEqual([]);
    expect(a.entities[0]!.identity).toEqual(b.entities[0]!.identity);
  });
  it.each(["account", "projectIntent", "agent", "path"] as const)(
    "does not relabel an allocation from the wrong %s",
    (field) => {
      const input = fixture();
      packet(input, "thread.allocate").values[field] = "wrong-scope";
      const result = buildIdentityRegistry(input);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.requestDecisions.size).toBe(0);
    },
  );
  it("does not repair an initial allocation with a future project binding", () => {
    const input = fixture();
    packet(input, "thread.bind").values.project = "future-project";
    expect(buildIdentityRegistry(input).errors.length).toBeGreaterThan(0);
  });
  it.each(["candidate", "selected", "retired"])(
    "rejects a %s consumer using another raw value",
    (state) => {
      const input = fixture(state === "candidate");
      Object.assign(packet(input, "uploads.limits").values, {
        raw: "other-owner",
        state,
      });
      input.network.requests[0]!.url = input.network.requests[0]!.url.replace(
        input.raw,
        "other-owner",
      );
      expect(buildIdentityRegistry(input).errors.length).toBeGreaterThan(0);
    },
  );
  it("does not borrow a later equal-raw but different lease for an abandoned candidate", () => {
    const input = fixture(true);
    packet(input, "lease.select").values.lease = 2;
    expect(buildIdentityRegistry(input).errors.length).toBeGreaterThan(0);
  });
  it("does not borrow a future allocation for a lease with no provenance", () => {
    const input = fixture(true);
    packet(input, "lease.select").values.allocation = null;
    expect(buildIdentityRegistry(input).errors.length).toBeGreaterThan(0);
  });
  it("does not let an owned candidate hide unowned traffic with the same URL", () => {
    const input = fixture();
    input.event("uploads.unowned", { raw: input.raw });
    input.identity.receipts.at(-1)!.packet!.producer = "uploads";
    input.network.requests.push({ ...input.network.requests[0]!, sequence: 1 });
    const result = buildIdentityRegistry(input);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.requestDecisions.size).toBe(0);
  });
  it("does not filter away unowned traffic just because its raw value is unregistered", () => {
    const input = fixture();
    input.event("uploads.unowned", { raw: "unknown" });
    input.identity.receipts.at(-1)!.packet!.producer = "uploads";
    expect(buildIdentityRegistry(input).errors.length).toBeGreaterThan(0);
  });
  it("reopens a retired lease with a new epoch without minting another entity", () => {
    const input = fixture();
    input.event("lease.retire", { lease: 1, epoch: 1 });
    input.event("lease.select", {
      ...packet(input, "lease.select").values,
      epoch: 2,
    });
    input.event("uploads.limits", {
      lease: 1,
      epoch: 2,
      raw: input.raw,
      state: "selected",
    });
    input.network.requests.push({ ...input.network.requests[0]!, sequence: 1 });
    const result = buildIdentityRegistry(input);
    expect(result.errors).toEqual([]);
    expect(result.entities).toHaveLength(1);
    expect(result.requestDecisions.size).toBe(2);
  });
  it("does not erase a retired use when the same lease is reopened", () => {
    const input = fixture();
    input.event("lease.retire", { lease: 1, epoch: 1 });
    input.event("uploads.limits", {
      lease: 1,
      epoch: 1,
      raw: input.raw,
      state: "retired",
    });
    input.event("lease.select", {
      ...packet(input, "lease.select").values,
      epoch: 2,
    });
    input.network.requests.push({ ...input.network.requests[0]!, sequence: 1 });
    expect(buildIdentityRegistry(input).errors.length).toBeGreaterThan(0);
  });
  it("does not keep a lease active across a thread retirement lacking its lease retirement", () => {
    const input = fixture();
    input.event("thread.retire", {
      raw: input.raw,
      account: input.scope.account,
      agent: null,
    });
    input.event("thread.select", { ...packet(input, "thread.select").values });
    input.event("uploads.limits", {
      lease: 1,
      epoch: 1,
      raw: input.raw,
      state: "selected",
    });
    input.network.requests.push({ ...input.network.requests[0]!, sequence: 1 });
    expect(buildIdentityRegistry(input).errors.length).toBeGreaterThan(0);
  });
  it("does not leave two different leases selected for the same owner", () => {
    const input = fixture();
    input.event("lease.select", {
      ...packet(input, "lease.select").values,
      lease: 2,
    });
    input.event("uploads.limits", {
      lease: 2,
      epoch: 1,
      raw: input.raw,
      state: "selected",
    });
    input.network.requests.push({ ...input.network.requests[0]!, sequence: 1 });
    expect(buildIdentityRegistry(input).errors.length).toBeGreaterThan(0);
  });
  it.each(["request", "consumer"])(
    "rejects extra %s instead of assuming one-to-one pairing",
    (kind) => {
      const input = fixture();
      if (kind === "request")
        input.network.requests.push({
          ...input.network.requests[0]!,
          sequence: 1,
        });
      else
        input.event("uploads.limits", {
          ...packet(input, "uploads.limits").values,
        });
      expect(buildIdentityRegistry(input).errors.length).toBeGreaterThan(0);
    },
  );
  it("does not make a required initial owner pass as an empty group", () => {
    const input = fixture();
    input.identity.receipts = [];
    input.network.requests = [];
    expect(buildIdentityRegistry(input).errors.length).toBeGreaterThan(0);
  });
  it.each(["source", "document", "fresh", "timing", "navigation", "capture"])(
    "retains missing or contradictory %s proof as unresolved",
    (kind) => {
      const input = fixture();
      if (kind === "source") input.network.requests[0]!.source = "unknown";
      if (kind === "document") input.identity.expectedDocuments = null;
      if (kind === "fresh") input.freshPage.kind = "unproven";
      if (kind === "timing") input.network.requests[0]!.startedAt = null;
      if (kind === "navigation") input.network.requests[0]!.navigation = true;
      if (kind === "capture")
        packet(input, "uploads.limits").capture = "other-capture";
      expect(buildIdentityRegistry(input).errors.length).toBeGreaterThan(0);
    },
  );
  it.each(["allocation", "lease", "epoch"])(
    "does not coerce a string %s into a local reference",
    (field) => {
      const input = fixture();
      packet(input, "lease.select").values[field] = "1";
      expect(buildIdentityRegistry(input).errors.length).toBeGreaterThan(0);
    },
  );
  it("rejects a semantic collision between distinct raws", () => {
    const input = fixture();
    const second = fixture();
    for (const row of second.identity.receipts.filter((row) => row.packet)) {
      row.packet!.instance = 2;
      if ("raw" in row.packet!.values) row.packet!.values.raw = "other";
      row.sequence = input.identity.receipts.length;
      input.identity.receipts.push(row);
    }
    input.network.requests.push({
      ...input.network.requests[0]!,
      sequence: 1,
      url: input.network.requests[0]!.url.replace(input.raw, "other"),
    });
    expect(buildIdentityRegistry(input).errors.length).toBeGreaterThan(0);
  });
  it("rejects a receipt event owned by the wrong producer", () => {
    const input = fixture();
    packet(input, "lease.select").producer = "memory:import";
    expect(buildIdentityRegistry(input).errors.length).toBeGreaterThan(0);
  });
});

function adoptedFixture(
  prepared = false,
  intermediate = false,
  agent: string | null = null,
) {
  const input = fixture();
  const path = agent
    ? `/workspace/agents/${encodeURIComponent(agent)}/chats/new`
    : "/workspace/chats/new";
  const scope = { ...input.scope, path, agent };
  const expectation = input.expectations.threads[0]!;
  Object.assign(expectation, scope, {
    adoption: "same-raw",
    producer: agent ? "thread:agent" : "thread:main",
  });
  for (const row of input.identity.receipts)
    if (row.packet) {
      row.packet.producer = expectation.producer;
      if ("path" in row.packet.values) Object.assign(row.packet.values, scope);
    }
  const append = (name: string, values: Parameters<typeof input.event>[1]) => {
    input.event(name, values);
    input.identity.receipts.at(-1)!.packet!.producer = expectation.producer;
  };
  const persisted = path.slice(0, -3) + encodeURIComponent(input.raw);
  if (prepared)
    append("thread.prepared", { raw: input.raw, prepared: input.raw });
  if (intermediate)
    append("thread.select", {
      ...scope,
      raw: input.raw,
      draft: false,
      mock: false,
    });
  append("thread.select", {
    ...scope,
    path: persisted,
    raw: input.raw,
    draft: false,
    mock: false,
  });
  append("lease.retire", { lease: 1, epoch: 1 });
  append("lease.select", {
    ...scope,
    path: persisted,
    raw: input.raw,
    allocation: 0,
    lease: 2,
    epoch: 1,
  });
  append("uploads.limits", {
    lease: 2,
    epoch: 1,
    raw: input.raw,
    state: "selected",
  });
  input.network.requests.push({
    ...input.network.requests[0]!,
    sequence: 1,
    startedAt: 1500,
  });
  return { ...input, append, persisted };
}
describe("explicit same-thread adoption preserves source identity", () => {
  it.each([
    [false, true, null],
    [true, false, null],
    [false, true, "agent /汉"],
    [true, false, "agent /汉"],
  ] as const)(
    "keeps one entity through prepared=%s/intermediate=%s/agent=%s",
    (prepared, intermediate, agent) => {
      const input = adoptedFixture(prepared, intermediate, agent);
      const result = buildIdentityRegistry(input);
      expect(result.errors).toEqual([]);
      expect(result.entities).toHaveLength(1);
      expect(result.entities[0]!.allocatedAt).toBe(1000);
      expect(result.entities[0]!.expectation.path).toBe(
        input.expectations.threads[0]!.path,
      );
      expect(result.requestDecisions.size).toBe(2);
      expect(result.requestDecisions.get(0)![0]!.identity).toEqual(
        result.requestDecisions.get(1)![0]!.identity,
      );
    },
  );
  it("does not infer adoption permission from observed flags or a saved route", () => {
    const input = adoptedFixture();
    delete input.expectations.threads[0]!.adoption;
    expect(buildIdentityRegistry(input).errors.length).toBeGreaterThan(0);
  });
  it.each(["account", "agent", "projectIntent", "raw", "path"] as const)(
    "cannot adopt a different %s",
    (field) => {
      const input = adoptedFixture();
      const selection = input.identity.receipts
        .filter((row) => row.packet?.event === "thread.select")
        .at(-1)!.packet!;
      selection.values[field] = "another";
      expect(buildIdentityRegistry(input).requestDecisions.size).toBe(0);
      expect(buildIdentityRegistry(input).errors.length).toBeGreaterThan(0);
    },
  );
  it("requires the adopted path on its new lease rather than borrowing the initial path", () => {
    const input = adoptedFixture();
    const lease = input.identity.receipts
      .filter((row) => row.packet?.event === "lease.select")
      .at(-1)!.packet!;
    lease.values.path = input.expectations.threads[0]!.path;
    expect(buildIdentityRegistry(input).errors.length).toBeGreaterThan(0);
  });
  it.each(["draft", "mock"] as const)(
    "does not accept a persisted presentation with %s=true",
    (field) => {
      const input = adoptedFixture();
      const selection = input.identity.receipts
        .filter((row) => row.packet?.event === "thread.select")
        .at(-1)!.packet!;
      selection.values[field] = true;
      expect(buildIdentityRegistry(input).errors.length).toBeGreaterThan(0);
    },
  );
  it.each(["different-target", "another-owner"] as const)(
    "does not turn prepared %s into a same-raw alias",
    (change) => {
      const input = adoptedFixture(true);
      const prepared = packet(input, "thread.prepared");
      if (change === "different-target")
        prepared.values.prepared = "server-other";
      else prepared.instance = 99;
      expect(buildIdentityRegistry(input).errors.length).toBeGreaterThan(0);
    },
  );
  it("cannot regress a saved entity back to draft without a new source", () => {
    const input = adoptedFixture();
    input.append("thread.select", {
      ...input.scope,
      raw: input.raw,
      draft: true,
      mock: false,
    });
    expect(buildIdentityRegistry(input).errors.length).toBeGreaterThan(0);
  });
  it("does not accept a saved first selection in place of the initial selected draft", () => {
    const input = adoptedFixture();
    packet(input, "thread.select").values.draft = false;
    expect(buildIdentityRegistry(input).errors.length).toBeGreaterThan(0);
  });
});

function candidateLiteralFixture(agent = false) {
  const input = literalFixture();
  const expected = input.expectations.threads[0]!;
  expected.producer = agent ? "thread:agent" : "thread:main";
  expected.agent = agent ? "team/one" : null;
  expected.path = agent
    ? `/workspace/agents/${encodeURIComponent(expected.agent!)}/chats/${input.raw}`
    : `/workspace/chats/${input.raw}`;
  const consumer = input.identity.receipts.find(
    (row) => row.packet?.event === "uploads.limits",
  )!;
  consumer.packet!.values.state = "candidate";
  consumer.packet!.values.epoch = 0;
  const others = input.identity.receipts.filter((row) => row !== consumer);
  input.identity.receipts.splice(
    0,
    input.identity.receipts.length,
    others[0]!,
    consumer,
    ...others.slice(1),
  );
  input.identity.receipts.forEach((row, sequence) => {
    row.sequence = sequence;
    if (!row.packet) return;
    row.dispatchedAt = 1100 + sequence * 10;
    row.packet.producer = expected.producer;
    if (["thread.select", "lease.select"].includes(row.packet.event))
      Object.assign(row.packet.values, {
        agent: expected.agent,
        path: expected.path,
      });
  });
  input.network.requests[0]!.startedAt = 1115;
  return input;
}
describe("independently declared literal first-selection candidate", () => {
  it.each([false, true])(
    "admits the exact literal first lease without inventing an allocation (agent=%s)",
    (agent) => {
      const input = candidateLiteralFixture(agent),
        result = buildIdentityRegistry(input);
      expect(result.errors).toEqual([]);
      expect(result.entities).toHaveLength(1);
      expect(result.entities[0]!.literal).toBe(true);
      expect(result.entities[0]!.allocation).toBeNull();
      expect(result.requestDecisions.size).toBe(0);
    },
  );
  it.each([
    "raw",
    "lease",
    "owner",
    "scope",
    "epoch",
    "missing-selection",
    "undeclared-literal",
    "late-candidate",
  ])("rejects %s evidence", (change) => {
    const input = candidateLiteralFixture();
    const consumer = packet(input, "uploads.limits"),
      lease = packet(input, "lease.select");
    if (change === "raw") consumer.values.raw = "other-literal";
    if (change === "lease") consumer.values.lease = 2;
    if (change === "owner") consumer.instance = 2;
    if (change === "scope") lease.values.account = "other-account";
    if (change === "epoch") lease.values.epoch = 2;
    if (change === "missing-selection")
      input.identity.receipts.splice(
        input.identity.receipts.findIndex((row) => row.packet === lease),
        1,
      );
    if (change === "undeclared-literal")
      input.expectations.threads[0]!.source = {
        kind: "allocation",
        reason: "initial",
        actions: ["entry"],
      };
    if (change === "late-candidate")
      input.identity.receipts.find((row) => row.packet === consumer)!.sequence =
        1000;
    const result = buildIdentityRegistry(input);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.requestDecisions.size).toBe(0);
  });
});

describe("uploads consumer/request timing feasibility", () => {
  it.each([false, true])(
    "rejects an early request even for an already known raw (literal=%s)",
    (literal) => {
      const input = literal ? candidateLiteralFixture() : fixture();
      input.network.requests[0]!.startedAt = 1050;
      const result = buildIdentityRegistry(input);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.requestDecisions.size).toBe(0);
    },
  );
  it.each([false, true])(
    "rejects a two-request prefix preceding the second consumer (literal=%s)",
    (literal) => {
      const input = literal ? candidateLiteralFixture() : fixture();
      input.event("uploads.limits", {
        lease: 1,
        epoch: 1,
        raw: input.raw,
        state: "selected",
      });
      input.identity.receipts.at(-1)!.dispatchedAt = 1400;
      input.network.requests.push({
        ...structuredClone(input.network.requests[0]!),
        sequence: 1,
        startedAt: 1350,
      });
      const result = buildIdentityRegistry(input);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.requestDecisions.size).toBe(0);
    },
  );
  it("keeps repeated consumers and requests without matching arrival order", () => {
    const input = fixture();
    input.event("uploads.limits", {
      lease: 1,
      epoch: 1,
      raw: input.raw,
      state: "selected",
    });
    input.identity.receipts.at(-1)!.dispatchedAt = 1400;
    input.network.requests.push({
      ...structuredClone(input.network.requests[0]!),
      sequence: 1,
      startedAt: 1450,
    });
    input.network.requests.reverse();
    input.identity.receipts.reverse();
    const result = buildIdentityRegistry(input);
    expect(result.errors).toEqual([]);
    expect(result.requestDecisions.size).toBe(2);
  });
});
