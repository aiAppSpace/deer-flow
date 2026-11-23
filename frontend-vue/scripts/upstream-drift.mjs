#!/usr/bin/env node
/** Report reviewed frontend/backend/contracts changes, including the working tree. */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const WATCHED = [
  "frontend/src",
  "frontend/tests",
  "frontend/package.json",
  "frontend/pnpm-lock.yaml",
  "frontend/patches",
  "backend/app",
  "backend/packages",
  "backend/tests",
  "backend/pyproject.toml",
  "backend/uv.lock",
  "contracts",
  "config.example.yaml",
];
const REPO = fileURLToPath(new URL("../../", import.meta.url));
const MARKER = fileURLToPath(
  new URL("../baseline/upstream-marker.json", import.meta.url),
);
function git(repo, args) {
  return execFileSync("git", args, {
    cwd: repo,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trimEnd();
}
const lines = (value) => value.split("\n").filter(Boolean);

export function inspectDrift(repo, marker) {
  if (!existsSync(resolve(repo, "frontend/src")))
    return {
      status: "UNKNOWN",
      reason: "React sibling absent; cross-component review is UNRUN.",
    };
  if (!marker?.commit)
    return { status: "UNKNOWN", reason: "Reviewed marker missing." };
  const missing = WATCHED.filter((path) => !existsSync(resolve(repo, path)));
  if (missing.length)
    return {
      status: "UNKNOWN",
      reason: `Watched source paths missing: ${missing.join(", ")}`,
    };
  let head;
  try {
    head = git(repo, ["rev-parse", "HEAD"]);
    git(repo, ["cat-file", "-e", `${marker.commit}^{commit}`]);
    git(repo, ["merge-base", "--is-ancestor", marker.commit, head]);
  } catch {
    return {
      status: "UNKNOWN",
      reason: "Reviewed history is unreachable or is not an ancestor of HEAD.",
    };
  }
  const committed = lines(
    git(repo, [
      "diff",
      "--name-only",
      `${marker.commit}..${head}`,
      "--",
      ...WATCHED,
    ]),
  );
  const dirty = lines(
    git(repo, ["diff", "--name-only", "HEAD", "--", ...WATCHED]),
  );
  const untracked = lines(
    git(repo, ["ls-files", "--others", "--exclude-standard", "--", ...WATCHED]),
  );
  const scopeReviewPending =
    JSON.stringify(marker.watched) !== JSON.stringify(WATCHED);
  const files = [...new Set([...committed, ...dirty, ...untracked])].sort();
  return {
    status: files.length || scopeReviewPending ? "REVIEW_REQUIRED" : "CLEAN",
    head,
    committed,
    dirty,
    untracked,
    files,
    scopeReviewPending,
  };
}

export function acceptReviewedDrift({
  repo,
  markerPath,
  result,
  reviewedRevision,
  reviewEvidence,
}) {
  if (result.status === "UNKNOWN") throw new Error(result.reason);
  if (result.dirty.length || result.untracked.length)
    throw new Error(
      "Uncommitted watched changes remain; a HEAD marker cannot acknowledge them.",
    );
  if (reviewedRevision !== result.head)
    throw new Error(
      "Pass the explicitly reviewed full HEAD revision; automatic HEAD acceptance is disabled.",
    );
  const evidencePath = reviewEvidence && resolve(repo, reviewEvidence);
  if (
    !evidencePath ||
    !existsSync(evidencePath) ||
    !readFileSync(evidencePath, "utf8").trim()
  )
    throw new Error(
      "A saved completed review and acceptance report is required.",
    );
  const next = {
    $comment:
      "Explicitly reviewed frontend/backend/contracts revision; does not assert byte equality.",
    commit: reviewedRevision,
    acceptedAt: new Date().toISOString(),
    watched: WATCHED,
    reviewEvidence,
  };
  writeFileSync(markerPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
}

export function main(args = process.argv.slice(2)) {
  const marker = existsSync(MARKER)
    ? JSON.parse(readFileSync(MARKER, "utf8"))
    : null;
  const result = inspectDrift(REPO, marker);
  if (args.includes("--json")) {
    console.log(
      JSON.stringify(
        { watched: WATCHED, reviewed: marker?.commit ?? null, ...result },
        null,
        2,
      ),
    );
    return result.status === "UNKNOWN"
      ? 2
      : args.includes("--check") && result.status !== "CLEAN"
        ? 1
        : 0;
  }
  if (args.includes("--accept")) {
    const value = (flag) => {
      const index = args.indexOf(flag);
      return index < 0 ? undefined : args[index + 1];
    };
    try {
      acceptReviewedDrift({
        repo: REPO,
        markerPath: MARKER,
        result,
        reviewedRevision: value("--reviewed-revision"),
        reviewEvidence: value("--review-evidence"),
      });
      console.log(`Reviewed marker advanced to ${result.head}.`);
      return 0;
    } catch (error) {
      console.error(error.message);
      return 2;
    }
  }
  console.log(`Cross-component drift: ${result.status}`);
  if (result.status === "UNKNOWN") {
    console.log(result.reason);
    return args.includes("--check") ? 2 : 0;
  }
  console.log(`Reviewed ${marker.commit} -> ${result.head}`);
  console.log(`Watched: ${WATCHED.join(", ")}`);
  if (result.scopeReviewPending)
    console.log(
      "The old marker does not cover the current review scope; scope review remains pending.",
    );
  for (const [kind, paths] of [
    ["committed", result.committed],
    ["working tree", result.dirty],
    ["untracked", result.untracked],
  ]) {
    console.log(`${kind}: ${paths.length} files`);
    for (const path of paths.slice(0, 15)) console.log(`  ${path}`);
    if (paths.length > 15)
      console.log(
        `  ${paths.length - 15} more; use --json for the complete inventory.`,
      );
  }
  return args.includes("--check") && result.status !== "CLEAN" ? 1 : 0;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1])
  process.exitCode = main();
