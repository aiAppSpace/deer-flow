import { describe, expect, it } from "vitest";
import { renewalFromForm } from "@/core/scheduled-tasks/renewal";
const task = { max_runs: 3, end_at: "2030-01-01T09:00:00Z" };
const form = {
  maxRuns: "3",
  removeMaxRuns: false,
  endAt: "2030-01-01T09:00:00.000Z",
  removeEndAt: false,
};
describe("explicit renewal patch semantics", () => {
  it("omits unchanged fields including an equivalent end instant", () => {
    expect(renewalFromForm(task, form)).toEqual({});
  });
  it("sends a larger cap without implicitly clearing the end limit", () => {
    expect(renewalFromForm(task, { ...form, maxRuns: "7" })).toEqual({
      max_runs: 7,
    });
  });
  it("distinguishes explicit clear from an empty untouched field", () => {
    expect(
      renewalFromForm(task, { ...form, maxRuns: "", endAt: null }),
    ).toEqual({});
    expect(
      renewalFromForm(task, {
        ...form,
        removeMaxRuns: true,
        removeEndAt: true,
      }),
    ).toEqual({ max_runs: null, end_at: null });
  });
  it.each(["0", "-1", "1.5", "nan"])(
    "rejects an invalid automatic-run cap %s",
    (maxRuns) => {
      expect(renewalFromForm(task, { ...form, maxRuns })).toBe("invalid");
    },
  );
});
