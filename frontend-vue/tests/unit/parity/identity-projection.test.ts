import { describe, expect, it } from "vitest";
import { projectNetwork } from "../../e2e-parity/support/capture-network";
import {
  buildIdentityRegistry,
  type IdentityNode,
} from "../../e2e-parity/support/identity-registry";
import { projectIdentityNetwork } from "../../e2e-parity/support/identity-projection";
import { fixture, literalFixture, packet } from "./identity-fixtures";

function project(input: ReturnType<typeof fixture>) {
  return projectIdentityNetwork(
    input.network,
    input.appBase,
    buildIdentityRegistry(input),
  );
}
function rename(input: ReturnType<typeof fixture>, raw: string) {
  for (const receipt of input.identity.receipts)
    if (receipt.packet?.values.raw === input.raw)
      receipt.packet.values.raw = raw;
  input.network.requests[0]!.url = `${input.appBase}/api/threads/${encodeURIComponent(raw)}/uploads/limits`;
  input.raw = raw;
}
describe("identity projection from one admitted Request fact", () => {
  it("equates different raw initial IDs through their independent semantic slot", () => {
    const react = fixture();
    const vue = fixture(true);
    rename(vue, "other-native-thread");
    expect(projectNetwork(react.network, react.appBase)).not.toEqual(
      projectNetwork(vue.network, vue.appBase),
    );
    expect(project(react)).toEqual(project(vue));
    const fact = JSON.parse(project(react).requestFacts[0]!);
    expect(fact.url.path[3][0]).toBe("identity");
    expect(fact.url.path[3][1]).toBe("thread");
  });
  it("projects all three views from the same correlated fact without changing raw input", () => {
    const input = fixture();
    const row = input.network.requests[0]!;
    row.bodyBase64 = Buffer.from('{"id":"actual-random-thread"}').toString(
      "base64",
    );
    row.headers["content-type"] = "application/json";
    const before = JSON.stringify(input);
    const output = project(input);
    const fact = JSON.parse(output.requestFacts[0]!);
    expect(output.requests).toEqual([JSON.stringify([fact.method, fact.url])]);
    expect(output.requestBodies).toEqual([
      { key: output.requests[0], body: JSON.stringify(fact.body) },
    ]);
    expect(fact.url.path[3][0]).toBe("identity");
    expect(fact.body).toEqual([
      "json",
      ["object", [["id", ["string", input.raw]]]],
    ]);
    expect(JSON.stringify(input)).toBe(before);
  });
  it("rejects a registry from another capture even with identical bytes", () => {
    const input = fixture();
    const other = structuredClone(input.network);
    const result = projectIdentityNetwork(
      other,
      input.appBase,
      buildIdentityRegistry(input),
    );
    expect(result.observationErrors).toContain(
      "identity projection: network snapshot mismatch",
    );
    expect(result.requestFacts).toEqual(
      projectNetwork(other, input.appBase).requestFacts,
    );
  });
  it("rejects a changed app origin", () => {
    const input = fixture();
    const result = projectIdentityNetwork(
      input.network,
      "https://different.test",
      buildIdentityRegistry(input),
    );
    expect(result.observationErrors).toContain(
      "identity projection: app origin mismatch",
    );
    expect(JSON.parse(result.requestFacts[0]!).url.origin[0]).toBe("external");
  });
  it("accepts different base paths on the same origin", () => {
    const input = fixture();
    expect(
      projectIdentityNetwork(
        input.network,
        `${input.appBase}/workspace`,
        buildIdentityRegistry(input),
      ),
    ).toEqual(project(input));
  });
  it.each(["body", "query", "response", "errors"])(
    "rejects post-registry %s mutation",
    (field) => {
      const input = fixture();
      const registry = buildIdentityRegistry(input);
      const row = input.network.requests[0]!;
      if (field === "body") row.bodyBase64 = "AA==";
      if (field === "query") row.url += "?changed=true";
      if (field === "response") row.response!.status = 500;
      if (field === "errors") input.network.errors.push("late network failure");
      const output = projectIdentityNetwork(
        input.network,
        input.appBase,
        registry,
      );
      expect(output.observationErrors).toContain(
        "identity projection: network snapshot changed",
      );
      expect(output.requestFacts).toEqual(
        projectNetwork(input.network, input.appBase).requestFacts,
      );
    },
  );
  it("preserves rejected facts and makes registry errors visible to the existing verdict", () => {
    const input = fixture();
    packet(input, "uploads.limits").values.state = "retired";
    const registry = buildIdentityRegistry(input);
    expect(registry.errors.length).toBeGreaterThan(0);
    const output = projectIdentityNetwork(
      input.network,
      input.appBase,
      registry,
    );
    expect(output.observationErrors).toEqual(
      registry.errors.map((e) => `identity registry: ${e}`),
    );
    expect(output.requestFacts).toEqual(
      projectNetwork(input.network, input.appBase).requestFacts,
    );
  });
  it("keeps a declared persisted fixture fully literal", () => {
    const input = literalFixture();
    expect(project(input)).toEqual(
      projectNetwork(input.network, input.appBase),
    );
  });
  it.each(["raw", "slot", "duplicate-slot", "missing-request"])(
    "rejects an inconsistent %s decision without partial substitutions",
    (change) => {
      const input = fixture();
      const registry = buildIdentityRegistry(input);
      const decision = registry.requestDecisions.get(0)![0]!;
      const decisions = new Map(registry.requestDecisions);
      if (change === "raw") decisions.set(0, [{ ...decision, raw: "wrong" }]);
      if (change === "slot")
        decisions.set(0, [{ ...decision, slot: { kind: "path", index: 2 } }]);
      if (change === "duplicate-slot") decisions.set(0, [decision, decision]);
      if (change === "missing-request") decisions.set(999, [decision]);
      const output = projectIdentityNetwork(input.network, input.appBase, {
        ...registry,
        requestDecisions: decisions,
      });
      expect(output.observationErrors.length).toBeGreaterThan(0);
      expect(output.requestFacts).toEqual(
        projectNetwork(input.network, input.appBase).requestFacts,
      );
    },
  );
  it("keeps absent body distinct from zero exposed bytes", () => {
    const absent = fixture();
    const empty = fixture();
    empty.network.requests[0]!.bodyBase64 = "";
    expect(project(absent).requestBodies).toEqual([]);
    expect(project(empty).requestBodies).toHaveLength(1);
    expect(project(absent).requestFacts).not.toEqual(
      project(empty).requestFacts,
    );
  });
  it.each(["semantic", "tag", "length", "empty", "literal-entity"])(
    "rejects a decision with an unproved %s identity",
    (change) => {
      const input = fixture();
      const registry = buildIdentityRegistry(input);
      const decision = registry.requestDecisions.get(0)![0]!;
      const node: unknown[] = [...decision.identity];
      if (change === "semantic") node[2] = "another-semantic";
      if (change === "tag") node[0] = "user-literal";
      if (change === "length") node.push("extra");
      const changed = {
        ...registry,
        entities:
          change === "literal-entity"
            ? registry.entities.map((entity) => ({ ...entity, literal: true }))
            : registry.entities,
        requestDecisions: new Map([
          [
            0,
            change === "empty"
              ? []
              : [{ ...decision, identity: node as unknown as IdentityNode }],
          ],
        ]),
      };
      const output = projectIdentityNetwork(
        input.network,
        input.appBase,
        changed,
      );
      expect(output.observationErrors.length).toBeGreaterThan(0);
      expect(output.requestFacts).toEqual(
        projectNetwork(input.network, input.appBase).requestFacts,
      );
    },
  );
  it("rolls back a valid first request when a later request has a wrong semantic identity", () => {
    const input = fixture();
    input.network.requests.push({
      ...structuredClone(input.network.requests[0]!),
      sequence: 1,
    });
    input.event("uploads.limits", {
      ...packet(input, "uploads.limits").values,
    });
    const registry = buildIdentityRegistry(input);
    expect(registry.errors).toEqual([]);
    const decisions = new Map(registry.requestDecisions);
    decisions.set(1, [
      { ...decisions.get(1)![0]!, identity: ["identity", "thread", "wrong"] },
    ]);
    const output = projectIdentityNetwork(input.network, input.appBase, {
      ...registry,
      requestDecisions: decisions,
    });
    expect(output.observationErrors.length).toBeGreaterThan(0);
    expect(output.requestFacts).toEqual(
      projectNetwork(input.network, input.appBase).requestFacts,
    );
  });
  it("keeps a literal token-looking value distinct from an admitted identity node", () => {
    const first = fixture();
    const entity = buildIdentityRegistry(first).entities[0]!;
    const literal = literalFixture();
    rename(literal, JSON.stringify(entity.identity));
    literal.expectations.threads[0]!.source = {
      kind: "literal",
      raw: literal.raw,
      draft: false,
      mock: false,
    };
    expect(project(literal).observationErrors).toEqual([]);
    expect(project(first).requestFacts).not.toEqual(
      project(literal).requestFacts,
    );
    expect(
      typeof JSON.parse(project(literal).requestFacts[0]!).url.path[3],
    ).toBe("string");
  });
  it("preserves query spelling, duplicate order and all non-path request relations", () => {
    const input = fixture();
    const row = input.network.requests[0]!;
    row.url += "?x=a%26b%3Dc&x=b&nonce=actual-random-thread";
    row.headers["idempotency-key"] = input.raw;
    row.headers["last-event-id"] = input.raw;
    row.response!.headers["content-location"] = `../${input.raw}?`;
    row.finished = false;
    row.failure = { errorText: input.raw };
    const result = JSON.parse(project(input).requestFacts[0]!);
    const raw = JSON.parse(
      projectNetwork(input.network, input.appBase).requestFacts[0]!,
    );
    expect(result.url.path[3][0]).toBe("identity");
    result.url.path[3] = raw.url.path[3];
    expect(result).toEqual(raw);
  });
  it.each(["unknown", "external", "method", "noncanonical"])(
    "does not broaden admission to %s requests",
    (change) => {
      const input = fixture();
      const row = structuredClone(input.network.requests[0]!);
      row.sequence = 1;
      if (change === "unknown") row.url += "/extra";
      if (change === "external")
        row.url = row.url.replace(input.appBase, "https://other.test");
      if (change === "method") row.method = "POST";
      if (change === "noncanonical")
        row.url = row.url.replace(input.raw, "%61ctual-random-thread");
      input.network.requests.push(row);
      const output = project(input);
      const raw = projectNetwork(input.network, input.appBase);
      expect(output.requestFacts[1]).toBe(raw.requestFacts[1]);
      if (change !== "noncanonical") {
        expect(output.observationErrors).toEqual([]);
        expect(JSON.parse(output.requestFacts[0]!).url.path[3][0]).toBe(
          "identity",
        );
      } else expect(output.observationErrors.length).toBeGreaterThan(0);
    },
  );
  it("retains request multiplicity, body/header pairing and failure state", () => {
    const input = fixture();
    const raw = input.network.requests[0]!;
    input.network.requests = ["A", "A", "B"].map((body, sequence) => ({
      ...structuredClone(raw),
      sequence,
      bodyBase64: Buffer.from(body).toString("base64"),
      headers: {
        ...raw.headers,
        "idempotency-key": sequence === 2 ? "Y" : "X",
      },
    }));
    for (let index = 0; index < 2; index++)
      input.event("uploads.limits", {
        ...packet(input, "uploads.limits").values,
      });
    const result = project(input);
    expect(result.observationErrors).toEqual([]);
    expect(result.requests).toHaveLength(3);
    expect(result.requestFacts).toHaveLength(3);
    expect(result.requestFacts[0]).toBe(result.requestFacts[1]);
    expect(result.requestFacts[2]).not.toBe(result.requestFacts[0]);
    const swapped = fixture();
    swapped.network = structuredClone(input.network);
    swapped.identity = structuredClone(input.identity);
    swapped.network.requests[1]!.headers["idempotency-key"] = "Y";
    swapped.network.requests[2]!.headers["idempotency-key"] = "X";
    expect(result.requestFacts.slice().sort()).not.toEqual(
      project(swapped).requestFacts.slice().sort(),
    );
  });
});
