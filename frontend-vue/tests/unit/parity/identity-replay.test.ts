import { describe, expect, it } from "vitest";
import { buildIdentityRegistry } from "../../e2e-parity/support/identity-registry";
import { projectIdentityNetwork } from "../../e2e-parity/support/identity-projection";
import { projectNetwork } from "../../e2e-parity/support/capture-network";
import { replayRegistryFixture } from "./identity-replay-fixtures";

const rejects = (f: ReturnType<typeof replayRegistryFixture>) => {
  const result = buildIdentityRegistry(f);
  expect(result.errors.length).toBeGreaterThan(0);
  expect(result.replayCandidate).toBeNull();
  expect(result.requestDecisions.size).toBe(0);
  const projection = projectIdentityNetwork(f.network, f.appBase, result);
  expect(projection.requestFacts).toEqual(
    projectNetwork(f.network, f.appBase).requestFacts,
  );
};
describe("bounded persisted replay source-to-request consistency", () => {
  it.each([NaN, Infinity, -Infinity, 200.5, "200", null])(
    "rejects a noninteger HTTP status %s rather than coercing it",
    (status) => {
      const f = replayRegistryFixture();
      Object.assign(f.prepare.response!, { status });
      rejects(f);
    },
  );
  it("does not let a later thread selection claim an earlier replay origin", () => {
    const f = replayRegistryFixture();
    for (const row of f.identity.receipts)
      if (row.packet?.producer === "replay") row.packet.at = 1000;
    rejects(f);
  });
  it.each(["edit", "regenerate"] as const)(
    "checks %s on both key policies before exact generated-slot projection",
    (kind) => {
      for (const vue of [false, true]) {
        const f = replayRegistryFixture(kind, vue),
          result = buildIdentityRegistry(f);
        expect(result.errors).toEqual([]);
        expect(result.replayCandidate?.run).toBe(f.run);
        expect(result.replayCandidate?.prepare).toBe(f.prepare);
        expect(result.requestDecisions.size).toBe(
          kind === "edit" || vue ? 1 : 0,
        );
        expect(
          projectIdentityNetwork(f.network, f.appBase, result).requests,
        ).toEqual(projectNetwork(f.network, f.appBase).requests);
      }
    },
  );
  it("allows actual SDK finish before HTTP starts, and does not claim HTTP success", () => {
    const f = replayRegistryFixture("regenerate", false);
    const result = buildIdentityRegistry(f);
    expect(result.errors).toEqual([]);
    expect(result.replayCandidate!.source.finish!.dispatchedAt).toBeLessThan(
      f.run.startedAt!,
    );
    f.run.response = {
      status: 500,
      headers: { "content-type": "application/json", "content-location": null },
    };
    expect(buildIdentityRegistry(f).errors).toEqual([]);
  });
  it("retains open and failed submitted requests rather than dropping them", () => {
    const f = replayRegistryFixture();
    f.identity.receipts = f.identity.receipts.filter(
      (r) => r.packet?.event !== "replay.finish",
    );
    f.run.finished = false;
    expect(buildIdentityRegistry(f).errors).toEqual([]);
    f.run.response = null;
    f.run.failure = { errorText: "cancelled" };
    expect(buildIdentityRegistry(f).replayCandidate?.run.failure).toEqual({
      errorText: "cancelled",
    });
  });
  it.each(["undeclared", "account", "stable", "draft", "mock", "thread-slot"])(
    "refuses unsupported scope %s",
    (change) => {
      const f = replayRegistryFixture();
      const expected = f.expectations.replay!;
      if (change === "undeclared") delete f.expectations.replay;
      if (change === "account") expected.account = "other-account";
      if (change === "stable")
        Object.assign(expected, { stableAccount: false });
      if (change === "thread-slot") expected.threadSlot = "other";
      const source = f.expectations.threads[0]!.source;
      if (source.kind === "literal") {
        if (change === "draft") source.draft = true;
        if (change === "mock") source.mock = true;
      }
      rejects(f);
    },
  );
  it.each([
    "extra-prepare",
    "extra-run",
    "wrong-method",
    "wrong-thread",
    "query",
    "missing-prepare",
    "missing-run",
  ])("retains the complete domain and rejects %s", (change) => {
    const f = replayRegistryFixture();
    if (change.startsWith("extra"))
      f.network.requests.push({
        ...structuredClone(change === "extra-prepare" ? f.prepare : f.run),
        sequence: 3,
      });
    if (change === "wrong-method") f.prepare.method = "GET";
    if (change === "wrong-thread")
      f.run.url = f.run.url.replace(f.raw, "unknown");
    if (change === "query") f.prepare.url += "?";
    if (change === "missing-prepare") f.network.requests.splice(1, 1);
    if (change === "missing-run") f.network.requests.pop();
    rejects(f);
  });
  it.each([
    "prepare-failed",
    "prepare-aborted",
    "prepare-open",
    "frame",
    "navigation",
    "prepare-before-begin",
    "prepare-after-response",
    "prepare-during-response",
    "run-before-submit",
    "no-time",
    "future-selection",
  ])("rejects absent or contradictory HTTP proof %s", (change) => {
    const f = replayRegistryFixture();
    if (change === "prepare-failed") f.prepare.response!.status = 500;
    if (change === "prepare-aborted")
      f.prepare.failure = { errorText: "aborted" };
    if (change === "prepare-open") f.prepare.response = null;
    if (change === "frame") f.run.source = "service-worker";
    if (change === "navigation") f.prepare.navigation = true;
    if (change === "prepare-before-begin") f.prepare.startedAt = 2000;
    if (change === "prepare-after-response") f.prepare.startedAt = 2199;
    if (change === "prepare-during-response") f.prepare.startedAt = 2105;
    if (change === "run-before-submit") f.run.startedAt = 2100;
    if (change === "no-time") f.run.startedAt = null;
    if (change === "future-selection")
      f.identity.receipts.find(
        (r) => r.packet?.event === "thread.select",
      )!.dispatchedAt = 3000;
    rejects(f);
  });
  it.each([
    "source-human",
    "replacement-text",
    "prepare-extra",
    "metadata-run",
    "metadata-human",
    "metadata-checkpoint",
    "top-checkpoint",
    "assistant",
    "agent",
    "context-thread",
    "input-id",
    "input-role",
    "input-extra",
    "key",
    "prepare-key",
    "body-json",
  ])("rejects wrong adopted wire %s", (change) => {
    const f = replayRegistryFixture();
    if (change === "source-human") f.prepareBody.human_message_id = "other";
    if (change === "replacement-text")
      f.prepareBody.replacement_text = "different";
    if (change === "prepare-extra")
      Object.assign(f.prepareBody, { ignored_id: "source-human" });
    if (change === "metadata-run")
      f.body.metadata.regenerate_from_run_id = "new-run";
    if (change === "metadata-human")
      f.body.metadata.edit_message_id = "source-human";
    if (change === "metadata-checkpoint")
      f.body.metadata.regenerate_checkpoint_id = "wrong";
    if (change === "top-checkpoint") f.body.checkpoint.checkpoint_id = "wrong";
    if (change === "assistant") f.body.assistant_id = "other";
    if (change === "agent") f.body.context.agent_name = "other";
    if (change === "context-thread") f.body.context.thread_id = f.raw;
    if (change === "input-id") f.body.input.messages[0]!.id = "source-human";
    if (change === "input-role")
      Object.assign(f.body.input.messages[0]!, { role: "user" });
    if (change === "input-extra")
      f.body.input.messages.push({ ...f.body.input.messages[0]! });
    if (change === "key")
      f.run.headers["idempotency-key"] = "new-replacement-human";
    if (change === "prepare-key")
      f.prepare.headers["idempotency-key"] = "independent-submission-key";
    f.update();
    if (change === "body-json")
      f.run.bodyBase64 = Buffer.from('{"input":{},"input":{}}').toString(
        "base64",
      );
    rejects(f);
  });
  it("keeps new Content-Location and nonidentity body leaves literal", () => {
    const f = replayRegistryFixture();
    f.body.metadata.literal_example = "new-replacement-human";
    f.update();
    const result = buildIdentityRegistry(f);
    expect(result.errors).toEqual([]);
    const actual = projectIdentityNetwork(f.network, f.appBase, result);
    expect(actual.requests).toEqual(
      projectNetwork(f.network, f.appBase).requests,
    );
    expect(actual.requestFacts[2]).toContain("new-run");
  });
  it("does not use a valid slot to guess ownership of a mixed same-thread ordinary send", () => {
    const f = replayRegistryFixture();
    f.expectations.humans = [
      {
        slot: "ordinary",
        threadSlot: "initial-entry",
        assistant: "lead_agent",
        source: { producer: "human:send", actions: ["submit-replay"] },
        submission: {
          slot: "send",
          actions: ["submit-replay"],
          keySource: "none",
        },
      },
    ];
    rejects(f);
  });
});
