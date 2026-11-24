import type { Page } from "@playwright/test";
import { describe, expect, it, vi } from "vitest";
import {
  createIdentityLedger,
  type IdentityReceipt,
} from "../../e2e-parity/support/identity-receipts";
import { installIdentityCapture } from "../../e2e-parity/support/capture-identities";

const capture = "capture-a";
const origin = "http://127.0.0.1:3421";
function receipt(
  sequence: number,
  kind: IdentityReceipt["kind"],
): IdentityReceipt {
  return {
    version: 1,
    capture,
    origin,
    document: "a".repeat(32),
    sequence,
    generation: 1,
    action: "entry",
    dispatchedAt: 1000 + sequence,
    kind,
    ...(kind === "close"
      ? { reason: "seal" as const, errors: [], pending: [] }
      : {}),
    ...(kind === "event"
      ? {
          packet: {
            version: 1 as const,
            capture,
            action: "entry",
            at: 999,
            instance: 1,
            producer: "human:send",
            event: "human.allocate",
            values: { raw: "human-a", thread: "thread-a" },
          },
        }
      : {}),
  };
}
describe("capture-local identity receipt integrity", () => {
  it("deduplicates identical late ACK receipts while preserving origin and dispatch time", () => {
    const ledger = createIdentityLedger(capture, origin);
    const event = receipt(1, "event");
    for (const row of [receipt(2, "close"), event, receipt(0, "open"), event])
      ledger.receive(row);
    event.packet!.values.raw = "mutated-after-receive";
    const snapshot = ledger.freeze();
    expect(snapshot.complete).toBe(true);
    expect(snapshot.receipts.map((row) => row.sequence)).toEqual([0, 1, 2]);
    expect(snapshot.receipts[1]).toMatchObject({
      dispatchedAt: 1001,
      packet: { at: 999, values: { raw: "human-a" } },
    });
    expect(Object.isFrozen(snapshot.receipts[1]!.packet!.values)).toBe(true);
    ledger.receive(receipt(3, "event"));
    ledger.fail("late callback after cutoff");
    expect(ledger.freeze()).toBe(snapshot);
    expect(snapshot.errors).toEqual([]);
  });
  it("does not merge separate documents whose producer counters restart", () => {
    const ledger = createIdentityLedger(capture, origin);
    for (const document of ["a".repeat(32), "b".repeat(32)])
      for (const row of [
        receipt(0, "open"),
        receipt(1, "event"),
        receipt(2, "close"),
      ])
        ledger.receive({ ...row, document });
    const snapshot = ledger.freeze();
    expect(snapshot.complete).toBe(true);
    expect(
      snapshot.receipts.filter((row) => row.packet?.instance === 1),
    ).toHaveLength(2);
  });
  for (const mode of [
    "gap",
    "conflict",
    "no-open",
    "no-close",
    "post-close",
    "wrong-token",
    "wrong-origin",
    "invalid-packet",
    "overflow-reported",
  ] as const)
    it(`rejects ${mode} even when both applications could commit the same mistake`, () => {
      const ledger = createIdentityLedger(capture, origin);
      const rows = [
        receipt(0, "open"),
        receipt(1, "event"),
        receipt(2, "close"),
      ];
      if (mode === "gap") rows.splice(1, 1);
      if (mode === "no-open") rows.shift();
      if (mode === "no-close") rows.pop();
      if (mode === "conflict")
        rows.push({ ...receipt(1, "event"), action: "different-action" });
      if (mode === "post-close") rows.push(receipt(3, "event"));
      if (mode === "wrong-token") rows[1]!.capture = "capture-b";
      if (mode === "wrong-origin") rows[1]!.origin = "https://other.invalid";
      if (mode === "invalid-packet") rows[1]!.packet!.event = "unknown.event";
      if (mode === "overflow-reported")
        rows[2]!.errors = ["identity document evidence capacity exceeded"];
      for (const row of rows) ledger.receive(row);
      expect(ledger.freeze().complete).toBe(false);
      expect(ledger.freeze().errors.length).toBeGreaterThan(0);
    });
  it("rejects actual capture capacity exhaustion and preserves its finite prefix", () => {
    const ledger = createIdentityLedger(capture, origin);
    ledger.receive(receipt(0, "open"));
    for (let index = 1; index < 34; index++) {
      const row = receipt(index, "event");
      row.packet!.values.raw = "x".repeat(512 * 1024);
      ledger.receive(row);
    }
    ledger.receive(receipt(34, "close"));
    expect(ledger.freeze().complete).toBe(false);
    expect(ledger.freeze().errors).toContain(
      "identity capture evidence capacity exceeded",
    );
    expect(ledger.freeze().receipts.length).toBeLessThan(35);
  });
});

