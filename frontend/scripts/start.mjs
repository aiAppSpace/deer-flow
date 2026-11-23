#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startNextServer, withLocalPort } from "./next-server.mjs";

/** @param {string[]} extraArgs @param {Record<string, string | undefined>} env */
export function getNextStartArgs(extraArgs = [], env = process.env) {
  return withLocalPort(
    ["start", ...(extraArgs[0] === "--" ? extraArgs.slice(1) : extraArgs)],
    env,
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  startNextServer(getNextStartArgs(process.argv.slice(2)));
}
