/** Framework-neutral, finite transport protocol and pure integrity checks.
 * These receipts are not canonical identities or owner admission. */
export const MAX_ROWS = 32_768;
export const MAX_DOCUMENTS = 64;
export const MAX_TEXT = 16 * 1024 * 1024;
export const FIELDS: Record<string, readonly string[]> = {
  invalid: ["reason"],
  "thread.allocate": [
    "allocation",
    "raw",
    "reason",
    "account",
    "projectIntent",
    "agent",
    "path",
  ],
  "thread.bind": ["allocation", "raw", "project"],
  "thread.select": [
    "raw",
    "draft",
    "mock",
    "account",
    "projectIntent",
    "agent",
    "path",
  ],
  "thread.retire": ["raw", "account", "agent"],
  "thread.prepared": ["raw", "prepared"],
  "lease.select": [
    "lease",
    "epoch",
    "allocation",
    "raw",
    "account",
    "projectIntent",
    "agent",
    "path",
  ],
  "lease.retire": ["lease", "epoch"],
  "uploads.limits": ["lease", "epoch", "raw", "state"],
  "uploads.unowned": ["raw"],
  "human.allocate": ["raw", "thread"],
  "human.reuse": ["raw", "thread"],
  "human.submission": [
    "raw",
    "thread",
    "index",
    "messageCount",
    "keySource",
    "key",
  ],
  "memory.choice": ["factCount"],
  "memory.fact": ["index", "raw", "generated"],
  "memory.select": ["factCount"],
  "memory.retire": [],
  "memory.dispatch": ["state", "preAborted"],
  "replay.begin": ["kind", "thread", "source", "agent"],
  "replay.reference": ["phase", "slot", "valueType", "raw"],
  "replay.message": ["phase", "index", "type", "role", "idPresent", "raw"],
  "replay.source": ["phase", "index", "raw"],
  "replay.snapshot": [
    "phase",
    "complete",
    "messageCount",
    "sourceCount",
    "sourcesType",
  ],
  "replay.adopt": [],
  "replay.submission": ["assistant"],
  "idempotency.allocate": ["raw", "thread"],
  "replay.retire": [],
  "replay.failure": ["status"],
  "replay.finish": ["current"],
  "run.bind": ["thread", "assistant", "sourceAction"],
  "run.called": ["transport", "state"],
  "run.received": ["thread", "run", "state"],
  "run.delivered": ["thread", "run", "state"],
  "run.retire": [],
  "run.unowned": ["transport"],
};
/** Explicit runtime phases are validated separately from prepared-source rows. */
export const RUN_PHASE_EVENTS: readonly string[] = [
  "run.bind",
  "run.called",
  "run.received",
  "run.delivered",
  "run.retire",
];
export const PRODUCERS = [
  "uploads",
  "thread:main",
  "thread:agent",
  "human:send",
  "human:composer",
  "memory:settings",
  "memory:import",
  "replay",
  "run",
];
export type Primitive = string | number | boolean | null;
export type IdentityPacket = {
  version: 1;
  capture: string;
  action: string | null;
  at: number;
  instance: number;
  producer: string;
  event: string;
  values: Record<string, Primitive>;
};
export type IdentityReceipt = {
  version: 1;
  capture: string;
  document: string;
  origin: string;
  generation: number;
  sequence: number;
  dispatchedAt: number;
  action: string | null;
  kind: "open" | "event" | "action" | "close" | "settled";
  pending?: number[];
  close?: number;
  packet?: IdentityPacket;
  reason?: "seal" | "pagehide";
  errors?: string[];
};
export type DocumentSeed = {
  document: string;
  generation: number;
  action: string | null;
};
export type IdentitySnapshot = {
  capture: string;
  receipts: IdentityReceipt[];
  errors: string[];
  complete: boolean;
  expectedDocuments: DocumentSeed[] | null;
};
export type Seed = {
  capture: string;
  origin: string;
  action: string | null;
  generation: number;
  capability: string;
  control: string;
  binding: string;
  event: string;
  maxRows: number;
  maxText: number;
  fields: typeof FIELDS;
  producers: string[];
};

// Check before structuredClone: cloning an accessor executes it, while an
// Array/Map may retain state that JSON size accounting cannot represent.
function ownRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  return Reflect.ownKeys(value).every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    return (
      typeof key === "string" && descriptor.enumerable && "value" in descriptor
    );
  });
}

