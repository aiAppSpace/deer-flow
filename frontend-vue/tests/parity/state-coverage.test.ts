import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { stateCoverageFailures } from "../e2e-parity/support/state-coverage";
import {
  PARITY_SCENARIOS,
  DEFAULT_DIMENSION,
  scenarioStates,
} from "../e2e-parity/support/scenarios";

const clean = {
  missing: [],
  unexpected: [],
  duplicateExpected: [],
  duplicateScans: [],
};
const registered = PARITY_SCENARIOS.flatMap((scenario) =>
  scenarioStates(scenario).map((state) => `${scenario.id}#${state.id}`),
);

describe("terminal state scan coverage", () => {
  it("requires the zero-difference ledger to cover every current sample exactly once", () => {
    const samples = PARITY_SCENARIOS.flatMap((scenario) =>
      scenarioStates(scenario).flatMap((state) =>
        (state.dimensions ?? scenario.dimensions ?? [DEFAULT_DIMENSION]).map(
          (dimension) =>
            `${scenario.id}${state.id ? `#${state.id}` : ""}/${dimension.viewport}/${dimension.theme}/${dimension.locale}`,
        ),
      ),
    );
    const baseline = JSON.parse(
      readFileSync(
        new URL("../../baseline/parity-diff.json", import.meta.url),
        "utf8",
      ),
    ) as { entries: Record<string, Record<string, string[]>> };
    expect(
      stateCoverageFailures(samples, Object.keys(baseline.entries)),
    ).toEqual(clean);
    expect(
      Object.values(baseline.entries).flatMap((entry) =>
        Object.values(entry).flat(),
      ),
    ).toEqual([]);
  });

  it("accepts the complete current registry independently of scan order", () => {
    expect(registered.length).toBeGreaterThan(0);
    expect(
      stateCoverageFailures(registered, [...registered].reverse()),
    ).toEqual(clean);
  });

  it("rejects a missing scan from the current registry", () => {
    const failures = stateCoverageFailures(registered, registered.slice(1));
    expect(failures.missing).toEqual([registered[0]]);
    expect(failures).not.toEqual(clean);
  });

  it("rejects an equal-count replacement and duplicate scan", () => {
    const scanned = [...registered.slice(1), registered[1]!];
    expect(scanned).toHaveLength(registered.length);
    const failures = stateCoverageFailures(registered, scanned);
    expect(failures.missing).toEqual([registered[0]]);
    expect(failures.duplicateScans).toEqual([registered[1]]);
  });

  it("rejects an unregistered state and a duplicate registered identity", () => {
    expect(stateCoverageFailures(["chat#default"], ["chat#other"])).toEqual({
      ...clean,
      missing: ["chat#default"],
      unexpected: ["chat#other"],
    });
    expect(
      stateCoverageFailures(["chat#default", "chat#default"], ["chat#default"]),
    ).toEqual({ ...clean, duplicateExpected: ["chat#default"] });
  });

  it("requires newly registered terminal states without a handwritten total", () => {
    const expanded = [...registered, "new-feature#new-state"];
    expect(stateCoverageFailures(expanded, registered).missing).toEqual([
      "new-feature#new-state",
    ]);
    expect(stateCoverageFailures(expanded, expanded)).toEqual(clean);
  });

  it("requires each registered state in both keyboard directions", () => {
    const expected = registered.flatMap((state) =>
      ["Tab", "Shift+Tab"].map((direction) => `${state}[${direction}]`),
    );
    const scanned = [...expected.slice(1), expected[1]!];
    expect(scanned).toHaveLength(expected.length);
    expect(stateCoverageFailures(expected, scanned)).toEqual({
      ...clean,
      missing: [expected[0]],
      duplicateScans: [expected[1]],
    });
  });
});
