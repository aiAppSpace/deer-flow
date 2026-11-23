import { admitRunAdoptions, type RunAdoption } from "./identity-run-adoption";
import type { FreshPageSnapshot } from "./capture-page";
import { networkFingerprint, type NetworkSnapshot } from "./capture-network";
import {
  FIELDS,
  MAX_ROWS,
  type IdentityPacket,
  type IdentitySnapshot,
} from "./identity-receipts";
import { decodeIdentitySegment, identifyEndpoint } from "./identity-slots";
import { projectUrl } from "./wire-values";
import {
  admitMemory,
  type MemoryAdmission,
  type MemoryExpectation,
} from "./identity-memory";
import { validateIdentityClaims, type IdentityClaim } from "./identity-claims";
import {
  assignSubmissionRequests,
  inventorySubmissionRequests,
  type SubmissionOwner,
} from "./identity-request-domain";
import {
  readReplayHttpCandidate,
  type ReplayExpectation,
  type ReplayHttpCandidate,
} from "./identity-replay";
import {
  admitReplayIdentities,
  type ReplayAdmission,
} from "./identity-replay-admission";
import {
  admitHumans,
  type HumanEntity,
  type HumanExpectation,
} from "./identity-human";

import {
  readRunSources,
  type RunSourceCandidate,
  type RunSourceExpectation,
} from "./identity-run-source";
import { admitRunIdentities, type RunEntity } from "./identity-run-admission";

type Scope = {
  account: string;
  projectIntent: string | null;
  agent: string | null;
  path: string;
};
export type ThreadExpectation = Scope & {
  slot: string;
  producer: "thread:main" | "thread:agent";
  source:
    | { kind: "allocation"; reason: string; actions: readonly string[] }
    | { kind: "literal"; raw: string; draft: boolean; mock: boolean };
  requireUploadsLimits: boolean;
  adoption?: "same-raw";
};
export type IdentityExpectations = {
  scenario: string;
  state: string;
  dimension: readonly [string, string, string];
  threads: readonly ThreadExpectation[];
  humans?: readonly HumanExpectation[];
  memory?: MemoryExpectation;
  replay?: ReplayExpectation;
  runs?: readonly RunSourceExpectation[];
  runObservation?: "sdk" | "adapter";
};
export type IdentityNode = readonly [
  "identity",
  "thread" | "human" | "fact" | "submission-key" | "run",
  string,
];
export type ThreadEntity = {
  raw: string;
  identity: IdentityNode;
  literal: boolean;
  owner: string;
  allocation: number | null;
  expectation: ThreadExpectation;
  allocatedAt: number | null;
};
export type RequestIdentityDecision = {
  slot:
    | {
        kind: "response";
        name: "content-location";
        threadIdentity: IdentityNode | null;
      }
    | { kind: "path"; index: number }
    | {
        kind: "body";
        path: readonly ["input", "messages", number, "id"];
        role: "input-message";
      }
    | {
        kind: "body";
        path: readonly ["facts", number, "id"];
        role: "import-fact";
      }
    | {
        kind: "body";
        path: readonly ["metadata", "edit_message_id"];
        role: "replacement-human";
      }
    | {
        kind: "header";
        name: "idempotency-key";
        relation: "human-default" | "replay-generated";
      };
  raw: string;
  identity: IdentityNode;
};
export type IdentityRegistry = {
  sourceNetwork: NetworkSnapshot;
  sourceOrigin: string;
  sourceFingerprint: string;
  entities: readonly ThreadEntity[];
  humans: readonly HumanEntity[];
  memory: MemoryAdmission | null;
  replayCandidate: ReplayHttpCandidate | null;
  replay: ReplayAdmission | null;
  runCandidates: readonly RunSourceCandidate[];
  runs: readonly RunEntity[];
  runAdoptions: readonly RunAdoption[];
  requestDecisions: ReadonlyMap<number, readonly RequestIdentityDecision[]>;
  errors: string[];
};
type Input = {
  appBase: string;
  network: NetworkSnapshot;
  identity: IdentitySnapshot;
  freshPage: FreshPageSnapshot;
  expectations: IdentityExpectations;
};
type Definition = {
  owner: string;
  number: number;
  raw: string;
  expectation: ThreadExpectation;
  at: number;
  bindings: (string | null)[];
};
export type RegistryEvent = {
  packet: IdentityPacket;
  sequence: number;
  owner: string;
  dispatchedAt: number;
};
export type ThreadLifetime = {
  entity: ThreadEntity;
  from: number;
  until: number | null;
  retiredAt: number | null;
};
type Lease = {
  entity: ThreadEntity;
  epoch: number;
  active: boolean;
  firstSequence: number;
};
type Consumer = {
  raw: string;
  dispatchedAt: number;
  entity?: ThreadEntity;
  pending?: { key: string; sequence: number; at: number };
};
const integer = (value: unknown, minimum = 0): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= minimum;
const text = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;
const sameScope = (values: IdentityPacket["values"], expected: Scope) =>
  values.account === expected.account &&
  values.projectIntent === expected.projectIntent &&
  values.agent === expected.agent &&
  values.path === expected.path;
