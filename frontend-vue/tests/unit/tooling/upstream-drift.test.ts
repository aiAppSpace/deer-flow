import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  acceptReviewedDrift,
  inspectDrift,
  WATCHED,
} from "../../../scripts/upstream-drift.mjs";
const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "upstream-drift-"));
  roots.push(root);
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  git("init", "-q");
  git("config", "user.name", "Fixture");
  git("config", "user.email", "fixture@example.invalid");
  for (const path of WATCHED) {
    const file = /\.(json|yaml|toml|lock)$/.test(path)
      ? join(root, path)
      : join(root, path, "source.txt");
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, "source\n");
  }
  git("add", ".");
  git("commit", "-qm", "source");
  return {
    root,
    git,
    marker: { commit: git("rev-parse", "HEAD"), watched: WATCHED },
  };
}
describe("reviewed three-component drift", () => {
  it("requires review when dependency source repairs are committed, edited or added", () => {
    const { root, git, marker } = fixture();
    const patch = "frontend/patches/sonner@2.0.7.patch";
    mkdirSync(dirname(join(root, patch)), { recursive: true });
    writeFileSync(join(root, patch), "dependency source repair\n");
    expect(inspectDrift(root, marker).untracked).toContain(patch);
    git("add", patch);
    git("commit", "-qm", "dependency source repair");
    expect(inspectDrift(root, marker).committed).toContain(patch);
    writeFileSync(join(root, patch), "revised dependency source repair\n");
    const result = inspectDrift(root, marker);
    expect(result.status).toBe("REVIEW_REQUIRED");
    expect(result.dirty).toContain(patch);
  });
  it("requires review for committed, dirty and untracked frontend/backend/contracts changes", () => {
    const { root, git, marker } = fixture();
    expect(inspectDrift(root, marker).status).toBe("CLEAN");
    writeFileSync(join(root, "frontend/src/source.txt"), "new frontend\n");
    git("add", ".");
    git("commit", "-qm", "frontend");
    writeFileSync(join(root, "backend/app/source.txt"), "dirty backend\n");
    writeFileSync(join(root, join("contracts", "new.json")), "{}\n");
    const result = inspectDrift(root, marker);
    expect(result.status).toBe("REVIEW_REQUIRED");
    expect(result.committed).toContain("frontend/src/source.txt");
    expect(result.dirty).toContain("backend/app/source.txt");
    expect(result.untracked).toContain(join("contracts", "new.json"));
    expect(() =>
      acceptReviewedDrift({
        repo: root,
        markerPath: join(root, "marker.json"),
        result,
        reviewedRevision: result.head,
        reviewEvidence: join("contracts", "new.json"),
      }),
    ).toThrow(/Uncommitted/);
  });
  it("reports UNKNOWN for missing sibling/history instead of a clean review", () => {
    const { root, marker } = fixture();
    expect(
      inspectDrift(root, { ...marker, commit: "f".repeat(40) }).status,
    ).toBe("UNKNOWN");
    rmSync(join(root, "frontend"), { recursive: true });
    expect(inspectDrift(root, marker).status).toBe("UNKNOWN");
  });
  it("requires current scope, explicit revision and saved review evidence", () => {
    const { root, marker } = fixture();
    expect(
      inspectDrift(root, { ...marker, watched: ["frontend/src"] })
        .scopeReviewPending,
    ).toBe(true);
    const result = inspectDrift(root, marker);
    const markerPath = join(root, "marker.json");
    const options = {
      repo: root,
      markerPath,
      result,
      reviewedRevision: result.head,
      reviewEvidence: "review.md",
    };
    expect(() =>
      acceptReviewedDrift({ ...options, reviewedRevision: undefined }),
    ).toThrow(/explicitly reviewed/);
    expect(() => acceptReviewedDrift(options)).toThrow(/report/);
    writeFileSync(join(root, "review.md"), "Completed acceptance evidence.\n");
    acceptReviewedDrift(options);
    expect(JSON.parse(readFileSync(markerPath, "utf8")).watched).toEqual(
      WATCHED,
    );
  });
});
