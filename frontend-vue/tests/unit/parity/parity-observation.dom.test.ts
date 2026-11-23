import { beforeEach, afterEach, it, expect, vi as mock } from "vitest";

import {
  createParityObserver,
  createThreadObservation,
  PARITY_OBSERVATION_CAPABILITY as CAPABILITY,
  PARITY_OBSERVATION_EVENT as EVENT,
  type ObservationPacket,
} from "@/core/diagnostics/parity-observation";

const scope = {
  account: "alice",
  project: "alpha",
  agent: null,
  path: "/workspace/chats/new",
};
let packets: ObservationPacket[];
const receive = (event: Event) =>
  packets.push((event as CustomEvent<ObservationPacket>).detail);
function enable(token = "capture-a") {
  Object.defineProperty(window, CAPABILITY, {
    configurable: true,
    value: { version: 1, token, action: "enter" },
  });
}
beforeEach(() => {
  packets = [];
  enable();
  window.addEventListener(EVENT, receive);
});
afterEach(() => {
  window.removeEventListener(EVENT, receive);
  Reflect.deleteProperty(window, CAPABILITY);
  mock.restoreAllMocks();
});

it("reads only capability data properties without invoking accessors", () => {
  const getter = mock.fn(() => {
    throw new Error("must not execute");
  });
  Object.defineProperty(window, CAPABILITY, {
    configurable: true,
    get: getter,
  });
  expect(createParityObserver("test")).toBeNull();
  expect(getter).not.toHaveBeenCalled();
});

it("capture replacement never reauthorizes an old producer", () => {
  const observer = createParityObserver("test")!;
  const origin = observer.point();
  enable("capture-b");
  observer.emit("test", { raw: "old-id" }, origin);
  expect(packets).toEqual([]);
  createParityObserver("test")!.emit("test", { raw: "new-id" });
  expect(packets.map((packet) => packet.capture)).toEqual(["capture-b"]);
});

it("published primitive snapshots cannot change when a caller mutates its input", () => {
  const observer = createParityObserver("test")!;
  const values = { raw: "before" };
  observer.emit("test", values);
  values.raw = "after";
  expect(packets[0]?.values.raw).toBe("before");
  expect(Object.isFrozen(packets[0])).toBe(true);
  expect(Object.isFrozen(packets[0]?.values)).toBe(true);
});

it("clock observation failure cannot escape into the producer", () => {
  const observer = createParityObserver("test")!;
  mock.spyOn(performance, "now").mockImplementation(() => {
    throw new Error("clock failed");
  });
  expect(() => observer.emit("test", { raw: "id" })).not.toThrow();
  expect(observer.point()).toBeNull();
  expect(packets).toEqual([]);
});

it("allocation overflow remains unpublished until a real selected commit reports invalid evidence", () => {
  const observer = createThreadObservation("main")!;
  for (let index = 0; index < 257; index++)
    observer.allocation(`draft-${index}`, "render", scope);
  expect(packets).toEqual([]);
  observer.resume();
  observer.select("draft-0", true, false, scope);
  expect(packets.filter((packet) => packet.event === "invalid")).toHaveLength(
    1,
  );
  observer.select("draft-0", true, false, scope);
  expect(packets.filter((packet) => packet.event === "invalid")).toHaveLength(
    1,
  );
});

it("ambiguous equal raw allocations invalidate evidence without choosing either candidate", () => {
  const observer = createThreadObservation("main")!;
  observer.allocation("same-raw", "first", scope);
  observer.allocation("same-raw", "second", { ...scope, account: "bob" });
  observer.bind("same-raw", "alpha");
  expect(packets).toEqual([]);
  observer.resume();
  observer.select("same-raw", true, false, scope);
  expect(packets.filter((packet) => packet.event === "invalid")).toHaveLength(
    1,
  );
  expect(
    packets.filter((packet) => packet.event === "thread.allocate"),
  ).toEqual([]);
  expect(
    packets.find((packet) => packet.event === "thread.select")?.values.raw,
  ).toBe("same-raw");
});

