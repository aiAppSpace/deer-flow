import {
  networkFingerprint,
  projectRequest,
  summarizeRequestFacts,
  type NetworkSnapshot,
  type RequestFact,
} from "./capture-network";
import type { IdentityNode, IdentityRegistry } from "./identity-registry";
import { decodeIdentitySegment, identifyEndpoint } from "./identity-slots";
import { readRunSources } from "./identity-run-source";
import {
  runDefinitionKey,
  runOwnerBinding,
  runSemantic,
  type ProjectedRunLocation,
} from "./identity-run-admission";
import type { JsonWire, WireBody } from "./wire-values";

type ProjectedJson =
  | Exclude<JsonWire, ["array", JsonWire[]] | ["object", [string, JsonWire][]]>
  | IdentityNode
  | ["array", ProjectedJson[]]
  | ["object", [string, ProjectedJson][]];
type ProjectedBody =
  Exclude<WireBody, ["json", JsonWire]> | ["json", ProjectedJson];
function isIdentity(
  value: unknown,
  kind: IdentityNode[1],
): value is IdentityNode {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value[0] === "identity" &&
    value[1] === kind &&
    typeof value[2] === "string" &&
    value[2].length > 0
  );
}

/** Replace only the approved tagged string leaf; raw strings, arrays and all
 * siblings keep their literal tags. The parser and source capture are unchanged. */
type BodyReplacement = {
  path: readonly (string | number)[];
  raw: string;
  identity: IdentityNode;
};
function replaceLeaves(
  node: JsonWire,
  replacements: readonly BodyReplacement[],
): ProjectedJson | null {
  if (!replacements.length) return node;
  if (replacements.some((replacement) => !replacement.path.length)) {
    const value = replacements[0]!;
    return replacements.length === 1 &&
      !value.path.length &&
      node[0] === "string" &&
      node[1] === value.raw
      ? value.identity
      : null;
  }
  const groups = new Map<string | number, BodyReplacement[]>();
  for (const replacement of replacements) {
    const [key, ...path] = replacement.path;
    const group = groups.get(key!) ?? [];
    group.push({ ...replacement, path });
    groups.set(key!, group);
  }
  // Copy each shared ancestor once, so multiple generated facts do not replace
  // each other's changes or repeatedly copy the whole facts array.
  if (node[0] === "array") {
    const values: ProjectedJson[] = [...node[1]];
    for (const [key, group] of groups) {
      if (
        typeof key !== "number" ||
        !Number.isSafeInteger(key) ||
        key < 0 ||
        key >= values.length
      )
        return null;
      const child = replaceLeaves(node[1][key]!, group);
      if (child === null) return null;
      values[key] = child;
    }
    return ["array", values];
  }
  if (node[0] === "object") {
    const indexes = new Map(node[1].map(([key], index) => [key, index]));
    const entries: [string, ProjectedJson][] = [...node[1]];
    for (const [key, group] of groups) {
      const index = typeof key === "string" ? indexes.get(key) : undefined;
      if (index === undefined || typeof key !== "string") return null;
      const child = replaceLeaves(node[1][index]![1], group);
      if (child === null) return null;
      entries[index] = [key, child];
    }
    return ["object", entries];
  }
  return null;
}

/** Consume exact per-request decisions, never infer permission from equal raw
 * values. Any inconsistent decision rolls the complete three-view batch back to
 * literal facts. Unknown body/run/replay slots remain literal. */