for (const location of ["envelope", "packet"] as const)
  it(`rejects and excludes unrecognized ${location} fields from durable identity receipts`, () => {
    const ledger = createIdentityLedger(capture, origin);
    const row = receipt(1, "event");
    Object.assign(location === "packet" ? row.packet! : row, {
      extra: { content: "private unexpected payload" },
    });
    for (const value of [receipt(0, "open"), row, receipt(2, "close")])
      ledger.receive(value);
    const result = ledger.freeze();
    expect(result.complete).toBe(false);
    expect(result.errors).toContain("malformed identity transport receipt");
    expect(JSON.stringify(result)).not.toContain("private unexpected payload");
  });

it("retains the original install failure and every failed resource cleanup", async () => {
  const original = new Error("fixture init registration failure");
  const cleanup = new Error("fixture binding cleanup failure");
  const dispose = vi.fn(async () => {
    throw cleanup;
  });
  const page = {
    on: vi.fn(),
    off: vi.fn(),
    exposeBinding: vi.fn(async () => ({ dispose })),
    addInitScript: vi.fn(async () => {
      throw original;
    }),
  } as unknown as Page;
  const result = await installIdentityCapture(page, origin).catch(
    (error) => error as unknown,
  );
  expect(dispose).toHaveBeenCalledTimes(1);
  expect(result).toBeInstanceOf(AggregateError);
  expect((result as AggregateError).cause).toBe(original);
  expect((result as AggregateError).errors).toEqual([original, cleanup]);
});

for (const mode of [
  "event-errors-object",
  "action-errors-object",
  "event-errors-string",
  "array-values",
] as const)
  it(`rejects malformed ${mode} before retaining any unknown payload`, () => {
    const ledger = createIdentityLedger(capture, origin);
    const row = receipt(
      1,
      mode === "action-errors-object" ? "action" : "event",
    );
    if (mode === "array-values")
      row.packet!.values = Object.assign([], {
        raw: "private unexpected payload",
        thread: "thread-a",
      }) as unknown as NonNullable<IdentityReceipt["packet"]>["values"];
    else
      Object.assign(row, {
        errors:
          mode === "event-errors-string"
            ? "private unexpected payload"
            : { body: "private unexpected payload" },
      });
    for (const value of [receipt(0, "open"), row, receipt(2, "close")])
      ledger.receive(value);
    const result = ledger.freeze();
    expect(result.complete).toBe(false);
    expect(JSON.stringify(result)).not.toContain("private unexpected payload");
  });

it("requires the expected and observed document nonce sets to match both ways", () => {
  const ledger = createIdentityLedger(capture, origin);
  ledger.expectDocuments(
    ["a".repeat(32), "b".repeat(32)].map((document) => ({
      document,
      generation: 1,
      action: "entry",
    })),
  );
  for (const document of ["a".repeat(32), "c".repeat(32)])
    for (const row of [receipt(0, "open"), receipt(1, "close")])
      ledger.receive({ ...row, document });
  expect(ledger.freeze().errors).toContain(
    "identity document census differs from observed navigations",
  );
});

for (const mode of [
  "valid",
  "pending",
  "duplicate",
  "out-of-range",
  "missing-declaration",
  "wrong-close",
  "cumulative-error",
] as const)
  it(`validates a finite ${mode} close/settled certificate`, () => {
    const ledger = createIdentityLedger(capture, origin);
    const close = { ...receipt(2, "close"), pending: [1] };
    const terminal = {
      ...receipt(3, "settled"),
      close: 2,
      pending: [] as number[],
      errors: [] as string[],
    };
    if (mode === "pending") terminal.pending = [1];
    if (mode === "duplicate") close.pending = [1, 1];
    if (mode === "out-of-range") close.pending = [7];
    if (mode === "missing-declaration")
      Reflect.deleteProperty(close, "pending");
    if (mode === "wrong-close") terminal.close = 0;
    if (mode === "cumulative-error")
      close.errors = ["identity transport delivery rejected"];
    for (const row of [
      receipt(0, "open"),
      receipt(1, "event"),
      close,
      terminal,
    ])
      ledger.receive(row);
    expect(ledger.freeze().complete).toBe(mode === "valid");
    if (mode === "cumulative-error")
      expect(ledger.freeze().errors).toContain(
        "identity transport delivery rejected",
      );
  });

