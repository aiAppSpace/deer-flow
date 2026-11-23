/** Versioned, default-off browser evidence. This is not an authentication or
 * extension API: only the test harness installs the capability and listener.
 * No product state, request or identity is returned or modified by observers. */
export const PARITY_OBSERVATION_CAPABILITY = "__deerflow_parity_capture_v1__";
export const PARITY_OBSERVATION_EVENT = "deerflow:parity-identity:v1";

export type ObservationPoint = Readonly<{
  capture: string;
  action: string | null;
  at: number;
}>;
export type ObservationValues = Readonly<
  Record<string, string | number | boolean | null>
>;
export type ObservationPacket = ObservationPoint &
  Readonly<{
    version: 1;
    instance: number;
    producer: string;
    event: string;
    values: ObservationValues;
  }>;

// Local diagnostic correlation only. Never a cross-application entity key;
// the counter does not advance unless a capture is explicitly enabled.
let nextInstance = 0;

function capability(): { token: string; action: string | null } | null {
  if (typeof window === "undefined") return null;
  try {
    const value: unknown = Object.getOwnPropertyDescriptor(
      window,
      PARITY_OBSERVATION_CAPABILITY,
    )?.value;
    if (!value || typeof value !== "object") return null;
    const version: unknown = Object.getOwnPropertyDescriptor(
      value,
      "version",
    )?.value;
    const token: unknown = Object.getOwnPropertyDescriptor(
      value,
      "token",
    )?.value;
    const action: unknown = Object.getOwnPropertyDescriptor(
      value,
      "action",
    )?.value;
    if (version !== 1 || typeof token !== "string" || !token) return null;
    return { token, action: typeof action === "string" ? action : null };
  } catch {
    // An absent/malformed observation capability cannot change the product.
    return null;
  }
}

/** Default-off transport taps must not read extra arguments before this check. */
export const parityObservationEnabled = () => capability() !== null;

export function createParityObserver(producer: string) {
  const initial = capability();
  if (!initial) return null;
  const instance = ++nextInstance;
  const point = (): ObservationPoint | null => {
    try {
      const current = capability();
      if (current?.token !== initial.token) return null;
      return {
        capture: initial.token,
        action: current.action,
        at: performance.timeOrigin + performance.now(),
      };
    } catch {
      return null;
    }
  };
  return {
    point,
    emit(event: string, values: ObservationValues, origin = point()) {
      if (origin?.capture !== initial.token || !point()) return;
      try {
        const detail: ObservationPacket = Object.freeze({
          ...origin,
          version: 1,
          instance,
          producer,
          event,
          values: Object.freeze({ ...values }),
        });
        window.dispatchEvent(
          new CustomEvent(PARITY_OBSERVATION_EVENT, { detail }),
        );
      } catch {
        // Publication has no control path back into rendering, identity, storage,
        // or transport. The capture validator must reject missing provenance.
      }
    },
  };
}

export type ThreadObservationScope = Readonly<{
  account: string | null;
  project: string | null;
  agent: string | null;
  path: string;
}>;

/** Opaque, local, default-off relationship passed alongside the real thread.
 * Consumers report their actual argument; this handle never supplies an ID. */
export type ThreadConsumptionObservation = Readonly<{
  uploadsLimits(raw: string): void;
}>;

/** Observe only an actual limits query invocation. Unowned calls remain visible
 * so an owned equal-URL request cannot silently authorize another consumer. */
export function observeUploadLimits(
  raw: string,
  read: () => ThreadConsumptionObservation | null | undefined,
) {
  if (!capability()) return;
  try {
    const handle = read();
    if (handle) handle.uploadsLimits(raw);
    else createParityObserver("uploads")?.emit("uploads.unowned", { raw });
  } catch {
    createParityObserver("uploads")?.emit("invalid", {
      reason: "upload consumer observation failed",
    });
  }
}

/** Candidates stay local until the owner selects their exact returned value.
 * Unused title/setup/disposal allocations never become identity definitions. */
