import { FIELDS, MAX_ROWS, RUN_PHASE_EVENTS } from "./identity-receipts";
import type { RegistryEvent } from "./identity-registry";

/** Independent old-turn roles. The returned replacement/key are only source
 * candidates: this reader grants no HTTP ownership, registry claims or slots. */
export type ReplaySourceExpectation = {
  kind: "edit" | "regenerate";
  thread: string;
  agent: string | null;
  assistant: string;
  actions: readonly string[];
  sourceHuman: string;
  wireHuman: string;
  sourceAssistant: string;
  oldRun: string;
  checkpoint: string;
  versionGroup: string | null;
  sources: { type: "absent" } | { type: "array"; ids: readonly string[] };
  key: "none" | "generated";
};
export type ReplayAttemptSource = {
  owner: string;
  begin: RegistryEvent;
  response: RegistryEvent;
  adoption: RegistryEvent;
  attempt: RegistryEvent;
  submission: RegistryEvent;
  replacement: string | null;
  key: { raw: string; event: RegistryEvent } | null;
  retirement: RegistryEvent | null;
  failure: RegistryEvent | null;
  finish: RegistryEvent | null;
};
const text = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;
const positive = (value: number) => Number.isFinite(value) && value > 0;
const equalValues = (
  row: RegistryEvent,
  expected: Record<string, string | number | boolean | null>,
) =>
  Object.keys(row.packet.values).length === Object.keys(expected).length &&
  Object.entries(expected).every(
    ([key, value]) => row.packet.values[key] === value,
  );

/** Read one complete attempted replay from the entire event inventory. This
 * bounded contract requires one human input; partial/ambiguous attempts stay
 * unresolved. Terminal failure/retirement does not erase an earlier attempt.
 * The caller still must prove the document, account, thread lifetime and the
 * complete prepare/run request domain before using any returned source. */
