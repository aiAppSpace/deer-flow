#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";
import { startNextServer, withLocalPort } from "./next-server.mjs";

/**
 * @param {string} _platform
 * @param {Record<string, string | undefined>} env
 */
export function getDevBundler(_platform = process.platform, env = process.env) {
  const override = env.DEER_FLOW_DEV_BUNDLER?.trim();
  if (override) {
    if (override !== "turbo" && override !== "webpack") {
      throw new Error(
        'DEER_FLOW_DEV_BUNDLER must be either "turbo" or "webpack"',
      );
    }
    return override;
  }
  // Keep Webpack as the cross-platform default while #5132's Turbopack
  // PostCSS worker leak remains unfixed in a stable Next.js release. Retain
  // the platform parameter so restoring the platform-aware default stays a
  // small change once the upstream fix is stable and verified on macOS/Linux.
  return "webpack";
}

/**
 * @param {string[]} nextArgs
 */
function hasHostnameOverride(nextArgs) {
  return nextArgs.some(
    (arg) =>
      arg === "-H" || arg === "--hostname" || arg.startsWith("--hostname="),
  );
}

/**
 * @param {string} platform
 * @param {string[]} extraArgs
 * @param {Record<string, string | undefined>} env
 */
export function getNextDevArgs(
  platform = process.platform,
  extraArgs = [],
  env = process.env,
) {
  const nextArgs = extraArgs[0] === "--" ? extraArgs.slice(1) : extraArgs;
  const args = withLocalPort(
    ["dev", `--${getDevBundler(platform, env)}`, ...nextArgs],
    env,
  );
  // Windows reserves dynamic TCP port ranges (Hyper-V / WSL2 / winnat) that can
  // make Next's default 0.0.0.0 bind fail with EACCES while a loopback bind on
  // the same port succeeds. Bind loopback by default; an explicit
  // --hostname/-H passthrough still opts into a wider interface.
  if (platform === "win32" && !hasHostnameOverride(nextArgs)) {
    args.push("--hostname", "127.0.0.1");
  }
  return args;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  startNextServer(getNextDevArgs(process.platform, process.argv.slice(2)));
}
