import { beforeEach, afterEach, it, expect, vi as mock } from "vitest";

import { createReplayObservation } from "@/core/diagnostics/replay-observation";
import {
  PARITY_OBSERVATION_CAPABILITY as CAPABILITY,
  PARITY_OBSERVATION_EVENT as EVENT,
  type ObservationPacket,
} from "@/core/diagnostics/parity-observation";

let packets: ObservationPacket[];
const receive = (event: Event) =>
  packets.push((event as CustomEvent<ObservationPacket>).detail);
beforeEach(() => {
  packets = [];
  Object.defineProperty(window, CAPABILITY, {
    configurable: true,
    value: { version: 1, token: "replay-helper", action: "replay:0" },
  });
  window.addEventListener(EVENT, receive);
});
afterEach(() => {
  window.removeEventListener(EVENT, receive);
  Reflect.deleteProperty(window, CAPABILITY);
  mock.restoreAllMocks();
});
function intent(kind: "edit" | "regenerate" = "edit") {
  return {
    kind,
    thread: "thread-a",
    source: kind === "edit" ? "human-a" : "answer-a",
    assistant: "lead_agent",
    agent: null,
  };
}
function prepared(
  kind: "edit" | "regenerate" = "edit",
): Record<string, unknown> {
  return {
    target_run_id: "run-a",
    ...(kind === "edit"
      ? {
          replacement_human_message_id: "replacement-a",
          source_message_ids: ["human-a", "answer-a"],
        }
      : {}),
    input: {
      messages: [
        {
          type: "human",
          id: kind === "edit" ? "replacement-a" : "human-a",
          content: "PRIVATE content",
        },
      ],
    },
    checkpoint: { checkpoint_id: "checkpoint-a" },
    metadata: {
      regenerate_from_message_id: "answer-a",
      regenerate_from_run_id: "run-a",
      regenerate_checkpoint_id: "checkpoint-a",
      ...(kind === "edit"
        ? {
            edit_message_id: "replacement-a",
            edit_from_message_id: "human-a",
            edit_version_group_id: "older-group",
          }
        : {}),
    },
  };
}
function metadata(value: Record<string, unknown>) {
  return value.metadata as Record<string, unknown>;
}
const invalidCases: {
  label: string;
  kind: "edit" | "regenerate";
  change(value: Record<string, unknown>): void;
}[] = [
  {
    label: "regenerate source missing",
    kind: "regenerate",
    change: (value) => {
      delete metadata(value).regenerate_from_message_id;
    },
  },
  {
    label: "regenerate source belongs to another request",
    kind: "regenerate",
    change: (value) => {
      metadata(value).regenerate_from_message_id = "another-answer";
    },
  },
  {
    label: "edit source missing",
    kind: "edit",
    change: (value) => {
      delete metadata(value).edit_from_message_id;
    },
  },
  {
    label: "edit source belongs to another request",
    kind: "edit",
    change: (value) => {
      metadata(value).edit_from_message_id = "another-human";
    },
  },
  {
    label: "edit group missing",
    kind: "edit",
    change: (value) => {
      delete metadata(value).edit_version_group_id;
    },
  },
  {
    label: "edit source list omits human",
    kind: "edit",
    change: (value) => {
      value.source_message_ids = ["answer-a"];
    },
  },
  {
    label: "edit source list omits assistant",
    kind: "edit",
    change: (value) => {
      value.source_message_ids = ["human-a"];
    },
  },
  {
    label: "message is not an object",
    kind: "regenerate",
    change: (value) => {
      value.input = { messages: [null] };
    },
  },
  {
    label: "regenerate has no human identity",
    kind: "regenerate",
    change: (value) => {
      value.input = {
        messages: [{ type: "human", content: "PRIVATE content" }],
      };
    },
  },
  {
    label: "replacement differs from actual input",
    kind: "edit",
    change: (value) => {
      value.input = {
        messages: [{ type: "human", id: "different-replacement" }],
      };
    },
  },
  {
    label: "replacement differs from metadata",
    kind: "edit",
    change: (value) => {
      metadata(value).edit_message_id = "different-replacement";
    },
  },
  {
    label: "checkpoint differs from metadata",
    kind: "edit",
    change: (value) => {
      metadata(value).regenerate_checkpoint_id = "different-checkpoint";
    },
  },
];
for (const scenario of invalidCases)
  it(`rejects incomplete provenance: ${scenario.label}`, () => {
    const value = prepared(scenario.kind);
    scenario.change(value);
    const original = JSON.stringify(value);
    const observer = createReplayObservation(intent(scenario.kind))!;
    observer.response(value);
    expect(packets.some((packet) => packet.event === "invalid")).toBe(true);
    expect(
      packets.find((packet) => packet.event === "replay.snapshot"),
    ).toMatchObject({ values: { phase: "response", complete: false } });
    expect(JSON.stringify(value)).toBe(original);
  });