export function readReplayAttemptSource(
  events: readonly RegistryEvent[],
  expected: ReplaySourceExpectation,
): { candidate: ReplayAttemptSource | null; errors: string[] } {
  const errors = new Set<string>();
  const fail = (reason: string) => errors.add(reason);
  const result = (candidate: ReplayAttemptSource | null = null) => ({
    candidate: errors.size ? null : candidate,
    errors: [...errors],
  });
  if (events.length > MAX_ROWS) {
    fail("replay source capacity exceeded");
    return result();
  }
  const rows = events.filter(
    ({ packet }) =>
      (packet.producer === "replay" &&
        !RUN_PHASE_EVENTS.includes(packet.event)) ||
      packet.event.startsWith("replay.") ||
      packet.event === "idempotency.allocate",
  );
  const sourceIds =
    expected.sources.type === "array" ? expected.sources.ids : [];
  if (
    !["edit", "regenerate"].includes(expected.kind) ||
    !["none", "generated"].includes(expected.key) ||
    !["absent", "array"].includes(expected.sources.type) ||
    !expected.actions.length ||
    !expected.actions.every(text) ||
    ![
      expected.thread,
      expected.assistant,
      expected.sourceHuman,
      expected.wireHuman,
      expected.sourceAssistant,
      expected.oldRun,
      expected.checkpoint,
    ].every(text) ||
    (expected.agent !== null && !text(expected.agent)) ||
    !sourceIds.every(text) ||
    sourceIds.length + 10 > 4096 ||
    (expected.kind === "edit"
      ? !text(expected.versionGroup) ||
        expected.sources.type !== "array" ||
        !sourceIds.includes(expected.sourceHuman) ||
        !sourceIds.includes(expected.sourceAssistant)
      : expected.versionGroup !== null)
  ) {
    fail("invalid independent replay source expectation");
    return result();
  }
  const named = (name: string) =>
    rows.filter((row) => row.packet.event === name);
  const unique = (name: string, required = true) => {
    const matching = named(name);
    if (matching.length > 1 || (required && matching.length !== 1))
      fail(`unresolved replay event multiplicity: ${name}`);
    return matching[0] ?? null;
  };
  const begin = unique("replay.begin");
  const adoption = unique("replay.adopt");
  const submission = unique("replay.submission");
  const allocation = unique(
    "idempotency.allocate",
    expected.key === "generated",
  );
  const retirement = unique("replay.retire", false);
  const failure = unique("replay.failure", false);
  const finish = unique("replay.finish", false);
  if (!begin || !adoption || !submission) return result();
  if (
    !equalValues(begin, {
      kind: expected.kind,
      thread: expected.thread,
      source:
        expected.kind === "edit"
          ? expected.sourceHuman
          : expected.sourceAssistant,
      agent: expected.agent,
    }) ||
    begin.packet.action === null ||
    !expected.actions.includes(begin.packet.action)
  )
    fail("replay begin contradicts independent intent");
  const allowed = new Set([
    "replay.begin",
    "replay.reference",
    "replay.message",
    "replay.source",
    "replay.snapshot",
    "replay.adopt",
    "replay.submission",
    "idempotency.allocate",
    "replay.retire",
    "replay.failure",
    "replay.finish",
  ]);
  let previousSequence = -1;
  let previousTime = 0;
  for (const row of rows) {
    const p = row.packet;
    const fields = FIELDS[p.event];
    if (
      !allowed.has(p.event) ||
      !fields ||
      Object.keys(p.values).length !== fields.length ||
      !fields.every((field) => Object.hasOwn(p.values, field)) ||
      p.version !== 1 ||
      p.producer !== "replay" ||
      !text(p.capture) ||
      p.capture !== begin.packet.capture ||
      !text(row.owner) ||
      row.owner !== begin.owner ||
      !Number.isSafeInteger(p.instance) ||
      p.instance < 1 ||
      p.instance !== begin.packet.instance ||
      p.action !== begin.packet.action ||
      p.at !== begin.packet.at ||
      !positive(p.at) ||
      !positive(row.dispatchedAt) ||
      row.dispatchedAt < p.at ||
      !Number.isSafeInteger(row.sequence) ||
      row.sequence <= previousSequence ||
      row.dispatchedAt < previousTime
    )
      fail("replay source has inconsistent owner, origin, shape or chronology");
    previousSequence = row.sequence;
    previousTime = row.dispatchedAt;
  }
  if (rows[0] !== begin) fail("replay begin must precede every source event");
  if (!equalValues(submission, { assistant: expected.assistant }))
    fail("replay assistant contradicts independent intent");
  if (
    failure &&
    !["exception", "failed", "cancelled"].includes(
      String(failure.packet.values.status),
    )
  )
    fail("invalid replay failure status");
  if (finish && typeof finish.packet.values.current !== "boolean")
    fail("invalid replay finish status");

  const references = named("replay.reference");
  const replacementRows = references.filter(
    (row) =>
      row.packet.values.phase === "response" &&
      row.packet.values.slot === "replacement_human_message_id",
  );
  const replacementValue = replacementRows[0]?.packet.values.raw;
  const replacement =
    expected.kind === "edit" && text(replacementValue)
      ? replacementValue
      : null;
  const knownRaws = [
    expected.thread,
    expected.sourceHuman,
    expected.wireHuman,
    expected.sourceAssistant,
    expected.oldRun,
    expected.checkpoint,
    expected.versionGroup,
    ...sourceIds,
  ];
  if (
    expected.kind === "edit" &&
    (!replacement || knownRaws.includes(replacement))
  )
    fail("replacement is missing or aliases an existing source role");
  const referencePlan: Record<string, string | null> = {
    target_run_id: expected.oldRun,
    replacement_human_message_id: replacement,
    "checkpoint.checkpoint_id": expected.checkpoint,
    "metadata.edit_message_id": replacement,
    "metadata.edit_from_message_id":
      expected.kind === "edit" ? expected.sourceHuman : null,
    "metadata.edit_version_group_id": expected.versionGroup,
    "metadata.regenerate_from_run_id": expected.oldRun,
    "metadata.regenerate_from_message_id": expected.sourceAssistant,
    "metadata.regenerate_checkpoint_id": expected.checkpoint,
  };
  const phases = new Map<
    string,
    { first: RegistryEvent; snapshot: RegistryEvent }
  >();
  for (const phase of ["response", "attempt"]) {
    const phaseRows = rows.filter((row) => row.packet.values.phase === phase);
    const expectedRows: {
      event: string;
      values: Record<string, string | number | boolean | null>;
    }[] = [
      ...Object.entries(referencePlan).map(([slot, raw]) => ({
        event: "replay.reference",
        values: {
          phase,
          slot,
          raw,
          valueType: raw === null ? "absent" : "string",
        },
      })),
      {
        event: "replay.message",
        values: {
          phase,
          index: 0,
          type: "human",
          role: null,
          idPresent: true,
          raw: expected.kind === "edit" ? replacement : expected.wireHuman,
        },
      },
      ...sourceIds.map((raw, index) => ({
        event: "replay.source",
        values: { phase, index, raw },
      })),
      {
        event: "replay.snapshot",
        values: {
          phase,
          complete: true,
          messageCount: 1,
          sourceCount: sourceIds.length,
          sourcesType: expected.sources.type,
        },
      },
    ];
    if (
      phaseRows.length !== expectedRows.length ||
      expectedRows.some(
        (entry, index) =>
          !phaseRows[index] ||
          phaseRows[index].packet.event !== entry.event ||
          !equalValues(phaseRows[index], entry.values),
      )
    ) {
      fail(
        `replay ${phase} source rows contradict independent roles or presence`,
      );
      continue;
    }
    phases.set(phase, { first: phaseRows[0]!, snapshot: phaseRows.at(-1)! });
  }
  if (
    rows.some(
      (row) =>
        [
          "replay.reference",
          "replay.message",
          "replay.source",
          "replay.snapshot",
        ].includes(row.packet.event) &&
        !["response", "attempt"].includes(String(row.packet.values.phase)),
    )
  )
    fail("unknown replay source phase");
  const response = phases.get("response");
  const attempt = phases.get("attempt");
  if (!response || !attempt) return result();
  if (!(
    begin.sequence < response.first.sequence &&
    response.snapshot.sequence < adoption.sequence &&
    adoption.sequence < attempt.first.sequence &&
    attempt.snapshot.sequence < submission.sequence
  ))
    fail("replay response/adoption/attempt/submission order is invalid");
  for (const terminal of [retirement, failure, finish])
    if (terminal && terminal.sequence <= submission.sequence)
      fail("replay was retired or terminated before submission");
  if (finish && rows.at(-1) !== finish)
    fail("source events follow replay finish");
  if (retirement && finish?.packet.values.current === true)
    fail("retired replay cannot finish current");
  let key: ReplayAttemptSource["key"] = null;
  if (expected.key === "none" && allocation)
    fail("unexpected replay key allocation");
  if (expected.key === "generated" && allocation) {
    const raw = allocation.packet.values.raw;
    if (
      !text(raw) ||
      allocation.packet.values.thread !== expected.thread ||
      knownRaws.includes(raw) ||
      raw === replacement ||
      allocation.sequence <= adoption.sequence ||
      allocation.sequence >= attempt.first.sequence
    )
      fail("replay key is not an independent post-adoption source");
    else key = { raw, event: allocation };
  }
  return result({
    owner: begin.owner,
    begin,
    response: response.snapshot,
    adoption,
    attempt: attempt.snapshot,
    submission,
    replacement,
    key,
    retirement,
    failure,
    finish,
  });
}
