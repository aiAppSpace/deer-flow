import type { IdentityClaim } from "./identity-claims";
import type {
  IdentityNode,
  RegistryEvent,
  RequestIdentityDecision,
} from "./identity-registry";
import type { ReplayExpectation, ReplayHttpCandidate } from "./identity-replay";

export type ReplayEntity = {
  raw: string;
  identity: IdentityNode;
  source: string;
  definition: RegistryEvent;
};
export type ReplayAdmission = {
  candidate: ReplayHttpCandidate;
  replacement: ReplayEntity | null;
  key: ReplayEntity | null;
};
const text = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;
const sourceKey = (event: RegistryEvent, role: string) =>
  JSON.stringify([event.owner, event.sequence, role]);

/** Register every primary definition, including an unused response/key. Only
 * a fully checked HTTP candidate can attach a semantic identity to a source.
 * Old roles are independent literal references, never new run/group entities. */
export function admitReplayIdentities(input: {
  candidate: ReplayHttpCandidate | null;
  expectation?: ReplayExpectation;
  events: readonly RegistryEvent[];
}) {
  const claims: IdentityClaim[] = [];
  const errors = new Set<string>();
  const decisions = new Map<number, RequestIdentityDecision[]>();
  const expected = input.expectation,
    candidate = input.candidate;
  const account = expected?.account ?? "unresolved";
  const entities: {
    replacement: ReplayEntity | null;
    key: ReplayEntity | null;
  } = { replacement: null, key: null };
  const entity = (
    raw: string,
    event: RegistryEvent,
    role: "replacement" | "key",
  ): ReplayEntity => ({
    raw,
    source: sourceKey(event, role),
    definition: event,
    identity: [
      "identity",
      role === "replacement" ? "human" : "submission-key",
      JSON.stringify([
        candidate!.thread.identity[2],
        candidate!.expectation.slot,
        role,
      ]),
    ],
  });
  for (const event of input.events) {
    const { packet } = event,
      v = packet.values;
    const replacement =
      packet.event === "replay.reference" &&
      v.phase === "response" &&
      v.slot === "replacement_human_message_id" &&
      v.valueType === "string";
    const key = packet.event === "idempotency.allocate";
    if ((!replacement && !key) || !text(v.raw)) continue;
    const role = replacement ? "replacement" : "key";
    const admitted =
      candidate &&
      event.owner === candidate.source.owner &&
      (replacement
        ? candidate.source.replacement === v.raw &&
          event.sequence > candidate.source.begin.sequence &&
          event.sequence < candidate.source.response.sequence
        : candidate.source.key?.event === event &&
          candidate.source.key.raw === v.raw);
    const selected = admitted ? entity(v.raw, event, role) : null;
    if (selected) {
      if (entities[role])
        errors.add("multiple definitions occupy one replay semantic source");
      entities[role] = selected;
    }
    claims.push({
      raw: v.raw,
      kind: replacement ? "human" : "submission-key",
      account,
      source: sourceKey(event, role),
      literal: false,
      identity: selected?.identity ?? null,
    });
  }
  if (expected) {
    const old = expected.source;
    const literal = (
      kind: IdentityClaim["kind"],
      raw: string,
      role: string,
    ) => {
      claims.push({
        kind,
        raw,
        source: JSON.stringify([expected.slot, role]),
        account,
        literal: true,
        identity: null,
      });
    };
    literal("human", old.sourceHuman, "source-human");
    literal("human", old.wireHuman, "wire-human");
    literal("assistant", old.sourceAssistant, "source-assistant");
    literal("run", old.oldRun, "old-run");
    literal("checkpoint", old.checkpoint, "checkpoint");
    if (old.kind === "edit" && old.versionGroup !== null) {
      if (expected.versionGroupSource === "source-human") {
        if (old.versionGroup !== old.sourceHuman)
          errors.add(
            "declared group fallback is not the source human reference",
          );
        literal("human", old.versionGroup, "group-source-human");
      } else {
        if (
          expected.versionGroupSource !== undefined &&
          expected.versionGroupSource !== "literal"
        )
          errors.add("unknown version group source");
        literal("version-group", old.versionGroup, "old-version-group");
      }
    } else if (expected.versionGroupSource !== undefined)
      errors.add("regenerate has no declared edit version group");
    if (
      old.sources.type === "array" &&
      old.sources.ids.some(
        (raw) => raw !== old.sourceHuman && raw !== old.sourceAssistant,
      )
    )
      errors.add("unresolved kind for additional old source message reference");
  }
  let admission: ReplayAdmission | null = null;
  if (candidate) {
    if (
      (candidate.expectation.source.kind === "edit") !==
        !!entities.replacement ||
      (candidate.expectation.source.key === "generated") !== !!entities.key
    )
      errors.add("replay generated definition is missing or unexpected");
    admission = { candidate, ...entities };
    const approved: RequestIdentityDecision[] = [];
    if (entities.replacement) {
      const { raw, identity } = entities.replacement;
      approved.push(
        {
          slot: {
            kind: "body",
            path: ["input", "messages", 0, "id"],
            role: "input-message",
          },
          raw,
          identity,
        },
        {
          slot: {
            kind: "body",
            path: ["metadata", "edit_message_id"],
            role: "replacement-human",
          },
          raw,
          identity,
        },
      );
    }
    if (entities.key)
      approved.push({
        slot: {
          kind: "header",
          name: "idempotency-key",
          relation: "replay-generated",
        },
        raw: entities.key.raw,
        identity: entities.key.identity,
      });
    // React regenerate has request membership but no generated slots.
    if (approved.length) decisions.set(candidate.run.sequence, approved);
  }
  return {
    admission: errors.size ? null : admission,
    claims,
    decisions: errors.size
      ? new Map<number, RequestIdentityDecision[]>()
      : decisions,
    errors: [...errors],
  };
}
