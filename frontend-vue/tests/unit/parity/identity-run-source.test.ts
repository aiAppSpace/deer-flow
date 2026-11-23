import { describe, expect, it } from "vitest";
import { buildIdentityRegistry } from "../../e2e-parity/support/identity-registry";
import { projectNetwork } from "../../e2e-parity/support/capture-network";
import {
  readRunLocation,
  readRunSources,
  type RunSourceExpectation,
} from "../../e2e-parity/support/identity-run-source";
import { humanFixture } from "./identity-human-fixtures";
import { replayRegistryFixture } from "./identity-replay-fixtures";

const base = "http://127.0.0.1:3440";
describe("public run location source without representation normalization", () => {
  it.each(["", base])(
    "retains exact authority %s and optional trailing separator",
    (authority) => {
      for (const suffix of ["", "/"]) {
        const raw = `${authority}/api/threads/thread-id/runs/non-uuid-run${suffix}`;
        const source = readRunLocation(raw, base)!;
        expect(source).toEqual({
          raw,
          prefix: `${authority}/api/threads/`,
          thread: { raw: "thread-id", encoded: "thread-id" },
          separator: "/runs/",
          run: { raw: "non-uuid-run", encoded: "non-uuid-run" },
          suffix,
        });
        expect(
          source.prefix +
            source.thread.encoded +
            source.separator +
            source.run.encoded +
            source.suffix,
        ).toBe(raw);
      }
    },
  );
  it("decodes once while retaining the original encoded segment", () => {
    const source = readRunLocation(
      "/api/threads/thread/runs/value%2520with%20space",
      base,
    )!;
    expect(source.run).toEqual({
      raw: "value%20with space",
      encoded: "value%2520with%20space",
    });
  });
  it.each([
    null,
    undefined,
    "",
    123,
    "/api/threads/thread/runs/",
    "/api/threads//runs/run",
    "/api/threads/thread/runs/run//",
    "/api/threads/thread/runs/run/stream",
    "/api/langgraph/threads/thread/runs/run",
    "/api/threads/thread/runs/run?",
    "/api/threads/thread/runs/run?cursor=1",
    "/api/threads/thread/runs/run#",
    "/api/threads/thread/runs/.",
    "/api/threads/thread/runs/..",
    "/api/threads/thread/../runs/run",
    "/api/threads/thread/runs/%72un",
    "/api/threads/thread/runs/%2e",
    "/api/threads/thread/runs/%2F",
    "/api/threads/thread/runs/%5C",
    "/api/threads/thread/runs/%00",
    "/api/threads/thread/runs/%ZZ",
    "/api/threads/thread/runs/run, /api/threads/thread/runs/other",
    " /api/threads/thread/runs/run",
    "/api/threads/thread/runs/run\n",
    "/api/threads/thread/runs/run\\x",
    "https://other.example/api/threads/thread/runs/run",
    "//127.0.0.1:3440/api/threads/thread/runs/run",
    "http://user@127.0.0.1:3440/api/threads/thread/runs/run",
    "http://127.0.0.1:03440/api/threads/thread/runs/run",
    "/api/threads/thread/runs/" + "x".repeat(4096),
  ])("refuses an unsupported or ambiguous public location %s", (raw) => {
    expect(readRunLocation(raw, base)).toBeNull();
  });
});

