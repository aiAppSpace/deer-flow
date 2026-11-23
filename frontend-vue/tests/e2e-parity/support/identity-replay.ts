import { projectRequest, type RequestObservation } from "./capture-network";
import type {
  RegistryEvent,
  ThreadEntity,
  ThreadLifetime,
} from "./identity-registry";
import type { SubmissionRequest } from "./identity-request-domain";
import {
  readReplayAttemptSource,
  type ReplayAttemptSource,
  type ReplaySourceExpectation,
} from "./identity-replay-source";
import type { JsonWire } from "./wire-values";

export type ReplayExpectation = {
  slot: string;
  threadSlot: string;
  account: string;
  stableAccount: true;
  source: Omit<ReplaySourceExpectation, "thread" | "agent">;
  replacementText: string | null;
  /** An explicit old-group relation, never inferred from matching raw text. */
  versionGroupSource?: "literal" | "source-human";
};
export type ReplayHttpCandidate = {
  expectation: ReplayExpectation;
  thread: ThreadEntity;
  source: ReplayAttemptSource;
  prepare: RequestObservation;
  run: RequestObservation;
};
const property = (node: JsonWire | undefined, key: string) =>
  node?.[0] === "object"
    ? node[1].find(([name]) => name === key)?.[1]
    : undefined;
const string = (node: JsonWire | undefined) =>
  node?.[0] === "string" ? node[1] : undefined;
const text = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

/** Bounded consistency check, not a general observer-to-Request causal key.
 * The root supplies its complete, uniquely assigned candidate domain and keeps
 * all inventory/transport errors. No generated identity or projection decision
 * is published here; collision admission is a separate required step. */
