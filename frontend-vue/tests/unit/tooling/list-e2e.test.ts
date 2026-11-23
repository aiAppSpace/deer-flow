import { describe, expect, it } from "vitest";

import { summarizeCollection } from "../../../scripts/list-e2e.mjs";

describe("E2E collection results", () => {
  it("preserves a failing child exit even when it printed a test count", () => {
    expect(
      summarizeCollection({
        status: 2,
        stdout: "Total: 12 tests",
        stderr: "bad config",
      }).ok,
    ).toBe(false);
  });

  it("rejects an incomplete report and an empty suite", () => {
    expect(summarizeCollection({ status: 0, stdout: "loading…" }).ok).toBe(
      false,
    );
    expect(
      summarizeCollection({ status: 0, stdout: "Total: 0 tests in 0 files" })
        .ok,
    ).toBe(false);
  });

  it("accepts the actual Playwright singular and plural summaries", () => {
    expect(
      summarizeCollection({ status: 0, stdout: "Total: 1 test in 1 file" }),
    ).toMatchObject({ ok: true, count: 1 });
    expect(
      summarizeCollection({ status: 0, stdout: "Total: 42 tests in 7 files" }),
    ).toMatchObject({ ok: true, count: 42 });
  });

  it("rejects a child process that could not start", () => {
    expect(
      summarizeCollection({ status: null, error: new Error("ENOENT") }).ok,
    ).toBe(false);
  });
});
