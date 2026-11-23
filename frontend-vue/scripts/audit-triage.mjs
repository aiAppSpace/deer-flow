/** Online advisory gate. A review covers one exact advisory/range/version/path set. */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TRIAGE = join(ROOT, "baseline", "audit-triage.json");
const SEVERITIES = ["info", "low", "moderate", "high", "critical"];
const fail = (message) => {
  throw new Error(message);
};
const record = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
function nonempty(value, label) {
  if (typeof value !== "string" || !value.trim())
    fail(`${label} must be a nonempty string`);
  return value;
}
function strings(value, label) {
  if (!Array.isArray(value) || value.length === 0)
    fail(`${label} must be a nonempty array`);
  return [...new Set(value.map((item) => nonempty(item, label)))].sort();
}
function identity(row) {
  if (!record(row)) fail("Invalid advisory review");
  const advisory = nonempty(row.advisory, "advisory");
  if (!/^GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/.test(advisory))
    fail("Invalid GitHub advisory ID");
  if (!SEVERITIES.includes(row.severity)) fail("Invalid advisory severity");
  if (
    !Array.isArray(row.installed_findings) ||
    row.installed_findings.length === 0
  )
    fail("Installed version/path bindings are required");
  const installedFindings = row.installed_findings
    .map((finding) => ({
      version: nonempty(finding?.version, "finding version"),
      paths: strings(finding?.paths, "finding paths"),
    }))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return {
    package: nonempty(row.package, "package"),
    advisory,
    vulnerable_versions: nonempty(
      row.vulnerable_versions,
      "vulnerable_versions",
    ),
    installed_versions: strings(row.installed_versions, "installed_versions"),
    paths: strings(row.paths, "paths"),
    installed_findings: installedFindings,
    severity: row.severity,
  };
}
const key = (row) => JSON.stringify(identity(row));

/** Invalid/network-failure/partial responses cannot masquerade as a clean audit. */
export function collectAuditFindings(auditJson) {
  if (
    !record(auditJson) ||
    auditJson.error ||
    !record(auditJson.advisories) ||
    !record(auditJson.metadata?.vulnerabilities)
  )
    fail("Incomplete pnpm audit response");
  if (
    auditJson.muted &&
    (!Array.isArray(auditJson.muted) || auditJson.muted.length > 0)
  )
    fail("Muted advisories are not permitted");
  const counts = auditJson.metadata.vulnerabilities;
  if (
    Object.keys(counts).length === 0 ||
    Object.entries(counts).some(
      ([severity, count]) =>
        !SEVERITIES.includes(severity) ||
        !Number.isSafeInteger(count) ||
        count < 0,
    )
  )
    fail("Invalid vulnerability counts");
  const findings = Object.values(auditJson.advisories).map((advisory) => {
    if (
      !record(advisory) ||
      !Array.isArray(advisory.findings) ||
      advisory.findings.length === 0
    )
      fail("Advisory has no installed findings");
    return identity({
      package: advisory.module_name,
      advisory: advisory.github_advisory_id,
      vulnerable_versions: advisory.vulnerable_versions,
      installed_versions: advisory.findings.map((finding) => finding?.version),
      paths: advisory.findings.flatMap((finding) =>
        strings(finding?.paths, "finding paths"),
      ),
      installed_findings: advisory.findings,
      severity: advisory.severity,
    });
  });
  if (
    Object.values(counts).reduce((sum, count) => sum + count, 0) !==
      findings.reduce((sum, row) => sum + row.installed_findings.length, 0) ||
    SEVERITIES.some(
      (severity) =>
        (counts[severity] ?? 0) !==
        findings
          .filter((row) => row.severity === severity)
          .reduce((sum, row) => sum + row.installed_findings.length, 0),
    )
  )
    fail("Advisory count mismatch");
  if (new Set(findings.map(key)).size !== findings.length)
    fail("Duplicate advisory findings");
  return findings.sort((a, b) => key(a).localeCompare(key(b)));
}

/** Changes to severity, affected range, installed version or dependency path need review. */
export function diffTriage(auditedFindings, triagedFindings) {
  if (!Array.isArray(auditedFindings) || !Array.isArray(triagedFindings))
    fail("Advisories must be arrays");
  const audited = auditedFindings.map(key);
  const triaged = triagedFindings.map(key);
  if (
    new Set(audited).size !== audited.length ||
    new Set(triaged).size !== triaged.length
  )
    fail("Duplicate advisory review");
  const current = new Set(audited);
  const reviewed = new Set(triaged);
  return {
    untriaged: audited.filter((id) => !reviewed.has(id)).sort(),
    stale: triaged.filter((id) => !current.has(id)).sort(),
  };
}

export function validateTriage(triage) {
  if (
    !record(triage) ||
    triage.schema_version !== 2 ||
    !Array.isArray(triage.advisories)
  )
    fail("Expected advisory triage schema_version 2");
  for (const row of triage.advisories) {
    identity(row);
    if (
      !["runtime", "build", "dev"].includes(row.reachability) ||
      row.decision !== "accept-unreachable"
    )
      fail("Only source-reviewed unreachable advisories may remain");
    for (const field of ["entry", "why", "revisit", "source"])
      nonempty(row[field], field);
    if (row.why.length < 40 || row.revisit.length < 10)
      fail("Advisory review lacks a concrete rationale/revisit trigger");
    if (row.source !== `https://github.com/advisories/${row.advisory}`)
      fail("Advisory review must link its primary source");
  }
  diffTriage([], triage.advisories);
  return triage.advisories;
}

function runAudit() {
  let stdout;
  try {
    stdout = execFileSync(
      "python3",
      [
        "../scripts/pnpm.py",
        "--dir",
        "frontend-vue",
        "audit",
        "--registry",
        "https://registry.npmjs.org",
        "--json",
      ],
      {
        cwd: ROOT,
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
  } catch (error) {
    // pnpm returns nonzero for vulnerabilities; accept only a complete validated result.
    if (
      typeof error?.stdout !== "string" ||
      !error.stdout.trim().startsWith("{")
    )
      throw error;
    stdout = error.stdout;
  }
  return collectAuditFindings(JSON.parse(stdout));
}

function main() {
  try {
    const reviews = validateTriage(JSON.parse(readFileSync(TRIAGE, "utf8")));
    const findings = runAudit();
    const { untriaged, stale } = diffTriage(findings, reviews);
    console.log(
      `pnpm audit: ${findings.length} advisories; ${reviews.length} exact source reviews`,
    );
    if (untriaged.length || stale.length) {
      for (const row of untriaged) console.error(`UNREVIEWED ${row}`);
      for (const row of stale) console.error(`STALE ${row}`);
      process.exitCode = 1;
    } else console.log("Exact advisory/range/version/path reviews match ✓");
  } catch (error) {
    console.error(`Audit could not be verified: ${error?.message ?? error}`);
    process.exitCode = 2;
  }
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
)
  main();
