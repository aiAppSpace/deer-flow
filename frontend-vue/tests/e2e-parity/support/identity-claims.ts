import type { IdentityNode } from "./identity-registry";

type ClaimSource = {
  raw: string;
  source: string;
  account: string;
};
export type IdentityClaim = ClaimSource &
  (
    | {
        kind: Exclude<IdentityNode[1], "run">;
        literal: boolean;
        identity: IdentityNode | null;
      }
    | {
        kind: "assistant" | "checkpoint" | "version-group";
        literal: true;
        identity: null;
      }
    | { kind: "run"; literal: true; identity: null; definition?: never }
    | {
        kind: "run";
        literal: false;
        identity: readonly ["identity", "run", string] | null;
        definition: "run-response";
      }
  );

/** One conflict domain for source definitions, not a raw-to-request resolver.
 * Repeated literal references of the same kind/account remain occurrences;
 * generated sources cannot acquire that exemption or alias another kind. */
export function validateIdentityClaims(
  claims: readonly IdentityClaim[],
): string[] {
  const errors = new Set<string>();
  const rawClaims = new Map<string, IdentityClaim>();
  const semanticClaims = new Map<string, IdentityClaim>();
  for (const claim of claims) {
    if (
      ![
        "thread",
        "human",
        "fact",
        "submission-key",
        "assistant",
        "run",
        "checkpoint",
        "version-group",
      ].includes(claim.kind)
    )
      errors.add("identity claim has an undeclared kind");
    if (
      ["assistant", "checkpoint", "version-group"].includes(claim.kind) &&
      (claim.literal !== true || claim.identity !== null)
    )
      errors.add(
        "old replay reference must remain literal without a generated identity",
      );
    if (claim.kind === "run") {
      const valid =
        claim.literal === true
          ? claim.identity === null && claim.definition === undefined
          : claim.literal === false &&
            claim.definition === "run-response" &&
            (claim.identity === null ||
              (Array.isArray(claim.identity) &&
                claim.identity.length === 3 &&
                claim.identity[0] === "identity" &&
                claim.identity[1] === "run" &&
                typeof claim.identity[2] === "string" &&
                claim.identity[2].length > 0));
      if (!valid)
        errors.add(
          "run claim must distinguish an old reference from a create response",
        );
    }
    const previous = rawClaims.get(claim.raw);
    if (
      previous &&
      !(
        previous.kind === claim.kind &&
        previous.account === claim.account &&
        ((previous.literal && claim.literal) ||
          (!previous.literal &&
            !claim.literal &&
            previous.source === claim.source))
      )
    ) {
      errors.add("identity raw claimed by incompatible sources or kinds");
    } else rawClaims.set(claim.raw, claim);
    if (claim.identity) {
      if (
        claim.identity[0] !== "identity" ||
        claim.identity[1] !== claim.kind ||
        !claim.identity[2]
      )
        errors.add("identity claim has an invalid semantic kind");
      const key = JSON.stringify([claim.kind, claim.identity[2]]);
      const semantic = semanticClaims.get(key);
      if (
        semantic &&
        (semantic.raw !== claim.raw ||
          semantic.source !== claim.source ||
          semantic.account !== claim.account)
      )
        errors.add("identity semantic slot claimed by different sources");
      semanticClaims.set(key, claim);
      if (
        previous?.identity &&
        JSON.stringify(previous.identity) !== JSON.stringify(claim.identity)
      )
        errors.add("identity source changed its semantic slot");
    }
  }
  return [...errors];
}