export function createThreadObservation(surface: string) {
  const observer = createParityObserver(`thread:${surface}`);
  if (!observer) return null;
  type Candidate = {
    number: number;
    raw: string;
    origin: ObservationPoint;
    reason: string;
    intent: ThreadObservationScope;
    bindings: { project: string | null; origin: ObservationPoint }[];
    published: boolean;
  };
  const candidates: Candidate[] = [];
  type Lease = {
    number: number;
    raw: string;
    scope: ThreadObservationScope;
    candidate: Candidate | null;
    state: "candidate" | "selected" | "retired";
    epoch: number;
  };
  const leases = new WeakMap<ThreadConsumptionObservation, Lease>();
  let nextLease = 0;
  let selectedLease: Lease | null = null;
  const sameScope = (a: ThreadObservationScope, b: ThreadObservationScope) =>
    a.account === b.account &&
    a.project === b.project &&
    a.agent === b.agent &&
    a.path === b.path;
  function retireLease() {
    if (!selectedLease) return;
    selectedLease.state = "retired";
    observer?.emit("lease.retire", {
      lease: selectedLease.number,
      epoch: selectedLease.epoch,
    });
    selectedLease = null;
  }
  function confirmLease(
    raw: string,
    scope: ThreadObservationScope,
    handle?: ThreadConsumptionObservation | null,
  ) {
    const lease = handle ? leases.get(handle) : undefined;
    if (lease?.raw !== raw || !sameScope(lease.scope, scope)) {
      retireLease();
      if (handle) {
        invalid.add(
          "thread consumer lease does not belong to the selected owner",
        );
        reportInvalid();
      }
      return;
    }
    if (selectedLease === lease) return;
    retireLease();
    lease.state = "selected";
    lease.epoch += 1;
    selectedLease = lease;
    observer?.emit("lease.select", {
      lease: lease.number,
      epoch: lease.epoch,
      allocation: lease.candidate?.number ?? null,
      raw: lease.raw,
      account: scope.account,
      projectIntent: scope.project,
      agent: scope.agent,
      path: scope.path,
    });
  }
  let selected: {
    raw: string;
    draft: boolean;
    mock: boolean;
    scope: ThreadObservationScope;
  } | null = null;
  let active = false;
  let pendingBindings = 0;
  const invalid = new Set<string>();
  const reported = new Set<string>();
  function invalidCapacity() {
    // Allocation can run in a render that never commits. Record locally only.
    invalid.add("thread allocation evidence capacity exceeded");
  }
  function reportInvalid() {
    if (!active) return;
    for (const reason of invalid) {
      if (reported.has(reason)) continue;
      observer?.emit("invalid", { reason });
      reported.add(reason);
    }
  }
  function retire() {
    retireLease();
    reportInvalid();
    if (selected === null) return;
    observer?.emit("thread.retire", {
      raw: selected.raw,
      account: selected.scope.account,
      agent: selected.scope.agent,
    });
    selected = null;
  }
  return {
    lease(
      raw: string,
      scope: ThreadObservationScope,
    ): ThreadConsumptionObservation | null {
      if (!observer.point()) return null;
      const matches = candidates.filter((candidate) => candidate.raw === raw);
      const lease: Lease = {
        number: ++nextLease,
        raw,
        scope: { ...scope },
        // Capture the exact existing source now. A future allocation with the
        // same raw value cannot retroactively become this lease's provenance.
        candidate: matches.length === 1 ? matches[0]! : null,
        state: "candidate",
        epoch: 0,
      };
      const handle = Object.freeze({
        uploadsLimits(actualRaw: string) {
          const origin = observer.point();
          if (!origin) return;
          // An actual consumer is evidence even if its render never commits.
          // It remains unresolved unless this exact lease is later selected;
          // another equal-raw lease must not hide the discarded request.
          observer.emit(
            "uploads.limits",
            {
              lease: lease.number,
              epoch: lease.epoch,
              raw: actualRaw,
              state: lease.state,
            },
            origin,
          );
        },
      });
      leases.set(handle, lease);
      return handle;
    },
    resume() {
      active = true;
    },
    pause() {
      retire();
      active = false;
    },
    allocation(raw: string, reason: string, intent: ThreadObservationScope) {
      const origin = observer.point();
      if (!origin) return;
      if (candidates.length >= 256) {
        invalidCapacity();
        return;
      }
      candidates.push({
        number: candidates.length,
        raw,
        reason,
        intent: { ...intent },
        origin,
        bindings: [],
        published: false,
      });
    },
    bind(raw: string, project: string | null) {
      const origin = observer.point();
      if (!origin) return;
      const matches = candidates.filter((candidate) => candidate.raw === raw);
      for (const candidate of matches) {
        if (candidate.published && active) {
          observer.emit(
            "thread.bind",
            { allocation: candidate.number, raw, project },
            origin,
          );
          continue;
        }
        if (pendingBindings >= 512) {
          invalidCapacity();
          reportInvalid();
          return;
        }
        candidate.bindings.push({ project, origin });
        pendingBindings += 1;
      }
    },
    select(
      raw: string,
      draft: boolean,
      mock: boolean,
      scope: ThreadObservationScope,
      lease?: ThreadConsumptionObservation | null,
    ) {
      if (!active || !observer.point()) return;
      if (
        selected !== null &&
        (selected.raw !== raw ||
          selected.scope.account !== scope.account ||
          selected.scope.agent !== scope.agent)
      )
        retire();
      const matches = candidates.filter((candidate) => candidate.raw === raw);
      // A collision cannot identify which allocation actually supplied selection.
      // Preserve the selected literal, but never claim either candidate as valid.
      if (matches.length > 1)
        invalid.add("ambiguous thread allocation identity");
      reportInvalid();
      for (const candidate of matches.length === 1 ? matches : []) {
        if (!candidate.published)
          observer.emit(
            "thread.allocate",
            {
              allocation: candidate.number,
              raw,
              reason: candidate.reason,
              account: candidate.intent.account,
              projectIntent: candidate.intent.project,
              agent: candidate.intent.agent,
              path: candidate.intent.path,
            },
            candidate.origin,
          );
        for (const binding of candidate.bindings)
          observer.emit(
            "thread.bind",
            { allocation: candidate.number, raw, project: binding.project },
            binding.origin,
          );
        pendingBindings -= candidate.bindings.length;
        candidate.bindings = [];
        candidate.published = true;
      }
      if (
        selected?.raw === raw &&
        selected.draft === draft &&
        selected.mock === mock &&
        selected.scope.account === scope.account &&
        selected.scope.agent === scope.agent &&
        selected.scope.project === scope.project &&
        selected.scope.path === scope.path
      ) {
        confirmLease(raw, scope, lease);
        return;
      }
      selected = { raw, draft, mock, scope: { ...scope } };
      observer.emit("thread.select", {
        raw,
        draft,
        mock,
        account: scope.account,
        projectIntent: scope.project,
        agent: scope.agent,
        path: scope.path,
      });
      confirmLease(raw, scope, lease);
    },
    prepared(raw: string, prepared: string) {
      if (!active) return;
      reportInvalid();
      observer.emit("thread.prepared", { raw, prepared });
    },
    retire,
  };
}