const localKey = (owner: string, value: string | number) =>
  JSON.stringify([owner, value]);
function scopeKey(producer: string, scope: Scope | Record<string, unknown>) {
  if (
    !text(scope.account) ||
    !text(scope.path) ||
    (scope.projectIntent !== null && !text(scope.projectIntent)) ||
    (scope.agent !== null && !text(scope.agent))
  )
    return null;
  return JSON.stringify([
    producer,
    scope.account,
    scope.projectIntent,
    scope.agent,
    scope.path,
  ]);
}

/** Thread/limits and bounded ordinary first-send admission. This pure increment
 * is not wired into aggregate capture until the remaining submission, Memory,
 * replay and ownership matrix are implemented. It does
 * not reinterpret unsupported owner transitions as a product failure. */
export function buildIdentityRegistry(input: Input): IdentityRegistry {
  const { appBase, network, identity, freshPage, expectations } = input;
  const errors = new Set<string>();
  const fail = (reason: string) => {
    errors.add(reason);
  };
  const entities: ThreadEntity[] = [];
  const humans: HumanEntity[] = [];
  let memory: MemoryAdmission | null = null;
  let replayCandidate: ReplayHttpCandidate | null = null;
  let replay: ReplayAdmission | null = null;
  let runCandidates: RunSourceCandidate[] = [];
  let runs: RunEntity[] = [];
  let runAdoptions: RunAdoption[] = [];
  const decisions = new Map<number, RequestIdentityDecision[]>();
  const finish = (): IdentityRegistry => ({
    sourceNetwork: network,
    sourceOrigin: new URL(appBase).origin,
    sourceFingerprint: networkFingerprint(network),
    entities,
    humans,
    memory,
    replayCandidate: errors.size ? null : replayCandidate,
    replay: errors.size ? null : replay,
    runCandidates: errors.size ? [] : runCandidates,
    runs: errors.size ? [] : runs,
    runAdoptions: errors.size ? [] : runAdoptions,
    requestDecisions: errors.size ? new Map() : decisions,
    errors: [...errors],
  });
  if (
    identity.receipts.length > MAX_ROWS ||
    network.requests.length > MAX_ROWS ||
    expectations.threads.length > MAX_ROWS ||
    (expectations.humans?.length ?? 0) > MAX_ROWS
  ) {
    fail("identity registry capacity exceeded");
    return finish();
  }
  const document =
    identity.expectedDocuments?.length === 1
      ? identity.expectedDocuments[0]!.document
      : null;
  if (
    !document ||
    !identity.complete ||
    identity.errors.length ||
    network.errors.length ||
    freshPage.kind !== "owned-fresh-page" ||
    !freshPage.ready ||
    freshPage.errors.length
  ) {
    fail("unresolved capture/document/fresh-page proof");
    return finish();
  }
  const origin = new URL(appBase).origin;
  const events: RegistryEvent[] = [];
  const sequences = new Set<number>();
  for (const receipt of identity.receipts) {
    if (
      receipt.capture !== identity.capture ||
      receipt.document !== document ||
      receipt.origin !== origin ||
      !integer(receipt.sequence) ||
      !Number.isFinite(receipt.dispatchedAt) ||
      receipt.dispatchedAt <= 0 ||
      sequences.has(receipt.sequence)
    ) {
      fail("inconsistent identity receipt source");
      continue;
    }
    sequences.add(receipt.sequence);
    const packet = receipt.packet;
    if (!packet) continue;
    if (
      receipt.kind !== "event" ||
      packet.capture !== identity.capture ||
      !integer(packet.instance, 1) ||
      !Number.isFinite(packet.at) ||
      packet.at <= 0 ||
      !FIELDS[packet.event] ||
      Object.keys(packet.values).length !== FIELDS[packet.event]!.length ||
      !FIELDS[packet.event]!.every((key) => Object.hasOwn(packet.values, key))
    ) {
      fail("invalid producer event shape");
      continue;
    }
    const thread =
      packet.producer === "thread:main" || packet.producer === "thread:agent";
    if (
      (packet.event.startsWith("thread.") ||
        packet.event.startsWith("lease.") ||
        packet.event === "uploads.limits") &&
      !thread
    ) {
      fail("thread event belongs to another producer");
      continue;
    }
    if (packet.event === "uploads.unowned" && packet.producer !== "uploads") {
      fail("unowned upload event belongs to another producer");
      continue;
    }
    if (packet.event === "invalid") {
      fail("producer reported invalid evidence");
      continue;
    }
    events.push({
      packet,
      sequence: receipt.sequence,
      owner: JSON.stringify([document, packet.producer, packet.instance]),
      dispatchedAt: receipt.dispatchedAt,
    });
  }
  events.sort((a, b) => a.sequence - b.sequence);
  const definitions = new Map<string, Definition>();
  const definedRaw = new Map<string, Definition>();
  const expectedSlots = new Set<string>();
  const expectedScopes = new Map<string, ThreadExpectation | null>();
  for (const expected of expectations.threads) {
    const key = scopeKey(expected.producer, expected);
    if (
      !text(expected.slot) ||
      key === null ||
      expectedSlots.has(expected.slot) ||
      (expected.adoption !== undefined &&
        (expected.adoption !== "same-raw" ||
          expected.source.kind !== "allocation" ||
          expected.path !==
            (expected.producer === "thread:main"
              ? "/workspace/chats/new"
              : `/workspace/agents/${encodeURIComponent(expected.agent ?? "")}/chats/new`) ||
          (expected.producer === "thread:main"
            ? expected.agent !== null
            : !text(expected.agent))))
    )
      fail("invalid or duplicate independent thread slot");
    expectedSlots.add(expected.slot);
    if (key !== null) {
      if (expectedScopes.has(key)) {
        fail("ambiguous independent thread scope");
        expectedScopes.set(key, null);
      } else expectedScopes.set(key, expected);
    }
  }
  const expectedFor = (packet: IdentityPacket) => {
    const key = scopeKey(packet.producer, packet.values);
    const expected = key === null ? null : expectedScopes.get(key);
    if (!expected) {
      fail("unresolved independent thread scope or unsupported transition");
      return;
    }
    return expected;
  };
  // Definitions and bindings describe source facts; their delivery can follow
  // Vue's actual candidate query or React's layout selection. Do not time-sort.
  for (const { packet, owner } of events) {
    if (packet.event !== "thread.allocate") continue;
    const v = packet.values;
    const expected = expectedFor(packet);
    if (
      !expected ||
      expected.source.kind !== "allocation" ||
      !integer(v.allocation) ||
      !text(v.raw) ||
      v.reason !== expected.source.reason ||
      packet.action === null ||
      !expected.source.actions.includes(packet.action)
    ) {
      fail("unresolved thread allocation source");
      continue;
    }
    const key = localKey(owner, v.allocation),
      rawKey = localKey(owner, v.raw);
    if (definitions.has(key) || definedRaw.has(rawKey)) {
      fail("duplicate thread allocation source");
      continue;
    }
    const definition: Definition = {
      owner,
      number: v.allocation,
      raw: v.raw,
      expectation: expected,
      at: packet.at,
      bindings: [],
    };
    definitions.set(key, definition);
    definedRaw.set(rawKey, definition);
  }
  for (const { packet, owner } of events) {
    if (packet.event !== "thread.bind") continue;
    const v = packet.values;
    const definition = integer(v.allocation)
      ? definitions.get(localKey(owner, v.allocation))
      : undefined;
    if (
      !definition ||
      v.raw !== definition.raw ||
      (v.project !== null && !text(v.project)) ||
      v.project !== definition.expectation.projectIntent
    ) {
      fail("unresolved or conflicting allocation binding");
      continue;
    }
    definition.bindings.push(v.project);
  }
  const byRaw = new Map<string, ThreadEntity>(),
    bySemantic = new Map<string, ThreadEntity>();
  const byExpectation = new Map<ThreadExpectation, ThreadEntity>();
  const selected = new Map<string, ThreadEntity>();
  const lifetimes: ThreadLifetime[] = [];
  const activeLifetime = new Map<string, ThreadLifetime>();
  const presentations = new Map<string, { path: string; draft: boolean }>();
  const leases = new Map<string, Lease>();
  const activeLease = new Map<string, string>();
  const consumers: Consumer[] = [];
  const admit = (
    owner: string,
    raw: string,
    expected: ThreadExpectation,
    definition?: Definition,
  ) => {
    const semantic = JSON.stringify([
      expectations.scenario,
      expectations.state,
      expectations.dimension,
      expected.producer,
      expected.account,
      expected.projectIntent,
      expected.agent,
      expected.slot,
    ]);
    const prior = byRaw.get(raw),
      occupied = bySemantic.get(semantic);
    if (prior) {
      if (
        prior.owner !== owner ||
        prior.allocation !== (definition?.number ?? null) ||
        prior.identity[2] !== semantic
      ) {
        fail("raw identity claimed by conflicting sources");
        return;
      }
      return prior;
    }
    if (occupied) {
      fail("distinct raw identities occupy one semantic slot");
      return;
    }
    const entity: ThreadEntity = {
      raw,
      identity: ["identity", "thread", semantic],
      owner,
      allocation: definition?.number ?? null,
      literal: expected.source.kind === "literal",
      expectation: expected,
      allocatedAt: definition?.at ?? null,
    };
    byRaw.set(raw, entity);
    bySemantic.set(semantic, entity);
    byExpectation.set(expected, entity);
    entities.push(entity);
    return entity;
  };
  // Replay actual selection and retirement intervals in this document's
  // dispatch order. Cached allocation origin timestamps are never this order.
  for (const { packet, owner, sequence, dispatchedAt } of events) {
    const v = packet.values;
    switch (packet.event) {
      case "thread.allocate":
      case "thread.bind":
        break;
      case "thread.select": {
        const previous = selected.get(owner);
        const presentation = presentations.get(owner);
        const sameEntityAdoption =
          previous?.expectation.adoption === "same-raw" &&
          previous.raw === v.raw &&
          v.account === previous.expectation.account &&
          v.agent === previous.expectation.agent &&
          v.projectIntent === previous.expectation.projectIntent;
        const expected = sameEntityAdoption
          ? previous.expectation
          : expectedFor(packet);
        if (sameEntityAdoption) {
          const persistedPath =
            previous.expectation.path.slice(0, -3) +
            encodeURIComponent(previous.raw);
          if (
            !presentation ||
            (v.path !== persistedPath &&
              !(
                v.path === expected!.path &&
                presentation.path === expected!.path
              )) ||
            (v.draft === true &&
              (v.path !== expected!.path || !presentation.draft))
          ) {
            fail("invalid same-thread adoption presentation");
            break;
          }
        }
        if (
          !expected ||
          !text(v.raw) ||
          typeof v.draft !== "boolean" ||
          typeof v.mock !== "boolean"
        ) {
          fail("invalid thread selection");
          break;
        }
        const definition = definedRaw.get(localKey(owner, v.raw));
        if (
          expected.source.kind === "allocation"
            ? !definition ||
              !definition.bindings.length ||
              (!v.draft && !sameEntityAdoption) ||
              v.mock
            : v.raw !== expected.source.raw ||
              v.draft !== expected.source.draft ||
              v.mock !== expected.source.mock
        ) {
          fail("thread selection has no admitted source");
          break;
        }
        if (
          previous &&
          (previous.raw !== v.raw || previous.expectation !== expected)
        ) {
          fail("unresolved thread replacement without retirement");
          break;
        }
        const entity = admit(owner, v.raw, expected, definition);
        if (entity) {
          if (!previous) {
            const lifetime = {
              entity,
              from: sequence,
              until: null,
              retiredAt: null,
            };
            lifetimes.push(lifetime);
            activeLifetime.set(owner, lifetime);
          }
          selected.set(owner, entity);
          presentations.set(owner, { path: v.path as string, draft: v.draft });
        }
        break;
      }
      case "thread.prepared": {
        const active = selected.get(owner);
        if (
          !active ||
          active.literal ||
          active.expectation.adoption !== "same-raw" ||
          v.raw !== active.raw ||
          v.prepared !== active.raw
        )
          fail("prepared thread has no exact same-raw selected source");
        break;
      }
      case "thread.retire": {
        const active = selected.get(owner);
        if (
          !active ||
          v.raw !== active.raw ||
          v.account !== active.expectation.account ||
          v.agent !== active.expectation.agent
        )
          fail("retirement does not belong to the selected thread");
        if (activeLease.has(owner)) {
          fail("thread retired before its selected lease");
          leases.get(activeLease.get(owner)!)!.active = false;
          activeLease.delete(owner);
        }
        selected.delete(owner);
        const lifetime = activeLifetime.get(owner);
        if (lifetime) {
          lifetime.until = sequence;
          lifetime.retiredAt = dispatchedAt;
        }
        activeLifetime.delete(owner);
        presentations.delete(owner);
        break;
      }
      case "lease.select": {
        const active = selected.get(owner);
        if (
          !active ||
          !integer(v.lease, 1) ||
          !integer(v.epoch, 1) ||
          (v.allocation !== null && !integer(v.allocation)) ||
          active.raw !== v.raw ||
          active.allocation !== v.allocation ||
          !sameScope(v, {
            ...active.expectation,
            path: presentations.get(owner)?.path ?? "",
          })
        ) {
          fail("lease selection has no exact active thread source");
          break;
        }
        const key = localKey(owner, v.lease),
          previous = leases.get(key);
        if (
          activeLease.has(owner) ||
          (previous
            ? previous.active ||
              previous.epoch + 1 !== v.epoch ||
              previous.entity !== active
            : v.epoch !== 1)
        ) {
          fail("invalid lease epoch transition");
          break;
        }
        leases.set(key, {
          entity: active,
          epoch: v.epoch,
          active: true,
          firstSequence: previous?.firstSequence ?? sequence,
        });
        activeLease.set(owner, key);
        break;
      }
      case "lease.retire": {
        const lease = integer(v.lease, 1)
          ? leases.get(localKey(owner, v.lease))
          : undefined;
        if (
          !lease ||
          !lease.active ||
          !integer(v.epoch, 1) ||
          lease.epoch !== v.epoch ||
          activeLease.get(owner) !== localKey(owner, v.lease as number)
        )
          fail("invalid lease retirement");
        else {
          lease.active = false;
          activeLease.delete(owner);
        }
        break;
      }
      case "uploads.unowned":
        fail("unowned uploads consumer");
        if (text(v.raw)) consumers.push({ raw: v.raw, dispatchedAt });
        break;
      case "human.allocate":
      case "human.reuse":
      case "human.submission":
        // All human events are validated together below, without prefiltering
        // to the expected raw, action, header or successful request.
        break;
      case "memory.choice":
      case "memory.fact":
      case "memory.select":
      case "memory.retire":
      case "memory.dispatch":
        // The complete Memory domain is validated below, including bad consumers.
        break;
      case "replay.begin":
      case "replay.reference":
      case "replay.message":
      case "replay.source":
      case "replay.snapshot":
      case "replay.adopt":
      case "replay.submission":
      case "replay.retire":
      case "replay.failure":
      case "replay.finish":
      case "idempotency.allocate":
        // Read the complete replay domain below; no raw identity is granted by
        // merely allowing an event to reach its dedicated validator.
        break;
      case "run.bind":
      case "run.called":
      case "run.received":
      case "run.delivered":
      case "run.retire":
      case "run.unowned":
        // The complete runtime phase domain must pass its dedicated admission
        // below. Merely recognizing these event names grants no permission.
        break;
      case "uploads.limits": {
        if (!text(v.raw) || !integer(v.lease, 1) || !integer(v.epoch)) {
          fail("invalid uploads consumer fields");
          break;
        }
        const consumer: Consumer = { raw: v.raw, dispatchedAt };
        consumers.push(consumer);
        const key = localKey(owner, v.lease),
          lease = leases.get(key);
        if (v.state === "candidate" && v.epoch === 0 && !lease)
          consumer.pending = { key, sequence, at: packet.at };
        else if (
          v.state === "selected" &&
          lease?.active &&
          lease.epoch === v.epoch &&
          lease.entity.raw === v.raw &&
          selected.get(owner) === lease.entity
        )
          consumer.entity = lease.entity;
        else fail("consumer is retired, unselected or using another lease raw");
        break;
      }
      default:
        fail(
          `unresolved event outside initial thread admission: ${packet.event}`,
        );
    }
  }
  for (const consumer of consumers) {
    if (!consumer.pending) continue;
    const lease = leases.get(consumer.pending.key);
    if (
      !lease ||
      lease.firstSequence <= consumer.pending.sequence ||
      lease.entity.raw !== consumer.raw ||
      (lease.entity.literal
        ? lease.entity.expectation.source.kind !== "literal" ||
          lease.entity.expectation.source.raw !== consumer.raw
        : lease.entity.allocation === null ||
          lease.entity.allocatedAt === null ||
          lease.entity.allocatedAt > consumer.pending.at)
    ) {
      fail("candidate consumer has no exact later first selection");
      continue;
    }
    consumer.entity = lease.entity;
  }
  const uses = new Map<string, Consumer[]>();
  for (const consumer of consumers) {
    const group = uses.get(consumer.raw) ?? [];
    group.push(consumer);
    uses.set(consumer.raw, group);
  }
  const requests = new Map<
    string,
    { sequence: number; index: number; startedAt: number | null }[]
  >();
  const requestSequences = new Set<number>();
  for (const row of network.requests) {
    if (!integer(row.sequence) || requestSequences.has(row.sequence)) {
      fail("duplicate network request sequence");
      continue;
    }
    requestSequences.add(row.sequence);
    const url = projectUrl(row.url, appBase);
    const slots = url && identifyEndpoint(row.method, url);
    if (!url || !slots || slots.operation !== "uploads-limits") continue;
    const index = slots.pathSlots[0]!.index;
    const segment = decodeIdentitySegment(url.path[index]!);
    if (
      !segment.raw ||
      !segment.canonical ||
      row.source !== "main-frame" ||
      row.navigation !== false ||
      row.startedAt === null ||
      !Number.isFinite(row.startedAt) ||
      row.startedAt <= 0
    ) {
      fail("unresolved uploads request origin, encoding or timing");
      continue;
    }
    const group = requests.get(segment.raw) ?? [];
    group.push({ sequence: row.sequence, index, startedAt: row.startedAt });
    requests.set(segment.raw, group);
  }
  // Every compatible consumer participates. Missing receipt headers/body cannot
  // be invented to discard a bad candidate. No arrival-order pairing is made.
  for (const raw of new Set([...uses.keys(), ...requests.keys()])) {
    const group = uses.get(raw) ?? [],
      requestGroup = requests.get(raw) ?? [];
    const entity = group[0]?.entity;
    if (
      !entity ||
      !group.length ||
      group.length !== requestGroup.length ||
      group.some((use) => use.entity !== entity)
    ) {
      fail("unresolved uploads consumer/request group");
      continue;
    }
    if (
      entity.allocatedAt !== null &&
      requestGroup.some((row) => row.startedAt! < entity.allocatedAt!)
    ) {
      fail("request timing cannot exclude a request preceding its allocation");
      continue;
    }
    // A known raw is not permission to borrow a request that predates its
    // consumer. Prefix counts reject impossible timing for both generated and
    // independently literal sources; they do not assign request/consumer pairs.
    const dispatches = group
      .map((use) => use.dispatchedAt)
      .sort((a, b) => a - b);
    const starts = requestGroup
      .map((row) => row.startedAt!)
      .sort((a, b) => a - b);
    let available = 0;
    let feasible = true;
    for (const [index, start] of starts.entries()) {
      while (available < dispatches.length && dispatches[available]! <= start)
        available += 1;
      if (available < index + 1) feasible = false;
    }
    if (!feasible) {
      fail("uploads request timing precedes enough observed consumers");
      continue;
    }
    if (!entity.literal)
      for (const row of requestGroup)
        decisions.set(row.sequence, [
          {
            slot: { kind: "path", index: row.index },
            raw,
            identity: entity.identity,
          },
        ]);
  }
  const consumedExpectations = new Set(
    consumers.flatMap((use) => (use.entity ? [use.entity.expectation] : [])),
  );
  for (const expected of expectations.threads) {
    const entity = byExpectation.get(expected);
    if (
      !entity ||
      (expected.requireUploadsLimits && !consumedExpectations.has(expected))
    )
      fail(`required initial thread/consumer missing: ${expected.slot}`);
  }
  const submissionOwners: SubmissionOwner[] = (
    expectations.humans ?? []
  ).flatMap((human) => {
    const thread = entities.find(
      (entity) => entity.expectation.slot === human.threadSlot,
    );
    return thread
      ? [{ kind: "human" as const, slot: human.slot, thread: thread.raw }]
      : [];
  });
  if (expectations.replay) {
    const thread = entities.find(
      (entity) => entity.expectation.slot === expectations.replay!.threadSlot,
    );
    if (thread)
      submissionOwners.push({
        kind: expectations.replay.source.kind,
        slot: expectations.replay.slot,
        thread: thread.raw,
      });
  }
  const submissionDomain = assignSubmissionRequests(
    inventorySubmissionRequests(network, appBase),
    submissionOwners,
  );
  submissionDomain.errors.forEach(fail);
  const humanResult = admitHumans({
    appBase,
    requests: [...submissionDomain.groups].flatMap(([owner, candidates]) =>
      owner.kind === "human" ? candidates : [],
    ),
    expectations: expectations.humans ?? [],
    events,
    entities,
    lifetimes,
    claimedThreadRaws: new Set(
      [...definitions.values()].map((value) => value.raw),
    ),
  });
  humans.push(...humanResult.entities);
  humanResult.errors.forEach(fail);
  for (const [sequence, additions] of humanResult.decisions) {
    if (decisions.has(sequence))
      fail("request belongs to conflicting identity consumers");
    else decisions.set(sequence, additions);
  }
  const replayResult = readReplayHttpCandidate({
    appBase,
    events,
    entities,
    lifetimes,
    expectation: expectations.replay,
    requests: [...submissionDomain.groups].flatMap(([owner, candidates]) =>
      owner.kind !== "human" ? candidates : [],
    ),
  });
  replayResult.errors.forEach(fail);
  replayCandidate = replayResult.candidate;
  const replayIdentities = admitReplayIdentities({
    candidate: replayCandidate,
    expectation: expectations.replay,
    events,
  });
  replayIdentities.errors.forEach(fail);
  replay = replayIdentities.admission;
  for (const [sequence, additions] of replayIdentities.decisions) {
    if (decisions.has(sequence))
      fail("request belongs to conflicting identity consumers");
    else decisions.set(sequence, additions);
  }
  const memoryResult = admitMemory({
    appBase,
    network,
    events,
    expectation: expectations.memory,
    scenario: expectations.scenario,
    state: expectations.state,
    dimension: expectations.dimension,
  });
  memory = memoryResult.admission;
  memoryResult.errors.forEach(fail);
  for (const [sequence, additions] of memoryResult.decisions) {
    if (decisions.has(sequence))
      fail("request belongs to conflicting identity consumers");
    else decisions.set(sequence, additions);
  }
  // Run response proof belongs to the existing submit, so its one fixed
  // response decision is appended to that submit's body/header decisions.
  const runSources = readRunSources({
    appBase,
    network,
    registry: finish(),
    expectations: expectations.runs ?? [],
  });
  runSources.errors.forEach(fail);
  runCandidates = runSources.candidates;
  const runIdentities = admitRunIdentities({
    registry: finish(),
    candidates: runCandidates,
  });
  runIdentities.errors.forEach(fail);
  runs = runIdentities.entities;
  for (const [sequence, additions] of runIdentities.decisions)
    decisions.set(sequence, [...(decisions.get(sequence) ?? []), ...additions]);
  // Definitions share one conflict domain across kinds, including unconsumed
  // thread/human allocations and literal Memory references. It grants no slots.
  const selectedDefinitions = new Map(
    entities.map((entity) => [
      localKey(entity.owner, entity.allocation ?? "literal"),
      entity,
    ]),
  );
  const claims: IdentityClaim[] = [...definitions.values()].map(
    (definition) => ({
      raw: definition.raw,
      kind: "thread",
      account: definition.expectation.account,
      literal: false,
      source: localKey(definition.owner, definition.number),
      identity:
        selectedDefinitions.get(localKey(definition.owner, definition.number))
          ?.identity ?? null,
    }),
  );
  for (const entity of entities)
    if (entity.literal)
      claims.push({
        raw: entity.raw,
        kind: "thread",
        account: entity.expectation.account,
        literal: true,
        source: entity.owner,
        identity: entity.identity,
      });
  const selectedHumans = new Map(
    humans.map((entity) => [entity.allocationSequence, entity]),
  );
  for (const event of events)
    if (
      event.packet.event === "human.allocate" &&
      text(event.packet.values.raw)
    ) {
      const human = selectedHumans.get(event.sequence);
      claims.push({
        raw: event.packet.values.raw,
        kind: "human",
        source: event.owner,
        literal: false,
        account: human?.thread.expectation.account ?? "unresolved",
        identity: human?.identity ?? null,
      });
    }
  validateIdentityClaims([
    ...claims,
    ...memoryResult.claims,
    ...replayIdentities.claims,
    ...runIdentities.claims,
  ]).forEach(fail);
  const runAdoptionResult = admitRunAdoptions({
    registry: finish(),
    events,
    transport: expectations.runObservation,
  });
  runAdoptionResult.errors.forEach(fail);
  runAdoptions = runAdoptionResult.adoptions;
  return finish();
}
