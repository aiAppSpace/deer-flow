import { RUN_PHASE_EVENTS } from "./identity-receipts";
import type { IdentityRegistry, RegistryEvent } from "./identity-registry";
import type { RunEntity } from "./identity-run-admission";

export type RunAdoption = {
  run: RunEntity;
  source: RegistryEvent;
  bind: RegistryEvent;
  called: RegistryEvent;
  received: RegistryEvent;
  delivered: RegistryEvent;
  retirement: RegistryEvent | null;
};
const positive = (value: number) => Number.isFinite(value) && value > 0;
const matches = (event: RegistryEvent, expected: Record<string, unknown>) =>
  Object.keys(event.packet.values).length === Object.keys(expected).length &&
  Object.entries(expected).every(
    ([key, value]) => event.packet.values[key] === value,
  );

/** Called inside the single registry build, after source/claims admission.
 * It consumes that build's complete validated event inventory, never a second
 * caller-supplied identity snapshot. No new identity or consumer slot is granted. */
export function admitRunAdoptions(input: {
  registry: IdentityRegistry;
  events: readonly RegistryEvent[];
  transport?: "sdk" | "adapter";
}): { adoptions: RunAdoption[]; errors: string[] } {
  const { registry, events, transport } = input;
  const errors = new Set<string>();
  const fail = (message: string) => errors.add(message);
  const adoptions: RunAdoption[] = [];
  const phases = events.filter(
    ({ packet }) =>
      RUN_PHASE_EVENTS.includes(packet.event) ||
      packet.event.startsWith("run.") ||
      packet.producer === "run",
  );
  const result = () => ({
    adoptions: errors.size ? [] : adoptions,
    errors: [...errors],
  });
  if (!phases.length && transport === undefined) return result();
  if (registry.errors.length) {
    fail("run adoption requires an error-free source and claim domain");
    return result();
  }
  if (
    (transport !== "sdk" && transport !== "adapter") ||
    !registry.runs.length
  ) {
    fail("run adoption requires independent transport and run declarations");
    return result();
  }
  const consumed = new Set<RegistryEvent>();
  const owners = new Set<string>();
  for (const run of registry.runs) {
    const submission = run.candidate.submission;
    const source =
      submission.kind === "human"
        ? events.find(
            (event) =>
              event.sequence === submission.entity.submission.sequence &&
              event.packet.event === "human.submission",
          )
        : submission.entity.candidate.source.submission;
    if (
      !source ||
      !events.includes(source) ||
      !["human:send", "replay"].includes(source.packet.producer) ||
      owners.has(source.owner)
    ) {
      fail("run adoption has no unique admitted submission observer");
      continue;
    }
    owners.add(source.owner);
    const group = phases.filter((event) => event.owner === source.owner);
    const unique = (name: string, required = true) => {
      const rows = group.filter((event) => event.packet.event === name);
      if (rows.length > 1 || (required && rows.length !== 1))
        fail(`run adoption phase multiplicity: ${name}`);
      return rows[0] ?? null;
    };
    const bind = unique("run.bind"),
      called = unique("run.called"),
      received = unique("run.received"),
      delivered = unique("run.delivered"),
      retired = unique("run.retire", false);
    if (!bind || !called || !received || !delivered) continue;
    const assistant =
      submission.kind === "human"
        ? submission.entity.expectation.assistant
        : submission.entity.candidate.expectation.source.assistant;
    if (
      !matches(bind, {
        thread: run.candidate.thread.raw,
        assistant,
        sourceAction: source.packet.action,
      }) ||
      !matches(called, { transport, state: "active" })
    )
      fail("run invocation contradicts independent submit intent");
    for (const event of [received, delivered])
      if (
        !matches(event, {
          thread: run.candidate.location.thread.raw,
          run: run.raw,
          state: "active",
        })
      )
        fail(
          "run handle contradicts the exact submit response or active owner",
        );
    const chain = [
      source,
      bind,
      called,
      received,
      delivered,
      ...(retired ? [retired] : []),
    ];
    for (const [index, event] of chain.entries()) {
      const previous = chain[index - 1];
      if (
        event.packet.version !== 1 ||
        !positive(event.packet.at) ||
        !positive(event.dispatchedAt) ||
        event.dispatchedAt < event.packet.at ||
        (event.packet.action !== null &&
          typeof event.packet.action !== "string") ||
        (previous &&
          (event.sequence <= previous.sequence ||
            event.packet.at < previous.packet.at ||
            event.dispatchedAt < previous.dispatchedAt))
      )
        fail("run adoption phase chronology or shape is inconsistent");
    }
    const requestStartedAt = run.candidate.request.startedAt;
    if (
      requestStartedAt === null ||
      !positive(requestStartedAt) ||
      called.dispatchedAt > requestStartedAt ||
      received.dispatchedAt < requestStartedAt
    )
      fail("run handle chronology contradicts its exact request");
    const retirements = events.filter(
      (event) =>
        (event.owner === source.owner &&
          ["run.retire", "replay.retire"].includes(event.packet.event)) ||
        (event.owner === run.candidate.thread.owner &&
          event.packet.event === "thread.retire"),
    );
    if (
      retirements.some(
        (event) =>
          event.sequence <= delivered.sequence ||
          event.dispatchedAt < delivered.dispatchedAt,
      )
    )
      fail("run adoption follows owner retirement");
    const retirement = retirements.reduce<RegistryEvent | null>(
      (first, event) =>
        !first || event.sequence < first.sequence ? event : first,
      null,
    );
    for (const event of [
      bind,
      called,
      received,
      delivered,
      ...(retired ? [retired] : []),
    ]) {
      if (consumed.has(event))
        fail("one run phase belongs to multiple submissions");
      consumed.add(event);
    }
    adoptions.push({
      run,
      source,
      bind,
      called,
      received,
      delivered,
      retirement,
    });
  }
  if (phases.some((event) => !consumed.has(event)))
    fail(
      "unowned or undeclared run phase remains in the complete event domain",
    );
  if (adoptions.length !== registry.runs.length)
    fail("declared run lacks an observed callback or runner adoption");
  return result();
}
