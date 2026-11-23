import { describe, expect, it } from "vitest";
import { readReplayAttemptSource } from "../../e2e-parity/support/identity-replay-source";
import { replaySourceFixture as fixture } from "./identity-replay-fixtures";

type Fixture = ReturnType<typeof fixture>;
const read = (f: Fixture) => readReplayAttemptSource(f.events, f.expected);
const rejects = (f: Fixture) => {
  const result = read(f);
  expect(result.errors.length).toBeGreaterThan(0);
  expect(result.candidate).toBeNull();
};
const renumber = (f: Fixture) =>
  f.events.forEach((row, index) => {
    row.sequence = 10 + index;
    row.dispatchedAt = 1100 + index;
  });

describe("bounded replay source reader, never HTTP or account admission", () => {
  it.each(["edit", "regenerate"] as const)(
    "reads %s with independent Vue key and absent React key",
    (kind) => {
      for (const vue of [false, true]) {
        const f = fixture(kind, vue),
          result = read(f);
        expect(result.errors).toEqual([]);
        expect(result.candidate?.replacement).toBe(
          kind === "edit" ? "new-replacement-human" : null,
        );
        expect(result.candidate?.key?.raw ?? null).toBe(
          vue ? "independent-submission-key" : null,
        );
        expect(result.candidate?.begin).toBe(f.events[0]);
        expect(Object.keys(result)).toEqual(["candidate", "errors"]);
      }
    },
  );
  it("does not mutate receipts or independent expectations", () => {
    const f = fixture();
    const before = structuredClone(f.events),
      plan = structuredClone(f.expected);
    read(f);
    expect(f.events).toEqual(before);
    expect(f.expected).toEqual(plan);
  });
  it("does not require terminal success, completion or a response body", () => {
    const f = fixture();
    f.events.pop();
    expect(read(f).candidate?.finish).toBeNull();
    f.add("replay.failure", { status: "exception" });
    f.add("replay.retire", {});
    f.add("replay.finish", { current: false });
    expect(read(f).errors).toEqual([]);
    expect(read(f).candidate?.failure?.packet.values.status).toBe("exception");
  });
  it("preserves a failed attempt even if its owner remained current", () => {
    const f = fixture();
    f.events.pop();
    f.add("replay.failure", { status: "failed" });
    f.add("replay.finish", { current: true });
    expect(read(f).errors).toEqual([]);
  });
  it("accepts an independently declared group fallback and first-turn wire human", () => {
    const f = fixture();
    f.expected.versionGroup = f.expected.sourceHuman;
    for (const row of f.events)
      if (row.packet.values.slot === "metadata.edit_version_group_id")
        row.packet.values.raw = f.expected.sourceHuman;
    expect(read(f).errors).toEqual([]);
    const regen = fixture("regenerate");
    regen.expected.sourceHuman = "source-human__user";
    expect(read(regen).errors).toEqual([]);
    regen.expected.wireHuman = "source-human__user";
    rejects(regen);
  });
  it("keeps absent and explicitly empty regenerate sources distinct", () => {
    const f = fixture("regenerate");
    for (const row of f.events)
      if (row.packet.event === "replay.snapshot")
        row.packet.values.sourcesType = "array";
    rejects(f);
    f.expected.sources = { type: "array", ids: [] };
    expect(read(f).errors).toEqual([]);
  });
  it("ignores unrelated ordinary events without interpreting them as replay proof", () => {
    const f = fixture();
    const unrelated = structuredClone(f.events[0]!);
    Object.assign(unrelated.packet, {
      producer: "human:send",
      event: "human.allocate",
    });
    f.events.unshift(unrelated);
    expect(read(f).errors).toEqual([]);
  });
  it.each([
    "owner",
    "capture",
    "instance",
    "producer",
    "action",
    "at",
    "sequence",
    "dispatch",
    "version",
  ])("rejects contradictory %s on a middle phase row", (change) => {
    const f = fixture(),
      row = f.find("replay.message", "attempt");
    if (change === "owner") row.owner = "another-document";
    if (change === "capture") row.packet.capture = "another-capture";
    if (change === "instance") row.packet.instance = 4;
    if (change === "producer") row.packet.producer = "human:send";
    if (change === "action") row.packet.action = "later-action";
    if (change === "at") row.packet.at++;
    if (change === "sequence") row.sequence = 0;
    if (change === "dispatch") row.dispatchedAt = 500;
    if (change === "version") Object.assign(row.packet, { version: 2 });
    rejects(f);
  });
  it.each([
    "replay.begin",
    "replay.adopt",
    "replay.submission",
    "replay.finish",
    "idempotency.allocate",
    "replay.reference",
    "replay.message",
    "replay.source",
    "replay.snapshot",
  ])("rejects duplicate %s even with matching raw", (name) => {
    const f = fixture();
    const index = f.events.indexOf(f.find(name));
    f.events.splice(index, 0, structuredClone(f.events[index]!));
    renumber(f);
    rejects(f);
  });
  it.each([
    "replay.begin",
    "replay.adopt",
    "replay.submission",
    "idempotency.allocate",
    "replay.reference",
    "replay.message",
    "replay.source",
    "replay.snapshot",
  ])("rejects missing %s", (name) => {
    const f = fixture();
    f.events.splice(f.events.indexOf(f.find(name)), 1);
    renumber(f);
    rejects(f);
  });
  it.each(["kind", "thread", "source", "agent"])(
    "rejects wrong begin %s",
    (key) => {
      const f = fixture();
      f.find("replay.begin").packet.values[key] = "other";
      rejects(f);
    },
  );
  it.each([
    "target_run_id",
    "replacement_human_message_id",
    "checkpoint.checkpoint_id",
    "metadata.edit_message_id",
    "metadata.edit_from_message_id",
    "metadata.edit_version_group_id",
    "metadata.regenerate_from_run_id",
    "metadata.regenerate_from_message_id",
    "metadata.regenerate_checkpoint_id",
  ])("rejects changed attempt role %s", (slot) => {
    const f = fixture();
    f.events.find(
      ({ packet: p }) => p.values.phase === "attempt" && p.values.slot === slot,
    )!.packet.values.raw = "another-id";
    rejects(f);
  });
  it.each(["null", "invalid", "unreadable", "absent"])(
    "rejects edit sourcesType %s",
    (type) => {
      const f = fixture();
      f.find("replay.snapshot", "response").packet.values.sourcesType = type;
      rejects(f);
    },
  );
  it.each(["complete", "messageCount", "sourceCount"])(
    "does not trust contradictory snapshot %s",
    (key) => {
      const f = fixture();
      f.find("replay.snapshot", "attempt").packet.values[key] =
        key === "complete" ? false : 9;
      rejects(f);
    },
  );
  it.each(["index", "type", "role", "idPresent", "raw"])(
    "rejects wrong message %s",
    (key) => {
      const f = fixture();
      f.find("replay.message", "attempt").packet.values[key] = "wrong";
      rejects(f);
    },
  );
  it("rejects reordered source members even if their set matches", () => {
    const f = fixture();
    const rows = f.events.filter(
      ({ packet: p }) =>
        p.event === "replay.source" && p.values.phase === "attempt",
    );
    [rows[0]!.packet.values.raw, rows[1]!.packet.values.raw] = [
      rows[1]!.packet.values.raw!,
      rows[0]!.packet.values.raw!,
    ];
    rejects(f);
  });
  it.each(["retire", "failure", "finish"])(
    "rejects %s before adoption without deleting later attempt",
    (event) => {
      const f = fixture();
      f.events.pop();
      const row = f.add(
        `replay.${event}`,
        event === "failure"
          ? { status: "exception" }
          : event === "finish"
            ? { current: false }
            : {},
      );
      f.events.pop();
      f.events.splice(f.events.indexOf(f.find("replay.adopt")), 0, row);
      renumber(f);
      rejects(f);
    },
  );
  it("rejects interleaved response and attempt phase rows", () => {
    const f = fixture();
    const a = f.events.indexOf(f.find("replay.message", "response"));
    const b = f.events.indexOf(f.find("replay.message", "attempt"));
    [f.events[a], f.events[b]] = [f.events[b]!, f.events[a]!];
    renumber(f);
    rejects(f);
  });
  it.each([
    "old-run",
    "source-human",
    "source-assistant",
    "persisted-thread",
    "checkpoint-before-source",
    "existing-version-group",
  ])("rejects a consistent replacement alias of old role %s", (raw) => {
    const f = fixture();
    for (const row of f.events)
      if (row.packet.values.raw === "new-replacement-human")
        row.packet.values.raw = raw;
    rejects(f);
  });
  it.each(["source-human", "new-replacement-human", "old-run", ""])(
    "rejects independent key alias %s",
    (raw) => {
      const f = fixture();
      f.find("idempotency.allocate").packet.values.raw = raw;
      rejects(f);
    },
  );
  it("does not accept Vue allocation in React's absent-key branch", () => {
    const f = fixture();
    f.expected.key = "none";
    rejects(f);
  });
  it("does not turn a partial failed preparation into an attempted source", () => {
    const f = fixture();
    f.events.splice(1);
    f.add("replay.failure", { status: "exception" });
    f.add("replay.finish", { current: true });
    rejects(f);
  });
  it.each(["invalid", "replay.unknown"])(
    "rejects %s rather than filtering it out",
    (event) => {
      const f = fixture();
      f.events.pop();
      f.add(event, { reason: "bad" });
      rejects(f);
    },
  );
  it("rejects unknown phase and explicit null reference instead of treating them as absent", () => {
    const f = fixture("regenerate");
    f.events.find(
      ({ packet }) => packet.values.slot === "replacement_human_message_id",
    )!.packet.values.valueType = "null";
    rejects(f);
    const other = fixture();
    other.find("replay.reference").packet.values.phase = "other";
    rejects(other);
  });
  it("rejects impossible current completion after retirement", () => {
    const f = fixture();
    f.events.pop();
    f.add("replay.retire", {});
    f.add("replay.finish", { current: true });
    rejects(f);
  });
  it("rejects a whole second replay owner rather than selecting the matching one", () => {
    const f = fixture();
    const other = fixture();
    for (const row of other.events) {
      row.owner = "other";
      row.packet.instance = 4;
    }
    f.events.push(...other.events);
    renumber(f);
    rejects(f);
  });
});
