// CI partitions whole spec files. Each file keeps its stateful scenario chain,
// original Playwright config, serial worker, Gateway, assertions and budgets.
// The ordinary e2e-cross-app target remains the complete sequential local gate.
import { spawnSync } from "node:child_process";
import { readdirSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const EXPLICIT_GROUPS = Object.freeze({
  ledger: ["diff.spec.ts"],
  keyboard: ["keyboard-order.spec.ts", "keyboard-trap.spec.ts"],
  "triple-keyboard": ["triple-keyboard.spec.ts"],
  "triple-overlay": ["triple-overlay-keyboard.spec.ts"],
  reflow: ["triple-reflow.spec.ts", "combined-reflow.spec.ts"],
  layout: [
    "viewport-fit.spec.ts",
    "narrow-screen-overflow.spec.ts",
    "low-height-reachability.spec.ts",
    "overlay-survives-resize.spec.ts",
    "content-reachable.spec.ts",
  ],
  scenarios: ["scenarios.spec.ts"],
});
export const GROUPS = Object.freeze([
  ...Object.keys(EXPLICIT_GROUPS),
  "interactions",
]);

/** @param {string} directory @returns {string[]} */
export function collectSpecFiles(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      if (entry.isDirectory())
        return collectSpecFiles(join(directory, entry.name)).map(
          (file) => `${entry.name}/${file}`,
        );
      return entry.isFile() && entry.name.endsWith(".spec.ts")
        ? [entry.name]
        : [];
    })
    .sort();
}

/** @param {string[]} files @returns {Record<string, string[]>} */
export function planGroups(files) {
  if (!files.length || new Set(files).size !== files.length)
    throw new Error("Expected a nonempty unique parity spec inventory");
  const assigned = Object.values(EXPLICIT_GROUPS).flat();
  if (new Set(assigned).size !== assigned.length)
    throw new Error("A spec belongs to multiple explicit CI groups");
  for (const file of assigned)
    if (!files.includes(file))
      throw new Error(`Required CI spec is missing: ${file}`);
  // New specs join the remainder automatically; no filename allowlist can
  // silently remove them from the mandatory CI union.
  const groups = {
    ...EXPLICIT_GROUPS,
    interactions: files.filter((file) => !assigned.includes(file)),
  };
  if (!groups.interactions.length)
    throw new Error("Empty interaction group must be retired explicitly");
  return groups;
}

/** @param {string} group @param {string[]} files @param {string} [suiteDirectory] */
export function filePattern(
  group,
  files,
  suiteDirectory = join(ROOT, "tests/e2e-parity"),
) {
  const groups = planGroups(files);
  if (!Object.hasOwn(groups, group))
    throw new Error(`Unknown parity CI group: ${group}`);
  const escape = (/** @type {string} */ value) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const paths = groups[group].map((file) =>
    file.split("/").map(escape).join("[\\\\/]"),
  );
  // Playwright applies file filters to absolute source paths. Bind the actual
  // suite root as well as the entire relative filename: a nested directory may
  // itself be named tests/e2e-parity, so a suffix boundary is insufficient.
  const root = suiteDirectory
    .replace(/[\\/]+$/, "")
    .split(/[\\/]/)
    .map(escape)
    .join("[\\\\/]");
  return `^${root}[\\\\/](?:${paths.join("|")})$`;
}

/** @param {string[]} args */
export function parseArguments(args) {
  if (args.length === 1 && args[0] === "--matrix") return { matrix: true };
  if (args.length === 2 && args[0] === "--group" && GROUPS.includes(args[1]))
    return { group: args[1] };
  throw new Error("Usage: parity-ci.mjs --matrix | --group <CI group>");
}

/**
 * @param {string} group
 * @param {{cwd?: string, env?: NodeJS.ProcessEnv, run?: typeof spawnSync}} options
 */
export function runGroup(
  group,
  { cwd = ROOT, env = process.env, run = spawnSync } = {},
) {
  for (const name of [
    "PARITY_ONLY",
    "PARITY_ACCEPT",
    "PARITY_ACCEPT_GROW",
    "E2E_ALLOW_CONCURRENT",
  ])
    if (env[name]?.trim())
      throw new Error(`${name} is not allowed in the formal CI group entry`);
  // scripts/pnpm.py resolves the workspace before launching Playwright. Match
  // that workspace, without resolving a suite-level symlink Playwright keeps.
  const workspace = realpathSync(cwd);
  const suiteDirectory = join(workspace, "tests/e2e-parity");
  const pattern = filePattern(
    group,
    collectSpecFiles(suiteDirectory),
    suiteDirectory,
  );
  const options = {
    cwd: workspace,
    env: { ...env, PARITY_REQUIRE_REACT: "1" },
    stdio: /** @type {const} */ ("inherit"),
  };
  const preflight = run(
    "make",
    ["--no-print-directory", "e2e-preflight"],
    options,
  );
  if (preflight.error) throw preflight.error;
  if (preflight.status !== 0) return preflight.status ?? 1;
  const result = run(
    process.execPath,
    [
      "scripts/keep-e2e-failure-artifacts.mjs",
      "--",
      process.execPath,
      "scripts/with-loopback-no-proxy.mjs",
      "--",
      env.PYTHON || "python3",
      "../scripts/pnpm.py",
      "--dir",
      "frontend-vue",
      "exec",
      "playwright",
      "test",
      "-c",
      "playwright.parity.config.ts",
      // Playwright gives plain filter strings the `i` flag. Explicit regexp
      // syntax preserves case-sensitive ownership on Linux (diff vs Diff).
      `/${pattern}/`,
    ],
    options,
  );
  if (result.error) throw result.error;
  return result.status ?? 1;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const command = parseArguments(process.argv.slice(2));
    if (command.matrix) {
      const groups = planGroups(
        collectSpecFiles(join(ROOT, "tests/e2e-parity")),
      );
      console.log(JSON.stringify({ group: Object.keys(groups) }));
    } else {
      process.exitCode = runGroup(command.group);
    }
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
