import type { IdentityClaim } from "./identity-claims";
import type {
  IdentityNode,
  IdentityRegistry,
  RequestIdentityDecision,
} from "./identity-registry";
import {
  readRunLocation,
  type RunSourceCandidate,
} from "./identity-run-source";
import { identifyEndpoint } from "./identity-slots";
import { projectUrl } from "./wire-values";

export type RunIdentity = readonly ["identity", "run", string];
export type RunEntity = {
  raw: string;
  identity: RunIdentity;
  source: string;
  ownerBinding: string;
  candidate: RunSourceCandidate;
};
export type ProjectedRunLocation = readonly [
  "run-location",
  string,
  IdentityNode | readonly ["string", string],
  "/runs/",
  RunIdentity,
  "" | "/",
];
export const runDefinitionKey = (sequence: number) =>
  JSON.stringify(["run-response", sequence]);
/** Local immutable receipt of the already admitted owner's finite declaration.
 * This is a consistency check, never a cross-app key or a registry signature. */
export function runOwnerBinding(candidate: RunSourceCandidate): string | null {
  const thread = candidate.thread,
    expected = thread.expectation;
  const submit = candidate.submission;
  // JSON arrays collapse undefined/non-finite numbers to null. Check the two
  // nullable scope fields before serializing this finite declaration receipt.
  if (
    [expected.projectIntent, expected.agent].some(
      (value) =>
        value !== null && (typeof value !== "string" || value.length === 0),
    )
  )
    return null;
  return JSON.stringify([
    thread.owner,
    thread.raw,
    thread.literal,
    expected.producer,
    expected.account,
    expected.projectIntent,
    expected.agent,
    expected.path,
    expected.slot,
    expected.source,
    submit.kind === "human"
      ? [
          "human",
          submit.entity.expectation.slot,
          submit.entity.expectation.threadSlot,
          submit.entity.expectation.submission.slot,
          submit.entity.expectation.assistant,
        ]
      : [
          "replay",
          submit.entity.candidate.expectation.slot,
          submit.entity.candidate.expectation.threadSlot,
          submit.entity.candidate.expectation.account,
          submit.entity.candidate.expectation.source.kind,
          submit.entity.candidate.expectation.source.assistant,
        ],
  ]);
}

export function runSemantic(candidate: RunSourceCandidate): RunIdentity {
  return [
    "identity",
    "run",
    JSON.stringify([
      candidate.thread.identity[2],
      candidate.submission.kind === "human"
        ? [
            "human",
            candidate.submission.entity.expectation.slot,
            candidate.submission.entity.expectation.submission.slot,
          ]
        : ["replay", candidate.submission.entity.candidate.expectation.slot],
      candidate.expectation.slot,
    ]),
  ];
}

/** All visible successful create definitions enter the shared conflict domain,
 * including unselected sources. Only exact independently admitted candidates
 * gain a semantic identity and a fixed response-location decision. */
export function admitRunIdentities(input: {
  registry: IdentityRegistry;
  candidates: readonly RunSourceCandidate[];
}) {
  const claims: IdentityClaim[] = [];
  const entities: RunEntity[] = [];
  const decisions = new Map<number, RequestIdentityDecision[]>();
  const errors = new Set<string>();
  for (const row of input.registry.sourceNetwork.requests) {
    const url = projectUrl(row.url, input.registry.sourceOrigin);
    if (!url || identifyEndpoint(row.method, url)?.operation !== "run-submit")
      continue;
    const response = row.response;
    if (
      !response ||
      !Number.isInteger(response.status) ||
      response.status < 200 ||
      response.status >= 300
    )
      continue;
    const location = readRunLocation(
      response.headers["content-location"],
      input.registry.sourceOrigin,
    );
    if (!location) continue;
    const matches = input.candidates.filter(
      (candidate) => candidate.request === row,
    );
    const candidate = matches.length === 1 ? matches[0] : undefined;
    if (matches.length > 1)
      errors.add("multiple run sources claim one create response");
    const human = input.registry.humans.find(
      (entity) => entity.submission.requestSequence === row.sequence,
    );
    const replay =
      input.registry.replay?.candidate.run === row
        ? input.registry.replay
        : null;
    const account =
      human?.thread.expectation.account ??
      replay?.candidate.thread.expectation.account ??
      "unresolved";
    const source = runDefinitionKey(row.sequence);
    let entity: RunEntity | null = null;
    if (candidate) {
      const ownerBinding = runOwnerBinding(candidate);
      if (ownerBinding === null)
        errors.add("run source has invalid nullable owner fields");
      else if (JSON.stringify(candidate.location) !== JSON.stringify(location))
        errors.add("run source location changed before admission");
      else {
        entity = {
          raw: location.run.raw,
          identity: runSemantic(candidate),
          source,
          ownerBinding,
          candidate,
        };
        entities.push(entity);
        if (decisions.has(row.sequence))
          errors.add("duplicate run response decision");
        decisions.set(row.sequence, [
          {
            slot: {
              kind: "response",
              name: "content-location",
              threadIdentity: candidate.thread.literal
                ? null
                : candidate.thread.identity,
            },
            raw: location.raw,
            identity: entity.identity,
          },
        ]);
      }
    }
    claims.push({
      kind: "run",
      raw: location.run.raw,
      account,
      source,
      literal: false,
      definition: "run-response",
      identity: entity?.identity ?? null,
    });
  }
  if (entities.length !== input.candidates.length)
    errors.add("run source has no exact response definition");
  return {
    claims,
    entities: errors.size ? [] : entities,
    decisions: errors.size
      ? new Map<number, RequestIdentityDecision[]>()
      : decisions,
    errors: [...errors],
  };
}
