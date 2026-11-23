import {
  summarizeRequestFacts,
  type RequestFact,
  type projectNetwork,
} from "../e2e-parity/support/capture-network";
import type { IdentityNode } from "../e2e-parity/support/identity-registry";
import type { ProjectedRunLocation } from "../e2e-parity/support/identity-run-admission";

/** An independently specified fixed response replacement over an already
 * checked baseline. No registry, decision or cached source is consulted. */
export function expectedRunProjection(
  before: ReturnType<typeof projectNetwork>,
  requestIndex: number,
  location: ProjectedRunLocation,
) {
  if (before.observationErrors.length)
    throw new Error("Expected an error-free baseline");
  const facts = before.requestFacts.map(
    (raw) =>
      JSON.parse(raw) as RequestFact<
        string | IdentityNode,
        [string, ...unknown[]],
        string | null | IdentityNode,
        string | null | ProjectedRunLocation
      >,
  );
  const fact = facts[requestIndex];
  if (!fact?.response) throw new Error("Expected an exact response occurrence");
  fact.response.headers["content-location"] = location;
  return summarizeRequestFacts(facts, []);
}
