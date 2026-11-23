#!/usr/bin/env node

import { spawn } from "node:child_process";
import { readFile, stat, writeFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const DEMO_THREAD_ID = "7cfa5f8f-a2f8-47ad-acbd-da7137baf990";
export const ROUTES = [
  "/",
  "/login",
  "/workspace/chats",
  `/workspace/chats/${DEMO_THREAD_ID}`,
  "/en/docs",
  "/blog/posts",
];

/**
 * @param {boolean} staticWebsiteOnly
 * @param {Readonly<Record<string, string | undefined>>} baseEnvironment
 */
export function createBuildEnvironment(
  staticWebsiteOnly,
  baseEnvironment = process.env,
) {
  const environment = { ...baseEnvironment };
  if (staticWebsiteOnly) {
    environment.NEXT_PUBLIC_STATIC_WEBSITE_ONLY = "true";
  } else {
    delete environment.NEXT_PUBLIC_STATIC_WEBSITE_ONLY;
  }
  return environment;
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(scriptDir, "..");

export function extractAssetPaths(html) {
  const assets = { css: [], js: [] };
  const seen = { css: new Set(), js: new Set() };
  const attributePattern = /(?:src|href)=["']([^"']+)["']/g;
  for (const match of html.matchAll(attributePattern)) {
    const value = match[1];
    if (!value?.startsWith("/_next/static/")) continue;
    const relativePath = value.slice("/_next/static/".length).split("?", 1)[0];
    if (!relativePath) continue;
    const kind = relativePath.endsWith(".css")
      ? "css"
      : relativePath.endsWith(".js")
        ? "js"
        : null;
    if (kind && !seen[kind].has(relativePath)) {
      seen[kind].add(relativePath);
      assets[kind].push(relativePath);
    }
  }
  return assets;
}

export function evaluateBudgets(measurements, budgets) {
  const failures = [];
  for (const [route, limits] of Object.entries(budgets)) {
    const actual = measurements[route];
    if (!actual) {
      failures.push(`${route}: route was not measured`);
      continue;
    }
    for (const kind of ["css", "js"]) {
      if (actual[kind] <= limits[kind]) continue;
      const overage = actual[kind] - limits[kind];
      failures.push(
        `${route} ${kind}: ${actual[kind]} bytes exceeds ${limits[kind]} bytes by ${overage} ${overage === 1 ? "byte" : "bytes"}`,
      );
    }
  }
  return failures;
}

export function formatMeasurementSummary(measurements) {
  const lines = ["Route asset summary"];
  for (const [route, measurement] of Object.entries(measurements)) {
    lines.push(
      `${route} [${measurement.buildMode}] JS ${measurement.js} B | CSS ${measurement.css} B | HTML ${measurement.html} B`,
    );
  }
  return lines.join("\n");
}

async function getFreePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Failed to allocate a local port"));
        return;
      }
      const { port } = address;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: frontendDir,
      env: process.env,
      stdio: "inherit",
      ...options,
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with ${code ?? signal}`));
    });
  });
}

async function waitForServer(baseUrl, signal) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    signal.throwIfAborted();
    try {
      const response = await fetch(baseUrl, {
        redirect: "manual",
        signal: AbortSignal.any([
          signal,
          AbortSignal.timeout(
            Math.max(1, Math.min(2_000, deadline - Date.now())),
          ),
        ]),
      });
      if (response.status < 500) return;
    } catch {
      // Retry only readiness failures. A child error, exit or parent signal is
      // the original failure and must not be replaced by a readiness timeout.
      signal.throwIfAborted();
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  signal.throwIfAborted();
  throw new Error("Timed out waiting for the Next.js production server");
}

async function measureRoute(baseUrl, route, signal) {
  const response = await fetch(`${baseUrl}${route}`, {
    redirect: "manual",
    signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]),
  });
  if (!response.ok) {
    throw new Error(`${route} returned HTTP ${response.status}`);
  }
  const html = await response.text();
  const assets = extractAssetPaths(html);
  const totals = { css: 0, js: 0 };
  for (const kind of ["css", "js"]) {
    for (const relativePath of assets[kind]) {
      const assetPath = path.join(frontendDir, ".next", "static", relativePath);
      totals[kind] += (await stat(assetPath)).size;
    }
  }
  signal.throwIfAborted();
  return { ...totals, assets, html: Buffer.byteLength(html) };
}

async function measureBuild(routes, staticWebsiteOnly) {
  const env = createBuildEnvironment(staticWebsiteOnly);
  await run(
    env.PYTHON ?? (process.platform === "win32" ? "python" : "python3"),
    [
      path.resolve(frontendDir, "../scripts/pnpm.py"),
      "--dir",
      "frontend",
      "exec",
      "next",
      "build",
    ],
    {
      env,
    },
  );

  const port = await getFreePort();
  const server = spawn(
    process.execPath,
    [
      fileURLToPath(
        new URL("../node_modules/next/dist/bin/next", import.meta.url),
      ),
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    {
      cwd: frontendDir,
      env,
      stdio: ["ignore", "inherit", "inherit"],
    },
  );

  // One lifetime owns launch failures, child exit, HTTP operations and parent
  // interruption. The awaited stop targets the actual Next listener process.
  const lifetime = new AbortController();
  let ended = false;
  let termSent = false;
  let killSent = false;
  const stopped = new Promise((resolve) => {
    server.on("error", (error) => {
      lifetime.abort(error);
      // A failed spawn has no process to await. Signal-delivery errors after
      // spawn are not exits: keep waiting and retain the forced-stop timer.
      if (server.pid === undefined) {
        ended = true;
        resolve();
      }
    });
    server.once("exit", (code, signal) => {
      ended = true;
      // Next handles SIGTERM and deliberately exits 143 rather than exposing
      // a signal exit. Admit that code only after our own successful delivery.
      const expectedStop =
        (termSent && (code === 0 || code === 143 || signal === "SIGTERM")) ||
        (killSent && signal === "SIGKILL");
      if (!expectedStop) {
        lifetime.abort(
          new Error(`Next.js server exited with ${code ?? signal}`),
        );
      }
      resolve();
    });
  });
  const interrupt = (name, code) => {
    process.exitCode = code;
    lifetime.abort(new Error(`Route measurement interrupted by ${name}`));
  };
  const onInterrupt = () => interrupt("SIGINT", 130);
  const onTerminate = () => interrupt("SIGTERM", 143);
  process.on("SIGINT", onInterrupt);
  process.on("SIGTERM", onTerminate);
  const measurements = {};
  try {
    const baseUrl = `http://127.0.0.1:${port}`;
    await waitForServer(baseUrl, lifetime.signal);
    for (const route of routes) {
      measurements[route] = {
        ...(await measureRoute(baseUrl, route, lifetime.signal)),
        buildMode: staticWebsiteOnly ? "static-demo" : "normal",
      };
    }
    lifetime.signal.throwIfAborted();
  } finally {
    try {
      if (!ended) {
        const forceStop = setTimeout(() => {
          killSent = server.kill("SIGKILL");
        }, 5_000);
        try {
          termSent = server.kill("SIGTERM");
          await stopped;
        } finally {
          clearTimeout(forceStop);
        }
      }
    } finally {
      process.removeListener("SIGINT", onInterrupt);
      process.removeListener("SIGTERM", onTerminate);
    }
  }
  // A parent interruption during awaited shutdown must also prevent the next
  // build. Normal owned shutdown does not abort this lifetime.
  lifetime.signal.throwIfAborted();
  return measurements;
}

async function main() {
  const check = process.argv.includes("--check");
  const measurements = {
    ...(await measureBuild(["/login"], false)),
    ...(await measureBuild(
      ROUTES.filter((route) => route !== "/login"),
      true,
    )),
  };
  await writeFile(
    path.join(frontendDir, ".next", "performance-results.json"),
    `${JSON.stringify(measurements, null, 2)}\n`,
  );
  process.stdout.write(`${JSON.stringify(measurements, null, 2)}\n`);
  process.stdout.write(`${formatMeasurementSummary(measurements)}\n`);

  if (check) {
    const budgets = JSON.parse(
      await readFile(
        path.join(frontendDir, "performance-budgets.json"),
        "utf8",
      ),
    );
    const failures = evaluateBudgets(measurements, budgets);
    if (failures.length > 0) {
      throw new Error(`Route asset budgets failed:\n${failures.join("\n")}`);
    }
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.stack : String(error)}\n`,
    );
    process.exitCode = process.exitCode || 1;
  });
}
