import type {
  Seed,
  IdentityPacket,
  IdentityReceipt,
  Primitive,
} from "./identity-receipts";

/** The complete function is serialized by Playwright before application setup. */
export function installIdentityDocument(seed: Seed) {
  if (window !== window.top || location.origin !== seed.origin) return;
  const host = window as unknown as Record<string, unknown>;
  // A racing second seed must not silently replace an already active document.
  const priorControl = Object.getOwnPropertyDescriptor(host, seed.control)
    ?.value as
    | { capture?: string; bootstrapGeneration?: number; seedConflict?(): void }
    | undefined;
  if (priorControl) {
    if (
      priorControl.capture === seed.capture &&
      priorControl.bootstrapGeneration !== seed.generation
    )
      priorControl.seedConflict?.();
    return;
  }
  const documentId = Array.from(
    crypto.getRandomValues(new Uint32Array(4)),
    (value) => value.toString(16).padStart(8, "0"),
  ).join("");
  const capability = { version: 1, token: seed.capture, action: seed.action };
  const rows: IdentityReceipt[] = [];
  const errors = new Set<string>();
  const pending = new Map<number, Promise<void>>();
  const acknowledged = new Set<number>();
  let terminal: Promise<void> | undefined;
  let size = 0;
  let closed = false;
  let generation = seed.generation;
  let sent = 0;
  const now = () => performance.timeOrigin + performance.now();
  function own(value: unknown, name: string): unknown {
    if (!value || typeof value !== "object") throw new Error("object expected");
    const descriptor = Object.getOwnPropertyDescriptor(value, name);
    if (!descriptor || !("value" in descriptor))
      throw new Error("data field expected");
    return descriptor.value;
  }
  function packet(value: unknown): IdentityPacket {
    const event = own(value, "event");
    const producer = own(value, "producer");
    const capture = own(value, "capture");
    const at = own(value, "at");
    const instance = own(value, "instance");
    const action = own(value, "action");
    if (
      own(value, "version") !== 1 ||
      capture !== seed.capture ||
      typeof event !== "string" ||
      !Object.hasOwn(seed.fields, event) ||
      typeof producer !== "string" ||
      !seed.producers.includes(producer) ||
      typeof at !== "number" ||
      !Number.isFinite(at) ||
      at <= 0 ||
      typeof instance !== "number" ||
      !Number.isSafeInteger(instance) ||
      instance <= 0 ||
      (action !== null && typeof action !== "string")
    )
      throw new Error("invalid packet");
    const source = own(value, "values");
    const fields = seed.fields[event]!;
    if (
      !source ||
      typeof source !== "object" ||
      Array.isArray(source) ||
      Object.keys(source).length !== fields.length
    )
      throw new Error("invalid values");
    const values: Record<string, Primitive> = {};
    for (const key of fields) {
      const item = own(source, key);
      if (!(
        item === null ||
        typeof item === "string" ||
        typeof item === "boolean" ||
        (typeof item === "number" && Number.isFinite(item))
      ))
        throw new Error("invalid primitive");
      values[key] = item;
    }
    return {
      version: 1,
      capture,
      action,
      at,
      instance,
      producer,
      event,
      values,
    };
  }
  function flush() {
    const binding = Object.getOwnPropertyDescriptor(host, seed.binding)
      ?.value as unknown;
    if (typeof binding !== "function") return;
    while (sent < rows.length) {
      const row = rows[sent++]!;
      // close/settled are finite terminal certificates. Their arrival at Node
      // is the endpoint; acknowledging their ACK would recurse without end.
      if (row.kind === "close" || row.kind === "settled") {
        try {
          void Promise.resolve(binding(row) as unknown).catch(() => undefined);
        } catch {
          errors.add("identity terminal delivery threw");
        }
        continue;
      }
      try {
        const receipt = Promise.resolve(binding(row) as unknown).then(
          (ack) => {
            if (ack !== `${documentId}:${row.sequence}`)
              errors.add("identity transport acknowledgement mismatch");
            else acknowledged.add(row.sequence);
          },
          () => {
            errors.add("identity transport delivery rejected");
          },
        );
        pending.set(row.sequence, receipt);
        void receipt.finally(() => pending.delete(row.sequence));
      } catch {
        errors.add("identity transport delivery threw");
      }
    }
  }
  function append(
    kind: IdentityReceipt["kind"],
    extra: Partial<IdentityReceipt> = {},
  ) {
    const row: IdentityReceipt = {
      version: 1,
      capture: seed.capture,
      document: documentId,
      origin: seed.origin,
      generation,
      sequence: rows.length,
      dispatchedAt: now(),
      action: capability.action,
      kind,
      ...extra,
    };
    const length = JSON.stringify(row).length;
    // Reserve two slots for the close and optional settled certificates.
    if (
      kind !== "close" &&
      kind !== "settled" &&
      (rows.length >= seed.maxRows - 2 || size + length > seed.maxText)
    ) {
      errors.add("identity document evidence capacity exceeded");
      return;
    }
    size += length;
    rows.push(row);
    flush();
  }
  function receive(event: Event) {
    if (closed) return;
    try {
      append("event", { packet: packet((event as CustomEvent).detail) });
    } catch {
      errors.add("invalid identity packet");
    }
  }
  function seal(reason: "seal" | "pagehide") {
    if (!closed) {
      closed = true;
      window.removeEventListener(seed.event, receive);
      if (
        Object.getOwnPropertyDescriptor(host, seed.capability)?.value ===
        capability
      )
        Reflect.deleteProperty(host, seed.capability);
      const unacknowledged = () =>
        rows
          .filter(
            (row) =>
              row.kind !== "close" &&
              row.kind !== "settled" &&
              !acknowledged.has(row.sequence),
          )
          .map((row) => row.sequence);
      const close = rows.length;
      const waiting = unacknowledged();
      append("close", { reason, errors: [...errors], pending: waiting });
      if (waiting.length)
        terminal = Promise.allSettled([...pending.values()]).then(() => {
          append("settled", {
            close,
            pending: unacknowledged(),
            errors: [...errors],
          });
        });
    }
    flush();
    // Copy the complete finite range; binding ACK is not a cross-channel fence.
    return {
      rows: rows.map((row) => structuredClone(row)),
      errors: [...errors],
      document: documentId,
      closed,
    };
  }
  const pagehide = () => {
    seal("pagehide");
  };
  const pageshow = (event: PageTransitionEvent) => {
    if (event.persisted) {
      errors.add(
        "identity document restored from bfcache without a fresh capture",
      );
      // Preserve the invalid restored segment even if it is navigated away
      // before Node's final seal. A post-close row fails lifetime validation.
      append("action", { errors: [...errors] });
      // A frozen realm cannot be cleaned by a later page's dispose. Once it
      // resumes, release only this collector's control and lifecycle listeners.
      // Its original capture token stays intact; a replacement binding must
      // reject it instead of accepting it as evidence for the new capture.
      control.dispose();
    }
  };
  const control = {
    capture: seed.capture,
    bootstrapGeneration: seed.generation,
    describe: () => ({
      capture: seed.capture,
      document: documentId,
      origin: location.origin,
      protocol: location.protocol,
      closed,
      bootstrapGeneration: seed.generation,
      bootstrapAction: seed.action,
    }),
    seedConflict() {
      errors.add("identity document initialized by conflicting action seeds");
      append("action", { errors: [...errors] });
    },
    action(next: string, nextGeneration: number) {
      if (closed) throw new Error("Identity document is already sealed");
      capability.action = next;
      generation = nextGeneration;
      append("action");
      flush();
    },
    handshake: flush,
    seal,
    async drain() {
      flush();
      await terminal;
      return seal("seal");
    },
    dispose() {
      const result = seal("seal");
      window.removeEventListener("pagehide", pagehide);
      window.removeEventListener("pageshow", pageshow);
      if (
        Object.getOwnPropertyDescriptor(host, seed.control)?.value === control
      )
        Reflect.deleteProperty(host, seed.control);
      return result;
    },
  };
  window.addEventListener(seed.event, receive);
  window.addEventListener("pagehide", pagehide);
  window.addEventListener("pageshow", pageshow);
  Object.defineProperty(host, seed.control, {
    configurable: true,
    value: control,
  });
  append("open");
  Object.defineProperty(host, seed.capability, {
    configurable: true,
    value: capability,
  });
  // Binding and collector init-script ordering is unspecified. The complete
  // document queue survives until handshake/seal even if this attempt is early.
  queueMicrotask(flush);
}