function fixture(kind: "human" | "edit" | "regenerate" = "human", vue = true) {
  const f =
    kind === "human" ? humanFixture(vue) : replayRegistryFixture(kind, vue);
  const row = "request" in f ? f.request : f.run;
  row.response = {
    status: 200,
    headers: {
      "content-type": "text/event-stream",
      "content-location": `/api/threads/${f.raw}/runs/new-run`,
    },
  };
  const registry = buildIdentityRegistry(f);
  expect(registry.errors).toEqual([]);
  const expectation: RunSourceExpectation = {
    slot: "created-run",
    submission:
      kind === "human"
        ? { kind: "human", slot: registry.humans[0]!.expectation.slot }
        : { kind: "replay", slot: registry.replay!.candidate.expectation.slot },
  };
  return {
    f,
    registry,
    row,
    input: {
      appBase: f.appBase,
      network: f.network,
      registry,
      expectations: [expectation],
    },
  };
}
describe("run source bound to an already admitted exact submit", () => {
  it.each(["upstream-error", "snapshot-copy", "origin", "mutated-fingerprint"])(
    "rejects broken source binding: %s",
    (change) => {
      const { input, row } = fixture();
      if (change === "upstream-error")
        input.registry.errors.push("independent account mismatch");
      if (change === "snapshot-copy")
        input.network = structuredClone(input.network);
      if (change === "origin")
        input.registry.sourceOrigin = "https://other.example";
      if (change === "mutated-fingerprint")
        row.headers.accept = "changed-after-admission";
      const result = readRunSources(input);
      expect(result.errors).toContain(
        "run source requires an unchanged error-free registry binding",
      );
      expect(result.candidates).toEqual([]);
    },
  );

  it.each(["human", "edit", "regenerate"] as const)(
    "reads %s source without altering any wire view or requiring SSE finish",
    (kind) => {
      for (const vue of [false, true])
        for (const failure of [null, { errorText: "net::ERR_ABORTED" }]) {
          const { f, row, input } = fixture(kind, vue);
          row.finished = false;
          row.failure = failure;
          input.registry = buildIdentityRegistry(f);
          expect(input.registry.errors).toEqual([]);
          const before = JSON.stringify(f.network),
            views = projectNetwork(f.network, f.appBase);
          const result = readRunSources(input);
          expect(result.errors).toEqual([]);
          expect(result.candidates).toHaveLength(1);
          const candidate = result.candidates[0]!;
          expect(candidate.request).toBe(row);
          expect(candidate.location.run.raw).toBe("new-run");
          expect(candidate.thread.raw).toBe(f.raw);
          expect(candidate.expectation).toBe(input.expectations[0]);
          expect(projectNetwork(f.network, f.appBase)).toEqual(views);
          expect(JSON.stringify(f.network)).toBe(before);
        }
    },
  );
  it.each([
    "missing-owner",
    "wrong-slot",
    "duplicate-owner",
    "duplicate-slot",
    "two-slots-one-request",
    "missing-request",
    "duplicate-sequence",
    "cloned-replay",
  ])("rejects %s instead of selecting from CL equality", (change) => {
    const { input, row } = fixture(
      change === "cloned-replay" ? "edit" : "human",
    );
    if (change === "missing-owner") input.registry.humans = [];
    if (change === "wrong-slot")
      input.expectations[0]!.submission.slot = "other-operation";
    if (change === "duplicate-owner")
      input.registry.humans = [
        ...input.registry.humans,
        ...input.registry.humans,
      ];
    if (change === "duplicate-slot")
      input.expectations.push(structuredClone(input.expectations[0]!));
    if (change === "two-slots-one-request")
      input.expectations.push({
        ...input.expectations[0]!,
        slot: "another-run",
      });
    if (change === "missing-request")
      input.network.requests.splice(input.network.requests.indexOf(row), 1);
    if (change === "duplicate-sequence")
      input.network.requests.push(structuredClone(row));
    if (change === "cloned-replay")
      input.registry.replay!.candidate.run = structuredClone(row);
    const result = readRunSources(input);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.candidates).toEqual([]);
  });
  it.each([
    "wrong-thread",
    "get",
    "query",
    "worker",
    "navigation",
    "missing-start",
    "early-start",
    "nan-start",
    "external",
    "encoded-thread",
  ])("does not infer create ownership from %s", (change) => {
    const { input, row, f } = fixture();
    if (change === "wrong-thread")
      row.url = row.url.replace(f.raw, "another-thread");
    if (change === "get") row.method = "GET";
    if (change === "query") row.url += "?";
    if (change === "worker") row.source = "service-worker";
    if (change === "navigation") row.navigation = true;
    if (change === "missing-start") row.startedAt = null;
    if (change === "early-start") row.startedAt = 0;
    if (change === "nan-start") row.startedAt = NaN;
    if (change === "external")
      row.url = row.url.replace(f.appBase, "https://other.example");
    if (change === "encoded-thread")
      row.url = row.url.replace(f.raw, "%61ctual-random-thread");
    const result = readRunSources(input);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.candidates).toEqual([]);
  });
  it.each([199, 300, 400, 500, NaN, Infinity, 200.5, "200", null])(
    "does not admit invalid or unsuccessful status %s",
    (status) => {
      const { input, row, f } = fixture();
      Object.assign(row.response!, { status });
      input.registry = buildIdentityRegistry(f);
      expect(input.registry.errors).toEqual([]);
      const result = readRunSources(input);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.candidates).toEqual([]);
    },
  );
  it.each(["missing-response", "missing-location", "wrong-thread-location"])(
    "keeps %s unresolved",
    (change) => {
      const { input, row, f } = fixture();
      if (change === "missing-response") row.response = null;
      else
        row.response!.headers["content-location"] =
          change === "missing-location"
            ? null
            : "/api/threads/other/runs/new-run";
      input.registry = buildIdentityRegistry(f);
      expect(input.registry.errors).toEqual([]);
      const result = readRunSources(input);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.candidates).toEqual([]);
    },
  );
  it("grants no consumer admission even for a matching join preceding response evidence", () => {
    const { input, row, f } = fixture();
    const join = structuredClone(row);
    join.sequence += 1;
    join.method = "GET";
    join.url = `${f.appBase}/api/langgraph/threads/${f.raw}/runs/new-run/stream`;
    join.startedAt = 1;
    join.headers["last-event-id"] = "new-run";
    input.network.requests.push(join);
    input.registry = buildIdentityRegistry(f);
    expect(input.registry.errors).toEqual([]);
    const result = readRunSources(input);
    expect(result.errors).toEqual([]);
    expect(result.candidates.map((candidate) => candidate.request)).toEqual([
      row,
    ]);
    expect(Object.keys(result).sort()).toEqual(["candidates", "errors"]);
    expect(join.headers["last-event-id"]).toBe("new-run");
  });
});
