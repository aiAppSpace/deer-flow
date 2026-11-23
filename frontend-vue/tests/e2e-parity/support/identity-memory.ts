import { projectRequest, type NetworkSnapshot } from "./capture-network";
import { MAX_ROWS } from "./identity-receipts";
import { identifyEndpoint } from "./identity-slots";
import { projectUrl, type JsonWire } from "./wire-values";
import type {
  IdentityNode,
  RegistryEvent,
  RequestIdentityDecision,
} from "./identity-registry";
import type { IdentityClaim } from "./identity-claims";

export type MemoryExpectation = {
  account: string;
  /** Independent fixture constraint, not an account read from a chat owner. */
  stableAccount: true;
  file: {
    slot: string;
    choiceActions: readonly string[];
    facts: readonly {
      index: number;
      source: { kind: "generated" } | { kind: "literal"; raw: string };
    }[];
  } | null;
  dispatchActions: readonly string[];
  terminal: "active" | "retired" | "absent";
};
export type MemoryFactEntity = {
  raw: string;
  identity: IdentityNode | null;
  generated: boolean;
  index: number;
  source: string;
  account: string;
};
export type MemoryAdmission = {
  expectation: MemoryExpectation;
  owner: string | null;
  facts: readonly MemoryFactEntity[];
  requests: readonly number[];
  dispatchSequences: readonly number[];
};
const text = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;
const integer = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const property = (node: JsonWire | undefined, key: string) =>
  node?.[0] === "object"
    ? node[1].find(([name]) => name === key)?.[1]
    : undefined;
const counts = (values: readonly string[]) => {
  const result = new Map<string, number>();
  for (const value of values) result.set(value, (result.get(value) ?? 0) + 1);
  return [...result].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
};

/** A single published file in an independently stable account. Multiple calls
 * of that same payload have identical source decisions; counts and time prefixes
 * exclude contradictions, without assigning Request-to-attempt causal IDs. */
