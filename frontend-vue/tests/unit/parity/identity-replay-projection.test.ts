import { describe, expect, it } from "vitest";
import { buildIdentityRegistry } from "../../e2e-parity/support/identity-registry";
import { projectIdentityNetwork } from "../../e2e-parity/support/identity-projection";
import { projectNetwork } from "../../e2e-parity/support/capture-network";
import { admitReplayIdentities } from "../../e2e-parity/support/identity-replay-admission";
import {
  validateIdentityClaims,
  type IdentityClaim,
} from "../../e2e-parity/support/identity-claims";
import {
  replayRegistryFixture,
  replaySourceFixture,
} from "./identity-replay-fixtures";
import { expectedReplayProjection } from "../../support/replay-projection-oracle";
import { memoryFixture } from "./identity-memory-fixtures";

describe("replay source claims and only three exact generated slots", () => {
  it.each([
    "new-replacement-human",
    "independent-submission-key",
    "source-human",
    "source-assistant",
    "old-run",
    "checkpoint-before-source",
    "existing-version-group",
  ])("rejects collision with an unused generated Memory fact: %s", (raw) => {
    const f = replayRegistryFixture(),
      memory = memoryFixture("preview", ["generated"]);
    f.expectations.memory = memory.expectations.memory;
    for (const row of memory.identity.receipts.filter((r) =>
      r.packet?.event.startsWith("memory."),
    )) {
      const cloned = structuredClone(row);
      cloned.sequence = f.identity.receipts.length;
      cloned.dispatchedAt = 3000 + cloned.sequence;
      f.identity.receipts.push(cloned);
    }
    expect(buildIdentityRegistry(f).errors).toEqual([]);
    f.identity.receipts.find(
      (row) => row.packet?.event === "memory.fact",
    )!.packet!.values.raw = raw;
    const registry = buildIdentityRegistry(f);
    expect(registry.errors).toContain(
      "identity raw claimed by incompatible sources or kinds",
    );
    expect(registry.requestDecisions.size).toBe(0);
    expect(registry.replay).toBeNull();
  });
  it.each(["edit", "regenerate"] as const)(
    "projects %s while preserving every other wire leaf and all three views",
    (kind) => {
      for (const vue of [false, true]) {
        const f = replayRegistryFixture(kind, vue);
        f.body.metadata.literal_example = "new-replacement-human";
        f.body.checkpoint.checkpoint_ns = "new-replacement-human";
        f.update();
        const before = JSON.stringify(f.network),
          registry = buildIdentityRegistry(f);
        expect(registry.errors).toEqual([]);
        const admitted = registry.replay!;
        const result = projectIdentityNetwork(f.network, f.appBase, registry);
        expect(result.observationErrors).toEqual([]);
        if (kind === "edit") {
          expect(admitted.replacement?.identity).toEqual([
            "identity",
            "human",
            JSON.stringify([
              registry.entities[0]!.identity[2],
              "replay-selected-turn",
              "replacement",
            ]),
          ]);
        } else expect(admitted.replacement).toBeNull();
        if (vue) {
          expect(admitted.key?.identity).toEqual([
            "identity",
            "submission-key",
            JSON.stringify([
              registry.entities[0]!.identity[2],
              "replay-selected-turn",
              "key",
            ]),
          ]);
        } else expect(admitted.key).toBeNull();
        expect(result).toEqual(
          expectedReplayProjection(f.network, f.appBase, f.run.sequence, {
            replacement: admitted.replacement?.identity ?? null,
            key: admitted.key?.identity ?? null,
          }),
        );
        expect(registry.requestDecisions.get(f.run.sequence)?.length ?? 0).toBe(
          (kind === "edit" ? 2 : 0) + (vue ? 1 : 0),
        );
        expect(JSON.stringify(f.network)).toBe(before);
      }
    },
  );
  it("keeps regenerated persisted __user and wire human as distinct literal references", () => {
    const f = replayRegistryFixture("regenerate", false);
    f.expectations.replay!.source.sourceHuman = "source-human__user";
    const registry = buildIdentityRegistry(f);
    expect(registry.errors).toEqual([]);
    expect(registry.requestDecisions.size).toBe(0);
    expect(projectIdentityNetwork(f.network, f.appBase, registry)).toEqual(
      projectNetwork(f.network, f.appBase),
    );
  });
  it("requires an explicit source-human group relation; raw equality alone grants no alias", () => {
    const f = replayRegistryFixture();
    f.expectations.replay!.source.versionGroup = "source-human";
    f.body.metadata.edit_version_group_id = "source-human";
    f.update();
    for (const row of f.identity.receipts)
      if (row.packet?.values.slot === "metadata.edit_version_group_id")
        row.packet.values.raw = "source-human";
    expect(buildIdentityRegistry(f).errors.length).toBeGreaterThan(0);
    f.expectations.replay!.versionGroupSource = "source-human";
    expect(buildIdentityRegistry(f).errors).toEqual([]);
    f.expectations.replay!.source.wireHuman = "wire-human";
    expect(buildIdentityRegistry(f).errors).toEqual([]);
  });
  it("rejects a fallback declaration for another old group instead of globally relaxing claims", () => {
    const f = replayRegistryFixture();
    f.expectations.replay!.versionGroupSource = "source-human";
    expect(buildIdentityRegistry(f).errors.length).toBeGreaterThan(0);
  });
  it("retains unused primary definitions in the collector instead of relying on prior errors", () => {
    const f = replaySourceFixture();
    const expected = replayRegistryFixture().expectations.replay!;
    const result = admitReplayIdentities({
      candidate: null,
      expectation: expected,
      events: f.events,
    });
    const generated = result.claims.filter((claim) => !claim.literal);
    expect(
      generated.map((claim) => [claim.kind, claim.raw, claim.identity]),
    ).toEqual([
      ["human", "new-replacement-human", null],
      ["submission-key", "independent-submission-key", null],
    ]);
    expect(result.decisions.size).toBe(0);
    expect(result.admission).toBeNull();
    const duplicate = structuredClone(
      f.events.find((row) => row.packet.event === "idempotency.allocate")!,
    );
    duplicate.sequence += 100;
    const twice = admitReplayIdentities({
      candidate: null,
      expectation: expected,
      events: [...f.events, duplicate],
    });
    expect(
      twice.claims.filter((claim) => claim.kind === "submission-key"),
    ).toHaveLength(2);
    expect(validateIdentityClaims(twice.claims).length).toBeGreaterThan(0);
  });
  it.each(["assistant", "run", "checkpoint", "version-group"] as const)(
    "keeps old %s claims literal-only at runtime",
    (kind) => {
      const claim: IdentityClaim = {
        kind,
        raw: "old",
        source: "old-role",
        account: "account",
        literal: true,
        identity: null,
      };
      expect(validateIdentityClaims([claim])).toEqual([]);
      expect(
        validateIdentityClaims([
          { ...claim, literal: false } as unknown as IdentityClaim,
        ]).length,
      ).toBeGreaterThan(0);
      expect(
        validateIdentityClaims([
          {
            ...claim,
            identity: ["identity", "human", "forged"],
          } as unknown as IdentityClaim,
        ]).length,
      ).toBeGreaterThan(0);
      expect(
        validateIdentityClaims([
          claim,
          {
            kind: "fact",
            raw: "old",
            source: "unused-memory-fact",
            account: "account",
            literal: false,
            identity: null,
          },
        ]).length,
      ).toBeGreaterThan(0);
    },
  );
  it("does not guess a kind for an additional source reference", () => {
    const f = replaySourceFixture();
    f.expected.sources = {
      type: "array",
      ids: ["source-human", "source-assistant", "tool-source"],
    };
    const expectation = {
      ...replayRegistryFixture().expectations.replay!,
      source: f.expected,
    };
    const result = admitReplayIdentities({
      candidate: null,
      expectation,
      events: f.events,
    });
    expect(result.errors).toContain(
      "unresolved kind for additional old source message reference",
    );
  });
  it.each([
    "missing-input",
    "missing-metadata",
    "missing-key",
    "duplicate",
    "content",
    "checkpoint",
    "old-group",
    "wrong-raw",
    "wrong-kind",
    "wrong-role",
    "prepare",
    "extra-path",
    "source",
    "entity-kind",
    "missing-member",
    "cloned-run",
  ])("atomically restores all literal views for tampered %s", (change) => {
    const f = replayRegistryFixture(),
      registry = buildIdentityRegistry(f);
    expect(registry.errors).toEqual([]);
    const decisions = [...registry.requestDecisions.get(f.run.sequence)!];
    if (change === "missing-input") decisions.splice(0, 1);
    if (change === "missing-metadata") decisions.splice(1, 1);
    if (change === "missing-key") decisions.splice(2, 1);
    if (change === "duplicate") decisions.push(decisions[0]!);
    if (["content", "checkpoint", "old-group"].includes(change)) {
      const first = structuredClone(decisions[0]!);
      Object.assign(first.slot, {
        path:
          change === "content"
            ? ["input", "messages", 0, "content"]
            : change === "checkpoint"
              ? ["checkpoint", "checkpoint_id"]
              : ["metadata", "edit_version_group_id"],
      });
      decisions[0] = first;
    }
    if (change === "wrong-raw")
      decisions[0] = { ...decisions[0]!, raw: "source-human" };
    if (change === "wrong-kind")
      decisions[0] = {
        ...decisions[0]!,
        identity: ["identity", "submission-key", "forged"],
      };
    if (change === "wrong-role")
      Object.assign(decisions[2]!.slot, { relation: "human-default" });
    if (change === "extra-path")
      decisions.push({
        slot: { kind: "path", index: 4 },
        raw: f.raw,
        identity: registry.entities[0]!.identity,
      });
    if (change === "source")
      registry.replay!.replacement!.source = "another-definition";
    if (change === "entity-kind")
      registry.replay!.key!.identity = [
        "identity",
        "human",
        registry.replay!.key!.identity[2],
      ];
    if (change === "missing-member") Object.assign(registry, { replay: null });
    if (change === "cloned-run")
      registry.replay!.candidate.run = structuredClone(f.run);
    const map = new Map(registry.requestDecisions);
    map.set(f.run.sequence, decisions);
    if (change === "prepare") {
      map.delete(f.run.sequence);
      map.set(f.prepare.sequence, decisions);
    }
    const result = projectIdentityNetwork(f.network, f.appBase, {
      ...registry,
      requestDecisions: map,
    });
    const literal = projectNetwork(f.network, f.appBase);
    expect(result.observationErrors.length).toBeGreaterThan(0);
    expect(result.requests).toEqual(literal.requests);
    expect(result.requestBodies).toEqual(literal.requestBodies);
    expect(result.requestFacts).toEqual(literal.requestFacts);
  });
  it.each(["replacement", "key"] as const)(
    "rejects missing %s entity even when its decisions were removed",
    (role) => {
      const f = replayRegistryFixture(),
        registry = buildIdentityRegistry(f);
      expect(registry.errors).toEqual([]);
      registry.replay![role] = null;
      const decisions = new Map(registry.requestDecisions);
      decisions.set(
        f.run.sequence,
        registry.requestDecisions
          .get(f.run.sequence)!
          .filter((decision) =>
            role === "replacement"
              ? decision.slot.kind !== "body"
              : decision.slot.kind !== "header",
          ),
      );
      const result = projectIdentityNetwork(f.network, f.appBase, {
        ...registry,
        requestDecisions: decisions,
      });
      const literal = projectNetwork(f.network, f.appBase);
      expect(result.observationErrors).toContain(
        "identity projection: inconsistent replay request/source membership",
      );
      expect(result.requests).toEqual(literal.requests);
      expect(result.requestBodies).toEqual(literal.requestBodies);
      expect(result.requestFacts).toEqual(literal.requestFacts);
    },
  );
  it("validates pair membership even when React regenerate has no decisions", () => {
    const f = replayRegistryFixture("regenerate", false),
      registry = buildIdentityRegistry(f);
    expect(registry.requestDecisions.size).toBe(0);
    registry.replay!.candidate.prepare = structuredClone(f.prepare);
    expect(
      projectIdentityNetwork(f.network, f.appBase, registry).observationErrors
        .length,
    ).toBeGreaterThan(0);
  });
});
