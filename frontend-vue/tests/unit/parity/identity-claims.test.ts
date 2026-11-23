import { describe, expect, it } from "vitest";
import {
  validateIdentityClaims,
  type IdentityClaim,
} from "../../e2e-parity/support/identity-claims";
const generated = (): Extract<
  IdentityClaim,
  { kind: "fact" | "human" | "thread" | "submission-key" }
> => ({
  raw: "raw-fact",
  kind: "fact",
  source: "file/index0",
  account: "account",
  literal: false,
  identity: ["identity", "fact", "file-slot/index0"],
});
describe("shared source claim domain", () => {
  it("rejects an undeclared literal kind instead of silently extending the domain", () => {
    const claim = {
      ...generated(),
      kind: "unknown-message",
      literal: true,
      identity: null,
    } as unknown as IdentityClaim;
    expect(validateIdentityClaims([claim]).length).toBeGreaterThan(0);
  });
  it("allows the same source reference without minting another identity", () => {
    const a = generated();
    expect(validateIdentityClaims([a, { ...a }])).toEqual([]);
  });
  it("permits repeated literal references of one kind and account", () => {
    const a: IdentityClaim = { ...generated(), literal: true, identity: null };
    expect(
      validateIdentityClaims([a, { ...a, source: "file/index1" }]),
    ).toEqual([]);
  });
  it.each([
    "source",
    "kind",
    "account",
    "literal",
    "raw",
    "semantic",
    "invalid-kind",
  ])("rejects incompatible %s claims", (field) => {
    const a = generated(),
      b = { ...a };
    if (field === "source") b.source = "other-source";
    if (field === "kind") b.kind = "human";
    if (field === "account") b.account = "other-account";
    if (field === "literal") {
      b.literal = true;
      b.identity = null;
    }
    if (field === "raw") b.raw = "other-raw";
    if (field === "semantic") b.identity = ["identity", "fact", "other-slot"];
    if (field === "invalid-kind")
      b.identity = ["identity", "thread", "file-slot/index0"];
    expect(validateIdentityClaims([a, b]).length).toBeGreaterThan(0);
  });
});
