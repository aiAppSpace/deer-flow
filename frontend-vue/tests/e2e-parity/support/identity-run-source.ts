import {
  networkFingerprint,
  type NetworkSnapshot,
  type RequestObservation,
} from "./capture-network";
import type { HumanEntity } from "./identity-human";
import type { ReplayAdmission } from "./identity-replay-admission";
import type { ThreadEntity, IdentityRegistry } from "./identity-registry";
import { decodeIdentitySegment, identifyEndpoint } from "./identity-slots";
import { projectUrl } from "./wire-values";

export type RunSourceExpectation = {
  slot: string;
  submission: { kind: "human" | "replay"; slot: string };
};
export type RunLocationSource = {
  raw: string;
  prefix: string;
  thread: { raw: string; encoded: string };
  separator: "/runs/";
  run: { raw: string; encoded: string };
  suffix: "" | "/";
};
export type RunSourceCandidate = {
  expectation: RunSourceExpectation;
  thread: ThreadEntity;
  submission:
    | { kind: "human"; entity: HumanEntity }
    | { kind: "replay"; entity: ReplayAdmission };
  request: RequestObservation;
  location: RunLocationSource;
};

const text = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= 4096;

/** Parse the public header copy without resolving/rebuilding its spelling.
 * A server location candidate is not proof that either client adopted it.
 * headers() may combine lines: this rejects visible combined values, not an
 * independently proven count of raw response header lines. */
export function readRunLocation(
  raw: unknown,
  appBase: string,
): RunLocationSource | null {
  if (!text(raw) || /[\s,?#\\]/u.test(raw)) return null;
  const match =
    /^(https?:\/\/[^/]+)?(\/api\/threads\/)([^/]+)(\/runs\/)([^/]+?)(\/?)$/.exec(
      raw,
    );
  if (!match) return null;
  const authority = match[1] ?? "";
  if (authority) {
    const origin = new URL(appBase).origin;
    // Exact authority spelling remains part of the source; no URL-normalized
    // dot segment, credential, case or default-port alias is admitted here.
    if (authority !== origin) return null;
  }
  const thread = decodeIdentitySegment(match[3]!),
    run = decodeIdentitySegment(match[5]!);
  const valid = (part: ReturnType<typeof decodeIdentitySegment>) =>
    part.canonical &&
    text(part.raw) &&
    ![".", ".."].includes(part.raw) &&
    Array.from(part.raw).every(
      (char) =>
        char.charCodeAt(0) >= 32 &&
        char.charCodeAt(0) !== 127 &&
        char !== "/" &&
        char !== "\\",
    );
  if (!valid(thread) || !valid(run)) return null;
  return {
    raw,
    prefix: authority + match[2]!,
    thread: { raw: thread.raw!, encoded: match[3]! },
    separator: "/runs/",
    run: { raw: run.raw!, encoded: match[5]! },
    suffix: match[6] as "" | "/",
  };
}

/** Consume already admitted submissions; never find an owner from the CL raw
 * or from a later join. These are source candidates only: no identity claims,
 * request decisions, handle adoption, response timing or stream-success proof. */
export function readRunSources(input: {
  appBase: string;
  network: NetworkSnapshot;
  registry: IdentityRegistry;
  expectations: readonly RunSourceExpectation[];
}) {
  const errors = new Set<string>();
  const candidates: RunSourceCandidate[] = [];
  if (
    input.registry.errors.length ||
    input.network.errors.length ||
    input.registry.sourceNetwork !== input.network ||
    input.registry.sourceOrigin !== new URL(input.appBase).origin ||
    input.registry.sourceFingerprint !== networkFingerprint(input.network)
  ) {
    return {
      candidates,
      errors: ["run source requires an unchanged error-free registry binding"],
    };
  }
  const slots = new Set<string>();
  const claimed = new Set<RequestObservation>();
  for (const expected of input.expectations) {
    if (
      !text(expected.slot) ||
      slots.has(expected.slot) ||
      !text(expected.submission.slot) ||
      !["human", "replay"].includes(expected.submission.kind)
    ) {
      errors.add("invalid or duplicate independent run source slot");
      continue;
    }
    slots.add(expected.slot);
    const owners: RunSourceCandidate["submission"][] =
      expected.submission.kind === "human"
        ? input.registry.humans
            .filter(
              (human) => human.expectation.slot === expected.submission.slot,
            )
            .map((entity) => ({ kind: "human", entity }))
        : input.registry.replay?.candidate.expectation.slot ===
            expected.submission.slot
          ? [{ kind: "replay", entity: input.registry.replay }]
          : [];
    if (owners.length !== 1) {
      errors.add("run source has no unique admitted submission owner");
      continue;
    }
    const submission = owners[0]!;
    const thread =
      submission.kind === "human"
        ? submission.entity.thread
        : submission.entity.candidate.thread;
    const sequence =
      submission.kind === "human"
        ? submission.entity.submission.requestSequence
        : submission.entity.candidate.run.sequence;
    const rows = input.network.requests.filter(
      (row) => row.sequence === sequence,
    );
    const row = rows.length === 1 ? rows[0] : undefined;
    if (
      !row ||
      claimed.has(row) ||
      (submission.kind === "replay" && row !== submission.entity.candidate.run)
    ) {
      errors.add("run source request membership is missing or ambiguous");
      continue;
    }
    claimed.add(row);
    const url = projectUrl(row.url, input.appBase);
    const endpoint = url && identifyEndpoint(row.method, url);
    const index = endpoint?.pathSlots.find(
      (slot) => slot.kind === "thread",
    )?.index;
    const segment =
      index !== undefined && url
        ? decodeIdentitySegment(url.path[index]!)
        : null;
    if (
      endpoint?.operation !== "run-submit" ||
      !url ||
      url.query !== "" ||
      !segment?.canonical ||
      segment.raw !== thread.raw ||
      row.source !== "main-frame" ||
      row.navigation !== false ||
      row.startedAt === null ||
      !Number.isFinite(row.startedAt) ||
      row.startedAt <= 0
    ) {
      errors.add("run source is not its admitted create request");
      continue;
    }
    const response = row.response;
    const location = readRunLocation(
      response?.headers["content-location"],
      input.appBase,
    );
    if (
      !response ||
      !Number.isInteger(response.status) ||
      response.status < 200 ||
      response.status >= 300 ||
      !location ||
      location.thread.raw !== thread.raw
    ) {
      errors.add("run source has no successful same-thread public location");
      continue;
    }
    // Headers may precede an open or subsequently failed SSE. Retain both facts;
    // neither requestfinished nor the UI's finish callback defines run success.
    candidates.push({
      expectation: expected,
      thread,
      submission,
      request: row,
      location,
    });
  }
  return { candidates: errors.size ? [] : candidates, errors: [...errors] };
}
