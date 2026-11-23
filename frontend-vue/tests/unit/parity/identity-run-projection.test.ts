import { describe, expect, it } from "vitest";
import {
  buildIdentityRegistry,
  type IdentityNode,
} from "../../e2e-parity/support/identity-registry";
import {
  validateIdentityClaims,
  type IdentityClaim,
} from "../../e2e-parity/support/identity-claims";
import {
  admitRunIdentities,
  type RunIdentity,
  type ProjectedRunLocation,
} from "../../e2e-parity/support/identity-run-admission";
import { projectIdentityNetwork } from "../../e2e-parity/support/identity-projection";
import { projectNetwork } from "../../e2e-parity/support/capture-network";
import { expectedRunProjection } from "../../support/run-projection-oracle";
import { humanFixture } from "./identity-human-fixtures";
import { replayRegistryFixture } from "./identity-replay-fixtures";

function fixture(
  kind: "human" | "edit" | "regenerate" = "human",
  vue = true,
  authority = false,
  suffix = "",
) {
  const f =
    kind === "human" ? humanFixture(vue) : replayRegistryFixture(kind, vue);
  const row = "request" in f ? f.request : f.run;
  row.response = {
    status: 200,
    headers: {
      "content-type": "text/event-stream",
      "content-location": `${authority ? f.appBase : ""}/api/threads/${f.raw}/runs/new-run${suffix}`,
    },
  };
  const before = buildIdentityRegistry(f);
  expect(before.errors).toEqual([]);
  const source =
    kind === "human"
      ? { kind: "human" as const, slot: before.humans[0]!.expectation.slot }
      : {
          kind: "replay" as const,
          slot: before.replay!.candidate.expectation.slot,
        };
  const expectations = {
    ...f.expectations,
    runs: [{ slot: "new-run-slot", submission: source }],
  };
  const registry = buildIdentityRegistry({ ...f, expectations });
  return { f, row, before, expectations, registry };
}
const freeze = (value: unknown) => {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
};
const literalRollback = (
  f: ReturnType<typeof humanFixture> | ReturnType<typeof replayRegistryFixture>,
  result: ReturnType<typeof projectIdentityNetwork>,
) => {
  const literal = projectNetwork(f.network, f.appBase);
  expect(result.observationErrors.length).toBeGreaterThan(0);
  expect(result.requests).toEqual(literal.requests);
  expect(result.requestBodies).toEqual(literal.requestBodies);
  expect(result.requestFacts).toEqual(literal.requestFacts);
};
describe("run reference/create claim boundary", () => {
  const created = (): IdentityClaim => ({
    kind: "run",
    raw: "new-run",
    source: "response/1",
    account: "default",
    literal: false,
    definition: "run-response",
    identity: ["identity", "run", "semantic-run"],
  });
  it("keeps unused valid response definitions and exact-source references", () => {
    const claim = created();
    expect(validateIdentityClaims([claim, { ...claim }])).toEqual([]);
    expect(validateIdentityClaims([{ ...claim, identity: null }])).toEqual([]);
    expect(
      validateIdentityClaims([
        {
          kind: "run",
          raw: "old",
          source: "old-reference",
          account: "default",
          literal: true,
          identity: null,
        },
      ]),
    ).toEqual([]);
  });
  it.each([
    { literal: true },
    { definition: undefined },
    { definition: "other" },
    { literal: 0 },
    { identity: ["identity", "human", "semantic-run"] },
    { identity: ["identity", "run", ""] },
    { identity: ["identity", "run", 5] },
    { identity: ["identity", "run", "semantic-run", "extra"] },
  ])("rejects malformed create declaration %j", (change) => {
    expect(
      validateIdentityClaims([
        { ...created(), ...change } as unknown as IdentityClaim,
      ]).length,
    ).toBeGreaterThan(0);
  });
  it.each([
    "old-run",
    "thread",
    "human",
    "fact",
    "submission-key",
    "different-create",
    "same-semantic",
  ])("rejects %s collision", (kind) => {
    const claim = created();
    const other: IdentityClaim =
      kind === "different-create"
        ? { ...created(), source: "response/2" }
        : kind === "same-semantic"
          ? { ...created(), raw: "different-run" }
          : kind === "old-run"
            ? {
                kind: "run",
                raw: claim.raw,
                source: "old-reference",
                account: "default",
                literal: true,
                identity: null,
              }
            : {
                kind: kind as Exclude<IdentityNode[1], "run">,
                raw: claim.raw,
                source: "other-source",
                account: "default",
                literal: true,
                identity: null,
              };
    expect(validateIdentityClaims([claim, other]).length).toBeGreaterThan(0);
  });
});
describe("one fixed response location decision on an admitted submit", () => {
  it.each([
    "account",
    "projectIntent",
    "agent",
    "path",
    "producer",
    "slot",
    "owner",
  ])("rejects post-admission owner binding change: %s", (field) => {
    const { f, registry } = fixture("human");
    expect(registry.errors).toEqual([]);
    const thread = registry.runs[0]!.candidate.thread;
    if (field === "owner") thread.owner = "another-owner";
    else
      Object.assign(thread.expectation, {
        [field]: field === "producer" ? "thread:agent" : "another-scope",
      });
    literalRollback(f, projectIdentityNetwork(f.network, f.appBase, registry));
  });

  it.each(["projectIntent", "agent"] as const)(
    "rejects invalid nullable owner field after admission: %s",
    (field) => {
      for (const value of [undefined, Number.NaN, Infinity, "", 0, false]) {
        const { f, registry } = fixture("human");
        expect(registry.errors).toEqual([]);
        const declaration = registry.runs[0]!.candidate.thread.expectation;
        expect(declaration[field]).toBeNull();
        Object.assign(declaration, { [field]: value });
        const admitted = admitRunIdentities({
          registry,
          candidates: registry.runCandidates,
        });
        expect(admitted.errors).toContain(
          "run source has invalid nullable owner fields",
        );
        expect(admitted.entities).toEqual([]);
        expect(admitted.decisions.size).toBe(0);
        literalRollback(
          f,
          projectIdentityNetwork(f.network, f.appBase, registry),
        );
      }
      const { f, registry } = fixture("human");
      Reflect.deleteProperty(
        registry.runs[0]!.candidate.thread.expectation,
        field,
      );
      literalRollback(
        f,
        projectIdentityNetwork(f.network, f.appBase, registry),
      );
    },
  );

  it.each(["human", "edit", "regenerate"] as const)(
    "projects %s cumulatively and leaves a frozen snapshot unchanged",
    (kind) => {
      for (const vue of [false, true])
        for (const absolute of [false, true])
          for (const suffix of ["", "/"] as const) {
            const { f, row, before, registry } = fixture(
              kind,
              vue,
              absolute,
              suffix,
            );
            expect(registry.errors).toEqual([]);
            expect(registry.runs).toHaveLength(1);
            const baseline = projectIdentityNetwork(
                f.network,
                f.appBase,
                before,
              ),
              raw = JSON.stringify(f.network);
            const parent =
              kind === "human"
                ? [
                    "human",
                    before.humans[0]!.expectation.slot,
                    before.humans[0]!.expectation.submission.slot,
                  ]
                : ["replay", before.replay!.candidate.expectation.slot];
            const run: RunIdentity = [
              "identity",
              "run",
              JSON.stringify([
                before.entities[0]!.identity[2],
                parent,
                "new-run-slot",
              ]),
            ];
            expect(registry.runs[0]!.identity).toEqual(run);
            const expected: ProjectedRunLocation = [
              "run-location",
              `${absolute ? f.appBase : ""}/api/threads/`,
              kind === "human"
                ? before.entities[0]!.identity
                : ["string", f.raw],
              "/runs/",
              run,
              suffix,
            ];
            freeze(f.network);
            expect(
              projectIdentityNetwork(f.network, f.appBase, registry),
            ).toEqual(
              expectedRunProjection(
                baseline,
                f.network.requests.indexOf(row),
                expected,
              ),
            );
            expect(JSON.stringify(f.network)).toBe(raw);
            expect(row.response!.headers["content-location"]).toBe(
              `${absolute ? f.appBase : ""}/api/threads/${f.raw}/runs/new-run${suffix}`,
            );
            expect(
              registry.requestDecisions
                .get(row.sequence)!
                .filter((d) => d.slot.kind === "response"),
            ).toHaveLength(1);
          }
    },
  );
  it("retains unselected create definitions instead of collecting only decisions", () => {
    const { before } = fixture();
    expect(before.runs).toEqual([]);
    const result = admitRunIdentities({ registry: before, candidates: [] });
    expect(result.errors).toEqual([]);
    expect(result.entities).toEqual([]);
    expect(result.decisions.size).toBe(0);
    expect(result.claims).toHaveLength(1);
    expect(result.claims[0]).toMatchObject({
      kind: "run",
      raw: "new-run",
      literal: false,
      definition: "run-response",
      identity: null,
    });
  });
  it.each(["thread", "human", "old-run", "replacement", "key"])(
    "root rejects new run colliding with %s",
    (role) => {
      const { f, row, expectations, registry } = fixture(
        role === "human" ? "human" : "edit",
      );
      const raw =
        role === "thread"
          ? f.raw
          : role === "human"
            ? registry.humans[0]!.raw
            : role === "old-run"
              ? registry.replay!.candidate.expectation.source.oldRun
              : role === "replacement"
                ? registry.replay!.replacement!.raw
                : registry.replay!.key!.raw;
      row.response!.headers["content-location"] =
        `/api/threads/${f.raw}/runs/${encodeURIComponent(raw)}`;
      const bad = buildIdentityRegistry({ ...f, expectations });
      expect(bad.errors).toContain(
        "identity raw claimed by incompatible sources or kinds",
      );
      expect(bad.runs).toEqual([]);
      expect(bad.requestDecisions.size).toBe(0);
      literalRollback(f, projectIdentityNetwork(f.network, f.appBase, bad));
    },
  );
  it.each([
    "missing",
    "duplicate",
    "wrong-header",
    "wrong-thread-permission",
    "wrong-identity",
    "wrong-raw",
    "entity-raw",
    "definition",
    "prefix",
    "suffix",
    "encoded",
    "cloned-request",
    "deleted-entity-and-decision",
  ])("atomically rolls back all views after %s tampering", (change) => {
    const { f, row, registry } = fixture("edit");
    expect(registry.errors).toEqual([]);
    const map = new Map(registry.requestDecisions),
      decisions = [...map.get(row.sequence)!],
      index = decisions.findIndex((d) => d.slot.kind === "response");
    const decision = structuredClone(decisions[index]!);
    decisions[index] = decision;
    if (change === "missing") decisions.splice(index, 1);
    if (change === "duplicate") decisions.push(decision);
    if (change === "wrong-header")
      Object.assign(decision.slot, { name: "location" });
    if (change === "wrong-thread-permission")
      Object.assign(decision.slot, {
        threadIdentity: registry.entities[0]!.identity,
      });
    if (change === "wrong-identity")
      decision.identity = ["identity", "human", decision.identity[2]];
    if (change === "wrong-raw") decision.raw += "/";
    if (change === "entity-raw") registry.runs[0]!.raw = "different-run";
    if (change === "definition")
      registry.runs[0]!.source = "different-response";
    if (change === "prefix")
      registry.runs[0]!.candidate.location.prefix =
        "https://other.example/api/threads/";
    if (change === "suffix") registry.runs[0]!.candidate.location.suffix = "/";
    if (change === "encoded")
      registry.runs[0]!.candidate.location.run.encoded = "%6Eew-run";
    if (change === "cloned-request")
      registry.runs[0]!.candidate.request = structuredClone(row);
    if (change === "deleted-entity-and-decision") {
      registry.runs = [];
      decisions.splice(index, 1);
    }
    map.set(row.sequence, decisions);
    const raw = JSON.stringify(f.network);
    literalRollback(
      f,
      projectIdentityNetwork(f.network, f.appBase, {
        ...registry,
        requestDecisions: map,
      }),
    );
    expect(JSON.stringify(f.network)).toBe(raw);
  });
  it("preserves consumer URLs/cursor and failed open SSE without granting membership", () => {
    const { f, row, expectations } = fixture();
    row.finished = false;
    row.failure = { errorText: "net::ERR_ABORTED" };
    const join = structuredClone(row);
    join.sequence += 1;
    join.method = "GET";
    join.url = `${f.appBase}/api/langgraph/threads/${f.raw}/runs/new-run/stream?cancel_on_disconnect=0`;
    join.startedAt = 1;
    join.headers["last-event-id"] = "new-run";
    f.network.requests.push(join);
    const registry = buildIdentityRegistry({ ...f, expectations });
    expect(registry.errors).toEqual([]);
    const result = projectIdentityNetwork(f.network, f.appBase, registry);
    expect(result.observationErrors).toEqual([]);
    expect(result.requestFacts.at(-1)).toBe(
      projectNetwork(f.network, f.appBase).requestFacts.at(-1),
    );
    const fact = JSON.parse(
      result.requestFacts[f.network.requests.indexOf(row)]!,
    );
    expect(fact.finished).toBe(false);
    expect(fact.failure).toEqual({ errorText: "net::ERR_ABORTED" });
    expect(registry.requestDecisions.has(join.sequence)).toBe(false);
  });
});