/** Import normalization stays local until its exact pending object is selected.
 * Weak keys follow product state without retaining abandoned files or contents. */
export function createMemoryImportObservation() {
  const owner = createParityObserver("memory:settings");
  if (!owner) return null;
  type FactIdentity = Readonly<{
    index: number;
    raw: string;
    generated: boolean;
  }>;
  type Receipt = {
    select(): void;
    retire(): void;
    dispatch(preAborted: boolean): void;
  };
  const receipts = new WeakMap<object, Receipt>();
  const memories = new WeakMap<object, Receipt>();
  let selected: Receipt | null = null;
  return {
    begin() {
      if (!owner.point()) return null;
      const observer = createParityObserver("memory:import");
      const origin = observer?.point();
      if (!observer || !origin) return null;
      const facts: FactIdentity[] = [];
      let factCount = 0;
      let codeUnits = 0;
      let overflow = false;
      let published = false;
      const receipt: Receipt = {
        select() {
          if (!published) {
            observer.emit("memory.choice", { factCount }, origin);
            if (overflow)
              observer.emit(
                "invalid",
                { reason: "memory fact evidence capacity exceeded" },
                origin,
              );
            for (const fact of facts)
              observer.emit("memory.fact", fact, origin);
            facts.length = 0;
            published = true;
          }
          observer.emit("memory.select", { factCount });
        },
        retire() {
          observer.emit("memory.retire", {});
        },
        dispatch(preAborted) {
          observer.emit("memory.dispatch", {
            state:
              selected === receipt
                ? "selected"
                : published
                  ? "retired"
                  : "unselected",
            preAborted,
          });
        },
      };
      return {
        fact: (value: FactIdentity) => {
          factCount += 1;
          if (
            facts.length >= 4096 ||
            codeUnits + value.raw.length > 1_048_576
          ) {
            overflow = true;
            return;
          }
          codeUnits += value.raw.length;
          facts.push({
            index: value.index,
            raw: value.raw,
            generated: value.generated,
          });
        },
        retain(pending: object, memory?: object) {
          const previousPending = receipts.get(pending);
          const previousMemory = memory ? memories.get(memory) : undefined;
          if (
            (previousPending && previousPending !== receipt) ||
            (previousMemory && previousMemory !== receipt)
          ) {
            owner.emit("invalid", {
              reason: "memory import receipt cannot be rebound",
            });
            return;
          }
          receipts.set(pending, receipt);
          if (memory) memories.set(memory, receipt);
        },
      };
    },
    // A before-native-fetch attempt, not HTTP delivery or backend admission.
    dispatch: (memory: object, preAborted: boolean) => {
      if (!owner.point()) return;
      const receipt = memories.get(memory);
      if (receipt) receipt.dispatch(preAborted);
      else owner.emit("memory.dispatch", { state: "unowned", preAborted });
    },
    select(pending: object | null) {
      if (!owner.point()) return;
      const next = pending ? receipts.get(pending) : null;
      if (pending && !next) {
        selected?.retire();
        selected = null;
        owner.emit("invalid", {
          reason: "selected memory import has no source receipt",
        });
        return;
      }
      if (next === selected) return;
      selected?.retire();
      selected = next ?? null;
      selected?.select();
    },
  };
}