for (const mode of [
  "number",
  "boolean",
  "date",
  "map",
  "set",
  "event-array",
  "envelope-array",
  "packet-array",
  "getter",
] as const)
  it(`rejects non-record ${mode} without invoking unknown accessors`, () => {
    const ledger = createIdentityLedger(capture, origin);
    let row = receipt(1, "event");
    row.packet!.producer = "replay";
    row.packet!.event = "replay.adopt";
    row.packet!.values = {};
    const getter = vi.fn(() => ({}));
    if (mode === "number") Object.assign(row.packet!, { values: 1 });
    if (mode === "boolean") Object.assign(row.packet!, { values: true });
    if (mode === "date") Object.assign(row.packet!, { values: new Date(0) });
    if (mode === "map")
      Object.assign(row.packet!, {
        values: new Map([["hidden", "private unknown"]]),
      });
    if (mode === "set")
      Object.assign(row.packet!, { values: new Set(["private unknown"]) });
    if (mode === "event-array")
      Object.assign(row.packet!, { event: ["replay.adopt"] });
    if (mode === "envelope-array") row = Object.assign([], row);
    if (mode === "packet-array") row.packet = Object.assign([], row.packet!);
    if (mode === "getter")
      Object.defineProperty(row.packet!, "values", {
        enumerable: true,
        get: getter,
      });
    for (const item of [receipt(0, "open"), row, receipt(2, "close")])
      ledger.receive(item);
    const result = ledger.freeze();
    expect(result.complete).toBe(false);
    expect(result.errors).toContain("malformed identity transport receipt");
    expect(result.receipts.some((item) => item.kind === "event")).toBe(false);
    expect(getter).not.toHaveBeenCalled();
  });

it("retains a legal empty plain or null-prototype values record", () => {
  for (const values of [{}, Object.create(null) as Record<string, never>]) {
    const ledger = createIdentityLedger(capture, origin);
    const row = receipt(1, "event");
    Object.assign(row.packet!, {
      producer: "replay",
      event: "replay.adopt",
      values,
    });
    for (const item of [receipt(0, "open"), row, receipt(2, "close")])
      ledger.receive(item);
    expect(ledger.freeze().complete).toBe(true);
  }
});

// Public Playwright lifecycle seam. It deliberately has no browser; native
// tests separately exercise actual document and binding behavior.
function lifecyclePage() {
  const listeners = new Map<string, (value: unknown) => void>();
  let token = "";
  let generation = 0;
  let action: string | null = null;
  const document = "a".repeat(32);
  const rows = () =>
    [0, 1].map((index) => ({
      ...receipt(index, index === 0 ? "open" : "close"),
      capture: token,
      generation,
      action,
      document,
    }));
  const frame = {
    evaluate: vi.fn(async () => ({
      capture: token,
      document,
      origin,
      protocol: "http:",
      closed: false,
      bootstrapGeneration: generation,
      bootstrapAction: action,
    })),
  };
  const page = {
    on: vi.fn((name: string, listener: (value: unknown) => void) => {
      listeners.set(name, listener);
    }),
    off: vi.fn((name: string) => {
      listeners.delete(name);
    }),
    mainFrame: () => frame,
    isClosed: () => false,
    exposeBinding: vi.fn(async () => ({
      dispose: vi.fn(async () => undefined),
    })),
    addInitScript: vi.fn(
      async (
        _fn: unknown,
        seed: { capture: string; generation: number; action: string | null },
      ) => {
        token = seed.capture;
        generation = seed.generation;
        action = seed.action;
        return { dispose: vi.fn(async () => undefined) };
      },
    ),
    evaluate: vi.fn(async (_fn: unknown, input: { operation?: string }) => {
      if (input.operation === "dispose") return null;
      return { rows: rows(), errors: [], document, closed: true };
    }),
  };
  return { page: page as unknown as Page, frame, listeners };
}

