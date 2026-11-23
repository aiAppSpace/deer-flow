import {
  projectRequest,
  summarizeRequestFacts,
  type NetworkSnapshot,
  type RequestFact,
} from "../e2e-parity/support/capture-network";
import type { IdentityNode } from "../e2e-parity/support/identity-registry";

/** Test oracle with an independent, fixed three-leaf allowlist. It does not
 * consume registry decisions or infer identities from strings in the body. */
export function expectedReplayProjection(
  snapshot: NetworkSnapshot,
  appBase: string,
  runSequence: number,
  expected: { replacement: IdentityNode | null; key: IdentityNode | null },
) {
  const facts: RequestFact<
    string,
    [string, ...unknown[]],
    string | null | IdentityNode
  >[] = snapshot.requests.map((row) =>
    structuredClone(projectRequest(row, appBase)),
  );
  const indexes = snapshot.requests.flatMap((row, index) =>
    row.sequence === runSequence ? [index] : [],
  );
  if (indexes.length !== 1)
    throw new Error("Expected one independently identified run");
  const run = facts[indexes[0]!]!;
  const property = (node: unknown, name: string): [string, unknown] => {
    if (!Array.isArray(node) || node[0] !== "object")
      throw new Error("Expected tagged object");
    const entry = (node[1] as [string, unknown][]).find(
      ([key]) => key === name,
    );
    if (!entry) throw new Error(`Missing expected literal field: ${name}`);
    return entry;
  };
  if (expected.replacement) {
    if (run.body[0] !== "json") throw new Error("Expected replay JSON body");
    const root = run.body[1];
    const messages = property(property(root, "input")[1], "messages")[1];
    if (
      !Array.isArray(messages) ||
      messages[0] !== "array" ||
      messages[1].length !== 1
    )
      throw new Error("Expected one replay human message");
    property(messages[1][0], "id")[1] = expected.replacement;
    property(property(root, "metadata")[1], "edit_message_id")[1] =
      expected.replacement;
  }
  if (expected.key) run.headers["idempotency-key"] = expected.key;
  return summarizeRequestFacts(facts, []);
}
