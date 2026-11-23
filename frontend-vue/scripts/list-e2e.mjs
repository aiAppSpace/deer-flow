#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

/** A count printed before a configuration error must never hide that error. */
export function summarizeCollection(result) {
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  const match = /^Total: (\d+) tests? in \d+ files?\s*$/m.exec(output);
  const count = match ? Number(match[1]) : 0;
  return {
    ok: result.status === 0 && !result.error && count > 0,
    count,
    output: result.error ? `${output}\n${result.error.message}` : output,
  };
}

function main() {
  const cwd = fileURLToPath(new URL("../", import.meta.url));
  const configs = readdirSync(cwd)
    .filter((name) => /^playwright.*\.config\.ts$/.test(name))
    .sort();
  if (configs.length === 0) throw new Error("No Playwright suites found");
  let failed = false;
  for (const config of configs) {
    const result = summarizeCollection(
      spawnSync(
        process.execPath,
        [
          "scripts/with-loopback-no-proxy.mjs",
          "--",
          process.env.PYTHON ?? "python3",
          "../scripts/pnpm.py",
          "--dir",
          "frontend-vue",
          "exec",
          "playwright",
          "test",
          "-c",
          config,
          "--list",
          "--reporter=line",
        ],
        { cwd, encoding: "utf8" },
      ),
    );
    console.log(
      `${config.padEnd(40)} ${result.ok ? `PASS ${result.count} tests` : "FAIL"}`,
    );
    if (!result.ok) {
      failed = true;
      console.error(result.output || "Collection produced no test summary");
    }
  }
  process.exitCode = failed ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main();
