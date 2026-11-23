import { describe, expect, it } from "vitest";
import {
  projectNetwork,
  projectRequest,
} from "../../e2e-parity/support/capture-network";
import {
  buildIdentityRegistry,
  type RequestIdentityDecision,
} from "../../e2e-parity/support/identity-registry";
import { projectIdentityNetwork } from "../../e2e-parity/support/identity-projection";
import { humanFixture } from "./identity-human-fixtures";

const project = (input: ReturnType<typeof humanFixture>) =>
  projectIdentityNetwork(
    input.network,
    input.appBase,
    buildIdentityRegistry(input),
  );
const node = (value: unknown, path: readonly (string | number)[]): unknown => {
  if (!path.length) return value;
  const [key, ...rest] = path;
  if (!Array.isArray(value)) return undefined;
  if (value[0] === "object" && typeof key === "string") {
    const entry = (value[1] as [string, unknown][]).find(
      ([name]) => name === key,
    );
    return node(entry?.[1], rest);
  }
  if (value[0] === "array" && typeof key === "number")
    return node((value[1] as unknown[])[key], rest);
};
describe("exact human body and default key projection", () => {
  it.each([false, true])(
    "projects only the proved leaf and preserves the raw capture (vue=%s)",
    (vue) => {
      const input = humanFixture(vue);
      const before = JSON.stringify(input);
      const registry = buildIdentityRegistry(input);
      expect(registry.errors).toEqual([]);
      const result = projectIdentityNetwork(
        input.network,
        input.appBase,
        registry,
      );
      expect(result.observationErrors).toEqual([]);
      const fact = JSON.parse(result.requestFacts[1]!);
      expect(node(fact.body[1], ["input", "messages", 0, "id"])).toEqual(
        registry.humans[0]!.identity,
      );
      expect(node(fact.body[1], ["input", "messages", 0, "content"])).toEqual([
        "string",
        input.human,
      ]);
      expect(
        node(fact.body[1], [
          "input",
          "messages",
          0,
          "additional_kwargs",
          "same",
        ]),
      ).toEqual(["string", input.human]);
      expect(fact.url.path[4]).toEqual(registry.entities[0]!.identity);
      expect(fact.headers["idempotency-key"]).toEqual(
        vue ? registry.humans[0]!.identity : null,
      );
      expect(fact.response).toEqual(input.request.response);
      expect(result.requestBodies[0]).toEqual({
        key: result.requests[1],
        body: JSON.stringify(fact.body),
      });
      expect(JSON.stringify(input)).toBe(before);
    },
  );
  it.each(["caller-key", "source-human-id", ""])(
    "keeps explicit key %s literal",
    (key) => {
      const input = humanFixture(true, "explicit", key);
      const result = project(input);
      expect(result.observationErrors).toEqual([]);
      expect(
        JSON.parse(result.requestFacts[1]!).headers["idempotency-key"],
      ).toBe(key || null);
    },
  );
  it("preserves a preceding human with the same raw, response failure and exact numeric spelling", () => {
    const input = humanFixture(true);
    input.body.input.messages.unshift({ ...input.body.input.messages[0]! });
    input.submission.values.index = 1;
    input.submission.values.messageCount = 2;
    input.updateBody();
    input.request.bodyBase64 = Buffer.from(
      Buffer.from(input.request.bodyBase64!, "base64")
        .toString()
        .replace('"context":{}', '"context":{"number":1.00e+2}'),
    ).toString("base64");
    input.request.response!.status = 503;
    input.request.finished = false;
    input.request.failure = { errorText: "connection closed" };
    const result = project(input);
    expect(result.observationErrors).toEqual([]);
    const fact = JSON.parse(result.requestFacts[1]!);
    expect(node(fact.body[1], ["input", "messages", 0, "id"])).toEqual([
      "string",
      input.human,
    ]);
    expect(node(fact.body[1], ["input", "messages", 1, "id"])).toEqual(
      buildIdentityRegistry(input).humans[0]!.identity,
    );
    expect(node(fact.body[1], ["context", "number"])).toEqual([
      "number",
      "1.00e+2",
    ]);
    expect(fact.response.status).toBe(503);
    expect(fact.finished).toBe(false);
    expect(fact.failure).toEqual(input.request.failure);
  });
  it("keeps user marker strings and arrays tagged as literal data", () => {
    const input = humanFixture();
    const identity = buildIdentityRegistry(input).humans[0]!.identity;
    input.body.input.messages[0]!.content = JSON.stringify(identity);
    input.body.context.marker = identity;
    input.updateBody();
    const result = project(input);
    expect(result.observationErrors).toEqual([]);
    const fact = JSON.parse(result.requestFacts[1]!);
    expect(node(fact.body[1], ["context", "marker"])).toEqual([
      "array",
      identity.map((value) => ["string", value]),
    ]);
    expect(node(fact.body[1], ["input", "messages", 0, "content"])).toEqual([
      "string",
      JSON.stringify(identity),
    ]);
  });
  it.each([
    "duplicate",
    "wrong-role",
    "string-index",
    "wrong-path",
    "wrong-kind",
    "wrong-entity",
    "wrong-raw",
    "foreign-sequence",
    "wrong-header-relation",
  ])("rolls back all facts atomically for %s", (change) => {
    const input = humanFixture(true);
    const registry = buildIdentityRegistry(input);
    expect(registry.errors).toEqual([]);
    const map = registry.requestDecisions as Map<
      number,
      RequestIdentityDecision[]
    >;
    const decisions = structuredClone(map.get(1)!);
    const body = decisions.find((decision) => decision.slot.kind === "body")!;
    if (change === "duplicate") decisions.push(structuredClone(body));
    if (change === "wrong-role")
      Object.assign(body.slot, { role: "source-human" });
    if (change === "string-index")
      Object.assign(body.slot, { path: ["input", "messages", "0", "id"] });
    if (change === "wrong-path")
      Object.assign(body.slot, { path: ["input", "messages", 0, "content"] });
    if (change === "wrong-kind") body.identity = registry.entities[0]!.identity;
    if (change === "wrong-entity")
      body.identity = ["identity", "human", "another-business-slot"];
    if (change === "wrong-raw") body.raw = "other-raw";
    if (change === "foreign-sequence") map.set(999, structuredClone(decisions));
    if (change === "wrong-header-relation")
      Object.assign(
        decisions.find((decision) => decision.slot.kind === "header")!.slot,
        { relation: "caller-key" },
      );
    map.set(1, decisions);
    const result = projectIdentityNetwork(
      input.network,
      input.appBase,
      registry,
    );
    expect(result.observationErrors.length).toBeGreaterThan(0);
    const literal = projectNetwork(input.network, input.appBase);
    expect(result.requests).toEqual(literal.requests);
    expect(result.requestBodies).toEqual(literal.requestBodies);
    expect(result.requestFacts).toEqual(literal.requestFacts);
  });
  it("does not promote an explicit same-value header through a forged default decision", () => {
    const input = humanFixture(true, "explicit", "source-human-id");
    const registry = buildIdentityRegistry(input);
    const human = registry.humans[0]!;
    (registry.requestDecisions as Map<number, RequestIdentityDecision[]>)
      .get(1)!
      .push({
        slot: {
          kind: "header",
          name: "idempotency-key",
          relation: "human-default",
        },
        raw: human.raw,
        identity: human.identity,
      });
    const result = projectIdentityNetwork(
      input.network,
      input.appBase,
      registry,
    );
    expect(result.observationErrors.length).toBeGreaterThan(0);
    expect(result.requestFacts).toEqual(
      projectNetwork(input.network, input.appBase).requestFacts,
    );
  });
  it("retains the genuine React absent / Vue default-present difference", () => {
    const a = humanFixture(false),
      b = humanFixture(true);
    const react = project(a),
      vue = project(b);
    expect(react.observationErrors).toEqual([]);
    expect(vue.observationErrors).toEqual([]);
    expect(react.requests).toEqual(vue.requests);
    expect(react.requestBodies).toEqual(vue.requestBodies);
    expect(react.requestFacts).not.toEqual(vue.requestFacts);
    expect(
      projectRequest(a.request, a.appBase).headers["idempotency-key"],
    ).toBeNull();
  });
});