export function admitMemory(input: {
  appBase: string;
  network: NetworkSnapshot;
  events: readonly RegistryEvent[];
  expectation: MemoryExpectation | undefined;
  scenario: string;
  state: string;
  dimension: readonly [string, string, string];
}) {
  const errors = new Set<string>();
  const fail = (reason: string) => errors.add(reason);
  const decisions = new Map<number, RequestIdentityDecision[]>();
  const facts: MemoryFactEntity[] = [];
  const claims: IdentityClaim[] = [];
  const requests: number[] = [];
  const dispatches: RegistryEvent[] = [];
  const events = input.events.filter((event) =>
    event.packet.event.startsWith("memory."),
  );
  const candidates = input.network.requests.filter((row) => {
    const url = projectUrl(row.url, input.appBase);
    return (
      url && identifyEndpoint(row.method, url)?.operation === "memory-import"
    );
  });
  const expected = input.expectation;
  let choice: RegistryEvent | undefined;
  const finish = () => ({
    admission: expected
      ? ({
          expectation: expected,
          owner: choice?.owner ?? null,
          facts,
          requests,
          dispatchSequences: dispatches.map((event) => event.sequence),
        } satisfies MemoryAdmission)
      : null,
    claims,
    decisions: errors.size
      ? new Map<number, RequestIdentityDecision[]>()
      : decisions,
    errors: [...errors],
  });
  if (!expected) {
    if (events.length || candidates.length)
      fail("Memory events or requests have no independent declaration");
    return finish();
  }
  const file = expected.file;
  if (
    !text(expected.account) ||
    expected.stableAccount !== true ||
    !["active", "retired", "absent"].includes(expected.terminal) ||
    expected.dispatchActions.length > MAX_ROWS ||
    !expected.dispatchActions.every(text) ||
    (file === null
      ? expected.terminal !== "absent" || expected.dispatchActions.length > 0
      : !text(file.slot) ||
        !file.choiceActions.length ||
        !file.choiceActions.every(text) ||
        expected.terminal === "absent" ||
        file.facts.length > MAX_ROWS ||
        file.facts.some(
          (fact, index) =>
            fact.index !== index ||
            !["generated", "literal"].includes(fact.source.kind) ||
            (fact.source.kind === "literal" && !text(fact.source.raw)),
        ))
  ) {
    fail("invalid or unsupported independent Memory scope");
    return finish();
  }
  let selected = false,
    everSelected = false,
    selectedAt: number | null = null;
  const defined = new Set<number>();
  for (const event of events) {
    const { packet } = event,
      v = packet.values;
    if (!file || packet.producer !== "memory:import") {
      fail("Memory consumer has no declared file receipt");
      continue;
    }
    if (packet.event === "memory.choice") {
      if (
        choice ||
        !integer(v.factCount) ||
        v.factCount !== file.facts.length ||
        packet.action === null ||
        !file.choiceActions.includes(packet.action)
      ) {
        fail("ambiguous or invalid Memory file choice");
        continue;
      }
      choice = event;
      continue;
    }
    if (
      !choice ||
      event.owner !== choice.owner ||
      event.sequence <= choice.sequence
    ) {
      fail("Memory event has no exact file source");
      continue;
    }
    switch (packet.event) {
      case "memory.fact": {
        if (
          everSelected ||
          !integer(v.index) ||
          v.index >= file.facts.length ||
          defined.has(v.index) ||
          !text(v.raw) ||
          typeof v.generated !== "boolean" ||
          packet.action !== choice.packet.action ||
          packet.at !== choice.packet.at
        ) {
          fail("invalid or duplicate Memory fact definition");
          break;
        }
        const expectedFact = file.facts[v.index]!;
        if (
          v.generated !== (expectedFact.source.kind === "generated") ||
          (expectedFact.source.kind === "literal" &&
            v.raw !== expectedFact.source.raw)
        ) {
          fail("Memory fact contradicts its independent file slot");
          break;
        }
        defined.add(v.index);
        const identity: IdentityNode | null = v.generated
          ? [
              "identity",
              "fact",
              JSON.stringify([
                input.scenario,
                input.state,
                input.dimension,
                expected.account,
                file.slot,
                v.index,
              ]),
            ]
          : null;
        const source = JSON.stringify([choice.owner, v.index]);
        facts.push({
          index: v.index,
          raw: v.raw,
          generated: v.generated,
          identity,
          source,
          account: expected.account,
        });
        claims.push({
          raw: v.raw,
          identity,
          source,
          kind: "fact",
          literal: !v.generated,
          account: expected.account,
        });
        break;
      }
      case "memory.select":
        if (
          selected ||
          defined.size !== file.facts.length ||
          v.factCount !== file.facts.length ||
          event.dispatchedAt < choice.dispatchedAt
        )
          fail("Memory selection lacks complete file facts");
        else {
          selected = true;
          everSelected = true;
          selectedAt = event.dispatchedAt;
        }
        break;
      case "memory.retire":
        if (!selected)
          fail("Memory source retired without an active selection");
        selected = false;
        selectedAt = null;
        break;
      case "memory.dispatch":
        if (
          !selected ||
          selectedAt === null ||
          event.dispatchedAt < selectedAt ||
          v.state !== "selected" ||
          v.preAborted !== false ||
          packet.action === null
        )
          fail(
            "unsupported unselected, retired, unowned or cancelled Memory dispatch",
          );
        dispatches.push(event);
        break;
      default:
        fail("unsupported Memory source event");
    }
  }
  if (
    file &&
    (!choice ||
      !everSelected ||
      defined.size !== file.facts.length ||
      selected !== (expected.terminal === "active"))
  )
    fail("Memory source lifecycle does not match the declared terminal");
  const actions = dispatches.flatMap((event) =>
    event.packet.action === null ? [] : [event.packet.action],
  );
  if (
    JSON.stringify(counts(actions)) !==
      JSON.stringify(counts(expected.dispatchActions)) ||
    candidates.length !== dispatches.length
  )
    fail("Memory dispatch/request domain is incomplete or ambiguous");
  facts.sort((a, b) => a.index - b.index);
  const starts: number[] = [];
  for (const row of candidates) {
    if (
      row.source !== "main-frame" ||
      row.navigation !== false ||
      row.startedAt === null ||
      !Number.isFinite(row.startedAt) ||
      row.startedAt <= 0
    ) {
      fail("Memory request lacks trusted public source or start time");
      continue;
    }
    starts.push(row.startedAt);
    const fact = projectRequest(row, input.appBase);
    const vector =
      fact.body[0] === "json" ? property(fact.body[1], "facts") : undefined;
    if (
      !file ||
      facts.length !== file.facts.length ||
      vector?.[0] !== "array" ||
      vector[1].length !== facts.length ||
      facts.some((entity) => {
        const id = property(vector[1][entity.index], "id");
        return id?.[0] !== "string" || id[1] !== entity.raw;
      })
    ) {
      fail("Memory request does not consume the complete declared fact vector");
      continue;
    }
    requests.push(row.sequence);
    const approved: RequestIdentityDecision[] = facts.flatMap((entity) =>
      entity.identity
        ? [
            {
              slot: {
                kind: "body",
                path: ["facts", entity.index, "id"],
                role: "import-fact",
              },
              raw: entity.raw,
              identity: entity.identity,
            },
          ]
        : [],
    );
    if (approved.length) decisions.set(row.sequence, approved);
  }
  // Prefix feasibility is only a negative constraint. No pairing is returned,
  // and neither clocks nor array/receipt order enter a semantic identity.
  const times = dispatches
    .map((event) => event.dispatchedAt)
    .sort((a, b) => a - b);
  starts.sort((a, b) => a - b);
  let available = 0;
  for (const [index, start] of starts.entries()) {
    while (available < times.length && times[available]! <= start)
      available += 1;
    if (available < index + 1)
      fail("Memory request timing precedes enough observed dispatches");
  }
  return finish();
}
