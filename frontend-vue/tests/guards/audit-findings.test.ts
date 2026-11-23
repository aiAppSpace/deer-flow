import { describe, expect, it } from "vitest";
import * as audit from "../../scripts/audit-triage.mjs";

const input = (
  id = "GHSA-aaaa-bbbb-cccc",
  range = "<2.0.0",
  version = "1.0.0",
  path = ".>renderer>package",
) => ({
  advisories: {
    "123": {
      module_name: "package",
      github_advisory_id: id,
      vulnerable_versions: range,
      severity: "high",
      findings: [{ version, paths: [path] }],
    },
  },
  metadata: { vulnerabilities: { high: 1 } },
});
const collect = (value: unknown) =>
  (
    audit as unknown as { collectAuditFindings: (value: unknown) => unknown[] }
  ).collectAuditFindings(value);
const diff = (current: unknown[], triaged: unknown[]) =>
  (
    audit as unknown as {
      diffTriage: (
        current: unknown[],
        triaged: unknown[],
      ) => { untriaged: string[]; stale: string[] };
    }
  ).diffTriage(current, triaged);
describe("audit advisory identity", () => {
  it("distinguishes a new advisory on an already accepted package", () => {
    const result = diff(
      collect(input("GHSA-dddd-eeee-ffff")),
      collect(input()),
    );
    expect(result.untriaged).toHaveLength(1);
    expect(result.stale).toHaveLength(1);
  });
  it.each([
    ["range", input("GHSA-aaaa-bbbb-cccc", "<3.0.0")],
    ["installed version", input("GHSA-aaaa-bbbb-cccc", "<2.0.0", "1.1.0")],
    [
      "dependency reachability",
      input("GHSA-aaaa-bbbb-cccc", "<2.0.0", "1.0.0", ".>server>package"),
    ],
  ])("requires renewed review for changed %s", (_name, changed) => {
    expect(diff(collect(changed), collect(input())).untriaged).toHaveLength(1);
  });
  it("detects stale reviews after the vulnerable package is repaired", () => {
    expect(diff([], collect(input())).stale).toHaveLength(1);
  });
  it.each([
    undefined,
    {},
    { error: { code: "ENETUNREACH" } },
    { advisories: {}, metadata: { vulnerabilities: { high: 1 } } },
  ])("fails closed on invalid/failed audit output", (value) => {
    expect(() => collect(value)).toThrow();
  });
  it("accepts a valid zero-vulnerability audit", () => {
    expect(
      collect({ advisories: {}, metadata: { vulnerabilities: { high: 0 } } }),
    ).toEqual([]);
  });
  it("binds each installed version to its own dependency paths", () => {
    const current = input();
    current.advisories["123"].findings = [
      { version: "1.0.0", paths: [".>a>package"] },
      { version: "1.1.0", paths: [".>b>package"] },
    ];
    current.metadata.vulnerabilities.high = 2;
    const changed = structuredClone(current);
    changed.advisories["123"].findings.reverse();
    changed.advisories["123"].findings[0]!.version = "1.0.0";
    changed.advisories["123"].findings[1]!.version = "1.1.0";
    expect(diff(collect(changed), collect(current)).untriaged).toHaveLength(1);
  });
  it("rejects duplicate reviews and incomplete advisory findings", () => {
    const finding = collect(input())[0];
    expect(() => diff([], [finding, finding])).toThrow();
    expect(() =>
      collect({
        advisories: { "1": { module_name: "package", findings: [] } },
        metadata: { vulnerabilities: { high: 1 } },
      }),
    ).toThrow();
  });
  it("does not permit muted advisories or severity count mismatch", () => {
    expect(() => collect({ ...input(), muted: [123] })).toThrow();
    expect(() =>
      collect({ ...input(), metadata: { vulnerabilities: { moderate: 1 } } }),
    ).toThrow();
  });
});
