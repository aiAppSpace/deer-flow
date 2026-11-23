import type { NetworkSnapshot, RequestObservation } from "./capture-network";
import { MAX_ROWS } from "./identity-receipts";
import { decodeIdentitySegment, identifyEndpoint } from "./identity-slots";
import { projectUrl } from "./wire-values";

type Operation = "run-submit" | "edit-prepare" | "regenerate-prepare";
export type SubmissionRequest = {
  row: RequestObservation;
  operation: Operation;
  threadIndex: number;
  thread: string | null;
};
export type SubmissionDomain = {
  candidates: readonly SubmissionRequest[];
  errors: readonly string[];
};
export type SubmissionOwner = {
  kind: "human" | "edit" | "regenerate";
  slot: string;
  thread: string;
};

/** Enumerate the whole same-origin prepare/run path domain BEFORE inspecting
 * method, body, key, status, frame or timing. Invalid rows remain candidates;
 * unrelated/external endpoints remain literal in the original snapshot. */
export function inventorySubmissionRequests(
  network: NetworkSnapshot,
  appBase: string,
): SubmissionDomain {
  const candidates: SubmissionRequest[] = [];
  const errors = new Set(network.errors);
  if (network.requests.length > MAX_ROWS)
    return {
      candidates,
      errors: [...errors, "submission request capacity exceeded"],
    };
  const sequences = new Set<number>();
  for (const row of network.requests) {
    if (
      !Number.isSafeInteger(row.sequence) ||
      row.sequence < 0 ||
      sequences.has(row.sequence)
    )
      errors.add("invalid or duplicate submission inventory request sequence");
    sequences.add(row.sequence);
    let url;
    try {
      url = projectUrl(row.url, appBase);
    } catch {
      errors.add("unreadable submission inventory URL");
      continue;
    }
    if (!url) continue;
    // Recognition uses the contract's method, not the observed method: a bad
    // method must not disappear before its consumer has a chance to reject it.
    const endpoint = identifyEndpoint("POST", url);
    if (
      !endpoint ||
      !["run-submit", "edit-prepare", "regenerate-prepare"].includes(
        endpoint.operation,
      )
    )
      continue;
    const index = endpoint.pathSlots[0]!.index;
    const segment = decodeIdentitySegment(url.path[index]!);
    candidates.push({
      row,
      operation: endpoint.operation as Operation,
      threadIndex: index,
      thread: segment.raw,
    });
    if (row.method !== "POST")
      errors.add("submission candidate has wrong method");
    if (!segment.raw || !segment.canonical)
      errors.add("submission candidate has noncanonical thread");
    if (url.query !== "")
      errors.add("submission candidate has undeclared query");
  }
  return { candidates, errors: [...errors] };
}

/** Independent thread/operation declarations partition candidates, not proof.
 * Each complete candidate must have exactly one declared consumer. A same-thread
 * ordinary/replay or multi-replay mixture remains unresolved in this bounded
 * contract; body fields and arrival order cannot choose an owner for it. */
export function assignSubmissionRequests(
  domain: SubmissionDomain,
  owners: readonly SubmissionOwner[],
) {
  const errors = new Set(domain.errors);
  const groups = new Map<SubmissionOwner, SubmissionRequest[]>();
  const threads = new Map<string, SubmissionOwner[]>();
  const slots = new Set<string>();
  for (const owner of owners) {
    if (
      !owner.thread ||
      !owner.slot ||
      !["human", "edit", "regenerate"].includes(owner.kind) ||
      slots.has(owner.slot)
    )
      errors.add("invalid or duplicate independent submission owner");
    slots.add(owner.slot);
    const previous = threads.get(owner.thread) ?? [];
    if (previous.length) errors.add("ambiguous same-thread submission owners");
    previous.push(owner);
    threads.set(owner.thread, previous);
    groups.set(owner, []);
  }
  for (const candidate of domain.candidates) {
    const matches =
      candidate.thread === null ? [] : (threads.get(candidate.thread) ?? []);
    if (matches.length !== 1) {
      errors.add(
        "submission candidate has zero or multiple independent consumers",
      );
      continue;
    }
    const owner = matches[0]!;
    groups.get(owner)!.push(candidate);
    if (
      candidate.operation !== "run-submit" &&
      candidate.operation !== `${owner.kind}-prepare`
    )
      errors.add(
        "prepare candidate contradicts its independent operation kind",
      );
  }
  return { groups, errors: [...errors] };
}