it("retains a prior edit group and publishes only finite identity fields", () => {
  const observer = createReplayObservation(intent())!;
  const value = prepared();
  Object.defineProperty(value, "unused", {
    get() {
      throw new Error("must not read unknown fields");
    },
  });
  observer.response(value);
  expect(packets.some((packet) => packet.event === "invalid")).toBe(false);
  expect(
    packets.find((packet) => packet.event === "replay.snapshot"),
  ).toMatchObject({ values: { complete: true } });
  expect(
    packets.find(
      (packet) =>
        packet.event === "replay.reference" &&
        packet.values.slot === "metadata.edit_version_group_id",
    ),
  ).toMatchObject({ values: { raw: "older-group" } });
  expect(packets.some((packet) => packet.event === "replay.adopt")).toBe(false);
  expect(JSON.stringify(packets)).not.toContain("PRIVATE");
});
it("does not publish extra properties on the source intent", () => {
  const value = { ...intent(), extra: "PRIVATE intent" };
  createReplayObservation(value);
  expect(JSON.stringify(packets)).not.toContain("PRIVATE intent");
});
it("does not read an intent getter when observation is disabled", () => {
  Reflect.deleteProperty(window, CAPABILITY);
  const value = intent();
  const read = mock.fn(() => "edit");
  Object.defineProperty(value, "kind", { get: read });
  expect(createReplayObservation(value)).toBeNull();
  expect(read).not.toHaveBeenCalled();
});
it("an unreadable observation intent cannot throw into product code", () => {
  const value = intent();
  Object.defineProperty(value, "kind", {
    get() {
      throw new Error("PRIVATE getter error");
    },
  });
  expect(() => createReplayObservation(value)).not.toThrow();
  expect(packets.some((packet) => packet.event === "invalid")).toBe(true);
  expect(JSON.stringify(packets)).not.toContain("PRIVATE");
});
it("does not invoke getters on parsed identity slots", () => {
  const value = prepared();
  const read = mock.fn(() => "run-a");
  Object.defineProperty(value, "target_run_id", { get: read });
  createReplayObservation(intent())!.response(value);
  expect(read).not.toHaveBeenCalled();
  expect(packets.some((packet) => packet.event === "invalid")).toBe(true);
});
it("marks excessive reference rows invalid without publishing a truncated success", () => {
  const value = prepared();
  value.source_message_ids = Array.from(
    { length: 4096 },
    (_, i) => `source-${i}`,
  );
  createReplayObservation(intent())!.response(value);
  expect(packets.some((packet) => packet.event === "invalid")).toBe(true);
  expect(
    packets.find((packet) => packet.event === "replay.snapshot"),
  ).toMatchObject({ values: { complete: false } });
  expect(packets.some((packet) => packet.event === "replay.source")).toBe(
    false,
  );
});
it("marks excessive identity text invalid without copying it to packets", () => {
  const value = prepared();
  value.source_message_ids = ["human-a", "answer-a", "x".repeat(1_048_577)];
  createReplayObservation(intent())!.response(value);
  expect(packets.some((packet) => packet.event === "invalid")).toBe(true);
  expect(
    packets.find((packet) => packet.event === "replay.snapshot"),
  ).toMatchObject({ values: { complete: false } });
  expect(JSON.stringify(packets).length).toBeLessThan(2000);
});
it("keeps separate operations distinct even when their raw identities collide", () => {
  const a = createReplayObservation(intent())!;
  const b = createReplayObservation(intent())!;
  a.response(prepared());
  b.response(prepared());
  const begins = packets.filter((packet) => packet.event === "replay.begin");
  expect(begins).toHaveLength(2);
  expect(begins[0]!.instance).not.toBe(begins[1]!.instance);
  expect(
    packets.filter(
      (packet) =>
        packet.event === "replay.reference" &&
        packet.values.slot === "replacement_human_message_id",
    ),
  ).toHaveLength(2);
});
const sourceShapeCases: {
  label: string;
  type: string;
  count: number | null;
  complete: boolean;
  change(value: Record<string, unknown>): void;
}[] = [
  {
    label: "absent",
    type: "absent",
    count: 0,
    complete: true,
    change(value) {
      delete value.source_message_ids;
    },
  },
  {
    label: "empty array",
    type: "array",
    count: 0,
    complete: true,
    change(value) {
      value.source_message_ids = [];
    },
  },
  {
    label: "nonempty array",
    type: "array",
    count: 2,
    complete: true,
    change(value) {
      value.source_message_ids = ["human-a", "answer-a"];
    },
  },
  {
    label: "null",
    type: "null",
    count: null,
    complete: false,
    change(value) {
      value.source_message_ids = null;
    },
  },
  {
    label: "own undefined",
    type: "invalid",
    count: null,
    complete: false,
    change(value) {
      value.source_message_ids = undefined;
    },
  },
  {
    label: "string",
    type: "invalid",
    count: null,
    complete: false,
    change(value) {
      value.source_message_ids = "PRIVATE sources";
    },
  },
  {
    label: "object",
    type: "invalid",
    count: null,
    complete: false,
    change(value) {
      value.source_message_ids = { hidden: "PRIVATE sources" };
    },
  },
];
for (const phase of ["response", "attempt"] as const)
  for (const scenario of sourceShapeCases)
    it(`retains ${phase} source representation: ${scenario.label}`, () => {
      const value = prepared("regenerate");
      scenario.change(value);
      const before = Object.getOwnPropertyDescriptor(
        value,
        "source_message_ids",
      );
      const observer = createReplayObservation(intent("regenerate"))!;
      if (phase === "response") observer.response(value);
      else observer.attempt(value, "lead_agent");
      expect(
        packets.find((packet) => packet.event === "replay.snapshot"),
      ).toMatchObject({
        values: {
          phase,
          sourcesType: scenario.type,
          sourceCount: scenario.count,
          complete: scenario.complete,
        },
      });
      expect(packets.some((packet) => packet.event === "invalid")).toBe(
        !scenario.complete,
      );
      expect(
        Object.getOwnPropertyDescriptor(value, "source_message_ids"),
      ).toEqual(before);
      expect(JSON.stringify(packets)).not.toContain("PRIVATE");
    });

