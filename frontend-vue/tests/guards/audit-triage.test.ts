import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { validateTriage } from "../../scripts/audit-triage.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const triage = JSON.parse(
  readFileSync(
    new URL("../../baseline/audit-triage.json", import.meta.url),
    "utf8",
  ),
);
const makefile = readFileSync(`${ROOT}Makefile`, "utf8");

describe("audit advisory reviews", () => {
  it("validates exact advisory/range/installed-version/path identities and source rationale", () => {
    expect(() => validateTriage(triage)).not.toThrow();
    expect(validateTriage(triage)).toEqual(triage.advisories);
  });
  it("permits no outstanding advisories after dependencies are fixed", () => {
    expect(validateTriage({ schema_version: 2, advisories: [] })).toEqual([]);
  });
  it("rejects the old package-only blanket review format", () => {
    expect(() =>
      validateTriage({ packages: [{ package: "mermaid", decision: "hold" }] }),
    ).toThrow();
  });
  it("make audit invokes the online advisory gate", () => {
    const commands = makefile
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("#"))
      .filter((line) => line.includes("audit"));
    expect(
      commands.some((line) => line.includes("scripts/audit-triage.mjs")),
    ).toBe(true);
    expect(commands.filter((line) => /\bpnpm\b.*\baudit\b/.test(line))).toEqual(
      [],
    );
  });
});