function ownArray(value: unknown): value is unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype)
    return false;
  if (Reflect.ownKeys(value).length !== value.length + 1) return false;
  for (let index = 0; index < value.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, index);
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor))
      return false;
  }
  return true;
}

function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

/** Pure receipt merger: sequence is evidence integrity, never entity identity. */
export function createIdentityLedger(
  capture: string,
  origin: string,
  actions?: ReadonlyMap<number, string | null>,
) {
  const documents = new Map<string, Map<number, IdentityReceipt>>();
  const errors = new Set<string>();
  let size = 0;
  let count = 0;
  let frozen: IdentitySnapshot | undefined;
  let expectedDocuments: DocumentSeed[] | null = null;
  function fail(reason: string) {
    if (!frozen) errors.add(reason);
  }
  function receive(input: unknown) {
    if (frozen) return;
    try {
      if (
        !ownRecord(input) ||
        (input.packet !== undefined &&
          (!ownRecord(input.packet) || !ownRecord(input.packet.values)))
      )
        throw new Error();
      const row = input as unknown as IdentityReceipt;
      if (
        !row ||
        Object.keys(row).some(
          (key) =>
            ![
              "version",
              "capture",
              "document",
              "origin",
              "generation",
              "sequence",
              "dispatchedAt",
              "action",
              "kind",
              "packet",
              "reason",
              "errors",
              "pending",
              "close",
            ].includes(key),
        ) ||
        row.version !== 1 ||
        row.capture !== capture ||
        row.origin !== origin ||
        typeof row.document !== "string" ||
        !/^[a-f0-9]{32}$/.test(row.document) ||
        !Number.isSafeInteger(row.sequence) ||
        row.sequence < 0 ||
        !Number.isSafeInteger(row.generation) ||
        row.generation < 0 ||
        !Number.isFinite(row.dispatchedAt) ||
        row.dispatchedAt <= 0 ||
        (row.action !== null && typeof row.action !== "string") ||
        !["open", "event", "action", "close", "settled"].includes(row.kind)
      )
        throw new Error();
      if (
        row.errors !== undefined &&
        (!ownArray(row.errors) ||
          !row.errors.every((error) => typeof error === "string") ||
          !["action", "close", "settled"].includes(row.kind))
      )
        throw new Error();
      if (
        (row.reason !== undefined && row.kind !== "close") ||
        (row.close !== undefined && row.kind !== "settled")
      )
        throw new Error();
      if (row.kind === "event") {
        const p = row.packet;
        if (
          !p ||
          Object.keys(p).some(
            (key) =>
              ![
                "version",
                "capture",
                "action",
                "at",
                "instance",
                "producer",
                "event",
                "values",
              ].includes(key),
          ) ||
          p.version !== 1 ||
          p.capture !== capture ||
          !PRODUCERS.includes(p.producer) ||
          typeof p.event !== "string" ||
          !Object.hasOwn(FIELDS, p.event) ||
          !Number.isSafeInteger(p.instance) ||
          p.instance <= 0 ||
          !Number.isFinite(p.at) ||
          p.at <= 0 ||
          (p.action !== null && typeof p.action !== "string") ||
          !p.values ||
          Array.isArray(p.values) ||
          Object.keys(p.values).length !== FIELDS[p.event]!.length ||
          !FIELDS[p.event]!.every(
            (key) =>
              Object.hasOwn(p.values, key) &&
              (p.values[key] === null ||
                ["string", "boolean"].includes(typeof p.values[key]) ||
                (typeof p.values[key] === "number" &&
                  Number.isFinite(p.values[key]))),
          )
        )
          throw new Error();
      } else if (row.packet !== undefined) throw new Error();
      if (
        row.kind === "close" &&
        (!ownArray(row.errors) ||
          !row.errors.every((error) => typeof error === "string") ||
          !["seal", "pagehide"].includes(row.reason ?? ""))
      )
        throw new Error();
      if (row.kind === "close" || row.kind === "settled") {
        if (
          !ownArray(row.pending) ||
          new Set(row.pending).size !== row.pending.length ||
          !row.pending.every(
            (index) =>
              Number.isSafeInteger(index) && index >= 0 && index < row.sequence,
          ) ||
          !ownArray(row.errors) ||
          !row.errors.every((error) => typeof error === "string")
        )
          throw new Error();
        if (
          row.kind === "settled" &&
          (!Number.isSafeInteger(row.close) ||
            row.close! < 0 ||
            row.close! >= row.sequence)
        )
          throw new Error();
      } else if (
        row.pending !== undefined ||
        row.close !== undefined ||
        row.reason !== undefined
      )
        throw new Error();
      if (
        actions &&
        (!actions.has(row.generation) ||
          actions.get(row.generation) !== row.action)
      ) {
        fail("identity receipt has an unregistered action seed");
        return;
      }
      const rows =
        documents.get(row.document) ?? new Map<number, IdentityReceipt>();
      const prior = rows.get(row.sequence);
      const serialized = JSON.stringify(row);
      if (prior) {
        if (JSON.stringify(prior) !== serialized)
          fail("conflicting identity receipt sequence");
        return;
      }
      if (
        (documents.size >= MAX_DOCUMENTS && !documents.has(row.document)) ||
        count >= MAX_ROWS ||
        size + serialized.length > MAX_TEXT
      ) {
        fail("identity capture evidence capacity exceeded");
        return;
      }
      // All fixed slots and terminal arrays are now primitive own data. Clone
      // only this admitted receipt, never an arbitrary unknown payload.
      rows.set(row.sequence, structuredClone(row));
      documents.set(row.document, rows);
      size += serialized.length;
      count += 1;
      for (const error of row.errors ?? []) fail(error);
    } catch {
      fail("malformed identity transport receipt");
    }
  }
  return {
    receive,
    fail,
    expectDocuments(census: readonly DocumentSeed[]) {
      if (frozen) return;
      if (census.length > MAX_DOCUMENTS)
        fail("identity harness metadata capacity exceeded");
      expectedDocuments = census
        .slice(0, MAX_DOCUMENTS)
        .map((item) => ({ ...item }));
    },
    freeze(): IdentitySnapshot {
      if (frozen) return frozen;
      if (!documents.size) fail("identity capture has no document receipt");
      if (
        expectedDocuments &&
        (expectedDocuments.length !== documents.size ||
          expectedDocuments.some(({ document }) => !documents.has(document)))
      )
        fail("identity document census differs from observed navigations");
      for (const expected of expectedDocuments ?? []) {
        const opening = documents.get(expected.document)?.get(0);
        if (
          opening &&
          (opening.generation !== expected.generation ||
            opening.action !== expected.action)
        )
          fail("identity document bootstrap differs from navigation census");
      }
      const receipts: IdentityReceipt[] = [];
      for (const rows of documents.values()) {
        const ordered = [...rows.values()].sort(
          (a, b) => a.sequence - b.sequence,
        );
        if (ordered[0]?.kind !== "open" || ordered[0]?.sequence !== 0)
          fail("identity document opening receipt is missing");
        const closes = ordered.filter((row) => row.kind === "close");
        const close = closes[0];
        const last = ordered.at(-1);
        if (closes.length !== 1 || !close || !last)
          fail("identity document closing range is missing");
        else {
          if (last.kind !== "close" && last.kind !== "settled")
            fail("identity document closing range is missing");
          if (last.pending?.length !== 0)
            fail("identity document has unsettled producer receipts");
          if (
            last.kind === "settled" &&
            (last.close !== close.sequence ||
              last.pending?.some((index) => !close.pending?.includes(index)))
          )
            fail("identity settlement belongs to another close range");
          if (
            close.pending?.some(
              (index) =>
                !rows.has(index) ||
                ["close", "settled"].includes(rows.get(index)!.kind),
            )
          )
            fail("identity close names an unknown producer receipt");
        }
        for (let index = 0; index < ordered.length; index++) {
          const row = ordered[index]!;
          if (row.sequence !== index) fail("identity document sequence gap");
          if (
            (row.kind === "open" && index !== 0) ||
            (row.kind === "settled" &&
              (index !== ordered.length - 1 ||
                !close ||
                row.sequence !== close.sequence + 1)) ||
            (close && row.sequence > close.sequence && row.kind !== "settled")
          )
            fail("identity document has conflicting lifetime receipts");
          if (row.packet?.event === "invalid")
            fail("identity producer reported invalid evidence");
        }
        receipts.push(...ordered);
      }
      frozen = freeze({
        capture,
        receipts,
        errors: [...errors],
        complete: !errors.size,
        expectedDocuments,
      });
      return frozen;
    },
  };
}