for (const phase of ["response", "attempt"] as const)
  for (const mode of ["accessor", "descriptor-throws"] as const)
    it(`reports ${phase} unreadable sources without invoking a ${mode}`, () => {
      const value = prepared("regenerate");
      const read = mock.fn(() => ["human-a", "answer-a"]);
      if (mode === "accessor")
        Object.defineProperty(value, "source_message_ids", { get: read });
      const input =
        mode === "descriptor-throws"
          ? new Proxy(value, {
              getOwnPropertyDescriptor(target, key) {
                if (key === "source_message_ids")
                  throw new Error("PRIVATE descriptor");
                return Object.getOwnPropertyDescriptor(target, key);
              },
            })
          : value;
      const observer = createReplayObservation(intent("regenerate"))!;
      expect(() => {
        if (phase === "response") observer.response(input);
        else observer.attempt(input, "lead_agent");
      }).not.toThrow();
      expect(read).not.toHaveBeenCalled();
      expect(
        packets.find((packet) => packet.event === "replay.snapshot"),
      ).toMatchObject({
        values: {
          phase,
          sourcesType: "unreadable",
          sourceCount: null,
          complete: false,
        },
      });
      expect(packets.some((packet) => packet.event === "invalid")).toBe(true);
      expect(JSON.stringify(packets)).not.toContain("PRIVATE");
    });
it("retains an established sources type when a later identity field is unreadable", () => {
  const value = prepared("regenerate");
  value.source_message_ids = [];
  const read = mock.fn(() => ({}));
  Object.defineProperty(value, "input", { get: read });
  createReplayObservation(intent("regenerate"))!.response(value);
  expect(read).not.toHaveBeenCalled();
  expect(
    packets.find((packet) => packet.event === "replay.snapshot"),
  ).toMatchObject({ values: { sourcesType: "array", complete: false } });
});

for (const mode of ["absent", "wrong-version"] as const)
  it(`does not inspect replay source descriptors when capability is ${mode}`, () => {
    if (mode === "absent") Reflect.deleteProperty(window, CAPABILITY);
    else
      Object.defineProperty(window, CAPABILITY, {
        configurable: true,
        value: { version: 2, token: "disabled", action: "replay:0" },
      });
    const inspect = mock.fn(Object.getOwnPropertyDescriptor);
    const value = new Proxy(prepared("regenerate"), {
      getOwnPropertyDescriptor: inspect,
    });
    const observer = createReplayObservation(intent("regenerate"));
    observer?.response(value);
    observer?.attempt(value, "lead_agent");
    expect(observer).toBeNull();
    expect(inspect).not.toHaveBeenCalled();
    expect(packets).toEqual([]);
  });
