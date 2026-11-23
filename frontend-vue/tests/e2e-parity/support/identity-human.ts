import { projectRequest, type RequestObservation } from "./capture-network";
import type {
  IdentityNode,
  RegistryEvent,
  RequestIdentityDecision,
  ThreadEntity,
  ThreadLifetime,
} from "./identity-registry";
import type { SubmissionRequest } from "./identity-request-domain";
import type { JsonWire } from "./wire-values";

export type HumanExpectation = {
  slot: string;
  threadSlot: string;
  assistant: string;
  source: {
    producer: "human:send" | "human:composer";
    actions: readonly string[];
  };
  submission: { slot: string; actions: readonly string[] } & (
    | { keySource: "none" }
    | { keySource: "default" }
    | { keySource: "explicit"; key: string }
  );
};
export type HumanEntity = {
  raw: string;
  identity: IdentityNode;
  thread: ThreadEntity;
  expectation: HumanExpectation;
  allocationSequence: number;
  submission: {
    sequence: number;
    sourceSequence: number;
    requestSequence: number;
    index: number;
    messageCount: number;
    keySource: "none" | "default" | "explicit";
  };
};
const text = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;
const integer = (value: unknown, minimum = 0): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= minimum;
const property = (
  node: JsonWire | undefined,
  key: string,
): JsonWire | undefined =>
  node?.[0] === "object"
    ? node[1].find(([name]) => name === key)?.[1]
    : undefined;
const string = (node: JsonWire | undefined) =>
  node?.[0] === "string" ? node[1] : undefined;
const append = <T>(map: Map<string, T[]>, key: string, value: T) => {
  const group = map.get(key) ?? [];
  group.push(value);
  map.set(key, group);
};

/** Bounded ordinary first-send admission. An independent thread slot must have
 * one stable owner lifetime, one allocation, one send and one complete request.
 * These are necessary consistency proofs, not a general transport causal ID.
 * Extra/retired/concurrent/retry candidates stay unresolved for later admission. */