export function projectIdentityNetwork(
  snapshot: NetworkSnapshot,
  appBase: string,
  registry: IdentityRegistry,
) {
  const literal = snapshot.requests.map((row) => projectRequest(row, appBase));
  const errors = [
    ...snapshot.errors,
    ...registry.errors.map((reason) => `identity registry: ${reason}`),
  ];
  const fail = (reason: string) =>
    errors.push(`identity projection: ${reason}`);
  if (registry.sourceNetwork !== snapshot) fail("network snapshot mismatch");
  if (registry.sourceOrigin !== new URL(appBase).origin)
    fail("app origin mismatch");
  if (registry.sourceFingerprint !== networkFingerprint(snapshot))
    fail("network snapshot changed");
  if (errors.length) return summarizeRequestFacts(literal, errors);

  // Membership checks only. These indexes cannot authorize another request or
  // another occurrence of the same raw value in a body/header.
  const threads = new Map(
    registry.entities.map((entity) => [entity.raw, entity]),
  );
  const humans = new Map(registry.humans.map((entity) => [entity.raw, entity]));
  const submissions = new Map(
    registry.humans.map((entity) => [
      entity.submission.requestSequence,
      entity,
    ]),
  );
  if (
    threads.size !== registry.entities.length ||
    humans.size !== registry.humans.length ||
    [...humans.keys()].some((raw) => threads.has(raw))
  )
    fail("duplicate admitted entity raw");
  if (submissions.size !== registry.humans.length)
    fail("duplicate admitted request submission");
  const memory = registry.memory;
  const memoryRequests = new Set(memory?.requests ?? []);
  const memoryFacts = new Map(
    memory?.facts.map((entity) => [entity.index, entity]) ?? [],
  );
  if (
    memory &&
    (memoryRequests.size !== memory.requests.length ||
      memory.requests.length !== memory.dispatchSequences.length ||
      memoryFacts.size !== memory.facts.length ||
      memory.facts.length !== (memory.expectation.file?.facts.length ?? 0))
  )
    fail("inconsistent Memory request/source membership");
  if (memory)
    for (const entity of memory.facts) {
      const expected = memory.expectation.file?.facts[entity.index];
      if (
        !expected ||
        entity.index !== expected.index ||
        entity.account !== memory.expectation.account ||
        entity.generated !== (expected.source.kind === "generated") ||
        (entity.generated
          ? !isIdentity(entity.identity, "fact")
          : entity.identity !== null ||
            expected.source.kind !== "literal" ||
            entity.raw !== expected.source.raw) ||
        threads.has(entity.raw) ||
        humans.has(entity.raw)
      )
        fail("inconsistent Memory fact membership");
    }
  const replay = registry.replay;
  const replayRequests = new Set<number>();
  if (replay) {
    const c = replay.candidate;
    replayRequests.add(c.prepare.sequence);
    replayRequests.add(c.run.sequence);
    if (
      replayRequests.size !== 2 ||
      registry.replayCandidate !== c ||
      !snapshot.requests.includes(c.prepare) ||
      !snapshot.requests.includes(c.run) ||
      threads.get(c.thread.raw) !== c.thread ||
      !c.thread.literal ||
      !isIdentity(c.thread.identity, "thread") ||
      c.expectation.account !== c.thread.expectation.account ||
      c.expectation.stableAccount !== true ||
      !["edit", "regenerate"].includes(c.expectation.source.kind) ||
      !["none", "generated"].includes(c.expectation.source.key) ||
      (c.expectation.source.kind === "edit") !== !!replay.replacement ||
      (c.expectation.source.key === "generated") !== !!replay.key ||
      [...replayRequests].some(
        (sequence) => submissions.has(sequence) || memoryRequests.has(sequence),
      )
    )
      fail("inconsistent replay request/source membership");
    const seen = new Set([
      ...threads.keys(),
      ...humans.keys(),
      ...[...memoryFacts.values()].map((value) => value.raw),
    ]);
    for (const [role, entity] of [
      ["replacement", replay.replacement],
      ["key", replay.key],
    ] as const) {
      if (!entity) continue;
      const definition = entity.definition;
      const expectedKind = role === "replacement" ? "human" : "submission-key";
      if (
        !isIdentity(entity.identity, expectedKind) ||
        entity.identity[2] !==
          JSON.stringify([c.thread.identity[2], c.expectation.slot, role]) ||
        seen.has(entity.raw) ||
        !definition ||
        !definition.packet ||
        definition.owner !== c.source.owner ||
        entity.source !==
          JSON.stringify([definition.owner, definition.sequence, role]) ||
        definition.packet.values.raw !== entity.raw ||
        (role === "replacement"
          ? entity.raw !== c.source.replacement ||
            definition.packet.event !== "replay.reference" ||
            definition.packet.values.phase !== "response" ||
            definition.packet.values.slot !== "replacement_human_message_id" ||
            definition.packet.values.valueType !== "string" ||
            definition.sequence <= c.source.begin.sequence ||
            definition.sequence >= c.source.response.sequence
          : !c.source.key ||
            entity.raw !== c.source.key.raw ||
            definition !== c.source.key.event)
      )
        fail("inconsistent replay generated source membership");
      seen.add(entity.raw);
    }
  } else if (registry.replayCandidate)
    fail("HTTP replay candidate has no identity admission record");
  const runRequests = new Map(
    registry.runs.map((entity) => [entity.candidate.request.sequence, entity]),
  );
  const rereadRuns = readRunSources({
    appBase,
    network: snapshot,
    registry,
    expectations: registry.runCandidates.map(
      (candidate) => candidate.expectation,
    ),
  });
  if (
    rereadRuns.errors.length ||
    runRequests.size !== registry.runs.length ||
    registry.runCandidates.length !== registry.runs.length ||
    new Set(registry.runs.map((entity) => entity.candidate)).size !==
      registry.runCandidates.length
  )
    fail("inconsistent run source membership");
  const runRaws = new Set([
    ...threads.keys(),
    ...humans.keys(),
    ...[...memoryFacts.values()].map((entity) => entity.raw),
    ...(replay?.replacement ? [replay.replacement.raw] : []),
    ...(replay?.key ? [replay.key.raw] : []),
    ...(replay
      ? [
          replay.candidate.expectation.source.sourceHuman,
          replay.candidate.expectation.source.wireHuman,
          replay.candidate.expectation.source.sourceAssistant,
          replay.candidate.expectation.source.oldRun,
          replay.candidate.expectation.source.checkpoint,
          ...(replay.candidate.expectation.source.versionGroup === null
            ? []
            : [replay.candidate.expectation.source.versionGroup]),
          ...(replay.candidate.expectation.source.sources.type === "array"
            ? replay.candidate.expectation.source.sources.ids
            : []),
        ]
      : []),
  ]);
  for (const entity of registry.runs) {
    const c = entity.candidate;
    const ownerBinding = runOwnerBinding(c);
    const checked = rereadRuns.candidates.find(
      (candidate) => candidate.expectation === c.expectation,
    );
    if (
      !registry.runCandidates.includes(c) ||
      !checked ||
      checked.request !== c.request ||
      checked.thread !== c.thread ||
      checked.submission.kind !== c.submission.kind ||
      checked.submission.entity !== c.submission.entity ||
      JSON.stringify(checked.location) !== JSON.stringify(c.location) ||
      threads.get(c.thread.raw) !== c.thread ||
      !isIdentity(c.thread.identity, "thread") ||
      entity.raw !== c.location.run.raw ||
      entity.source !== runDefinitionKey(c.request.sequence) ||
      ownerBinding === null ||
      entity.ownerBinding !== ownerBinding ||
      !isIdentity(entity.identity, "run") ||
      JSON.stringify(entity.identity) !== JSON.stringify(runSemantic(c)) ||
      runRaws.has(entity.raw)
    )
      fail("inconsistent created run entity or response source");
    runRaws.add(entity.raw);
  }
  const facts: RequestFact<
    string | IdentityNode,
    ProjectedBody,
    string | null | IdentityNode,
    string | null | ProjectedRunLocation
  >[] = [];
  const sequences = new Set<number>();
  for (const [index, row] of snapshot.requests.entries()) {
    const fact = literal[index]!;
    if (sequences.has(row.sequence)) fail("duplicate request sequence");
    sequences.add(row.sequence);
    const decisions = registry.requestDecisions.get(row.sequence) ?? [];
    if (registry.requestDecisions.has(row.sequence) && !decisions.length)
      fail("empty request decision");
    const endpoint = identifyEndpoint(row.method, fact.url);
    const path: (string | IdentityNode)[] = [...fact.url.path];
    let body: ProjectedBody = fact.body;
    let response: (typeof facts)[number]["response"] = fact.response;
    let key: string | null | IdentityNode = fact.headers["idempotency-key"];
    const applied = new Set<string>();
    const replacements: BodyReplacement[] = [];
    for (const decision of decisions) {
      if (decision.slot.kind === "response") {
        const run = runRequests.get(row.sequence);
        const threadIdentity = run?.candidate.thread.literal
          ? null
          : run?.candidate.thread.identity;
        if (
          !run ||
          !fact.response ||
          decision.slot.name !== "content-location" ||
          applied.has("run-location") ||
          decision.raw !== run.candidate.location.raw ||
          fact.response.headers["content-location"] !== decision.raw ||
          JSON.stringify(decision.identity) !== JSON.stringify(run.identity) ||
          JSON.stringify(decision.slot.threadIdentity) !==
            JSON.stringify(threadIdentity)
        ) {
          fail("response location decision has no exact run and thread source");
          continue;
        }
        const location = run.candidate.location;
        response = {
          ...fact.response,
          headers: {
            ...fact.response.headers,
            "content-location": [
              "run-location",
              location.prefix,
              decision.slot.threadIdentity ?? [
                "string",
                location.thread.encoded,
              ],
              location.separator,
              run.identity,
              location.suffix,
            ],
          },
        };
        applied.add("run-location");
        continue;
      }
      if (replay && row.sequence === replay.candidate.run.sequence) {
        const replacement = replay.replacement,
          generatedKey = replay.key;
        if (endpoint?.operation !== "run-submit") {
          fail("replay decision does not belong to run submit");
          continue;
        }
        if (decision.slot.kind === "body") {
          const token =
            decision.slot.role === "input-message"
              ? "replay-input"
              : "replay-metadata";
          const expectedPath =
            decision.slot.role === "input-message"
              ? ["input", "messages", 0, "id"]
              : ["metadata", "edit_message_id"];
          if (
            !replacement ||
            !["input-message", "replacement-human"].includes(
              decision.slot.role,
            ) ||
            JSON.stringify(decision.slot.path) !==
              JSON.stringify(expectedPath) ||
            decision.raw !== replacement.raw ||
            JSON.stringify(decision.identity) !==
              JSON.stringify(replacement.identity) ||
            applied.has(token)
          ) {
            fail("replay replacement decision is not its exact admitted leaf");
            continue;
          }
          applied.add(token);
          replacements.push({
            path: decision.slot.path,
            raw: decision.raw,
            identity: decision.identity,
          });
        } else if (decision.slot.kind === "header") {
          if (
            !generatedKey ||
            decision.slot.name !== "idempotency-key" ||
            decision.slot.relation !== "replay-generated" ||
            decision.raw !== generatedKey.raw ||
            JSON.stringify(decision.identity) !==
              JSON.stringify(generatedKey.identity) ||
            fact.headers["idempotency-key"] !== decision.raw ||
            applied.has("replay-key")
          ) {
            fail("replay key decision has no exact independent source");
            continue;
          }
          applied.add("replay-key");
          key = decision.identity;
        } else fail("unapproved replay identity decision slot");
        continue;
      }
      if (decision.slot.kind === "path") {
        const at = decision.slot.index;
        const segment = fact.url.path[at];
        const value =
          segment === undefined ? null : decodeIdentitySegment(segment);
        const entity = threads.get(decision.raw);
        if (
          !isIdentity(decision.identity, "thread") ||
          !entity ||
          entity.literal ||
          !isIdentity(entity.identity, "thread") ||
          entity.identity[2] !== decision.identity[2] ||
          (endpoint?.operation !== "uploads-limits" &&
            !(
              endpoint?.operation === "run-submit" &&
              submissions.get(row.sequence)?.thread === entity
            )) ||
          !endpoint.pathSlots.some(
            (slot) => slot.index === at && slot.kind === "thread",
          ) ||
          applied.has(`path:${at}`) ||
          !value?.canonical ||
          value.raw !== decision.raw
        ) {
          fail("decision does not match its admitted request slot");
          continue;
        }
        applied.add(`path:${at}`);
        path[at] = decision.identity;
        continue;
      }
      if (
        decision.slot.kind === "body" &&
        decision.slot.role === "import-fact"
      ) {
        const entity = memoryFacts.get(decision.slot.path[1]);
        const token = `fact:${decision.slot.path[1]}`;
        if (
          !memoryRequests.has(row.sequence) ||
          endpoint?.operation !== "memory-import" ||
          !entity?.generated ||
          !isIdentity(entity.identity, "fact") ||
          !isIdentity(decision.identity, "fact") ||
          entity.identity[2] !== decision.identity[2] ||
          decision.raw !== entity.raw ||
          JSON.stringify(decision.slot.path) !==
            JSON.stringify(["facts", entity.index, "id"]) ||
          applied.has(token)
        ) {
          fail(
            "Memory decision does not match its exact generated source slot",
          );
          continue;
        }
        applied.add(token);
        replacements.push({
          path: decision.slot.path,
          raw: decision.raw,
          identity: decision.identity,
        });
        continue;
      }
      const human = humans.get(decision.raw);
      if (
        !human ||
        !isIdentity(decision.identity, "human") ||
        !isIdentity(human.identity, "human") ||
        human.identity[2] !== decision.identity[2] ||
        submissions.get(row.sequence) !== human ||
        endpoint?.operation !== "run-submit"
      ) {
        fail("decision does not match its admitted human submission");
        continue;
      }
      if (decision.slot.kind === "body") {
        const expectedPath = [
          "input",
          "messages",
          human.submission.index,
          "id",
        ];
        if (
          decision.slot.role !== "input-message" ||
          JSON.stringify(decision.slot.path) !== JSON.stringify(expectedPath) ||
          applied.has("body")
        ) {
          fail("body decision does not match its exact admitted input slot");
          continue;
        }
        applied.add("body");
        replacements.push({
          path: decision.slot.path,
          raw: decision.raw,
          identity: decision.identity,
        });
      } else if (decision.slot.kind === "header") {
        if (
          decision.slot.name !== "idempotency-key" ||
          decision.slot.relation !== "human-default" ||
          human.submission.keySource !== "default" ||
          human.expectation.submission.keySource !== "default" ||
          fact.headers["idempotency-key"] !== decision.raw ||
          applied.has("header")
        ) {
          fail("header decision has no exact default-human reference");
          continue;
        }
        applied.add("header");
        key = decision.identity;
      } else fail("unknown identity decision slot");
    }
    const human = submissions.get(row.sequence);
    if (replayRequests.has(row.sequence) && replay) {
      const run = row.sequence === replay.candidate.run.sequence;
      if (
        endpoint?.operation !==
          (run
            ? "run-submit"
            : `${replay.candidate.expectation.source.kind}-prepare`) ||
        (run &&
          ((replay.replacement &&
            (!applied.has("replay-input") ||
              !applied.has("replay-metadata"))) ||
            (replay.key && !applied.has("replay-key")))) ||
        (!run && decisions.length !== 0)
      )
        fail("incomplete replay pair or generated source decisions");
    }
    if (
      human &&
      (!applied.has("body") ||
        (!human.thread.literal &&
          !endpoint?.pathSlots.some((slot) =>
            applied.has(`path:${slot.index}`),
          )) ||
        (human.submission.keySource === "default" && !applied.has("header")))
    )
      fail("incomplete human submission decisions");
    if (memoryRequests.has(row.sequence)) {
      const vector =
        fact.body[0] === "json" && fact.body[1][0] === "object"
          ? fact.body[1][1].find(([name]) => name === "facts")?.[1]
          : undefined;
      if (
        endpoint?.operation !== "memory-import" ||
        submissions.has(row.sequence) ||
        vector?.[0] !== "array" ||
        vector[1].length !== memoryFacts.size ||
        [...memoryFacts.values()].some((entity) => {
          const value = vector[1][entity.index];
          const id =
            value?.[0] === "object"
              ? value[1].find(([name]) => name === "id")?.[1]
              : undefined;
          return (
            id?.[0] !== "string" ||
            id[1] !== entity.raw ||
            (entity.generated && !applied.has(`fact:${entity.index}`))
          );
        })
      )
        fail("incomplete Memory request source decisions");
    }
    if (runRequests.has(row.sequence) && !applied.has("run-location"))
      fail("missing required created run response decision");
    if (replacements.length) {
      const projected =
        fact.body[0] === "json"
          ? replaceLeaves(fact.body[1], replacements)
          : null;
      if (projected === null)
        fail("body decision does not match its original tagged string leaf");
      else body = ["json", projected];
    }
    facts.push({
      ...fact,
      url: { ...fact.url, path },
      body,
      response,
      headers: { ...fact.headers, "idempotency-key": key },
    });
  }
  for (const sequence of new Set([
    ...registry.requestDecisions.keys(),
    ...submissions.keys(),
    ...memoryRequests,
    ...replayRequests,
    ...runRequests.keys(),
  ]))
    if (!sequences.has(sequence)) fail("decision has no request");
  return summarizeRequestFacts(errors.length ? literal : facts, errors);
}