export function readReplayHttpCandidate(input: {
  appBase: string;
  events: readonly RegistryEvent[];
  requests: readonly SubmissionRequest[];
  entities: readonly ThreadEntity[];
  lifetimes: readonly ThreadLifetime[];
  expectation?: ReplayExpectation;
}) {
  const errors = new Set<string>();
  const fail = (message: string) => errors.add(message);
  const finish = (candidate: ReplayHttpCandidate | null = null) => ({
    candidate: errors.size ? null : candidate,
    errors: [...errors],
  });
  const expected = input.expectation;
  if (!expected) {
    if (
      input.requests.length ||
      input.events.some(
        ({ packet }) =>
          packet.producer === "replay" ||
          packet.event.startsWith("replay.") ||
          packet.event === "idempotency.allocate",
      )
    )
      fail("replay source/request has no independent operation declaration");
    return finish();
  }
  const thread = input.entities.find(
    (entity) => entity.expectation.slot === expected.threadSlot,
  );
  if (
    !text(expected.slot) ||
    !text(expected.threadSlot) ||
    !text(expected.account) ||
    expected.stableAccount !== true ||
    input.entities.length !== 1 ||
    !thread ||
    !thread.literal ||
    thread.expectation.source.kind !== "literal" ||
    thread.expectation.source.draft ||
    thread.expectation.source.mock ||
    thread.expectation.account !== expected.account ||
    (expected.source.kind === "edit"
      ? typeof expected.replacementText !== "string"
      : expected.replacementText !== null)
  ) {
    fail("unresolved single persisted replay thread and stable account");
    return finish();
  }
  const sourceResult = readReplayAttemptSource(input.events, {
    ...expected.source,
    thread: thread.raw,
    agent: thread.expectation.agent,
  });
  sourceResult.errors.forEach(fail);
  const source = sourceResult.candidate;
  if (!source) return finish();
  const lives = input.lifetimes.filter((life) => life.entity === thread);
  const life = lives[0];
  const selection = input.events.find((event) => event.sequence === life?.from);
  if (
    lives.length !== 1 ||
    !life ||
    source.begin.sequence <= life.from ||
    !selection ||
    source.begin.packet.at < selection.dispatchedAt ||
    source.begin.dispatchedAt < selection.dispatchedAt ||
    (life.until !== null && source.submission.sequence >= life.until)
  ) {
    fail("replay source is outside its single selected thread lifetime");
    return finish();
  }
  const prepares = input.requests.filter(
    (request) => request.operation === `${expected.source.kind}-prepare`,
  );
  const runs = input.requests.filter(
    (request) => request.operation === "run-submit",
  );
  if (
    input.requests.length !== 2 ||
    prepares.length !== 1 ||
    runs.length !== 1
  ) {
    fail("unresolved complete single replay prepare/run candidate domain");
    return finish();
  }
  const prepare = prepares[0]!,
    run = runs[0]!;
  // The complete source reader has validated these ordered phase rows. Use
  // the first response receipt, not its final snapshot, as the negative bound.
  const responseStart = input.events.find(
    (event) =>
      event.owner === source.owner && event.packet.values.phase === "response",
  );
  for (const candidate of [prepare, run]) {
    const row = candidate.row;
    if (
      row.method !== "POST" ||
      candidate.thread !== thread.raw ||
      row.source !== "main-frame" ||
      row.navigation !== false ||
      row.startedAt === null ||
      !Number.isFinite(row.startedAt) ||
      row.startedAt <= 0 ||
      (life.retiredAt !== null && row.startedAt >= life.retiredAt)
    )
      fail("replay request has unresolved thread, frame or lifetime timing");
  }
  if (
    prepare.row.startedAt === null ||
    run.row.startedAt === null ||
    prepare.row.startedAt < source.begin.dispatchedAt ||
    !responseStart ||
    prepare.row.startedAt > responseStart.dispatchedAt ||
    run.row.startedAt < source.submission.dispatchedAt ||
    prepare.row.sequence >= run.row.sequence ||
    (source.retirement && run.row.startedAt >= source.retirement.dispatchedAt)
  )
    fail("replay request timing contradicts source dispatch order");
  if (
    !prepare.row.response ||
    !Number.isInteger(prepare.row.response.status) ||
    prepare.row.response.status < 200 ||
    prepare.row.response.status >= 300 ||
    prepare.row.failure
  )
    fail("replay preparation has no successful same-request response");
  if (
    prepare.row.headers["idempotency-key"] !== null ||
    run.row.headers["idempotency-key"] !== (source.key?.raw ?? null)
  )
    fail("replay request key contradicts its independent source branch");
  const prepareFact = projectRequest(prepare.row, input.appBase);
  const runFact = projectRequest(run.row, input.appBase);
  const prepareBody =
    prepareFact.body[0] === "json" ? prepareFact.body[1] : undefined;
  const body = runFact.body[0] === "json" ? runFact.body[1] : undefined;
  const edit = expected.source.kind === "edit";
  if (
    prepareBody?.[0] !== "object" ||
    prepareBody[1].length !== (edit ? 2 : 1) ||
    string(property(prepareBody, edit ? "human_message_id" : "message_id")) !==
      (edit ? expected.source.sourceHuman : expected.source.sourceAssistant) ||
    (edit &&
      string(property(prepareBody, "replacement_text")) !==
        expected.replacementText)
  )
    fail(
      "prepare body contradicts independent selected turn or replacement text",
    );
  const messages = property(property(body, "input"), "messages");
  const human = messages?.[0] === "array" ? messages[1][0] : undefined;
  if (
    body?.[0] !== "object" ||
    messages?.[0] !== "array" ||
    messages[1].length !== 1 ||
    string(property(human, "type")) !== "human" ||
    property(human, "role") !== undefined ||
    string(property(human, "id")) !==
      (edit ? source.replacement : expected.source.wireHuman) ||
    string(property(body, "assistant_id")) !== expected.source.assistant ||
    string(property(property(body, "checkpoint"), "checkpoint_id")) !==
      expected.source.checkpoint
  )
    fail(
      "replay run input/assistant/checkpoint contradicts its adopted source",
    );
  const metadata = property(body, "metadata");
  const references: Record<string, string | null> = {
    regenerate_from_message_id: expected.source.sourceAssistant,
    regenerate_from_run_id: expected.source.oldRun,
    regenerate_checkpoint_id: expected.source.checkpoint,
    edit_from_message_id: edit ? expected.source.sourceHuman : null,
    edit_message_id: source.replacement,
    edit_version_group_id: expected.source.versionGroup,
    replay_kind: edit ? "edit" : null,
  };
  if (
    metadata?.[0] !== "object" ||
    Object.entries(references).some(([key, value]) =>
      value === null
        ? property(metadata, key) !== undefined
        : string(property(metadata, key)) !== value,
    )
  )
    fail("replay run metadata contradicts prepared reference roles or absence");
  const context = property(body, "context");
  const agent = property(context, "agent_name");
  if (
    context?.[0] !== "object" ||
    property(context, "thread_id") !== undefined ||
    (thread.expectation.agent === null
      ? agent !== undefined
      : string(agent) !== thread.expectation.agent)
  )
    fail("replay run context contradicts declared agent/thread contract");
  return finish({
    expectation: expected,
    thread,
    source,
    prepare: prepare.row,
    run: run.row,
  });
}