export function admitHumans(input: {
  appBase: string;
  requests: readonly SubmissionRequest[];
  expectations: readonly HumanExpectation[];
  events: readonly RegistryEvent[];
  entities: readonly ThreadEntity[];
  lifetimes: readonly ThreadLifetime[];
  claimedThreadRaws: ReadonlySet<string>;
}) {
  const errors = new Set<string>();
  const fail = (message: string) => errors.add(message);
  const entities: HumanEntity[] = [];
  const decisions = new Map<number, RequestIdentityDecision[]>();
  const threads = new Map(
    input.entities.map((entity) => [entity.expectation.slot, entity]),
  );
  const expectedThreads = new Map<string, HumanExpectation>();
  const slots = new Set<string>();
  for (const expected of input.expectations) {
    const branch = expected.submission;
    if (
      !text(expected.slot) ||
      !text(expected.threadSlot) ||
      !text(expected.assistant) ||
      !text(branch.slot) ||
      !expected.source.actions.length ||
      !branch.actions.length ||
      !expected.source.actions.every(text) ||
      !branch.actions.every(text) ||
      !["human:composer", "human:send"].includes(expected.source.producer) ||
      !["none", "default", "explicit"].includes(branch.keySource) ||
      (branch.keySource === "explicit" && typeof branch.key !== "string") ||
      slots.has(expected.slot) ||
      expectedThreads.has(expected.threadSlot) ||
      !threads.has(expected.threadSlot)
    ) {
      fail("invalid or ambiguous independent human slot");
    }
    slots.add(expected.slot);
    expectedThreads.set(expected.threadSlot, expected);
  }
  const sourceGroups = new Map<string, RegistryEvent[]>();
  const threadRaws = new Set([
    ...input.claimedThreadRaws,
    ...input.entities.map((entity) => entity.raw),
  ]);
  const rawAllocations = new Set<string>();
  for (const event of input.events) {
    if (!event.packet.event.startsWith("human.")) continue;
    const { packet } = event;
    if (
      !["human:composer", "human:send"].includes(packet.producer) ||
      !text(packet.values.thread) ||
      !text(packet.values.raw)
    ) {
      fail("invalid human source producer or raw");
      continue;
    }
    append(sourceGroups, packet.values.thread, event);
    if (packet.event === "human.allocate") {
      if (
        rawAllocations.has(packet.values.raw) ||
        threadRaws.has(packet.values.raw)
      )
        fail("human raw claimed by conflicting definitions");
      rawAllocations.add(packet.values.raw);
    }
  }
  const requestGroups = new Map<
    string,
    { row: RequestObservation; index: number }[]
  >();
  for (const candidate of input.requests) {
    const { row, thread, threadIndex: index } = candidate;
    if (
      candidate.operation !== "run-submit" ||
      row.method !== "POST" ||
      !thread
    ) {
      fail("invalid request in ordinary human candidate domain");
      continue;
    }
    // The shared inventory has already assigned every candidate independently
    // of its body/key. No ordinary/replay heuristic is allowed here.
    append(requestGroups, thread, { row, index });
  }
  const claimed = new Set<string>();
  const lifetimeGroups = new Map<ThreadEntity, ThreadLifetime[]>();
  for (const lifetime of input.lifetimes) {
    const group = lifetimeGroups.get(lifetime.entity) ?? [];
    group.push(lifetime);
    lifetimeGroups.set(lifetime.entity, group);
  }
  for (const expected of input.expectations) {
    const thread = threads.get(expected.threadSlot);
    if (!thread) continue;
    claimed.add(thread.raw);
    const events = sourceGroups.get(thread.raw) ?? [];
    const requests = requestGroups.get(thread.raw) ?? [];
    const lives = lifetimeGroups.get(thread) ?? [];
    const allocations = events.filter(
      (event) => event.packet.event === "human.allocate",
    );
    const sends = events.filter(
      (event) =>
        event.packet.producer === "human:send" &&
        event.packet.event !== "human.submission",
    );
    const submissions = events.filter(
      (event) => event.packet.event === "human.submission",
    );
    const composer = expected.source.producer === "human:composer";
    if (
      lives.length !== 1 ||
      events.length !== (composer ? 3 : 2) ||
      allocations.length !== 1 ||
      sends.length !== 1 ||
      submissions.length !== 1 ||
      requests.length !== 1
    ) {
      fail(
        "unresolved single-human owner/source/submission/request candidate domain",
      );
      continue;
    }
    const allocation = allocations[0]!,
      send = sends[0]!,
      submission = submissions[0]!,
      lifetime = lives[0]!;
    const a = allocation.packet,
      s = send.packet,
      p = submission.packet,
      v = p.values;
    const within = (event: RegistryEvent) =>
      event.sequence > lifetime.from &&
      (lifetime.until === null || event.sequence < lifetime.until);
    if (
      a.producer !== expected.source.producer ||
      a.action === null ||
      !expected.source.actions.includes(a.action) ||
      s.event !== (composer ? "human.reuse" : "human.allocate") ||
      (composer ? allocation.sequence >= send.sequence : allocation !== send) ||
      p.producer !== "human:send" ||
      send.owner !== submission.owner ||
      s.at !== p.at ||
      s.action !== p.action ||
      p.action === null ||
      !expected.submission.actions.includes(p.action) ||
      send.sequence >= submission.sequence ||
      events.some(
        (event) =>
          !within(event) ||
          event.packet.values.raw !== a.values.raw ||
          event.packet.values.thread !== thread.raw,
      ) ||
      !integer(v.index) ||
      !integer(v.messageCount, 1) ||
      v.index !== v.messageCount - 1
    ) {
      fail("unresolved human allocation/send/submission ownership");
      continue;
    }
    const raw = a.values.raw as string;
    const branch = expected.submission;
    const key =
      branch.keySource === "none"
        ? null
        : branch.keySource === "default"
          ? raw
          : branch.key;
    if (v.keySource !== branch.keySource || v.key !== key) {
      fail("human submission contradicts its independent key branch");
      continue;
    }
    const { row, index } = requests[0]!;
    if (
      row.source !== "main-frame" ||
      row.navigation !== false ||
      row.startedAt === null ||
      !Number.isFinite(row.startedAt) ||
      row.startedAt <= 0 ||
      row.startedAt <
        Math.max(
          a.at,
          allocation.dispatchedAt,
          submission.dispatchedAt,
          thread.allocatedAt ?? 0,
        ) ||
      (lifetime.retiredAt !== null && row.startedAt >= lifetime.retiredAt) ||
      row.headers["idempotency-key"] !== (key || null)
    ) {
      fail(
        "human request origin, timing or key cannot prove the declared attempt",
      );
      continue;
    }
    const fact = projectRequest(row, input.appBase);
    const body = fact.body[0] === "json" ? fact.body[1] : undefined;
    const messages = property(property(body, "input"), "messages");
    const last = messages?.[0] === "array" ? messages[1][v.index] : undefined;
    const context = property(body, "context");
    const agent = property(context, "agent_name");
    if (
      messages?.[0] !== "array" ||
      messages[1].length !== v.messageCount ||
      string(property(last, "type")) !== "human" ||
      string(property(last, "id")) !== raw ||
      string(property(body, "assistant_id")) !== expected.assistant ||
      (thread.expectation.agent === null
        ? agent !== undefined
        : string(agent) !== thread.expectation.agent)
    ) {
      fail("human request body does not prove the exact declared input slot");
      continue;
    }
    const identity: IdentityNode = [
      "identity",
      "human",
      JSON.stringify([thread.identity[2], expected.slot]),
    ];
    const entity: HumanEntity = {
      raw,
      identity,
      thread,
      expectation: expected,
      allocationSequence: allocation.sequence,
      submission: {
        sequence: submission.sequence,
        sourceSequence: send.sequence,
        requestSequence: row.sequence,
        index: v.index,
        messageCount: v.messageCount,
        keySource: branch.keySource,
      },
    };
    entities.push(entity);
    const approved: RequestIdentityDecision[] = [
      {
        slot: {
          kind: "body",
          path: ["input", "messages", v.index, "id"],
          role: "input-message",
        },
        raw,
        identity,
      },
    ];
    if (!thread.literal)
      approved.push({
        slot: { kind: "path", index },
        raw: thread.raw,
        identity: thread.identity,
      });
    if (branch.keySource === "default")
      approved.push({
        slot: {
          kind: "header",
          name: "idempotency-key",
          relation: "human-default",
        },
        raw,
        identity,
      });
    decisions.set(row.sequence, approved);
  }
  for (const raw of new Set([...sourceGroups.keys(), ...requestGroups.keys()]))
    if (!claimed.has(raw))
      fail("human source or request has no independent thread/human slot");
  return {
    entities,
    decisions: errors.size
      ? new Map<number, RequestIdentityDecision[]>()
      : decisions,
    errors: [...errors],
  };
}