it("bounds repeated SPA census work rather than only the resulting receipt list", async () => {
  const fixture = lifecyclePage();
  const owner = await installIdentityCapture(fixture.page, origin);
  try {
    await owner.beginAction("entry");
    const navigate = fixture.listeners.get("framenavigated")!;
    for (let i = 0; i < 32_770; i++) navigate(fixture.frame);
    const snapshot = await owner.seal();
    expect(fixture.frame.evaluate.mock.calls.length).toBeLessThanOrEqual(
      32_768,
    );
    expect(snapshot.complete).toBe(false);
    expect(snapshot.errors).toContain(
      "identity harness metadata capacity exceeded",
    );
  } finally {
    await owner.dispose();
  }
});

it("bounds issued actions before allocating additional init resources", async () => {
  const fixture = lifecyclePage();
  const owner = await installIdentityCapture(fixture.page, origin);
  try {
    for (let i = 1; i < 32_768; i++) await owner.beginAction(`steps:${i}`);
    await expect(owner.beginAction("overflow")).rejects.toThrow("capacity");
    expect((await owner.seal()).errors).toContain(
      "identity harness metadata capacity exceeded",
    );
  } finally {
    await owner.dispose();
  }
});

for (const mode of [
  "unknown-envelope",
  "unknown-packet",
  "nonprimitive-value",
  "errors-accessor",
  "pending-accessor",
] as const)
  it(`rejects ${mode} before cloning can execute nested unknown accessors`, () => {
    const ledger = createIdentityLedger(capture, origin);
    const getter = vi.fn(() => "private unknown");
    const unknown = Object.defineProperty({}, "content", {
      enumerable: true,
      get: getter,
    });
    const row = receipt(1, mode.endsWith("accessor") ? "close" : "event");
    if (mode === "unknown-envelope") Object.assign(row, { extra: unknown });
    if (mode === "unknown-packet")
      Object.assign(row.packet!, { extra: unknown });
    if (mode === "nonprimitive-value")
      Object.assign(row.packet!.values, { raw: unknown });
    if (mode === "errors-accessor" || mode === "pending-accessor") {
      const array: unknown[] = [];
      Object.defineProperty(array, "0", { enumerable: true, get: getter });
      Object.assign(row, {
        [mode === "errors-accessor" ? "errors" : "pending"]: array,
      });
    }
    ledger.receive(receipt(0, "open"));
    ledger.receive(row);
    if (row.kind !== "close") ledger.receive(receipt(2, "close"));
    expect(ledger.freeze().complete).toBe(false);
    expect(getter).not.toHaveBeenCalled();
    expect(JSON.stringify(ledger.freeze())).not.toContain("private unknown");
  });
for (const sourcesType of ["absent", "array", "null", "invalid", "unreadable"])
  it(`retains the exact replay source type in finite receipts: ${sourcesType}`, () => {
    const ledger = createIdentityLedger(capture, origin);
    const row = receipt(1, "event");
    row.packet!.producer = "replay";
    row.packet!.event = "replay.snapshot";
    row.packet!.values = {
      phase: "response",
      complete: sourcesType === "absent" || sourcesType === "array",
      messageCount: 1,
      sourceCount:
        sourcesType === "absent" || sourcesType === "array" ? 0 : null,
      sourcesType,
    };
    for (const value of [receipt(0, "open"), row, receipt(2, "close")])
      ledger.receive(value);
    const snapshot = ledger.freeze();
    expect(snapshot.complete).toBe(true);
    expect(snapshot.receipts[1]!.packet!.values).toEqual(row.packet!.values);
  });

it("cannot upgrade an old replay snapshot with no source type into proof", () => {
  const ledger = createIdentityLedger(capture, origin);
  const row = receipt(1, "event");
  row.packet!.producer = "replay";
  row.packet!.event = "replay.snapshot";
  row.packet!.values = {
    phase: "response",
    complete: true,
    messageCount: 1,
    sourceCount: 0,
  };
  for (const value of [receipt(0, "open"), row, receipt(2, "close")])
    ledger.receive(value);
  expect(ledger.freeze().errors).toContain(
    "malformed identity transport receipt",
  );
});
