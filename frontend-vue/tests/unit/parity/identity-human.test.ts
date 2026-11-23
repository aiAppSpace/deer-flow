import { expect, it, describe } from "vitest";
import { buildIdentityRegistry } from "../../e2e-parity/support/identity-registry";
import { humanFixture } from "./identity-human-fixtures";

const rejects = (input: ReturnType<typeof humanFixture>) => {
  const result = buildIdentityRegistry(input);
  expect(result.errors.length).toBeGreaterThan(0);
  expect(result.requestDecisions.size).toBe(0);
};
describe("single ordinary human source and exact request admission", () => {
  it.each(["method", "query", "prepare", "unknown-thread"])(
    "rejects an extra %s candidate instead of admitting the one good send",
    (change) => {
      const input = humanFixture();
      const extra = structuredClone(input.request);
      extra.sequence = 2;
      if (change === "method") extra.method = "GET";
      if (change === "query") extra.url += "?";
      if (change === "prepare")
        extra.url = `${input.appBase}/api/threads/${input.raw}/runs/edit-regenerate/prepare`;
      if (change === "unknown-thread")
        extra.url = extra.url.replace(input.raw, "other-thread");
      input.network.requests.push(extra);
      rejects(input);
    },
  );
  it.each([false, true])(
    "admits actual source branches without merging source/send actions (vue=%s)",
    (vue) => {
      const input = humanFixture(vue);
      const result = buildIdentityRegistry(input);
      expect(result.errors).toEqual([]);
      expect(result.humans).toHaveLength(1);
      expect(result.humans[0]!.raw).toBe(input.human);
      const decisions = result.requestDecisions.get(1)!;
      expect(decisions.filter((d) => d.slot.kind === "body")).toHaveLength(1);
      expect(decisions.filter((d) => d.slot.kind === "header")).toHaveLength(
        vue ? 1 : 0,
      );
      expect(decisions.filter((d) => d.slot.kind === "path")).toHaveLength(1);
    },
  );
  it.each(["caller-key", "source-human-id", ""])(
    "keeps explicit %s literal even if equal to the human",
    (key) => {
      const input = humanFixture(true, "explicit", key);
      const result = buildIdentityRegistry(input);
      expect(result.errors).toEqual([]);
      expect(
        result.requestDecisions.get(1)!.some((d) => d.slot.kind === "header"),
      ).toBe(false);
    },
  );
  it("does not use allocation/source/send action text as the cross-app semantic identity", () => {
    const a = buildIdentityRegistry(humanFixture(false));
    const b = buildIdentityRegistry(humanFixture(true));
    expect(a.errors).toEqual([]);
    expect(b.errors).toEqual([]);
    expect(a.humans[0]!.identity).toEqual(b.humans[0]!.identity);
  });
  it.each([
    "index",
    "messageCount",
    "raw",
    "thread",
    "key",
    "keySource",
  ] as const)("rejects contradictory submission %s", (field) => {
    const input = humanFixture(true);
    input.submission.values[field] = "wrong";
    rejects(input);
  });
  it.each([
    "type",
    "id",
    "assistant",
    "agent",
    "empty",
    "invisible",
    "malformed",
  ])("rejects wrong or unavailable request %s", (change) => {
    const input = humanFixture();
    if (change === "type") input.body.input.messages[0]!.type = "ai";
    if (change === "id") input.body.input.messages[0]!.id = "different";
    if (change === "assistant") input.body.assistant_id = "wrong";
    if (change === "agent") input.body.context.agent_name = "other";
    if (change === "empty") input.body.input.messages = [];
    input.updateBody();
    if (change === "invisible") input.request.bodyBase64 = null;
    if (change === "malformed")
      input.request.bodyBase64 = Buffer.from("{").toString("base64");
    rejects(input);
  });
  it.each(["source-owner", "thread-source", "future", "duplicate", "missing"])(
    "rejects %s allocation provenance",
    (change) => {
      const input = humanFixture(true);
      const source = input.identity.receipts.find(
        (r) => r.packet?.event === "human.allocate",
      )!;
      if (change === "source-owner") source.packet!.producer = "memory:import";
      if (change === "thread-source")
        source.packet!.values.thread = "another-thread";
      if (change === "future") source.sequence = 10000;
      if (change === "duplicate")
        input.emit(
          "human.allocate",
          { raw: input.human, thread: input.raw },
          "human:composer",
          9,
          "compose",
        );
      if (change === "missing")
        input.identity.receipts.splice(
          input.identity.receipts.indexOf(source),
          1,
        );
      rejects(input);
    },
  );
  it.each([
    "missing",
    "duplicate",
    "other-instance",
    "other-origin",
    "unexpected-key",
  ])("rejects %s submission", (change) => {
    const input = humanFixture();
    if (change === "missing")
      input.identity.receipts.splice(
        input.identity.receipts.findIndex((r) => r.packet === input.submission),
        1,
      );
    if (change === "duplicate")
      input.emit("human.submission", { ...input.submission.values });
    if (change === "other-instance") input.submission.instance = 99;
    if (change === "other-origin") input.submission.at = 1999;
    if (change === "unexpected-key")
      input.request.headers["idempotency-key"] = input.human;
    rejects(input);
  });
  it.each([
    "missing",
    "duplicate",
    "child",
    "worker",
    "unknown",
    "navigation",
    "noncanonical",
    "early",
    "no-time",
  ])("does not authorize %s network evidence", (change) => {
    const input = humanFixture();
    if (change === "missing") input.network.requests.pop();
    if (change === "duplicate")
      input.network.requests.push({ ...input.request, sequence: 2 });
    if (change === "child") input.request.source = "child-frame";
    if (change === "worker") input.request.source = "service-worker";
    if (change === "unknown") input.request.source = "unknown";
    if (change === "navigation") input.request.navigation = true;
    if (change === "noncanonical")
      input.request.url = input.request.url.replace(
        input.raw,
        "%61ctual-random-thread",
      );
    if (change === "early") input.request.startedAt = 1700;
    if (change === "no-time") input.request.startedAt = null;
    rejects(input);
  });
  it("does not mint a human over an already claimed thread raw", () => {
    const input = humanFixture();
    for (const r of input.identity.receipts)
      if (r.packet?.event.startsWith("human.")) r.packet.values.raw = input.raw;
    input.body.input.messages[0]!.id = input.raw;
    input.updateBody();
    rejects(input);
  });
  it("retains a failed HTTP result while admitting only identity provenance", () => {
    const input = humanFixture();
    input.request.response = {
      status: 500,
      headers: { "content-type": "application/json", "content-location": null },
    };
    expect(buildIdentityRegistry(input).errors).toEqual([]);
  });
  it("admits the Vue direct-send allocation branch without inventing a composer", () => {
    const input = humanFixture(false, "default");
    expect(buildIdentityRegistry(input).errors).toEqual([]);
  });
  it.each(["steps:1", "steps:2", "steps:0", "steps:3"])(
    "checks the independent asynchronous send phases: %s",
    (phase) => {
      const input = humanFixture(true);
      input.expectations.humans![0]!.source.actions = ["steps:1"];
      input.expectations.humans![0]!.submission.actions = [
        "steps:1",
        "steps:2",
      ];
      for (const row of input.identity.receipts) {
        if (row.packet?.producer === "human:composer")
          row.packet.action = "steps:1";
        if (row.packet?.producer === "human:send") row.packet.action = phase;
      }
      if (phase === "steps:1" || phase === "steps:2")
        expect(buildIdentityRegistry(input).errors).toEqual([]);
      else rejects(input);
    },
  );
  it.each(["default", "explicit"] as const)(
    "rejects a present empty header under %s source",
    (branch) => {
      const input = humanFixture(true, branch, "");
      input.request.headers["idempotency-key"] = "";
      rejects(input);
    },
  );
  it.each([
    "source-action",
    "send-action",
    "number-index",
    "count",
    "duplicate-key",
    "non-json",
    "method",
    "origin",
    "route",
  ])("keeps %s contradictions unresolved", (change) => {
    const input = humanFixture(true);
    if (change === "source-action")
      input.identity.receipts.find(
        (r) => r.packet?.event === "human.allocate",
      )!.packet!.action = "another-action";
    if (change === "send-action") input.submission.action = "another-action";
    if (change === "number-index") input.submission.values.index = "0";
    if (change === "count") input.submission.values.messageCount = 2;
    if (change === "duplicate-key")
      input.request.bodyBase64 = Buffer.from(
        JSON.stringify(input.body).replace(
          '"id":"source-human-id"',
          '"id":"source-human-id","id":"source-human-id"',
        ),
      ).toString("base64");
    if (change === "non-json")
      input.request.headers["content-type"] = "text/plain";
    if (change === "method") input.request.method = "GET";
    if (change === "origin")
      input.request.url = input.request.url.replace(
        "https://app.test",
        "https://other.test",
      );
    if (change === "route") input.request.url += "/extra";
    rejects(input);
  });
  it("does not use an origin timestamp or late Node receipt as HTTP timing", () => {
    const input = humanFixture();
    input.request.startedAt = 1910;
    const submission = input.identity.receipts.find(
      (r) => r.packet === input.submission,
    )!;
    submission.dispatchedAt = 1950;
    input.request.observedAt = 10000;
    rejects(input);
  });
  it.each([false, true])(
    "checks actual retirement against request start (retired before=%s)",
    (before) => {
      const input = humanFixture();
      input.emit(
        "lease.retire",
        { lease: 2, epoch: 1 },
        "thread:main",
        1,
        "retire",
        before ? 2100 : 2300,
      );
      input.emit(
        "thread.retire",
        { raw: input.raw, account: input.scope.account, agent: null },
        "thread:main",
        1,
        "retire",
        before ? 2110 : 2310,
      );
      if (before) rejects(input);
      else expect(buildIdentityRegistry(input).errors).toEqual([]);
    },
  );
  it("does not authorize events dispatched after their selected owner retired", () => {
    const input = humanFixture();
    input.emit(
      "lease.retire",
      { lease: 2, epoch: 1 },
      "thread:main",
      1,
      "retire",
      2050,
    );
    input.emit(
      "thread.retire",
      { raw: input.raw, account: input.scope.account, agent: null },
      "thread:main",
      1,
      "retire",
      2060,
    );
    input.identity.receipts.find(
      (r) => r.packet === input.submission,
    )!.sequence = 1000;
    rejects(input);
  });
  it("rejects an extra explicit attempt even when it has the same default wire key", () => {
    const input = humanFixture(true);
    input.emit(
      "human.reuse",
      { raw: input.human, thread: input.raw },
      "human:send",
      5,
    );
    input.emit(
      "human.submission",
      { ...input.submission.values, keySource: "explicit" },
      "human:send",
      5,
    );
    rejects(input);
  });
  it("does not discard an extra bad request to make a good one unique", () => {
    const input = humanFixture(true);
    input.network.requests.push({
      ...input.request,
      sequence: 2,
      bodyBase64: null,
      headers: { ...input.request.headers, "idempotency-key": "bad" },
    });
    rejects(input);
  });
  it.each(["missing", "duplicate", "unknown-thread", "unknown-key"])(
    "rejects %s independent declaration",
    (change) => {
      const input = humanFixture();
      if (change === "missing") input.expectations.humans = [];
      if (change === "duplicate")
        input.expectations.humans = [
          ...input.expectations.humans!,
          input.expectations.humans![0]!,
        ];
      if (change === "unknown-thread")
        input.expectations.humans![0]!.threadSlot = "another-thread-slot";
      if (change === "unknown-key")
        Object.assign(input.expectations.humans![0]!.submission, {
          keySource: "guessed",
        });
      rejects(input);
    },
  );
});