it("the total unpublished binding buffer is bounded and cannot silently truncate evidence", () => {
  const observer = createThreadObservation("main")!;
  observer.allocation("draft", "initial", scope);
  for (let index = 0; index < 513; index++)
    observer.bind("draft", `project-${index}`);
  expect(packets).toEqual([]);
  observer.resume();
  observer.select("draft", true, false, scope);
  expect(packets.filter((packet) => packet.event === "invalid")).toHaveLength(
    1,
  );
  expect(
    packets.filter((packet) => packet.event === "thread.bind"),
  ).toHaveLength(512);
});

it("pause rejects late selections and preparations; an explicit mounted resume keeps the allocation", () => {
  const observer = createThreadObservation("main")!;
  observer.allocation("draft", "initial", scope);
  observer.bind("draft", "alpha");
  observer.resume();
  observer.select("draft", true, false, scope);
  observer.pause();
  const cutoff = packets.length;
  observer.select("late", true, false, scope);
  observer.prepared("draft", "late");
  expect(packets).toHaveLength(cutoff);
  observer.resume();
  observer.select("draft", true, false, scope);
  expect(
    packets.filter((packet) => packet.event === "thread.allocate"),
  ).toHaveLength(1);
  expect(
    packets.filter((packet) => packet.event === "thread.select"),
  ).toHaveLength(2);
});

it("the exact committed lease admits its earlier consumer without rewriting the origin action", () => {
  const owner = createThreadObservation("main")!;
  owner.allocation("draft-a", "initial", scope);
  owner.bind("draft-a", "alpha");
  const lease = owner.lease("draft-a", scope)!;
  lease.uploadsLimits("draft-a");
  expect(packets.map((packet) => packet.event)).toEqual(["uploads.limits"]);
  expect(packets[0]?.values.state).toBe("candidate");
  const capability = Object.getOwnPropertyDescriptor(window, CAPABILITY)!.value;
  capability.action = "settle:0";
  owner.resume();
  owner.select("draft-a", true, false, scope, lease);
  const selected = packets.find((packet) => packet.event === "lease.select")!;
  const consumed = packets.find((packet) => packet.event === "uploads.limits")!;
  expect(selected.values).toMatchObject({
    raw: "draft-a",
    allocation: 0,
    epoch: 1,
  });
  expect(consumed.values).toEqual({
    lease: selected.values.lease,
    epoch: 0,
    raw: "draft-a",
    state: "candidate",
  });
  expect(consumed.action).toBe("enter");
  expect(selected.action).toBe("settle:0");
  expect(consumed.at).toBeLessThanOrEqual(selected.at);
});

it("a later committed render cannot admit a discarded render's equal-raw lease", () => {
  const owner = createThreadObservation("main")!;
  owner.allocation("draft", "initial", scope);
  const discarded = owner.lease("draft", scope)!;
  const committed = owner.lease("draft", scope)!;
  discarded.uploadsLimits("discarded-consumer");
  owner.resume();
  owner.select("draft", true, false, scope, committed);
  committed.uploadsLimits("draft");
  const consumers = packets.filter(
    (packet) => packet.event === "uploads.limits",
  );
  expect(consumers.map((packet) => packet.values.raw)).toEqual([
    "discarded-consumer",
    "draft",
  ]);
  const selected = packets.filter((packet) => packet.event === "lease.select");
  expect(selected).toHaveLength(1);
  expect(consumers[0]?.values.lease).not.toBe(selected[0]?.values.lease);
  expect(consumers[1]?.values.lease).toBe(selected[0]?.values.lease);
});

it("a lease created before allocation never borrows that later candidate", () => {
  const owner = createThreadObservation("main")!;
  const lease = owner.lease("future", scope)!;
  lease.uploadsLimits("future");
  owner.allocation("future", "initial", scope);
  owner.resume();
  owner.select("future", true, false, scope, lease);
  expect(
    packets.find((packet) => packet.event === "lease.select")?.values
      .allocation,
  ).toBeNull();
});

