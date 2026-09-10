import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const REQUIRED_LOOPBACK_HOSTS = ["127.0.0.1", "localhost"];

/**
 * @param {string | undefined} value
 * @returns {string[]}
 */
function entries(value) {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/**
 * 把两种拼写的 NO_PROXY 并成同一份，并保证回环地址在里面。
 *
 * @param {NodeJS.ProcessEnv} [environment]
 * @returns {NodeJS.ProcessEnv} 原环境的副本，两个拼写都改写成合并后的值。
 */
export function mergeLoopbackNoProxy(environment = process.env) {
  const noProxy = [
    ...new Set([
      ...entries(environment.NO_PROXY),
      ...entries(environment.no_proxy),
      ...REQUIRED_LOOPBACK_HOSTS,
    ]),
  ].join(",");

  return {
    ...environment,
    NO_PROXY: noProxy,
    no_proxy: noProxy,
  };
}

function run() {
  const separator = process.argv.indexOf("--");
  const command = separator >= 0 ? process.argv[separator + 1] : undefined;
  const args = separator >= 0 ? process.argv.slice(separator + 2) : [];
  if (!command) {
    console.error(
      "Usage: node scripts/with-loopback-no-proxy.mjs -- <command> [...args]",
    );
    process.exitCode = 2;
    return;
  }

  const child = spawn(command, args, {
    env: mergeLoopbackNoProxy(),
    stdio: "inherit",
  });
  const forwardSignal = (signal) => {
    if (!child.killed) child.kill(signal);
  };
  process.once("SIGINT", forwardSignal);
  process.once("SIGTERM", forwardSignal);
  process.once("SIGHUP", forwardSignal);
  child.once("error", (error) => {
    console.error(error);
    process.exitCode = 1;
  });
  child.once("exit", (code) => {
    process.exitCode = code ?? 1;
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  run();
}
