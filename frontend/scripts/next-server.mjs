import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

/** @param {string[]} args @param {Record<string, string | undefined>} env */
export function withLocalPort(args, env = process.env) {
  const hasPort = args.some(
    (arg) =>
      arg === "--port" ||
      arg.startsWith("--port=") ||
      arg === "-p" ||
      /^-p\d/.test(arg),
  );
  // Container/caller PORT and CLI flags keep Next's normal precedence.
  return hasPort || env.PORT?.trim() ? args : [...args, "--port", "3200"];
}

/** @param {string[]} args */
export function startNextServer(args) {
  const child = spawn(
    process.execPath,
    [
      fileURLToPath(
        new URL("../node_modules/next/dist/bin/next", import.meta.url),
      ),
      ...args,
    ],
    {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      env: process.env,
      stdio: "inherit",
    },
  );
  child.on("error", (error) => {
    console.error(`Failed to start Next.js: ${error.message}`);
    process.exitCode = 1;
  });
  child.on("exit", (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    else process.exitCode = code ?? 1;
  });
}