it("another observer's equal-raw lease cannot be confirmed by this owner", () => {
  const owner = createThreadObservation("main")!;
  const other = createThreadObservation("main")!;
  owner.allocation("draft", "initial", scope);
  other.allocation("draft", "initial", scope);
  const foreign = other.lease("draft", scope)!;
  foreign.uploadsLimits("draft");
  owner.resume();
  owner.select("draft", true, false, scope, foreign);
  expect(packets.filter((packet) => packet.event === "lease.select")).toEqual(
    [],
  );
  expect(
    packets.find((packet) => packet.event === "invalid")?.values.reason,
  ).toBe("thread consumer lease does not belong to the selected owner");
});

it("retirement remains visible across StrictMode-style confirmation of the same lease", () => {
  const owner = createThreadObservation("main")!;
  owner.allocation("draft", "initial", scope);
  const lease = owner.lease("draft", scope)!;
  owner.resume();
  owner.select("draft", true, false, scope, lease);
  owner.pause();
  lease.uploadsLimits("draft");
  owner.resume();
  owner.select("draft", true, false, scope, lease);
  lease.uploadsLimits("draft");
  expect(
    packets
      .filter((packet) => packet.event === "lease.select")
      .map((packet) => packet.values.epoch),
  ).toEqual([1, 2]);
  expect(
    packets.filter((packet) => packet.event === "lease.retire"),
  ).toHaveLength(1);
  expect(
    packets
      .filter((packet) => packet.event === "uploads.limits")
      .map((packet) => [packet.values.epoch, packet.values.state]),
  ).toEqual([
    [1, "retired"],
    [2, "selected"],
  ]);
});

it("a consumer's wrong thread remains literal instead of being overwritten with the lease owner", () => {
  const owner = createThreadObservation("main")!;
  owner.allocation("owner-a", "initial", scope);
  const lease = owner.lease("owner-a", scope)!;
  owner.resume();
  owner.select("owner-a", true, false, scope, lease);
  lease.uploadsLimits("wrong-b");
  expect(
    packets.find((packet) => packet.event === "lease.select")?.values.raw,
  ).toBe("owner-a");
  expect(
    packets.find((packet) => packet.event === "uploads.limits")?.values.raw,
  ).toBe("wrong-b");
});

it("equal request fingerprints retain a discarded consumer alongside the committed one", () => {
  const owner = createThreadObservation("main")!;
  owner.allocation("draft", "initial", scope);
  const discarded = owner.lease("draft", scope)!;
  const committed = owner.lease("draft", scope)!;
  discarded.uploadsLimits("draft");
  owner.resume();
  owner.select("draft", true, false, scope, committed);
  committed.uploadsLimits("draft");
  const consumers = packets.filter(
    (packet) => packet.event === "uploads.limits",
  );
  expect(consumers).toHaveLength(2);
  expect(consumers.map((packet) => packet.values.raw)).toEqual([
    "draft",
    "draft",
  ]);
  expect(consumers[0]?.values.lease).not.toBe(consumers[1]?.values.lease);
  expect(consumers[0]?.values.state).toBe("candidate");
  expect(consumers[1]?.values.state).toBe("selected");
  expect(
    packets.filter((packet) => packet.event === "lease.select"),
  ).toHaveLength(1);
});

it("a lease never crosses capture replacement or silently adopts another account scope", () => {
  const owner = createThreadObservation("main")!;
  owner.allocation("draft", "initial", scope);
  const lease = owner.lease("draft", scope)!;
  owner.resume();
  owner.select("draft", true, false, { ...scope, account: "bob" }, lease);
  expect(
    packets.find((packet) => packet.event === "invalid")?.values.reason,
  ).toBe("thread consumer lease does not belong to the selected owner");
  expect(packets.filter((packet) => packet.event === "lease.select")).toEqual(
    [],
  );
  packets.length = 0;
  enable("capture-b");
  lease.uploadsLimits("draft");
  owner.select("draft", true, false, scope, lease);
  expect(packets).toEqual([]);
});
